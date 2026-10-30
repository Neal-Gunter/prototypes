// v19：台面网表提取单元测试 + 台面电路 vs v18 参考板波形对照。早期原型，简化仿真。
// 用法：OUT=/tmp/nl node scripts/netlist-test.mjs
import fs from "node:fs";
import { benchSpec } from "../src/assembly/octopus/bench.js";
import { octoWiresFromSpec, octoWiresFromEngine, octoBoard, whatIf } from "../src/sim/benchNetlist.js";
import { benchBoard } from "../src/sim/refBench.js";
import { capture } from "../src/repair/tboard.js";
const OUT = process.env.OUT || "/tmp/nl";
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const log = [];
const ok = (c, m, d = "") => { (c ? pass++ : fail++); const l = `${c ? "✓" : "✗"} ${m}${d ? " — " + d : ""}`; log.push(l); console.log(l); };
const spec = (fault = "none") => octoWiresFromSpec(benchSpec({ variant: "v10", fault }));
const has = (r, k) => r.errors.some((e) => e.k === k);
const RUN = { exp: "run", run: true, tdiv: 2e-3, pre: 0.05, trig: { src: 0, slope: "rise", level: 1, mode: "auto" } };
const POW = { exp: "power", run: true, tdiv: 5e-3, pre: 0.05, trig: { src: 0, slope: "rise", level: 1, mode: "auto" } };

