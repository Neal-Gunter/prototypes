// v12 浏览器走查：模型页的关节（在 3D 里点父 → 子 → 铰接点、数字编辑）、运动仿真（滑块 / 测试 / 功能播放 / 姿态 / 时间轴 / 测试方块）、
// 导出导入带关节的工程、放上装配台后的关节面板。用法：npx vite preview --port 4173 & ; node e2e/artic-lab.mjs（BASE / OUT / SHOTS=0 可改）
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v12", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv12";
fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
if (SHOT) for (const f of fs.readdirSync(OUT)) if (/\.(png|mp4)$/.test(f)) fs.rmSync(`${OUT}/${f}`);
let pass = 0, fail = 0, n = 0;
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errs.push(m.text()));
const L = (f, a) => p.evaluate(f, a);
const shot = async (s, el) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; el ? await p.locator(el).screenshot({ path: f }) : await p.screenshot({ path: f }); };
const wait = (ms) => p.waitForTimeout(ms);
const near = (a, b, t) => Math.abs(a - b) <= t;
const val = (id) => L((id) => window.__labSim?.value(id), id);
const view = async () => { await L(() => document.querySelector("[data-testid=viewer]").scrollIntoView({ block: "center", behavior: "instant" })); await wait(300); };
const pick = async (mod) => { await view(); const pt = await L((id) => window.__labScene.pickPoint(id), mod); if (!pt) return null; await p.mouse.click(pt.x, pt.y); await wait(350); return pt; };
const simOn = async () => { if (!(await L(() => window.__lab.sim))) await p.click("[data-testid=sim-toggle]"); await p.waitForFunction(() => window.__labSim, null, { timeout: 30000 }); await wait(400); };

// 1) 内置机械臂：分组、关节标记
await p.goto(`${BASE}/assembly/model?demo=arm`);
await p.waitForFunction(() => window.__lab?.meshes > 0 && !window.__lab.busy, null, { timeout: 90000 }); await wait(1200);
let s = await L(() => window.__lab);
ok(s.groups.n === 3 && s.groups.joints === 2 && s.project.joints.length === 4 && !s.groups.errors.length, "机械臂示例：4 个关节（2 个舵机 + 2 个固定）→ 3 个刚体组", JSON.stringify(s.groups) + " " + s.project.joints.map((j) => j.id + ":" + j.type).join(","));
ok(near(s.size[0], 80, 30) && s.size[1] > 40, "机械臂真实尺寸（mm）", s.size.map((x) => x.toFixed(1)).join("×"));
await view(); await shot("arm-joint-markers");

// 2) 运动：滑块 / 测试 / 限位 / 速度
await simOn();
await p.locator("[data-testid=slider-j-yaw]").fill("45"); await wait(1500);
ok(near(await val("j-yaw"), 45, 3), "拖偏航滑块到 45° → 实际转到 ≈45°", (await val("j-yaw")).toFixed(1));
await p.locator("[data-testid=slider-j-pitch]").fill("60"); await wait(150);
const v150 = await val("j-pitch");
ok(v150 < 55, "MG90S 按 datasheet 速度（0.10 s/60°）追：150 ms 后还没到 60°", v150.toFixed(1));
await wait(1500);
ok(near(await val("j-pitch"), 60, 3), "俯仰到 60°", (await val("j-pitch")).toFixed(1));
await view(); await shot("arm-sliders");
await shot("joint-controls", "[data-testid=joints-panel]");
await L(() => window.__labSim.target("j-pitch", 170)); await wait(1500);
const plim = await L(() => window.__lab.project.joints.find((j) => j.id === "j-pitch").limits.max);
ok((await val("j-pitch")) <= Math.min(90, plim) + 1.5, `目标 170° 被截到限位 ${plim}°（舵机行程 ±90°）`, (await val("j-pitch")).toFixed(1));
await p.click("[data-testid=test-j-yaw]"); await wait(300);
ok(/测试/.test(await L(() => window.__labSim.playing() || "")), "点“测试”→ 关节来回扫一遍", await L(() => window.__labSim.playing()));
await wait(3500);

// 3) 姿态 + 压地堵转
await p.click("[data-testid=pose-p-low]"); await wait(1800);
const low = await val("j-pitch"), pen1 = await L(() => window.__labSim.pen());
ok(low > -19 && low < 0, "压低 −20°：推板碰到地面被挡住（不穿地）", low.toFixed(1));
ok(pen1.mm < 0.1, "压地时最大穿透 < 0.1 mm", pen1.mm.toFixed(3));
ok(await p.locator("[data-testid=stall-j-pitch]").count() === 1, "面板显示“堵转 / 被挡住”");
await shot("arm-stall-ground");
await p.click("[data-testid=pose-p-home]"); await wait(1500);

