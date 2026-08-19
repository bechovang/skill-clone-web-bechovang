# Phase 5 — QA (dual: machine gates + human eye)

Two stages, in order. Machine first (cheap, objective), human second (the fidelity judgement).

## Stage 1 — Hard gates (all must be green, no exceptions)

```bash
npm run lint                     # includes jsx-a11y
npx tsc --noEmit                 # strict clean
npm run test                     # vitest suite
npm run gates                    # class A structural bans (A1–A8)
npm run build                    # produces the budget table below
npx jscpd src --min-tokens 70    # copy-paste duplication report (A5 follow-up)
```

A red gate is never silenced or downgraded — the code is redone the repo-idiomatic way (see `failure-gates.md`).

## Stage 1b — Performance budget (doc 15/08 §1.5)

- **Bundle:** record each route's *First Load JS* from the `next build` table; target **< 300 KB gzip** per route (gzip-check the route chunks in `.next/static/chunks` if unsure). Budget beats fidelity — if a route is over, cut animation weight and lower fidelity, never the reverse.
- **Real device:** open the map/challenge screens on a mid-range Android 4 GB (never the dev machine): 60 fps target, ≥ 30 fps floor, LCP < 2.5 s on 4G.
- **Motion review** (checklist from `references/animation-matrix.md`): no permanent `will-change`, Lottie lazy-loaded from `public/`, GSAP cleaned up, reduced-motion honored — toggle OS reduced-motion and re-check.

## Stage 2 — Interaction sweep on the CLONE (MCP)

Run `npm run dev` and click through the built screens the same way Phase 1 swept the original — scroll, then click, then hover. Verify against each spec's declared interactions:

- forms: validation errors appear (react-hook-form + zod), submit flows through the mock layer
- state changes (tabs, modals, menus, filters) behave as declared — via the spec-declared layer (TanStack Query / Zustand / local)
- hover/press/selected states exist
- animation runs with the tech the animation matrix assigned — smooth on the Android device, off under reduced-motion
- Vietnamese copy matches the captures verbatim

Anything undeclared that the original does = a spec gap → back to Phase 2 for that section (small loop, not a full restart).

## Stage 3 — Visual-diff sensor (diagnostic + fidelity meter, NOT a gate)

For every screen, point the sensor at the original capture vs a fresh clone screenshot (same viewport). `--target` comes from the route's `fidelityTarget` (default **90**):

```bash
node .claude/skills/web-clone/scripts/visual-diff.mjs \
  --original _webclone/captures/home/desktop.png \
  --clone    <fresh clone screenshot> \
  --out      _webclone/captures/home/diff.json \
  --diff     _webclone/captures/home/diff.png \
  --report   _webclone/captures/home/diff.md \
  --target   90
```

The report gives a **fidelity score** (100 − changed-pixel %) vs the target, and lists deviation clusters in **page coordinates** ranked **fix-first** (area × changed-ratio), flagging **likely-empty regions** (clone renders flat where the original has texture = probably a missing media slot). Diagnose each cluster: cross-reference its box against the route's `media.json` `dom.box` entries — an overlapping slot with no promoted file is a Phase 2 selection gap or a promote error; a filled slot means a layout gap for the builder. The sensor never passes or fails a screen — it builds the punch list the ascent loop (Stage 3b) works through and the human eye verifies in Stage 4.

## Stage 3b — Fidelity ascent loop (≤ 3 rounds per route)

The 90/100 rule in motion: fidelity climbs toward the route's target **while the two invariants hold** — (a) gates green (A1–A8, lint, tsc, test), (b) route < 300 KB gzip. Per route:

```
round 1..3:
  1. SENSE   — run visual-diff --target <route fidelityTarget>; read score + fix-first clusters
  2. STOP?   — score ≥ target → done · no cluster left unexplained → done
  3. FIX     — builder fixes the top-priority clusters the REPO-IDIOMATIC way
               (extract a component, flex/grid, token, higher-res variant within budget)
  4. RE-GATE — lint + tsc + test + gates + budget check.
               ANY red or budget blown → REVERT that fix, record why in the ascent log,
               mark the cluster "accepted gap" (fidelity never buys a gate violation)
  5. PLATEAU — score did not improve vs last round → stop (diminishing returns)
```

Log every round in the run report: `route · round · fidelity % · top cluster fixed · gates/budget · decision (continue / accepted gap / target reached / plateau)`. Three rounds is the hard cap — the remaining gap goes to the human verdict as explained clusters, never as silent approximations.

## Stage 4 — Side-by-side album (the human verdict)

Build `_webclone/album/index.html`: for every screen × viewport, the original capture next to a fresh screenshot of the clone (same viewport), with each screen's sensor clusters + ascent log linked beside it. The HUMAN makes the final call by eye — there is no numeric diff gate, by design. Record each verdict in the album (pass / needs-work + one-line reason).

## Definition of done — per screen checklist

- [ ] lint / tsc / test / gates green (A1–A8)
- [ ] spec satisfied, including declared state (3 layers) & validation & effect types
- [ ] every spec'd media slot promoted and rendering — or a marked TODO placeholder (class D)
- [ ] mock data wired through Zod-validated TanStack Query hooks
- [ ] route JS under 300 KB gzip (Stage 1b)
- [ ] jscpd duplication reviewed — repeats are refactors, not accepted
- [ ] ≥ 30 fps on the mid-range Android device; reduced-motion verified
- [ ] interaction sweep findings match spec declarations
- [ ] visual-diff sensor report reviewed — every likely-empty cluster explained
- [ ] fidelity ≥ route's `fidelityTarget`, OR ascent loop ran its rounds and every remaining cluster is an explained, accepted gap
- [ ] ascent log in run report (per round: score, fix, gates/budget, decision)
- [ ] album entry exists; human verdict = pass
- [ ] no credentials anywhere in repo, code, logs, or album

## Two-stage review (repo CLAUDE.md)

Before handing over: (1) **spec compliance** — does it do what the approved Design Model says; (2) **code quality** — is it clean under `coding.md`. Both reviews pass → the screen is done.

## Run report

Write `_webclone/run-report.md`: screens built, gates status, per-route bundle sizes vs budget, promoted media slots + open TODOs, sensor findings (each likely-empty cluster explained), **the per-route ascent log (target, rounds, final fidelity, accepted gaps)**, jscpd summary, device-test results, album verdicts, spec gaps found and how resolved, deferred players (v1.1). This is what the user reads first.
