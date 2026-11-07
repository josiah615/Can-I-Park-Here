# Can I Park Here? — instructions for Claude Code

## Project
- Static front end (`index.html`, `styles.css`, `app.js`, no build step) plus Vercel serverless functions in `api/`.
- Shared logic lives in `lib/parking.js` and must stay runtime-neutral (no Node-only or browser-only APIs).
- Scope and acceptance criteria: `PRD.md`. Product context: `PRODUCT.md`. Design system: `DESIGN.md`.

## Commands
- `npm test` runs the unit tests. Run them after every change to `lib/` or `api/`.
- `ANTHROPIC_API_KEY=... npm run eval` scores accuracy on `fixtures/`. Run it after any prompt change and report the score.
- `npx vercel dev` serves the app and API locally.

## Rules
- Never put an API key in client code or commit one. The server reads `ANTHROPIC_API_KEY` from the environment.
- Any change to the model's output shape must update `normalizeResult`, the tests and the UI together.
- UI work follows `DESIGN.md` and the skills in `.claude/skills/` (impeccable, frontend-design, ui-ux-pro-max, web-design-guidelines, emil-design-eng). Review UI changes with web-design-guidelines before committing.
- Work in small milestones on a branch, commit after each one with a clear message, and open a pull request for review.
