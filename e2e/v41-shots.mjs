// Capture the same 6 screens at 1920 and 390 (zh) for v41 before/after.
// PREFIX=before|after BASE=... OUT=... node /tmp/v41-shots.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = (process.env.BASE || "http://127.0.0.1:4182").replace(/\/$/, "");
const OUT = process.env.OUT || "/workspace/proto-site/v41";
const PREFIX = process.env.PREFIX || "before";
fs.mkdirSync(OUT, { recursive: true });
const SCREENS = [
  ["home", "/"],
  ["assembly", "/assembly?scene=electrics"],
  ["scope", "/assembly?scene=electrics"],
  ["bank", "/bank?path=path-night-light"],
  ["help", "/help#whats-new"],
  ["teardown", "/teardown/?d=coin-keyfob"],
];
const VPS = [
  ["1920", { width: 1920, height: 1080 }],
  ["390", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const wait = (p, ms) => p.waitForTimeout(ms);
for (const [vk, vp] of VPS) {
  const c = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
  await c.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); localStorage.setItem("ui-lang", "zh"); } catch { /* */ } });
  const p = await c.newPage();
  for (const [name, path] of SCREENS) {
    await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    if (name === "assembly" || name === "scope") {
      await p.waitForSelector("canvas", { timeout: 30000 }).catch(() => {});
      await wait(p, 4000);
    } else if (name === "teardown") {
      await p.waitForSelector('[data-testid="td-guide"]', { timeout: 20000 }).catch(() => {});
      await wait(p, 1500);
    } else if (name === "bank") {
      await p.waitForSelector('[data-testid="bank-paths"]', { timeout: 20000 }).catch(() => {});
      await wait(p, 800);
    } else if (name === "help") {
      await p.waitForSelector('[data-testid="help-whats-new"]', { timeout: 20000 }).catch(() => {});
      await p.evaluate(() => document.getElementById("whats-new")?.scrollIntoView({ block: "start" }));
      await wait(p, 400);
    } else {
      await wait(p, 800);
    }
    if (name === "scope") {
      const tab = p.locator('[data-testid="tab-elec"]');
      if (await tab.count()) await tab.first().click().catch(() => {});
      const details = p.locator('[data-testid="bench-scope-panel"]');
      await details.first().waitFor({ timeout: 20000 }).catch(() => {});
      if (await details.count()) {
        await details.first().scrollIntoViewIfNeeded().catch(() => {});
        await details.locator("summary").first().click().catch(() => {});
        await wait(p, 300);
      }
      const open = p.locator('[data-testid="bench-scope-open"]');
      await open.first().waitFor({ timeout: 20000 }).catch(() => {});
      if (await open.count()) {
        await open.first().scrollIntoViewIfNeeded().catch(() => {});
        await open.first().click().catch(() => {});
        await p.waitForSelector('[data-testid="bench-scope"]', { timeout: 20000 }).catch(() => {});
        const cap = p.locator('[data-testid="mscope-capture"]');
        if (await cap.count()) { await cap.first().click().catch(() => {}); await wait(p, 2500); }
        const panel = p.locator('[data-testid="bench-scope"]').first();
        if (await panel.count()) await panel.scrollIntoViewIfNeeded().catch(() => {});
        await wait(p, 400);
      }
    }
    const file = `${OUT}/${PREFIX}-${name}-${vk}.png`;
    if (name === "scope") {
      const panel = p.locator('[data-testid="bench-scope"]').first();
      if (await panel.count()) await panel.screenshot({ path: file, animations: "disabled" }).catch(async () => p.screenshot({ path: file, fullPage: true }));
      else await p.screenshot({ path: file, fullPage: true });
    } else {
      await p.screenshot({ path: file, fullPage: name !== "assembly" });
    }
    console.log("wrote", file);
  }
  await c.close();
}
await b.close();
console.log("done", PREFIX);
