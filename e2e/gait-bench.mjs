// v13：台面步态编辑器走查。① 八爪鱼（v10）：预设 → 测量前后对比 → 冰面对照 → 在台面上跑 → 导出固件头文件
// ② 模型实验室四足示例：在台面上跑 → 测量 → 冰面对照 → 改参数 → 存进工程 → 导出 JSON。录屏 → demo.mp4
// 用法：npx vite preview --port 4173 & ; node e2e/gait-bench.mjs（BASE / OUT / SHOTS=0 可改）
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v13", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv13";
fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 22; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const L = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) await p.locator(`[data-testid=${t}]`).screenshot({ path: f }); else await p.screenshot({ path: f }); };
const into = (t) => L((t) => document.querySelector(`[data-testid=${t}]`)?.scrollIntoView({ block: "start", behavior: "instant" }), t);
const num = async (t) => parseFloat((await p.locator(`[data-testid=${t}]`).innerText()).replace(/[^\d.\-−]/g, "").replace("−", "-"));
async function measure(tid, ctl = false) {
  await p.click(`[data-testid=${tid}-measure${ctl ? "-mu0" : ""}]`);
  await p.waitForFunction((t) => !document.querySelector(`[data-testid=${t}-busy]`) && document.querySelector(`[data-testid=${t}-r-speed]`), tid, { timeout: 240000 });
  await wait(300);
  return { fwd: await num(`${tid}-r-fwd`), speed: await num(`${tid}-r-speed`), dx: await num(`${tid}-r-dx`), dh: await num(`${tid}-r-dh`), slip: await num(`${tid}-r-slip`), tilt: await num(`${tid}-r-tilt`), energy: (await p.locator(`[data-testid=${tid}-r-energy]`).innerText()) };
}
async function dl(t) { const [d] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.click(`[data-testid=${t}]`)]); const f = `${OUT}/${d.suggestedFilename()}`; await d.saveAs(f); return { f, text: fs.readFileSync(f, "utf8") }; }

