#!/usr/bin/env node
/**
 * web-clone / orchestrator.mjs — the merged capture pipeline (2026-08-19 media layer).
 *
 * Replaces the old capture.ts: per route × state × viewport it settles the page,
 * records EVERY network request (CDP-equivalent via Playwright events) AND scans
 * the DOM for every media surface (img/srcset/picture/video/audio/poster/inline
 * svg/computed background incl. pseudo-elements/@font-face), then emits RAW
 * evidence. Semantic slot naming is NOT this script's job — the AI does it in
 * Phase 2 from this evidence (intent doc §2.3 / R3).
 *
 * Usage (repo root):   node .claude/skills/web-clone/scripts/orchestrator.mjs
 *   --routes <file>    default _webclone/captures/routes.json
 *   --out <dir>        default _webclone/captures
 *   --viewports all    default: all 3 (desktop/tablet/mobile); "desktop" = fast pass
 *
 * Reads .env: CLONE_TARGET_URL, CLONE_LOGIN_PHONE, CLONE_LOGIN_PASSWORD
 *            (credentials are never printed or written to any output)
 * Writes per route:  {out}/{slug}/desktop|tablet|mobile.png/.html/.txt
 *                    {out}/{slug}/states/{state}.png          (non-initial states)
 *                    {out}/{slug}/media.json                  (raw media evidence)
 * Writes global:     {out}/storage-state.json                 (for download.mjs)
 *                    {out}/recon.json                         (sourcemap-hunt input)
 *
 * routes.json schema:
 *   [{ "slug": "home", "path": "/", "auth": true, "type": "static",
 *      "states": [ { "name": "tab-lessons", "action": "click",
 *                    "selector": "button:has-text('Lessons')" } ] }]
 *   `states` is optional — a route without it captures the initial state only.
 */

import fs from "node:fs";
import path from "node:path";
import { loadPlaywright, launchChromium } from "./lib/playwright-loader.mjs";

// ---------------------------------------------------------------------------
// CONFIG — the only Flyer-specific block; verify selectors in Phase 1 explore.
// ---------------------------------------------------------------------------
const LOGIN = {
  path: "/login",
  phoneInput: 'input[name="identifier"]', // VERIFY
  passwordInput: 'input[type="password"]', // VERIFY
  submitButton: 'button[type="submit"]', // VERIFY
};

const VIEWPORTS = {
  desktop: { name: "desktop", width: 1440, height: 900 },
  tablet: { name: "tablet", width: 768, height: 1024 },
  mobile: { name: "mobile", width: 390, height: 844 },
};

const OUT_DIR_DEFAULT = "_webclone/captures";
const MEDIA_KIND = {
  image: "image",
  video: "video",
  audio: "audio",
  font: "font",
  json: "json",
  css: "css",
  other: "other",
};

