// 装配台和维修关卡共用的直流计算基础（v17 从 netlist.js 拆出来，数值和算法没改）。纯函数，Node 里也能直接 import。
export const LED_VF = 2.0; // 估算：红色 LED 典型正向压降
export const LED_RS = 15; // 估算：LED 导通后的等效串联电阻
export const LED_OVER_MA = 20, LED_BURN_MA = 50; // 20 mA 为常见 5 mm LED 的额定电流；50 mA 烧坏阈值为估算
export const BEEP_OHM = 30; // 通断档“嘀”的阈值（装配台一直用 30 Ω）
export const fmtOhm = (ohm) => (ohm < 1000 ? `${ohm.toFixed(1)} Ω` : ohm < 1e6 ? `${(ohm / 1000).toFixed(2)} kΩ` : `${(ohm / 1e6).toFixed(2)} MΩ`);
export const SERVO_MIN_V = 4.5; // 估算：微型舵机常见工作电压 4.8–6 V，低于约 4.5 V 这里就不动

// 解线性方程组（高斯消元，部分主元）
export function gauss(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-15) continue;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = Math.abs(A[r][r]) < 1e-15 ? 0 : s / A[r][r];
  }
  return x;
}

// 两点之间的等效电阻：只看电阻网络（R = [{na, nb, r}]），从 a 注入 1 A、b 接地，解出 a 点电压；不连通 = Infinity
export function ohmsBetween(R, a, b) {
  if (a === b) return 0;
  const adj = new Map();
  for (const r of R) { (adj.get(r.na) || adj.set(r.na, []).get(r.na)).push(r.nb); (adj.get(r.nb) || adj.set(r.nb, []).get(r.nb)).push(r.na); }
  const seen = new Set([a]);
  const st = [a];
  while (st.length) { const x = st.pop(); for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); st.push(y); } }
  if (!seen.has(b)) return Infinity;
  const nodes = [...seen].filter((n) => n !== b);
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const A = Array.from({ length: nodes.length }, () => new Array(nodes.length).fill(0));
  const rhs = new Array(nodes.length).fill(0);
  for (const r of R) {
    if (!seen.has(r.na)) continue;
    const g = 1 / r.r, i = idx.get(r.na), j = idx.get(r.nb);
    if (i != null) A[i][i] += g;
    if (j != null) A[j][j] += g;
    if (i != null && j != null) { A[i][j] -= g; A[j][i] -= g; }
  }
  rhs[idx.get(a)] = 1;
  const x = gauss(A, rhs);
  const ohm = x[idx.get(a)];
  return ohm;
}
