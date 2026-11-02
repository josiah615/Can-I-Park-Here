# PRD: Can I Park Here?

**Owner:** Josiah Johnson
**Status:** Draft v1 — November 2, 2026
**Demo date:** Monday, November 9, 2026 (SpotGenius CEO follow-up)

---

## 1. Problem

Street parking signs are stacked, abbreviated, and time-dependent. Drivers have to combine 2–4 rules (time limits, street cleaning, tow-away hours, permit zones) in their head, against the current day and time, while they're double-parked.

**Evidence the problem is large (1M+ people):**
- U.S. drivers spend an average of 17 hours a year searching for parking, costing about $345 per driver; the national search cost is estimated at $72.7B (INRIX parking study).
- New York City alone issued over 16.5 million parking tickets and camera violations in FY2025, worth about $1.13B (NYC Dept. of Finance, Local Law 6 report).

**Why AI:** Reading a photo of mixed signage and reasoning about overlapping time windows is exactly what a vision-language model does well and rule-based OCR does poorly.

## 2. Users

- **Primary:** A driver standing next to a sign, phone in hand, who wants an answer in under 10 seconds.
- **Secondary (future):** Parking operators who want fewer disputed tickets and better compliance. This is where SpotGenius's world connects: compliance tooling for drivers complements operator-side enforcement intelligence.

## 3. Goal for the demo

A working mobile web app where the CEO can photograph (or upload) a real sign stack and get a correct, explained answer live.

**Success metrics for v1:**
- ≥ 90% correct verdicts on a 20-photo test set I label by hand
- Median time from "Check" to answer ≤ 8 seconds
- Every answer shows which sign rule decided it (explainability)

## 4. Scope

### In scope (v1)
1. Take a photo with the phone camera, or upload one
2. Inputs: arrival date/time (defaults to now), planned stay length, optional free-text notes (e.g. "I have a Zone B permit")
3. Verdict: **YES / YES, BUT / NO / CAN'T TELL**
4. "Move by" time when a limit applies
5. List of each rule read from the sign, marked *Applies* or *Not now*, with a one-line reason
6. Warnings (e.g. tow-away overnight, arrow direction unclear)
7. Confidence score; low confidence routes to CAN'T TELL with advice for a better photo
8. Disclaimer that the sign is the final authority

