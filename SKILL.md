---
name: web-clone
description: Clone the frontend of a live website (primary target exam.flyer.us) into this repo's stack — 80% visual fidelity, 100% clean idiomatic code. Use when asked to clone, copy, rebuild, or replicate any website or screen from a URL into this project. Covers login-gated recon, full media harvesting with slot-keyed manifests, design-model specs, parallel section builds in worktrees, and hard quality gates.
---

# Web Clone — the 80/100 factory

Rebuilds a live site onto THIS repo's stack — the single source of truth is the **Tech Stack block in `.claude/ARCHITECTURE.md`** (Next.js App Router on Node, TypeScript strict, Tailwind v4 `@theme` CSS variables, shadcn/ui, TanStack Query, Zustand; runner is npm/Node — never Bun). The deliverable is a **twin clone**:

- **~80% visual fidelity** to the original — close enough that nobody double-takes, and no closer.
- **100% code that reads like this repo wrote it** — passes `.claude/rules/coding.md` and every gate below.

Most clone tooling optimizes for pixels. This skill optimizes for **code idiomaticity** — the visual bar exists only to prove the clone is faithful, not to be pixel-perfect.

> Lineage: process (phases, gates, specs) from this repo; harvest tooling adapted from jane/xiaoer's open-source `claude-skill-web-clone` v1.6 (archived at `ref skills/claude-skill-web-clone.archived/` — fork drift accepted 2026-08-19). Design decisions live in `_bmad-output/brainstorming/brain-webclone-media-manifest-2026-08-19/brainstorm-intent.md`.

## Non-negotiables (hold in every phase)

1. **80/100 rule.** Never trade code cleanliness for pixels. Prefer shadcn/ui primitives over copied custom CSS. There is no pixel-diff GATE in this skill — by design. `visual-diff.mjs` is a diagnostic **sensor** that tells the human eye where to look; it never passes or fails a screen.
2. **Machine over promises.** If a rule can be machine-checked (lint, `tsc`, a11y, structural bans), it is a HARD GATE enforced by `scripts/gates.ts` — never advice. "I followed the rules" is not a state; a green terminal is.
3. **Spec before code.** No section is built without an approved spec (Phase 2). A spec that doesn't declare state/validation/interactions is rejected — that is failure class B.
4. **Credentials live in `.env` only** (already git-ignored). Never in code, logs, specs, file names, commits, or chat output. Runtime reads `CLONE_TARGET_URL`, `CLONE_LOGIN_PHONE`, `CLONE_LOGIN_PASSWORD`.
5. **Media: capture ALL, ship SELECTED.** Every asset the site loads is harvested verbatim into the content-hash store (`_webclone/staging/`, git-ignored) — no re-creation, no "improvements", no hotlinking. Only slots the Phase 2 spec names are promoted into `public/clone-assets/` (capture-all ≠ ship-all; the 300 KB budget beats fidelity). A media slot with no harvested asset renders a marked `TODO` placeholder — never a silently fabricated icon.
6. **Scripts gather raw evidence; the AI names slots.** Harvest scripts never invent semantic names — they record route × state × DOM context (selector, box, alt, section, natural size, network bytes). Phase 2 turns that raw evidence into semantic slots (`hero-main`, not "3rd image in 7th div").
7. **Disease prevention first.** Every builder reads `references/failure-gates.md` before writing a line. The failure classes documented there were real failures; the gates are not optional.

## Pipeline — strictly in order, one phase at a time

Load each phase's reference only when that phase starts (keep context lean):

| Phase | Purpose | Reference |
|---|---|---|
| 0 Setup | deps, MCP, codegraph, `.env`, smoke test | `references/phase-0-setup.md` |
| 1 Recon | MCP explores + logs in; `orchestrator.mjs` captures route × state × viewport and emits raw media evidence; `download.mjs` fills the hash store + `media-index.md` | `references/phase-1-recon.md` |
| 2 Design Model | `design-tokens.json` + one spec per section + **media selections** (semantic slot names → `media-selections.json`); **human review point** | `references/phase-2-design-model.md` |
| 3 Build | foundation-first; `promote.mjs` lands chosen slots in `public/`; N builders in isolated worktrees, one chunk each | `references/phase-3-build.md` |
| 4 Assembly | merge worktrees, wire routes / ROUTES / sitemap / barrels | `references/phase-4-assembly.md` |
| 5 QA | hard gates green + interaction sweep + visual-diff sensor report + side-by-side album (human eye) | `references/phase-5-qa.md` |

