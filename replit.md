# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Workout app — exercise demonstrations

- `artifacts/workout/index.html` is a single-file vanilla JS app with a state-machine UI (`S.screen`).
- Demonstration GIFs come from the WorkoutX API (`api.workoutxapp.com`) via the proxy in `artifacts/api-server/src/routes/exerciseMedia.ts`.
- Endpoints: `GET /api/exercise-media?name=`, `GET /api/exercise-media/candidates?q=`, `POST /api/exercise-media/override`, `GET /api/exercise-media/_status`.
- Free plan = 30 req/min; the proxy throttles to 1 call / 2.1s and caches both per-keyword search results and per-exercise resolutions to disk under `artifacts/api-server/data/`.
- `WORKOUTX_API_KEY` is required on the server.
- PT→EN translations live in `data/exercise-translations.json` (one entry per unique PT name). Add new entries here to improve auto-match quality.
- The app shows an inline "Ver execução" toggle per exercise in the workout screen. **Cardio exercises never show the toggle.**
- `S.screen === 'legit'` is a manual legitimization screen (Home → "Legitimar GIFs"): lists every non-cardio exercise with its current matched GIF, badge (Auto / Manual / Sem match), filter chips, inline candidate picker, and search-by-keyword. Clicking a candidate POSTs an override and refreshes the cache for that exercise.
