// 时域（瞬态）电路求解器（v18，早期原型，简化仿真）。手写，无第三方依赖。
// 方法：改进节点法（只用节点电压；电压源都带串联内阻 → 诺顿等效），固定步长，
//   电容 / 电感用伴随模型：梯形法（默认，二阶精度）或后向欧拉（一阶，数值阻尼大）。
//   拓扑变化（二极管通断、开关动作、器件换模式）之后的第一步自动改用后向欧拉，免得梯形法“数值振铃”（SPICE 也这么做）。
// 元件（全部是可变的普通对象，行为器件每一步可以改 v / i / on）：
//   R {a,b,r} · C {a,b,c,esr?} · L {a,b,l,dcr?} · V {p,n,v(数或函数 t→V),r} · I {from,to,i(数或函数)}（电流从 from 经元件流到 to）
//   D {a,k,vf,rs,goff?}（分段线性：导通 = vf + rs，截止 = goff）· S {a,b,ron,roff,on(布尔或函数 t→布尔)}
//   X 行为器件：{t:"X", expand(add) → 加原始元件, update(ctx) 每步求解前, after(ctx) 每步接受后, dc(ctx) 直流工作点迭代时}
// 每个节点对地并一个 gmin（1 nS），悬空节点不会让矩阵奇异（读数接近 0，界面另外标“悬空”）。
// 已知简化：行为器件用上一步的解（显式耦合，步长要比器件时间常数小）；没有温度、没有电磁干扰、没有寄生参数（除非显式加了元件）。

export const GMIN = 1e-9;

// ---------- 稠密 LU（部分主元），按“拓扑签名”缓存 ----------
function luFactor(A, n) {
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(A[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r * n + c]); if (v > best) { best = v; p = r; } }
    if (p !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; } const t = piv[c]; piv[c] = piv[p]; piv[p] = t; }
    const d = A[c * n + c];
    if (Math.abs(d) < 1e-300) continue;
    for (let r = c + 1; r < n; r++) {
      const f = (A[r * n + c] /= d);
      if (!f) continue;
      for (let k = c + 1; k < n; k++) A[r * n + k] -= f * A[c * n + k];
    }
  }
  return { A, piv, n };
}
function luSolve({ A, piv, n }, b, x) {
  for (let i = 0; i < n; i++) x[i] = b[piv[i]];
  for (let i = 0; i < n; i++) { let s = x[i]; for (let k = 0; k < i; k++) s -= A[i * n + k] * x[k]; x[i] = s; }
  for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let k = i + 1; k < n; k++) s -= A[i * n + k] * x[k]; const d = A[i * n + i]; x[i] = Math.abs(d) < 1e-300 ? 0 : s / d; }
  return x;
}

const val = (f, t, ctx) => (typeof f === "function" ? f(t, ctx) : f);

// ---------- 网表准备 ----------
export function prepare(input, ground = "GND") {
  const prim = [];
  const devices = [];
  let k = 0;
  const add = (e) => { e._id = e._id ?? `e${k++}`; if (e.t === "C" && e.esr > 0) { const m = `${e._id}#esr`; prim.push({ t: "R", a: e.a, b: m, r: e.esr, _id: e._id + "r", ref: e.ref ? e.ref + "-esr" : undefined }); e.cap = { t: "C", a: m, b: e.b, c: e.c, _id: e._id + "c", v0: e.v0 }; prim.push(e.cap); e.node = m; return e; } if (e.t === "L" && e.dcr > 0) { const m = `${e._id}#dcr`; prim.push({ t: "R", a: e.a, b: m, r: e.dcr, _id: e._id + "r" }); e.ind = { t: "L", a: m, b: e.b, l: e.l, _id: e._id + "l", i0: e.i0 }; prim.push(e.ind); return e; } prim.push(e); return e; };
  for (const e of input) {
    if (e.t === "X") { devices.push(e); e.expand(add); } else add(e);
  }
  const nodes = new Map();
  const node = (n) => { if (n === ground || n == null) return -1; if (!nodes.has(n)) nodes.set(n, nodes.size); return nodes.get(n); };
  for (const e of prim) {
    if (e.t === "V") { e._p = node(e.p); e._n = node(e.n); }
    else if (e.t === "I") { e._p = node(e.from); e._n = node(e.to); }
    else if (e.t === "D") { e._p = node(e.a); e._n = node(e.k); e.goff = e.goff ?? 1e-9; }
    else { e._p = node(e.a); e._n = node(e.b); }
  }
  // 连通性：有电压源的连通分量才算“有确定电压”（和直流求解器 dc.js 一致）
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const uni = (a, b) => { for (const x of [a, b]) if (!parent.has(x)) parent.set(x, x); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const e of prim) { if (e.t === "I") { for (const x of [e.from, e.to]) if (!parent.has(x)) parent.set(x, x); continue; } const [a, b] = e.t === "V" ? [e.p, e.n] : e.t === "D" ? [e.a, e.k] : [e.a, e.b]; uni(a, b); } // 开关按“可能连通”处理
  const driven = new Set();
  for (const e of prim) if (e.t === "V") driven.add(find(e.p));
  const isDriven = (n) => parent.has(n) && driven.has(find(n));
  return { prim, devices, nodes, ground, n: nodes.size, isDriven };
}

