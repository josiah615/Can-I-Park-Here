import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRequest, parseJSON, normalizeResult, buildPrompt, analyze } from "../lib/parking.js";
import handler from "../api/check.js";

const plan = { arrivalText: "Monday, November 9, 2026 at 1:50 PM", untilText: "Monday, November 9, 2026 at 4:50 PM", stayLabel: "3 hours", notes: "" };
const image = { mediaType: "image/jpeg", data: "QUJD" };

test("validateRequest accepts a complete request", () => {
  const r = validateRequest({ image, ...plan });
  assert.equal(r.ok, true);
  assert.equal(r.value.image.mediaType, "image/jpeg");
});

test("validateRequest rejects missing photo, bad type, oversize and missing plan", () => {
  assert.equal(validateRequest({ ...plan }).ok, false);
  assert.equal(validateRequest({ image: { mediaType: "image/heic", data: "QUJD" }, ...plan }).ok, false);
  assert.equal(validateRequest({ image: { mediaType: "image/png", data: "A".repeat(5_000_001) }, ...plan }).ok, false);
  assert.equal(validateRequest({ image }).ok, false);
  assert.equal(validateRequest(null).ok, false);
});

test("validateRequest strips a data: URL prefix and caps notes", () => {
  const r = validateRequest({ image: { mediaType: "image/png", data: "data:image/png;base64,QUJD" }, ...plan, notes: "x".repeat(500) });
  assert.equal(r.value.image.data, "QUJD");
  assert.equal(r.value.notes.length, 300);
});

test("parseJSON handles plain, fenced and wrapped JSON", () => {
  assert.deepEqual(parseJSON('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJSON('```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(parseJSON('Here you go: {"a":3} thanks'), { a: 3 });
  assert.throws(() => parseJSON("no json here"));
});

test("normalizeResult coerces types and fills gaps", () => {
  const r = normalizeResult({ verdict: "limited", confidence: 94, moveBy: "3:50 PM Monday", rules: [{ text: "2 hour parking", applies: 1 }, { applies: true }], warnings: ["", "Tow-away after 2 AM"] });
  assert.equal(r.verdict, "limited");
  assert.equal(r.confidence, 0.94);
  assert.equal(r.rules.length, 1);
  assert.equal(r.rules[0].applies, true);
  assert.deepEqual(r.warnings, ["Tow-away after 2 AM"]);
  assert.ok(r.headline.length > 0);
  assert.equal(r.retakeTip, null);
});

test("normalizeResult turns unknown verdicts and low confidence into 'unclear' with a retake tip", () => {
  assert.equal(normalizeResult({ verdict: "maybe" }).verdict, "unclear");
  const low = normalizeResult({ verdict: "yes", confidence: 0.2 });
  assert.equal(low.verdict, "unclear");
  assert.ok(low.retakeTip);
  assert.equal(low.moveBy, null);
});

test("buildPrompt includes the plan and the JSON shape", () => {
  const p = buildPrompt({ ...plan, notes: "Zone 4 permit" });
  assert.match(p, /Monday, November 9, 2026 at 1:50 PM/);
  assert.match(p, /Zone 4 permit/);
  assert.match(p, /"verdict":"yes\|limited\|no\|unclear"/);
});

function fakeFetch(replies) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init: { ...init, body: JSON.parse(init.body) } });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply.status) return { ok: false, status: reply.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: reply.text }] }) };
  };
  fn.calls = calls;
  return fn;
}

test("analyze retries once when the first reply is not JSON", async () => {
  const f = fakeFetch([{ text: "sorry" }, { text: '{"verdict":"no","headline":"Street cleaning.","confidence":0.9}' }]);
  const r = await analyze({ apiKey: "k", image, plan, fetchImpl: f });
  assert.equal(r.verdict, "no");
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].init.headers["x-api-key"], "k");
  assert.equal(f.calls[0].init.body.messages[0].content[0].type, "image");
});

test("analyze maps a 401 to bad_key", async () => {
  await assert.rejects(analyze({ apiKey: "k", image, plan, fetchImpl: fakeFetch([{ status: 401 }]) }), (e) => e.code === "bad_key");
});

function mockRes() {
  const res = { statusCode: 0, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

test("api/check rejects GET, missing key, and bad bodies", async () => {
  let res = mockRes(); await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);

  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  res = mockRes(); await handler({ method: "POST", headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 503);

  process.env.ANTHROPIC_API_KEY = "test";
  res = mockRes(); await handler({ method: "POST", headers: { "x-forwarded-for": "1.1.1.1" }, body: { image } }, res);
  assert.equal(res.statusCode, 400);
  if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved;
});

test("api/check returns a normalized result", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch([{ text: '{"verdict":"yes","headline":"Fine all evening.","confidence":0.92,"rules":[]}' }]);
  process.env.ANTHROPIC_API_KEY = "test";
  const res = mockRes();
  await handler({ method: "POST", headers: { "x-forwarded-for": "2.2.2.2" }, body: { image, ...plan } }, res);
  globalThis.fetch = realFetch;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verdict, "yes");
});

test("api/check rate-limits after 10 requests a minute from one address", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  let last;
  for (let i = 0; i < 11; i++) { last = mockRes(); await handler({ method: "POST", headers: { "x-forwarded-for": "3.3.3.3" }, body: {} }, last); }
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(last.statusCode, 429);
});
