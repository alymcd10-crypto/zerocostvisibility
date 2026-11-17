// Searches a private-mode build for offer words, case-insensitive, in every file
// (text files line by line, images and icons as raw bytes).
// scripts/build.mjs runs it after every private build and fails on a hit that isn't
// in ALLOWED below. Run it on its own to see every hit and the reason each one is fine:
//   OFFERS_LIVE=false node scripts/build.mjs && node scripts/scan-private.mjs
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

// The words the private site must not show: the ones asked for first, then extra
// checks for other ways an offer could slip through.
export const WORDS = [
  "297", "book a session", "session", "pick a time", "coaching", "done-for-you", "pricing", "webinar", "speaking",
  "coach", "done for you", "raving fan", "1:1", "one on one", "cal.com", "calendly", "/book", "booking", "price", "$997", "$1,497",
];

// Hits that are fine, each with the reason. `near` must appear within 80 characters of the hit.
export const ALLOWED = [
  { file: "robots.txt", word: "/book", near: "Disallow: /book",
    reason: "Tells search engines not to list /book. Asked for; it names the address only, and /book redirects to /contact." },
  { file: "index.html", word: "speaking", near: 'data-track="partner_cta" data-track-location="speaking"',
    reason: "Google Analytics label on the RD Training Systems button, kept so the analytics reports don't change. Never shown on the page." },
  { file: "toolkit/index.html", word: "raving fan", near: "For your top 10 to 15 raving fans",
    reason: "A line from the talk describing past clients, not an offer. Only sent to visitors who entered the attendee code." },
];

const TEXT = new Set([".html", ".xml", ".txt", ".js", ".css", ".csv", ".svg", ".json", ".webmanifest", ".map"]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

export async function scanPrivate(dir) {
  const hits = [];
  for await (const path of walk(dir)) {
    const file = relative(dir, path);
    const isText = TEXT.has(extname(path).toLowerCase());
    const buf = await readFile(path);
    const lines = isText ? buf.toString("utf8").split("\n") : [buf.toString("latin1")];
    lines.forEach((text, i) => {
      const lower = text.toLowerCase();
      for (const word of WORDS) {
        for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + 1)) {
          const around = text.slice(Math.max(0, at - 80), at + word.length + 80);
          const snippet = isText ? text.slice(Math.max(0, at - 50), at + word.length + 40).trim() : `(bytes at offset ${at})`;
          const ok = ALLOWED.find((a) => a.word === word && a.file === file && around.includes(a.near));
          hits.push({ file, line: isText ? i + 1 : 0, word, snippet, reason: ok?.reason });
        }
      }
    });
  }
  return { hits, unexplained: hits.filter((h) => !h.reason) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || new URL("../dist/", import.meta.url).pathname;
  const { hits, unexplained } = await scanPrivate(dir);
  for (const h of hits) console.log(`${h.reason ? "ok  " : "HIT "} ${h.file}:${h.line}  "${h.word}"  ${h.snippet}${h.reason ? `\n      why it's fine: ${h.reason}` : ""}`);
  console.log(`\n${hits.length} hit(s), ${unexplained.length} unexplained`);
  process.exit(unexplained.length ? 1 : 0);
}
