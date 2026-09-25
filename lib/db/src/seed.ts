/**
 * Seed de dados FICTÍCIOS para o fluxo de senha (Pessoa Física).
 *
 * AMBIENTE DE DEMONSTRAÇÃO: nenhuma conta, nome, telefone ou senha aqui é
 * real. As senhas de 8 dígitos são gravadas apenas como hash bcrypt.
 *
 * Execução idempotente: limpa a tabela e recria os registros de exemplo.
 */
import bcrypt from "bcryptjs";
import { db, pool, demoAccountsTable, type InsertDemoAccount } from "./index";

const SALT_ROUNDS = 10;

async function hash(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

async function main() {
  const accounts: InsertDemoAccount[] = [
    {
      agency: "12345",
      account: "123456",
      holderName: "Empresa Banana Ltda (fictícia)",
      passwordHash: null, // primeiro acesso: senha ainda não definida
      recoveryCode: "135790",
      maskedPhone: "(11) *****-**21",
      failedAttempts: 0,
      locked: false,
    },
    {
      agency: "00019",
      account: "987654",
      holderName: "Caicho Comércio ME (fictícia)",
      passwordHash: await hash("12345678"), // senha demo já definida
      recoveryCode: "246810",
      maskedPhone: "(21) *****-**07",
      failedAttempts: 0,
      locked: false,
    },
    {
      agency: "45006",
      account: "112233",
      holderName: "Padaria do Zé (fictícia)",
      passwordHash: await hash("00000000"),
      recoveryCode: "112358",
      maskedPhone: "(31) *****-**44",
      failedAttempts: 3,
      locked: true, // conta bloqueada para demonstrar o estado
    },
  ];

  await db.delete(demoAccountsTable);
  await db.insert(demoAccountsTable).values(accounts);

  console.log(`Seed concluído: ${accounts.length} contas fictícias criadas.`);
  for (const a of accounts) {
    console.log(
      `  - Ag ${a.agency} / Conta ${a.account} — ${a.holderName}` +
        `${a.passwordHash ? "" : " (sem senha: primeiro acesso)"}` +
        `${a.locked ? " (BLOQUEADA)" : ""}`,
    );
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });
