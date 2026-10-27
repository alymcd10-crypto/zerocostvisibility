// Copies site/ to dist/ and fills in {{SITE_URL}} from site.config.json, so the
// address in canonical links, Open Graph tags, JSON-LD, the sitemap and robots.txt
// lives in one place. Netlify runs this on every deploy (see netlify.toml).
import { cp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const { siteUrl } = JSON.parse(await readFile(join(root, "site.config.json"), "utf8"));
if (!/^https:\/\/[^/]+$/.test(siteUrl)) throw new Error(`siteUrl must look like https://example.com (no trailing slash), got ${siteUrl}`);

const src = join(root, "site");
const out = join(root, "dist");
await rm(out, { recursive: true, force: true });
await cp(src, out, { recursive: true });

let files = 0;
async function fill(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await fill(path);
    else if ([".html", ".xml", ".txt"].includes(extname(entry.name))) {
      const text = await readFile(path, "utf8");
      if (text.includes("{{SITE_URL}}")) {
        await writeFile(path, text.replaceAll("{{SITE_URL}}", siteUrl));
        files++;
      }
    }
  }
}
await fill(out);
console.log(`Built dist/ for ${siteUrl} (${files} files filled in)`);
