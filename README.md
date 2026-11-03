# Can I Park Here?

Photograph a stack of parking signs and get a plain answer for your planned stay: **YES**, **YES, BUT**, **NO**, or **CAN'T TELL**, plus the sign rule that decides it.

## Why

Stacked parking signs combine time limits, street cleaning, tow-away hours and permit zones. Drivers have to work out all of them against the current day and time, often while double-parked.

- U.S. drivers spend about 17 hours a year searching for parking, an estimated $72.7B in lost time, fuel and emissions (INRIX).
- New York City alone issued over 16.5 million parking tickets and camera violations in FY2025 (NYC Dept. of Finance).

## What's here

| Path | What it is |
|---|---|
| `PRD.md` | Product requirements: scope, acceptance criteria, schema, test plan, 6-day milestones |
| `index.html` | Single-page clickable prototype (served by GitHub Pages) |

### About the prototype

The prototype calls Claude's vision model through the Claude artifact runtime. It only reads signs when opened inside Claude. Opened anywhere else (including GitHub Pages), it shows the sample sign and example answer, and the **Check** button explains that sign checking needs Claude.

The production version described in `PRD.md` moves the AI call to a server API route (`/api/check`) using the Anthropic API, so the key stays private and answers are validated before a driver sees them.

## Roadmap

See the milestones in `PRD.md`, section 8.

## Disclaimer

The posted sign is always the final authority. This tool is a second opinion.
