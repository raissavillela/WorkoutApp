import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const WX_BASE = "https://api.workoutxapp.com/v1";
const KEY = process.env.WORKOUTX_API_KEY || "";

const DATA_DIR = path.resolve(process.cwd(), "artifacts/api-server/data");
const CACHE_FILE = path.join(DATA_DIR, "exercise-media-cache.json");
const OVERRIDES_FILE = path.join(DATA_DIR, "exercise-media-overrides.json");
const TRANSLATIONS_FILE = path.join(DATA_DIR, "exercise-translations.json");

type CacheEntry = {
  query: string;
  exerciseId: string | null;
  name: string | null;
  gifUrl: string | null;
  bodyPart?: string | null;
  target?: string | null;
  candidates?: Array<{ id: string; name: string; gifUrl: string }>;
  ts: number;
  source: "auto" | "override" | "miss";
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}
function writeJson(file: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let cache: Record<string, CacheEntry> = readJson(CACHE_FILE, {});
let overrides: Record<string, string> = readJson(OVERRIDES_FILE, {});
const translations: Record<string, string> = readJson(TRANSLATIONS_FILE, {});

function normKey(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function persistCache() {
  writeJson(CACHE_FILE, cache);
}
function persistOverrides() {
  writeJson(OVERRIDES_FILE, overrides);
}

async function wxFetch(p: string): Promise<unknown> {
  if (!KEY) throw new Error("WORKOUTX_API_KEY not configured");
  const url = `${WX_BASE}${p}`;
  const r = await fetch(url, { headers: { "X-WorkoutX-Key": KEY } });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`WorkoutX ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

type WxExercise = {
  id?: string;
  exerciseId?: string;
  name?: string;
  gifUrl?: string;
  gif_url?: string;
  bodyPart?: string;
  target?: string;
};

function pickFields(e: WxExercise) {
  const id = e.id || e.exerciseId || "";
  const name = e.name || "";
  const gifUrl = e.gifUrl || e.gif_url || (id ? `${WX_BASE}/gifs/${id}` : "");
  return { id, name, gifUrl, bodyPart: e.bodyPart ?? null, target: e.target ?? null };
}

function scoreMatch(query: string, candidate: string): number {
  const q = normKey(query).split(" ").filter(Boolean);
  const c = normKey(candidate).split(" ").filter(Boolean);
  if (!q.length || !c.length) return 0;
  let overlap = 0;
  for (const w of q) if (c.includes(w)) overlap++;
  return overlap * 2 - Math.abs(c.length - q.length) * 0.3;
}

async function searchExercise(query: string): Promise<{
  best: ReturnType<typeof pickFields> | null;
  candidates: Array<ReturnType<typeof pickFields>>;
}> {
  const tries = [
    `/exercises/name/${encodeURIComponent(query)}`,
    `/exercises/search?name=${encodeURIComponent(query)}`,
    `/exercises/search?q=${encodeURIComponent(query)}`,
  ];
  let raw: unknown = null;
  for (const t of tries) {
    try {
      raw = await wxFetch(t);
      break;
    } catch (e) {
      logger.warn({ err: String(e), endpoint: t }, "wx endpoint failed, trying next");
    }
  }
  if (!raw) return { best: null, candidates: [] };
  const arr = Array.isArray(raw)
    ? (raw as WxExercise[])
    : Array.isArray((raw as { data?: WxExercise[] }).data)
      ? ((raw as { data: WxExercise[] }).data)
      : Array.isArray((raw as { results?: WxExercise[] }).results)
        ? ((raw as { results: WxExercise[] }).results)
        : [];
  const picked = arr.map(pickFields).filter((x) => x.id);
  if (!picked.length) return { best: null, candidates: [] };
  const ranked = picked
    .map((p) => ({ p, s: scoreMatch(query, p.name) }))
    .sort((a, b) => b.s - a.s);
  return {
    best: ranked[0].p,
    candidates: ranked.slice(0, 8).map((r) => r.p),
  };
}

router.get("/exercise-media", async (req, res) => {
  const ptName = String(req.query.name || "").trim();
  if (!ptName) return res.status(400).json({ error: "name required" });
  const key = normKey(ptName);

  if (overrides[key]) {
    const id = overrides[key];
    let entry = cache[key];
    if (!entry || entry.exerciseId !== id) {
      try {
        const raw = await wxFetch(`/exercises/exercise/${encodeURIComponent(id)}`).catch(
          () => wxFetch(`/exercises/${encodeURIComponent(id)}`),
        );
        const e = pickFields(raw as WxExercise);
        entry = {
          query: ptName,
          exerciseId: e.id || id,
          name: e.name || null,
          gifUrl: e.gifUrl || `${WX_BASE}/gifs/${id}`,
          bodyPart: e.bodyPart,
          target: e.target,
          ts: Date.now(),
          source: "override",
        };
      } catch {
        entry = {
          query: ptName,
          exerciseId: id,
          name: null,
          gifUrl: `${WX_BASE}/gifs/${id}`,
          ts: Date.now(),
          source: "override",
        };
      }
      cache[key] = entry;
      persistCache();
    }
    return res.json(entry);
  }

  const cached = cache[key];
  if (cached && Date.now() - cached.ts < 30 * 24 * 60 * 60 * 1000) {
    return res.json(cached);
  }

  if (!KEY) {
    return res.status(503).json({
      error: "api_key_missing",
      message: "WORKOUTX_API_KEY not configured on server",
    });
  }

  const enName = translations[ptName] || translations[key] || ptName;
  try {
    const { best, candidates } = await searchExercise(enName);
    const entry: CacheEntry = best
      ? {
          query: ptName,
          exerciseId: best.id,
          name: best.name,
          gifUrl: best.gifUrl,
          bodyPart: best.bodyPart,
          target: best.target,
          candidates,
          ts: Date.now(),
          source: "auto",
        }
      : {
          query: ptName,
          exerciseId: null,
          name: null,
          gifUrl: null,
          candidates: [],
          ts: Date.now(),
          source: "miss",
        };
    cache[key] = entry;
    persistCache();
    return res.json(entry);
  } catch (e) {
    logger.error({ err: String(e), name: ptName }, "exercise-media lookup failed");
    return res.status(502).json({ error: "upstream_error", message: String(e) });
  }
});

router.get("/exercise-media/candidates", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "q required" });
  if (!KEY) return res.status(503).json({ error: "api_key_missing" });
  try {
    const { candidates } = await searchExercise(q);
    res.json({ candidates });
  } catch (e) {
    res.status(502).json({ error: "upstream_error", message: String(e) });
  }
});

router.post("/exercise-media/override", express_json(), (req, res) => {
  const { name, exerciseId } = (req.body || {}) as { name?: string; exerciseId?: string | null };
  if (!name) return res.status(400).json({ error: "name required" });
  const key = normKey(name);
  if (!exerciseId) {
    delete overrides[key];
    delete cache[key];
  } else {
    overrides[key] = exerciseId;
    delete cache[key];
  }
  persistOverrides();
  persistCache();
  res.json({ ok: true });
});

router.get("/exercise-media/_status", (_req, res) => {
  res.json({
    keyConfigured: !!KEY,
    cacheSize: Object.keys(cache).length,
    overrideCount: Object.keys(overrides).length,
  });
});

function express_json() {
  // Body parser is already applied globally in app.ts; this is a no-op middleware.
  return (_req: unknown, _res: unknown, next: () => void) => next();
}

export default router;
