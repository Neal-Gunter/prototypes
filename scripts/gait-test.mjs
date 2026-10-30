// v13 步态测试：波形 / 固件公式一致 / 导出头文件 / v10 前后对比 / μ = 0 对照 / 脚垫灵敏度
import fs from "node:fs";
import { wave, jointValue, octoFirmwareGait, toFirmwareHeader, preset, sanitizeGait, curvePath, OCTO_SIDE, maxRate } from "../src/gait/gait.js";
import { octoRowGait } from "../src/gait/octo-best.js";
import { Gait, plusGait, fixesPlus, customYaw } from "../src/assembly/octopus/firmware.js";
import { runGait, fmt } from "./gait-run.mjs";
let pass = 0, fail = 0; const out = { tests: [] };
const ok = (c, m) => { (c ? pass++ : fail++); out.tests.push({ ok: !!c, m }); console.log(c ? "✓" : "✗", m); };
// 1 波形
ok(wave("tri", 0, 0.6) === 1 && Math.abs(wave("tri", 0.6, 0.6) + 1) < 1e-12 && Math.abs(wave("tri", 0.3, 0.6)) < 1e-12, "三角波：p=0 → +1，p=duty → −1，duty/2 过零");
ok(Math.abs(wave("sine", 0.25)) < 1e-12 && wave("square", 0.2, 0.5) === 1 && wave("square", 0.7, 0.5) === -1 && wave("saw", 0.5) === 0, "正弦 / 方波 / 锯齿");
// 2 自定义“固件默认”步态 == 固件 Gait.Yaw（逐点）
const G = new Gait(fixesPlus()); G.SetParams(plusGait("A")); const fg = octoFirmwareGait(); let e = 0;
for (let i = 0; i < 500; i++) { const t = i * 0.0137; G.phase_ = ((t * 0.6 * 360) % 360); for (let a = 0; a < 8; a++) e = Math.max(e, Math.abs(G.Yaw(a) - jointValue(fg.joints[a], t)), Math.abs(customYaw(fg.joints[a], t, 1) - jointValue(fg.joints[a], t))); }
ok(e < 1e-4, `固件默认步态 = 编辑器公式 = 固件 JS 孪生 customYaw（500 × 8 点最大差 ${e.toExponential(1)}°）`);
// 3 预设
const al = preset("alternating", ["a", "b", "c", "d"]), tp = preset("tripod", ["a", "b", "c", "d", "e", "f"]), wv = preset("wave", ["a", "b", "c", "d"]);
ok(al.joints.map((j) => j.phase).join() === "0,180,0,180" && tp.joints.map((j) => j.phase).join() === "0,120,240,0,120,240" && wv.joints.map((j) => j.phase).join() === "0,90,180,270", "预设相位：交替 / 三组轮换 / 波浪");
ok(/^M0\.0,/.test(curvePath(fg.joints[2], 200, 60)) && maxRate(octoRowGait().joints[2]) < 300, `预览曲线 path；同步划桨最大角速度 ${maxRate(octoRowGait().joints[2]).toFixed(0)} °/s < 固件限速 300`);
const sg = sanitizeGait({ joints: [{ amp: 999, wave: "evil", freq: -1 }] }, 2);
ok(sg.joints.length === 2 && sg.joints[0].amp === 90 && sg.joints[0].wave === "sine" && sg.joints[0].freq === 0.05, "导入步态 JSON 时夹住范围、未知波形改正弦");
// 4 头文件导出：把数组解析回来再按同一公式算，和 JS 一致
const H = toFirmwareHeader(octoRowGait()); fs.writeFileSync("/tmp/octopus_gait_custom.h", H);
const arr = (k) => H.match(new RegExp(`${k}\\[8\\]\\s*=\\s*\\{([^}]*)\\}`))[1].split(",").map((x) => parseFloat(x));
const W = ["sine", "tri", "square", "saw"], back = { joints: arr("kAmp").map((amp, a) => ({ amp, phase: arr("kPhase")[a], offset: arr("kOffset")[a], freq: arr("kFreq")[a], duty: arr("kDuty")[a], wave: W[arr("kWave")[a]] })) };
let e2 = 0; for (let i = 0; i < 300; i++) for (let a = 0; a < 8; a++) e2 = Math.max(e2, Math.abs(customYaw(back.joints[a], i * 0.021, 1) - jointValue(octoRowGait().joints[a], i * 0.021)));
ok(/#define OCTO_GAIT_CUSTOM 1/.test(H) && e2 < 1e-3, `导出 octopus_gait_custom.h：常量解析回来与编辑器一致（最大差 ${e2.toExponential(1)}°）`);
const body = fs.readFileSync("src/assembly/octopus/plus/octopus_plus/octopus_body.h", "utf8");
ok(/__has_include\("octopus_gait_custom.h"\)/.test(body) && /custom_gait::Yaw\(a, custom_t_, gait_.CustomScale\(a\)\)/.test(body), "octopus_body.h 检测到头文件就用自定义步态（之后仍过 AntiCollide / 限位 / 限速）");
// 5 物理：v10 紧凑版前后对比（15 s、μ 0.5，固件 JS 孪生 + Rapier）
const base = await runGait({}), same = await runGait({ gait: fg }), row = await runGait({ gait: octoRowGait() });
ok(Math.abs(base.fwd - same.fwd) < 0.01 && Math.abs(base.dx - same.dx) < 0.01, `走“自定义 = 固件默认”与默认固件同一结果 fwd ${base.fwd.toFixed(2)} / ${same.fwd.toFixed(2)} cm`);
ok(base.speed > 0.5 && base.speed < 0.75, `基线（固件默认步态）${base.speed.toFixed(3)} cm/s，dx ${base.dx.toFixed(2)} cm，dh ${base.dh.toFixed(1)}°`);
ok(row.speed > 3 * base.speed && Math.abs(row.dx) < Math.abs(base.dx) && Math.abs(row.dh) < Math.abs(base.dh) && row.col === 0, `同步划桨 ${row.speed.toFixed(3)} cm/s（×${(row.speed / base.speed).toFixed(1)}），dx ${row.dx.toFixed(2)} cm，dh ${row.dh.toFixed(1)}°，无碰撞`);
ok(row.marginMin > 2 && row.tiltMax < 2 && row.contactsAvg >= 6, `稳定：最小支撑裕度 ${row.marginMin.toFixed(2)} cm，最大倾角 ${row.tiltMax.toFixed(2)}°，平均着地 ${row.contactsAvg.toFixed(1)} 条`);
ok(row.energyJ > base.energyJ && row.energyJ < 40, `能量（估算，关节机械功）基线 ${base.energyJ.toFixed(2)} J → ${row.energyJ.toFixed(2)} J / 15 s`);
// 6 零摩擦对照
const z0 = await runGait({ mu: 0 }), z1 = await runGait({ gait: octoRowGait(), mu: 0 });
ok(Math.abs(z0.fwd) < 0.5 && Math.abs(z1.fwd) < 0.5, `μ = 0 对照：基线 ${z0.fwd.toFixed(2)} cm，同步划桨 ${z1.fwd.toFixed(2)} cm（没摩擦就走不动 = 推进力来自摩擦，不是数值漂移）`);
// 7 脚垫各向异性灵敏度（单向脚垫摩擦 0.15 / 0.45 是估算）
const iso0 = await runGait({ pad: [0.45, 0.45] }), iso1 = await runGait({ gait: octoRowGait(), pad: [0.45, 0.45] }), rev = await runGait({ gait: octoRowGait(), pad: [0.45, 0.15] });
ok(Math.abs(iso0.fwd) < 1.5 && rev.fwd < 0, `脚垫换成各向同性：基线 ${iso0.fwd.toFixed(2)} cm、同步划桨 ${iso1.fwd.toFixed(2)} cm；脚垫装反：同步划桨 ${rev.fwd.toFixed(2)} cm（倒退）→ 主要推进力来自单向脚垫`);
out.numbers = { base: fmt(base), row: fmt(row), mu0: { base: fmt(z0), row: fmt(z1) }, padIso: { base: fmt(iso0), row: fmt(iso1) }, padReversed: { row: fmt(rev) } };
fs.mkdirSync("/workspace/proto-site/v13/logs", { recursive: true });
try { fs.writeFileSync("/workspace/proto-site/v13/logs/gait-test.json", JSON.stringify(out, null, 1)); } catch {}
console.log(`gait-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
