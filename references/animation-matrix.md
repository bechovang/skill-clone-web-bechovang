# Animation Matrix — pick tech by effect type, never one library for everything

Source of truth: Công nghệ đề xuất 15/08/2026 §1.2–1.3. The stack block in `.claude/ARCHITECTURE.md` points here.

## The one rule

**CSS and SVG first.** Add a library only when CSS cannot do it. Every library is more bundle weight and one more thing to maintain — and the 300 KB gzip budget beats visual fidelity (locked precedence).

## Effect type → tech

| Effect in this project | Tech | Added weight |
|---|---|---|
| Micro-interactions: buttons, modals, page transitions, list enter/exit | **Framer Motion** | ~30 KB gz |
| Multi-step timelines: level-unlock chains, reward sequences | **GSAP** (free incl. SplitText/MorphSVG/ScrollTrigger since Webflow) | ~27 KB core |
| **Depth carousel** (planet picker rotated by arrow buttons) | **CSS 3D transforms** — `perspective`, `rotateY`, `translateZ`. NOT WebGL: "rotatable 3D planet" is a perspective carousel, 3–5 days, not 4–8 weeks of React Three Fiber + 3D artist | **0 KB** |
| **Challenge map** (round nodes joined by a path) | **SVG** + `stroke-dashoffset` animation | **0 KB** |
| Mascots, badges, reward effects | **Lottie** (dotLottie web component) | ~40 KB + JSON files |
| Particles, many moving bodies at once | **PixiJS** (WebGL 2D) — only with explicit justification in the spec | ~150 KB |
| True 3D, free rotation | **React Three Fiber** — out of scope for clones; requires a 3D artist | ~600 KB |

**Lottie JSON files are assets** (Phase 1 harvests them verbatim into `public/clone-assets/`); the *timeline code* of the original site is NOT — re-implement it with whatever this matrix picks. Fidelity is visual, not technological.

## How a run uses this (Phase 2 → Phase 3)

1. The section spec (Phase 2) declares each interaction's **effect type** from the table above.
2. The matrix — not the builder — decides the tech. Builders do not choose animation libraries.
3. Any library a chunk needs that is not yet installed goes into the spec's **budget request**, with its weight from the table. The dispatcher approves against the route's remaining budget before Phase 3 fan-out.
4. Phase 5 confirms: gates green, bundle measured, motion reviewed on a real mid-range Android.

## Three performance rules (machine-checked as gates A6/A7)

1. **Animate only `transform` and `opacity`.** They run on the GPU. Animating `width`/`height`/`top`/`left` is the #1 jank cause — gate **A6**.
2. **`will-change` selectively, removed after the animation ends.** Abuse drains GPU memory on 4 GB Android devices.
3. **Respect `prefers-reduced-motion`.** Motion off for users who asked for it — gate **A7** (`globals.css` media query + `useReducedMotion`/`motion-reduce:`/`MotionConfig` in JS-animated files).

## Review checklist (not machine-checkable — human eyes in Phase 5)

- [ ] No `will-change` left permanently on any element
- [ ] Lottie/dotLottie files lazy-loaded from `public/` — never inlined into the JS bundle
- [ ] GSAP effects cleaned up (`useGSAP` return/`ctx.revert()`) — no leaked tweens on unmount
- [ ] Carousel/map effects run at 60 fps (≥ 30 fps floor) on the mid-range Android test device

## Budget guardrails

| Metric | Threshold |
|---|---|
| JS bundle per route | < 300 KB gzip — wins over fidelity |
| LCP on 4G | < 2.5 s |
| Map/challenge screen | 60 fps target · ≥ 30 fps mandatory |
| Acceptance device | Mid-range Android, 4 GB RAM — never the dev's machine |
