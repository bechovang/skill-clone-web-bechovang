# Phase 1 — Recon (the hybrid eye)

Two instruments, two jobs: **Playwright MCP explores** (clicks around, logs in, classifies screens, discovers interaction states), **`orchestrator.mjs` harvests** (bulk screenshots + HTML + EVERY media signal at 3 viewports, per route × state). Exploration without bulk capture doesn't scale to "every screen"; bulk capture without exploration produces classified-wrong screenshots and missed states.

## 1. Explore & inventory (MCP)

1. Open `CLONE_TARGET_URL`. Record the login flow shape and **edit the `LOGIN` block in `scripts/orchestrator.mjs`** if the selectors differ (they carry `// VERIFY` markers — this is the only Flyer-specific code in the script).
2. Log in using the `.env` credentials (typed into the browser, never printed).
3. Walk EVERY reachable screen, including behind auth: home, practice lists, challenge modes, exam history, missions, notifications, trophy/ranking, level check, handbook, teacher/parent areas. Use the sitemap (`/sitemap.xml`), nav links, and dead-end hunting.
4. For each screen run the **interaction sweep** — in this order:
   - **scroll** first (lazy sections, reveal-on-scroll animations, infinite lists)
   - then **click** (tabs, accordions, modals, menus, filter dropdowns)
   - then **hover** (tooltips, button states)
5. While sweeping, note every interaction that **reveals new media** (tab with its own illustration set, accordion body images, modal artwork) — each becomes a `states[]` entry in routes.json.
6. Write `_webclone/captures/screen-inventory.md` — one row per screen:

| Route | Auth? | Type | States (name → selector) | Interaction model | Notes |
|---|---|---|---|---|---|
| `/` | public | static | — | scroll-reveal hero | … |
| `/practice` | auth | static | `tab-missions` → `button:has-text('Nhiệm vụ')` | tabs swap media | … |
| `/exam-room/…` | auth | **player** | — | click-driven, timer/audio/drag | boss fight — record, build later (v1.1) |

`Type` ∈ `static | form | player`. Players are recorded now but **deferred to the v1.1 playbook** — recon them anyway so nothing is a surprise.

## 2. routes.json — the crawl plan

Create `_webclone/captures/routes.json` from the inventory (full schema in the orchestrator header):

```json
[
  { "slug": "home", "path": "/", "auth": true, "type": "static" },
  { "slug": "practice", "path": "/practice", "auth": true, "type": "static",
    "states": [
      { "name": "tab-missions", "action": "click", "selector": "button:has-text('Nhiệm vụ')" }
    ] }
]
```

**Slot key = route × state** (a page is a chain of states). Media that only appears after a tab click gets harvested under that state — without states the manifest lies by collapsing them into one bucket.

## 3. Bulk capture (orchestrator)

```bash
node .claude/skills/web-clone/scripts/orchestrator.mjs
```

Per route: screenshots + HTML + text at 3 viewports (1440/768/390), DOM media scan + state sweep at desktop, every network request recorded. Outputs under `_webclone/captures/`:

| Output | What it is |
|---|---|
| `{slug}/{viewport}.png/.html/.txt` | the classic capture triple |
| `{slug}/states/{state}.png` | screenshot per non-initial state |
| `{slug}/media.json` | RAW media evidence: every item with kind, states[], DOM context (tag, selector, box, alt, inSection, natural size) ∪ network record (status, contentType, bytes) |
| `storage-state.json` | session for the download pass (no credentials inside) |
| `recon.json` | script URLs for `sourcemap-hunt.mjs` + console errors |

## 4. Download pass (separate, auth-aware, content-addressed)

```bash
node .claude/skills/web-clone/scripts/download.mjs
```

Replays `storage-state.json` through a standalone API request context (login-gated CDN assets download fine), writes each unique file ONCE to `_webclone/staging/{hash2}/{sha256}.{ext}`, annotates every media.json with `hash`/`localPath`, and regenerates **`_webclone/captures/media-index.md`** — the AI-readable layer Phase 2 names slots from. Hash = stable identity: the same asset used by 5 routes is stored and counted once.

## 5. Optional probes

- `node .claude/skills/web-clone/scripts/interaction-probe.mjs --url <url> --out _webclone/captures/probe/<slug>` — when a screen's behavior is unclear (hover/click state changes, canvas interactions).
- `node .claude/skills/web-clone/scripts/network-capture.mjs --url <url> --out _webclone/captures/fixtures/<slug>` — XHR/fetch fixtures feeding Phase 2's mock layer.
- `node .claude/skills/web-clone/scripts/sourcemap-hunt.mjs --recon _webclone/captures/recon.json --out _webclone/captures/sourcemaps` — original source maps, when they exist.

## 6. Capture discipline (the 80% cascade)

- Capture **layout intent** — structure, hierarchy, spacing scale, breakpoints. Do NOT dump per-element computed styles; the 80% bar makes them noise.
- Tag evidence as you go: **SOURCE** (seen in capture/MCP), **PARTIAL** (inferred from responsive variants), **GUESS** (reconstructed). Guesses must be marked so Phase 2 can flag them for the human reviewer. Full discipline: `references/effect-extraction.md`.
- Vietnamese copy is captured **verbatim** — no translation, no paraphrase.
- **Media completeness check** before closing the phase: scan `media-index.md` for kinds you expected but didn't land (video? font? lottie-json?) and for `network-only` items with no DOM context — an icon sheet or sprite the DOM scan can't attribute. If a kind is missing, the interaction sweep missed a state: fix routes.json and re-run, don't hand-wave.

## Done when

Inventory covers every reachable screen (incl. players, marked deferred) · routes.json declares every media-revealing state · captures exist for every non-player route at 3 viewports · `media.json` exists per route with hashes filled · `media-index.md` generated and its completeness check passed · evidence tags present. → Phase 2.
