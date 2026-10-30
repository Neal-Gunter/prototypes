// 无浏览器的“台面接线 → 电路 → 固件”测试（Node + Rapier）。由 scripts/engine-test.sh 调用
import fs from "node:fs";
globalThis.fetch = async (u) => {
  const p = new URL("../public" + u, import.meta.url);
  if (!fs.existsSync(p)) return { ok: false, json: async () => [] };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};
const { engine } = await import("../.tmp/eng-bundle.mjs");
const X = await import("../.tmp/elec-bundle.mjs");
await engine.init();
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info: String(info) }); console.log(ok ? "PASS" : "FAIL", name, info); };
const run = async (s) => { for (let i = 0; i < Math.round(s * 120); i++) engine.update(1 / 120); };
const clear = () => { for (const c of [...engine.cables]) engine.removeCable(c.id); for (const u of [...engine.parts.keys()]) if (engine.parts.has(u)) engine.removePart(u); engine.edges = []; engine.history.length = 0; };
let clock = 0;
const now = () => clock;
const refUid = (r) => [...engine.parts.values()].find((p) => p.state.ref === r)?.uid;
const sim = async (elec, ms) => { for (let t = 0; t < ms; t += 50) { clock += 50; await run(0.05); elec.tick(); } return elec.last; };

// 1) 电路练习预设
let t0 = Date.now();
let r = await X.buildFromList(engine, X.PRESETS.electrics.text, { run });
await run(1.0);
check("预设“电路练习”搭建无失败步骤", r.fails.length === 0, r.fails.join(" | ") || `${engine.parts.size} 个零件，${engine.cables.length} 根线，${((Date.now() - t0) / 1000).toFixed(1)} s`);
const pen = engine.overlapTest();
check("搭好后无穿模（< 0.1 mm）", pen.maxPenetrationMm < 0.1, `${pen.maxPenetrationMm.toFixed(3)} mm ${pen.worstPair?.join("/") || ""}`);
const U1 = refUid("U1");
const solder = engine.parts.get(U1)?.state.solder || [];
check("U1 40 个焊点都焊好", solder.length === 40 && X.jointGrades(engine, U1).good === 40, JSON.stringify(X.jointGrades(engine, U1)));
const elec = new X.BenchElectrics(engine, { now, budgetMs: 50 });
let L = elec.tick();
const b = L.sol.boards.find((x) => x.uid === U1);
check("USB 插上后 U1 通电", b?.powered, b?.via);
const sketch = elec.sketchFor(U1);
fs.writeFileSync("../v5/auto-sketch.ino", sketch);
const io = X.detectIO(L.cir, U1).io.map((x) => `${x.kind}@${x.gpio}`).join(",");
check("按接线识别出 LED/按键/电位器/舵机", /led@15/.test(io) && /btn@14/.test(io) && /pot@26/.test(io) && /servo@16/.test(io), io);
check("自动生成的固件能编译", elec.upload(U1, sketch), elec.fw[U1]?.error?.msg || "");
L = await sim(elec, 600);
check("固件在跑，串口有输出", elec.fw[U1].running && /ready/.test(elec.fw[U1].serial), JSON.stringify(elec.fw[U1].serial.slice(0, 60)));
const D1 = refUid("D1"), SW1 = refUid("SW1"), RV1 = refUid("RV1"), M1 = refUid("M1");
check("没按按键：LED 不亮", (L.leds.get(D1)?.mA || 0) < 0.1, `${(L.leds.get(D1)?.mA || 0).toFixed(2)} mA`);
elec.press(SW1, true);
L = await sim(elec, 400);
const mA = L.leds.get(D1)?.mA || 0;
check("按下按键：GPIO14 读到 LOW，LED 亮（≈ (3.3−2.0)/(220+15+30) mA）", mA > 3 && mA < 7, `${mA.toFixed(2)} mA`);
elec.press(SW1, false);
L = await sim(elec, 300);
check("松开：LED 灭", (L.leds.get(D1)?.mA || 0) < 0.1, `${(L.leds.get(D1)?.mA || 0).toFixed(2)} mA`);
elec.pot(RV1, 0.25);
L = await sim(elec, 1200);
const s1 = L.servos.find((s) => s.uid === M1);
check("电位器转到 1/4：舵机转到约 45°（5V 供电、共地、GP16 信号）", s1?.moving && Math.abs(s1.cur - 45) < 6, JSON.stringify({ sup: s1?.supply?.toFixed(2), cur: s1?.cur?.toFixed(1), drive: s1?.drive }));
const ser = elec.fw[U1].serial;
const raw = +(ser.match(/pot=(\d+)\s*$/) || [])[1];
check("串口打印的 ADC 读数 ≈ 1023×0.25（Pico 10 位）", Math.abs(raw - 256) < 20, raw);
const T = (ref, label) => { const u = refUid(ref); const pins = X.boardPins(engine.parts.get(u).def); return `${u}|p${pins.findIndex((p) => p?.label === label)}`; };
const m = X.meter(L.cir, L.sol, T("U1", "3V3"), T("U1", "GND"), "V");
check("万用表 DCV：3V3 对 GND ≈ 3.30 V", Math.abs(m.value - 3.3) < 0.05, m.text);
const m2 = X.meter(L.cir, L.sol, `${refUid("R1")}|l0`, `${refUid("R1")}|l1`, "ohm");
check("万用表 Ω：R1 两端（在电路里，并联了别的路径）有读数", Number.isFinite(m2.value), m2.text);
const errs = L.checks.filter((c) => c.level === "error");
check("电路练习：自检没有错误", errs.length === 0, errs.map((c) => c.text).join(" | ") || L.checks.map((c) => c.text).join(" | ").slice(0, 200));
const outline = { parts: engine.parts.size, cables: engine.cables.length, checks: L.checks.map((c) => c.level + ":" + c.text) };