### Out of scope (v1)
- User accounts, history, payments
- Live occupancy or finding open spots (that's SpotGenius's core product; don't rebuild it)
- Ticket disputes or appeals
- City-specific rule databases or meter-payment integrations
- Native iOS/Android apps

## 5. Functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| F1 | Capture or upload a photo | On a phone, the button opens the camera; on desktop, a file picker. JPG/PNG/WebP up to 20 MB accepted. Preview shows before checking. |
| F2 | Plan inputs | Arrival time defaults to now (rounded to 5 min). Stay options: 15m, 30m, 1h, 2h, 3h, all day, overnight. |
| F3 | Sign analysis | Server sends image + plan to the Claude API (vision) and gets structured JSON back (schema below). |
| F4 | Whole-stay evaluation | A rule that begins *during* the stay counts. Example: arrive 8:30 AM, stay 2h, street cleaning starts 9 AM → NO or YES, BUT. |
| F5 | Verdict display | Large color-coded verdict, one-sentence headline, move-by time, rule list, warnings, confidence. |
| F6 | Unreadable input | Blurry, cropped, or non-sign images return CAN'T TELL with a specific retake tip. Never invent a rule. |
| F7 | Errors | Network/API failure shows a plain message and a retry button. No raw errors shown to the user. |
| F8 | Sample mode | A built-in sample sign lets anyone try it without going outside. |

### Response schema (from the model)

```json
{
  "verdict": "yes | limited | no | unclear",
  "headline": "One plain sentence answer",
  "until": "Move by 3:50 PM Monday" ,
  "confidence": 0.94,
  "rules": [
    { "text": "2 hour parking · 8 AM – 6 PM · Mon–Sat", "applies": true, "why": "..." }
  ],
  "warnings": ["If you stay past 2 AM, the car can be towed."]
}
```

Validate this on the server (e.g. with Zod). If validation fails, retry once, then return `unclear`.

## 6. Technical approach

- **Stack:** Next.js (App Router) + TypeScript + Tailwind, deployed to Vercel
- **AI:** Anthropic API, model `claude-sonnet-5-5`, image passed as base64, prompt asks for JSON only
- **API route:** `POST /api/check` → `{ image, arrivalISO, stayMinutes, notes }` → schema above
- **Security:** API key only in server environment variables, never in the browser. Rate-limit the route (e.g. 10 requests/min per IP).
- **Images:** Resize client-side to ~1600px on the long edge before upload (faster, cheaper). Don't store photos.
- **Time zone:** Use the browser's local time zone; send ISO timestamp with offset.

### Prompt rules (must keep)
- Read every sign top to bottom, including small print and arrows
- Evaluate against the whole planned stay, not only arrival time
- If any text is unreadable, say so; never guess a rule
- Output JSON only

## 7. Testing & evaluation

- `fixtures/signs/` — 20 real sign photos (take them around town this week) + `fixtures/labels.json` with the correct verdict for a fixed date/time/stay per photo
- `npm run eval` — runs every fixture through `/api/check`, prints accuracy and per-photo diffs
- Unit tests for schema validation and time-window helper functions
- Manual test on an actual phone (iOS Safari + Android Chrome)

## 8. Milestones (6 days)

| Day | Milestone | Done when |
|---|---|---|
| Mon 11/2 | PRD + clickable prototype | Prototype works with sample sign ✅ |
| Tue 11/3 | Project scaffold + `/api/check` returns valid JSON for the sample image | `curl` returns schema-valid JSON |
| Wed 11/4 | Mobile UI (capture, inputs, verdict view) wired to API | Full flow works on phone |
| Thu 11/5 | Collect 20 real sign photos, build eval script | `npm run eval` prints a score |
| Fri 11/6 | Prompt tuning until ≥ 90% on eval; error states | Eval ≥ 90%, F6/F7 pass |
| Sat 11/7 | User test with 5 real drivers; fix top 3 issues | Notes + changes logged |
| Sun 11/8 | Deploy, rehearse demo, backup video recording | Public URL works on cellular |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Wrong answer causes a ticket | Confidence threshold → CAN'T TELL; always show the deciding rule; disclaimer |
| Glare, angle, or partial photos | Retake tips; client-side preview; eval set includes bad photos |
| Arrow direction ambiguity | Warn when arrows matter and side of pole is unknown |
| Temporary signs (construction, events) | Prompt instructs to treat temporary notices as overriding; warn |
| Demo Wi-Fi fails | Recorded backup video + sample-sign mode |

## 10. Future (pitch slide, not build)
- Operator dashboard: aggregate "unclear sign" reports by location so lots and cities can fix confusing signage
- Pair with real-time spot availability (SpotGenius data) for "park here, and here's an open spot 40 ft away"
- Multi-language answers

---

## Appendix: How to build this with Claude Code

1. Create a folder, put this file in it as `PRD.md`, and open Claude Code there.
2. Run `/init` to create `CLAUDE.md`, then add:
   ```
   - Source of truth for scope: PRD.md. Do not build out-of-scope items.
   - Stack: Next.js App Router, TypeScript, Tailwind. Validate API output with Zod.
   - Never put ANTHROPIC_API_KEY in client code.
   - After each milestone: run tests, then commit with a descriptive message.
   ```
3. Turn on plan mode (Shift+Tab) and ask: *"Read PRD.md and propose an implementation plan for the Tuesday milestone only."* Review the plan, correct anything you disagree with, then approve.
4. Build one milestone per session. When the conversation gets long, ask Claude to write progress to `PROGRESS.md`, run `/clear`, and start the next milestone fresh.
