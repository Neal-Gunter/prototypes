// 维修关卡的直流求解器（早期原型，简化仿真）。
// 复用装配台的高斯消元和 LED 分段模型（../assembly/dcmath.js），在它上面加了：
//   · 两端电压源（Norton 等效：电池可以“浮”在两个节点之间，不一定接地）
//   · 恒流元件（稳压 / 升压限流时用）
//   · 普通二极管（自己的正向压降）
//   · 按连通分量分别求解：不和任何源连在一起的节点算“悬空”（量电压时读数乱跳）
// 只算稳态直流，没有电容、电感、开关纹波和温度。
import { gauss } from "../assembly/dcmath.js";

// els: {t:"R",a,b,r} | {t:"D",a,k,vf,rs} | {t:"V",p,n,v,r} | {t:"I",from,to,i}（电流从 from 经元件流到 to）
export function solveDC(els, ground = "GND") {
  const adj = new Map();
  const link = (x, y) => { (adj.get(x) || adj.set(x, new Set()).get(x)).add(y); (adj.get(y) || adj.set(y, new Set()).get(y)).add(x); };
  for (const e of els) {
    if (e.t === "R") link(e.a, e.b); else if (e.t === "D") link(e.a, e.k); else if (e.t === "V") link(e.p, e.n); else if (e.t === "I") { adj.has(e.from) || adj.set(e.from, new Set()); adj.has(e.to) || adj.set(e.to, new Set()); }
  }
  // 连通分量（按 R / D / V 的连线）
  const comp = new Map();
  let nc = 0;
  for (const n of adj.keys()) {
    if (comp.has(n)) continue;
    const st = [n]; comp.set(n, nc);
    while (st.length) { const x = st.pop(); for (const y of adj.get(x)) if (!comp.has(y)) { comp.set(y, nc); st.push(y); } }
    nc++;
  }
  // 有源的分量才有确定电压；没有源的分量 = 悬空
  const hasSrc = new Array(nc).fill(false);
  for (const e of els) if (e.t === "V") hasSrc[comp.get(e.p)] = true;
  if (adj.has(ground)) hasSrc[comp.get(ground)] = hasSrc[comp.get(ground)] || els.some((e) => e.t === "V" && comp.get(e.p) === comp.get(ground));
  const ref = new Map(); // 分量 -> 参考节点
  for (const [n, c] of comp) if (n === ground) ref.set(c, n);
  for (const [n, c] of comp) if (!ref.has(c)) ref.set(c, n);
  const nodes = [...comp.keys()].filter((n) => hasSrc[comp.get(n)] && ref.get(comp.get(n)) !== n);
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const diodes = els.filter((e) => e.t === "D");
  let on = diodes.map(() => false);
  let x = new Array(nodes.length).fill(0);
  const V = (n) => (idx.has(n) ? x[idx.get(n)] : 0);
  for (let it = 0; it < 30; it++) {
    const A = Array.from({ length: nodes.length }, () => new Array(nodes.length).fill(0));
    const b = new Array(nodes.length).fill(0);
    const stamp = (p, q, g, ieq) => { // 电导 g 在 p–q 之间，外加从 q 流向 p 的等效电流 ieq
      const i = idx.get(p), j = idx.get(q);
      if (i != null) { A[i][i] += g; b[i] += ieq; }
      if (j != null) { A[j][j] += g; b[j] -= ieq; }
      if (i != null && j != null) { A[i][j] -= g; A[j][i] -= g; }
    };
    for (const e of els) {
      if (!hasSrc[comp.get(e.t === "I" ? e.from : e.a ?? e.p)]) continue;
      if (e.t === "R") stamp(e.a, e.b, 1 / e.r, 0);
      else if (e.t === "V") stamp(e.p, e.n, 1 / e.r, e.v / e.r);
      else if (e.t === "I") { const i = idx.get(e.from), j = idx.get(e.to); if (i != null) b[i] -= e.i; if (j != null) b[j] += e.i; }
    }
    diodes.forEach((d, k) => { if (!hasSrc[comp.get(d.a)]) return; if (on[k]) stamp(d.a, d.k, 1 / d.rs, d.vf / d.rs); else stamp(d.a, d.k, 1e-9, 0); });
    x = gauss(A, b);
    const next = diodes.map((d) => V(d.a) - V(d.k) > d.vf);
    if (next.every((v, k) => v === on[k])) break;
    on = next;
  }
  const v = (n) => (comp.has(n) && hasSrc[comp.get(n)] ? V(n) : null);
  const iOf = (e) => {
    if (e.t === "R") { const a = v(e.a), b0 = v(e.b); return a == null || b0 == null ? 0 : (a - b0) / e.r; }
    if (e.t === "D") { const a = v(e.a), k = v(e.k); if (a == null || k == null) return 0; const d = a - k; return d > e.vf ? (d - e.vf) / e.rs : 0; }
    if (e.t === "V") { const p = v(e.p), n = v(e.n); return p == null || n == null ? 0 : (e.v - (p - n)) / e.r; } // 源送出的电流
    if (e.t === "I") return e.i;
    return 0;
  };
  // 两点能不能比较电压：同一个有源连通分量
  const same = (a, b0) => comp.has(a) && comp.has(b0) && comp.get(a) === comp.get(b0) && hasSrc[comp.get(a)];
  return { v, i: iOf, same, comp };
}
