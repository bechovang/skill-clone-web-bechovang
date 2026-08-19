#!/usr/bin/env node
/**
 * web-clone / promote.mjs — ship-select (R4): capture-all ≠ ship-all.
 *
 * Runs AFTER Phase 2 names the slots. Reads the AI-authored selection file,
 * copies each chosen asset out of the content-hash store into
 * `public/clone-assets/{route}/{slot}.{ext}` (the filesystem IS the shipped
 * manifest, R1), and reports per-route bytes against the 300 KB media budget
 * warning line. The hard route-JS budget gate stays in Phase 5 — this is the
 * media-side early warning.
 *
 * Usage (repo root):   node .claude/skills/web-clone/scripts/promote.mjs
 *   --selections <f>   default _webclone/design-model/media-selections.json
 *   --out <dir>        captures dir (holds {route}/media.json)  default _webclone/captures
 *   --assets <dir>     destination                            default public/clone-assets
 *   --warn-bytes <n>   per-route warn threshold                default 300000
 *
 * media-selections.json (authored in Phase 2 — semantic slot names live HERE):
 *   [ { "route": "home", "slot": "hero-main", "url": "https://…/hero.webp" },
 *     { "route": "home", "slot": "logo-footer", "hash": "ab12cd34…" } ]
 * `url` (preferred, copy-stable) or `hash` selects from the route's media.json.
 */

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = {
    selections: "_webclone/design-model/media-selections.json",
    outDir: "_webclone/captures",
    assetsDir: "public/clone-assets",
    warnBytes: 300_000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--selections") out.selections = argv[++i] || out.selections;
    else if (arg === "--out") out.outDir = argv[++i] || out.outDir;
    else if (arg === "--assets") out.assetsDir = argv[++i] || out.assetsDir;
    else if (arg === "--warn-bytes") out.warnBytes = Number(argv[++i] || "300000");
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadMediaForRoute(outDir, route) {
  const file = path.join(outDir, route, "media.json");
  if (!fs.existsSync(file)) {
    throw new Error(`No media.json for route '${route}' (${file}) — run orchestrator.mjs + download.mjs first`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("node .claude/skills/web-clone/scripts/promote.mjs [--selections f] [--out dir] [--assets dir] [--warn-bytes n]");
    return;
  }
  const selections = JSON.parse(fs.readFileSync(args.selections, "utf8"));
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error(`${args.selections} is empty — Phase 2 fills it (schema in the script header)`);
  }

  const mediaByRoute = new Map(); // route -> media.json (lazy)
  const promoted = []; // rows for the shipped manifest
  const errors = [];
  const routeBytes = new Map();

  for (const selection of selections) {
    const { route, slot } = selection;
    if (!route || !slot || !(selection.url || selection.hash)) {
      errors.push(`selection needs route + slot + (url|hash): ${JSON.stringify(selection).slice(0, 80)}`);
      continue;
    }
    try {
      if (!mediaByRoute.has(route)) mediaByRoute.set(route, loadMediaForRoute(args.outDir, route));
      const media = mediaByRoute.get(route);
      const item = media.items.find((candidate) =>
        selection.hash ? candidate.hash === selection.hash : candidate.url === selection.url,
      );
      if (!item) {
        errors.push(`${route}/${slot}: not found in media.json (${selection.hash || selection.url})`);
        continue;
      }
      if (!item.localPath || !fs.existsSync(item.localPath)) {
        errors.push(`${route}/${slot}: staged file missing (${item.localPath || "never downloaded"}) — run download.mjs`);
        continue;
      }
      const ext = path.extname(item.localPath).slice(1) || "bin";
      const destDir = path.join(args.assetsDir, route);
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, `${slot}.${ext}`);
      fs.copyFileSync(item.localPath, dest);
      const relDest = dest.replaceAll("\\", "/");
      routeBytes.set(route, (routeBytes.get(route) || 0) + item.bytes);
      promoted.push({
        route,
        slot,
        file: relDest,
        bytes: item.bytes,
        kind: item.kind,
        hash: item.hash,
        source: item.url,
        natural: item.dom ? `${item.dom.naturalW || "?"}×${item.dom.naturalH || "?"}` : "",
      });
      console.log(`  ok  ${relDest} (${formatBytes(item.bytes)})`);
    } catch (error) {
      errors.push(`${route}/${slot}: ${error.message}`);
    }
  }

  // The shipped manifest — committed with the clone, maps slot → file.
  fs.mkdirSync(args.assetsDir, { recursive: true });
  fs.writeFileSync(path.join(args.assetsDir, "manifest.json"), `${JSON.stringify(promoted, null, 2)}\n`);

  console.log(`\nPromoted ${promoted.length} slot(s) → ${args.assetsDir}. ${errors.length} error(s).`);
  for (const [route, bytes] of routeBytes) {
    const flag = bytes > args.warnBytes ? "  ⚠ OVER media budget line" : "";
    console.log(`  ${route}: ${formatBytes(bytes)} promoted${flag}`);
  }
  if (errors.length > 0) {
    console.error("Errors:\n" + errors.join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
