// v18 示波器关卡 headless 测试：node scripts/scope-test.mjs
//   每关：1) 故障在示波器数据里看得到（scopeExpect.faulty）  2) 预期修法修好、示波器数据回到 fixed、验收通过
//         3) 每个错误修法都修不好  4) 万用表 expect（如有）  5) 示波器动作本身能在游戏里用（do_scope 写日志）
import { SCOPE_SCENARIOS, metricOf } from "../src/repair/scopeScenarios.js";
import { Game, buildScenario, evaluate } from "../src/repair/game.js";
import { simulate, meter } from "../src/repair/board.js";
import { makeBoard } from "../src/repair/boards.js";
import { capture } from "../src/repair/tboard.js";
import fs from "node:fs";
let pass = 0, fail = 0; const results = [];
const ok = (name, c, info = "") => { results.push({ name, ok: !!c, info: String(info) }); if (c) pass++; else fail++; console.log(c ? "PASS" : "FAIL", name, info); };
const inR = (v, r) => Number.isFinite(v) && v >= r[0] - 1e-9 && v <= r[1] + 1e-9;
const fmt = (v) => (Math.abs(v) >= 1 || v === 0 ? v.toFixed(3) : (v * 1000).toFixed(1) + "m");
const play = (sc, groups) => { const g = new Game(sc, { autoTool: true }); for (const grp of groups) for (const a of grp) g.act(a); const bat = g.board.parts.find((p) => p.kind === "bat"); if (bat?.state.present === false) g.act({ a: "battery", op: "insert" }); g.act({ a: "power", on: false }); g.act({ a: "deliver" }); return g; };
const t0 = Date.now();
ok("至少 6 个示波器关卡（4 单板 + 2 多板）", SCOPE_SCENARIOS.length >= 6 && SCOPE_SCENARIOS.filter((s) => s.faults.some((f) => /^CB/.test(f.target))).length >= 2);
ok("关卡是纯 JSON", SCOPE_SCENARIOS.every((s) => JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s)));
{ const ev = evaluate(makeBoard("rig")); ok("rig 模板无故障验收通过", ev.ok, ev.checks.filter((c) => !c.ok).map((c) => c.zh + c.info).join("；")); }
const table = [];
for (const sc of SCOPE_SCENARIOS) {
  const T = `[${sc.id}]`;
  const b0 = buildScenario(sc);
  ok(`${T} 带故障验收不过`, !evaluate(b0).ok);
  ok(`${T} 提示 / 根因 / 教训 / 安全齐全`, sc.hints.length === 3 && sc.rootCause && sc.lesson && sc.safety.length);
  const g = play(sc, sc.solution);
  ok(`${T} 预期修法修好`, g.solved, g.log.filter((l) => l.bad).map((l) => l.text).join(" | "));
  for (const e of sc.scopeExpect) {
    const vf = metricOf(capture(b0, e.cap), e.metric), vx = metricOf(capture(g.board, e.cap), e.metric);
    ok(`${T} 示波器看得到故障：${e.zh}`, inR(vf, e.faulty), `${fmt(vf)} 期望 ${e.faulty}`);
    ok(`${T} 修好后示波器恢复：${e.zh}`, inR(vx, e.fixed), `${fmt(vx)} 期望 ${e.fixed}`);
    table.push({ id: sc.id, zh: e.zh, faulty: vf, fixed: vx });
  }
  for (const e of sc.expect || []) { const rd = (b) => meter(b, simulate(b, { power: e.power, run: e.run }), e.red, e.black, e.mode).value; ok(`${T} 万用表：${e.zh}`, inR(rd(b0), e.faulty) && inR(rd(g.board), e.fixed), `${fmt(rd(b0))} → ${fmt(rd(g.board))}`); }
  sc.wrong.forEach((w, i) => { const r = play(sc, [w]); ok(`${T} 错误修法 ${i + 1} 修不好`, !r.solved, (r.lastEval?.checks || []).filter((c) => !c.ok).map((c) => c.zh).join("；")); });
  const gs = new Game(sc, { autoTool: true }); const e0 = sc.scopeExpect[0]; if (e0.cap.exp === "run") gs.act({ a: "power", on: true });
  const r = gs.act({ a: "scope", ...e0.cap });
  ok(`${T} 游戏内示波器动作可用`, r.ok && r.cap && gs.log.some((l) => l.kind === "示波器"), gs.log.at(-1)?.text?.slice(0, 80));
}
// 安全：外壳盖住 / 电池拆掉时不能抓
{ const sc = SCOPE_SCENARIOS[0]; const g = new Game(sc, { autoTool: true }); g.act({ a: "power", on: false }); g.act({ a: "battery", op: "remove" }); const r = g.act({ a: "scope", exp: "steady", tdiv: 1e-3, chans: [{ node: "5V" }] }); ok("没电池时示波器只有 0 V 线（拒绝抓）", r.ok === false); }
const ms = Date.now() - t0;
console.log(`\n合计 ${pass} 通过，${fail} 失败（${(ms / 1000).toFixed(1)} s）`);
if (process.env.OUT) { fs.mkdirSync(process.env.OUT, { recursive: true }); fs.writeFileSync(`${process.env.OUT}/scope-test.json`, JSON.stringify({ pass, fail, ms, results, table }, null, 1)); }
process.exit(fail ? 1 : 0);