function parseArgs(argv) {
  const out = { routes: "", outDir: OUT_DIR_DEFAULT, viewports: "all" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--routes") out.routes = argv[++i] || "";
    else if (arg === "--out") out.outDir = argv[++i] || OUT_DIR_DEFAULT;
    else if (arg === "--viewports") out.viewports = argv[++i] || "all";
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function loadEnv() {
  const target = process.env.CLONE_TARGET_URL;
  if (!target) {
    console.error("Missing CLONE_TARGET_URL — see references/phase-0-setup.md");
    process.exit(1);
  }
  return { target, phone: process.env.CLONE_LOGIN_PHONE, password: process.env.CLONE_LOGIN_PASSWORD };
}

function classify(url, contentType = "", resourceType = "") {
  const ct = contentType.toLowerCase();
  if (ct.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url)) return MEDIA_KIND.image;
  if (ct.startsWith("video/") || /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url)) return MEDIA_KIND.video;
  if (ct.startsWith("audio/") || /\.(mp3|ogg|wav|m4a)(\?|$)/i.test(url)) return MEDIA_KIND.audio;
  if (ct.startsWith("font/") || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return MEDIA_KIND.font;
  if (ct.includes("json") || /\.json(\?|$)/i.test(url)) return MEDIA_KIND.json;
  if (ct.includes("css") || resourceType === "stylesheet") return MEDIA_KIND.css;
  return MEDIA_KIND.other;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// In-page collectors. Everything below runs in the BROWSER (page.evaluate).
// ---------------------------------------------------------------------------

const DOM_SCAN = () => {
  const MAX_BG_ELEMENTS = 4000;
  const seen = new Map(); // normalized url -> dom record
  const abs = (value) => {
    try {
      const u = new URL(value, location.href);
      u.hash = "";
      if (u.protocol === "data:") return value.slice(0, 64); // data URIs: mark, download.mjs skips
      return u.toString();
    } catch {
      return "";
    }
  };
  const selectorFor = (node) => {
    if (node.id && !/\s/.test(node.id)) return `#${CSS.escape(node.id)}`;
    const parts = [];
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const sameTag = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      parts.unshift(`${tag}:nth-of-type(${sameTag.indexOf(current) + 1})`);
      current = parent;
    }
    return parts.join(" > ");
  };
  const inSection = (node) => {
    let el = node.closest("section,header,footer,main,nav,aside,[role='region']");
    if (!el) return "";
    const heading = el.querySelector("h1,h2,h3");
    const label = (heading?.innerText || el.getAttribute("aria-label") || el.tagName.toLowerCase() || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
    return label;
  };
  const record = (url, info) => {
    if (!url || url.startsWith("data:") === false && !/^https?:/.test(url)) return;
    const key = url.startsWith("data:") ? `data:${url}` : url;
    if (!seen.has(key)) seen.set(key, info);
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x + window.scrollX),
      y: Math.round(r.y + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  };

  // <img> — src/currentSrc/srcset/natural size/alt
  document.querySelectorAll("img").forEach((img) => {
    const url = abs(img.currentSrc || img.src);
    if (!url) return;
    record(url, {
      tag: "img",
      selector: selectorFor(img),
      box: box(img),
      naturalW: img.naturalWidth || 0,
      naturalH: img.naturalHeight || 0,
      alt: (img.alt || "").slice(0, 120),
      ariaLabel: (img.getAttribute("aria-label") || "").slice(0, 120),
      inSection: inSection(img),
      origin: "attr",
      srcset: (img.srcset || "").slice(0, 500),
    });
  });

  // <picture><source srcset>
  document.querySelectorAll("picture source[srcset]").forEach((source) => {
    const first = (source.srcset || "").split(",")[0]?.trim().split(/\s+/)[0] || "";
    const url = abs(first);
    if (!url) return;
    record(url, {
      tag: "picture-source",
      selector: selectorFor(source.parentElement || source),
      box: box(source.parentElement || source),
      inSection: inSection(source),
      origin: "srcset",
      media: source.media || "",
      srcset: (source.srcset || "").slice(0, 500),
    });
  });

  // <video> + poster + <source> children ; <audio> likewise
  document.querySelectorAll("video, audio").forEach((media) => {
    const tag = media.tagName.toLowerCase();
    const sources = [media.src, ...Array.from(media.querySelectorAll("source")).map((s) => s.src)].filter(Boolean);
    sources.forEach((src) => {
      const url = abs(src);
      if (url) record(url, { tag, selector: selectorFor(media), box: box(media), inSection: inSection(media), origin: "attr" });
    });
    if (tag === "video" && media.poster) {
      const url = abs(media.poster);
      if (url) record(url, { tag: "video-poster", selector: selectorFor(media), box: box(media), inSection: inSection(media), origin: "attr" });
    }
  });

  // Inline <svg> worth harvesting (decorative icons stay inline — record only the big ones)
  let svgCount = 0;
  document.querySelectorAll("svg").forEach((svg) => {
    const r = svg.getBoundingClientRect();
    if (r.width < 96 || r.height < 96) return;
    if (svgCount >= 20) return;
    svgCount += 1;
    record(`inline-svg:${selectorFor(svg)}`, {
      tag: "inline-svg",
      selector: selectorFor(svg),
      box: box(svg),
      inSection: inSection(svg),
      origin: "inline",
      outerLength: svg.outerHTML.length,
    });
  });

  // Computed background images, including ::before/::after
  let walked = 0;
  for (const el of document.querySelectorAll("*")) {
    if (walked >= MAX_BG_ELEMENTS) break;
    walked += 1;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    for (const pseudo of [null, "::before", "::after"]) {
      const style = getComputedStyle(el, pseudo);
      const bg = style.backgroundImage || "";
      if (!bg || bg === "none" || !bg.includes("url(")) continue;
      for (const match of bg.matchAll(/url\((['"]?)(.*?)\1\)/g)) {
        const url = abs(match[2]);
        if (!url) continue;
        record(url, {
          tag: pseudo ? `${el.tagName.toLowerCase()}${pseudo}` : el.tagName.toLowerCase(),
          selector: selectorFor(el),
          box: box(el),
          inSection: inSection(el),
          origin: pseudo ? "bg-pseudo" : "bg",
        });
      }
    }
  }

  // @font-face via CSSOM (cross-origin sheets throw — guarded)
  const fonts = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet without CORS — network layer still sees the woff2
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue("font-family") || "";
      const src = rule.style.getPropertyValue("src") || "";
      for (const match of src.matchAll(/url\((['"]?)(.*?)\1\)/g)) {
        const url = abs(match[2]);
        if (url) fonts.push({ url, family: family.replace(/['"]/g, "").slice(0, 80), origin: "fontface" });
      }
    }
  }

  return { items: [...seen.entries()].map(([url, info]) => ({ url, ...info })), fonts, iframes: document.querySelectorAll("iframe").length };
};

// ---------------------------------------------------------------------------
async function loginOnce(page, env) {
  if (!env.phone || !env.password) {
    console.log("No CLONE_LOGIN_PHONE/PASSWORD — capturing public routes only.");
    return;
  }
  await page.goto(new URL(LOGIN.path, env.target).toString(), { waitUntil: "load" });
  await page.fill(LOGIN.phoneInput, env.phone);
  await page.fill(LOGIN.passwordInput, env.password);
  await page.click(LOGIN.submitButton);
  await page.waitForTimeout(3000);
}

async function settle(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 150);
    });
  });
  await page.waitForTimeout(600);
}

/**
 * Merge one DOM-scan result into the route's evidence map.
 * Key = normalized URL (or inline-svg marker). States accumulate; DOM fields
 * keep the FIRST non-empty value seen (natural sizes are stable per asset).
 */
function mergeDomScan(evidence, scan, stateName) {
  for (const item of scan.items) {
    const key = normalizeUrl(item.url);
    const existing = evidence.get(key);
    if (existing) {
      if (!existing.states.includes(stateName)) existing.states.push(stateName);
      for (const [field, value] of Object.entries(item)) {
        if (value && (existing.dom[field] === undefined || existing.dom[field] === "")) existing.dom[field] = value;
      }
    } else {
      const { url, ...dom } = item;
      evidence.set(key, { url, kind: classify(url), states: [stateName], dom });
    }
  }
  for (const font of scan.fonts) {
    const key = normalizeUrl(font.url);
    const existing = evidence.get(key);
    if (existing) {
      if (!existing.states.includes(stateName)) existing.states.push(stateName);
      existing.dom.family = existing.dom.family || font.family;
    } else {
      const { url, ...dom } = font;
      evidence.set(key, { url, kind: MEDIA_KIND.font, states: [stateName], dom });
    }
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("node .claude/skills/web-clone/scripts/orchestrator.mjs [--routes f] [--out dir] [--viewports all|desktop]");
    return;
  }
  const env = loadEnv();
  const routesFile = args.routes || path.join(args.outDir, "routes.json");
  const routes = JSON.parse(fs.readFileSync(routesFile, "utf8"));
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error(`${routesFile} is empty — fill it during Phase 1 (schema in the script header)`);
  }
  const viewportKeys = args.viewports === "desktop" ? ["desktop"] : Object.keys(VIEWPORTS);

  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const { chromium } = loadPlaywright();
  const browser = await launchChromium(chromium);
  const context = await browser.newContext();
  const page = await context.newPage();

  // Network layer — attached for the whole run; every request recorded.
  const network = new Map(); // normalized url -> network record
  let currentState = "initial";
  let currentRoute = "";
  const consoleErrors = [];
  const allScripts = new Set();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error).slice(0, 200)));
  page.on("request", (request) => {
    if (request.resourceType() === "script") allScripts.add(request.url());
  });
  page.on("response", (response) => {
    const url = normalizeUrl(response.url());
    if (url.startsWith("data:")) return;
    const headers = response.headers();
    const bytes = Number(headers["content-length"] || 0);
    const existing = network.get(url);
    const record = {
      url,
      status: response.status(),
      resourceType: response.request().resourceType(),
      contentType: headers["content-type"] || "",
      bytes,
      route: currentRoute,
      state: currentState,
    };
    if (!existing || (bytes > existing.bytes && existing.bytes === 0)) network.set(url, record);
  });

  if (routes.some((route) => route.auth)) await loginOnce(page, env);

  const failures = [];
  for (const route of routes) {
    const url = new URL(route.path, env.target).toString();
    const routeDir = path.join(outDir, route.slug);
    fs.mkdirSync(routeDir, { recursive: true });
    const evidence = new Map();
    currentRoute = route.slug;

    for (const key of viewportKeys) {
      const vp = VIEWPORTS[key];
      currentState = "initial";
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(url, { waitUntil: "load", timeout: 45_000 });
        await settle(page);
        await page.screenshot({ path: path.join(routeDir, `${vp.name}.png`), fullPage: true });
        fs.writeFileSync(path.join(routeDir, `${vp.name}.html`), await page.content(), "utf8");
        fs.writeFileSync(path.join(routeDir, `${vp.name}.txt`), await page.evaluate(() => document.body.innerText), "utf8");

        if (key === "desktop") {
          mergeDomScan(evidence, await page.evaluate(DOM_SCAN), "initial");

          // State chain — interactions defined in routes.json (R2: slot key = route × state)
          for (const state of route.states || []) {
            currentState = state.name;
            try {
              await page.locator(state.selector).first().click({ timeout: 4000 });
              await page.waitForTimeout(800);
              fs.mkdirSync(path.join(routeDir, "states"), { recursive: true });
              await page.screenshot({ path: path.join(routeDir, "states", `${state.name}.png`), fullPage: true });
              mergeDomScan(evidence, await page.evaluate(DOM_SCAN), state.name);
            } catch (error) {
              failures.push(`${route.slug} state '${state.name}': ${error.message}`);
            }
          }
        }
        console.log(`  ok  ${route.slug} [${vp.name}]${route.type === "player" ? " (player — build deferred v1.1)" : ""}`);
      } catch (error) {
        failures.push(`${route.slug} [${key}]: ${error.message}`);
        console.error(`FAIL  ${route.slug} [${key}] — ${error.message}`);
      }
    }

    // media.json — network ∪ DOM, per route. Raw evidence only (R3).
    const items = [...evidence.values()].map((entry) => ({
      ...entry,
      network: network.get(normalizeUrl(entry.url)) || null,
    }));
    for (const [url, record] of network) {
      const kind = classify(url, record.contentType, record.resourceType);
      if (![MEDIA_KIND.image, MEDIA_KIND.video, MEDIA_KIND.audio, MEDIA_KIND.font, MEDIA_KIND.json].includes(kind)) continue;
      if (evidence.has(url)) continue;
      evidence.set(url, { url, kind, states: [record.state], dom: null });
      items.push({ url, kind, states: [record.state], dom: null, network: record });
    }
    const manifest = {
      route: route.slug,
      path: route.path,
      url,
      capturedAt: new Date().toISOString(),
      canonicalViewport: "desktop",
      states: ["initial", ...(route.states || []).map((state) => state.name)],
      note: "RAW evidence — Phase 2 assigns semantic slot names (R3); download.mjs adds hash/localPath.",
      mediaCount: items.length,
      items,
    };
    fs.writeFileSync(path.join(routeDir, "media.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`       media.json — ${items.length} item(s)`);
  }

  await context.storageState({ path: path.join(outDir, "storage-state.json") });
  const recon = {
    url: env.target,
    capturedAt: new Date().toISOString(),
    note: "compat shape for sourcemap-hunt.mjs",
    captures: [{ url: env.target, signals: { scripts: [...allScripts] } }],
    consoleErrors: [...new Set(consoleErrors)].slice(0, 50),
  };
  fs.writeFileSync(path.join(outDir, "recon.json"), `${JSON.stringify(recon, null, 2)}\n`);

  await browser.close();
  console.log(`\nOrchestrated ${routes.length} route(s) × ${viewportKeys.length} viewport(s). ${failures.length} failure(s).`);
  if (failures.length > 0) {
    console.error("Failures:\n" + failures.join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
