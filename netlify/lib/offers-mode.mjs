// The OFFERS_LIVE switch, shared by the build (scripts/build.mjs), the edge function that
// handles /book and /setup, and the bookings function.
//
//   OFFERS_LIVE=true            the full site: the session, its price, booking, speaking
//   unset, "false" or anything  private mode: none of that is built or served
//
// Anything other than "true" counts as private, so a typo hides the offers rather than showing them.
export function offersLive(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}
