/**
 * web-clone / gates.ts — class A structural bans (failure-gates.md), machine-checked.
 *
 * Usage (from repo root):  npm run gates        (package.json script → tsx this file)
 * Exit 0 = all gates green · exit 1 = violations found (fix the code, never the gate).
 * Line-level escape hatch: append `// clone-gate-ignore` to a line (use sparingly, review will ask).
 *
 * A1 arbitrary variants · A2 inline styles · A3 file length · A4 nesting (warn)
 * A6 layout-prop animation · A7 reduced-motion · A8 arbitrary colors   — per Công nghệ đề xuất 15/08/2026 §1.2–1.3
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = "src";
const MAX_FILE_LINES = 320; // gate A3 — components only, tests excluded
const MAX_JSX_INDENT = 12; // gate A4 heuristic: 12 leading spaces ≈ 6 nesting levels × 2
const COLOR_UTIL = /\b(?:bg|text|border|fill|stroke|from|via|to|ring|outline|shadow|decoration|divide|accent|caret|placeholder)-\[(?:#|rgb|hsl)/;
const MOTION_LAYOUT_PROP =
  /\b(?:animate|initial|exit|whileHover|whileTap|whileInView|whileFocus|whileDrag)\s*=\s*\{\{(?:(?!\}\})[\s\S])*?\b(width|height|top|left)\s*:/;
const GSAP_LAYOUT_PROP = /gsap\.\w+\([^\n]*\b(width|height|top|left)\s*:/;
const JS_ANIMATION = /from ["']framer-motion["']|<motion\.|animate\s*=\s*\{\{|<AnimatePresence/;
const REDUCED_MOTION_SIGNAL = /useReducedMotion|motion-reduce:|MotionConfig|reducedMotion|prefers-reduced-motion/;

type Violation = { gate: string; file: string; line?: number; detail: string };

const violations: Violation[] = [];
const warnings: Violation[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

for (const file of files) {
  const rel = relative(".", file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, i) => {
    if (line.includes("clone-gate-ignore")) return;

    // A1 — no Tailwind arbitrary-variant selectors ([&>, [&…
    if (line.includes("[&")) {
      violations.push({ gate: "A1", file: rel, line: i + 1, detail: "arbitrary-variant selector `[&…]` — restructure with components/tokens" });
    }
    // A2 — no inline styles
    if (line.includes("style={{")) {
      violations.push({ gate: "A2", file: rel, line: i + 1, detail: "inline style — use a @theme token or a Tailwind class" });
    }
    // A8 — no arbitrary color values; colors come from @theme tokens (Tailwind v4 CSS variables)
    if (COLOR_UTIL.test(line)) {
      violations.push({ gate: "A8", file: rel, line: i + 1, detail: "arbitrary color value — use an @theme token (globals.css), not bg-[#…]" });
    }
  });

  // A6 — animate transform/opacity only; layout props are the #1 jank cause on weak devices (doc §1.3)
  const content = lines.join("\n");
  const layoutPropMatch = content.match(MOTION_LAYOUT_PROP) ?? content.match(GSAP_LAYOUT_PROP);
  if (layoutPropMatch?.index !== undefined) {
    const lineNo = content.slice(0, layoutPropMatch.index).split("\n").length;
    if (!lines[lineNo - 1]?.includes("clone-gate-ignore")) {
      violations.push({ gate: "A6", file: rel, line: lineNo, detail: `animates layout prop \`${layoutPropMatch[1]}\` — animate transform/opacity instead (doc §1.3)` });
    }
  }

  // A7 — JS-driven animation requires reduced-motion handling (doc §1.3)
  if (JS_ANIMATION.test(content) && !REDUCED_MOTION_SIGNAL.test(content) && !content.includes("clone-gate-ignore")) {
    violations.push({ gate: "A7", file: rel, detail: "uses JS animation without reduced-motion handling — add useReducedMotion / motion-reduce: / MotionConfig" });
  }

  const isComponent = rel.includes(join("src", "components"));
  const isTest = /\.(test|spec)\.(ts|tsx)$/.test(rel) || rel.endsWith("index.ts");
  if (isComponent && !isTest && lines.length > MAX_FILE_LINES) {
    violations.push({ gate: "A3", file: rel, detail: `${lines.length} lines > ${MAX_FILE_LINES} — split the component` });
  }

  // A4 heuristic — deepest indentation as a proxy for JSX nesting. WARN only.
  const maxIndent = lines.reduce((max, l) => {
    const m = l.match(/^( +)\S/);
    return m ? Math.max(max, m[1].length) : max;
  }, 0);
  if (isComponent && !isTest && maxIndent > MAX_JSX_INDENT) {
    warnings.push({ gate: "A4?", file: rel, detail: `indent depth ${maxIndent} > ${MAX_JSX_INDENT} — likely over-nested JSX; rebuild with flex/grid` });
  }
}

// Barrel rule — every directory under src/components has an index.ts (repo coding.md)
function dirsUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => [join(dir, d.name), ...dirsUnder(join(dir, d.name))]);
}
if (existsSync(join(SRC, "components"))) {
  for (const d of dirsUnder(join(SRC, "components"))) {
    if (!existsSync(join(d, "index.ts"))) {
      violations.push({ gate: "BARREL", file: relative(".", d), detail: "missing index.ts barrel export (coding.md)" });
    }
  }
}

// A7 (global) — globals.css must honor prefers-reduced-motion (covers CSS-keyframe animations)
const globalsCss = join(SRC, "app", "globals.css");
if (existsSync(globalsCss)) {
  const css = readFileSync(globalsCss, "utf8");
  if (!REDUCED_MOTION_SIGNAL.test(css) && !css.includes("clone-gate-ignore")) {
    violations.push({ gate: "A7", file: relative(".", globalsCss), detail: "missing prefers-reduced-motion media query (doc §1.3)" });
  }
}

// ---------------------------------------------------------------------------
for (const v of warnings) console.warn(`WARN  [${v.gate}] ${v.file}${v.line ? `:${v.line}` : ""} — ${v.detail}`);
for (const v of violations) console.error(`FAIL  [${v.gate}] ${v.file}${v.line ? `:${v.line}` : ""} — ${v.detail}`);

console.log(`\n${files.length} files scanned · ${violations.length} violation(s) · ${warnings.length} warning(s)`);
if (violations.length > 0) {
  console.error("GATES RED — fix the code, not the gate (references/failure-gates.md).");
  process.exit(1);
}
console.log("GATES GREEN ✔");
