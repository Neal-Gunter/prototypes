// 浏览器走查（需先 npm run build && npx vite preview --port 4173；playwright 装在 ../e2e）
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = "/workspace/proto-site/v6", BASE = "http://localhost:4173";
fs.rmSync("/tmp/pwv6", { recursive: true, force: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: "/tmp/pwv6", size: { width: 1440, height: 1000 } } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
let n = 0; const res = {};
const shot = async (name, opts = {}) => { n++; const f = `${OUT}/${String(n).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: f, ...opts }); console.log("shot", f); };
const pen = () => p.evaluate(() => { const o = window.__asm.overlapTest(); return [o.maxPenetrationMm, o.worstPair]; });
const snap = () => p.evaluate(() => { const s = window.__octo.sim.snapshot(); return { esp: s.espOn, halt: s.halted, bad: s.checks.filter((c) => !c.ok).map((c) => c.zh.slice(0, 40)), I: +s.avgI?.toFixed?.(2), pose: s.pose, buzz: s.servos.filter((x) => x.buzz).length }; });
let cur = null;
const waitBuilt = async () => { await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await p.waitForTimeout(2500); };
const build = async (plan, phase, fault = "none") => {
  if (plan !== cur) { await p.evaluate(() => { window.__octoBuilt = null; }); await p.click(`[data-testid=octo-preset-${plan}]`); await waitBuilt(); cur = plan; if (phase === 3 && fault === "none") return; }
  await p.evaluate(() => { window.__octoBuilt = null; });
  await p.selectOption("[data-testid=octo-phase]", String(phase));
  await p.selectOption("[data-testid=octo-fault]", fault);
  await p.click("[data-testid=octo-build]");
  await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 });
  await p.waitForTimeout(2500);
};
await p.goto(BASE + "/assembly?scene=octo");
await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForTimeout(1500);
await shot("octo-tab");
for (const ph of [0, 1, 2]) { await build("A", ph); res[`A-phase${ph}`] = { pen: await pen(), ...(await snap()), built: await p.evaluate(() => window.__octoBuilt) }; await shot(`A-phase${ph}`); }
await build("A", 3);
res.A3 = { pen: await pen(), ...(await snap()), built: await p.evaluate(() => window.__octoBuilt) };
await shot("A-built");
await p.click("[data-testid=ser-GO]"); await p.waitForTimeout(5000);
res.A3go = await snap(); await shot("A-serial-GO");
await p.fill("[data-testid=octo-serial]", "GAIT F=0.8 YAW=30"); await p.click("[data-testid=octo-serial-send]"); await p.waitForTimeout(1500);
await p.evaluate(() => { window.__octoBuilt = null; }); await p.click("[data-testid=octo-mode-mcp]"); await waitBuilt();
await p.click("[data-testid=mcp-wave]"); await p.waitForTimeout(3000); await shot("A-mcp-wave");
await p.fill("[data-testid=octo-nl]", "向左转三步，快一点"); await p.click("[data-testid=octo-nl-send]"); await p.waitForTimeout(4000);
res.nl = await p.textContent("[data-testid=octo-nl-out]");
res.A3nl = await snap();
await p.locator("[data-testid=octo-topview]").scrollIntoViewIfNeeded();
await shot("A-nl-left");
await p.evaluate(() => window.scrollTo(0, 0));
for (const f of ["nognd", "vplus-esp", "servo360", "mech", "lowbat"]) {
  await build("A", 3, f);
  if (f === "servo360" || f === "mech") { await p.click("[data-testid=mcp-crawl]").catch(() => p.click("[data-testid=ser-GO]")); await p.waitForTimeout(4000); }
  res[`fault-${f}`] = await snap();
  await p.locator("[data-testid=octo-checks]").scrollIntoViewIfNeeded(); await shot(`fault-${f}`); await p.evaluate(() => window.scrollTo(0, 0));
}
await build("B", 3);
res.B3 = { pen: await pen(), ...(await snap()), built: await p.evaluate(() => window.__octoBuilt) };
await shot("B-built");
await p.click("[data-testid=mcp-crawl]").catch(() => p.click("[data-testid=ser-GO]")); await p.waitForTimeout(6000);
res.B3go = { pen: await pen(), ...(await snap()) }; await shot("B-crawl");
await p.click("[data-testid=octo-guide]");
await p.waitForSelector("[data-testid=octo-guide]"); await p.waitForTimeout(800);
res.guide = await p.evaluate(() => ({ title: document.querySelector("h1").textContent, bom: document.querySelectorAll("[data-testid=og-bom] tbody tr").length, wires: document.querySelectorAll("[data-testid=og-wires] tbody tr").length, pins: document.querySelectorAll("[data-testid=og-pins] tbody tr").length, reality: document.querySelectorAll("[data-testid=og-reality] tbody tr").length, trace: document.querySelectorAll("[data-testid=og-trace] tbody tr").length, issues: document.querySelectorAll("[data-testid=og-issues] li").length, ino: document.querySelector("[data-testid=og-ino]").textContent.length, inoHead: document.querySelector("[data-testid=og-ino]").textContent.slice(0, 80), hasMdPrice: document.body.innerText.includes("来自你的 md"), priceInBom: /¥|元/.test(document.querySelector("[data-testid=og-bom]").innerText) }));
await shot("guide-top");
await shot("guide-full", { fullPage: true });
await p.pdf?.({ path: `${OUT}/octo-guide.pdf` }).catch(() => {});
res.errs = errs;
fs.writeFileSync(`${OUT}/walk-result.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await ctx.close(); await b.close();
