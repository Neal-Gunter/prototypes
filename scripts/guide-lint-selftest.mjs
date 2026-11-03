// v35（我的补充）：给 guide-lint 的维修关卡检查喂几份故意改坏的关卡，确认每种错误都能被抓到（不是“永远 0 个问题”）。
process.env.LINT_NO_EXIT = "1";
const { lintRepair } = await import("./guide-lint.mjs");
const { SCENARIOS } = await import("../src/repair/scenarios.js");
const deps = { ...(await import("../src/repair/game.js")), ...(await import("../src/repair/boards.js")), ...(await import("../src/repair/faults.js")) };
const base = structuredClone(SCENARIOS.find((s) => s.template === "led"));
const cases = [
  ["星级越界", (s) => { s.stars = 7; }, /星级/],
  ["模板不存在", (s) => { s.template = "nope"; }, /模板/],
  ["故障类型", (s) => { s.faults[0].type = "gremlin"; }, /故障类型/],
  ["故障目标", (s) => { s.faults[0].target = "R99"; }, /不在板子上/],
  ["操作不认识", (s) => { s.solution[0].push({ a: "hammer" }); }, /不认识/],
  ["零件箱", (s) => { s.solution[0].push({ a: "place", ref: "R1", item: "res-unobtainium" }); }, /零件箱/],
  ["量测脚", (s) => { s.expect[0].red = { ref: "BT1", pin: "Z" }; }, /没有这个脚/],
  ["网络", (s) => { s.expect[0].black = { net: "NOPE" }; }, /网络/],
  ["区间", (s) => { s.expect[0].fixed = [5, 1]; }, /区间/],
  ["提示", (s) => { s.hints = ["只有一条"]; }, /提示/],
  ["安全", (s) => { s.safety = []; }, /安全/],
  ["重复 id", null, /重复/],
];
let pass = 0, fail = 0;
for (const [name, mut, rx] of cases) {
  const list = mut ? [(() => { const s = structuredClone(base); mut(s); return s; })()] : [structuredClone(base), structuredClone(base)];
  const r = lintRepair(list, deps).rprobs;
  const ok = r.some((m) => rx.test(m));
  ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗"} ${name}：${r[0] || "没抓到"}`);
}
const clean = lintRepair(SCENARIOS, deps).rprobs.length;
clean === 0 ? pass++ : fail++; console.log(`${clean === 0 ? "✓" : "✗"} 原始 ${SCENARIOS.length} 关：${clean} 个问题`);
console.log(`guide-lint 自检：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
