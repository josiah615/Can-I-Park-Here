// GET /api/health — lets the page know the server is available and configured.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, configured: Boolean(process.env.ANTHROPIC_API_KEY) });
}
