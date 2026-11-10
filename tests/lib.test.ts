import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CODES, anyCodeMatches, codeMatches, createToken, normalizeCode, readCookie, signingSecret, toolkitCodes, toolkitSecret, verifyToken } from "../netlify/lib/access-token.ts";
import { BOOKING_RULES, bookableRange, slotError, todayIn } from "../netlify/lib/booking-rules.ts";

test("both attendee codes work, ignoring case, spaces, hyphens, dashes and O/0", () => {
  const codes = toolkitCodes(() => undefined);
  assert.deepEqual(codes, ["RDTraining2026", "STARPOWER"]);
  for (const given of ["RDTraining2026", " rdtraining 2026 ", "RD-Training-2026", "rd\u2013training\u20142026", "RDTraining2O26", "rdtraining2026", "STARPOWER", " star power ", "star-power", "STARP0WER"]) {
    assert.ok(anyCodeMatches(given, codes), `should match: ${given}`);
  }
  for (const given of ["", "   ", "RDTraining2025", "RDTraining202", "STARPOWE", "starpowers", "nope"]) {
    assert.ok(!anyCodeMatches(given, codes), `should not match: ${given}`);
  }
  assert.ok(codeMatches(" starpower ", "STARPOWER"));
  assert.ok(!codeMatches("STARPOWE", "STARPOWER"));
  assert.equal(normalizeCode(" rd-Training 2O26 "), "RDTRAINING2026");
});

test("code list reads TOOLKIT_CODES, then TOOLKIT_CODE, then the defaults", () => {
  const env = (o: Record<string, string>) => (k: string) => o[k];
  assert.deepEqual(toolkitCodes(env({ TOOLKIT_CODES: "A1, B2 ,,C3" })), ["A1", "B2", "C3"]);
  assert.deepEqual(toolkitCodes(env({ TOOLKIT_CODE: "ONLY" })), ["ONLY"]);
  assert.deepEqual(toolkitCodes(env({ TOOLKIT_CODES: "A1", TOOLKIT_CODE: "ONLY" })), ["A1"]);
  assert.deepEqual(toolkitCodes(env({ TOOLKIT_CODES: " , " })), DEFAULT_CODES);
});

test("adding a code does not change the signing secret", () => {
  const env = (o: Record<string, string>) => (k: string) => o[k];
  assert.equal(toolkitSecret(env({ TOOLKIT_CODES: "A1" })), toolkitSecret(env({ TOOLKIT_CODES: "A1,B2,C3" })));
  assert.equal(toolkitSecret(env({ TOOLKIT_CODES: "A1,B2", TOOLKIT_SECRET: "a-long-random-secret-value" })), "a-long-random-secret-value");
  assert.equal(toolkitSecret(() => undefined), "ltf-fallback:RDTraining2026");
});

test("access token round trip, tamper, expiry, wrong secret", async () => {
  const secret = signingSecret("a-long-random-secret-value", "RDTraining2026");
  const token = await createToken(secret);
  assert.ok(await verifyToken(token, secret));
  assert.ok(!(await verifyToken(token, "a-different-secret-value")));
  const [exp, sig] = token.split(".");
  assert.ok(!(await verifyToken(`${Number(exp) + 1}.${sig}`, secret)));
  assert.ok(!(await verifyToken(`${exp}.x${sig.slice(1)}`, secret)));
  assert.ok(!(await verifyToken(token, secret, (Number(exp) + 1) * 1000)));
  assert.ok(!(await verifyToken("garbage", secret)));
  assert.ok(!(await verifyToken(null, secret)));
});

test("short or missing secret falls back to one tied to the code", () => {
  assert.equal(signingSecret(undefined, "A"), "ltf-fallback:A");
  assert.equal(signingSecret("short", "A"), "ltf-fallback:A");
  assert.notEqual(signingSecret(undefined, "A"), signingSecret(undefined, "B"));
});

test("readCookie finds the cookie among others", () => {
  assert.equal(readCookie("a=1; ltf_toolkit=abc.def; b=2"), "abc.def");
  assert.equal(readCookie("a=1"), null);
  assert.equal(readCookie(null), null);
});

// Tue Oct 27 2026, 9pm Central = Wed Oct 28 02:00 UTC: "today" must still be the 27th.
const now = new Date("2026-10-28T02:00:00Z");

test("today is computed in Central Time, not UTC", () => {
  assert.equal(todayIn("America/Chicago", now), "2026-10-27");
  assert.deepEqual(bookableRange(BOOKING_RULES, now), { first: "2026-10-29", last: "2027-01-05" });
});

test("slot rules", () => {
  const r = BOOKING_RULES;
  assert.equal(slotError(r, "2026-10-29", "9:00 AM", now), null); // Thursday, 2 days out
  assert.match(slotError(r, "2026-10-28", "9:00 AM", now)!, /too soon/); // tomorrow
  assert.match(slotError(r, "2026-10-30", "9:00 AM", now)!, /isn't taking sessions/); // Friday
  assert.match(slotError(r, "2026-11-03", "10:00 AM", now)!, /listed times/);
  assert.match(slotError(r, "2027-01-12", "9:00 AM", now)!, /isn't open/);
  assert.match(slotError(r, "2026-02-31", "9:00 AM", now)!, /Please pick a day/);
  assert.match(slotError(r, "9999-12-31", "9:00 AM", now)!, /isn't open/);
  assert.match(slotError({ ...r, blockedDates: ["2026-11-03"] }, "2026-11-03", "9:00 AM", now)!, /isn't taking sessions/);
});
