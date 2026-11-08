// Shared logic for Can I Park Here?
// Runs in the browser (Live mode with your own key), in the Vercel function (api/check.js),
// and in the eval script. No Node-only or browser-only APIs here.

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const VERDICTS = ["yes", "limited", "no", "unclear"];
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BASE64 = 5_000_000; // ~3.7 MB image; Vercel's request limit is 4.5 MB
const LOW_CONFIDENCE = 0.45;

export const SYSTEM_PROMPT = [
  "You read US street parking signs from photos and decide whether a driver may legally park at that spot for their whole planned stay.",
  "Read every sign in the image from top to bottom, including small print, day ranges, time ranges, arrows, 'except' clauses and permit zones.",
  "Evaluate each rule against the entire stay, not just the arrival moment. A restriction that starts during the stay applies.",
  "Temporary signs (construction, events, moving permits) override permanent ones; mention them in warnings.",
  "Arrows show which side of the pole a rule covers. If direction matters and you cannot tell which side the car is on, add a warning.",
  "If text is blurry, cut off, too small, or the image is not a parking sign, the verdict is 'unclear' and retakeTip says exactly what photo would help.",
  "Never invent a rule you cannot see. Do not assume holidays unless the date is a federal holiday and the sign mentions holidays.",
  "Write plainly for a driver standing on the sidewalk. Use 12-hour clock times with AM/PM and the weekday, like '3:50 PM Monday'."
].join("\n");

const SCHEMA_TEXT =
  '{"verdict":"yes|limited|no|unclear","headline":"one plain sentence","moveBy":"clock time and weekday the car must leave by, or null","confidence":0.0,' +
  '"rules":[{"text":"the sign rule in short form","applies":true,"why":"one sentence on why it does or does not affect this stay"}],' +
  '"warnings":["short caution, only if needed"],"retakeTip":"only for unclear, otherwise null"}';

/** Builds the user prompt from the plan. Times are pre-formatted by the client in its own time zone. */
export function buildPrompt({ arrivalText, untilText, stayLabel, notes }) {
  return [
    "Driver's plan:",
    "- Arriving: " + arrivalText,
    "- Staying: " + stayLabel + " (until " + untilText + ")",
    "- Notes from the driver: " + (notes && notes.trim() ? notes.trim() : "none"),
    "",
    "Verdict meanings:",
    "- yes: allowed for the whole stay",
    "- limited: allowed at arrival but not for the whole stay, or only with a condition such as paying a meter; moveBy says when to leave",
    "- no: not allowed at arrival",
    "- unclear: you cannot tell from this photo",
    "",
    "Reply with only a JSON object in this shape, no other text:",
    SCHEMA_TEXT
  ].join("\n");
}

/** Validates the JSON body sent to /api/check. Returns {ok, value} or {ok:false, message}. */
export function validateRequest(body) {
  const b = body && typeof body === "object" ? body : {};
  const str = (v, max) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
  if (!b.image || typeof b.image !== "object") return { ok: false, message: "Add a photo of the sign." };
  const mediaType = MEDIA_TYPES.includes(b.image.mediaType) ? b.image.mediaType : null;
  if (!mediaType) return { ok: false, message: "The photo must be a JPG, PNG, WebP or GIF." };
  const data = typeof b.image.data === "string" ? b.image.data.replace(/^data:[^,]+,/, "") : "";
  if (!data || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 2000))) return { ok: false, message: "The photo data is unreadable. Choose the photo again." };
  if (data.length > MAX_IMAGE_BASE64) return { ok: false, message: "The photo is too large. Use a photo under 3 MB." };
  const arrivalText = str(b.arrivalText, 80), untilText = str(b.untilText, 80), stayLabel = str(b.stayLabel, 40);
  if (!arrivalText || !untilText || !stayLabel) return { ok: false, message: "Choose when you're arriving and how long you'll stay." };
  const notes = typeof b.notes === "string" ? b.notes.slice(0, 300) : "";
  return { ok: true, value: { image: { mediaType, data }, arrivalText, untilText, stayLabel, notes } };
}

/** Pulls a JSON object out of model text, tolerating code fences or stray prose. */
export function parseJSON(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch (_) {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch (_) {} }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
  const err = new Error("invalid_json"); err.code = "invalid_json"; throw err;
}

const clip = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Coerces model output into the exact shape the UI renders. Never trusts the model's types. */
export function normalizeResult(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  let verdict = VERDICTS.includes(r.verdict) ? r.verdict : "unclear";
  let confidence = Number(r.confidence);
  confidence = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence > 1 ? confidence / 100 : confidence)) : 0.5;
  const rules = (Array.isArray(r.rules) ? r.rules : []).slice(0, 8)
    .map((x) => ({ text: clip(x && x.text, 140), applies: !!(x && x.applies), why: clip(x && x.why, 240) }))
    .filter((x) => x.text);
  const warnings = (Array.isArray(r.warnings) ? r.warnings : []).map((w) => clip(w, 200)).filter(Boolean).slice(0, 4);
  let headline = clip(r.headline, 200);
  let retakeTip = clip(r.retakeTip, 200) || null;
  if (verdict !== "unclear" && confidence < LOW_CONFIDENCE) {
    verdict = "unclear";
    headline = "These signs are hard to read with confidence.";
    retakeTip = retakeTip || "Step back so every sign on the pole is in frame, and avoid glare.";
  }
  if (verdict === "unclear" && !retakeTip) retakeTip = "Take the photo straight on, with every sign on the pole in frame.";
  if (!headline) headline = { yes: "You can park here for your whole stay.", limited: "You can park, but not for your whole stay.", no: "You can't park here right now.", unclear: "These signs can't be read from this photo." }[verdict];
  const moveBy = verdict === "limited" || verdict === "yes" ? clip(r.moveBy, 60) || null : null;
  return { verdict, headline, moveBy, confidence, rules, warnings, retakeTip: verdict === "unclear" ? retakeTip : null };
}

/** Calls the Anthropic Messages API with the sign photo and plan. Returns the model's text. */
export async function callClaude({ apiKey, image, prompt, model = DEFAULT_MODEL, browser = false, signal, fetchImpl = fetch }) {
  const headers = { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  if (browser) headers["anthropic-dangerous-direct-browser-access"] = "true";
  let res;
  try {
    res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: prompt }
        ] }]
      })
    });
  } catch (e) {
    const err = new Error(e && e.name === "AbortError" ? "cancelled" : "network");
    err.code = e && e.name === "AbortError" ? "cancelled" : "network"; throw err;
  }
  if (!res.ok) {
    const s = res.status, err = new Error("anthropic_" + s);
    err.status = s;
    err.code = s === 401 || s === 403 ? "bad_key" : s === 429 ? "rate_limited" : s === 400 ? "bad_request" : "upstream_error";
    throw err;
  }
  const data = await res.json();
  return (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
}

/** Full pipeline: prompt → Claude → parse → normalize, retrying once if the reply isn't valid JSON. */
export async function analyze({ plan, image, ...opts }) {
  const prompt = buildPrompt(plan);
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callClaude({ ...opts, image, prompt });
    try { return normalizeResult(parseJSON(text)); }
    catch (e) { if (attempt === 1) return normalizeResult({ verdict: "unclear", headline: "The answer came back garbled. Check this spot again." }); }
  }
}
