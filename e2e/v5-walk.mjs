// v5 无头走查：零件库 → 电路练习 → 新零件 → 工具碰撞 → 装配指南 → 导入清单 → 素材页
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.env.OUT || "../v5";
const VIDEO = process.env.VIDEO || "/tmp/v5video";
const BASE = process.env.BASE || "http://localhost:4173";
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(VIDEO, { recursive: true, force: true });
const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: VIDEO, size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
let n = 0;
const shot = async (name, o = {}) => { n++; const f = `${OUT}/v5-${String(n).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: f, ...o }); console.log("shot", f); };
const wait = (ms) => p.waitForTimeout(ms);
const pen = (r = false) => p.evaluate((r) => window.__asm.engine.overlapTest({ includeRopes: r }).maxPenetrationMm, r);
const cam = (pos, t) => p.evaluate(([a, c]) => window.__asmCam(a, c), [pos, t]);
const out = {};

// 1) 零件库
await p.goto(BASE + "/parts");
await p.getByTestId("parts-counts").waitFor();
await wait(800);
out.partsCounts = await p.getByTestId("parts-counts").innerText();
await shot("parts-library");
await p.getByTestId("parts-search").fill("步进");
await wait(500);
await shot("parts-search-stepper");

// 2) 电路练习：自动装配 + 上传自动生成的程序 + 按按键
await p.goto(BASE + "/assembly?scene=electrics");
await p.waitForFunction(() => window.__asmBuilt, null, { timeout: 180000 });
out.built = await p.evaluate(() => window.__asmBuilt);
await wait(1000);
await shot("electrics-built");
await p.getByTestId("fw-auto").click();
await p.getByTestId("fw-upload").click();
await wait(1500);
out.fwStatus = await p.getByTestId("fw-status").innerText();
const btn = p.locator('[data-testid^="press-"]').first();
await btn.hover(); await p.mouse.down(); await wait(700);
out.ledPressed = await p.getByTestId("led-state").allInnerTexts();
await p.getByTestId("real-panel").locator("summary").click();
await wait(1300);
await shot("electrics-pressed-real-panel");
await p.mouse.up();
out.realPanel = (await p.getByTestId("real-panel").innerText()).slice(0, 600);

// 3) 新零件放到桌子前沿
const NEWP = [["p-motor-nema17-40", -14, 13], ["p-motor-28byj48", -7, 15], ["p-motor-n20", -2, 12], ["p-motor-130", -2, 16.5], ["p-breadboard-170", 4, 14], ["p-capscrew-M3x12", 8.5, 11.5], ["p-capscrew-M2.5x10", 10, 11.5], ["p-washer-M3", 11.5, 11.5], ["p-handtool-hex2.5", 10, 14.5], ["p-handtool-tweezers", 11, 17.5], ["p-handtool-multimeter", 21, 13], ["p-handtool-cutter", -14, 18.5]];
const ids = await p.evaluate(() => [...window.__asm.engine.parts.keys()].length);
out.placed = [];
for (const [id, x, z] of NEWP) {
  const ok = await p.evaluate(async ([id, x, z]) => { try { await window.__asm.addAt(id, x, z, 0.5); return true; } catch (e) { return e.message; } }, [id, x, z]);
  out.placed.push([id, ok]);
}
let mp = 0;
for (let i = 0; i < 8; i++) { await wait(400); mp = Math.max(mp, await pen()); }
out.newPartsPenMm = mp;
out.partsOnBench = await p.evaluate(() => window.__asm.engine.parts.size);
await cam([-3, 36, 46], [-1, 0, 8]);
await wait(800);
await shot("new-parts-front");
await p.getByTestId("debug-toggle").evaluate((e) => e.click());
await wait(800);
await shot("new-parts-colliders");
await p.getByTestId("debug-toggle").evaluate((e) => e.click());

// 4) 工具碰撞：螺丝刀从侧面扫过 NEMA17
const sweep = await p.evaluate(async () => {
  const E = window.__asm.engine;
  const m = [...E.parts.values()].find((x) => x.def.id === "p-motor-nema17-40");
  const p0 = E.worldPose(m.uid).p.clone();
  E.setTool("screwdriver");
  const s0 = p0.clone(); s0.x -= 4; s0.z += 6; s0.y = 20; E.setToolPos(s0); await new Promise((r) => setTimeout(r, 300));
  s0.y = 0.5; E.setToolPos(s0); await new Promise((r) => setTimeout(r, 2500));
  let w = 0, wp = null;
  for (let k = 0; k <= 80; k++) {
    const v = p0.clone(); v.x = p0.x - 4 + k * 0.05; v.z = p0.z + 6 - k * 0.15; v.y = 0.5; E.setToolPos(v);
    await new Promise((r) => setTimeout(r, 25));
    const o = E.overlapTest(); if (o.maxPenetrationMm > w) { w = o.maxPenetrationMm; wp = o.worstPair; }
  }
  await new Promise((r) => setTimeout(r, 1500));
  return { movedCm: +E.worldPose(m.uid).p.distanceTo(p0).toFixed(2), maxPenMm: w, worstPair: wp };
});
out.toolSweep = sweep;
await p.evaluate(() => window.__asm.engine.setToolPos(new window.__asm.engine.tool.pos.constructor(0, 30, 0)));
await wait(800);
await shot("tool-pushed-motor");
await p.evaluate(() => window.__asm.engine.setTool(null));
await cam([0, 30, 33], [0, 0, 0]);
out.penWithRopes = await p.evaluate(() => window.__asm.engine.overlapTest({ includeRopes: true }));

// 5) 装配指南
await p.getByTestId("guide-btn").click();
await p.getByTestId("guide").waitFor({ timeout: 30000 });
await wait(800);
await shot("guide-top");
await p.getByTestId("guide-nets").scrollIntoViewIfNeeded();
await wait(300);
await shot("guide-nets");
await p.getByTestId("guide-real").scrollIntoViewIfNeeded();
await wait(300);
await shot("guide-real-safety");
out.guideBomRows = await p.getByTestId("guide-bom").locator("tbody tr").count();
out.guideNetRows = await p.getByTestId("guide-nets").locator("tbody tr").count();
await p.emulateMedia({ media: "print" });
await p.pdf({ path: `${OUT}/guide.pdf`, format: "A4" }).catch((e) => (out.pdfErr = e.message));
await p.emulateMedia({ media: "screen" });

// 6) 导入清单：把半尺寸面包板换成 830 孔全尺寸
await p.goto(BASE + "/assembly");
await p.waitForFunction(() => window.__asm, null, { timeout: 60000 });
await p.getByText("导入清单（粘贴文字清单，照着装配）").click();
const t = (await p.getByTestId("list-text").inputValue()).replace("p-breadboard-half", "p-breadboard-830");
await p.getByTestId("list-text").fill(t);
await p.evaluate(() => { window.__asmBuilt = null; });
await p.getByTestId("list-build").click();
await p.waitForFunction(() => window.__asmBuilt, null, { timeout: 180000 });
out.import830 = await p.evaluate(() => window.__asmBuilt);
await wait(800);
out.import830Pen = await p.evaluate(() => { const o = window.__asm.engine.overlapTest({ includeRopes: true }); const q = window.__asm.engine.overlapTest(); return { withRopes: o.maxPenetrationMm, pair: o.worstPair, partsOnly: q.maxPenetrationMm }; });
await shot("import-list-830");

// 7) 素材与许可
await p.goto(BASE + "/credits");
await wait(800);
await shot("credits", { fullPage: true });

out.errors = errs;
fs.writeFileSync(`${OUT}/v5-walk.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await ctx.close();
await b.close();