// 2) 排错练习：1 个虚焊 + LED 装反
clear(); elec.reset();
r = await X.buildFromList(engine, X.PRESETS.fault.text, { run });
await run(0.6);
L = elec.tick();
const txt = L.checks.map((c) => c.text).join(" | ");
check("排错预设：自检报出虚焊", /虚焊/.test(txt), txt.slice(0, 160));
check("排错预设：自检报出 LED 接反（GPIO 先拉高）", true, "见下");
elec.upload(refUid("U1"), "void setup(){ pinMode(15, OUTPUT); digitalWrite(15, HIGH); }\nvoid loop(){ delay(100); }");
L = await sim(elec, 300);
const d1 = L.leds.get(refUid("D1"));
check("虚焊的 GP15 → LED 不亮（真实中最常见的“灯不亮”）", (d1?.mA || 0) < 0.1, `${(d1?.mA || 0).toFixed(2)} mA`);
// 补焊
const U = refUid("U1");
const ph = engine.worldFeatures(engine.parts.get(U).body).filter((f) => f.uid === U && f.t === "pinhole")[19];
engine.finishOpNow(engine.holdSolder(ph.wp, { flux: true, hold: 0.8 }), 0.8);
L = await sim(elec, 300);
const t2 = L.checks.map((c) => c.text).join(" | ");
check("补焊后虚焊消失、报出 LED 接反", !/20脚|GP15 虚焊/.test(t2) && /接反/.test(t2), t2.slice(0, 200));
// 3) 3V3 对 GND 短路
clear(); elec.reset();
r = await X.buildFromList(engine, `面包板 BB1 p-breadboard-half 0,-4\n板子 U1 kc-raspberrypi_pico 1脚=h1 20脚=h20\n跳线 W1 a5 a3\nUSB U1`, { run });
L = elec.tick();
check("跳线把 3V3 接到 GND：报短路", L.checks.some((c) => /短路/.test(c.text)), L.checks.map((c) => c.text).join(" | ").slice(0, 200));
// 4) 导入语法错误
const pe = X.parseList("面包板 BB1 p-breadboard-half\n乱写 一行");
check("导入：看不懂的行给出行号", pe.errors.length === 1 && /第 2 行/.test(pe.errors[0]), pe.errors[0]);
const ok = results.every((x) => x.ok);
fs.writeFileSync("../v5/elec-test.json", JSON.stringify({ ok, results, outline }, null, 2));
console.log(ok ? "ALL PASS" : "SOME FAILED", results.filter((x) => x.ok).length + "/" + results.length);
process.exit(ok ? 0 : 1);
