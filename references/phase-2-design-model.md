# Phase 2 — Design Model (the normalization layer)

This is the layer that cures the transcription disease: between raw captures and code stands a **reviewed, versioned model** of what the site is. No builder ever reads raw HTML; builders read specs. (This is the salvaged gem of the rejected Figma idea: normalization + human review, without Figma's tax.)

Output lives in `_webclone/design-model/` and is **committed and reviewed via PR** — fixing a wrong spec here costs minutes; the same wrongness in code costs days.

## 1. Design tokens

Start from `templates/design-tokens.json`. Fill it from captures: brand + semantic colors, typography scale, spacing scale, radii, shadows, breakpoints. Map into Tailwind v4 via `@theme` in `src/app/globals.css` during Phase 3 foundation — colors live **only** as CSS-variable tokens (theme switching per age group/brand depends on this; arbitrary color classes are gate A8). Only tokens actually used by specs belong here — no speculative palettes.

## 2. Section specs

One file per section chunk, from `templates/section-spec.md`, into `_webclone/design-model/sections/`. A spec is **rejected** (class B) unless it declares:

- layout intent tree (≤ 6 deep — deeper means re-think, not transcribe)
- component mapping: existing shadcn/ui primitive, existing repo component, or genuinely-new
- **state, validation, and interactions** — every piece of state classified into the 3 layers (server = TanStack Query · client UI = Zustand · local = `useState`, per `coding.md`); even for "visual" sections, declare hover/press/selected states; for forms, every field with its Zod rule
- **animation effect types** — each animated interaction labeled with its effect type from `references/animation-matrix.md`; the matrix (not the builder) decides the tech. Any not-yet-installed library the chunk needs goes into the spec's **budget request** with its weight, for the dispatcher to approve against the route's remaining 300 KB gzip budget
- mock-data shape (Zod schema name + example JSON path)
- evidence grade per non-obvious detail (SOURCE / PARTIAL / GUESS)
- the reuse check performed (gate A5): which existing components were searched and considered

## 2b. Shared-component inventory (fixes the duplication failure)

Before chunk specs are frozen, scan all section specs for components that repeat across sections (cards, badges, buttons, shells). Record them in `_webclone/design-model/inventory.md`: component → sections using it → the foundation chunk that builds it. Everything in the inventory is built ONCE in Phase 3's foundation chunk; section builders import from the barrel and may not create their own variant. This inventory is the Phase 2 answer to the observed failure of parallel builders re-creating the same component three times.

## 2c. Media selections (the slot-naming act)

Scripts gathered RAW evidence in Phase 1 — this is where it becomes semantic. Read `_webclone/captures/media-index.md` (the AI-readable layer) plus the section screenshots, then write `_webclone/design-model/media-selections.json`:

```json
[ { "route": "home", "slot": "hero-main", "url": "https://…/hero.webp" } ]
```

Rules:

- **Slot names are semantic** — `hero-main`, `practice-card-thumb`, `mission-banner` — never `img-04` or "3rd image in 7th div" (the manifest already carries DOM coordinates; the name carries MEANING).
- Pick the right variant: for srcset/DPR families prefer the variant matching the layout's render size (check `naturalW×naturalH` in the index) — not blindly the largest.
- **Every media surface a spec renders must resolve to a slot here.** A slot with no harvested asset stays in the spec as a marked `TODO` placeholder (failure class D) — never fabricate a substitute.
- Font/lottie/network-only items get slots too (`font-display`, `lottie-reward`) — the manifest's `dom` may be null for them; the hash is the identity.
- Cross-route duplicates share one hash — if two routes need the same asset, write both entries; promote copies per route (or hoist to `shared/` when the spec reuses one component).

This file ships in the Phase 2 PR next to the specs — reviewers check slot names against screenshots, and Phase 3's `promote.mjs` consumes it verbatim.

## 3. Chunking — the 3 principles

Split pages into section chunks so that parallel builders cannot collide:

1. **Mutual exclusivity** — no two chunks write the same file. Shared pieces (a card used by two sections) are hoisted OUT into a shared chunk built first.
2. **Complete coverage** — every visible section of every captured route belongs to exactly one chunk. Nothing orphaned, nothing double-claimed.
3. **Size control** — one chunk ≈ 1–3 components, each file ≤ ~320 lines (gate A3). Bigger sections split by sub-section.

Record the chunk map in `_webclone/design-model/chunks.md` (chunk id → files it may create/touch → dependencies).

## 4. Human review point — the gate of this phase

Open a PR containing tokens + specs + chunks.md. The user (or their lead) reviews structure and intent, not pixels. Fixes land in specs. **After approval the Design Model is frozen**; changing a spec later requires re-approval — this is what keeps N parallel builders consistent.

## Done when

Tokens complete · every non-player route fully covered by approved specs (state 3-layer + effect types + budget requests declared) · inventory.md lists every cross-section component · `media-selections.json` names a slot for every media surface the specs render · chunks.md satisfies all 3 principles · PR approved. → Phase 3.
