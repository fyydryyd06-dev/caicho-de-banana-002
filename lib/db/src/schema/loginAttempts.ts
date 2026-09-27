import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Tentativas de autenticação dos formulários públicos (SEM senha/PIN). */
export const loginAttemptsTable = pgTable("login_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  route: text("route").notNull(),
  login: text("login"),
  status: text("status"),
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
});

export type LoginAttemptRow = typeof loginAttemptsTable.$inferSelect;
