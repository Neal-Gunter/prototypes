// v11 走查：上传模型 + 功能图 → 绑定 → 拆分 / 合并 → 隔离 / 爆炸 → 导出再导入 → 坏文件 → 放上装配台碰撞
// 用法：npx vite build && npx vite preview --port 4173 & ; node e2e/modellab.mjs   （BASE 可改；SHOTS=0 不截图）
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v11", FX = "e2e/fixtures/v11";
const SAMPLES = `${OUT}/samples`, SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv11";
const STEP = "/workspace/proto-site/libsrc/kicad/SOT-23.step";
fs.mkdirSync(SAMPLES, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (/\.(png|mp4)$/.test(f)) fs.rmSync(`${OUT}/${f}`);
const res = []; let pass = 0, fail = 0, n = 0;
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); res.push({ ok: !!c, zh, extra }); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

// 0) 样例：功能图的 PNG 和 PDF 版（用浏览器从 SVG 渲染，本项目自制）
{
  const pg = await b.newPage({ viewport: { width: 1000, height: 560 } });
  const svg = fs.readFileSync(`${FX}/sample-rover-functions.svg`, "utf8");
  await pg.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await pg.locator("svg").first().screenshot({ path: `${SAMPLES}/sample-rover-functions.png` });
  await pg.pdf({ path: `${SAMPLES}/sample-rover-functions.pdf`, width: "1000px", height: "560px", printBackground: true, pageRanges: "1" });
  await pg.close();
  for (const f of fs.readdirSync(FX)) fs.copyFileSync(`${FX}/${f}`, `${SAMPLES}/${f}`);
}

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, recordVideo: { dir: VID, size: { width: 1440, height: 900 } } });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errs.push(m.text()));
const shot = async (s) => { if (SHOT) await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s}.png` }); };
const L = (f, a) => p.evaluate(f, a);
const lab = () => L(() => { const l = window.__lab; return l && { mods: l.project?.modules.map((m) => ({ id: m.id, name: m.name, n: m.meshes.length })), fns: l.project?.functions.map((f) => ({ id: f.id, name: f.name, mods: f.modules, regions: f.regions.length })), hl: [...l.hl], hlFns: [...l.hlFns], visible: l.visible ? [...l.visible] : null, selMods: [...l.selMods], selMeshes: [...l.selMeshes], meshes: l.meshes, size: l.size, busy: l.busy, err: l.err, mass: l.mass, units: l.project?.model?.units }; });
const idle = () => p.waitForFunction(() => window.__lab && !window.__lab.busy, null, { timeout: 120000 });
const upload = async (tid, file) => { await p.locator(`[data-testid=${tid}]`).setInputFiles(file); await p.waitForTimeout(300); await idle(); await p.waitForTimeout(600); };
const pick = async (modId, opts = {}) => {
  await L(() => document.querySelector("[data-testid=viewer]").scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(400);
  const pt = await L((id) => window.__labScene.pickPoint(id), modId);
  if (!pt) { console.log("  (pickPoint 找不到可见点)", modId, await L(() => JSON.stringify([document.querySelector("[data-testid=viewer] canvas")?.getBoundingClientRect(), innerHeight, scrollY, window.__labScene.camera.position.toArray(), getComputedStyle(document.documentElement).scrollBehavior]))); await p.screenshot({ path: ".tmp/fail-" + modId + ".png" }); return false; }
  if (process.env.DBG) console.log("  pick", modId, pt, await L(({ x, y }) => { const e = document.elementFromPoint(x, y); return e?.tagName + "." + e?.className; }, pt));
  if (opts.shift) await p.keyboard.down("Shift");
  await p.mouse.click(pt.x, pt.y); if (opts.shift) await p.keyboard.up("Shift");
  await p.waitForTimeout(400); return pt;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 1) 内置示例：八爪鱼 v10，双向高亮
await p.goto(`${BASE}/assembly/model?demo`);
await p.waitForFunction(() => window.__lab?.meshes > 0, null, { timeout: 90000 }); await p.waitForTimeout(1500);
let s = await lab();
ok(s.mods.length === 27 && s.fns.length === 9, "内置示例：27 个模块、9 个功能", `${s.mods.length}/${s.fns.length}`);
ok(near(s.size[0], 162.4, 1) && near(s.size[2], 162.4, 1), "内置示例真实尺寸 ≈162 × 61 × 162 mm", s.size.map((x) => x.toFixed(1)).join("×"));
ok(near(s.mass, 116.8, 0.5), "内置示例质量 = v10 质量表 116.8 g", s.mass.toFixed(1));
ok(await p.locator("[data-testid=local-note]").isVisible(), "显示“只在本机解析”提示");
await p.locator('[data-testid=diagram] [data-fn="f-drv"] rect').first().dispatchEvent("pointerdown"); await p.waitForTimeout(500);
s = await lab(); const drv = s.fns.find((f) => f.id === "f-drv");
ok(s.hl.length === 8 && drv.mods.every((m) => s.hl.includes(m)), "点功能图热点 → 3D 里高亮绑定的 8 个舵机", s.hl.length);
await shot("demo-hotspot-to-3d");
const lipo = s.mods.find((m) => /LiPo（/.test(m.name) && !/充电/.test(m.name));
await pick(lipo.id); s = await lab();
ok(s.hlFns.includes("f-bat") && s.selMods.includes(lipo.id), "点 3D 里的电池 → 功能图 / 树里高亮“电池与充电”", s.hlFns.join(","));
await shot("demo-3d-to-hotspot");
await p.locator('[data-fn="f-arm"] [data-testid=isolate-fn]').click(); await p.waitForTimeout(400);
s = await lab(); ok(s.visible?.length === 8, "隔离功能“触手” → 只显示 8 个模块", s.visible?.length);
await p.click("[data-testid=show-all]");
await p.selectOption("[data-testid=explode-mode]", "function"); await p.waitForTimeout(800);
const offs = await L(() => window.__lab.offsets);
ok(offs >= 20, "按功能爆炸：各功能组分开", offs);
await shot("demo-explode-by-function");
await p.selectOption("[data-testid=explode-mode]", "module"); await p.waitForTimeout(600); await shot("demo-explode-by-module");
await p.selectOption("[data-testid=explode-mode]", "none");

// 2) 自己上传 GLB + SVG 功能图，画热点、绑定
await p.click("text=新建"); await p.waitForTimeout(300);
await upload("model-input", `${FX}/sample-rover.glb`);
s = await lab();
ok(s.mods.length === 9 && s.meshes >= 9, "上传 GLB：按网格 / 组自动拆成 9 个模块", s.mods.map((m) => m.name).join("、"));
ok(near(s.size[0], 142, 1) && near(s.size[1], 47, 2) && near(s.size[2], 90, 1), "GLB 单位按米识别，真实尺寸 142 × 47 × 90 mm", `${s.units} ${s.size.map((x) => x.toFixed(1)).join("×")}`);
await upload("diagram-input", `${FX}/sample-rover-functions.svg`);
ok(await p.locator("[data-testid=diagram] img").count() === 1, "上传 SVG 功能图");
await p.click("[data-testid=mode-draw]");
const box = await p.locator("[data-testid=diagram] img").boundingBox();
const drag = async (x0, y0, x1, y1) => { await p.mouse.move(box.x + x0 * box.width, box.y + y0 * box.height); await p.mouse.down(); await p.mouse.move(box.x + x1 * box.width, box.y + y1 * box.height, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400); };
await drag(0.04, 0.16, 0.30, 0.42);
s = await lab(); ok(s.fns.length === 1 && s.fns[0].regions === 1, "在功能图上框出一个热点 → 新功能");
await p.fill("[data-testid=fn-name]", "供电"); await p.selectOption("[data-testid=fn-kind]", "供电");
const battery = s.mods.find((m) => /电池/.test(m.name)), board = s.mods.find((m) => /主控/.test(m.name));
await p.click("[data-testid=mode-bind]");
await pick(battery.id);
s = await lab(); ok(s.fns[0].mods.includes(battery.id), "绑定模式：点热点再点 3D 模块 → 绑定", battery.name);
await p.locator("[data-testid=fn-panel] summary", { hasText: "从列表里选模块" }).click();
await p.locator("[data-testid=fn-panel] label", { hasText: board.name }).locator("input").check();
s = await lab(); ok(s.fns[0].mods.length === 2, "从列表勾选模块也能绑定", s.fns[0].mods.length);
await p.locator("[data-testid=fn-panel] summary", { hasText: "引脚" }).click(); await p.click("[data-testid=add-pin]");
await shot("upload-glb-bind");
// 第二个功能：用 “+ 功能” 和列表绑定
await p.click("[data-testid=mode-view]");
await p.click("[data-testid=add-fn]"); await p.fill("[data-testid=fn-name]", "行走");
await p.selectOption("[data-testid=fn-kind]", "驱动");
for (const m of s.mods.filter((m) => /轮|电机/.test(m.name))) await p.locator("[data-testid=fn-panel] label", { hasText: m.name }).first().locator("input").check();
s = await lab(); const walk = s.fns.find((f) => f.name === "行走");
ok(walk && walk.mods.length >= 2, "第二个功能“行走”绑定轮子 / 电机", walk?.mods.length);
// 双向：点 3D 电池 → 高亮功能“供电”
await pick(battery.id); s = await lab();
ok(s.hlFns.includes(s.fns[0].id), "上传模型里点 3D 模块 → 反向高亮功能");

// 3) 拆分 / 合并 / 重命名 / 改色
const before = s.mods.length;
await p.click("[data-testid=mode-mesh]");
const multi = s.mods.find((m) => m.n >= 2) || s.mods[0];
const hit = await pick(multi.id);
s = await lab(); ok(s.selMeshes.length === 1, "网格模式：点选一个网格", hit?.mesh);
await p.click("[data-testid=split-meshes]"); await p.waitForTimeout(300);
s = await lab(); ok(s.mods.length === before + (multi.n >= 2 ? 1 : 0), "选中网格拆成新模块", `${before}→${s.mods.length}`);
const newMod = s.selMods[0];
await p.fill("[data-testid=mod-name]", "拆出来的零件"); await p.locator("[data-testid=mod-color]").fill("#ff00aa");
s = await lab(); ok(s.mods.find((m) => m.id === newMod)?.name === "拆出来的零件", "模块重命名 / 改色");
await p.locator(`[data-testid=tree] [data-mod="${newMod}"] input[type=checkbox]`).first().check();
await p.locator(`[data-testid=tree] [data-mod="${multi.id}"] input[type=checkbox]`).first().check();
await p.click("[data-testid=merge]"); await p.waitForTimeout(300);
s = await lab(); ok(s.mods.length === before, "两个模块合并回一个", s.mods.length);
await p.selectOption("[data-testid=mod-collider]", "box"); await p.selectOption("[data-testid=mod-material]", "abs"); await p.fill("[data-testid=mod-mass]", "12.5");
const mm = await L(() => window.__lab.project.modules.find((m) => m.massG === 12.5));
ok(mm && mm.collider === "box" && mm.material === "abs", "模块碰撞体 / 材料 / 实测质量可改");
await p.click("[data-testid=mode-view]");
await p.locator(`[data-testid=tree] [data-mod="${board.id}"] input[type=checkbox]`).first().check();
await p.click("[data-testid=isolate-mod]"); await p.waitForTimeout(300);
s = await lab(); ok(s.visible?.length === s.selMods.length, "隔离选中模块", s.visible?.length);
await p.click("[data-testid=show-all]");
await shot("upload-split-merge");

// 4) 导出 zip → 新工程 → 导入，内容一致
const ref = await L(() => JSON.stringify({ m: window.__lab.project.modules.map((m) => [m.name, m.meshes.length, m.collider, m.massG]), f: window.__lab.project.functions.map((f) => [f.name, f.modules.length, f.regions.length, f.pins.length]) }));
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("[data-testid=export]")]);
const zipPath = `${OUT}/rover-export.modellab.zip`; await dl.saveAs(zipPath);
ok(fs.statSync(zipPath).size > 1000, "导出工程 zip（JSON + 模型 + 功能图）", `${fs.statSync(zipPath).size} B`);
const ents = execSync(`python3 -c "import zipfile,sys;print(' '.join(zipfile.ZipFile(sys.argv[1]).namelist()))" ${zipPath}`).toString().trim();
ok(/project\.json/.test(ents) && /model/.test(ents) && /diagram/.test(ents), "zip 里有 project.json、模型、功能图", ents);
await p.click("text=新建"); await p.waitForTimeout(300);
await upload("import-input", zipPath);
const got = await L(() => JSON.stringify({ m: window.__lab.project.modules.map((m) => [m.name, m.meshes.length, m.collider, m.massG]), f: window.__lab.project.functions.map((f) => [f.name, f.modules.length, f.regions.length, f.pins.length]) }));
ok(got === ref && (await lab()).meshes > 0, "重新导入：模块、功能、热点、引脚一样");
const roverId = await L(() => window.__lab.project.id);

// 5) 坏文件
await p.click("text=新建");
await upload("model-input", `${FX}/broken-not-a-model.glb`);
let e = await p.locator("[data-testid=error]").textContent().catch(() => "");
ok(/GLB|glTF|读不|无法|不是/.test(e || ""), "坏 GLB：给出中文错误，不崩", (e || "").slice(0, 60));
await upload("model-input", `${FX}/broken-truncated.stl`);
e = await p.locator("[data-testid=error]").textContent().catch(() => "");
ok(/STL|截断|不完整|读不/.test(e || ""), "截断的 STL：给出中文错误", (e || "").slice(0, 60));
await upload("diagram-input", `${FX}/sample-bracket.obj`).catch(() => {});
e = await p.locator("[data-testid=error]").textContent().catch(() => "");
ok(!!e, "把模型文件当功能图上传：拒绝", (e || "").slice(0, 60));
await shot("bad-file");

// 6) OBJ、STL（连通块拆分）、STEP、PNG / PDF 功能图
await p.click("text=新建"); await upload("model-input", `${FX}/sample-bracket.obj`);
s = await lab(); ok(s.mods.length === 3 && s.mods.some((m) => m.name === "底板"), "上传 OBJ：按 g/o 拆成 3 个模块", s.mods.map((m) => m.name).join("、"));
ok(near(s.size[0], 40, 0.5) && near(s.size[1], 33, 0.5) && near(s.size[2], 30, 0.5) && s.units === "mm", "OBJ 按毫米识别，40 × 33 × 30 mm", `${s.units} ${s.size.map((x) => x.toFixed(1)).join("×")}`);
await upload("diagram-input", `${SAMPLES}/sample-rover-functions.png`);
ok(await p.locator("[data-testid=diagram] img").count() === 1, "上传 PNG 功能图");
await p.click("text=新建"); await upload("model-input", `${FX}/sample-two-blocks.stl`);
s = await lab(); ok(s.mods.length === 1, "STL 只有一个网格 → 1 个模块");
await p.click("[data-testid=split-connected]"); await idle(); await p.waitForTimeout(500);
s = await lab(); ok(s.mods.length === 2, "按连通块拆网格 → 2 个模块", s.mods.length);
await upload("diagram-input", `${SAMPLES}/sample-rover-functions.pdf`);
await p.waitForTimeout(800);
const pdfOk = await p.locator("[data-testid=diagram] img").count();
ok(pdfOk === 1, "上传 PDF 功能图（第 1 页转成图片）");
await shot("stl-split-pdf");
if (fs.existsSync(STEP)) {
  await p.click("text=新建"); await upload("model-input", STEP);
  s = await lab();
  ok(s.meshes > 0 && s.size[0] > 1 && s.size[0] < 5, "上传 STEP（KiCad SOT-23，浏览器里用 occt 解析）", `${s.mods.length} 个模块 ${s.size.map((x) => x.toFixed(2)).join("×")} mm`);
  await shot("step");
}

// 7) 放上装配台：和桌面碰撞、不穿模
await p.goto(`${BASE}/assembly/model?p=${encodeURIComponent(roverId)}`);
await p.waitForFunction(() => window.__lab?.meshes > 0, null, { timeout: 60000 });
await p.click("[data-testid=to-bench]");
await p.waitForFunction(() => window.__asmCustom, null, { timeout: 60000 }); await p.waitForTimeout(3500);
const bench = await L(() => { const E = window.__asm.engine, ps = [...E.parts.values()].filter((q) => q.def.kind === "custom"); const ys = ps.map((q) => E.worldPose(q.uid).p.y); return { c: window.__asmCustom, n: ps.length, bodies: new Set(ps.map((q) => q.body)).size, pen: window.__asm.overlapTest().maxPenetrationMm, y: Math.min(...ys) }; });
ok(bench.c.parts === 9 && bench.bodies === 1, "装配台载入上传模型：9 个模块合成 1 个刚体", JSON.stringify(bench.c));
ok(bench.pen < 0.6, "落到桌面上不穿模（最大穿透 < 0.6 mm）", bench.pen.toFixed(3));
ok(bench.y > -0.5 && bench.y < 10, "上传模型落在桌面上（没掉穿）", bench.y.toFixed(2));
await shot("bench-custom");
await p.goto(`${BASE}/assembly?custom=demo`);
await p.waitForFunction(() => window.__asmCustom, null, { timeout: 90000 }); await p.waitForTimeout(3500);
const b2 = await L(() => ({ c: window.__asmCustom, pen: window.__asm.overlapTest().maxPenetrationMm }));
ok(b2.c.parts === 27 && b2.pen < 0.6, "内置八爪鱼放上装配台：27 个模块，不穿模", `${b2.c.parts} ${b2.pen.toFixed(3)}`);
await shot("bench-demo");

ok(errs.length === 0, "页面没有报错", errs.slice(0, 3).join(" | "));
await ctx.close(); await b.close();
const vids = fs.readdirSync(VID).filter((f) => f.endsWith(".webm"));
if (vids.length) {
  execSync(`ffmpeg -y -loglevel error -i ${VID}/${vids[0]} -vf "fps=15,scale=1280:-2" -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`);
  console.log("video", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(2), "MB");
}
fs.writeFileSync(`${OUT}/e2e-results.json`, JSON.stringify({ pass, fail, res, at: new Date().toISOString() }, null, 1));
console.log(`modellab e2e: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
