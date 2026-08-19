#!/usr/bin/env node
/**
 * web-clone / visual-diff.mjs — the diagnostic SENSOR + fidelity meter
 * (2026-08-19 sensor role; 2026-08-20 adds the score under the 90/100 ascent rule).
 *
 * Compares original vs clone screenshots in a real browser canvas, then reports
 * WHERE the deviations are: changed-pixel clusters as page-coordinate boxes,
 * plus an empty-render heuristic per cluster (clone side uniformly flat while
 * the original has texture = probably a MISSING MEDIA slot).
 *
 * It also computes a fidelity score = 100 − changedPixel% and compares it to
 * --target (default 90). The score is the PROGRESS METER of the Phase 5
 * ascent loop — it is STILL NOT A GATE: gates are code quality + budget,
 * and the final verdict belongs to the human eye. Clusters are ranked by
 * priority (area × changed-ratio) so the ascent loop knows what to fix first.
 * Cluster boxes cross-reference media.json `dom.box` fields (route manifest).
 *
 * Usage (repo root):
 *   node .claude/skills/web-clone/scripts/visual-diff.mjs \
 *     --original _webclone/captures/home/desktop.png \
 *     --clone    .tmp/clone-home/desktop.png \
 *     --out      _webclone/captures/home/diff.json \
 *     --diff     _webclone/captures/home/diff.png \
 *     --report   _webclone/captures/home/diff.md \
 *     --target   90
 *
 * --report (markdown sensor report) is optional but recommended.
 */

import fs from "node:fs";
import path from "node:path";
import { loadPlaywright, launchChromium } from "./lib/playwright-loader.mjs";

const BLOCK = 16; // cluster grid resolution (px) — smaller = finer clusters
const MIN_CELLS = 4; // clusters below this many cells count as noise
const MAX_CLUSTERS = 12; // report the biggest N

