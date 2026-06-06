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

## Workout App

The Workout App (`artifacts/workout/index.html`) is a single-file vanilla JS app with a state-machine UI (`S.screen`). All data is stored in `localStorage` — no account server required.

### Profile / Login

The app uses a local profile system (no password, no server). On first launch the home screen shows a **"Criar perfil"** card. Tapping it opens a setup form where the user enters their name and optionally uploads a profile photo (stored as base64 in `localStorage` under the key `wk_profile`).

Once a profile exists the home screen transforms into the profile view:
- **Circular photo** with an orange border at the top
- **Name** below the photo
- **Three stats**: Check-ins · Days active · Duration (estimated at 45 min per check-in)
- **Monthly calendar** showing workout days — days with check-ins display the profile photo as a small circle

The **"Editar"** button (top-right) opens the edit screen to update name or photo. **"Sair do perfil"** removes the profile from localStorage.

### Check-in

The **Check-in** card (replaces the old Calendário card in the nav) lets users log a workout for the current day with one tap:
- Tap the card → saves today's date to `localStorage` under `wk_ci`
- The card turns green with a ✅ if already checked in today
- The checked-in day immediately appears as a photo circle on the home calendar and on the profile calendar screen

### Calendar

The **calendar view** (`S.screen === 'cal'`) shows all months with logged check-ins. Each day cell can be tapped to open a modal where the user can add a title and calorie count to that session. Days with entries are highlighted; tapping an existing entry lets the user edit or delete it.

The profile home screen shows a **mini calendar** of the current month. Days with check-ins render the user's profile photo (if set) as a 30 × 30 px circle — matching the reference design.

### Exercise Demonstrations (GIF system)

- Demonstration GIFs come from the WorkoutX API (`api.workoutxapp.com`) via the proxy in `artifacts/api-server/src/routes/exerciseMedia.ts`.
- Endpoints: `GET /api/exercise-media?name=`, `GET /api/exercise-media/candidates?q=`, `POST /api/exercise-media/override`, `GET /api/exercise-media/_status`.
- Free plan = 30 req/min; the proxy throttles to 1 call / 2.1 s and caches both per-keyword search results and per-exercise resolutions to disk under `artifacts/api-server/data/`.
- `WORKOUTX_API_KEY` is required on the server.
- PT→EN translations live in `data/exercise-translations.json`. Add new entries here to improve auto-match quality.
- The app shows an inline "Ver execução" toggle per exercise in the workout screen. **Cardio exercises never show the toggle.**
- `S.screen === 'legit'` is a manual legitimisation screen (Home → "Legitimar GIFs"): lists every non-cardio exercise with its current matched GIF, badge (Auto / Manual / Sem match), filter chips, inline candidate picker, and search-by-keyword. Clicking a candidate POSTs an override and refreshes the cache for that exercise.

## User Preferences

- App language: Portuguese (PT) by default, toggleable to EN via top-right toggle.