// 4) 测试方块 + 时间轴
await p.click("[data-testid=drop-block]"); await wait(800);
const b0 = await L(() => window.__labSim.block(0));
await p.click("[data-testid=play-timeline]"); await wait(2600);
await view(); await shot("arm-push-block");
let maxPen = 0; for (let i = 0; i < 8; i++) { maxPen = Math.max(maxPen, (await L(() => window.__labSim.pen())).mm); await wait(350); }
const b1 = await L(() => window.__labSim.block(0));
ok(Math.hypot(b1[0] - b0[0], b1[2] - b0[2]) > 1.5, "播放时间轴：推板把测试方块推走", `${Math.hypot(b1[0] - b0[0], b1[2] - b0[2]).toFixed(2)} cm`);
ok(maxPen < 0.1, "推方块过程中最大穿透 < 0.1 mm", maxPen.toFixed(3));

// 5) 功能 ↔ 关节：选中功能 = 播放
await p.locator('[data-fn="f-push"] button').first().click(); await wait(400);
ok(/推方块/.test(await L(() => window.__labSim.playing() || "")), "运动开着时选中功能“推方块”→ 播放它绑定的两个关节", await L(() => window.__labSim.playing()));
await wait(2500);
// 存姿态
const np = (await L(() => window.__lab.project.poses.length));
await p.click("[data-testid=save-pose]"); await wait(300);
ok((await L(() => window.__lab.project.poses.length)) === np + 1, "存当前姿态");
await shot("arm-timeline", "[data-testid=joints-panel]");

// 6) 在 3D 里新建关节：删掉俯仰，再点 转台舵机 → 大臂 → 表面点
await p.click("[data-testid=joint-j-pitch]"); await p.click("[data-testid=joint-del]"); await wait(300);
ok((await L(() => window.__lab.project.joints.length)) === 3, "删掉俯仰关节", (await L(() => window.__lab.project.joints.map((j) => j.id).join(","))) + errs.join(" | ").slice(0, 400));
await p.selectOption("[data-testid=new-joint-type]", "revolute");
await p.click("[data-testid=add-joint]"); await wait(400);
await pick("a3"); await pick("a4");
const hint = await p.locator("[data-testid=mode-hint]").innerText();
ok(/③/.test(hint), "依次点父、子后提示点铰接点", hint);
await shot("joint-pick-3d");
const pt = await pick("a4");
s = await L(() => window.__lab);
const nj = s.project.joints.find((j) => j.parent === "a3" && j.child === "a4");
ok(!!nj && s.selJoint === nj.id && !s.groups.errors.length, "3D 里点出新关节（父 = 肩部舵机，子 = 大臂）", nj?.id);
const anc = await L(() => [...["x", "y", "z"]].map((k) => +document.querySelector(`[data-testid=anchor-${k}]`).value));
ok(anc.every((v, i) => near(v, pt.point[i] * 10, 0.6)), "铰接点 = 鼠标点到的表面点（mm）", anc.join(","));
// 数字编辑：轴 X、铰接点 y 改到肩部轴心、限位、驱动
await p.click("[data-testid=axis-btn-X]");
const ax = await L(() => ["x", "y", "z"].map((k) => +document.querySelector(`[data-testid=axis-${k}]`).value));
ok(near(ax[0], 1, 1e-3) && near(ax[1], 0, 1e-3), "点“X”→ 转轴 = (1, 0, 0)", ax.join(","));
await p.fill("[data-testid=anchor-y]", String(+(anc[1] + 2).toFixed(2))); await wait(200);
const ay = +(await p.inputValue("[data-testid=anchor-y]"));
ok(near(ay, anc[1] + 2, 0.02), "数字输入铰接点 y（mm）→ 存进工程再读回来一致", `${anc[1]} → ${ay}`);
await p.fill("[data-testid=lim-min]", "-30"); await p.fill("[data-testid=lim-max]", "45");
await p.selectOption("[data-testid=joint-drive]", "mg90s");
await p.selectOption("[data-testid=joint-volt]", "6");
s = await L(() => window.__lab);
const nj2 = s.project.joints.find((j) => j.id === nj.id);
ok(nj2.limits.min === -30 && nj2.limits.max === 45 && nj2.drive.preset === "mg90s" && nj2.drive.volt === 6, "数字改限位 −30…45°、驱动 MG90S @6 V", JSON.stringify([nj2.limits, nj2.drive.preset, nj2.drive.volt]));
ok(/2\.2 kgf|0\.08|datasheet|Tower|MG90S/i.test(await p.locator("[data-testid=drive-src]").innerText()), "显示 datasheet 来源", (await p.locator("[data-testid=drive-src]").innerText()).slice(0, 80));
await shot("joint-editor", "[data-testid=joints-panel]");
// 开运动转新关节
await simOn();
await L((id) => window.__labSim.target(id, 40), nj.id); await wait(1500);
ok(near(await val(nj.id), 40, 4), "新关节开运动后能转到 40°", (await val(nj.id)).toFixed(1));
await L((id) => window.__labSim.target(id, 80), nj.id); await wait(1200);
ok((await val(nj.id)) < 47, "新关节限位 45° 生效", (await val(nj.id)).toFixed(1));

