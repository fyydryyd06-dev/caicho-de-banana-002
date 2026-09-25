import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, demoAccountsTable, type DemoAccount } from "@workspace/db";
import {
  ConsultarContaBody,
  DefinirSenhaBody,
  ValidarSenhaBody,
  RedefinirSenhaBody,
  IniciarRecuperacaoBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MAX_ATTEMPTS = 3;
const SALT_ROUNDS = 10;

const onlyDigits = (value: string) => value.replace(/\D/g, "");

function randomRecoveryCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function findAccount(
  agency: string,
  account: string,
): Promise<DemoAccount | undefined> {
  const rows = await db
    .select()
    .from(demoAccountsTable)
    .where(
      and(
        eq(demoAccountsTable.agency, agency),
        eq(demoAccountsTable.account, account),
      ),
    )
    .limit(1);
  return rows[0];
}

/** Consulta se a conta fictícia existe e se já possui senha. */
router.post("/pf/senha/consultar", async (req, res) => {
  const parsed = ConsultarContaBody.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ exists: false, hasPassword: false, locked: false });
  }
  const agency = onlyDigits(parsed.data.agency);
  const account = onlyDigits(parsed.data.account);
  const found = await findAccount(agency, account);

  if (!found) {
    return res.json({ exists: false, hasPassword: false, locked: false });
  }
  return res.json({
    exists: true,
    hasPassword: Boolean(found.passwordHash),
    locked: found.locked,
    holderName: found.holderName,
  });
});

/** Define a senha no primeiro acesso (demo). */
router.post("/pf/senha/definir", async (req, res) => {
  const parsed = DefinirSenhaBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Informe uma senha válida de 8 dígitos.",
      locked: false,
    });
  }
  const { password, confirmPassword } = parsed.data;
  const agency = onlyDigits(parsed.data.agency);
  const account = onlyDigits(parsed.data.account);

  if (password !== confirmPassword) {
    return res.json({
      success: false,
      message: "As senhas não conferem.",
      locked: false,
    });
  }

  const found = await findAccount(agency, account);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  if (found) {
    if (found.passwordHash) {
      return res.json({
        success: false,
        message:
          "Esta conta já possui senha. Use Entrar ou recupere sua senha.",
        locked: found.locked,
        holderName: found.holderName,
      });
    }
    await db
      .update(demoAccountsTable)
      .set({ passwordHash, failedAttempts: 0, locked: false, updatedAt: new Date() })
      .where(eq(demoAccountsTable.id, found.id));
    return res.json({
      success: true,
      message: "Senha definida com sucesso. Você já pode acessar sua conta.",
      holderName: found.holderName,
      locked: false,
    });
  }

  // Primeiro acesso de uma conta fictícia ainda não cadastrada.
  await db.insert(demoAccountsTable).values({
    agency,
    account,
    holderName: "Cliente (fictício)",
    passwordHash,
    recoveryCode: randomRecoveryCode(),
    maskedPhone: "(11) *****-**00",
    failedAttempts: 0,
    locked: false,
  });
  return res.json({
    success: true,
    message: "Senha definida com sucesso. Você já pode acessar sua conta.",
    holderName: "Cliente (fictício)",
    locked: false,
  });
});

/** Valida a senha (login demo). */
router.post("/pf/senha/validar", async (req, res) => {
  const parsed = ValidarSenhaBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Informe uma senha de 8 dígitos.",
      locked: false,
    });
  }
  const { password } = parsed.data;
  const agency = onlyDigits(parsed.data.agency);
  const account = onlyDigits(parsed.data.account);

  const found = await findAccount(agency, account);
  if (!found) {
    return res.json({
      success: false,
      message: "Conta não encontrada. Verifique agência e conta.",
      locked: false,
    });
  }
  if (found.locked) {
    return res.json({
      success: false,
      message: "Conta bloqueada por tentativas. Use 'Esqueci minha senha'.",
      locked: true,
      attemptsRemaining: 0,
    });
  }
  if (!found.passwordHash) {
    return res.json({
      success: false,
      message: "Esta conta ainda não possui senha. Faça o primeiro acesso.",
      locked: false,
    });
  }

  const ok = await bcrypt.compare(password, found.passwordHash);
  if (ok) {
    await db
      .update(demoAccountsTable)
      .set({ failedAttempts: 0, updatedAt: new Date() })
      .where(eq(demoAccountsTable.id, found.id));
    return res.json({
      success: true,
      message: "Acesso liberado (ambiente de demonstração).",
      holderName: found.holderName,
      locked: false,
    });
  }

  const failedAttempts = found.failedAttempts + 1;
  const locked = failedAttempts >= MAX_ATTEMPTS;
  await db
    .update(demoAccountsTable)
    .set({ failedAttempts, locked, updatedAt: new Date() })
    .where(eq(demoAccountsTable.id, found.id));

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - failedAttempts);
  return res.json({
    success: false,
    message: locked
      ? "Senha incorreta. Conta bloqueada por segurança."
      : `Senha incorreta. Tentativas restantes: ${attemptsRemaining}.`,
    attemptsRemaining,
    locked,
  });
});

/** Inicia a recuperação de senha (demo: revela o código fictício). */
router.post("/pf/senha/recuperar", async (req, res) => {
  const parsed = IniciarRecuperacaoBody.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, message: "Dados inválidos." });
  }
  const agency = onlyDigits(parsed.data.agency);
  const account = onlyDigits(parsed.data.account);
  const found = await findAccount(agency, account);

  if (!found) {
    return res.json({
      success: false,
      message: "Conta não encontrada. Verifique agência e conta.",
    });
  }
  return res.json({
    success: true,
    message:
      "Código enviado ao telefone cadastrado. Em demonstração, use o código exibido abaixo.",
    maskedPhone: found.maskedPhone,
    recoveryCode: found.recoveryCode,
  });
});

/** Redefine a senha usando o código de recuperação (demo). */
router.post("/pf/senha/redefinir", async (req, res) => {
  const parsed = RedefinirSenhaBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Informe o código e uma nova senha de 8 dígitos.",
      locked: false,
    });
  }
  const { recoveryCode, newPassword, confirmNewPassword } = parsed.data;
  const agency = onlyDigits(parsed.data.agency);
  const account = onlyDigits(parsed.data.account);

  if (newPassword !== confirmNewPassword) {
    return res.json({
      success: false,
      message: "As senhas não conferem.",
      locked: false,
    });
  }

  const found = await findAccount(agency, account);
  if (!found) {
    return res.json({
      success: false,
      message: "Conta não encontrada.",
      locked: false,
    });
  }
  if (recoveryCode !== found.recoveryCode) {
    return res.json({
      success: false,
      message: "Código de recuperação inválido.",
      locked: found.locked,
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db
    .update(demoAccountsTable)
    .set({ passwordHash, failedAttempts: 0, locked: false, updatedAt: new Date() })
    .where(eq(demoAccountsTable.id, found.id));

  return res.json({
    success: true,
    message: "Senha redefinida com sucesso. Você já pode acessar sua conta.",
    holderName: found.holderName,
    locked: false,
  });
});

export default router;
