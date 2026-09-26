import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

const JWT_ALG = "HS256" as const;
const TOKEN_TTL = "8h";

function getSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not configured");
  return secret;
}

interface AdminClaims {
  sub: string;
  role: "admin";
}

/** Verifies the Bearer token and returns the admin claims, or null. */
function verifyToken(req: Request): AdminClaims | null {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: [JWT_ALG] });
    if (typeof decoded === "object" && decoded && (decoded as AdminClaims).role === "admin") {
      return decoded as AdminClaims;
    }
    return null;
  } catch {
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const claims = verifyToken(req);
  if (!claims) {
    res.status(401).json({ message: "Não autenticado." });
    return;
  }
  (req as Request & { admin?: AdminClaims }).admin = claims;
  next();
}

/** Login administrativo. Credenciais vêm de variáveis de ambiente. */
router.post("/admin/login", async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const expectedUser = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUser || !passwordHash) {
    return res.status(500).json({ message: "Autenticação administrativa não configurada." });
  }
  if (!username || !password) {
    return res.status(400).json({ message: "Informe usuário e senha." });
  }

  const userOk = username === expectedUser;
  const passOk = await bcrypt.compare(password, passwordHash);
  // Compara ambos sempre para não vazar qual campo falhou.
  if (!userOk || !passOk) {
    return res.status(401).json({ message: "Usuário ou senha inválidos." });
  }

  const token = jwt.sign({ sub: username, role: "admin" }, getSecret(), {
    algorithm: JWT_ALG,
    expiresIn: TOKEN_TTL,
  });
  return res.json({ token, username });
});

/** Retorna a sessão administrativa atual. */
router.get("/admin/me", requireAdmin, (req, res) => {
  const admin = (req as Request & { admin?: AdminClaims }).admin;
  return res.json({ username: admin?.sub, role: "admin" });
});

/** Logout (JWT stateless: o cliente descarta o token). */
router.post("/admin/logout", (_req, res) => {
  return res.json({ ok: true });
});

export default router;
