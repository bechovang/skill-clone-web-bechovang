# Failure Gates — the 3 diseases this skill exists to prevent

Every builder reads this file BEFORE writing code. These are not hypothetical: all three classes were observed in a real prior clone attempt (a `RecoverPage`), reviewed line by line. The golden evidence: **all 7 failures happened while `.claude/rules/coding.md` already existed** — instructions do not self-execute. Therefore: machine-checkable rules become hard gates; only genuine intent-reading stays soft.

## The root pattern

AI clones transcribe what they can see (rendered DOM, computed CSS) instead of **translating** the design into this repo's idioms (component reuse, flex/grid intent, theme tokens, form architecture). Transcription produces code that *looks like* the original's HTML — which is exactly what this repo does not want. The 90/100 ascent rule exists for the same reason: unbounded pixel-pursuit is what creates the incentive to transcribe, so fidelity climbs only through the ascent loop — bounded by the two invariants (gates green + route budget) and capped at 3 rounds per route.

**Fidelity never buys a gate violation.** A visual gap closed with a `[&…]` selector, an inline style, an arbitrary color, a >320-line file, or an oversized bundle is not a win — it is a class A failure wearing fidelity as a disguise. Redo it the idiomatic way, or accept the gap and record it in the run report's ascent log.

## Disease classes → gates

### Class A — Transcription / DRY violations (HARD gates)

Evidence: three `<Image>` cards hand-rebuilt where `InputFrame` already existed · ~20 lines of SVG copy-pasted instead of a shared component · `<div>` nested 9 levels for a `+84` label · magic padding `pl-[6rem] sm:pl-[7rem] xl:pl-[8.5rem]` patching an absolute position instead of using flex · a Tailwind className with `[&>.left-corner>svg>path:nth-child(1)]` · inline `style={{ textShadow: ... }}` instead of a theme token.

Enforced by `scripts/gates.ts` (exit 1 on violation):

| Gate | Rule |
|---|---|
| A1 | No `[&` arbitrary-variant selectors inside `className` anywhere in `src/` |
| A2 | No inline `style={{ ... }}` — theme tokens (`@theme` in `globals.css`) or Tailwind classes only |
| A3 | No component file over ~320 lines (excluding tests) — split instead |
| A4 | JSX nesting depth heuristic ≤ 6 — deeper means the layout intent was lost, rebuild with flex/grid |
| A5 | **Reuse-first:** before creating any new component, search `src/components/` (barrels + Grep) for an existing equivalent; if one exists, reuse or extend it. Builders must record this check in the section spec |
| A6 | Animate **only `transform`/`opacity`** — never `width`/`height`/`top`/`left` in motion props (`animate={{…}}`, variants) or GSAP tweens; layout props are the #1 jank cause on mid-range Android (doc 15/08 §1.3) |
| A7 | Any file with JS-driven animation (framer-motion, `animate={{…}}`) must handle `prefers-reduced-motion` (`useReducedMotion` / `motion-reduce:` / `MotionConfig`); `globals.css` must carry the media query for CSS animations |
| A8 | No arbitrary color values (`bg-[#…]`, `text-[rgb(…)]`) — colors only via `@theme` CSS-variable tokens; variable refs like `bg-(--brand)` are the correct form |

### Class B — Half-built architecture (SOFT at spec time + HARD at review)

Evidence: a form with phone + OTP + password + re-password where only `phone` and `otp` had state; no validation wiring.

- SOFT: every section spec MUST declare state, validation (`react-hook-form` + `zod`), and interactions BEFORE code exists (Phase 2 rejects specs that don't).
- HARD at review: two-stage review per repo `CLAUDE.md` — first spec compliance (does it do what the spec declared?), then code quality.

### Class C — Silent quality rot (HARD gates)

Evidence: `tabIndex={0}` on a `<button>` — small, not a compile error, invisible to a demo, lapped by every reviewer until it ships.

| Gate | Rule |
|---|---|
| C1 | `eslint-plugin-jsx-a11y` active — lint must be green |
| C2 | `npm run lint` 0 errors |
| C3 | `npx tsc --noEmit` clean (no `any`, no unused) |

### Class D — Fabricated media (SOFT at spec time + HARD at review)

Evidence (2026-08-19 session): when a media slot had no harvested asset, the builder "helpfully" substituted a placeholder icon and the hole went unnoticed — the fabricated stand-in is a symptom of invented code, not a capture problem.

- SOFT: every media surface a spec renders must map to a slot in `media-selections.json` (Phase 2 rejects the spec otherwise). A slot with no harvested asset is declared **`TODO` — media: <slot-name>** in the spec and renders as a visibly marked placeholder.
- HARD at review: no silently substituted icons/illustrations for missing media · every `TODO` placeholder is listed in the run report · the visual-diff sensor's "likely-empty" clusters are all explained (promote error, selection gap, or accepted TODO).

## Operating rule

> If a machine can check it, the machine checks it. AI promises are not evidence.

When a gate fires, the fix is never "silence the gate" — it is "redo the piece the repo-idiomatic way": extract the component, use flex, define the token, add the missing state.
