# Complexity grading & clone scoring

Adapted (EN, 2026-08-19) from jane's web-clone skill — used to set expectations BEFORE recon finishes and to score the result at Phase 5. In this repo the default mode is the **twin clone (80/100)**; the table below tells you when a screen needs extra care or explicit deferral.

## Clone modes

| Mode | Goal | When it applies here |
|---|---|---|
| Twin clone (default) | ~80% visual fidelity, 100% idiomatic repo code | Every screen this skill builds |
| Effect teardown | Don't rebuild yet — first pin down the real implementation | WebGL/Canvas/complex motion; contradictory evidence — see `effect-extraction.md` |
| Deferred player | Recon now, build in v1.1 | Timer/audio/drag-drop exam players |

(Faithful byte-mirror exists in the archived upstream skill; it is deliberately NOT part of this repo's pipeline — the 80/100 rule has no pixel-gate.)

## Complexity L1–L6

| Level | Type | Typical signals | Usually recoverable | Default boundary |
|---|---|---|---|---|
| L1 | Static HTML/CSS | little JS, no framework, few pages | 90–98% | near-pixel OK; asset licensing separate |
| L2 | CMS/corporate content site | many pages, CMS-generated, forms/news | 70–90% | front-end yes; the CMS backend is never cloned |
| L3 | React/Vue/Next content front-end | hydration, chunks, routed, API-fed | 65–90% | data via local JSON mocks (network-capture fixtures) |
| L4 | Animation-heavy brand site | GSAP/Lenis, complex scroll, video masks | 50–80% | hero recoverable; micro-interactions often approximated |
| L5 | WebGL/Canvas/Three.js | shaders, physics, post-processing | 30–95% | high only with real source; otherwise teardown first |
| L6 | SaaS/ecommerce/logged-in systems | accounts, payment, orders, permissions | display layer only | server business logic never cloned |

## Pre-clone prediction template (fill during Phase 1, into `screen-inventory.md`)

```markdown
## Prediction — <route>
- Complexity: L_
- Mode: twin clone / effect teardown / deferred player
- High-fidelity parts:
- Parts to approximate or replace:
- Parts NOT cloned:
- Main risks: licensing / assets / auth state / API / perf / WebGL / responsive
```

## Post-clone scoring (Phase 5 run report)

Score each dimension 0–5. Only give a score you can back with code, screenshots, or a browser run — an unsupported score is a GUESS (see `effect-extraction.md` grading).

| Dimension | 5 | 3 | 1 |
|---|---|---|---|
| Source evidence | real source or full static assets; key claims cite file/line | runtime recon + asset harvest | eyeball + inference |
| Structure fidelity | IA, section order, breakpoints all match | main sections match, details merged/cut | only the general vibe survives |
| Visual fidelity | type, spacing, color, image ratios very close | hero close, some ratios off | visibly a different design |
| Motion/interaction | scroll/hover/video/canvas behavior close | core interactions only | essentially static |
| Responsive | desktop/tablet/mobile verified, no breakage | 1–2 widths verified | mobile clearly broken |
| Functional completeness | nav, forms, media, links, local run all work | main paths work | dead links / errors |
| Media slots | every spec'd slot promoted & rendering, TODOs listed | some slots TODO | fabricated substitutes (class D!) |
| Legal/deploy risk | license clear, trackers removed, asset boundary explicit | risks recorded, unresolved | unclear |

Suggested output block for `_webclone/run-report.md`:

```markdown
## Score — <route>
evidence / structure / visual / motion / responsive / functional / media / legal: _/5 each
Verdict (one line):
```

## Original vs clone comparison table

```markdown
| Module | Original | Clone | Trade-off | Evidence |
|---|---|---|---|---|
| Hero | | | | screenshot / file:line |
| Nav | | | | |
| Signature motion | | | | diff.md cluster #2 |
| Content sections | | | | |
| Mobile | | | | |
```
