# Phase 0 — Setup

One-time environment prep. Verify each item; do not "assume it's there".

## Dependencies

```bash
npm install                       # base — react-hook-form, playwright, eslint-plugin-jsx-a11y, tsx already in deps
npx playwright install chromium   # headless browser binary
```

Register `eslint-plugin-jsx-a11y` in `eslint.config.mjs` (flat config). Confirm with `npm run lint` on a clean tree.

## Browser MCP (the exploration eye)

Check whether a Playwright/Chrome DevTools MCP is connected. If not:

```bash
claude mcp add playwright -- npx @playwright/mcp@latest
```

then restart the session. If MCP genuinely cannot be added, Phase 1 still works via `scripts/orchestrator.mjs` alone + `WebFetch` for text exploration — flag the degraded mode to the user and proceed.

## Codegraph

Repo `CLAUDE.md` hard rule: all project-data reads go through Codegraph. If the MCP is unresponsive: run `codegraph init` and wait for indexing. If unavailable entirely, fall back to Grep → Glob → Read per `.claude/rules/extension-fallback.md` — and say so.

## Credentials

Create `.env` at repo root (git-ignored already — verify `.gitignore` contains `.env`):

```
CLONE_TARGET_URL=https://exam.flyer.us
CLONE_LOGIN_PHONE=<from user, never committed>
CLONE_LOGIN_PASSWORD=<from user, never committed>
```

Rules: never echo these values into logs, specs, commits, or chat. Ask the user once; they own the account.

## Work directories

```bash
mkdir -p _webclone/captures _webclone/staging _webclone/design-model _webclone/album
```

Append to `.gitignore`:

```
_webclone/captures/
_webclone/staging/
_webclone/album/
```

(`_webclone/design-model/` stays committed — it is reviewed via PR and reused by future runs.)

## Smoke test

```bash
npm run dev        # boots on :3000 with the placeholder page
npm run lint       # 0 errors
npx tsc --noEmit   # clean
npm run gates      # GATES GREEN
```

All green → Phase 0 done. Any red → stop and fix before recon; every later phase assumes this baseline.
