// 零件目录：真实 CAD 模型按分类懒加载（public/lib/catalog/<分类>.json），再并上程序生成的零件。
import { PROCEDURAL, PROC_BY_ID, DENSITY } from "./procedural";

let indexP = null;
const catP = {};
export function loadIndex() {
  return (indexP ||= fetch("/lib/index.json").then((r) => r.json()));
}
export function loadCategory(cat) {
  return (catP[cat] ||= fetch(`/lib/catalog/${cat}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []));
}
export function proceduralIn(cat) {
  return PROCEDURAL.filter((d) => d.cat === cat);
}
export async function getEntry(id) {
  if (PROC_BY_ID[id]) return PROC_BY_ID[id];
  const base = id.replace(/:flip$/, "");
  const idx = await loadIndex();
  const row = idx.parts.find((p) => p[0] === base);
  if (!row) throw new Error("没有这个零件：" + id);
  const list = await loadCategory(row[3]);
  return list.find((e) => e.id === base);
}

const mmv = (p) => [p[0] / 10, p[1] / 10, p[2] / 10];
const PICO_PINS = (() => {
  // 树莓派 Pico 引脚表（数据手册 pinout）：1–20 一侧，21–40 另一侧
  const a = ["GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND", "GP6", "GP7", "GP8", "GP9", "GND", "GP10", "GP11", "GP12", "GP13", "GND", "GP14", "GP15"];
  const b = ["GP16", "GP17", "GND", "GP18", "GP19", "GP20", "GP21", "GND", "GP22", "RUN", "GP26", "GP27", "GND", "GP28", "ADC_VREF", "3V3", "3V3_EN", "GND", "VSYS", "VBUS"];
  return [...a, ...b];
})();

// 把目录条目变成引擎用的零件定义（单位 cm）
export function toDef(e, flip = false) {
  if (e.kind === "proc") return e;
  const def = {
    ...e,
    kind: "glb",
    density: e.cat === "motor" ? DENSITY.mixed : e.cat === "connector" ? DENSITY.plastic : DENSITY.pcb,
    anchors: [],
    est: ["质量（按碰撞盒体积×密度估算）"],
  };
  const H = e.dims_mm.y / 10;
  const isHeader = /pinheader_1x\d+_p2\.54mm_vertical/.test(e.id);
  // 翻面（排针长针朝下）：绕 x 轴转 180°：y' = H − y，z' = −z
  const F = flip ? (p) => [p[0], H - p[1], -p[2]] : (p) => p;
  def.colliders = e.colliders.map((c) => (flip ? { c: [c.c[0], H - c.c[1], -c.c[2]], h: c.h } : c));
  if (flip) {
    def.id = e.id + ":flip";
    def.flip = true;
    def.name_zh = e.name_zh + "（长针朝下）";
  }
  if (e.legs) {
    if (isHeader && flip) {
      // 长针朝下：塑料座在 [H−top−2.54, H−top]；长针从 0 到塑料座底
      const plasticBottom = H - (e.legs[0].top_y / 10) - 0.254;
      def.legs = e.legs.map((l, i) => ({ p: [l.p[0] / 10, 0, -l.p[2] / 10], top: plasticBottom, w: l.w / 10, i }));
      def.anchors.push(...e.legs.map((l, i) => ({ t: "pin-up", p: [l.p[0] / 10, H, -l.p[2] / 10], base: H - l.top_y / 10, i })));
    } else {
      def.legs = e.legs.map((l, i) => ({ p: mmv(l.p), top: l.top_y / 10, w: l.w / 10, i }));
      if (isHeader) def.anchors.push(...e.legs.map((l, i) => ({ t: "pin-up", p: [l.p[0] / 10, H, l.p[2] / 10], base: (l.top_y + 2.54) / 10, i })));
    }
    if (isHeader) {
      // 排针：CAD 的整体碰撞盒把塑料座和长针包在一起了，改成“塑料座 + 朝上的针排”
      const top0 = e.legs[0].top_y / 10; // 塑料座底（原始朝向）
      const xs = e.legs.map((l) => l.p[0] / 10), zs = e.legs.map((l) => l.p[2] / 10);
      const x0 = Math.min(...xs) - 0.127, x1 = Math.max(...xs) + 0.127, z0 = Math.min(...zs) - 0.127, z1 = Math.max(...zs) + 0.127;
      const pb = flip ? H - top0 - 0.254 : top0; // 塑料座底（当前朝向）
      const upBase = flip ? H - top0 : top0 + 0.254;
      const upTop = H;
      const rows = {};
      for (const a of def.anchors.filter((a) => a.t === "pin-up")) (rows[a.p[0].toFixed(2)] ||= []).push(a.p[2]);
      def.colliders = [
        { c: [(x0 + x1) / 2, pb + 0.127, (z0 + z1) / 2], h: [(x1 - x0) / 2, 0.127, (z1 - z0) / 2] },
        ...Object.entries(rows).map(([x, zz]) => ({ c: [+x, (upBase + upTop) / 2, (Math.min(...zz) + Math.max(...zz)) / 2], h: [0.032, (upTop - upBase) / 2, (Math.max(...zz) - Math.min(...zz)) / 2 + 0.032] })),
      ];
      def.plasticTop = pb + 0.254;
    }
    // 6 mm 轻触按键：脚距 6.5×4.5 mm，和 2.54 mm 网格对不齐，实物插面包板时脚会被稍微掰开；这里放宽对孔容差（估算）
    if (/sw_push_6mm|sw_tactile/i.test(e.id)) def.legBend = 0.13;
    // 腿也要有碰撞盒：没对准孔时，零件立在针尖上（腿多时按排合并）
    def.colliders = [...def.colliders, ...legColliders(def.legs)];
  }
  const th = e.servo ? (e.servo.tabTop - e.servo.tabBottom) / 10 : e.pcb_th ? e.pcb_th / 10 : 0.16;
  for (const h of e.holes || []) def.anchors.push({ t: "hole", d: h.d, p: F(mmv(h.p)), th });
  let pinholes = e.pinholes || [];
  if (e.id === "kc-raspberrypi_pico") {
    // 裸 Pico 的 CAD 没有通孔几何：按 Pico_H 的引脚位置（同一封装）补上，孔径为估算
    pinholes = [];
    for (let i = 0; i < 20; i++) pinholes.push({ p: [-8.89, 1.0, -23.48 + i * 2.54], d: 1.0 });
    for (let i = 0; i < 20; i++) pinholes.push({ p: [8.89, 1.0, 24.78 - i * 2.54], d: 1.0 });
    def.holes = [[-5.7, -23.5], [5.7, -23.5], [-5.7, 23.5], [5.7, 23.5]].map(([x, z]) => ({ p: [x, 1.0, z], d: 2.1 }));
    def.anchors.push(...def.holes.map((h) => ({ t: "hole", d: h.d, p: mmv(h.p), th: 0.1 })));
    def.board = "pico";
    def.ports = [{ kind: "micro-usb", p: [0, 2.35, -26.15], dir: [0, 0, -1], src: "估算" }];
    def.est.push("引脚孔径");
  }
  pinholes.forEach((h, i) => def.anchors.push({ t: "pinhole", d: h.d, p: F(mmv(h.p)), i }));
  for (const port of e.ports || def.ports || []) def.anchors.push({ t: "port", kind: port.kind, p: mmv(port.p), dir: port.dir });
  if (e.servo) {
    def.anchors.push({ t: "shaft", p: mmv(e.servo.shaft) });
    def.anchors.push({ t: "servo-body", p: [0, 0, 0] });
  }
  if (e.board === "pico" || def.board === "pico") def.pinNames = PICO_PINS;
  def.mass_est = massOf(def);
  return def;
}

function legColliders(legs) {
  if (!legs.length) return [];
  if (legs.length <= 8)
    return legs.map((l) => ({ c: [l.p[0], l.top / 2, l.p[2]], h: [Math.max(0.025, l.w / 2), l.top / 2 - 0.001, Math.max(0.025, l.w / 2)] }));
  // 按 x 分排，每排一个细长盒
  const rows = {};
  for (const l of legs) (rows[l.p[0].toFixed(2)] ||= []).push(l);
  return Object.values(rows).map((r) => {
    const zs = r.map((l) => l.p[2]);
    const z0 = Math.min(...zs), z1 = Math.max(...zs), top = Math.min(...r.map((l) => l.top));
    return { c: [r[0].p[0], top / 2, (z0 + z1) / 2], h: [0.032, top / 2 - 0.001, (z1 - z0) / 2 + 0.032] };
  });
}

export function massOf(def) {
  let v = 0;
  for (const c of def.colliders) v += 8 * c.h[0] * c.h[1] * c.h[2];
  return v * (def.density || 1.2);
}

export { PICO_PINS };
