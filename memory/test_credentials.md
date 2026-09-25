# Test Credentials — Caicho de Banana (AMBIENTE DE DEMONSTRAÇÃO)

> Todos os dados abaixo são FICTÍCIOS. Nenhuma credencial real é usada.
> Senhas de 8 dígitos são armazenadas apenas como hash (bcrypt).

## Fluxo de senha (Pessoa Física) — rota `/pessoa-fisica` → `/pessoa-fisica/senha`

O usuário informa Agência e Conta em `/pessoa-fisica`, clica em CONTINUAR e é
levado à rota de senha, que decide o modo automaticamente (consultar):

| Agência | Conta   | Estado                    | Senha (demo) | Código recuperação |
|---------|---------|---------------------------|--------------|--------------------|
| 00019   | 987654  | Possui senha (validar)    | `12345678`   | `246810`           |
| 12345   | 123456  | Primeiro acesso (definir) | (criar)      | `135790`           |
| 45006   | 112233  | Bloqueada                 | —            | `112358`           |

- Regras de senha: exatamente 8 dígitos numéricos.
- Após 3 tentativas erradas no modo "validar", a conta é bloqueada.
- No modo recuperação, o código fictício é exibido na tela (apenas em demo).
- Reset de estado: `pnpm --filter @workspace/db run seed`

## Clerk (PJ / login corporativo)
Desativado neste ambiente (modo demonstração). Rotas `/secure-login`,
`/sign-up` e `/user-portal` exibem aviso de "ambiente de demonstração".
Para habilitar, definir `VITE_CLERK_PUBLISHABLE_KEY` (frontend) e
`CLERK_SECRET_KEY` (backend).

## Banco de dados
- PostgreSQL local. `DATABASE_URL` em `/app/.env`.
- `postgres` / `postgres` @ `127.0.0.1:5432`, database `caicho`.
