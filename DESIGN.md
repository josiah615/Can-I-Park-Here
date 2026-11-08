# Design system

## Concept

**The verdict is a regulatory sign plate.** People use this app on a sidewalk, one-handed, often in daylight glare or at night. The answer borrows the visual language they're already reading on the pole: white retroreflective plate, green for permitted, red for prohibited, heavy highway lettering. Everything around it stays quiet, high-contrast and plain. That's the one bold move; nothing else competes with it.

Mode (Impeccable): **Operate**. Speed and scanability beat expression.

## Tokens (`styles.css` → `:root`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#eef1ef` | `#0d1311` | Page |
| `--surface` | `#ffffff` | `#151d19` | Buttons, chips, panels |
| `--ink` | `#121a16` | `#e6eee9` | Text |
| `--muted` | `#4a5850` | `#a2b1a8` | Secondary text (≥ 4.5:1 on both) |
| `--green` | `#00704a` | `#3fbf86` | Primary action, "doesn't affect your stay" |
| `--red` | `#b3242a` | `#f07a7f` | "Affects your stay" |
| `--amber-soft` / `--amber-ink` | `#fbefd5` / `#7a4f00` | `#2f2513` / `#f1c46b` | Warnings |
| `--plate*` | constant | constant | Sign plate stays white with green/red legend in both themes, like real sheeting at night |

**Type:** Overpass, an open-source descendant of the U.S. highway sign alphabet (FHWA Highway Gothic). One family, weights 400/600/800/900. Scale 1.25. Tabular numerals everywhere, because times are the data.

**Space:** 4/8 rhythm (4, 8, 12, 16, 24, 32, 48). Touch targets ≥ 44 px.

**Icons:** authored inline SVG, one 1.75 stroke, no emoji.

**Motion** (Emil Kowalski): one authored moment. The plate settles in over 240 ms with `cubic-bezier(0.23, 1, 0.32, 1)` when a new answer arrives. Buttons press to `scale(0.97)`. Hover effects only on `(hover: hover) and (pointer: fine)`. Reduced motion keeps only the fade.

## How each skill shaped it

| Skill | What it changed |
|---|---|
| frontend-design | Grounded the look in road signage instead of a SaaS template; removed all-caps eyebrow labels and section numbers; one type family |
| impeccable | Operate mode; craft floor: themed selection, caret and scrollbar, real states (loading, error, empty example, low confidence), no colored side-stripes, no glyph icons |
| ui-ux-pro-max | Design-system search recommended Swiss-minimal, high contrast, semantic green/red, 44 px targets, 375 px testing. Its Inter suggestion was rejected for Overpass, which comes from the sign world |
| web-design-guidelines | Labels on every control, `aria-live` status, visible `:focus-visible`, `…` in loading text, `touch-action: manipulation`, `theme-color`, `Intl.DateTimeFormat`, specific button labels, errors that say how to fix them, skip link |
| emil-design-eng | Custom ease-out, < 300 ms UI motion, press feedback, no `transition: all`, interruptible transitions over keyframes |

## Rules for future changes

- The plate is the only loud element. Don't add a second.
- State must never rely on color alone (each rule has an icon and words).
- Keep the copy in the driver's language: "Move by", "Affects your stay".
- Run `Review index.html and styles.css with the web-design-guidelines skill` before merging UI changes.
