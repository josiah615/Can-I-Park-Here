# Can I Park Here?

Photograph the parking signs on a pole and get a plain answer for your planned stay: **YES**, **YES, BUT**, **NO**, or **CAN'T TELL**. The answer names the rule that decides it and the time you have to move by.

U.S. drivers spend about 17 hours a year searching for parking, and New York City alone issued over 16.5 million parking tickets and camera violations in FY2025. Stacked signs are a big part of that confusion.

## How it works

1. The browser shrinks the photo to 1,600 px (fast upload, enough detail for sign text).
2. `POST /api/check` sends the photo and the plan (arrival time and length of stay, already written out in the driver's own time zone) to Claude.
3. The server checks the reply against a strict format (`lib/parking.js` → `normalizeResult`), retries once if it's garbled, and turns low-confidence answers into **CAN'T TELL** with tips for a better photo.
4. The page shows the verdict as a sign plate, then each rule marked *affects your stay* or *doesn't*.

```
index.html · styles.css · app.js     the app (no build step)
lib/parking.js                       prompt, request validation, Claude call, result checks (shared)
api/check.js · api/health.js         Vercel serverless functions; the API key lives only here
tests/                               unit tests (npm test)
scripts/eval.js · fixtures/          accuracy check against labeled sign photos (npm run eval)
.claude/skills/                      the design skills used to build the UI (see that folder's README)
PRD.md · DESIGN.md · PRODUCT.md      product requirements, design system, product context
```

## Deploy (recommended: Vercel, free)

1. Sign in at [vercel.com](https://vercel.com) with GitHub, click **Add New → Project**, and import `can-i-park-here`.
2. Leave the framework preset as **Other**. No build command is needed.
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY` with your key from [console.anthropic.com](https://console.anthropic.com).
4. Click **Deploy**. Every push to `main` redeploys automatically, and every pull request gets its own preview link.

With the server in place, nobody using the app needs a key. Set a monthly spending limit in the Anthropic Console anyway.

### GitHub Pages still works

Pages can't run the server, so a Pages copy shows a **Live mode** box where the viewer pastes their own Anthropic API key. The key stays in that browser.

## Develop

```bash
npm test                                  # unit tests, no network needed
ANTHROPIC_API_KEY=sk-ant-... npm run eval # scores the reader on fixtures/ (target ≥ 90%)
npx vercel dev                            # runs the app and API locally at http://localhost:3000
```

The fixtures are synthetic signs to start. Add real photos to `fixtures/signs/` and entries to `fixtures/labels.json` as you collect them.

The posted sign is always the final authority. This app is a second opinion.
