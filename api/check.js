// POST /api/check — reads a parking sign photo with Claude.
// The Anthropic API key lives only in the ANTHROPIC_API_KEY environment variable on the server.
import { analyze, validateRequest, DEFAULT_MODEL } from "../lib/parking.js";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map(); // per-instance memory; good enough to stop accidental hammering

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed", message: "Use POST." });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "not_configured", message: "The server has no ANTHROPIC_API_KEY set." });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: "rate_limited", message: "Too many checks in a minute. Wait a moment and try again." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = null; } }
  const v = validateRequest(body);
  if (!v.ok) return res.status(400).json({ error: "bad_request", message: v.message });

  const started = Date.now();
  try {
    const { image, ...plan } = v.value;
    const result = await analyze({ apiKey, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL, image, plan });
    console.log(JSON.stringify({ event: "check", verdict: result.verdict, ms: Date.now() - started }));
    return res.status(200).json(result);
  } catch (e) {
    console.error(JSON.stringify({ event: "check_failed", code: e.code, status: e.status, ms: Date.now() - started }));
    const status = e.code === "rate_limited" ? 429 : 502;
    return res.status(status).json({ error: e.code || "upstream_error", message: "Claude couldn't read the sign right now. Try again in a moment." });
  }
}
