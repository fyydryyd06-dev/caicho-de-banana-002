import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db, loginAttemptsTable, type LoginAttemptRow } from "@workspace/db";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const secret = process.env.ADMIN_JWT_SECRET;
  if (header.startsWith("Bearer ") && secret) {
    try {
      const d = jwt.verify(header.slice(7), secret);
      if (typeof d === "object" && (d as { role?: string }).role === "admin") return next();
    } catch {
      /* invalid */
    }
  }
  res.status(401).json({ message: "Não autenticado." });
}

function parseUA(ua: string) {
  const browser = /Edg/.test(ua) ? "Edge" : /OPR|Opera/.test(ua) ? "Opera"
    : /Firefox/.test(ua) ? "Firefox" : /Chrome/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari" : "Outro";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux" : "-";
  const deviceType = /iPad|Tablet/.test(ua) ? "Tablet"
    : /Mobile|Android|iPhone/.test(ua) ? "Mobile" : "Desktop";
  return { browser, os, deviceType };
}

function clientIp(req: Request): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined) ?? "";
  const ip = fwd.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  return ip.replace(/^::ffff:/, "");
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

/** Público: registra uma tentativa de autenticação (NUNCA a senha/PIN). */
router.post("/auth-attempt", async (req, res) => {
  const b = req.body ?? {};
  const ua = (typeof b.userAgent === "string" && b.userAgent) || req.headers["user-agent"] || "";
  const { browser, os, deviceType } = parseUA(String(ua));
  const ip = clientIp(req);
  const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1)/.test(ip);
  await db.insert(loginAttemptsTable).values({
    route: str(b.route, 300) ?? "/",
    login: str(b.login, 120),
    status: str(b.status, 40) ?? "submitted",
    ip,
    browser,
    os,
    deviceType,
    language: str(b.language, 40),
    timezone: str(b.timezone, 60),
    screen: str(b.screen, 30),
    referrer: str(b.referrer, 300),
    userAgent: String(ua).slice(0, 500),
    location: isPrivate ? "Local" : "Internet",
  });
  res.json({ ok: true });
});

const toClient = (r: LoginAttemptRow) => ({
  id: r.id,
  route: r.route,
  login: r.login,
  status: r.status,
  ip: r.ip,
  browser: r.browser,
  deviceType: r.deviceType,
  os: r.os,
  language: r.language,
  timezone: r.timezone,
  screen: r.screen,
  referrer: r.referrer,
  userAgent: r.userAgent,
  location: r.location,
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
});

/** Admin: lista de tentativas de login. */
router.get("/auth-attempt/list", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(loginAttemptsTable)
    .orderBy(desc(loginAttemptsTable.createdAt)).limit(500);
  res.json({ items: rows.map(toClient) });
});

export default router;
