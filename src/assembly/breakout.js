// v23（我的补充）：贴片转接板（SMD → 2.54 mm 排针）+ 没有 CAD 模型的贴片封装的程序化零件。早期原型，简化仿真。
//   焊盘图读自 KiCad 官方封装（breakouts.gen.js，scripts/build-breakouts.mjs 生成），所以 kc- 贴片零件的焊盘和转接板焊盘逐点对齐；
//   转接板外形 / 排针布置是自己画的（CC0）：DIP 式两排，行距 7.62 mm（0.3"，跨面包板中槽）或 15.24 mm（0.6"，大封装），
//   排针为“上下都能插”的长针（下面插面包板，上面套杜邦母头）。转接板上的走线没画：网表里按“焊盘 k ↔ 排针 k”直连。
import { SMD_PKGS } from "./breakouts.gen.js";
const c = (v) => v / 10; // mm → cm
export const SMD_BY_KEY = Object.fromEntries(SMD_PKGS.map((g) => [g.key, g]));
export const SMD_BY_CAD = Object.fromEntries(SMD_PKGS.flatMap((g) => g.cad.map((id) => [id, g])));
const P = 2.54; // mm
const LEG = 6.0, SPACER = 2.5, PCB = 1.6, UP = 6.0; // mm：针尖到塑料座底 / 塑料座 / 板厚 / 板上长针（估算，常见长针排针）
// 排针位置：DIP 编号（左列 1..n 自上而下，右列 n+1..N 自下而上）
export function headerLayout(g) {
  const n = Math.ceil(g.N / 2), xs = g.pads.map((p) => Math.abs(p[1]) + p[3] / 2), zs = g.pads.map((p) => Math.abs(p[2]) + p[4] / 2);
  const ext = Math.max(...xs), extZ = Math.max(...zs);
  const S = ext + 1.3 <= 7.62 / 2 && g.N <= 16 ? 7.62 : 15.24;
  const z0 = -((n - 1) * P) / 2;
  const pins = [];
  for (let k = 0; k < g.N; k++) {
    if (k < n) pins.push([-S / 2, z0 + k * P]);
    else pins.push([S / 2, z0 + (n - 1 - (k - n)) * P]);
  }
  const W = S + P, D = Math.max(n * P, 2 * extZ + 2.5) + 1.0;
  return { n, S, W, D, pins };
}
function breakoutDef(g) {
  const L = headerLayout(g);
  const yP0 = LEG + SPACER, yTop = yP0 + PCB, yUp = yTop + UP;
  const prims = [], colliders = [], legs = [], anchors = [];
  prims.push({ k: "box", c: [0, c(yP0 + PCB / 2), 0], h: [c(L.W / 2), c(PCB / 2), c(L.D / 2)], m: "green" });
  colliders.push({ c: [0, c(yP0 + PCB / 2), 0], h: [c(L.W / 2), c(PCB / 2), c(L.D / 2)] });
  const cols = {};
  L.pins.forEach(([x, z], i) => {
    (cols[x] ||= []).push(z);
    prims.push({ k: "box", c: [c(x), c(yUp / 2), c(z)], h: [0.032, c(yUp / 2), 0.032], m: "brass" });
    prims.push({ k: "cyl", c: [c(x), c(yTop) + 0.002, c(z)], r: 0.085, h: 0.004, m: "brass" });
    legs.push({ p: [c(x), 0, c(z)], top: c(LEG), w: 0.064, i });
    anchors.push({ t: "pin-up", p: [c(x), c(yUp), c(z)], base: c(yTop), i });
  });
  for (const [x, zz] of Object.entries(cols)) {
    const z0 = Math.min(...zz) - P / 2, z1 = Math.max(...zz) + P / 2, cx = c(+x), cz = c((z0 + z1) / 2), hz = c((z1 - z0) / 2);
    prims.push({ k: "box", c: [cx, c(LEG + SPACER / 2), cz], h: [c(P / 2), c(SPACER / 2), hz], m: "black" });
    colliders.push({ c: [cx, c(LEG + SPACER / 2), cz], h: [c(P / 2), c(SPACER / 2), hz] }); // 塑料座
    colliders.push({ c: [cx, c(LEG / 2), cz], h: [0.032, c(LEG / 2) - 0.001, hz - 0.095] }); // 下针排
    colliders.push({ c: [cx, c((yTop + yUp) / 2), cz], h: [0.032, c(UP / 2), hz - 0.095] }); // 上针排
  }
  const phys = {};
  g.pads.forEach(([num, x, z, w, h], i) => {
    anchors.push({ t: "land", p: [c(x), c(yTop), c(z)], i, w: c(w), h: c(h), num, pkg: g.key });
    prims.push({ k: "box", c: [c(x), c(yTop) + 0.001, c(z)], h: [c(w / 2), 0.001, c(h / 2)], m: "brass" });
    phys[`t${i}`] = { num, name: `焊盘 ${num}`, role: "land", tht: false, src: `KiCad 封装 ${g.fp}` };
    phys[`l${i}`] = { num: String(i + 1), name: `排针 ${i + 1}（接焊盘 ${num}）`, role: "io", tht: true, src: "转接板排针（我的补充）" };
  });
  const zh = { "0603": "0603 贴片", "0805": "0805 贴片" }[g.key] || g.key.toUpperCase();
  return {
    id: `p-bo-${g.key}`, cat: "driver", name_zh: `${zh} 转接板（→ 2.54 mm 排针，${g.N} 脚）`, name: `${g.key.toUpperCase()} to 2.54 mm breakout (procedural)`,
    dims_mm: { x: L.W, y: yUp, z: L.D }, dims_src: `焊盘图 = KiCad 封装 ${g.fp}；板子外形、排针布置是自己画的（CC0，估算）`, footprint: { name: g.fp, url: g.url },
    spec: `把 ${zh}（间距 ${g.pitch} mm）转成 ${g.N} 根 2.54 mm 排针（行距 ${L.S} mm${L.S === 7.62 ? "，跨面包板中槽" : ""}）。先把芯片放到焊盘上，再用烙铁逐个焊。`,
    iface: ["pins"], proc: { type: "prims", prims }, colliders, anchors, legs, breakout: g.key, boPitch: g.pitch, density: 1.85,
    physPins: phys, physInfo: { board: `bo-${g.key}`, mode: "footprint", src: "KiCad 封装（数据手册焊盘图）", pitch: { mode: 2.54, expected: 2.54, ok: true, breadboard: true } },
    est: ["板厚、排针长度（常见长针排针，估算）", "走线未画（焊盘 k ↔ 排针 k 直连）", g.ep ? "底部散热焊盘（EP）不引出（我的补充）" : null, "质量（按体积 × 密度估算）"].filter(Boolean),
  };
}
// 没有 CAD 模型的封装：程序化贴片零件（本体 = F.Fab 轮廓 × JEDEC 最大高度；引脚 = 焊盘中心，简化）
function smdPartDef(g) {
  const [x0, z0, x1, z1] = g.fab, H = g.H, so = 0.1; // 本体离板 0.1 mm（估算）
  const prims = [{ k: "box", c: [c((x0 + x1) / 2), c(so + (H - so) / 2), c((z0 + z1) / 2)], h: [c((x1 - x0) / 2), c((H - so) / 2), c((z1 - z0) / 2)], m: "black" }];
  const anchors = [], phys = {};
  g.pads.forEach(([num, x, z, w, h], i) => {
    prims.push({ k: "box", c: [c(x), 0.01, c(z)], h: [c(Math.min(w, h) * 0.3), 0.01, c(Math.min(w, h) * 0.3)], m: "steel" });
    anchors.push({ t: "pad", p: [c(x), 0, c(z)], i, w: c(w), h: c(h), num, pkg: g.key });
    phys[`s${i}`] = { num, name: `引脚 ${num}`, role: "io", tht: false, src: `KiCad 封装 ${g.fp}` };
  });
  // 1 脚标记（白点）
  const p1 = g.pads[0];
  prims.push({ k: "cyl", c: [c(Math.sign(p1[1]) * Math.min(Math.abs(p1[1]), Math.abs(x0) * 0.6)), c(H) + 0.001, c(Math.sign(p1[2]) * Math.min(Math.abs(p1[2]), Math.abs(z0) * 0.6))], r: 0.025, h: 0.002, m: "white" });
  return {
    id: `p-smd-${g.key}`, cat: "semi", name_zh: `贴片封装 ${g.key.toUpperCase()}（程序化，${g.N} 脚）`, name: `${g.fp} (procedural body)`,
    dims_mm: { x: x1 - x0, y: H, z: z1 - z0 }, dims_src: `长宽 = KiCad 封装 ${g.fp} 的 F.Fab 轮廓；高度 = ${g.hsrc}`, footprint: { name: g.fp, url: g.url },
    spec: `贴片封装，引脚间距 ${g.pitch} mm：不能直接插面包板，要先贴到转接板上焊好`, iface: ["pins"], proc: { type: "prims", prims },
    colliders: [{ c: [c((x0 + x1) / 2), c(H / 2), c((z0 + z1) / 2)], h: [c((x1 - x0) / 2), c(H / 2), c((z1 - z0) / 2)] }], anchors, smdPkg: g.key, density: 2.0,
    physPins: phys, physInfo: { board: g.key, mode: "footprint", src: "KiCad 封装（数据手册焊盘图）", pitch: { mode: g.pitch, expected: g.pitch, ok: true, breadboard: false } },
    est: ["外形按封装轮廓（不是实物 CAD）", "引脚接触点 = 焊盘中心（简化）", g.ep ? "底部散热焊盘（EP）未建模" : null, "质量（按体积 × 密度估算）"].filter(Boolean),
  };
}
export const BREAKOUT_PROCEDURAL = [...SMD_PKGS.map(breakoutDef), ...SMD_PKGS.filter((g) => !g.cad.length).map(smdPartDef)];
// 目录里的 KiCad 贴片零件（kc-…）：模型原点 = 封装原点 → 焊盘锚点直接照抄封装（已有 phys 的 TSSOP / SSOP 只补上封装标记）
export function attachSmd(def) {
  const g = SMD_BY_CAD[def.id.replace(/:flip$/, "")]; if (!g || def.flip) return def;
  def.smdPkg = g.key;
  const pads = def.anchors.filter((a) => a.t === "pad");
  if (pads.length === g.N) pads.forEach((a, i) => Object.assign(a, { pkg: g.key, num: g.pads[i][0] }));
  else {
    def.anchors = def.anchors.filter((a) => a.t !== "pad");
    def.physPins ||= {};
    g.pads.forEach(([num, x, z, w, h], i) => { def.anchors.push({ t: "pad", p: [c(x), 0, c(z)], i, w: c(w), h: c(h), num, pkg: g.key }); def.physPins[`s${i}`] ||= { num, name: `引脚 ${num}`, role: "io", tht: false, src: `KiCad 封装 ${g.fp}（模型原点 = 封装原点）` }; });
    def.physInfo ||= { board: g.key, mode: "footprint", src: "KiCad 封装（数据手册焊盘图）", pitch: { mode: g.pitch, expected: g.pitch, ok: true, breadboard: false } };
  }
  def.spec = (def.spec ? def.spec + "；" : "") + `贴片封装（间距 ${g.pitch} mm）：要先贴到「p-bo-${g.key}」转接板上焊好才能插面包板 / 接线`;
  return def;
}
export const L298N_NOTE = "直插（THT）Multiwatt15 封装：15 根脚按 1.27 / 5.08 mm 交错排列，不能直接插 2.54 mm 面包板，也不用贴片转接板——实物要焊在 PCB 上（或用 L298N 模块）。（我的补充）";
