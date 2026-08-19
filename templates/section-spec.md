# Section Spec — <chunk-id>: <section name>

> Fill from `templates/section-spec.md` into `_webclone/design-model/sections/<chunk-id>.md`.
> A spec missing any REQUIRED block is REJECTED (failure class B) — see `references/failure-gates.md`.

- **Route(s):** /…
- **Screenshots:** `_webclone/captures/<slug>/desktop.png` (+ tablet/mobile when responsive differs)
- **Chunk owns:** files this chunk may create (must match `chunks.md`)

## Layout intent (REQUIRED — tree, ≤ 6 deep)

Describe structure, not pixels. Flex/grid relationships, hierarchy, spacing **scale** (e.g. "gap-4 section rhythm"), alignment. If a subtree needs > 6 levels, redesign it — do not transcribe the original's DOM.

```
Section (flex-col, gap-6, py-12)
├─ Header row (flex justify-between)
│  ├─ Title + subtitle
│  └─ "See all" link
└─ Card grid (grid, 3-col desktop / 2-col tablet / 1-col mobile)
   └─ Card × N (flex-col; image 16:9; title 2-line clamp)
```

## Component mapping (REQUIRED)

| Piece | Uses | Note |
|---|---|---|
| Card | `@/components/ui/card` | extend, don't fork |
| "See all" link | `@/components/ui/button` (variant link) | |
| New: `PracticeCard` | create `src/components/practice/practice-card.tsx` | A5 reuse check: searched common/, ui/ — nothing fits |

## State, validation, interactions (REQUIRED — class B lives here)

- Hover/press/selected/focus states for every interactive element
- Every piece of state classified into its layer (coding.md): **server data → TanStack Query** · **client UI state → Zustand** · **local widget state → `useState`**
- Forms: every field + Zod rule + error display + submit behavior (`react-hook-form` + `zod`)
- Data-driven behavior: what changes when the mock query resolves / errors / loads

## Animation (REQUIRED when anything moves)

Declare each animated interaction's **effect type** — the matrix picks the tech, not the builder (`references/animation-matrix.md`).

| Interaction | Effect type (matrix term) | Tech (from matrix) | Budget request |
|---|---|---|---|
| Card list enter | micro-interaction: list enter/exit | Framer Motion (already installed?) | — |
| Reward badge pop | mascot/badge effect | Lottie | dotLottie web component ~40 KB |

Any not-yet-installed library goes in **Budget request** with its weight — the dispatcher approves it against the route's remaining 300 KB gzip. transform/opacity only (gate A6) · reduced-motion handled (gate A7).

## Media slots (REQUIRED when the section renders any media)

Each row maps a visual surface to a slot in `_webclone/design-model/media-selections.json` (Phase 2c). Missing asset ⇒ declared TODO — never a fabricated substitute (failure class D).

| Surface | Slot (route/slot) | Variant note | Evidence |
|---|---|---|---|
| Hero illustration | home/hero-main | webp 1440w (index row 3) | media-index.md + desktop.png |
| Card thumbnail × 8 | practice/practice-card-thumb | srcset 2×/3x — promote 2x | media-index.md + states/tab-missions.png |
| Reward animation | missions/lottie-reward | network-only (no DOM box) | media-index.md network section |
| Footer logo | TODO — media: footer-logo | not harvested (lazy below fold miss?) | — |

## Mock data (REQUIRED)

- Zod schema: `<Name>` in `src/types/…` · Hook: `use<X>` in `src/hooks/…` · Example: `_webclone/design-model/mocks/<name>.json`

## Evidence grading

| Detail | Grade | Basis |
|---|---|---|
| Card grid 3/2/1 columns | SOURCE | desktop.png + tablet.png |
| Mobile sticky CTA | PARTIAL | inferred from 390px capture |
| Hover shadow color | GUESS | reconstructed — flag for reviewer |

## Acceptance criteria

- [ ] renders at 3 viewports per layout intent
- [ ] all declared interactions work
- [ ] every media slot promoted & rendering, or a marked TODO placeholder (class D)
- [ ] animation matches the matrix tech; respects reduced-motion; ≥ 30 fps on mid-range Android
- [ ] Vietnamese copy matches capture `.txt` verbatim
- [ ] gates green on this chunk's files
