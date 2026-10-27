import type { Config } from "@netlify/edge-functions";
import { DEFAULT_CODE, readCookie, signingSecret, verifyToken } from "../lib/access-token.ts";

// Real lock on /toolkit/: without a valid attendee cookie the visitor gets the code page,
// served at the same URL so QR links with #step3 and UTM tags survive the unlock.
// The toolkit HTML never leaves Netlify without the cookie. No-store and noindex headers
// for both paths are in netlify.toml.
export default async (req: Request) => {
  const code = Netlify.env.get("TOOLKIT_CODE") || DEFAULT_CODE;
  const secret = signingSecret(Netlify.env.get("TOOLKIT_SECRET"), code);
  if (await verifyToken(readCookie(req.headers.get("cookie")), secret)) return;
  return new URL("/attendee/", req.url);
};

export const config: Config = {
  path: ["/toolkit", "/toolkit/*"],
};