// ① 八爪鱼
await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await wait(1500);
await L(() => { window.__octoBuilt = null; }); await p.click("[data-testid=octo-preset-v10]");
await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await wait(1500);
await p.waitForSelector("[data-testid=octo-gait-editor]", { timeout: 20000 });
ok(await p.locator("[data-testid^=octo-gait-row-]").count() === 8, "八爪鱼步态编辑器：8 个关节各一行（相位 / 幅度 / 偏置 / 频率 / 波形 / 占空 + 预览曲线）");
ok(await p.locator("[data-testid^=octo-gait-curve-]").count() === 8, "每行有实时预览曲线");
await p.locator("[data-testid=octo-gait-sec]").fill("10");
await p.click("[data-testid=octo-gait-preset-firmware]"); await wait(200);
await into("octo-gait-editor"); await shot("octo-gait-editor");
const before = await measure("octo-gait"); res.octoFirmware = before;
await p.click("[data-testid=octo-gait-preset-row]"); await wait(200);
const after = await measure("octo-gait"); res.octoRow = after;
ok(after.speed > before.speed * 3 && after.speed > 2, "同步划桨比固件默认快 3 倍以上（浏览器里测 10 s）", `固件默认 ${before.speed} cm/s → 同步划桨 ${after.speed} cm/s`);
ok(Math.abs(after.dx) < 3 && Math.abs(after.dh) < 10, "同步划桨基本走直（侧漂 < 3 cm、航向 < 10°）", `dx ${after.dx} cm, dh ${after.dh}°`);
await shot("octo-gait-before-after", "octo-gait-report");
const ice = await measure("octo-gait", true); res.octoIce = ice;
ok(Math.abs(ice.fwd) < 0.5, "冰面对照（μ = 0）：几乎不动", `${ice.fwd} cm`);
// 改一个参数：预览和名字跟着变
const d0 = await p.locator("[data-testid=octo-gait-curve-2] path").getAttribute("d");
await p.locator("[data-testid=octo-gait-amp-2]").fill("20"); await wait(200);
const d1 = await p.locator("[data-testid=octo-gait-curve-2] path").getAttribute("d");
ok(d0 !== d1 && /已改/.test(await p.locator("[data-testid=octo-gait-name]").innerText()), "改幅度：预览曲线实时更新，名字标“已改”");
await p.click("[data-testid=octo-gait-preset-row]");
await p.locator("[data-testid=octo-gait-freq-0]").fill("2.5"); await wait(200);
ok(await p.locator("[data-testid=octo-gait-fast-0]").count() === 0, "前触手幅度 0：频率再高也不报“快”");
await p.locator("[data-testid=octo-gait-freq-1]").fill("2.5"); await wait(200);
ok(await p.locator("[data-testid=octo-gait-fast-1]").count() === 1, "幅度 50° × 2.5 Hz 超过固件限速 300 °/s：行标“快”");
await p.click("[data-testid=octo-gait-preset-row]"); await wait(200);
// 在台面上跑：机身真往前爬
const z0 = await L(() => window.__octo.sim.phys.snapshot().fwd);
await p.click("[data-testid=octo-gait-run]"); await wait(300);
await L(() => window.__octo.cam("overview")); await wait(8000);
const z1 = await L(() => window.__octo.sim.phys.snapshot().fwd);
ok(z1 - z0 > 8, "“在台面上跑”：页面上的八爪鱼按新步态往前爬", `8 s 前进 ${(z1 - z0).toFixed(1)} cm`);
res.octoBenchRun = +(z1 - z0).toFixed(2);
await L(() => window.scrollTo(0, 0)); await shot("octo-gait-running");
await p.click("[data-testid=octo-gait-stop]");
const h = await dl("octo-gait-export-h");
ok(/#pragma once/.test(h.text) && /同步划桨/.test(h.text) && /kCustomAmp|amp/i.test(h.text), "导出固件头文件 octopus_gait_custom.h", h.f);
const j = await dl("octo-gait-export-json"); fs.renameSync(j.f, `${OUT}/octo-gait.json`);
ok(JSON.parse(j.text).joints.length === 8, "导出步态 JSON");

// ② 模型实验室：四足示例
await p.goto(`${BASE}/assembly/model?demo=quad`);
await p.waitForFunction(() => window.__lab?.meshes > 0 && !window.__lab.busy, null, { timeout: 90000 }); await wait(1000);
const s = await L(() => window.__lab);
ok(s.groups.n === 9 && s.groups.joints === 8 && !s.groups.errors.length, "四足示例：9 个刚体、8 个关节", JSON.stringify(s.groups));
ok(s.project.sim.roundHulls === true && !!s.project.gait, "四足示例带圆角碰撞体开关和一份保存的步态");
await p.click("[data-testid=sim-toggle]"); await p.waitForFunction(() => window.__labSim, null, { timeout: 30000 });
await p.waitForSelector("[data-testid=lab-gait-editor]", { timeout: 20000 }); await wait(800);
ok(await p.locator("[data-testid^=lab-gait-row-]").count() === 8, "上传模型的通用步态编辑器：8 个驱动关节各一行");
await into("lab-gait"); await shot("quad-gait-editor");
const com = () => L(() => { let m = 0, z = 0, x = 0; for (const rb of window.__labSim.lab.rbs) { const w = rb.worldCom(), mm = rb.mass(); z += w.z * mm; x += w.x * mm; m += mm; } return { z: z / m, x: x / m }; });
const c0 = await com();
await p.click("[data-testid=lab-gait-run]");
await L(() => document.querySelector("[data-testid=viewer]")?.scrollIntoView({ block: "center", behavior: "instant" })); await wait(8000);
const c1 = await com();
ok(c0.z - c1.z > 10, "“在台面上跑”：四足在台面上往前（−z）走", `8 s 前进 ${(c0.z - c1.z).toFixed(1)} cm，侧移 ${(c1.x - c0.x).toFixed(1)} cm`);
res.quadBenchRun = +(c0.z - c1.z).toFixed(2);
await shot("quad-walking");
await p.click("[data-testid=lab-gait-stop]");
await into("lab-gait");
const q = await measure("lab-gait"); res.quad = q;
ok(q.speed > 2 && Math.abs(q.dx) < 5, "测量（10 s）：四足速度 > 2 cm/s，侧漂 < 5 cm", JSON.stringify(q));
const qi = await measure("lab-gait", true); res.quadIce = qi;
ok(Math.abs(qi.fwd) < 0.5, "冰面对照（μ = 0）：四足几乎不动", `${qi.fwd} cm`);
await shot("quad-gait-report", "lab-gait-report");
// 改：去掉抬腿（lift 关节幅度 0）→ 走不动
const names = await L(() => window.__labGait.g.joints.map((J) => J.jid));
await L(() => { const G = window.__labGait; G.set({ ...G.g, name: "不抬腿", joints: G.g.joints.map((J) => (/lift/.test(J.jid) ? { ...J, amp: 0 } : J)) }); }); await wait(300);
const nl = await measure("lab-gait"); res.quadNoLift = nl;
ok(nl.fwd < q.fwd * 0.3, "对照：不抬腿只扭腰，基本走不了（说明位移来自迈步，不是数值误差）", `${nl.fwd} cm vs ${q.fwd} cm`);
await p.click("[data-testid=lab-gait-preset-saved]"); await wait(200);
await p.locator("[data-testid=lab-gait-allfreq]").fill("1.5"); await p.click("[data-testid=lab-gait-allfreq-set]"); await wait(200);
const fq = await measure("lab-gait"); res.quad15 = fq;
ok(fq.speed > q.speed, "全部频率改成 1.5 Hz：更快", `${q.speed} → ${fq.speed} cm/s`);
await p.click("[data-testid=lab-gait-export-save]"); await wait(400);
const sg = await L(() => window.__lab.project.gait);
ok(sg && sg.joints.length === 8 && sg.joints.every((J) => names.includes(J.jid)) && Math.abs(sg.joints[0].freq - 1.5) < 1e-6, "存进工程：project.gait 按关节 id 存了 8 条", JSON.stringify(sg?.joints?.[0]));
const qj = await dl("lab-gait-export-json"); fs.renameSync(qj.f, `${OUT}/quad-gait.json`);
ok(JSON.parse(qj.text).joints.length === 8, "导出四足步态 JSON");
const pen = await L(() => window.__labSim.pen());
ok(pen.mm < 0.5, "跑完不穿模", JSON.stringify(pen));
ok(!errs.length, "没有页面错误", errs.join(" | "));
fs.writeFileSync(`${OUT}/logs/gait-bench-results.json`, JSON.stringify(res, null, 1));
await ctx.close(); await b.close();
if (SHOT) {
  const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "scale=1280:-2,fps=24" -c:v libx264 -crf 30 -preset veryfast -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`); console.log("demo.mp4", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(1), "MB"); }
}
console.log(`\n步态台面 e2e：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
