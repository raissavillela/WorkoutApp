# 💪🏻 Workout App

A web application for workout tracking, built with pure HTML, CSS, and vanilla JavaScript on the front-end, plus a small Express/TypeScript proxy that fetches exercise demonstration GIFs.

---

> **A note on the development process**
>
> This project was built using AI-powered tools — specifically **Claude (Anthropic)** and **Replit Agent** — as part of a modern approach to software development.
>
> The idea, feature structure, workout data, and all product decisions are entirely my own. The AI tools were used to accelerate technical implementation, debug issues, and iterate quickly on design and app behavior.
>
> To me, this way of working demonstrates two things: the ability to **think like a developer** — knowing what to build, how to structure it, what to fix, and how to evolve a product — and the skill to **use LLMs effectively**, leveraging their capabilities without losing control of the final result.
>
> Knowing how to use these tools intelligently is, increasingly, a technical skill in its own right.

---

## Features

### Ready Workout
Access a library of 20 real pre-defined workouts, organized by modality. Filter by workout type (Weight Training, Core, Cardio, etc.) and start any workout with a single tap.

### Build Workout
Automatic personalized workout generation. Choose your preferred modalities and duration (30 or 45 minutes) — the app builds a workout with balanced blocks and sets at random.

### Calendar & Check-in
Daily workout logging with:
- Monthly view with trained days highlighted
- Free-text title field (e.g. "Workout A — Weight Training")
- Calories burned log (kcal)
- Monthly totals (number of workouts and calories)
- Data saved locally in the browser (localStorage)

### During the Workout
- Mark completed sets per block
- Edit the weight used for each exercise
- Workout progress bar
- Visual indicator when all blocks are complete
- Inline **"Show execution"** toggle on every non-cardio exercise that reveals an animated demonstration GIF

### Exercise Demonstration GIFs
Each exercise (except cardio) shows an animated GIF demonstrating proper form. GIFs come from the [WorkoutX API](https://www.workoutxapp.com), proxied through the local API server which:
- Translates Portuguese exercise names to English
- Caches every search and resolution to disk so the API quota is hit only once per exercise
- Re-streams the GIFs through `/api/exercise-media/gif/:id` to add the auth header and bypass cross-origin restrictions

### Legitimize GIFs (manual override screen)
Because no public exercise database perfectly maps to Brazilian cross-training nomenclature, a dedicated "Legitimize GIFs" screen on the home menu lets you verify and manually fix every exercise:
- Lists all non-cardio exercises with their current GIF preview, matched name, and a status badge:
  - 🟢 **Auto** — automatic match from WorkoutX
  - 🟡 **Manual** — you picked a different WorkoutX candidate
  - 🔵 **Custom** — you pasted your own external image/GIF URL
  - 🔴 **No match** — no candidate found
- Filter chips: All / No match / Auto / Manual / URL — plus a progress bar
- Inline candidate picker with mini GIFs (search by any English keyword to refine)
- **Custom URL field**: paste any public link to a `.gif` / `.jpg` / `.png` (Tenor, Giphy, Imgur, Instagram CDN, etc.) and the app will use that image instead

All overrides and custom URLs persist in JSON files on disk, so the work is done once and kept forever.

### Language Toggle
Switch between **Portuguese (PT)** and **English (EN)** at any time using the toggle button available on every screen. Language preference is saved between sessions.

## Available Modalities
| Modality | Description |
|---|---|
| 💪🏻 Weight Training | Free weights, machines and cables |
| 🎯 Core | Abs, planks and stability work |
| 🏃🏻 Cardio | Run, elliptical, bike |
| 🔥 Metabolic | High-intensity exercises and locomotion |
| ⚡ Functional | Compound and functional movements |
| 🏋🏻 Crossfit | Olympic lifts and gymnastic movements |
| ⚖️ Balance | Stability and proprioception work |

## Tech Stack

**Front-end** (`artifacts/workout/`)
- HTML5 + CSS3 + JavaScript (vanilla, single file)
- No frameworks or external libraries
- Persistent local data via `localStorage`
- Responsive design, optimized for mobile

**Back-end** (`artifacts/api-server/`)
- Node.js + Express 5 + TypeScript
- Proxies the WorkoutX API and serves GIF files
- Disk-based JSON cache for exercise mapping, candidates and custom URLs
- Throttled to respect the WorkoutX free plan (30 req/min, 500/month)

**Repository layout**
- `pnpm` workspace monorepo
- `artifacts/workout/` — the web app itself
- `artifacts/api-server/` — the GIF proxy and override API
- `artifacts/api-server/data/` — persistent cache, overrides, custom URLs and PT→EN translations

## Running Locally

Requirements: Node.js 24, pnpm.

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # API server
pnpm --filter @workspace/workout run dev      # web app
```

The web app is served on its own port and talks to the API server through `/api/exercise-media/*`.

### Environment variables
- `WORKOUTX_API_KEY` — required by the API server. Free key available at workoutxapp.com.

## API Endpoints (back-end)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/exercise-media?name=<pt-name>` | Resolve a Portuguese exercise name to an exercise + GIF URL |
| `GET`  | `/api/exercise-media/candidates?q=<keyword>` | List candidate WorkoutX exercises for an English keyword |
| `POST` | `/api/exercise-media/override` | Pick a different WorkoutX exercise ID for a given name |
| `POST` | `/api/exercise-media/custom-url` | Set or clear a custom external image URL for a given name |
| `GET`  | `/api/exercise-media/gif/:id` | Stream a GIF file (adds the WorkoutX auth header) |
| `GET`  | `/api/exercise-media/_status` | Quick health check (key configured, cache size, override count) |
