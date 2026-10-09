<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Convenciones del proyecto (Codex y Claude Code)

Este archivo lo leen ambos agentes: Codex directamente, Claude Code a través de
`CLAUDE.md` (`@AGENTS.md`). Mantenlo como la única fuente de reglas compartidas —
si algo debe valer para los dos, va aquí, no en un archivo específico de un agente.

- **Al empezar una sesión**: revisa `docs/ARCHITECTURE.md` y el estado de git antes de
  asumir en qué quedó el proyecto. Puede haber avanzado en una sesión del otro agente.
- **Windows**: usa rutas completas para node/npm/npx (`C:\Program Files\nodejs\npm.cmd`,
  `npx.cmd`), como en `README.md`. PowerShell puede tener scripts restringidos.
- **Antes de dar por terminado un cambio**: corre `npm run check` (lint, typecheck,
  tests, build). Si el cambio toca Supabase, corre también `npm run test:rls` y, si
  toca el flujo comercial autenticado, `npm run smoke:commercial`.
- **Nunca commitees `.env.local`** ni credenciales. `APP_MODE` controla demo vs
  Supabase real; no asumas cuál está activo, revisa `.env.local`.
- **Esquema conocido**: `subscription_items.client_solution_id` no tiene
  `ON DELETE CASCADE` hacia `client_solutions`. Cualquier limpieza o migración que
  borre cuentas con soluciones aprobadas debe borrar primero sus `subscription_items`
  (ver `scripts/commercial-smoke.mjs`).
- **Commits**: no commitees automáticamente salvo que el usuario lo haya pedido en
  la sesión actual.
