# web-clone — the 90/100 clone factory

> 🇬🇧 English · [🇻🇳 Tiếng Việt](./README.vi.md)

A [Claude Code skill](https://claude.com/claude-code) that clones the **frontend of a live website into YOUR repo's stack** — login-gated screens included — and produces code that reads like your repo wrote it, not like a transcription of the original's DOM.

Built and battle-designed against `exam.flyer.us` (a login-gated Vue site) for a Next.js 16 / TypeScript-strict / Tailwind v4 / shadcn-ui repo. The skill itself is stack-agnostic in its process; only `scripts/gates.ts` and the doc references to `.claude/rules/coding.md` assume a TS + Tailwind repo.

---

## What "90/100" means (the core philosophy)

| Rule | Meaning |
|---|---|
| **90% fidelity target — ascent, not a cap** | Fidelity is a variable with a global default target of **90** (per-route override 80–98 in Phase 2). The Phase 5 **ascent loop** (≤ 3 rounds/route) pushes each route toward its target. |
| **100% idiomatic code — invariant** | Output passes your lint, your structural gates, your component conventions. Reuse-first (shadcn/ui / your own components) over copied custom CSS. **A fidelity gain that breaks a gate is rejected.** |
| **Budget beats fidelity — invariant** | A route over its JS budget (default < 300 KB gzip) loses animation weight and fidelity — never the other way around. |
| **Machine over promises** | Anything machine-checkable is a HARD GATE (`scripts/gates.ts`), never advice. A green terminal, not "I followed the rules". |
| **Spec before code** | No section is built without an approved spec. Ever. |
| **Pixel-diff = meter + sensor, never a gate** | `visual-diff.mjs` scores fidelity (100 − changed-pixel %) as the ascent loop's progress meter and tells the human eye WHERE to look (fix-first clusters, likely-empty regions). The verdict belongs to a person. |

## The media layer (the 2026-08 feature)

The part most clone tools get wrong: media arrives **complete** and **understandable**.

```
capture ──► stage ──────► name ──────────► promote ──────► build ──► sense ──► fix
(orchestrator) (download)  (Phase 2 AI)     (promote)               (visual-diff)
```

1. **Capture ALL** — `orchestrator.mjs` walks every route × interaction-state × viewport, recording *every network request* (Playwright events) **∪** a *DOM media scan* (img/srcset/picture/video/audio/poster/inline SVG/computed background images including `::before`/`::after`/@font-face via CSSOM). Lazy-loaded, background, font, video, and Lottie-JSON assets all land.
2. **Stage once** — `download.mjs` is a *separate* pass that replays the crawl's `storageState` (login-gated CDN assets download fine) into a **content-hash store**: `_webclone/staging/{hash2}/{sha256}.{ext}`. One file per unique asset, deduped across routes. The sha256 is the stable identity — renaming a slot never re-downloads anything.
3. **Name semantically** — scripts never invent names. They record raw evidence per item: route, states, tag, CSS selector, page-coordinate box, alt text, nearest section, natural size, network bytes/content-type. The AI (or a human) reads the generated `media-index.md` and writes `media-selections.json` with **semantic slot names** — `hero-main`, `practice-card-thumb` — never "3rd image in the 7th div".
4. **Ship SELECTED** — capture-all ≠ ship-all. `promote.mjs` copies only the slots the approved spec chose into `public/clone-assets/{route}/{slot}.{ext}` (the filesystem IS the shipped manifest) and warns per-route at 300 KB.
5. **Sense gaps + measure** — `visual-diff.mjs` scores fidelity (100 − changed-pixel %) against `--target` (default 90), clusters pixel deviations into fix-first-ranked page-coordinate boxes, and flags **likely-empty regions** (clone renders flat where the original has texture = probably a missing media slot). Each cluster cross-references the route's `media.json` boxes, so a hole is diagnosed as *selection gap / promote error / accepted TODO* — deterministically.

A media slot with no harvested asset renders a **marked `TODO` placeholder** — never a silently fabricated icon (failure class D).

## Pipeline (strictly one phase at a time)

| Phase | What happens | Reference |
|---|---|---|
| **0 Setup** | deps, Playwright chromium, browser MCP, `.env` credentials, gitignore, smoke test | `references/phase-0-setup.md` |
| **1 Recon** | MCP explores/logs in/classifies screens → `routes.json` (with interaction states) → `orchestrator.mjs` captures → `download.mjs` stages + generates `media-index.md` | `references/phase-1-recon.md` |
| **2 Design Model** | design tokens + one spec per section (layout intent, component mapping, 3-layer state, effect types, budget requests) + **media selections** (slot naming). Human review PR — then frozen | `references/phase-2-design-model.md` |
| **3 Build** | foundation first (tokens → promote media → shadcn primitives → shared inventory → motion primitives → mocks), then N section builders in isolated git worktrees | `references/phase-3-build.md` |
| **4 Assembly** | deterministic merge order, gates after each merge, ROUTES/sitemap/metadata wiring | `references/phase-4-assembly.md` |
| **5 QA** | hard gates → interaction sweep → visual-diff sensor + **fidelity ascent loop** (sense → fix → re-gate, ≤ 3 rounds/route) → side-by-side album for the human verdict | `references/phase-5-qa.md` |

## Script inventory

Harvest scripts are **stand-alone `.mjs`** — plain `node`, no build step, no deps beyond Playwright. Verification is TypeScript (`gates.ts`) run via your repo's `tsx`.

| Script | What it does |
|---|---|
| `scripts/orchestrator.mjs` | THE capture pass. Per route × state × viewport: settle (scroll sweep), record every request, DOM media scan, screenshots/HTML/text, state-chain screenshots. Emits per-route `media.json`, `storage-state.json`, `recon.json` |
| `scripts/download.mjs` | Separate auth-aware download pass → sha256 store → annotates `media.json` → regenerates `media-index.md` |
| `scripts/promote.mjs` | Ships `media-selections.json` → `public/clone-assets/{route}/{slot}.{ext}` + `manifest.json`; per-route byte warning |
| `scripts/visual-diff.mjs` | Fidelity meter + diagnostic sensor: fidelity % vs `--target 90`, canvas pixel diff → fix-first deviation clusters (page coords) + empty-render heuristic → JSON + diff PNG + markdown report — never a gate |
| `scripts/network-capture.mjs` | XHR/fetch fixtures (mock-data source for SPA APIs) |
| `scripts/interaction-probe.mjs` | Auto scroll/hover/safe-click/canvas-drag sweep with state-change evidence — for unclear screens |
| `scripts/sourcemap-hunt.mjs` | Finds + downloads source maps from captured script URLs |
| `scripts/gates.ts` | Class-A structural bans A1–A8 (arbitrary variants, inline styles, file length, nesting, reuse-first, transform/opacity-only animation, reduced-motion, token-only colors) |

### routes.json — the crawl plan (Phase 1 output)

```json
[
  { "slug": "home", "path": "/", "auth": true, "type": "static" },
  { "slug": "practice", "path": "/practice", "auth": true, "type": "static",
    "states": [
      { "name": "tab-missions", "action": "click", "selector": "button:has-text('Nhiệm vụ')" }
    ] }
]
```

**Slot key = route × state.** A page is a chain of states — media that only appears after a tab click is harvested under that state, so the manifest never lies by collapsing states into one bucket.

### media.json item shape (raw evidence)

```json
{
  "url": "https://cdn.site/hero.webp",
  "kind": "image",
  "states": ["initial"],
  "dom": { "tag": "img", "selector": "main > section:nth-of-type(1) > img", "box": { "x": 0, "y": 96, "w": 1440, "h": 520 },
            "naturalW": 2880, "naturalH": 1040, "alt": "Hero illustration", "inSection": "Luyện tập", "origin": "attr" },
  "network": { "status": 200, "resourceType": "image", "contentType": "image/webp", "bytes": 184320 },
  "hash": "ab12…", "localPath": "_webclone/staging/ab/ab12….webp"
}
```

## Repository layout when installed

```
your-repo/.claude/skills/web-clone/
├── SKILL.md                    # the entry point Claude loads
├── references/                 # phase playbooks, loaded on demand
│   ├── phase-0-setup.md … phase-5-qa.md
│   ├── failure-gates.md        # the 4 failure classes (A/B/C/D) + gates table
│   ├── animation-matrix.md     # effect-type → tech decision table (CSS-first)
│   ├── assessment.md           # complexity L1–L6 + post-clone scoring
│   └── effect-extraction.md    # evidence discipline (SOURCE/PARTIAL/GUESS) + baseline gate for WebGL/Canvas
├── scripts/                    # .mjs harvest tools + gates.ts
│   └── lib/playwright-loader.mjs
└── templates/                  # design-tokens.json, section-spec.md skeletons

# runtime outputs (your repo)
_webclone/captures/    # screenshots, HTML, per-route media.json, media-index.md   (git-ignored)
_webclone/staging/     # sha256 media store                                        (git-ignored)
_webclone/design-model/# tokens, section specs, media-selections.json, chunks.md  (COMMITTED — PR-reviewed)
_webclone/album/       # original-vs-clone comparison pages                        (git-ignored)
public/clone-assets/   # promoted slot files + manifest.json                       (COMMITTED)
```

## Installation

1. Copy this folder to `<your-repo>/.claude/skills/web-clone/`.
2. Ensure Playwright is available to the repo: `npm i -D playwright && npx playwright install chromium`.
3. Add to `.gitignore`:
   ```
   _webclone/captures/
   _webclone/staging/
   _webclone/album/
   ```
4. Create `.env` (git-ignored) — credentials are NEVER printed, logged, or committed:
   ```
   CLONE_TARGET_URL=https://example.com
   CLONE_LOGIN_PHONE=…        # optional — omit for public-only capture
   CLONE_LOGIN_PASSWORD=…
   ```
5. **Verify the `LOGIN` selectors** at the top of `scripts/orchestrator.mjs` against your target's login form (they carry `// VERIFY` markers — this is the only target-specific code in the script).
6. For the TS gates: `npm i -D tsx` and a package.json script `"gates": "tsx .claude/skills/web-clone/scripts/gates.ts"` (adapt A1–A8 to your conventions if your stack differs).

### Typical run

```bash
# Phase 1 — after writing routes.json from the MCP exploration:
node .claude/skills/web-clone/scripts/orchestrator.mjs
node .claude/skills/web-clone/scripts/download.mjs

# Phase 2 — AI names slots from the index, writes media-selections.json, specs, PR…

# Phase 3 — dispatcher promotes media once, then builders work in worktrees:
node .claude/skills/web-clone/scripts/promote.mjs

# Phase 5 — sensor + fidelity score per screen (ascent loop rounds follow the report):
node .claude/skills/web-clone/scripts/visual-diff.mjs \
  --original _webclone/captures/home/desktop.png --clone <clone-shot.png> \
  --out _webclone/captures/home/diff.json --diff _webclone/captures/home/diff.png \
  --report _webclone/captures/home/diff.md \
  --target 90
```

## Failure classes the skill exists to prevent

| Class | Disease | Enforcement |
|---|---|---|
| **A** | Transcription / DRY violations (rebuilt what existed, arbitrary variants, inline styles, deep nesting) | HARD gates A1–A8 in `gates.ts` — and fidelity NEVER buys a gate violation: an ascent fix that reddens a gate is reverted and logged as an accepted gap |
| **B** | Half-built architecture (undeclared state, missing validation) | SOFT at spec (Phase 2 rejects) + HARD at two-stage review |
| **C** | Silent quality rot (a11y slips, `any`, lint debt) | HARD: jsx-a11y + lint + tsc clean |
| **D** | Fabricated media (placeholder icons substituted for missing assets) | SOFT: spec must map every surface to a slot; HARD: TODO placeholders listed, every sensor "likely-empty" cluster explained |

## Lineage & design decisions

- **Process** (phases, gates, specs, worktree builders): built 2026-08-17/18 for the `english-learning-app-fe` repo.
- **Harvest tooling**: adapted from jane/xiaoer's open-source `claude-skill-web-clone` v1.6 (four scripts kept and ported: network-capture, interaction-probe, sourcemap-hunt, visual-diff; four dropped as out-of-scope for the 80/100 goal: init-clone, dna-scaffold, mirror-site, audit-clone). Upstream has no LICENSE file — attribution is retained here by design; do not present this fork as upstream's work.
- **Media layer + merge**: converged in two BMAD brainstorm sessions on 2026-08-19 (slot-first manifests, capture-all/ship-select, hash store, sensor-not-gate). Full decision record: `brain-webclone-media-manifest-2026-08-19/brainstorm-intent.md` in the source workspace.
- **90/100 ascent rule** (2026-08-20): the 80% bar was a means (clean code + stable bundle), not an end — so fidelity became a target of **90** climbed by a bounded ascent loop, with clean code and budget as the two non-negotiable invariants.
- **Known-unverified**: login selectors (`// VERIFY`) and the interaction `states[]` vocabulary are authored per-target at Phase 1 — the layer has passed syntax/boot checks (`node --check`, `--help`) but its first full live run is the next milestone.

## License

None declared yet — all rights reserved by default. The upstream attribution above applies to the ported scripts. Decide on a license before distributing.