// 7) 绑定关节到功能（复选框）
await p.click("[data-testid=sim-toggle]"); await wait(300);
await p.locator('[data-fn="f-pitch"] button').first().click(); await wait(300);
await p.check(`[data-testid=fn-joint-${nj.id}]`); await wait(200);
ok((await L(() => window.__lab.project.functions.find((f) => f.id === "f-pitch").joints)).includes(nj.id), "功能面板勾选新关节 → 绑定到“抬臂”");
await p.click("[data-testid=fn-play]"); await p.waitForFunction(() => window.__labSim?.playing(), null, { timeout: 30000 });
ok(/抬臂/.test(await L(() => window.__labSim.playing())), "功能面板“▶ 播放”（自动打开运动）", await L(() => window.__labSim.playing()));
await wait(2000);

// 8) 导出 → 导入：关节 / 姿态 / 时间轴都在
const before = await L(() => JSON.stringify([window.__lab.project.joints, window.__lab.project.poses, window.__lab.project.timeline]));
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("[data-testid=export]")]);
const zp = "/tmp/arm-v12.modellab.zip"; await dl.saveAs(zp);
await p.goto(`${BASE}/assembly/model`); await wait(800);
await p.locator("[data-testid=import-input]").setInputFiles(zp); await p.waitForFunction(() => window.__lab?.meshes > 0 && !window.__lab.busy, null, { timeout: 60000 }); await wait(800);
const after = await L(() => JSON.stringify([window.__lab.project.joints, window.__lab.project.poses, window.__lab.project.timeline]));
ok(after === before, "导出再导入：关节、姿态、时间轴一字不差", `${before.length} 字节`);

// 9) 放上装配台：关节面板
await p.click("[data-testid=to-bench]");
await p.waitForFunction(() => window.__asmCustom, null, { timeout: 60000 }); await wait(2500);
const c = await L(() => window.__asmCustom);
ok(c.joints === 2 && c.groups === 3 && !!(await L(() => window.__asmArtic)), "装配台：3 个刚体组 + 2 个舵机关节核心", JSON.stringify(c));
await p.locator("[data-testid=bench-joints] [data-testid=pose-p-left]").click(); await wait(1800);
const by = await L(() => window.__asmArtic.value("j-yaw"));
ok(near(by, 70, 4), "装配台上点姿态“左转”→ 偏航 70°", by.toFixed(1));
const pen = await L(() => window.__asm.overlapTest().maxPenetrationMm);
ok(pen < 0.6, "装配台上不穿模", pen.toFixed(3));
await shot("bench-arm-joints");
await p.goto(`${BASE}/assembly?custom=demo`);
await p.waitForFunction(() => window.__asmCustom, null, { timeout: 90000 }); await wait(2500);
await p.locator("[data-testid=bench-joints] [data-testid=play-fn-f-arm]").click(); await wait(1500);
const ov = await L(() => Math.max(...[...window.__asmArtic.J.keys()].map((k) => Math.abs(window.__asmArtic.value(k)))));
ok(ov > 5, "装配台上的八爪鱼：播放“触手”功能，偏航关节在动", ov.toFixed(1));
await shot("bench-octo-joints");

ok(errs.length === 0, "页面没有报错", errs.slice(0, 3).join(" | "));
await ctx.close(); await b.close();
if (SHOT) {
  const vids = fs.readdirSync(VID).filter((f) => f.endsWith(".webm"));
  if (vids.length) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${vids[0]} -vf "fps=15,scale=1280:-2" -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`); console.log("video", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(2), "MB"); }
}
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
