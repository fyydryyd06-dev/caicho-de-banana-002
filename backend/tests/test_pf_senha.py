"""Backend tests for the PF password routes (Caicho de Banana).

Endpoints under test (mounted at /api):
- POST /api/pf/senha/consultar
- POST /api/pf/senha/validar
- POST /api/pf/senha/definir
- POST /api/pf/senha/recuperar
- POST /api/pf/senha/redefinir
"""
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://261dacec-d9fa-4b50-a220-88a1c5689811.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _seed():
    """Reset DB state via pnpm seed."""
    subprocess.run(
        ["bash", "-lc", "cd /app && set -a && . /app/.env && set +a && pnpm --filter @workspace/db run seed"],
        check=True, capture_output=True, text=True,
    )


@pytest.fixture(scope="module", autouse=True)
def reset_before_module():
    _seed()
    yield
    _seed()


@pytest.fixture
def reset_state():
    _seed()
    yield


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- CONSULTAR ----------------

class TestConsultar:
    def test_conta_com_senha(self, api_client, reset_state):
        r = api_client.post(f"{API}/pf/senha/consultar", json={"agency": "00019", "account": "987654"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["exists"] is True
        assert d["hasPassword"] is True
        assert d["locked"] is False
        assert "holderName" in d and isinstance(d["holderName"], str) and len(d["holderName"]) > 0

    def test_conta_primeiro_acesso(self, api_client, reset_state):
        r = api_client.post(f"{API}/pf/senha/consultar", json={"agency": "12345", "account": "123456"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["exists"] is True
        assert d["hasPassword"] is False
        assert d["locked"] is False

    def test_conta_bloqueada(self, api_client, reset_state):
        r = api_client.post(f"{API}/pf/senha/consultar", json={"agency": "45006", "account": "112233"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["exists"] is True
        assert d["locked"] is True

    def test_conta_inexistente(self, api_client):
        r = api_client.post(f"{API}/pf/senha/consultar", json={"agency": "99999", "account": "999999"})
        assert r.status_code == 200
        assert r.json().get("exists") is False


# ---------------- VALIDAR ----------------

class TestValidar:
    def test_senha_correta(self, api_client, reset_state):
        r = api_client.post(f"{API}/pf/senha/validar", json={"agency": "00019", "account": "987654", "password": "12345678"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert "holderName" in d and isinstance(d["holderName"], str)

    def test_senha_errada_decrementa_tentativas_e_bloqueia(self, api_client, reset_state):
        # 1st wrong
        r1 = api_client.post(f"{API}/pf/senha/validar", json={"agency": "00019", "account": "987654", "password": "00000000"})
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["success"] is False
        assert d1.get("attemptsRemaining") == 2

        # 2nd wrong
        r2 = api_client.post(f"{API}/pf/senha/validar", json={"agency": "00019", "account": "987654", "password": "00000000"})
        d2 = r2.json()
        assert d2["success"] is False
        assert d2.get("attemptsRemaining") == 1

        # 3rd wrong -> locked
        r3 = api_client.post(f"{API}/pf/senha/validar", json={"agency": "00019", "account": "987654", "password": "00000000"})
        d3 = r3.json()
        assert d3["success"] is False
        assert d3.get("locked") is True

    def test_validacao_zod_senha_curta(self, api_client):
        r = api_client.post(f"{API}/pf/senha/validar", json={"agency": "00019", "account": "987654", "password": "123"})
        assert r.status_code == 400


# ---------------- DEFINIR ----------------

class TestDefinir:
    def test_definir_primeiro_acesso_e_bloqueio_de_redefinicao(self, api_client, reset_state):
        r = api_client.post(f"{API}/pf/senha/definir", json={
            "agency": "12345", "account": "123456",
            "password": "11112222", "confirmPassword": "11112222",
        })
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # Verify persistence via consultar
        c = api_client.post(f"{API}/pf/senha/consultar", json={"agency": "12345", "account": "123456"}).json()
        assert c["hasPassword"] is True

        # Repeat should fail
        r2 = api_client.post(f"{API}/pf/senha/definir", json={
            "agency": "12345", "account": "123456",
            "password": "33334444", "confirmPassword": "33334444",
        })
        assert r2.status_code in (200, 400, 409)
        assert r2.json().get("success") is False

    def test_definir_senha_curta_400(self, api_client, reset_state):
        r = api_client.post(f"{API}/pf/senha/definir", json={
            "agency": "12345", "account": "123456",
            "password": "111", "confirmPassword": "111",
        })
        assert r.status_code == 400


# ---------------- RECUPERAR / REDEFINIR ----------------

class TestRecuperarRedefinir:
    def test_fluxo_recuperacao_completo(self, api_client, reset_state):
        r = api_client.post(f"{API}/pf/senha/recuperar", json={"agency": "00019", "account": "987654"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert "maskedPhone" in d and isinstance(d["maskedPhone"], str)
        assert "recoveryCode" in d  # exposed in demo
        code = d["recoveryCode"]
        assert code == "246810"

        r2 = api_client.post(f"{API}/pf/senha/redefinir", json={
            "agency": "00019", "account": "987654",
            "recoveryCode": code,
            "newPassword": "87654321", "confirmNewPassword": "87654321",
        })
        assert r2.status_code == 200, r2.text
        assert r2.json().get("success") is True

        # Now validate with new password
        v = api_client.post(f"{API}/pf/senha/validar", json={"agency": "00019", "account": "987654", "password": "87654321"})
        assert v.status_code == 200
        assert v.json().get("success") is True

    def test_redefinir_codigo_errado(self, api_client, reset_state):
        api_client.post(f"{API}/pf/senha/recuperar", json={"agency": "00019", "account": "987654"})
        r = api_client.post(f"{API}/pf/senha/redefinir", json={
            "agency": "00019", "account": "987654",
            "recoveryCode": "000000",
            "newPassword": "87654321", "confirmNewPassword": "87654321",
        })
        assert r.status_code in (200, 400)
        assert r.json().get("success") is False
