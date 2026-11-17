import type { Config } from "@netlify/edge-functions";
import { offersLive } from "../lib/offers-mode.mjs";

// Private mode (OFFERS_LIVE unset or anything but "true"): the Book page isn't in the build.
// /book, with or without a query string (e.g. /book?topic=speaking), goes to /contact with a
// temporary 302, so links already shared still reach a page. /setup, the old Setup link,
// gets the 404 page instead of its usual hop to /book.
// With OFFERS_LIVE=true this steps aside and Netlify serves everything exactly as before,
// including the /setup redirect in netlify.toml.
export default async (req: Request) => {
  if (offersLive(Netlify.env.get("OFFERS_LIVE"))) return;
  const { pathname } = new URL(req.url);
  const noStore = { "Cache-Control": "no-store" };
  if (pathname === "/book" || pathname === "/book.html" || pathname.startsWith("/book/")) {
    return new Response(null, { status: 302, headers: { Location: "/contact", ...noStore } });
  }
  const page = await fetch(new URL("/404.html", req.url));
  return new Response(page.ok ? page.body : "Not found", {
    status: 404,
    headers: { "Content-Type": page.ok ? "text/html; charset=utf-8" : "text/plain", ...noStore },
  });
};

export const config: Config = {
  path: ["/book", "/book/", "/book/*", "/book.html", "/setup", "/setup/", "/setup/*", "/setup.html"],
};
