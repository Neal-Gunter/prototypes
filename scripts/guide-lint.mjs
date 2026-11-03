// v34（我的补充）：拆解指南数据检查（类似电路仿真工具给 diagram 文件做 lint 的思路，代码是本项目自己写的）。
// 逐台设备检查：id 唯一、只收 ≤ 24 V 直流、有电池的设备安全须知里有“电池先处理”、难度 1–5 / 时间 > 0、
// 每一步中英文都有、插图引用的图层存在、至少一个停止点、模块指向的零件在零件库里、爆炸图模块 key 唯一。
// v35：同样检查维修关卡（src/repair/scenarios.js）：id 唯一、1–5 星、板子模板存在、故障类型认识、故障 / 操作指向的零件 / 线 / 走线 / 盖子在板子上、
//   换上的零件在零件箱里、量测点（零件脚 / 网络 / 测试点）存在、期望读数区间有效、至少 2 条提示、有安全须知、电池电压 ≤ 24 V。
// 用法：node scripts/guide-lint.mjs   （有问题时退出码 1）
import fs from "node:fs";
const { DEVICES } = await import("../src/teardown/devices.js");
const idx = JSON.parse(fs.readFileSync(new URL("../public/lib/index.json", import.meta.url), "utf8"));
const known = new Set(idx.parts.map((p) => p[0]));
// 程序生成零件的 id 列表来自 .tmp/proc-bundle.mjs（sh scripts/engine-test.sh elec-bundle-only 会生成）
let proc = new Set();
try { proc = new Set((await import("../.tmp/proc-bundle.mjs")).PROCEDURAL.map((d) => d.id)); } catch { console.log("（没有 .tmp/proc-bundle.mjs，先跑 sh scripts/engine-test.sh elec-bundle-only）"); process.exit(2); }
const exists = (id) => known.has(id) || proc.has(id);
const both = (x) => x && typeof x.zh === "string" && x.zh.trim() && typeof x.en === "string" && x.en.trim();
const probs = [], seen = new Set();
for (const d of DEVICES) {
  const bad = (m) => probs.push(`${d.id}: ${m}`);
  if (seen.has(d.id)) bad("id 重复"); seen.add(d.id);
  if (!(d.volts > 0 && d.volts <= 24)) bad(`电压 ${d.volts} V 不在 0–24 V 直流范围`);
  if (!both(d.name) || !both(d.summary)) bad("名称或简介缺中文 / 英文");
  if (!(d.difficulty >= 1 && d.difficulty <= 5) || !(d.minutes > 0)) bad(`难度 ${d.difficulty} / 时间 ${d.minutes} 分钟不合理`);
  if (!d.materials?.length || !d.materials.every(both)) bad("工具材料清单为空或缺译文");
  if (d.battery && !d.safety?.some((s) => s.zh.includes("电池先处理"))) bad("有电池但安全须知里没有“电池先处理”");
  const layers = new Set((d.fig || []).map((f) => f.id));
  if (layers.size !== (d.fig || []).length) bad("插图图层 id 重复");
  if ((d.steps || []).length < 3) bad("步骤少于 3 步");
  let stops = 0;
  (d.steps || []).forEach((s, i) => {
    if (!both(s.t) || !both(s.d)) bad(`第 ${i + 1} 步缺中文 / 英文`);
    if (s.stop) { stops++; if (!both(s.stop)) bad(`第 ${i + 1} 步停止点缺译文`); }
    for (const k of [...(s.fig?.hi || []), ...Object.keys(s.fig?.off || {})]) if (!layers.has(k)) bad(`第 ${i + 1} 步插图引用了不存在的图层 ${k}`);
  });
  if (!stops) bad("没有停止点");
  const keys = new Set();
  for (const m of d.modules || []) {
    if (keys.has(m.key)) bad(`模块 key ${m.key} 重复`); keys.add(m.key);
    if (!["same", "similar", "approx"].includes(m.match)) bad(`模块 ${m.key} 的 match=${m.match} 不认识`);
    if (!exists(m.part)) bad(`模块 ${m.key} 指向的零件 ${m.part} 在零件库里找不到`);
    if (!both(m.t)) bad(`模块 ${m.key} 缺译文`);
  }
}
export function lintRepair(SCENARIOS, { ACTIONS, BIN, makeBoard, FAULTS }) {
const rprobs = [], rseen = new Set(); let nAct = 0, nExp = 0;
const str = (x) => typeof x === "string" && x.trim();
for (const sc of SCENARIOS) {
  const bad = (m) => rprobs.push(`关卡 ${sc.id}: ${m}`);
  if (rseen.has(sc.id)) bad("id 重复"); rseen.add(sc.id);
  if (!(sc.stars >= 1 && sc.stars <= 5)) bad(`星级 ${sc.stars} 不在 1–5`);
  if (!(sc.parMin > 0)) bad("参考用时缺失");
  for (const k of ["title", "complaint", "rootCause", "lesson"]) if (!str(sc[k])) bad(`缺 ${k}`);
  if (!(sc.hints?.length >= 2) || !sc.hints.every(str)) bad("提示少于 2 条或有空提示");
  if (!(sc.safety?.length) || !sc.safety.every(str)) bad("没有安全须知");
  if (!(sc.symptoms?.length)) bad("没有症状描述");
  let b; try { b = makeBoard(sc.template); } catch (e) { bad(`板子模板 ${sc.template} 建不出来：${e.message}`); continue; }
  const refs = new Set(b.parts.map((x) => x.ref)), pinsOf = Object.fromEntries(b.parts.map((x) => [x.ref, new Set(Object.keys(x.pins || {}))]));
  const wires = new Set((b.wires || []).map((w) => w.id)), traces = new Set((b.traces || []).map((t) => t.id)), covers = new Set((b.covers || []).map((c) => c.id)), tps = new Set((b.testpoints || []).map((t) => t.id)), nets = new Set(Object.keys(b.nets || {}));
  for (const x of b.parts) if (x.kind === "bat" && !(x.props?.v <= 24)) bad(`电池 ${x.ref} 电压 ${x.props?.v} V 超过 24 V`);
  const target = (t) => t === undefined || refs.has(t) || wires.has(t) || traces.has(t);
  for (const f of sc.faults || []) {
    if (!FAULTS[f.type]) bad(`故障类型 ${f.type} 不认识`);
    if (!target(f.target)) bad(`故障 ${f.type} 指向的 ${f.target} 不在板子上`);
  }
  const probe = (pr, w) => { if (!pr) return; if (pr.ref) { if (!refs.has(pr.ref)) bad(`${w} 量的零件 ${pr.ref} 不在板子上`); else if (!pinsOf[pr.ref].has(pr.pin)) bad(`${w} 量的 ${pr.ref}.${pr.pin} 没有这个脚`); } else if (pr.net) { if (!nets.has(pr.net)) bad(`${w} 量的网络 ${pr.net} 不存在`); if (pr.tp && !tps.has(pr.tp)) bad(`${w} 的测试点 ${pr.tp} 不存在`); } };
  (sc.expect || []).forEach((e, i) => {
    nExp++; const w = `期望读数 ${i + 1}`;
    probe(e.red, w); probe(e.black, w);
    for (const [k, r] of [["故障时", e.faulty], ["修好后", e.fixed]]) if (!Array.isArray(r) || r.length !== 2 || !(r[0] <= r[1])) bad(`${w} 的${k}区间无效`);
    if (!str(e.zh)) bad(`${w} 没有说明`);
  });
  if (!(sc.solution?.length)) bad("没有修法");
  for (const [gi, g] of [...(sc.solution || []).map((g) => ["修法", g]), ...(sc.wrong || []).map((g) => ["错误做法", g])].entries()) for (const a of g[1]) {
    nAct++; const w = `${g[0]}（第 ${gi + 1} 组）的操作 ${a.a}`;
    if (!ACTIONS[a.a]) { bad(`${w} 不认识`); continue; }
    if (a.ref && !refs.has(a.ref)) bad(`${w} 指向的零件 ${a.ref} 不在板子上`);
    if (a.ref && a.pin && !pinsOf[a.ref]?.has(a.pin)) bad(`${w} 指向的 ${a.ref}.${a.pin} 没有这个脚`);
    if (a.trace && !traces.has(a.trace)) bad(`${w} 指向的走线 ${a.trace} 不存在`);
    if (a.item && !BIN[a.item]) bad(`${w} 用的零件 ${a.item} 不在零件箱里`);
    if (a.a === "cover" && a.id && !covers.has(a.id)) bad(`${w} 的盖子 ${a.id} 不存在`);
  }
}
  return { rprobs, nAct, nExp };
}
// ---- v35：维修关卡 ----
const { SCENARIOS } = await import("../src/repair/scenarios.js");
const { ACTIONS, BIN } = await import("../src/repair/game.js");
const { makeBoard } = await import("../src/repair/boards.js");
const { FAULTS } = await import("../src/repair/faults.js");
const { rprobs, nAct, nExp } = lintRepair(SCENARIOS, { ACTIONS, BIN, makeBoard, FAULTS });
console.log(JSON.stringify({ repairLevels: SCENARIOS.length, expects: nExp, actions: nAct, repairProblems: rprobs.length }));
for (const p of rprobs) console.log("✗", p);
probs.push(...rprobs);
console.log(JSON.stringify({ devices: DEVICES.length, steps: DEVICES.reduce((a, d) => a + d.steps.length, 0), modules: DEVICES.reduce((a, d) => a + (d.modules || []).length, 0), problems: probs.length }));
for (const p of probs) console.log("✗", p);
if (!process.env.LINT_NO_EXIT) process.exit(probs.length ? 1 : 0);
