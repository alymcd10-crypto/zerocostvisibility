// Copies site/ to dist/ and fills in {{SITE_URL}} from site.config.json, so the
// address in canonical links, Open Graph tags, JSON-LD, the sitemap and robots.txt
// lives in one place. Netlify runs this on every deploy (see netlify.toml).
//
// It also applies the OFFERS_LIVE switch (netlify/lib/offers-mode.mjs). Text inside
// {{#live}}…{{/live}} is built only when OFFERS_LIVE=true; text inside
// {{#private}}…{{/private}} only when it isn't. The markers may sit inside a comment
// (<!--{{#live}}--> or /*{{#live}}*/) and are always removed. Hidden text is cut from
// the files, never hidden with CSS, so it doesn't reach visitors at all.
import { cp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { offersLive } from "../netlify/lib/offers-mode.mjs";
import { applyMode } from "./markers.mjs";
import { scanPrivate } from "./scan-private.mjs";

const root = new URL("..", import.meta.url).pathname;
const { siteUrl } = JSON.parse(await readFile(join(root, "site.config.json"), "utf8"));
if (!/^https:\/\/[^/]+$/.test(siteUrl)) throw new Error(`siteUrl must look like https://example.com (no trailing slash), got ${siteUrl}`);
const live = offersLive(process.env.OFFERS_LIVE);

// Whole files that belong to one mode only (paths inside site/).
const LIVE_ONLY = ["book.html", "assets/img/liz-speaking.jpg"];
const PRIVATE_ONLY = ["contact.html", "404.html"];

const src = join(root, "site");
const out = join(root, "dist");
await rm(out, { recursive: true, force: true });
await cp(src, out, { recursive: true });
for (const f of live ? PRIVATE_ONLY : LIVE_ONLY) await rm(join(out, f), { force: true });

let files = 0;
async function fill(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await fill(path);
    else if ([".html", ".xml", ".txt", ".js", ".css"].includes(extname(entry.name))) {
      const text = await readFile(path, "utf8");
      let next;
      try {
        next = applyMode(text, live).replaceAll("{{SITE_URL}}", siteUrl);
      } catch (err) {
        throw new Error(`${path.slice(out.length + 1)}: ${err.message}`);
      }
      if (next !== text) {
        await writeFile(path, next);
        files++;
      }
    }
  }
}
await fill(out);
console.log(`Built dist/ for ${siteUrl} (${files} files filled in), offers ${live ? "LIVE" : "hidden (private mode)"}`);

// Private mode must never ship an offer word that isn't on the reviewed list in
// scripts/scan-private.mjs. A stray one fails the build, so the deploy never goes out.
if (!live) {
  const { unexplained } = await scanPrivate(out);
  if (unexplained.length) {
    for (const h of unexplained) console.error(`  ${h.file}:${h.line}  "${h.word}"  ${h.snippet}`);
    throw new Error(`Private mode: ${unexplained.length} offer word(s) in dist/ (listed above). Remove them, or explain them in scripts/scan-private.mjs.`);
  }
  console.log("Private mode check: no unexplained offer words in dist/");
}
