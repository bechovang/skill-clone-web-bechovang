# Effect extraction — evidence discipline + baseline gate (WebGL/Canvas branch)

Adapted (EN, 2026-08-19) from jane's web-clone skill. When a screen's signature effect is WebGL/Canvas/complex motion, the danger is not "can't build it" — it is **believing a wrong theory of how it works**. Three disciplines, in order: evidence grading → no-compensation → baseline-first.

## 1. Evidence grading (tag EVERY claim)

Every key fact about the rendering pipeline gets a level, and **untagged = GUESS**:

| Tag | Meaning | Examples |
|---|---|---|
| `SOURCE` | direct, bound-to-target hard evidence | real source lines, source-mapped modules (`sourcemap-hunt.mjs`), runtime object dumps, captured shader/WGSL text, frame captures, network response bodies (hash-staged) |
| `PARTIAL` | a lead, not a conclusion | class/function/field names, minified bundle slices, a shader without its uniforms/passes/input state |
| `GUESS` | reconstruction without direct evidence | visual curve-fitting, naming inference, default values, hand-tuned magic numbers, any "looks right" behavior rebuild |

A GUESS-level implementation must be upgraded to SOURCE before it is copied as truth. This institutionalizes the marbles lesson from the upstream skill: an AI analysis once hallucinated "ray-marching + SDF" over what was really analytic ray-sphere intersection feeding an SVG `feDisplacementMap` — two completely different architectures; copying the wrong one fails and runs N× slower.

## 2. No-compensation (never tune away a misunderstanding)

> It is FORBIDDEN to tweak brightness/speed/position/noise until the picture "looks right" in order to hide a real error in timing, coordinates, color pipeline, FBOs, or state model.

- A fitted constant that improves the output is still a GUESS — write down what evidence would upgrade it.
- Wiring facts (pass order, coordinate transforms, time units, input coupling) are not validated by "it looks similar" — trace each to evidence.
- If something cannot be verified, SAY SO in the spec/run report. Never fabricate "drag works".

## 3. Baseline-first gate (reproduce raw, then restructure)

The classic failure: extract + rewrite + beautify simultaneously, ending up neither faithful nor explainable. Stage it instead:

```
locate render surface → capture minimal truth → RAW REPLAY (smallest as-is reproduction)
                                        ↓ passes frame-by-frame comparison
                              PROJECTIZE (restructure into maintainable code)
```

- **RAW REPLAY**: a minimal runnable reproduction using the real captured draw calls / shaders / uniforms / vertex data. No optimization, no framework swap, no parameter changes.
- **Baseline gate**: the RAW REPLAY must match the original frame-by-frame (or sampled frames) BEFORE any restructuring is allowed.
- **Projectize**: only then rewrite in the repo's idioms (this is also where the 90/100 ascent rule and gates A6/A7 apply — transform/opacity only, reduced-motion honored).
- Close with an honest status: `DONE_BASELINE_VERIFIED` / `DONE_PROJECTIZED` / `DONE_BASELINE_WITH_GAPS` (gaps listed).

## 4. Runtime capture fallback (when no source exists)

The first move is always real source (GitHub search, `sourcemap-hunt.mjs`). Effect sites are often source-less and minified to the bone. The fallback is NOT "write what it looks like" (that is GUESS) — capture the runtime truth at the render boundary:

- Intercept the WebGL/WebGPU context: actual draw calls, bound programs, compiled shader sources, uniform values, FBO/texture sizes, blend/depth state.
- Tool directions: spector.js-style frame capture, patching `WebGLRenderingContext` prototypes to log calls, `getShaderSource` for compiled shaders, preload-script hooks injected before page scripts.
- Captured artifacts are `SOURCE`-level — they become the new "real source" feeding the baseline-first flow.

## 5. When to delegate

If a dedicated extractor skill is installed (e.g. `web-shader-extractor`), hand the effect slice to it when: the site is WebGL/WebGPU/heavy-Canvas AND no source was found AND you need frame-level capture/comparison. This skill stays the orchestrator; the delegation returns a minimal baseline + evidence pack that re-enters Phase 2 as SOURCE evidence. Without such a skill, sections 1–4 above are the complete discipline.

## Integration with this repo's pipeline

- Evidence tags live in the section spec's grading table and the run report — same `SOURCE/PARTIAL/GUESS` vocabulary Phase 1 uses.
- Baseline reproductions live under `_webclone/captures/baseline/<slug>/` next to the original screenshots (git-ignored).
- The visual-diff sensor (Phase 5) provides the frame comparison for the baseline gate: original capture vs RAW REPLAY screenshot, cluster report as the verdict basis — human confirms.
