// Scores the sign reader against labeled photos in fixtures/.
// Usage: ANTHROPIC_API_KEY=sk-ant-... npm run eval
// Add real photos to fixtures/signs/ and entries to fixtures/labels.json as you collect them.
import { readFile } from "node:fs/promises";
import { analyze, DEFAULT_MODEL } from "../lib/parking.js";

const TARGET = 0.9;
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("Set ANTHROPIC_API_KEY first, e.g. ANTHROPIC_API_KEY=sk-ant-... npm run eval"); process.exit(1); }

const root = new URL("../fixtures/", import.meta.url);
const cases = JSON.parse(await readFile(new URL("labels.json", root), "utf8"));
const types = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

let pass = 0;
const rows = [];
for (const c of cases) {
  const ext = c.image.split(".").pop().toLowerCase();
  const data = (await readFile(new URL(c.image, root))).toString("base64");
  const started = Date.now();
  let got = "error", detail = "";
  try {
    const r = await analyze({ apiKey, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL, image: { mediaType: types[ext], data }, plan: c });
    got = r.verdict; detail = r.headline;
  } catch (e) { detail = e.code || e.message; }
  const expected = [].concat(c.expected);
  const ok = expected.includes(got);
  if (ok) pass++;
  rows.push({ case: c.id, expected: expected.join(" or "), got, ok: ok ? "✓" : "✗", ms: Date.now() - started, detail: detail.slice(0, 70) });
}
console.table(rows);
const score = pass / cases.length;
console.log(`\nAccuracy: ${pass}/${cases.length} (${Math.round(score * 100)}%), target ${Math.round(TARGET * 100)}%`);
process.exit(score >= TARGET ? 0 : 1);
