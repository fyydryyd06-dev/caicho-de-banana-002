import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, gte, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db, accessesTable, type AccessRow } from "@workspace/db";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!header.startsWith("Bearer ") || !secret) {
    res.status(401).json({ message: "Não autenticado." });
    return;
  }
  try {
    const d = jwt.verify(header.slice(7), secret);
    if (typeof d === "object" && (d as { role?: string }).role === "admin") return next();
  } catch {
    /* invalid */
  }
  res.status(401).json({ message: "Não autenticado." });
}

function parseUA(ua: string) {
  const browser = /Edg/.test(ua) ? "Edge"
    : /OPR|Opera/.test(ua) ? "Opera"
    : /Firefox/.test(ua) ? "Firefox"
    : /Chrome/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari" : "Outro";
  const os = /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
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

/** Público: registra um acesso a uma página do site. */
router.post("/access/track", async (req, res) => {
  const b = req.body ?? {};
  const ua = (typeof b.userAgent === "string" && b.userAgent) || req.headers["user-agent"] || "";
  const { browser, os, deviceType } = parseUA(String(ua));
  const ip = clientIp(req);
  const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1)/.test(ip);
  await db.insert(accessesTable).values({
    route: typeof b.route === "string" ? b.route.slice(0, 300) : "/",
    ip,
    browser,
    os,
    deviceType,
    language: typeof b.language === "string" ? b.language.slice(0, 40) : null,
    timezone: typeof b.timezone === "string" ? b.timezone.slice(0, 60) : null,
    screen: typeof b.screen === "string" ? b.screen.slice(0, 30) : null,
    referrer: typeof b.referrer === "string" ? b.referrer.slice(0, 300) : null,
    userAgent: String(ua).slice(0, 500),
    location: isPrivate ? "Local" : "Internet",
  });
  res.json({ ok: true });
});

const toClient = (r: AccessRow) => ({
  id: r.id,
  route: r.route,
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

/** Admin: métricas do dashboard. */
router.get("/access/stats", requireAdmin, async (_req, res) => {
  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const hourAgo = new Date(now - 3600_000);
  const weekAgo = new Date(now - 7 * 86400_000);
  const dayAgo = new Date(now - 86400_000);

  const count = async (from?: Date) => {
    const q = db.select({ c: sql<number>`count(*)::int` }).from(accessesTable);
    const rows = from ? await q.where(gte(accessesTable.createdAt, from)) : await q;
    return rows[0]?.c ?? 0;
  };

  const [total, today, lastHour, last7days] = await Promise.all([
    count(), count(dayStart), count(hourAgo), count(weekAgo),
  ]);

  const recentRows = await db.select().from(accessesTable)
    .orderBy(desc(accessesTable.createdAt)).limit(15);

  const byHourRows = await db
    .select({
      h: sql<string>`to_char(date_trunc('hour', ${accessesTable.createdAt}), 'YYYY-MM-DD"T"HH24:00')`,
      c: sql<number>`count(*)::int`,
    })
    .from(accessesTable)
    .where(gte(accessesTable.createdAt, dayAgo))
    .groupBy(sql`1`);
  const byHourMap = new Map(byHourRows.map((r) => [r.h, r.c]));
  const byHour: { hour: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now - i * 3600_000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`;
    byHour.push({ hour: `${String(d.getHours()).padStart(2, "0")}h`, count: byHourMap.get(key) ?? 0 });
  }

  const topRows = await db
    .select({ route: accessesTable.route, c: sql<number>`count(*)::int` })
    .from(accessesTable)
    .groupBy(accessesTable.route)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  res.json({
    total, today, lastHour, last7days,
    byHour,
    topRoutes: topRows.map((r) => ({ route: r.route, count: r.c })),
    recent: recentRows.map(toClient),
  });
});

/** Admin: lista com busca. */
router.get("/access/list", requireAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  let rows: AccessRow[];
  if (q) {
    const like = `%${q}%`;
    rows = await db.select().from(accessesTable)
      .where(sql`${accessesTable.route} ILIKE ${like} OR ${accessesTable.ip} ILIKE ${like} OR ${accessesTable.browser} ILIKE ${like} OR ${accessesTable.language} ILIKE ${like} OR ${accessesTable.timezone} ILIKE ${like}`)
      .orderBy(desc(accessesTable.createdAt)).limit(500);
  } else {
    rows = await db.select().from(accessesTable).orderBy(desc(accessesTable.createdAt)).limit(500);
  }
  res.json({ items: rows.map(toClient) });
});

/** Admin: exportar CSV. */
router.get("/access/export", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(accessesTable).orderBy(desc(accessesTable.createdAt)).limit(5000);
  const cols = ["createdAt", "route", "ip", "browser", "os", "deviceType", "language", "timezone", "screen", "referrer", "location"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.join(",")];
  for (const r of rows.map(toClient)) lines.push(cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="acessos.csv"');
  res.send(lines.join("\n"));
});

export default router;
