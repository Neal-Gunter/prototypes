// 题库 workbench / assembly 题的约束检查（早期原型，简化仿真）。
// 连接图按无向连通分量判断，不仿真电流；装配题只看步骤顺序和朝向标记。
export function netsOf(wires = []) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x);
    if (p !== x) parent.set(x, find(p));
    return parent.get(x);
  };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
  for (const w of wires) {
    if (!w?.a || !w?.b) continue;
    uni(String(w.a), String(w.b));
  }
  const groups = new Map();
  for (const n of parent.keys()) {
    const r = find(n);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(n);
  }
  return { find, nodes: [...parent.keys()], groups: [...groups.values()] };
}
const linked = (N, a, b) => {
  const A = String(a), B = String(b);
  return N.nodes.includes(A) && N.nodes.includes(B) && N.find(A) === N.find(B);
};
const E = (code, msg, msgEn) => ({ code, msg, msgEn });

// spec: { requiredNodes, requiredEdges:[{a,b}], forbiddenEdges:[{a,b}], requiredNets:[[pin,...]] }
export function checkConnectionGraph(answer, spec = {}) {
  const wires = Array.isArray(answer) ? answer : (answer?.wires || []);
  const N = netsOf(wires);
  const errors = [];
  const have = new Set(N.nodes);
  for (const n of spec.requiredNodes || []) if (!have.has(String(n))) errors.push(E("missing-node", `缺少节点 ${n}`, `Missing node ${n}`));
  for (const e of spec.requiredEdges || []) if (!linked(N, e.a, e.b)) errors.push(E("missing-edge", `${e.a} 和 ${e.b} 没有连通`, `${e.a} and ${e.b} are not connected`));
  for (const e of spec.forbiddenEdges || []) if (linked(N, e.a, e.b)) errors.push(E("forbidden-edge", `${e.a} 和 ${e.b} 不能短接`, `${e.a} and ${e.b} must not be shorted`));
  for (const net of spec.requiredNets || []) {
    const [first, ...rest] = net;
    for (const p of rest) if (!linked(N, first, p)) errors.push(E("missing-net", `${first} 和 ${p} 应在同一根网上`, `${first} and ${p} should share a net`));
  }
  return { pass: errors.length === 0, errors, warnings: [], info: { nodes: N.nodes, nets: N.groups.length } };
}

// answer.steps: [{ part, orient? }] 按安装顺序
// spec.requiredParts, spec.order:[{before,after}], spec.orientation:[{part,must}]
export function checkAssembly(answer, spec = {}) {
  const steps = Array.isArray(answer) ? answer : (answer?.steps || []);
  const errors = [];
  const first = new Map();
  steps.forEach((s, i) => { const p = s?.part; if (p && !first.has(p)) first.set(p, { i, orient: s.orient || null }); });
  for (const p of spec.requiredParts || []) if (!first.has(p)) errors.push(E("missing-part", `缺少零件 ${p}`, `Missing part ${p}`));
  for (const o of spec.order || []) {
    const a = first.get(o.before), b = first.get(o.after);
    if (a && b && a.i >= b.i) errors.push(E("order", `${o.before} 应在 ${o.after} 之前安装`, `${o.before} should be installed before ${o.after}`));
  }
  for (const o of spec.orientation || []) {
    const hit = first.get(o.part);
    if (hit && hit.orient !== o.must) errors.push(E("orient", `${o.part} 朝向应为 ${o.must}，现在是 ${hit.orient || "未标"}`, `${o.part} orientation should be ${o.must}, got ${hit.orient || "unset"}`));
  }
  return { pass: errors.length === 0, errors, warnings: [], info: { steps: steps.length } };
}
