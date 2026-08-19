# Phase 4 — Assembly

Merge the chunk branches back into the working branch, deterministically.

## Order

1. Merge foundation-related branches first if any straggler exists (normally all in main by end of 3a).
2. Merge section chunk branches one at a time, in dependency order (chunks.md lists dependencies): shared-consumers after their providers.
3. After EACH merge: `npm run lint && npx tsc --noEmit && npm run gates`. A merge that breaks a gate is fixed immediately — never "merge everything, fix at the end".

## Conflicts

Expected only in barrel `index.ts` files and `src/constants/index.ts` (ROUTES). Resolve by keeping BOTH sides' entries. Any other conflict means chunks.md violated mutual exclusivity — fix the chunk map, re-dispatch that chunk, and note the lesson in the spec.

## Wiring

- `src/constants/index.ts` — every route added to `ROUTES`.
- `src/app/sitemap.ts` — public routes added; auth-gated routes excluded.
- Every `page.tsx` carries full metadata (title, description, keywords, alternates, openGraph) per `coding.md` — use the `seo-metadata` skill.
- Clean up worktrees: `git worktree remove ../wtc-<chunk-id>` + delete merged branches.

## Final build

```bash
npm run build   # must pass clean
```

A failing production build after green lint/tsc usually means a client/server boundary mistake (browser APIs in a server component) — fix at the component, not by sprinkling `"use client"` blindly.

## Done when

All chunks merged · ROUTES/sitemap/metadata wired · `npm run build` green · worktrees cleaned. → Phase 5.