function parseArgs(argv) {
  const out = { original: "", clone: "", out: "visual-diff.json", diff: "", report: "", threshold: 0.08, target: 90 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--original") out.original = argv[++i] || "";
    else if (arg === "--clone") out.clone = argv[++i] || "";
    else if (arg === "--out") out.out = argv[++i] || out.out;
    else if (arg === "--diff") out.diff = argv[++i] || "";
    else if (arg === "--report") out.report = argv[++i] || "";
    else if (arg === "--threshold") out.threshold = Number(argv[++i] || "0.08");
    else if (arg === "--target") out.target = Number(argv[++i] || "90");
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function imageDataUrl(file) {
  const ext = path.extname(file).slice(1).toLowerCase() || "png";
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

function sensorReport(result) {
  const gap = Math.round((result.target - result.fidelity) * 10) / 10;
  const lines = [
    "# Visual-diff sensor report — DIAGNOSTIC + FIDELITY METER, not a gate",
    "",
    `- Original: \`${result.files.original}\` (${result.original.width}×${result.original.height})`,
    `- Clone: \`${result.files.clone}\` (${result.clone.width}×${result.clone.height})`,
    `- diffPixelRatio: **${(result.diffPixelRatio * 100).toFixed(2)}%** · meanAbsDiff: ${result.meanAbsDiff.toFixed(4)} · noise cells: ${result.clusters.noiseCells}`,
    `- **fidelity: ${result.fidelity}% / target ${result.target}** — ${gap <= 0 ? "target reached ✓ (meter, not a gate — the human eye still rules)" : `gap ${gap} pt → ascent loop continues (see Phase 5 Stage 3b)`}`,
    "",
    "> The verdict belongs to the human eye (Phase 5 album). The score is the ascent",
    "> loop's PROGRESS METER, never a pass/fail gate — gates are code quality + budget.",
    "> Each cluster box is in page coordinates — look up overlapping `dom.box` entries",
    "> in the route's `media.json` to check whether the slot is EMPTY (missing media)",
    "> vs FILLED (layout gap).",
    "",
    "## Deviation clusters (fix-first priority = area × changed-ratio)",
    "",
    "| # | Box (x, y, w, h) | Area changed | Empty-render? |",
    "|---:|---|---:|---|",
  ];
  result.clusters.list.forEach((cluster) => {
    const flag = cluster.emptyRender ? "⚠ LIKELY EMPTY (media missing?)" : cluster.emptyRender === false ? "no" : "?";
    lines.push(`| ${cluster.priority} | ${cluster.x}, ${cluster.y}, ${cluster.w}, ${cluster.h} | ${(cluster.changedRatio * 100).toFixed(0)}% | ${flag} |`);
  });
  if (result.clusters.list.length === 0) lines.push("| – | no significant clusters | – | – |");
  const empties = result.clusters.list.filter((cluster) => cluster.emptyRender);
  if (empties.length) {
    lines.push("");
    lines.push("## Likely-empty regions — check these slots first");
    for (const cluster of empties) {
      lines.push(`- box (${cluster.x}, ${cluster.y}, ${cluster.w}, ${cluster.h}) — clone renders flat where the original has texture. Cross-ref media.json slots whose \`dom.box\` overlaps, and the Phase 2 selection that should have promoted them.`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function compareInBrowser(page, original, clone, threshold) {
  return page.evaluate(
    async ({ original, clone, threshold, BLOCK, MIN_CELLS, MAX_CLUSTERS }) => {
      const loadImage = (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
          image.src = src;
        });

      const [left, right] = await Promise.all([loadImage(original), loadImage(clone)]);
      const width = Math.max(left.naturalWidth, right.naturalWidth);
      const height = Math.max(left.naturalHeight, right.naturalHeight);

      const canvasA = document.createElement("canvas");
      const canvasB = document.createElement("canvas");
      const canvasD = document.createElement("canvas");
      for (const canvas of [canvasA, canvasB, canvasD]) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctxA = canvasA.getContext("2d", { willReadFrequently: true });
      const ctxB = canvasB.getContext("2d", { willReadFrequently: true });
      const ctxD = canvasD.getContext("2d");
      ctxA.fillStyle = "white";
      ctxB.fillStyle = "white";
      ctxA.fillRect(0, 0, width, height);
      ctxB.fillRect(0, 0, width, height);
      ctxA.drawImage(left, 0, 0);
      ctxB.drawImage(right, 0, 0);

      const a = ctxA.getImageData(0, 0, width, height);
      const b = ctxB.getImageData(0, 0, width, height);
      const d = ctxD.createImageData(width, height);
      let changed = 0;
      let sumAbs = 0;
      let sumSq = 0;

      // Grid of changed-cell counts at BLOCK resolution for clustering.
      const cols = Math.ceil(width / BLOCK);
      const rows = Math.ceil(height / BLOCK);
      const cells = new Uint32Array(cols * rows);

      for (let i = 0; i < a.data.length; i += 4) {
        const pixel = i >> 2;
        const x = pixel % width;
        const y = (pixel / width) | 0;
        const dr = Math.abs(a.data[i] - b.data[i]);
        const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
        const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
        const da = Math.abs(a.data[i + 3] - b.data[i + 3]);
        const delta = (dr + dg + db + da) / 1020;
        sumAbs += delta;
        sumSq += delta * delta;
        if (delta > threshold) {
          changed += 1;
          cells[((y / BLOCK) | 0) * cols + ((x / BLOCK) | 0)] += 1;
          d.data[i] = 255;
          d.data[i + 1] = Math.max(0, 80 - delta * 80);
          d.data[i + 2] = Math.max(0, 80 - delta * 80);
          d.data[i + 3] = 255;
        } else {
          d.data[i] = Math.round(a.data[i] * 0.25 + 245 * 0.75);
          d.data[i + 1] = Math.round(a.data[i + 1] * 0.25 + 245 * 0.75);
          d.data[i + 2] = Math.round(a.data[i + 2] * 0.25 + 245 * 0.75);
          d.data[i + 3] = 255;
        }
      }
      ctxD.putImageData(d, 0, 0);

      // Connected components over cells with ≥25% changed pixels.
      const marked = new Uint8Array(cols * rows);
      for (let cell = 0; cell < cells.length; cell += 1) {
        const total = cells[cell];
        if (total === 0) continue;
        const cellPixels = BLOCK * BLOCK;
        if (total / cellPixels < 0.25) {
          marked[cell] = 2; // noise
          continue;
        }
      }
      const clusters = [];
      const stack = [];
      for (let cell = 0; cell < cells.length; cell += 1) {
        if (marked[cell] !== 0 || cells[cell] === 0) continue;
        stack.length = 0;
        stack.push(cell);
        marked[cell] = 1;
        const group = [];
        while (stack.length > 0) {
          const current = stack.pop();
          group.push(current);
          const cx = current % cols;
          const cy = (current / cols) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const next = ny * cols + nx;
            if (marked[next] === 2 || marked[next] === 1) continue;
            if (cells[next] === 0) continue;
            if (cells[next] / (BLOCK * BLOCK) < 0.25) continue; // don't grow through noise
            marked[next] = 1;
            stack.push(next);
          }
        }
        if (group.length >= MIN_CELLS) clusters.push(group);
      }

      const meanAbsDeviation = (data, box) => {
        // Sample luminance spread inside the box on ONE canvas — flat ≈ missing render.
        let sum = 0;
        let sumDev = 0;
        let count = 0;
        const stepX = Math.max(1, Math.floor(box.w / 20));
        const stepY = Math.max(1, Math.floor(box.h / 20));
        for (let y = box.y; y < box.y + box.h; y += stepY) {
          for (let x = box.x; x < box.x + box.w; x += stepX) {
            const i = (y * width + x) * 4;
            sum += data[i];
            count += 1;
          }
        }
        if (count === 0) return 0;
        const mean = sum / count;
        for (let y = box.y; y < box.y + box.h; y += stepY) {
          for (let x = box.x; x < box.x + box.w; x += stepX) {
            const i = (y * width + x) * 4;
            sumDev += Math.abs(data[i] - mean);
          }
        }
        return sumDev / count;
      };

      const list = clusters
        .map((group) => {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = 0;
          let maxY = 0;
          let cellChanges = 0;
          for (const cell of group) {
            const cx = cell % cols;
            const cy = (cell / cols) | 0;
            minX = Math.min(minX, cx);
            minY = Math.min(minY, cy);
            maxX = Math.max(maxX, cx + 1);
            maxY = Math.max(maxY, cy + 1);
            cellChanges += cells[cell];
          }
          const box = { x: minX * BLOCK, y: minY * BLOCK, w: (maxX - minX) * BLOCK, h: (maxY - minY) * BLOCK };
          const origSpread = meanAbsDeviation(a.data, box);
          const cloneSpread = meanAbsDeviation(b.data, box);
          return {
            ...box,
            changedRatio: cellChanges / (group.length * BLOCK * BLOCK),
            origSpread: Math.round(origSpread * 10) / 10,
            cloneSpread: Math.round(cloneSpread * 10) / 10,
            emptyRender: cloneSpread < 6 && origSpread > 12 ? true : cloneSpread >= 6 ? false : null,
          };
        })
        .sort((first, second) => second.w * second.h * second.changedRatio - first.w * first.h * first.changedRatio) // priority: big AND mostly-changed first
        .slice(0, MAX_CLUSTERS)
        .map((cluster, index) => ({ ...cluster, priority: index + 1 }));

      const noiseCells = [...marked].filter((value) => value === 2).length;
      const pixels = width * height;
      const diffPixelRatio = changed / pixels;
      return {
        original: { width: left.naturalWidth, height: left.naturalHeight },
        clone: { width: right.naturalWidth, height: right.naturalHeight },
        comparedCanvas: { width, height },
        threshold,
        changedPixels: changed,
        totalPixels: pixels,
        diffPixelRatio,
        fidelity: Math.round((1 - diffPixelRatio) * 1000) / 10, // % — progress meter, not a gate
        meanAbsDiff: sumAbs / pixels,
        rmse: Math.sqrt(sumSq / pixels),
        clusters: { block: BLOCK, noiseCells, list },
        diffPngDataUrl: canvasD.toDataURL("image/png"),
      };
    },
    { original, clone, threshold, BLOCK, MIN_CELLS, MAX_CLUSTERS },
  );
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.original || !args.clone) {
    console.log(
      "visual-diff.mjs --original <png> --clone <png> --out <json> [--diff <png>] [--report <md>] [--threshold 0.08] [--target 90]",
    );
    process.exit(args.help ? 0 : 1);
  }

  const { chromium } = loadPlaywright();
  const browser = await launchChromium(chromium);
  const page = await browser.newPage();
  const result = await compareInBrowser(page, imageDataUrl(args.original), imageDataUrl(args.clone), args.threshold);
  await browser.close();

  const diffDataUrl = result.diffPngDataUrl;
  delete result.diffPngDataUrl;
  result.files = {
    original: path.resolve(args.original),
    clone: path.resolve(args.clone),
    diff: args.diff ? path.resolve(args.diff) : "",
    report: args.report ? path.resolve(args.report) : "",
  };
  result.role = "diagnostic sensor + fidelity meter — not a gate (90/100 ascent rule)";
  result.target = args.target;

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);

  if (args.diff) {
    const base64 = diffDataUrl.replace(/^data:image\/png;base64,/, "");
    fs.mkdirSync(path.dirname(path.resolve(args.diff)), { recursive: true });
    fs.writeFileSync(args.diff, Buffer.from(base64, "base64"));
  }
  if (args.report) {
    fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    fs.writeFileSync(args.report, sensorReport(result));
    console.log(path.resolve(args.report));
  }
  console.log(path.resolve(args.out));
} catch (error) {
  console.error(`visual-diff failed: ${error.message}`);
  process.exit(1);
}
