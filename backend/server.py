"""Platform glue for the Caicho de Banana monorepo.

The Emergent supervisor is read-only and launches this FastAPI app with
`uvicorn server:app --host 0.0.0.0 --port 8001` from /app/backend. The real
backend is the Express + PostgreSQL + Drizzle API server in
`artifacts/api-server`. This module boots that Express server on an internal
port and reverse-proxies every request to it, so the existing stack runs
unchanged (no migration to FastAPI/Mongo).
"""

import asyncio
import os
import signal
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from starlette.background import BackgroundTask

REPO_ROOT = Path("/app")
API_DIR = REPO_ROOT / "artifacts" / "api-server"


def _load_env() -> dict[str, str]:
    env = os.environ.copy()
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


ENV = _load_env()
INTERNAL_PORT = ENV.get("API_INTERNAL_PORT", "5000")
INTERNAL_BASE = f"http://127.0.0.1:{INTERNAL_PORT}"

_express_proc: subprocess.Popen | None = None
_monitor_task: asyncio.Task | None = None
_stopping = False


def _spawn_express() -> subprocess.Popen:
    child_env = ENV.copy()
    child_env["PORT"] = INTERNAL_PORT
    child_env.setdefault("NODE_ENV", "development")
    return subprocess.Popen(
        ["pnpm", "--filter", "@workspace/api-server", "run", "start"],
        cwd=str(REPO_ROOT),
        env=child_env,
        preexec_fn=os.setsid,
    )


def _build_express() -> None:
    subprocess.run(
        ["pnpm", "--filter", "@workspace/api-server", "run", "build"],
        cwd=str(REPO_ROOT),
        env=ENV,
        check=False,
    )


async def _wait_healthy(timeout: float = 30.0) -> None:
    async with httpx.AsyncClient() as client:
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            try:
                r = await client.get(f"{INTERNAL_BASE}/api/healthz", timeout=2)
                if r.status_code < 500:
                    return
            except Exception:
                pass
            await asyncio.sleep(0.5)


async def _monitor() -> None:
    global _express_proc
    while not _stopping:
        await asyncio.sleep(2)
        if _express_proc is not None and _express_proc.poll() is not None:
            if _stopping:
                break
            _express_proc = _spawn_express()


def _kill_express() -> None:
    global _express_proc
    if _express_proc is not None:
        try:
            os.killpg(os.getpgid(_express_proc.pid), signal.SIGTERM)
        except Exception:
            pass
        _express_proc = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _express_proc, _monitor_task, _stopping
    _stopping = False
    # Free the internal port from any stale process before starting.
    subprocess.run(["pkill", "-f", "artifacts/api-server"], check=False)
    await asyncio.sleep(0.5)
    _build_express()
    _express_proc = _spawn_express()
    _monitor_task = asyncio.create_task(_monitor())
    await _wait_healthy()
    try:
        yield
    finally:
        _stopping = True
        if _monitor_task:
            _monitor_task.cancel()
        _kill_express()


app = FastAPI(lifespan=lifespan)
_client = httpx.AsyncClient(base_url=INTERNAL_BASE, timeout=httpx.Timeout(60.0))

_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "host",
}


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(path: str, request: Request) -> Response:
    url = httpx.URL(path="/" + path, query=request.url.query.encode("utf-8"))
    headers = [(k, v) for k, v in request.headers.raw if k.decode().lower() != "host"]
    body = await request.body()
    req = _client.build_request(
        request.method, url, headers=headers, content=body
    )
    upstream = await _client.send(req, stream=True)
    resp_headers = [
        (k, v)
        for k, v in upstream.headers.items()
        if k.lower() not in _HOP_BY_HOP
    ]
    return Response(
        content=await upstream.aread(),
        status_code=upstream.status_code,
        headers=dict(resp_headers),
        background=BackgroundTask(upstream.aclose),
    )