// 1 正常提取
const W = spec();
const r0 = octoBoard(W);
ok(r0.ok && r0.errors.length === 0 && r0.warnings.length === 0, "v10 正常接线：提取成功、没有错误", JSON.stringify(r0.stats));
ok(r0.board.parts.filter((p) => p.kind === "servo").length === 8 && r0.board.parts.filter((p) => p.kind === "boost").length === 2, "8 个舵机 + 2 个升压都进网表");
ok(r0.board.parts.find((p) => p.ref === "S3").props.sigPin === "RX" || !!r0.board.parts.find((p) => p.ref === "S3").props.sigPin, "舵机信号脚从 PWM 线找到", r0.board.parts.filter((p) => p.kind === "servo").map((p) => p.ref + "→" + p.props.sigPin).join(" "));
const w26 = r0.board.wires.find((w) => w.a === "SW:COM" && w.b === "QTPY:BAT");
ok(w26 && w26.awg === 26 && Math.abs(w26.len - 0.1) < 1e-9, "导线按线规 × 长度建模（SW→QT Py 26AWG 10 cm）", w26 && `${(0.134 * w26.len * 1000).toFixed(1)} mΩ`);
ok(r0.probes.length >= 60 && r0.probes.some((p) => p.kind === "wire"), "探头可以夹任何引脚 / 任何导线两端", `${r0.probes.length} 个位置`);
// 2 3D 台面（假 engine：导线带 meta、实际走线长度）和台面数据提取结果一致
const uid = {}; let k = 0; const parts = new Map();
for (const r of Object.keys(W.defs)) { uid[r] = "u" + k++; parts.set(uid[r], { uid: uid[r], def: { id: W.defs[r] } }); }
parts.set("frame", { uid: "frame", def: { id: "p-octo-frame-v10" } });
const cables = W.wires.map((w, i) => ({ id: "c" + i, kind: w.kind, meta: { a: w.a, b: w.b }, endUids: [uid[w.a[0]], uid[w.b[0]]], len: w.lenCm * 1.3 }));
const E = octoWiresFromEngine({ cables, parts });
const r1 = octoBoard(E);
ok(r1.ok && r1.board.wires.length === r0.board.wires.length && r1.board.parts.length === r0.board.parts.length, "从 3D 台面导线（engine.cables 的 meta）提取：零件 / 导线数和台面数据一致", `${r1.board.wires.length} 根`);
ok(Math.abs(r1.board.wires[0].len - r0.board.wires[0].len * 1.3) < 1e-9, "长度用实际走线长度（不是默认值）");
// 3 错误：缺地 / 悬空 / 短路 / 没电源 / 不支持
const rm = (pred) => W.wires.filter(pred).map((w) => w.id);
const rG = octoBoard(W, { removed: rm((w) => w.a.join(":") === "QTPY:BGND") });
ok(has(rG, "noground") && rG.errors.find((e) => e.k === "noground").ref === "QTPY" && rG.ok, "拔掉 QT Py 的 GND 线：报“缺地”（不致命，仍可仿真）", rG.errors.map((e) => e.zh).join(" | "));
const rF = octoBoard(W, { removed: rm((w) => w.a.join(":") === "SW:COM" && w.b.join(":") === "QTPY:BAT") });
ok(has(rF, "floating") && rF.errors.find((e) => e.k === "floating").nets.includes("QTPY:BAT"), "拔掉 QT Py 供电线：报“悬空网络”", rF.errors.find((e) => e.k === "floating")?.zh);
const cF = capture(rF.board, { ...POW, chans: [{ node: "CHG:BAT" }, { node: "QTPY:BAT" }] });
ok(cF.dev.QTPY.boots === 0, "……仿真里主控确实不开机", `boots ${cF.dev.QTPY.boots}，QTPY:BAT 最高 ${cF.meas[1].max.toFixed(3)} V`);
const Ws = { ...W, wires: [...W.wires, { id: "short", kind: "octo-v10-wire", a: ["CHG", "BAT"], b: ["CHG", "GND"], lenCm: 5 }] };
const rS = octoBoard(Ws);
ok(!rS.ok && has(rS, "short"), "BAT 焊盘和 GND 焊盘之间多一根线：报“短路”，拒绝仿真", rS.errors.find((e) => e.k === "short")?.zh);
const Wn = { ...W, defs: Object.fromEntries(Object.entries(W.defs).filter(([r]) => r !== "BAT")) };
const rN = octoBoard(Wn);
ok(!rN.ok && has(rN, "nosource"), "台面上没电池：报“没有电源”", rN.errors[0]?.zh);
const Wu = { ...W, defs: { ...W.defs, IMU: "ada-9999" } };
ok(has(octoBoard(Wu), "unsupported"), "没有电气模型的零件：报“不支持的零件”");
ok(octoBoard({ ...E, loose: [{ zh: "多出来的 MiniBoost" }] }).warnings.some((w) => w.k === "loose"), "摆在台面上但没接线的零件：提示没进网表");
// 4 v10 的预设故障
const fG = octoBoard(spec("nognd"));
ok(has(fG, "noground"), "预设故障 nognd → 缺地", fG.errors.map((e) => e.k).join(","));
const fL = capture(octoBoard(spec("lowbat")).board, { ...RUN, chans: [{ node: "CHG:BAT" }, { node: "BST1:OUT" }] });
ok(fL.allEvents.some((e) => e.kind === "lowStop"), "预设故障 lowbat → 固件低压停运动", `VBAT 最低 ${fL.meas[0].min.toFixed(3)} V`);
const fO = capture(octoBoard(spec("swoff")).board, { ...POW, chans: [{ node: "CHG:BAT" }, { node: "BST1:OUT" }] });
ok(fO.dev.QTPY.boots === 0 && fO.meas[1].max < 0.5, "预设故障 swoff → 升压和主控都不起来", `5V 最高 ${fO.meas[1].max.toFixed(3)} V`);
const fB = capture(octoBoard(spec("onebst"), { caps: { CAP1: 0, CAP2: 0 } }).board, { ...RUN, chans: [{ node: "CHG:BAT" }, { node: "BST1:OUT" }] });
const nB = capture(octoBoard(W, { caps: { CAP1: 0, CAP2: 0 } }).board, { ...RUN, chans: [{ node: "CHG:BAT" }, { node: "BST1:OUT" }] });
ok(fB.meas[1].min < nB.meas[1].min, "预设故障 onebst → 一个升压带 8 个舵机，5V 跌得更深", `${nB.meas[1].min.toFixed(3)} → ${fB.meas[1].min.toFixed(3)} V`);
// 5 实时修改：A3 线拔掉 → 固件读到 0 V → 开机就停；线规变细 → 压降变大
const cA = capture(octoBoard(W, { removed: rm((w) => w.b.join(":") === "QTPY:A3") }).board, { ...POW, chans: [{ node: "CHG:BAT" }] });
ok(cA.allEvents.some((e) => e.kind === "lowStop") && cA.dev.QTPY.boots === 1, "拔掉分压 → A3 的线：固件开机读到 0 V，停运动（我的补充）");
const pw = rm((w) => w.kind === "octo-v10-power");
const thin = capture(octoBoard(W, { caps: { CAP1: 0, CAP2: 0 }, awg: Object.fromEntries(pw.map((id) => [id, 30])) }).board, { ...RUN, chans: [{ node: "BST1:IN" }, { node: "BST1:OUT" }] });
const fat = capture(octoBoard(W, { caps: { CAP1: 0, CAP2: 0 } }).board, { ...RUN, chans: [{ node: "BST1:IN" }, { node: "BST1:OUT" }] });
ok(thin.meas[0].min < fat.meas[0].min, "升压输入线 22AWG → 30AWG：升压输入端最低电压更低", `${fat.meas[0].min.toFixed(3)} → ${thin.meas[0].min.toFixed(3)} V`);
// 6 对照 v18 参考板（同样的电池 / 电容；参考板 5VA ↔ 台面 BST1 OUT，VBAT ↔ 充电板 BAT 焊盘）
const cmp = [];
const pair = (nm, refOpt, ed) => {
  const a = capture(benchBoard(refOpt), { ...RUN, chans: [{ node: "VBAT" }, { node: "5VA" }] });
  const b = capture(octoBoard(W, ed).board, { ...RUN, chans: [{ node: "CHG:BAT" }, { node: "BST1:OUT" }] });
  const row = { case: nm, refPP: a.meas[1].pp, benchPP: b.meas[1].pp, refMin5: a.meas[1].min, benchMin5: b.meas[1].min, refVbatMin: a.meas[0].min, benchVbatMin: b.meas[0].min, refResets: a.dev.U1.resets, benchResets: b.dev.QTPY.resets, refMs: a.ms, benchMs: b.ms };
  cmp.push(row); return row;
};
const c0 = pair("不加电容 · 新电池", { cap: 0 }, { caps: { CAP1: 0, CAP2: 0 } });
ok(Math.abs(c0.benchPP / c0.refPP - 1) < 0.1, "对照①不加电容：5V 跌落峰峰值和 v18 参考板差 < 10%", `${(c0.refPP * 1000).toFixed(1)} vs ${(c0.benchPP * 1000).toFixed(1)} mV`);
const c1 = pair("470 µF · 新电池", { cap: 470e-6 }, { caps: { CAP1: 470e-6, CAP2: 0 }, esr: { CAP1: 0.05 } });
ok(Math.abs(c1.benchPP / c1.refPP - 1) < 0.25, "对照②并 470 µF（ESR 同为 0.05 Ω）：差 < 25%（台面电容在 10 cm 线的另一头）", `${(c1.refPP * 1000).toFixed(1)} vs ${(c1.benchPP * 1000).toFixed(1)} mV`);
const c2 = pair("不加电容 · 老化电池", { batt: "aged" }, { rint: 0.25, caps: { CAP1: 0, CAP2: 0 } });
ok(c2.benchResets === c2.refResets && Math.abs(c2.benchVbatMin - c2.refVbatMin) < 0.03, "对照③老化电池：复位次数相同、VBAT 最低值差 < 30 mV", `复位 ${c2.refResets} vs ${c2.benchResets}，VBAT 最低 ${c2.refVbatMin.toFixed(3)} vs ${c2.benchVbatMin.toFixed(3)} V`);
for (const r of [c0, c1, c2]) ok(Math.abs(r.benchMin5 - r.refMin5) < 0.03, `对照「${r.case}」：5V 最低值差 < 30 mV`, `${r.refMin5.toFixed(3)} vs ${r.benchMin5.toFixed(3)} V`);
// 7 “如果……会怎样”面板（估算）
const wi = {};
for (const [k, o] of Object.entries({ base: {}, cap0: { cap: 0 }, cap1000: { cap: 1000e-6 }, aged: { batt: "aged" }, aged0: { batt: "aged", cap: 0 }, awg30: { awg: 30, cap: 0 } })) wi[k] = whatIf(W, o);
const fmt = (r) => `复位 ${r.resets}，5V 最低 ${r.minRail.toFixed(3)} V，起步跌落 ${(r.servoDip * 1000).toFixed(0)} mV，电池峰值 ${r.ipk.toFixed(2)} A（${r.ms} ms）`;
ok(Object.values(wi).every((r) => r.ok), "what-if 6 组全部跑完", Object.values(wi).map((r) => r.ms + " ms").join(" / "));
ok(wi.cap0.servoDip > wi.base.servoDip && wi.base.servoDip > wi.cap1000.servoDip, "what-if：电容越大，舵机起步跌落越小", `0 / 100 / 1000 µF：${[wi.cap0, wi.base, wi.cap1000].map((r) => (r.servoDip * 1000).toFixed(0)).join(" / ")} mV`);
ok(wi.base.resets === 0 && wi.aged.resets > 0 && wi.aged0.resets >= wi.aged.resets, "what-if：新电池不复位，老化电池会复位，再去掉电容复位不减少", `${wi.base.resets} / ${wi.aged.resets} / ${wi.aged0.resets}`);
ok(Object.values(wi).every((r) => r.ipk > 0.5 && r.ipk < 6), "what-if：电池峰值电流在 0.5–6 A 之间（8 个舵机起步，估算）", Object.values(wi).map((r) => r.ipk.toFixed(2)).join(" / ") + " A");
ok(wi.cap1000.ipkInrush > wi.base.ipkInrush, "what-if：电容越大，上电浪涌越大（估算）", `${wi.base.ipkInrush.toFixed(1)} → ${wi.cap1000.ipkInrush.toFixed(1)} A`);
for (const [k, r] of Object.entries(wi)) log.push(`  what-if ${k}: ${fmt(r)}`);
fs.writeFileSync(`${OUT}/netlist-test.json`, JSON.stringify({ pass, fail, cmp, whatIf: Object.fromEntries(Object.entries(wi).map(([k, r]) => [k, { opt: r.opt, resets: r.resets, minRail: r.minRail, servoDip: r.servoDip, ipk: r.ipk, ipkInrush: r.ipkInrush, ms: r.ms }])), log }, null, 2));
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
