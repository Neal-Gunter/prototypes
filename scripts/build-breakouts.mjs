// v23（我的补充）：贴片封装 → 2.54 mm 排针转接板。焊盘图（land pattern）逐个读自 KiCad 官方封装文件（同一 SHA），
//   这样转接板上的焊盘和目录里的 KiCad 贴片零件（kc-…，模型原点 = 封装原点）完全对齐；没有 CAD 模型的封装（SOIC-8 / QFN / LQFP / SOT-23-5/6）
//   按同一封装生成程序化贴片零件（本体长宽 = 封装 F.Fab 轮廓，高度 = JEDEC 外形标准的最大值，见 H_SRC）。转接板几何是自己画的（CC0）。
//   输出 src/assembly/breakouts.gen.js。用法：node scripts/build-breakouts.mjs   早期原型，简化仿真。
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const KIFP = path.resolve(ROOT, "../libsrc/kifp");
const SHA = fs.readFileSync(path.join(KIFP, "SHA"), "utf8").trim();
// key, 封装文件, 库, 引脚数, 已有的 CAD 零件 id（kicad_origin = 0）, 程序化本体高度 mm 与来源
const PKGS = [
  ["soic-8", "SOIC-8_3.9x4.9mm_P1.27mm", "Package_SO", 8, null, 1.75, "JEDEC MS-012 外形 A 最大 1.75 mm"],
  ["soic-16", "SOIC-16_3.9x9.9mm_P1.27mm", "Package_SO", 16, null, 1.75, "JEDEC MS-012 外形 A 最大 1.75 mm"],
  ["tssop-16", "TSSOP-16_4.4x5mm_P0.65mm", "Package_SO", 16, "kc-tssop-16_4.4x5mm_p0.65mm", null, null],
  ["ssop-24", "SSOP-24_5.3x8.2mm_P0.65mm", "Package_SO", 24, "kc-ssop-24_5.3x8.2mm_p0.65mm", null, null],
  ["qfn-16", "QFN-16-1EP_3x3mm_P0.5mm_EP1.75x1.75mm", "Package_DFN_QFN", 16, null, 1.0, "JEDEC MO-220 外形 A 最大 1.00 mm"],
  ["qfn-32", "QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm", "Package_DFN_QFN", 32, null, 1.0, "JEDEC MO-220 外形 A 最大 1.00 mm"],
  ["lqfp-32", "LQFP-32_7x7mm_P0.8mm", "Package_QFP", 32, null, 1.6, "JEDEC MS-026 外形 A 最大 1.60 mm"],
  ["lqfp-48", "LQFP-48_7x7mm_P0.5mm", "Package_QFP", 48, null, 1.6, "JEDEC MS-026 外形 A 最大 1.60 mm"],
  ["sot-23", "SOT-23", "Package_TO_SOT_SMD", 3, "kc-sot-23", null, null],
  ["sot-23-5", "SOT-23-5", "Package_TO_SOT_SMD", 5, null, 1.45, "JEDEC MO-178 外形 A 最大 1.45 mm"],
  ["sot-23-6", "SOT-23-6", "Package_TO_SOT_SMD", 6, null, 1.45, "JEDEC MO-178 外形 A 最大 1.45 mm"],
  ["0603", "R_0603_1608Metric", "Resistor_SMD", 2, "kc-r_0603_1608metric", null, null, ["kc-c_0603_1608metric", "kc-led_0603_1608metric"]],
  ["0805", "R_0805_2012Metric", "Resistor_SMD", 2, "kc-r_0805_2012metric", null, null, ["kc-c_0805_2012metric"]],
];
// --- 极简 S 表达式解析 ---
function sexpr(src) {
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const atom = () => {
    if (src[i] === '"') { let j = i + 1, s = ""; while (src[j] !== '"') { if (src[j] === "\\") j++; s += src[j++]; } i = j + 1; return s; }
    let j = i; while (j < src.length && !/[\s()]/.test(src[j])) j++; const s = src.slice(i, j); i = j; return s;
  };
  const list = () => { i++; const out = []; for (;;) { ws(); if (src[i] === ")") { i++; return out; } out.push(src[i] === "(" ? list() : atom()); } };
  ws(); return list();
}
const kid = (n, k) => n.find((c) => Array.isArray(c) && c[0] === k);
const kids = (n, k) => n.filter((c) => Array.isArray(c) && c[0] === k);
const r3 = (v) => Math.round(v * 1000) / 1000;
function parse(file, N) {
  const t = sexpr(fs.readFileSync(path.join(KIFP, file + ".kicad_mod"), "utf8"));
  const pads = [];
  for (const p of kids(t, "pad")) {
    const num = p[1]; const n = +num;
    if (!(n >= 1 && n <= N) || p[2] !== "smd") continue; // 只要信号脚；EP 散热焊盘 / 钢网分块不引出
    const at = kid(p, "at"), sz = kid(p, "size"); const rot = +(at[3] || 0);
    let w = +sz[1], h = +sz[2]; if (Math.abs(rot % 180) === 90) [w, h] = [h, w];
    pads.push({ num, x: r3(+at[1]), z: r3(+at[2]), w: r3(w), h: r3(h) });
  }
  pads.sort((a, b) => +a.num - +b.num);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const g of [...kids(t, "fp_line"), ...kids(t, "fp_poly"), ...kids(t, "fp_rect")]) {
    if (kid(g, "layer")?.[1] !== "F.Fab") continue;
    const pts = [kid(g, "start"), kid(g, "end"), ...(kid(g, "pts") ? kids(kid(g, "pts"), "xy") : [])].filter(Boolean);
    for (const q of pts) { x0 = Math.min(x0, +q[1]); x1 = Math.max(x1, +q[1]); z0 = Math.min(z0, +q[2]); z1 = Math.max(z1, +q[2]); }
  }
  const eps = kids(t, "pad").filter((p) => p[1] === String(N + 1) && p[2] === "smd").map((p) => ({ x: +kid(p, "at")[1], z: +kid(p, "at")[2], w: +kid(p, "size")[1], h: +kid(p, "size")[2] }));
  return { pads, fab: [r3(x0), r3(z0), r3(x1), r3(z1)], ep: eps[0] || null };
}
const out = [];
for (const [key, fp, lib, N, cad, H, hsrc, alsoCad] of PKGS) {
  const { pads, fab, ep } = parse(fp, N);
  if (pads.length !== N) throw new Error(`${fp}: 只读到 ${pads.length}/${N} 个焊盘`);
  // 间距：同一排相邻焊盘的最小距离
  let pitch = 1e9;
  for (const a of pads) for (const b of pads) if (a !== b) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (d > 0.05) pitch = Math.min(pitch, d); }
  out.push({ key, fp, url: `https://gitlab.com/kicad/libraries/kicad-footprints/-/blob/${SHA}/${lib}.pretty/${fp}.kicad_mod`, N, pitch: r3(pitch), pads: pads.map((p) => [p.num, p.x, p.z, p.w, p.h]), fab, ep, cad: [cad, ...(alsoCad || [])].filter(Boolean), H, hsrc });
  console.log(key.padEnd(9), fp.padEnd(40), `焊盘 ${pads.length}`, `间距 ${r3(pitch)} mm`, `本体 ${r3(fab[2] - fab[0])}×${r3(fab[3] - fab[1])} mm`, ep ? `EP ${ep.w}×${ep.h}` : "");
}
const js = `// 由 scripts/build-breakouts.mjs 生成（v23）：KiCad 贴片封装焊盘图（mm，封装原点；KiCad y → 引擎 z）。不要手改。\n// pads: [引脚号, x, z, w, h]；fab: 本体 F.Fab 轮廓 [x0, z0, x1, z1]；cad: 已有的 CAD 零件 id（模型原点 = 封装原点）\nexport const KICAD_SHA = ${JSON.stringify(SHA)};\nexport const SMD_PKGS = ${JSON.stringify(out)};\n`;
fs.writeFileSync(path.join(ROOT, "src/assembly/breakouts.gen.js"), js);
console.log("写出 src/assembly/breakouts.gen.js", js.length, "字节");
