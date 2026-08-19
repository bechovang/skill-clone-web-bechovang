# Phase 3 — Build (foundation-first, then parallel)

Two sub-phases. The foundation is built single-threaded by the dispatcher (it IS the shared ground); sections are built in parallel by worktree builders. Never parallelize the foundation — that's how two builders each invent their own button.

## 3a. Foundation (dispatcher, sequential, in this exact order)

1. **Tokens** — merge `design-tokens.json` into `@theme` in `src/app/globals.css` (Tailwind v4 syntax; see `tailwind-4-docs` skill if unsure).
2. **Promote media slots** — run `node .claude/skills/web-clone/scripts/promote.mjs` to land Phase 2's `media-selections.json` into `public/clone-assets/{route}/{slot}.{ext}` (dispatcher only, once — builders reference the promoted paths their specs declare, never the staging store, never hotlinks, never fabricated substitutes).
3. **UI primitives** — for every shadcn primitive the specs reference: `npx shadcn@latest add <name>`, then export it from `src/components/ui/index.ts`. Prefer these over custom components everywhere the 80% bar allows.
3. **Inventory components** — build everything listed in `_webclone/design-model/inventory.md` ONCE, here (cards, badges, buttons, shells that repeat across sections), exported via barrels. Section builders import these — they never build their own variant, and they never add files under `src/components/ui/`.
4. **Animation primitives + approved libraries** — install every library the specs' budget requests approved (`npm i framer-motion` etc. — the dispatcher installs, never a builder, so `package.json` changes exactly once) and build the shared motion primitives: `MotionConfig reducedMotion="user"` wrapper, reduced-motion-aware transitions. Tech per effect type comes from `references/animation-matrix.md` — nobody picks a library at build time. Lottie JSONs load lazily from `public/clone-assets/` (promoted slots).
5. **Shared layout** — build the shell components specs share (site header, sidebar, footer, page container) in `src/components/common/`. These are chunks too small to parallelize and too shared to risk conflicts.
6. **Mock data layer** — from specs: Zod schemas in `src/types/`, mock JSON in `_webclone/design-model/mocks/`, TanStack Query hooks in `src/hooks/` serving the mocks. Builders consume hooks by contract (schema + hook name declared in each spec).

After each step: `npm run lint && npx tsc --noEmit && npm run gates` — foundation ships green or nothing ships.

## 3b. Sections (N builders, parallel, isolated)

For each chunk in `chunks.md`:

1. `git worktree add ../wtc-<chunk-id> -b clone/<chunk-id>` (worktree per chunk, branch per chunk).
2. Dispatch ONE builder subagent per chunk. Its entire world:
   - the chunk's section spec file(s)
   - `references/failure-gates.md` + `.claude/rules/coding.md`
   - relevant captures (screenshots/text for its section only)
   - the hooks/schemas it consumes (already merged to main by 3a)
3. Builder contract:
   - create ONLY the files its chunk owns in `chunks.md`
   - `page.tsx` is an orchestrator (component tags only — no markup, no logic)
   - shared components come from the barrel (inventory/foundation) — never re-create a variant, never add files under `src/components/ui/`
   - animation tech is whatever `references/animation-matrix.md` assigns to the spec's declared effect types — no library choices, no new dependencies, transform/opacity only (A6), reduced-motion respected (A7)
   - state goes to its spec-declared layer: TanStack Query / Zustand / `useState` (coding.md)
   - co-located `*.test.tsx` for any component with logic (state/validation); visual-only components need render tests only
   - before handoff, run locally and pass: `lint`, `tsc --noEmit`, `npm run gates`, its tests
   - hitting a shared-file need (A5 reuse found something missing) → STOP and report back; do not modify shared files
4. Dispatcher: commit each builder's output on its branch. Failed builders get one retry with the failure note; persistent failures escalate to the user with the spec question.

## Discipline reminders

- One subagent per task, no cross-task context pollution (repo `CLAUDE.md` hard rule).
- Player screens are NOT built in v1 — their routes render a spec'd placeholder page if the router needs them present.
- If a builder discovers the spec was wrong, the spec goes back to Phase 2 re-approval — never "fix it in code quietly".

## Done when

Every chunk branch green (gates + lint + tsc + tests) and committed. → Phase 4.
