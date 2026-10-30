// v19：通用台面（电路练习预设：Pico + 面包板 + LED / 电阻 / 按键 / 电位器 / 舵机 + 杜邦线）→ 网表 → 时域仿真。由 scripts/engine-test.sh 调用
// 早期原型，简化仿真。
import fs from "node:fs";
globalThis.fetch = async (u) => {
  const p = new URL("../public" + u, import.meta.url);
  if (!fs.existsSync(p)) return { ok: false, json: async () => [] };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};
const { engine } = await import("../.tmp/eng-bundle.mjs");
const X = await import("../.tmp/elec-bundle.mjs");
const BN = await import("../src/sim/benchNetlist.js");
const { capture } = await import("../src/repair/tboard.js");
await engine.init();
const OUT = process.env.OUT || "/tmp/bn";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info: String(info) }); console.log(ok ? "PASS" : "FAIL", name, info); };
const run = async (s) => { for (let i = 0; i < Math.round(s * 120); i++) engine.update(1 / 120); };
let clock = 0;
await X.buildFromList(engine, X.PRESETS.electrics.text, { run });
await run(1);
const elec = new X.BenchElectrics(engine, { now: () => clock, budgetMs: 50 });
elec.tick();
const U1 = [...engine.parts.values()].find((p) => p.state.ref === "U1").uid;
elec.upload(U1, elec.sketchFor(U1));
for (let i = 0; i < 12; i++) { clock += 50; await run(0.05); elec.tick(); }
const t0 = Date.now();
const e = BN.extractBench(engine, X, elec.fw);
const dupont = engine.cables.filter((c) => c.kind !== "servo-lead" && c.endUids[0] && c.endUids[1]).length;
check("没有八爪鱼导线 → 走通用台面提取", e.kind === "generic", e.kind);
check("网表提取成功、无错误", e.ok && !e.errors.length, JSON.stringify(e.stats) + ` ${Date.now() - t0} ms ` + e.errors.map((x) => x.zh).join("；"));
const kinds = e.board.parts.map((p) => p.kind).sort().join(",");
check("零件齐：USB 电源 / 稳压 / 主控 / 电阻 / LED / 电位器 / 上拉 / 舵机", ["dcin", "ldo", "mcu", "led", "servo"].every((k) => kinds.includes(k)) && e.board.parts.filter((p) => p.kind === "load").length >= 4, kinds);
check("每根杜邦线单独算线阻（不并成一个节点）", e.board.wires.length === dupont && e.board.wires.every((w) => w.a !== w.b && w.state.crimpR > 0), `${e.board.wires.length} 根 / 台面 ${dupont} 根`);
const sv = e.board.parts.find((p) => p.kind === "servo"), mcu = e.board.parts.find((p) => p.kind === "mcu");
check("舵机信号线经杜邦线认到主控的舵机脚（固件 attach）", sv.props.sigPin && mcu.props.drive[sv.props.sigPin] === 1, sv.props.sigPin);
check("固件 INPUT_PULLUP 的按键脚加了内部上拉", e.board.parts.some((p) => /_PU14$/.test(p.ref)), "");
const probes = BN.probesOf(e.board);
check("探头可以点任何引脚 / 任何导线端", probes.filter((p) => p.kind === "wire").length === 2 * e.board.wires.length && probes.length > 20, `${probes.length} 个探头点`);
const ldo = e.board.parts.find((p) => p.kind === "ldo"), usb = e.board.parts.find((p) => p.kind === "dcin");
const cfg = { exp: "power", tdiv: 2e-3, pre: 0.1, run: true, trig: { src: 0, slope: "rise", level: 1, mode: "auto" } };
const c = capture(e.board, { ...cfg, chans: [{ node: usb.pins["+"] }, { node: ldo.pins.OUT }, { node: sv.pins.V }] });
check("上电：USB 5 V、3V3 稳到 3.3 V、主控开机", Math.abs(c.meas[0].max - 5) < 0.05 && Math.abs(c.meas[1].max - 3.3) < 0.05 && c.allEvents.some((x) => x.kind === "boot"), `5V ${c.meas[0].max.toFixed(3)} / 3V3 ${c.meas[1].max.toFixed(3)} V，${c.ms.toFixed(0)} ms`);
const RUNC = { ...cfg, exp: "run" };
const cr = capture(e.board, { ...RUNC, chans: [{ node: usb.pins["+"] }, { node: ldo.pins.OUT }, { node: sv.pins.V }] });
check("舵机 VCC（经两根杜邦线）比 USB 5V 低一点（线阻 + 插头）", cr.meas[2].min < cr.meas[0].min && cr.meas[2].min > 4.5, `USB 5V 最低 ${cr.meas[0].min.toFixed(4)} / 舵机 V 最低 ${cr.meas[2].min.toFixed(4)} V`);
// 实时修改：拔掉舵机 VCC 线 → 舵机供电悬空
const vw = e.board.wires.find((w) => w.a === sv.pins.V || w.b === sv.pins.V);
const e2 = BN.extractBench(engine, X, elec.fw, { removed: [vw.src] });
check("拔掉舵机 VCC 那根杜邦线 → 报“悬空”", [...e2.errors, ...e2.warnings].some((x) => /悬空/.test(x.zh)), [...e2.errors, ...e2.warnings].map((x) => x.zh).join("；"));
// 线规：26 → 30AWG，舵机 V 最低更低
const e3 = BN.extractBench(engine, X, elec.fw, { awg: { [vw.src]: 30 } });
const c3 = capture(e3.board, { ...RUNC, chans: [{ node: usb.pins["+"] }, { node: ldo.pins.OUT }, { node: sv.pins.V }] });
check("舵机 VCC 线换 30AWG → 线阻变大", e3.board.wires.find((w) => w.src === vw.src).awg === 30 && c3.meas[2].min < cr.meas[2].min, `${cr.meas[2].min.toFixed(4)} → ${c3.meas[2].min.toFixed(4)} V`);
// 没有电源：拔掉 USB 线 → 致命错误（没法仿真）
const fw2 = { ...elec.fw, [U1]: { ...elec.fw[U1], off: true } };
const e4 = BN.extractBench(engine, X, fw2);
check("没有 USB 电源 → 致命错误“没有电源”", !e4.ok && e4.errors.some((x) => x.k === "nosource"), e4.errors.map((x) => x.zh).join("；"));
fs.writeFileSync(`${OUT}/bench-netlist-node.json`, JSON.stringify({ results, stats: e.stats, parts: e.board.parts.map((p) => [p.ref, p.kind]), wires: e.board.wires.map((w) => [w.zh, w.a, w.b, w.awg, w.len]) }, null, 1));
const nf = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - nf} 通过 / ${nf} 失败`);
process.exit(nf ? 1 : 0);
