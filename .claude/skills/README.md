# Design skills used in this project

Claude Code loads every skill in this folder automatically when you work in this repo. They were used to redesign the app, and they keep future changes consistent.

| Skill | What it's for | Author | Source (commit) | License |
|---|---|---|---|---|
| `impeccable` | Design direction, critique, audit and polish commands (`/impeccable audit`, `/impeccable polish`, …) | Paul Bakaus | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`687bc38`) | Apache 2.0 (see `impeccable/LICENSE`, `NOTICE.md`) |
| `frontend-design` | Distinctive, non-templated visual choices grounded in the subject | Anthropic | [anthropics/skills](https://github.com/anthropics/skills) (`2c5958e`) | See `frontend-design/LICENSE.txt` |
| `ui-ux-pro-max` | Searchable design-system, color, type and UX rule database (`scripts/search.py`) | Next Level Builder | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (`4f2dbb6`, tests folder removed) | MIT |
| `web-design-guidelines` | Reviews UI code against Vercel's Web Interface Guidelines | Vercel | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (`1a2c79d`) | MIT |
| `emil-design-eng` | Animation, interaction and polish rules from Emil Kowalski | Emil Kowalski | [emilkowalski/skills](https://github.com/emilkowalski/skills) (`c8a7962`) | MIT |

## Useful prompts in Claude Code

- `Run /impeccable audit on index.html and styles.css`
- `Review index.html and styles.css with the web-design-guidelines skill`
- `Use emil-design-eng to review the motion in styles.css`
- `Use ui-ux-pro-max to check the color contrast of our tokens`

To update a skill, re-copy its folder from the source repo above.
