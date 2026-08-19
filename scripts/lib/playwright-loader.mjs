import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Stand-alone harvest scripts (.mjs) share this loader so they never assume a
 * bundler. Playwright comes from the repo's devDependencies — same instance the
 * TS-side scripts (gates/capture era) always used.
 */
export function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error(
      "Playwright not found. Run `npm install -D playwright && npx playwright install chromium` at the repo root (Phase 0).",
    );
  }
}

export async function launchChromium(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (firstError) {
    // Some Windows boxes only expose the branded Chrome channel.
    try {
      return await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      throw firstError;
    }
  }
}
