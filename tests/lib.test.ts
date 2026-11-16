import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCode, codeMatches, createToken, parseCodes, readCookie, signingSecret, verifyToken } from "../netlify/lib/access-token.ts";
import { BOOKING_RULES, bookableRange, slotError, todayIn } from "../netlify/lib/booking-rules.ts";

test("attendee code is case and space insensitive", () => {
  assert.ok(codeMatches(" starpower ", "STARPOWER"));
  assert.ok(!codeMatches("STARPOWE", "STARPOWER"));
  assert.ok(!codeMatches("", "STARPOWER"));
});

test("TOOLKIT_CODE with one code", () => {
  assert.ok(codeMatches("STARPOWER", "STARPOWER"));
  assert.ok(codeMatches("starpower", "STARPOWER"));
});

test("TOOLKIT_CODE with several codes accepts any entry", () => {
  const list = "RESET2026,RDTraining2026,STARPOWER";
  assert.ok(codeMatches("RESET2026", list));
  assert.ok(codeMatches("rdtraining2026", list));
  assert.ok(codeMatches(" StarPower ", list));
  assert.deepEqual(parseCodes(list), ["RESET2026", "RDTRAINING2026", "STARPOWER"]);
});

test("TOOLKIT_CODE tolerates spaces around commas and empty entries", () => {
  const list = " RESET2026 , RDTraining2026 ,, STARPOWER ";
  assert.ok(codeMatches("RESET2026", list));
  assert.ok(codeMatches("RDTRAINING2026", list));
  assert.ok(codeMatches("starpower", list));
  assert.ok(!codeMatches("", list));
  assert.ok(!codeMatches(",", list));
});

test("TOOLKIT_CODE rejects a wrong code", () => {
  const list = "RESET2026,RDTraining2026,STARPOWER";
  assert.ok(!codeMatches("RESET2025", list));
  assert.ok(!codeMatches("RESET2026,STARPOWER", list));
  assert.ok(!codeMatches("STAR", list));
  assert.ok(!codeMatches("WRONG", "STARPOWER"));
});

test("signing secret fallback uses the full TOOLKIT_CODE string", () => {
  assert.equal(signingSecret(undefined, "STARPOWER"), "ltf-fallback:STARPOWER");
  assert.equal(signingSecret(undefined, "RESET2026,STARPOWER"), "ltf-fallback:RESET2026,STARPOWER");
});

test("access token round trip, tamper, expiry, wrong secret", async () => {
  const secret = signingSecret("a-long-random-secret-value", "STARPOWER");
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

test("RESET2026 opens at midnight Eastern on December 15, 2026", () => {
  const before = Date.parse("2026-12-14T23:59:00-05:00");
  const after = Date.parse("2026-12-15T00:00:00-05:00");
  assert.deepEqual(checkCode("RESET2026", "STARPOWER", before), { ok: false, opensLabel: "December 15" });
  assert.deepEqual(checkCode(" reset2026 ", "STARPOWER", after), { ok: true });
  assert.deepEqual(checkCode("RESET2026", "STARPOWER", Date.parse("2027-03-01T12:00:00Z")), { ok: true });
});

test("TOOLKIT_CODE codes work at any time, for testing", () => {
  const early = Date.parse("2026-11-20T12:00:00Z");
  assert.deepEqual(checkCode("starpower", "STARPOWER", early), { ok: true });
  assert.deepEqual(checkCode("TESTCODE", "STARPOWER,TESTCODE", early), { ok: true });
});

test("wrong codes are refused without a date hint", () => {
  assert.deepEqual(checkCode("RESET2025", "STARPOWER"), { ok: false });
  assert.deepEqual(checkCode("", "STARPOWER"), { ok: false });
});
