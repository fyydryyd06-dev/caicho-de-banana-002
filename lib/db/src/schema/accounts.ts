import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Contas de demonstração (Pessoa Física).
 *
 * AMBIENTE DE TREINAMENTO: todos os registros são fictícios. A senha de 8
 * dígitos é armazenada apenas como hash (bcrypt), mesmo sendo fake, para não
 * ensinar prática insegura.
 */
export const demoAccountsTable = pgTable(
  "demo_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agency: text("agency").notNull(),
    account: text("account").notNull(),
    holderName: text("holder_name").notNull(),
    passwordHash: text("password_hash"),
    recoveryCode: text("recovery_code").notNull(),
    maskedPhone: text("masked_phone").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    locked: boolean("locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("demo_accounts_agency_account_idx").on(table.agency, table.account)],
);

export const insertDemoAccountSchema = createInsertSchema(demoAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDemoAccount = z.infer<typeof insertDemoAccountSchema>;
export type DemoAccount = typeof demoAccountsTable.$inferSelect;
