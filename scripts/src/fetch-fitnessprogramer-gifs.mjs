import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.resolve(ROOT, "artifacts/api-server/data");
const CACHE_FILE = path.join(DATA_DIR, "exercise-media-cache.json");
const SITEMAP_FILE = "/tmp/fp_exercises.txt";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const DELAY_MS = 600;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugToWords(slug) {
  return slug.replace(/-/g, " ").replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
}

function nameToWords(name) {
  return norm(name).split(/\s+/).filter(Boolean);
}

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
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchPage(loc).then(resolve).catch(reject);
        return resolve("");
      }
      if (res.statusCode !== 200) return resolve("");
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
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

async function main() {
  const slugLines = fs.readFileSync(SITEMAP_FILE, "utf8").trim().split("\n");
  const allSlugs = slugLines.map((l) => {
    const m = l.match(/\/exercise\/([^/]+)\//);
    return m ? m[1] : null;
  }).filter(Boolean);

  console.log(`Loaded ${allSlugs.length} exercise slugs from sitemap`);

  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));

  const exercises = Object.entries(cache)
    .filter(([, v]) => v.exerciseId && v.name && v.gifUrl && v.gifUrl.startsWith("/api/"))
    .map(([ptKey, v]) => ({ ptKey, enName: v.name }));

  console.log(`Exercises to match: ${exercises.length}\n`);

  let matched = 0;
  let skipped = 0;
  let noMatch = 0;

  for (let i = 0; i < exercises.length; i++) {
    const { ptKey, enName } = exercises[i];
    const nameWords = nameToWords(enName);

    const scored = allSlugs
      .map((slug) => ({ slug, s: score(nameWords, slugToWords(slug)) }))
      .filter((x) => x.s > 0.35)
      .sort((a, b) => b.s - a.s);

    if (!scored.length) {
      console.log(`[${i + 1}/${exercises.length}] NO MATCH: "${enName}" (${ptKey})`);
      noMatch++;
      continue;
    }

    const best = scored[0];
    const url = `https://fitnessprogramer.com/exercise/${best.slug}/`;

    process.stdout.write(`[${i + 1}/${exercises.length}] "${enName}" → ${best.slug} (score=${best.s.toFixed(2)}) ... `);

    await sleep(DELAY_MS);
    const html = await fetchPage(url);
    const gifUrl = extractGifUrl(html);

    if (!gifUrl) {
      console.log("no GIF found on page");
      skipped++;
      continue;
    }

    cache[ptKey].gifUrl = gifUrl;
    cache[ptKey].source = "auto";
    cache[ptKey].fpSlug = best.slug;
    console.log(`✓ ${gifUrl.split("/").pop()}`);
    matched++;

    if (matched % 10 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      console.log(`  → saved progress (${matched} updated so far)\n`);
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`\nDone! matched=${matched} skipped=${skipped} noMatch=${noMatch}`);
}

main().catch(console.error);