// ---------- 主循环 ----------
// opt: { tStart, tStop, dt, method: "trap"|"be", init: "dc"|"zero", probes: [{ id, node } | { id, el, what: "i" } | { id, fn(ctx) }], every }
export function transient(input, opt = {}) {
  const ground = opt.ground || "GND";
  const net = input.prim ? input : prepare(input, ground);
  const { prim, devices, nodes, n } = net;
  const dt = opt.dt, t0 = opt.tStart ?? 0, t1 = opt.tStop;
  let h = dt; // 当前步长（固定步长时一直等于 dt）
  const method = opt.method || "trap";
  const steps = Math.max(1, Math.round((t1 - t0) / dt));
  const caps = prim.filter((e) => e.t === "C"), inds = prim.filter((e) => e.t === "L"), dio = prim.filter((e) => e.t === "D"), sws = prim.filter((e) => e.t === "S");
  for (const e of caps) { e.vn = 0; e.in = 0; }
  for (const e of inds) { e.vn = 0; e.in = 0; }
  for (const d of dio) d.on = d.on ?? false;
  let x = new Float64Array(n), xPrev = new Float64Array(n);
  const b = new Float64Array(n);
  const V = (nm) => { const i = nm === ground ? -1 : nodes.get(nm); return i == null || i < 0 ? 0 : x[i]; };
  const vOf = (i) => (i < 0 ? 0 : x[i]);
  const cache = new Map();
  const events = [];
  const ctx = { t: t0, dt, V, x: () => x, events, discontinuity: false, dc: false, cur: (e) => elemCurrent(e), log: (ev) => events.push({ t: ctx.t, ...ev }) };

  // 元件电流（a→b / p 送出 / from→to），用当前解
  function elemCurrent(e) {
    const w = e.cap || e.ind || e;
    if (w.t === "L") return ctx.dc ? 1e4 * (vOf(w._p) - vOf(w._n)) : w.in;
    if (w.t === "C") return ctx.dc ? 0 : w.in;
    const va = vOf(e._p), vb = vOf(e._n);
    switch (e.t) {
      case "R": return (va - vb) / e.r;
      case "V": return (e._v - (va - vb)) / e.r;
      case "I": return e._i ?? 0;
      case "D": return e.on ? (va - vb - e.vf) / e.rs : (va - vb) * e.goff;
      case "S": return (va - vb) * (e._on ? 1 / e.ron : 1 / e.roff);
      case "C": return e.in;
      case "L": return e.in;
      default: return 0;
    }
  }

  function matrixFor(mode) { // mode: "dc" | "be" | "trap"
    const sig = mode + "|" + h + "|" + dio.map((d) => (d.on ? 1 : 0)).join("") + "|" + sws.map((s) => (s._on ? 1 : 0)).join("");
    let lu = cache.get(sig);
    if (lu) return lu;
    const A = new Float64Array(n * n);
    const g2 = (p, q, g) => { if (p >= 0) A[p * n + p] += g; if (q >= 0) A[q * n + q] += g; if (p >= 0 && q >= 0) { A[p * n + q] -= g; A[q * n + p] -= g; } };
    for (let i = 0; i < n; i++) A[i * n + i] += GMIN;
    for (const e of prim) {
      if (e.t === "R") g2(e._p, e._n, 1 / e.r);
      else if (e.t === "V") g2(e._p, e._n, 1 / e.r);
      else if (e.t === "D") g2(e._p, e._n, e.on ? 1 / e.rs : e.goff);
      else if (e.t === "S") g2(e._p, e._n, e._on ? 1 / e.ron : 1 / e.roff);
      else if (e.t === "C") g2(e._p, e._n, mode === "dc" ? 0 : mode === "be" ? e.c / h : (2 * e.c) / h);
      else if (e.t === "L") g2(e._p, e._n, mode === "dc" ? 1e4 : mode === "be" ? h / e.l : h / (2 * e.l));
    }
    lu = luFactor(A, n);
    if (cache.size > 200) cache.clear();
    cache.set(sig, lu);
    return lu;
  }

  function solveStep(mode, t) {
    for (const s of sws) s._on = !!val(s.on, t, ctx);
    for (let it = 0; it < 12; it++) {
      b.fill(0);
      const inj = (p, q, i) => { if (p >= 0) b[p] += i; if (q >= 0) b[q] -= i; };
      for (const e of prim) {
        if (e.t === "V") { e._v = val(e.v, t, ctx); inj(e._p, e._n, e._v / e.r); }
        else if (e.t === "I") { e._i = val(e.i, t, ctx); inj(e._n, e._p, e._i); }
        else if (e.t === "D") { if (e.on) inj(e._p, e._n, e.vf / e.rs); }
        else if (e.t === "C" && mode !== "dc") { const g = mode === "be" ? e.c / h : (2 * e.c) / h; inj(e._p, e._n, mode === "be" ? g * e.vn : g * e.vn + e.in); }
        else if (e.t === "L" && mode !== "dc") { const g = mode === "be" ? h / e.l : h / (2 * e.l); inj(e._p, e._n, mode === "be" ? -e.in : -(e.in + g * e.vn)); }
      }
      luSolve(matrixFor(mode), b, x);
      let flip = false;
      for (const d of dio) { const v = vOf(d._p) - vOf(d._n); const want = d.on ? v - d.vf > -1e-9 : v > d.vf; if (want !== d.on && it < 10) { d.on = want; flip = true; } }
      if (!flip) return it;
    }
    return 12;
  }

  function accept(mode) {
    for (const e of caps) { const v = vOf(e._p) - vOf(e._n); if (mode === "dc") { e.vn = v; e.in = 0; continue; } const g = mode === "be" ? e.c / h : (2 * e.c) / h; e.in = mode === "be" ? g * (v - e.vn) : g * (v - e.vn) - e.in; e.vn = v; }
    for (const e of inds) { const v = vOf(e._p) - vOf(e._n); if (mode === "dc") { e.in = 1e4 * v; e.vn = 0; continue; } const g = mode === "be" ? h / e.l : h / (2 * e.l); e.in = mode === "be" ? e.in + g * v : e.in + g * (v + e.vn); e.vn = v; }
  }

  // 初始条件
  ctx.t = t0;
  if ((opt.init || "dc") === "dc") {
    ctx.dc = true;
    for (let it = 0; it < 300; it++) {
      for (const d of devices) { if (d.dc) d.dc(ctx); else d.update?.(ctx); }
      xPrev.set(x);
      solveStep("dc", t0);
      let ch = 0; for (let i = 0; i < n; i++) ch = Math.max(ch, Math.abs(x[i] - xPrev[i]));
      const devCh = devices.reduce((m, d) => Math.max(m, d.dcAfter?.(ctx) ?? 0), 0);
      if (it > 2 && ch < 1e-7 && devCh < 1e-7) break;
    }
    accept("dc");
    ctx.dc = false;
    events.length = 0; // 直流初值迭代里的“事件”不算
    for (const d of devices) d.start?.(ctx);
  } else {
    for (const e of caps) e.vn = e.v0 ?? 0;
    for (const e of inds) e.in = e.i0 ?? 0;
    for (const d of devices) d.start?.(ctx);
  }

  if (opt.adaptive) return adaptiveRun();
  // 探头
  const probes = (opt.probes || []).map((p) => ({ ...p, idx: p.node != null ? (p.node === ground ? -1 : nodes.get(p.node) ?? null) : null }));
  const every = opt.every || 1;
  const nOut = Math.floor(steps / every) + 1;
  const T = new Float64Array(nOut);
  const out = probes.map(() => new Float32Array(nOut));
  let w = 0;
  const record = (t) => { T[w] = t; probes.forEach((p, j) => { out[j][w] = p.fn ? p.fn(ctx) : p.el ? elemCurrent(p.el) : p.idx == null ? NaN : vOf(p.idx); }); w++; };
  record(t0);
  let forceBE = true; // 第一步用后向欧拉
  let iters = 0, beSteps = 0;
  for (let s = 1; s <= steps; s++) {
    const t = t0 + s * dt;
    ctx.t = t;
    const carry = ctx.discontinuity; // 上一步 after() 里报的突变（复位 / 启动）也让这一步用后向欧拉
    ctx.discontinuity = false;
    const swBefore = sws.map((q) => q._on);
    const dBefore = dio.map((d) => d.on);
    for (const d of devices) d.update?.(ctx);
    const swNow = sws.map((q) => !!val(q.on, t, ctx));
    const topo = swNow.some((v, i) => v !== swBefore[i]);
    const mode = method === "be" || forceBE || carry || topo || ctx.discontinuity ? "be" : "trap";
    if (mode === "be") beSteps++;
    iters += solveStep(mode, t);
    accept(mode);
    forceBE = dio.some((d, i) => d.on !== dBefore[i]);
    for (const d of devices) d.after?.(ctx);
    if (s % every === 0) record(t);
  }
  return { t: T, probes: probes.map((p, j) => ({ id: p.id, node: p.node, data: out[j] })), events, stats: { steps, n, iters, beSteps, factorizations: cache.size }, V, cur: elemCurrent, net };

  // ---------- v19：自适应步长（误差控制） ----------
  // opt.adaptive = { atol, rtol, dtMin, dtMax, dtEvent }。每一步用“线性外推预测值”和梯形法解的差估计局部误差：
  //   err = 0.5 · max |x − x_pred| / (atol + rtol·|x|)；err ≤ 1 接受，否则退回（元件 / 器件状态全部恢复）换小步重算。
  //   步长只取 dtMax / 2^k（梯子），LU 分解按步长缓存。
  // 事件（复位、开机、升压启停、打嗝、二极管 / 开关翻转）：发生事件的那一步如果步长 > dtEvent 就退回、步长 ÷8 重来，
  //   直到用 ≤ dtEvent 的小步“走过”事件；事件之后从小步重新长大。最小步长 dtMin 封底（到底了就强制接受，计数 forced）。
  // 输出：按 opt.dt 的均匀时间网格线性插值（示波器其余代码不用改），另给原始接受步数。
  // 已知简化：不叠加升压开关纹波（ctx.noRipple）——要看纹波用固定步长 ≤ 开关周期 / 16。
  function adaptiveRun() {
    const A = opt.adaptive === true ? {} : opt.adaptive;
    const atol = A.atol ?? 2e-3, rtol = A.rtol ?? 1e-3;
    const dtMax = A.dtMax ?? dt * 8, dtMin = A.dtMin ?? Math.max(1e-10, dt / 2048), dtEvent = A.dtEvent ?? Math.max(dtMin, dt / 16);
    const iJump = A.iJump ?? 0.02, vJump = A.vJump ?? 0.05;
    const ladder = (q) => { const k = Math.max(0, Math.ceil(Math.log2(dtMax / q) - 1e-9)); return Math.max(dtMin, dtMax / 2 ** k); };
    ctx.noRipple = true;
    const probes = (opt.probes || []).map((p) => ({ ...p, idx: p.node != null ? (p.node === ground ? -1 : nodes.get(p.node) ?? null) : null }));
    const nOut = Math.max(1, Math.round((t1 - t0) / dt)) + 1;
    const T = new Float64Array(nOut), out = probes.map(() => new Float32Array(nOut));
    const sample = () => probes.map((p) => (p.fn ? p.fn(ctx) : p.el ? elemCurrent(p.el) : p.idx == null ? NaN : vOf(p.idx)));
    let tLast = t0, yLast = sample(), w = 1;
    T[0] = t0; yLast.forEach((y, j) => { out[j][0] = y; });
    const emit = (t, y) => { while (w < nOut && t0 + w * dt <= t + 1e-15) { const tt = t0 + w * dt, f = t > tLast ? (tt - tLast) / (t - tLast) : 1; T[w] = tt; for (let j = 0; j < y.length; j++) out[j][w] = yLast[j] + (y[j] - yLast[j]) * f; w++; } tLast = t; yLast = y; };
    // 状态快照（退回用）：器件对象上所有数值 / 布尔 / 字符串 / null 字段 + 原始元件的 v / i / on
    const scal = (v) => v == null || typeof v === "number" || typeof v === "boolean" || typeof v === "string";
    const snap = () => ({ x: Float64Array.from(x), c: caps.map((e) => [e.vn, e.in]), l: inds.map((e) => [e.vn, e.in]), d: dio.map((e) => e.on), s: sws.map((e) => e._on), p: prim.map((e) => [e.v, e.i, e._v, e._i]), dv: devices.map((d) => Object.entries(d).filter(([, v]) => scal(v))), ev: events.length, dis: ctx.discontinuity });
    const restore = (S) => {
      x.set(S.x);
      caps.forEach((e, i) => { [e.vn, e.in] = S.c[i]; }); inds.forEach((e, i) => { [e.vn, e.in] = S.l[i]; });
      dio.forEach((e, i) => { e.on = S.d[i]; }); sws.forEach((e, i) => { e._on = S.s[i]; });
      prim.forEach((e, i) => { const q = S.p[i]; if (typeof e.v !== "function") e.v = q[0]; if (typeof e.i !== "function") e.i = q[1]; e._v = q[2]; e._i = q[3]; });
      devices.forEach((d, i) => { const keep = new Set(S.dv[i].map(([k]) => k)); for (const k of Object.keys(d)) if (!keep.has(k) && scal(d[k])) delete d[k]; for (const [k, v] of S.dv[i]) d[k] = v; });
      events.length = S.ev; ctx.discontinuity = S.dis;
    };
    const q = ladder(dtMin) / 1024;
    let t = t0, hh = ladder(dtEvent), forceBE = true, hPrev = 0;
    let acc = 0, rej = 0, evRej = 0, forced = 0, iters = 0, beSteps = 0, hMinUsed = Infinity, hMaxUsed = 0;
    const x0 = Float64Array.from(x), x1 = Float64Array.from(x);
    while (t < t1 - 1e-15) {
      h = Math.min(hh, t1 - t); ctx.dt = h;
      const S = snap();
      const tn = t0 + Math.round((t + h - t0) / q) * q; ctx.t = tn; // 时间按最小步长取整，避免累加误差让事件早 / 晚一步
      const carry = ctx.discontinuity; ctx.discontinuity = false;
      const swBefore = sws.map((q) => q._on), dBefore = dio.map((d) => d.on);
      for (const d of devices) d.update?.(ctx);
      const swNow = sws.map((q) => !!val(q.on, tn, ctx));
      const topo = swNow.some((v, i) => v !== swBefore[i]);
      const mode = method === "be" || forceBE || carry || topo || ctx.discontinuity ? "be" : "trap";
      const it = solveStep(mode, tn);
      let err = 0;
      if (hPrev > 0 && !forceBE && !carry && !topo) { const r = h / hPrev; for (let i = 0; i < n; i++) { const pr = x1[i] + (x1[i] - x0[i]) * r; const e = Math.abs(x[i] - pr) / (atol + rtol * Math.abs(x[i])); if (e > err) err = e; } err *= 0.5; }
      accept(mode);
      for (const d of devices) d.after?.(ctx);
      const flipped = dio.some((d, i) => d.on !== dBefore[i]);
      // 源突变（舵机起步、负载开关等由器件直接改的电流 / 电压源）：跳变超过 iJump / vJump 也按事件处理
      const jumped = prim.some((e, i) => (e.t === "I" && typeof e.i === "number" && Math.abs(e.i - (S.p[i][1] ?? 0)) > iJump) || (e.t === "V" && typeof e.v === "number" && Math.abs(e.v - (S.p[i][0] ?? 0)) > vJump));
      const evHappened = jumped || events.length > S.ev || ctx.discontinuity || topo || flipped;
      const atMin = h <= dtMin * 1.0001;
      if (evHappened && h > dtEvent * 1.0001) { restore(S); ctx.t = t; hh = ladder(Math.max(dtEvent, h / 8)); evRej++; continue; }
      if (err > 1 && !atMin) { restore(S); ctx.t = t; hh = ladder(Math.max(dtMin, h * Math.max(0.2, 0.9 / Math.sqrt(err)))); rej++; continue; }
      if (err > 1) forced++;
      acc++; iters += it; if (mode === "be") beSteps++;
      hMinUsed = Math.min(hMinUsed, h); hMaxUsed = Math.max(hMaxUsed, h);
      x0.set(x1); x1.set(x); hPrev = evHappened ? 0 : h; t = tn;
      forceBE = flipped;
      emit(t, sample());
      const grow = evHappened ? dtEvent : h * Math.min(2, err > 0 ? 0.9 / Math.sqrt(err) : 2);
      hh = ladder(Math.min(dtMax, Math.max(dtMin, grow)));
    }
    while (w < nOut) { T[w] = t0 + w * dt; yLast.forEach((y, j) => { out[j][w] = y; }); w++; }
    return { t: T, probes: probes.map((p, j) => ({ id: p.id, node: p.node, data: out[j] })), events, stats: { steps: acc, rejected: rej, eventRejects: evRej, forced, n, iters, beSteps, factorizations: cache.size, hMin: hMinUsed, hMax: hMaxUsed, adaptive: true, nominalSteps: Math.round((t1 - t0) / dt) }, V, cur: elemCurrent, net };
  }
}
