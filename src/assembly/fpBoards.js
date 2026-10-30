// v22（我的补充）：只有 KiCad 封装、没有可用 CAD 模型的板/模块 → 按封装焊盘生成近似外形（长宽取封装 F.Fab 轮廓，厚度 估算）。
// 焊盘坐标逐个来自封装文件（链接见每个零件的 footprint.url），所以导线接到的是真实的物理位置；外形只是近似。
import { FP_BOARDS } from "./fpBoards.gen.js";
import { attachPhys } from "./physpins.js";
import { L298N_NOTE } from "./breakout.js";
const c = (v) => v / 10; // mm → cm（引擎单位）
const DEN = { pcb: 1.85, ic: 2.0 };
function build(g) {
  const W = c(g.W), D = c(g.D), t = c(g.t), H = c(g.H), lift = c(g.lift);
  const pads = g.pads.map((q) => ({ p: [c(q[0]), c(q[1]), c(q[2])], w: c(q[3]), h: c(q[4]), tht: !!q[5], d: q[6], num: q[7], name: q[8], role: q[9] }));
  const prims = [], legs = [];
  let colliders;
  if (g.ic === "multiwatt") { // 直插功率 IC：塑封体 + 两排交错引脚（引脚当“腿”，能插孔；实物 1.27/5.08 mm 交错，插不进 2.54 面包板 → 引擎照实不吸附）
    prims.push({ k: "box", c: [0, lift + H / 2, 0], h: [W / 2, H / 2, D / 2], m: "black" });
    pads.forEach((q, i) => { prims.push({ k: "box", c: [q.p[0], lift / 2, q.p[2]], h: [0.025, lift / 2, 0.025], m: "steel" }); legs.push({ p: [q.p[0], 0, q.p[2]], top: lift, w: 0.05, i }); });
    colliders = [{ c: [0, lift + H / 2, 0], h: [W / 2, H / 2, D / 2] }];
  } else if (g.ic === "lga") {
    prims.push({ k: "box", c: [0, H / 2, 0], h: [W / 2, H / 2, D / 2], m: "black" });
    for (const q of pads) prims.push({ k: "box", c: [q.p[0], 0.001, q.p[2]], h: [q.w / 2, 0.001, q.h / 2], m: "brass" });
    colliders = [{ c: [0, H / 2, 0], h: [W / 2, H / 2, D / 2] }];
  } else {
    prims.push({ k: "box", c: [0, t / 2, 0], h: [W / 2, t / 2, D / 2], m: g.color });
    for (const q of pads) prims.push(q.tht ? { k: "cyl", c: [q.p[0], t + 0.002, q.p[2]], r: Math.max(q.w, q.h) / 2, h: 0.004, m: "brass" } : { k: "box", c: [q.p[0], t + 0.002, q.p[2]], h: [q.w / 2, 0.002, q.h / 2], m: "brass" });
    for (const q of pads) if (q.tht) prims.push({ k: "cyl", c: [q.p[0], t + 0.005, q.p[2]], r: c(q.d || 1) / 2, h: 0.004, m: "black" }); // 孔（黑点表示）
    colliders = [{ c: [0, t / 2, 0], h: [W / 2, t / 2, D / 2] }];
  }
  const Hy = g.ic === "multiwatt" ? g.lift + g.H : g.H || g.t;
  const def = {
    id: g.id, name_zh: g.zh, name: `${g.board} (footprint-derived body)`, cat: g.cat, board_id: g.board,
    dims_mm: { x: g.W, y: Hy, z: g.D }, dims_src: `长宽 = KiCad 封装 ${g.fp} 的 F.Fab 轮廓；厚度 估算`, footprint: { name: g.fp, url: g.url },
    spec: `引脚位置来自 KiCad 封装 ${g.fp}（数据手册焊盘图）；外形是按封装生成的近似板，不是实物 CAD`, iface: ["pins"],
    proc: { type: "prims", prims }, colliders, anchors: [], legs: legs.length ? legs : undefined,
    density: g.ic ? DEN.ic : DEN.pcb, est: ["板厚 / 外形（按封装轮廓生成，估算）", "元件布局未画（只画焊盘）", "质量（按体积 × 密度估算）"],
  };
  // 焊盘 → 引脚锚点（pinhole / pad / 腿），用同一套 attachPhys；腿已经按序号放好 → 先占位
  const phys = { b: g.board, mode: "footprint", pitch: g.pitch || null, pins: pads.map((q) => [q.p[0] * 10, q.p[1] * 10, q.p[2] * 10, q.num, q.name, q.role, q.tht ? 1 : 0, q.w * 10, q.h * 10, 0, 0, q.d]) };
  attachPhys(def, phys);
  if (g.ic === "multiwatt") { def.mountNote = L298N_NOTE; def.spec += "。" + L298N_NOTE; def.est.unshift("安装方式：直插 Multiwatt15（不是贴片）"); }
  return def;
}
export const FP_PROCEDURAL = FP_BOARDS.map(build);
