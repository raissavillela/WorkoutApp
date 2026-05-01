import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.resolve(ROOT, "artifacts/api-server/data");
const CACHE_FILE = path.join(DATA_DIR, "exercise-media-cache.json");
const SITEMAP_FILE = "/tmp/fp_exercises.txt";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 600;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function slugToWords(slug) { return slug.replace(/-/g, " ").replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean); }
function nameToWords(name) { return norm(name).split(/\s+/).filter(Boolean); }

function score(nameWords, slugWords) {
  const ns = new Set(nameWords);
  const ss = new Set(slugWords);
  let overlap = 0;
  for (const w of ns) if (ss.has(w)) overlap++;
  if (overlap === 0) return 0;
  const total = new Set([...ns, ...ss]).size;
  return overlap / total;
}

function fetchPage(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { "User-Agent": UA } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) return resolve("");
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("error", () => resolve(""));
    req.setTimeout(10000, () => { req.destroy(); resolve(""); });
  });
}

function extractGifUrl(html) {
  const m = html.match(/https:\/\/fitnessprogramer\.com\/wp-content\/uploads\/[^"'\s]+\.gif/i);
  return m ? m[0] : null;
}

function bestMatch(nameWords, allSlugs, threshold = 0.3) {
  return allSlugs
    .map(slug => ({ slug, s: score(nameWords, slugToWords(slug)) }))
    .filter(x => x.s >= threshold)
    .sort((a, b) => b.s - a.s)[0] || null;
}

const PT_FALLBACK = {
  "abdominal obliquo": ["oblique crunch", "oblique"],
  "polichinelo frontal": ["jumping jack"],
  "polichinelo lateral": ["jumping jack"],
  "elevacao de quadril banco": ["hip thrust", "glute bridge"],
  "elevacao de quadril banco db": ["hip thrust dumbbell", "hip thrust"],
  "elevacao lateral db": ["lateral raise dumbbell", "dumbbell lateral raise"],
  "eliptico": ["elliptical", "cross trainer"],
  "equilibrio cross corda unilateral lateral": ["cable lateral raise", "cable balance"],
  "extensao tronco solo mao na cabeca": ["back extension", "superman"],
  "prancha joelho alternado": ["plank knee", "plank alternating"],
  "prancha maos ombros alternado": ["plank shoulder tap", "plank alternating"],
  "pulldown cross c flexao tronco": ["cable pulldown", "lat pulldown rope"],
  "pulldown cross corda": ["cable pulldown rope", "rope pulldown"],
  "rotacao tronco cross c uma perna": ["cable rotation", "trunk rotation"],
  "sdlhp": ["sumo deadlift high pull", "high pull"],
  "sdlhp db unilateral": ["dumbbell high pull", "sumo high pull"],
  "sdlhp anilha": ["sumo deadlift high pull", "high pull"],
  "salto frontal": ["forward jump", "box jump"],
  "burpee com salto frontal": ["burpee box jump", "burpee jump"],
  "skip frente": ["high knees", "skip"],
  "db snatch": ["dumbbell snatch", "power snatch"],
  "snatch db": ["dumbbell snatch", "power snatch"],
  "afundo isometrico c puxada neutra cross": ["lunge cable row", "cable lunge"],
  "afundo isometrico c remada unilateral cross": ["lunge cable row", "cable row lunge"],
  "avanco alternado anterior c elevacao frontal db": ["lunge front raise", "dumbbell lunge raise"],
  "avanco alternado posterior c isometria elevacao frontal": ["reverse lunge front raise", "lunge hold raise"],
  "avanco posterior alternado c elevacao lateral db": ["lunge lateral raise", "reverse lunge lateral"],
  "step up lateral db c elevacao frontal": ["step up lateral raise", "lateral step up"],
  "step up lateral db c isometria elevacao frontal": ["step up lateral raise", "step up raise"],
  "step up lateral c elevacao frontal db": ["step up lateral raise", "lateral step up dumbbell"],
  "abdominal supra estendido": ["crunch overhead", "overhead crunch"],
  "hollow rocks": ["hollow rock", "hollow body rock"],
  "abdominal obliquo em pe cross": ["standing oblique crunch", "cable oblique"],
  "abdominal rotacao cross baixo cima": ["cable rotation crunch", "wood chop"],
  "abdominal supra 90": ["crunch 90 degree", "90 degree crunch"],
  "abdominal twist anilha": ["russian twist", "weighted twist"],
  "abdominal twist com anilha": ["russian twist", "weighted russian twist"],
  "abducao de quadril cross tras": ["cable hip abduction", "hip abduction"],
  "abducao de quadril em pe cross": ["cable hip abduction", "standing hip abduction"],
  "abducao horizontal de ombros db": ["lateral raise", "dumbbell shoulder abduction"],
  "afundo db": ["dumbbell lunge", "lunge dumbbell"],
  "afundo guiado": ["smith lunge", "machine lunge"],
  "afundo isometrico c desenvolvimento unilateral db": ["lunge shoulder press", "dumbbell lunge press"],
};

async function main() {
  const slugLines = fs.readFileSync(SITEMAP_FILE, "utf8").trim().split("\n");
  const allSlugs = slugLines.map(l => { const m = l.match(/\/exercise\/([^/]+)\//); return m ? m[1] : null; }).filter(Boolean);

  console.log(`Loaded ${allSlugs.length} slugs\n`);

  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));

  const remaining = Object.entries(cache)
    .filter(([, v]) => !v.gifUrl || v.gifUrl.startsWith("/api/"));

  console.log(`Remaining without fitnessprogramer GIF: ${remaining.length}\n`);

  let matched = 0;

  for (let i = 0; i < remaining.length; i++) {
    const [ptKey, v] = remaining[i];

    const searchTermsList = PT_FALLBACK[ptKey]
      ? PT_FALLBACK[ptKey]
      : v.name ? [v.name] : [];

    if (!searchTermsList.length) {
      console.log(`[${i+1}/${remaining.length}] SKIP (no name): ${ptKey}`);
      continue;
    }

    let found = null;
    for (const term of searchTermsList) {
      const words = nameToWords(term);
      const best = bestMatch(words, allSlugs, 0.25);
      if (best) { found = best; break; }
    }

    if (!found) {
      console.log(`[${i+1}/${remaining.length}] NO MATCH: "${ptKey}" (tried: ${searchTermsList.join(", ")})`);
      continue;
    }

    const url = `https://fitnessprogramer.com/exercise/${found.slug}/`;
    process.stdout.write(`[${i+1}/${remaining.length}] "${ptKey}" → ${found.slug} (${found.s.toFixed(2)}) ... `);

    await sleep(DELAY_MS);
    const html = await fetchPage(url);
    const gifUrl = extractGifUrl(html);

    if (!gifUrl) {
      console.log("no GIF on page");
      continue;
    }

    cache[ptKey].gifUrl = gifUrl;
    cache[ptKey].source = cache[ptKey].exerciseId ? "auto" : "auto";
    cache[ptKey].fpSlug = found.slug;
    if (!cache[ptKey].exerciseId) {
      cache[ptKey].exerciseId = "fp-" + found.slug;
      cache[ptKey].name = found.slug.replace(/-/g, " ");
    }
    console.log(`✓ ${gifUrl.split("/").pop()}`);
    matched++;

    if (matched % 5 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`\nDone! matched=${matched}`);
}

main().catch(console.error);
