import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Registro real de acesso às páginas públicas (persistido no Postgres). */
export const accessesTable = pgTable("accesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  route: text("route").notNull(),
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

export type AccessRow = typeof accessesTable.$inferSelect;
export type InsertAccess = typeof accessesTable.$inferInsert;
