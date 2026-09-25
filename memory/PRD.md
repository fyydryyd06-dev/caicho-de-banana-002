# PRD — Caicho de Banana (Ambiente de Demonstração / Treinamento)

## Problema / Objetivo
Continuação do monorepo existente (branch `cursor/pf-senha-route`) que reproduz
fluxos de conta bancária (PF/PJ) para **treinamento e demonstração interna**,
usando **exclusivamente dados fictícios**. Foco desta fase: completar a **rota de
senha (Pessoa Física)**.

## Guardrails (inegociáveis)
- Apenas dados fictícios/de teste. Nunca coletar/armazenar/transmitir credenciais reais.
- Marcação visível de "ambiente de demonstração" em todas as telas (faixa fixa).
- Senhas/PINs de teste sempre com hash (bcrypt), mesmo sendo fake.

## Stack (preservada — sem migração)
- Monorepo pnpm workspaces, Node 20, TypeScript 5.9.
- Backend: Express 5 + PostgreSQL + Drizzle ORM (`artifacts/api-server`, `lib/db`).
- Frontend: React 19 + Vite + wouter + TanStack Query (`artifacts/conta-pj-home`).
- Contrato: OpenAPI + Orval → hooks React Query (`lib/api-client-react`) e Zod (`lib/api-zod`).

## Adaptação ao ambiente Emergent (glue de infraestrutura)
- Supervisor é somente-leitura e exige `/app/backend` (uvicorn) e `/app/frontend` (yarn start).
- `/app/backend/server.py`: proxy FastAPI na porta 8001 que sobe o Express real (porta interna 5000) e encaminha `/api/*`. Nenhuma lógica de negócio migrada.
- `/app/frontend/start.sh`: inicia o Vite (`@workspace/conta-pj-home`) na porta 3000 (BASE_PATH=/).
- `DATABASE_URL` em `/app/.env` (PostgreSQL local). Clerk desativado (modo demo) quando faltam chaves.

## Implementado nesta sessão (2026-06)
- Fase 1 — Baseline: monorepo clonado, `pnpm install`, Postgres provisionado, schema aplicado (`drizzle-kit push`), app rodando (home + `/pessoa-fisica`).
- Fase 2/3 — Rota de senha PF completa (`/pessoa-fisica/senha`) com 3 fluxos:
  - **Definir** (primeiro acesso), **Validar** (login) e **Recuperar/Redefinir**.
  - Estados: loading, validar, definir, bloqueada, recuperar, sucesso. Feedback erro/sucesso e loading em cada mutação.
  - Backend `artifacts/api-server/src/routes/pfSenha.ts`: `/api/pf/senha/{consultar,definir,validar,recuperar,redefinir}` com validação Zod (gerada do OpenAPI), bcrypt, bloqueio após 3 tentativas.
  - Modelo `demo_accounts` (`lib/db/src/schema/accounts.ts`) + seed fictício (`lib/db/src/seed.ts`).
  - OpenAPI atualizado + `codegen` (Orval) regenerado; hooks consumidos no frontend via TanStack Query.
- Fase 4 — Qualidade: `pnpm run typecheck` limpo; faixa "ambiente de demonstração" fixa; testado end-to-end (11/11 backend + todos os fluxos frontend, 100%).
- Clerk tornado opcional (guardado por env): rotas Clerk mostram aviso de demonstração quando sem chaves.

## Contas fictícias (seed)
- 00019 / 987654 — senha `12345678` (validar) — cód. recuperação `246810`
- 12345 / 123456 — primeiro acesso (definir) — cód. `135790`
- 45006 / 112233 — bloqueada — cód. `112358`
Reset: `pnpm --filter @workspace/db run seed`

## Backlog / Próximos passos
- P1: Padronizar nomes de campos entre `/definir` (password) e `/redefinir` (newPassword).
- P1: Flag para ocultar `recoveryCode` do response fora de demo (por NODE_ENV/VITE_DEMO).
- P2: Persistir "sessão" pós-login demo (tela pós-acesso PF em vez de apenas card de sucesso).
- P2: Conectar o fluxo PJ ("Esqueci minha senha") a um fluxo demo próprio.
- P2: Testes automatizados no CI do monorepo (typecheck + build + smoke da API).
