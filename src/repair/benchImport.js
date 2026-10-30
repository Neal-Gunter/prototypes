// 浏览器端：把装配台当前电路（elec.last.cir）整理成编辑器能用的中性描述（见 editor.js fromBench）
import { boardPins, boardOf } from "../assembly/netlist.js";

export const BENCH_KEY = "repair.benchImport.v1";

export function benchToDesc(cir) {
  if (!cir) return null;
  const N = (t) => cir.node(t);
  const boards = [];
  let ground = null;
  for (const [uid, via] of cir.powered || []) {
    const P = cir.engine.parts.get(uid);
    if (!P || !boardOf(P.def)) continue;
    const pins = boardPins(P.def);
    const T = (i) => N(cir.T(uid, `p${i}`));
    const g = pins.findIndex((p) => p?.role === "gnd");
    if (g < 0) continue;
    const gnd = T(g);
    if (!ground) ground = gnd;
    const sources = [];
    const seen = new Set();
    pins.forEach((p, i) => {
      if (!p) return;
      const n = T(i);
      if (seen.has(n)) return;
      if (p.role === "3v3") { sources.push({ node: n, v: 3.3, r: 0.1, zh: p.label }); seen.add(n); }
      if (p.role === "5v" && via === "USB") { sources.push({ node: n, v: 5.0, r: 0.2, zh: p.label }); seen.add(n); }
    });
    boards.push({ id: uid, zh: P.state.ref || boardOf(P.def).short, sources, gnd });
  }
  const refOf = (uid) => cir.engine.parts.get(uid)?.state?.ref || uid;
  const els = [];
  for (const e of cir.els) {
    if (e.t === "R") els.push({ t: "R", a: N(e.a), b: N(e.b), r: e.r, ref: refOf(e.uid), zh: `${refOf(e.uid)}（装配台，${e.r} Ω）` });
    if (e.t === "LED") els.push({ t: "LED", a: N(e.a), k: N(e.k), ref: refOf(e.uid), zh: `${refOf(e.uid)}（装配台 LED）` });
  }
  // 所有板子的地并成一个
  for (const b of boards) { if (b.gnd !== ground) { for (const e of els) for (const k of ["a", "b", "k"]) if (e[k] === b.gnd) e[k] = ground; b.gnd = ground; } }
  return { name: "从装配台导入的电路", ground, boards, els, at: new Date().toISOString() };
}