## The media loop in one sentence

**capture** (orchestrator: network ∪ DOM per route × state) → **stage** (download: storageState + sha256 store, dedup) → **name** (Phase 2: AI reads `media-index.md`, writes `media-selections.json`) → **promote** (chosen slots → `public/clone-assets/{route}/{slot}`) → **build** (components reference slot files) → **sense** (visual-diff locates deviations + likely-empty regions) → **fix**.

## Work directory layout

```
_webclone/
  captures/        # screenshots, HTML snapshots, per-route media.json, media-index.md  (git-ignored)
  staging/         # content-hash store — every unique asset exactly once             (git-ignored)
  design-model/    # tokens.json + section specs + media-selections.json + mocks      (COMMITTED — reviewed via PR)
  album/           # original-vs-clone comparison pages                                (git-ignored)
public/
  clone-assets/    # promoted slot files + manifest.json                                (COMMITTED)
```

`_webclone/captures/`, `_webclone/staging/`, and `_webclone/album/` go into `.gitignore` in Phase 0. `design-model/` and `public/clone-assets/manifest.json` stay committed — they are the durable artifacts future maintainers (and the next clone run) build from.

## Script inventory

Harvest scripts are stand-alone `.mjs` (run with plain `node`, no build step). Verification is TypeScript via `npm run gates`.

| Script | Role |
|---|---|
| `scripts/orchestrator.mjs` | THE capture pass: per route × state × viewport — settle, record every network request, DOM media scan (img/srcset/picture/video/audio/poster/inline-svg/computed-bg incl. pseudo/@font-face), screenshots + HTML + text; saves storageState |
| `scripts/download.mjs` | separate download pass: replays storageState, writes sha256-addressed store, annotates media.json, regenerates `media-index.md` |
| `scripts/promote.mjs` | ships Phase 2's slot selections into `public/clone-assets/{route}/{slot}.{ext}` + `manifest.json`, warns at 300 KB/route |
| `scripts/visual-diff.mjs` | DIAGNOSTIC SENSOR: diff clusters in page coordinates + empty-render heuristic + markdown report — never a gate |
| `scripts/network-capture.mjs` | XHR/fetch fixtures for mock data (SPA APIs) |
| `scripts/interaction-probe.mjs` | auto scroll/hover/safe-click/canvas-drag sweep with state-change evidence — use when a screen's behavior is unclear |
| `scripts/sourcemap-hunt.mjs` | find + fetch source maps from captured script URLs (reads `captures/recon.json`) |
| `scripts/gates.ts` | class A structural bans A1–A8 (`npm run gates`) |

## Parallel build model (Phase 3)

One dispatcher (you) + N builder subagents. Each builder gets its own git worktree and exactly ONE section-chunk spec plus `references/failure-gates.md` and `.claude/rules/coding.md`. One subagent per task — no cross-task context pollution. Builders never touch shared files; conflicts are escalated back to the dispatcher.

## Definition of done (per screen)

All hard gates green (`lint`, `tsc --noEmit`, `test`, `npm run gates` — A1–A8) · spec satisfied incl. declared 3-layer state + effect types · mock data wired through Zod + TanStack Query · every spec'd media slot promoted and rendering (or a marked TODO) · route JS < 300 KB gzip · visual-diff sensor report reviewed · side-by-side album entry exists · no credentials anywhere. Full checklist: `references/phase-5-qa.md`.

## Out of scope (v1 — do not build)

Pixel-diff automation as a gate · any Figma intermediate layer · MSW · content translation · exam-player playbook (timer/audio/drag-drop — parked for v1.1; recon still records it, build defers) · PWA/offline sync — Service Worker + IndexedDB (15/08 doc §1.4) is app functionality, not clone functionality; parked for v1.1 · vision-model layout-intent analysis + codegen soft-gates (pipeline steps 3–4 from the 2026-08-19 morning session — a later round).
