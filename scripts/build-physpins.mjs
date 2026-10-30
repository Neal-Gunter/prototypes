// v22：把 29 块板 / 模块的引脚“落到实物上”——每个引脚在零件局部坐标里的物理位置（mm）。
//   来源优先级：① 真实 CAD 模型 + 同一 KiCad 封装（焊盘坐标经 KiCad 模型原点 / 偏移换算，再逐个核对落在模型表面上）
//              ② CAD 模型里量出来的针脚（FreeCAD 库的 HC-SR04 / L298N 模块，没有 KiCad 封装）
//              ③ 只有 KiCad 封装（= 按数据手册画的焊盘图）：生成“按封装的近似外形”零件，焊盘位置照抄封装
//   每个引脚写清来源；核对：焊盘点到模型三角面的 3D 距离 ≤ TOL、落在模型包围盒内、THT 焊盘和 CAD 孔 / 针脚对得上；引脚间距检查。
//   输出 public/pinouts/phys/<板>.json + phys/index.json + src/assembly/fpBoards.gen.js（③ 的零件）。
//   用法：node scripts/build-physpins.mjs   早期原型，简化仿真。
import fs from "node:fs"; import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LIB = path.resolve(ROOT, "../libsrc");
const KIFP = path.join(LIB, "kifp");
const OUT = path.join(ROOT, "public/pinouts/phys");
const LOG = process.env.LOG || "/tmp/v22phys";
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(LOG, { recursive: true });
const TOL = 0.5; // mm：引脚点到模型表面的容差
const r3 = (v) => Math.round(v * 1000) / 1000;
const FP_SHA = fs.readFileSync(path.join(KIFP, "SHA"), "utf8").trim();
const ESP_SHA = fs.readFileSync(path.join(KIFP, "ESP_SHA"), "utf8").trim();
const P3D_SHA = fs.readFileSync(path.join(KIFP, "P3D_SHA"), "utf8").trim();
const FP_LIB = { Adafruit_Feather: "Module", Arduino_Nano: "Module", Arduino_UNO_R3: "Module", "Pololu_Breakout-16_15.2x20.3mm": "Module",
  RaspberryPi_Pico_Common_Unspecified: "Module", RaspberryPi_Pico_W_SMD_HandSolder: "Module", ST_VL53L1x: "Sensor_Distance",
  "TO-220-15_P2.54x5.08mm_StaggerOdd_Lead4.58mm_Vertical": "Package_TO_SOT_THT", "TSSOP-16_4.4x5mm_P0.65mm": "Package_SO", "SSOP-24_5.3x8.2mm_P0.65mm": "Package_SO" };
const fpUrl = (fp) => fp === "ESP32-S3-MINI-1"
  ? `https://github.com/espressif/kicad-libraries/blob/${ESP_SHA}/footprints/Espressif.pretty/ESP32-S3-MINI-1.kicad_mod`
  : `https://gitlab.com/kicad/libraries/kicad-footprints/-/blob/${FP_SHA}/${FP_LIB[fp] || "RF_Module"}.pretty/${fp}.kicad_mod`;

// ---------- 板 → 封装 → 模型 ----------
const BOARDS = {
  "rpi-pico": { fp: "RaspberryPi_Pico_Common_Unspecified", models: ["kc-raspberrypi_pico", "kc-raspberrypi_pico_h"], pitch: 2.54 },
  // Pico W：KiCad 通用 Pico 封装（同一封装的 3D 模型里就列着 RaspberryPi_Pico_W.step），取通孔焊盘，排针能焊
  "rpi-pico-w": { fp: "RaspberryPi_Pico_Common_Unspecified", models: ["kc-raspberrypi_pico_w"], pitch: 2.54 },
  "arduino-uno-r3": { fp: "Arduino_UNO_R3", gen: { cat: "mcu", t: 1.6 }, pitch: 2.54 },
  "arduino-leonardo": { fp: "Arduino_UNO_R3", gen: { cat: "mcu", t: 1.6 }, pitch: 2.54 },
  "arduino-nano-v3": { fp: "Arduino_Nano", gen: { cat: "mcu", t: 1.6 }, pitch: 2.54 },
  "arduino-nano-every": { fp: "Arduino_Nano", gen: { cat: "mcu", t: 1.6 }, pitch: 2.54 },
  "arduino-nano-esp32": { fp: "Arduino_Nano", gen: { cat: "mcu", t: 1.6 }, pitch: 2.54 },
  "arduino-nano-rp2040": { fp: "Arduino_Nano", gen: { cat: "mcu", t: 1.6 }, pitch: 2.54 },
  "feather-huzzah32": { fp: "Adafruit_Feather", models: ["ada-3405"], fit: true, pitch: 2.54 },
  "feather-huzzah8266": { fp: "Adafruit_Feather", models: ["ada-2821"], fit: true, pitch: 2.54 },
  "feather-m0-express": { fp: "Adafruit_Feather", models: ["ada-3403"], fit: true, pitch: 2.54 },
  "esp32-wroom-32e": { fp: "ESP32-WROOM-32E", models: ["kc-esp32-wroom-32e"], pitch: 1.27 },
  "esp32-wroom-32": { fp: "ESP32-WROOM-32", models: ["kc-esp32-wroom-32"], pitch: 1.27 },
  "esp32-s3-wroom-1": { fp: "ESP32-S3-WROOM-1", models: ["kc-esp32-s3-wroom-1", "esp-esp32-s3-wroom-1", "sfe-esp32-s3-wroom-1"], pitch: 1.27 },
  "esp32-s3-mini-1": { fp: "ESP32-S3-MINI-1", models: ["esp-esp32-s3-mini-1", "sfe-esp32-s3-mini"], pitch: 0.8 },
  "esp32-c3-wroom-02": { fp: "ESP32-C3-WROOM-02", models: ["kc-esp32-c3-wroom-02", "esp-esp32-c3-wroom-02"], pitch: 1.5 },
  "esp32-c3-devkitm-1": { fp: "ESP32-C3-DevKitM-1", gen: { cat: "mcu", t: 1.6 }, pitch: 2.54 },
  "esp32-c6-mini-1": { fp: "ESP32-C6-MINI-1", models: ["esp-esp32-c6-mini-1", "sfe-esp32-c6-mini-1"], pitch: 0.8 },
  "esp-12f": { fp: "ESP-12E", models: ["kc-esp-12e"], pitch: 2.0 },
  "esp-01": { fp: "ESP-01", gen: { cat: "module", t: 1.0 }, pitch: 2.54 },
  "pololu-a4988": { fp: "Pololu_Breakout-16_15.2x20.3mm", gen: { cat: "driver", t: 1.6 }, pitch: 2.54 },
  "pololu-drv8825": { fp: "Pololu_Breakout-16_15.2x20.3mm", gen: { cat: "driver", t: 1.6 }, pitch: 2.54 },
  "l298n-ic": { fp: "TO-220-15_P2.54x5.08mm_StaggerOdd_Lead4.58mm_Vertical", gen: { cat: "driver", t: 0, ic: "multiwatt" }, pitch: 2.54 },
  "tb6612fng": { fp: "SSOP-24_5.3x8.2mm_P0.65mm", models: ["kc-ssop-24_5.3x8.2mm_p0.65mm"], pitch: 0.65, generic: true },
  "drv8833pw": { fp: "TSSOP-16_4.4x5mm_P0.65mm", models: ["kc-tssop-16_4.4x5mm_p0.65mm"], pitch: 0.65, generic: true },
  "vl53l0x": { fp: "ST_VL53L1x", gen: { cat: "sensor", t: 0, ic: "lga" }, pitch: 0.8 },
  "vl53l1x": { fp: "ST_VL53L1x", models: ["kc-st_vl53l1x", "sfe-st_vl53l1x"], pitch: 0.8 },
  "hc-sr04": { cad: "hcsr04", models: ["fc-hc-sr04"], pitch: 2.54 },
  "l298n-module": { cad: "l298n", models: ["fc-l298n"], pitch: 2.54 },
};

// ---------- KiCad S 表达式 ----------
function sexpr(src) {
  let i = 0; const n = src.length;
  function atom() { let s = i; while (i < n && !/[\s()]/.test(src[i])) i++; return src.slice(s, i); }
  function str() { i++; let s = ""; while (i < n && src[i] !== '"') { if (src[i] === "\\") i++; s += src[i++]; } i++; return s; }
  function list() { i++; const L = []; for (;;) { while (i < n && /\s/.test(src[i])) i++; if (src[i] === ")") { i++; return L; } L.push(src[i] === "(" ? list() : src[i] === '"' ? str() : atom()); } }
  while (src[i] !== "(") i++; return list();
}
const kids = (L, k) => L.filter((x) => Array.isArray(x) && x[0] === k);
const kid = (L, k) => kids(L, k)[0];
function parseFp(name) {
  const t = sexpr(fs.readFileSync(path.join(KIFP, name + ".kicad_mod"), "utf8"));
  const pads = kids(t, "pad").map((p) => { const at = kid(p, "at"), sz = kid(p, "size"), dr = kid(p, "drill");
    return { num: p[1], type: p[2], shape: p[3], x: +at[1], y: +at[2], rot: +(at[3] || 0), w: +sz[1], h: +sz[2], drill: dr ? +dr.find((v, j) => j > 0 && !isNaN(+v)) : 0 }; })
    .filter((p) => p.num !== "" && p.type !== "np_thru_hole");
  const box = (layer) => { const b = [1e9, 1e9, -1e9, -1e9]; let any = false;
    for (const g of t.filter((x) => Array.isArray(x) && /^fp_(line|rect|poly|arc|circle)$/.test(x[0]))) {
      const ly = kid(g, "layer"); if (!ly || ly[1] !== layer) continue;
      const pts = [...kids(g, "start"), ...kids(g, "end"), ...kids(g, "mid"), ...(kid(g, "pts") ? kids(kid(g, "pts"), "xy") : [])];
      if (g[0] === "fp_circle") { const c = kid(g, "center"), e = kid(g, "end"); const r = Math.hypot(e[1] - c[1], e[2] - c[2]); pts.push(["", +c[1] - r, +c[2] - r], ["", +c[1] + r, +c[2] + r]); }
      for (const q of pts) { any = true; b[0] = Math.min(b[0], +q[1]); b[1] = Math.min(b[1], +q[2]); b[2] = Math.max(b[2], +q[1]); b[3] = Math.max(b[3], +q[2]); } }
    return any ? b : null; };
  const models = kids(t, "model").map((m) => { const o = kid(m, "offset"); const xyz = o ? kid(o, "xyz") : null; return { file: m[1], hide: !!kid(m, "hide") && kid(m, "hide")[1] === "yes", off: xyz ? [+xyz[1], +xyz[2], +xyz[3]] : [0, 0, 0] }; });
  return { name, pads, fab: box("F.Fab"), crt: box("F.CrtYd"), models };
}

// ---------- GLB → 三角形（mm，零件局部坐标） ----------
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const catIdx = {}; for (const f of fs.readdirSync(path.join(ROOT, "public/lib/catalog"))) for (const e of JSON.parse(fs.readFileSync(path.join(ROOT, "public/lib/catalog", f), "utf8"))) catIdx[e.id] = e;
const man = {}; for (const e of JSON.parse(fs.readFileSync(path.join(LIB, "manifest.json"), "utf8"))) man[e.id] = e;
async function loadModel(id) {
  const e = catIdx[id]; const meta = JSON.parse(fs.readFileSync(path.join(LIB, "meta", id + ".json"), "utf8"));
  const doc = await io.read(path.join(ROOT, "public", e.glb)); const T = [];
  for (const nd of doc.getRoot().listNodes()) { const m = nd.getMesh(); if (!m) continue; const W = nd.getWorldMatrix();
    for (const p of m.listPrimitives()) { const pa = p.getAttribute("POSITION"), ix = p.getIndices(); const mt = p.getMaterial(); const bc = mt?.getBaseColorFactor?.() || [1, 1, 1]; const metal = (mt?.getMetallicFactor?.() ?? 0) > 0.5 ? true : bc[0] + bc[1] + bc[2] < 0.3 ? "black" : false; const v = [0, 0, 0]; const P = [];
      for (let i = 0; i < pa.getCount(); i++) { pa.getElement(i, v); P.push([0, 1, 2].map((k) => 10 * (W[k] * v[0] + W[4 + k] * v[1] + W[8 + k] * v[2] + W[12 + k]))); }
      const cnt = ix ? ix.getCount() : pa.getCount(); for (let i = 0; i < cnt; i += 3) { const a = ix ? ix.getScalar(i) : i; T.push([P[a], P[ix ? ix.getScalar(i + 1) : i + 1], P[ix ? ix.getScalar(i + 2) : i + 2], metal]); } } }
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const t of T) for (const q of t.slice(0, 3)) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
  return { id, e, meta, T, lo, hi, src: man[id]?.src || "" };
}
// 点到三角形距离（Ericson）
function ptTri(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a); const d1 = dot(ab, ap), d2 = dot(ac, ap); let q;
  if (d1 <= 0 && d2 <= 0) q = a; else { const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b; else { const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
      else { const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c; else { const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
          else { const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); q = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; } } } } } }
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
const surfDist = (M, p) => { let d = 1e9; for (const t of M.T) { const e = ptTri(p, t[0], t[1], t[2]); if (e < d) d = e; } return d; };
// 竖直射线（沿 y）在 (x,z) 处和模型的所有交点 y
function rayYs(M, x, z) { const ys = [];
  for (const [a, b, c] of M.T) { const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]); if (Math.abs(d) < 1e-12) continue;
    const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d, v = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) ys.push(a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1])); }
  return ys.sort((p, q) => p - q); }

// ---------- 焊盘挑选：每个引脚号一个主焊盘（THT 优先，其次面积大的） ----------
function primaryPads(fp, pins) {
  const by = {}; for (const p of fp.pads) (by[p.num] ||= []).push(p);
  const out = []; for (const pin of pins) { const L = by[pin.num]; if (!L) { out.push({ pin, pad: null }); continue; }
    const pad = [...L].sort((a, b) => (b.type === "thru_hole") - (a.type === "thru_hole") || b.w * b.h - a.w * a.h)[0]; out.push({ pin, pad, dup: L.length - 1 }); }
  return out;
}
function nnPitch(pts) { const d = pts.map((p, i) => Math.min(...pts.filter((_, j) => j !== i).map((q) => Math.hypot(p[0] - q[0], p[2] - q[2])))); const s = [...d].sort((a, b) => a - b); const h = {}; for (const x of d) { const k = (Math.round(x * 100) / 100).toFixed(2); h[k] = (h[k] || 0) + 1; } const mode = +Object.entries(h).sort((a, b) => b[1] - a[1])[0][0]; return { min: r3(s[0]), median: r3(mode), mode: r3(mode) }; }
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// ---------- 坐标变换 ----------
// KiCad / 乐鑫 / SparkFun 模型：局部 mm = kicad_origin + [fx − ox, 0, fy + oy]
function originTf(M, fp) {
  const o = M.meta.kicad_origin; if (!o) return null;
  const base = path.basename(M.src).toLowerCase().replace(/\.(step|stp)$/, "");
  const mm = fp.models.find((m) => path.basename(m.file).toLowerCase().replace(/\.(step|stp)$/, "") === base) || fp.models.find((m) => !m.hide) || { off: [0, 0, 0] };
  return { name: "kicad-origin", f: (x, y) => [o[0] + x - mm.off[0], o[1], o[2] + y + mm.off[1]], off: mm.off };
}
// 拟合：8 种朝向 × 平移，让 THT 焊盘落到 CAD 孔上（用于没有 KiCad 原点的 Adafruit 模型）
function fitTf(M, fp, pads) {
  const holes = (M.e.pinholes || []).map((h) => h.p); if (holes.length < 3) return null;
  const tht = pads.filter((p) => p.type === "thru_hole"); let best = null;
  for (let o = 0; o < 8; o++) { const R = (x, y) => { let a = o & 4 ? [y, x] : [x, y]; if (o & 1) a[0] = -a[0]; if (o & 2) a[1] = -a[1]; return a; };
    const cand = new Map(); for (const p of tht.slice(0, 6)) for (const h of holes) { const [a, b] = R(p.x, p.y); const k = `${Math.round((h[0] - a) * 20)},${Math.round((h[2] - b) * 20)}`; if (!cand.has(k)) cand.set(k, [h[0] - a, h[2] - b]); }
    for (const [tx, tz] of cand.values()) { let n = 0, err = 0; for (const p of tht) { const [a, b] = R(p.x, p.y); let d = 1e9; for (const h of holes) d = Math.min(d, Math.hypot(h[0] - a - tx, h[2] - b - tz)); if (d < 0.5) { n++; err += d; } }
      if (!best || n > best.n || (n === best.n && err < best.err)) best = { n, err, o, tx, tz, R }; } }
  const y = holes[0][1]; const b = best;
  return { name: `fit-to-CAD-holes（朝向 ${b.o}，${b.n}/${tht.length} 个焊盘落在 CAD 孔上）`, f: (x, yy) => { const [a, c] = b.R(x, yy); return [a + b.tx, y, c + b.tz]; } };
}

// 贴片模组：封装的焊盘图中心对准模型底面中心，8 种朝向里挑“焊盘落在模型底面金色焊盘三角形上”最多的
function fitSmd(M, fp, pads) {
  const y0 = M.lo[1]; const gold = M.T.filter((t) => t[0][1] < y0 + 0.15 && t[1][1] < y0 + 0.15 && t[2][1] < y0 + 0.15 && t[3] !== "black");
  if (!gold.length) return null; const b = fp.fab || fp.crt; if (!b) return null;
  const fcx = (b[0] + b[2]) / 2, fcy = (b[1] + b[3]) / 2, mcx = (M.lo[0] + M.hi[0]) / 2, mcz = (M.lo[2] + M.hi[2]) / 2; let best = null;
  for (let o = 0; o < 8; o++) { const R = (x, y) => { let a = o & 4 ? [y, x] : [x, y]; if (o & 1) a[0] = -a[0]; if (o & 2) a[1] = -a[1]; return a; };
    let n = 0; for (const p of pads) { const [a, c] = R(p.x - fcx, p.y - fcy); const q = [mcx + a, y0, mcz + c]; let d = 1e9; for (const t of gold) { d = Math.min(d, ptTri(q, t[0], t[1], t[2])); if (d < 0.05) break; } if (d < 0.3) n++; }
    if (!best || n > best.n) best = { n, o, R }; }
  return { name: `fit-to-CAD-bottom-pads（朝向 ${best.o}，${best.n}/${pads.length} 个焊盘中心落在模型底面焊盘上）`, f: (x, y) => { const [a, c] = best.R(x - fcx, y - fcy); return [mcx + a, y0, mcz + c]; } };
}
// ---------- 逐块板 ----------
const pinIdx = JSON.parse(fs.readFileSync(path.join(ROOT, "public/pinouts/index.json"), "utf8"));
const report = { generated: new Date().toISOString().slice(0, 10), tol_mm: TOL, footprints: { repo: "kicad-footprints", sha: FP_SHA, espressif_sha: ESP_SHA, packages3D_sha: P3D_SHA, licence: "CC-BY-SA-4.0（含 KiCad 设计例外条款）" }, boards: [] };
const gen = []; const modelMap = {};
for (const bi of pinIdx.boards) {
  const B = BOARDS[bi.id]; if (!B) throw new Error("no phys config " + bi.id);
  const po = JSON.parse(fs.readFileSync(path.join(ROOT, "public/pinouts", bi.id + ".json"), "utf8"));
  const res = { id: bi.id, zh: bi.zh, pitch_expected: B.pitch, models: {} };
  if (B.cad) { // ② FreeCAD 模型里量针脚
    const M = await loadModel(B.models[0]); const pins = cadPins(B.cad, M, po.pins);
    res.mode = "cad"; res.src = `${M.e.source}：${M.e.url}（在 CAD 网格里找出细长金属针 / 端子位置）`; res.lic = M.e.licence; res.footprint = null;
    res.models[M.id] = verify(M, pins, { cadOnly: true });
  } else {
    const fp = parseFp(B.fp); const pp = primaryPads(fp, po.pins);
    const miss = pp.filter((q) => !q.pad).map((q) => q.pin.num); res.footprint = { name: B.fp, url: fpUrl(B.fp), pads: fp.pads.length, missing: miss };
    res.lic = "CC-BY-SA-4.0（含 KiCad 设计例外条款）";
    if (B.models) {
      res.mode = "cad+footprint"; res.src = `KiCad 封装 ${B.fp} 的焊盘坐标 → 换算到 CAD 模型局部坐标，逐个核对落在模型上`;
      for (const id of B.models) { const M = await loadModel(id); let tf = !B.fit && originTf(M, fp); let pins = tf && placePads(M, pp, tf), v = pins && verify(M, pins, {});
        if (!v || v.fail > 0) { const tf2 = fitTf(M, fp, pp.filter((q) => q.pad).map((q) => q.pad)); if (tf2) { const pins2 = placePads(M, pp, tf2); const v2 = verify(M, pins2, {}); if (!v || v2.fail < v.fail) { tf = tf2; v = v2; } } }
        if (v.fail > 0) { const tf3 = fitSmd(M, fp, pp.filter((q) => q.pad).map((q) => q.pad)); if (tf3) { const pins3 = placePads(M, pp, tf3); const v3 = verify(M, pins3, {}); if (v3.fail < v.fail) { tf = tf3; v = v3; } } }
        if (v.fail > 0) v.unmapped = `有 ${v.fail} 个焊盘核对不上（模型的坐标原点 / 姿态和 KiCad 封装不一致），这个模型不用于连线，只用同板其他模型`;
        v.transform = tf.name; if (tf.off) v.model_offset = tf.off; res.models[id] = v; }
      if (B.generic) res.note = "模型是 KiCad 通用封装（同尺寸芯片共用），不是这颗芯片专属的 CAD";
    } else { // ③ 只有封装 → 生成近似外形
      res.mode = "footprint"; res.src = `KiCad 封装 ${B.fp}（按数据手册的焊盘图）；外形 = 封装的 F.Fab 轮廓，厚度为估算`;
      const g = makeGen(bi, B, fp, pp); gen.push(g.part); res.models[g.part.id] = g.v;
    }
  }
  // 引脚间距：所有引脚的最近邻间距（中位数）对比数据手册 / 封装间距
  for (const [id, v] of Object.entries(res.models)) { if (!v.unmapped) modelMap[id] = bi.id; const pts = v.pads.filter((p) => !p.est).map((p) => p.p); const nn = nnPitch(pts); v.pitch = { ...nn, expected: B.pitch, ok: Math.abs(nn.mode - B.pitch) <= 0.05, breadboard: Math.abs(nn.mode - 2.54) <= 0.05 && v.pads.every((q) => q.tht) }; if (!v.pitch.ok) v.pitch.note = bi.id === "hc-sr04" ? "CAD 模型把排针间距画成了 2.0 mm（实物 2.54 mm）：这是模型简化，界面照实提示" : "间距和数据手册不一致"; }
  report.boards.push(res);
  fs.writeFileSync(path.join(OUT, bi.id + ".json"), JSON.stringify(res));
}
function placePads(M, pp, tf) {
  return pp.filter((q) => q.pad).map(({ pin, pad }) => { const p = tf.f(pad.x, pad.y); const tht = pad.type === "thru_hole";
    let y = p[1]; if (tht) { // THT：孔周围一圈取样，找板面（离最低交点 2 mm 以内的最高面 = 板上表面）
      const r = (pad.drill || 1) / 2 + 0.35; const ys = []; for (let k = 0; k < 8; k++) ys.push(...rayYs(M, p[0] + r * Math.cos(k * Math.PI / 4), p[2] + r * Math.sin(k * Math.PI / 4)));
      if (ys.length) { const yb = Math.min(...ys); y = Math.max(...ys.filter((v) => v <= yb + 2.0)); } }
    const sw = pad.rot % 180 === 90; return { num: pin.num, name: pin.name, role: pin.role || pin.type, p: [r3(p[0]), r3(y), r3(p[2])], w: r3(sw ? pad.h : pad.w), h: r3(sw ? pad.w : pad.h), tht, d: pad.drill || 0, src: "footprint" }; });
}
function verify(M, pins, { cadOnly }) {
  const holes = (M.e.pinholes || []).map((h) => h.p), legs = (M.e.legs || []).map((l) => l.p);
  let fail = 0; const errs = [];
  for (const q of pins) { const d = Math.max(0, surfDist(M, q.p) - (q.tht && q.d ? q.d / 2 : 0)); /* THT：焊盘中心在孔里，孔壁离中心 = 钻孔半径 */ const inBox = q.p[0] >= M.lo[0] - TOL && q.p[0] <= M.hi[0] + TOL && q.p[2] >= M.lo[2] - TOL && q.p[2] <= M.hi[2] + TOL;
    let hole = null; if (q.tht && (holes.length || legs.length)) { hole = 1e9; for (const h of [...holes, ...legs]) hole = Math.min(hole, Math.hypot(h[0] - q.p[0], h[2] - q.p[2])); hole = r3(hole); }
    q.err = r3(d); q.hole = hole; q.ok = d <= TOL && inBox && (hole == null || hole <= TOL); if (!q.ok) fail++; errs.push(d); }
  return { model: M.id, glb: M.e.glb, cadOnly: !!cadOnly, n: pins.length, fail, err_max: r3(Math.max(...errs)), err_median: r3(median(errs)), holes_cad: holes.length, legs_cad: legs.length, pads: pins };
}
// ② FreeCAD 模型：针脚位置（v22 里用连通分量 + 细长判据在网格里找出来，坐标见日志）
function cadPins(kind, M, pins) {
  const comps = components(M); const thin = comps.filter((c) => Math.min(...c.d) < 1.3 && Math.max(...c.d) > 2.5 && c.d.filter((x) => x < 1.3).length >= 2);
  fs.writeFileSync(path.join(LOG, `cad-${kind}.txt`), thin.map((c) => c.lo.map(r3).join(",") + " | " + c.hi.map(r3).join(",")).join("\n"));
  const P = (n) => pins.find((p) => p.num === String(n));
  const mk = (pin, p, extra = {}) => ({ num: pin.num, name: pin.name, role: pin.role || pin.type, p: p.map(r3), w: 1, h: 1, tht: true, d: 0, ...extra });
  if (kind === "hcsr04") { // 4 根水平针，指向 +z，针尖处接杜邦母头
    // 这个模型的网格是焊在一起的一个连通块 → 改用顶点：针尖（z 最大的那一层）上的顶点 x 值两两成对 = 一根针的左右边
    const tip = []; for (const t of M.T) for (let k = 0; k < 3; k++) if (t[k][2] > M.hi[2] - 0.05) tip.push(t[k]);
    const xs = [...new Set(tip.map((q) => r3(q[0])))].sort((a, b) => a - b); const yl = Math.min(...tip.map((q) => q[1])), yh = Math.max(...tip.map((q) => q[1]));
    fs.writeFileSync(path.join(LOG, `cad-${kind}.txt`), `tip z=${r3(M.hi[2])} y=${r3(yl)}..${r3(yh)} xs=${xs.join(",")}\n`);
    const hp = []; for (let k = 0; k + 1 < xs.length; k += 2) hp.push({ lo: [xs[k], yl, M.hi[2] - 7.5], hi: [xs[k + 1], yh, M.hi[2]] }); hp.sort((a, b) => b.lo[0] - a.lo[0]);
    if (hp.length !== 4) throw new Error("hc-sr04 pins " + hp.length);
    return hp.map((c, k) => mk(P(k + 1), [(c.lo[0] + c.hi[0]) / 2, c.hi[1], c.hi[2] - 0.5], { src: "CAD 针尖（顺序 估算）", est_order: true, axis: [0, 0, 1] }));
  }
  // L298N 模块：6 针控制排针（CAD 量出来），螺丝端子 / 5V 端子没有细长针 → 按端子块包围盒估算
  const hdr = thin.filter((c) => c.d[1] > 2.5 && Math.abs((c.lo[2] + c.hi[2]) / 2 - 17.5) < 1.2 && (c.lo[0] + c.hi[0]) / 2 > -1).sort((a, b) => a.lo[0] - b.lo[0]);
  if (hdr.length < 6) throw new Error("l298n header " + hdr.length);
  const H = hdr.slice(0, 6).map((c) => [(c.lo[0] + c.hi[0]) / 2, c.hi[1] - 0.3, (c.lo[2] + c.hi[2]) / 2]);
  const out = ["ENA", "IN1", "IN2", "IN3", "IN4", "ENB"].map((nm, k) => mk(pins.find((p) => p.name === nm), H[k], { src: "CAD 排针（顺序 估算）", est_order: true }));
  // 端子：在模型顶面附近找蓝色端子块不现实（材质只有一个金属色）→ 用 CAD 包围盒边缘 + 常见布局估算，明确标“估算”
  const yTop = (x, z) => { const ys = rayYs(M, x, z); return ys.length ? ys[ys.length - 1] : M.hi[1]; };
  const ed = { xL: M.lo[0] + 3.5, xR: M.hi[0] - 3.5, zF: M.hi[2] - 3.5 };
  const T = [["OUT1", [ed.xL, -5.08]], ["OUT2", [ed.xL, -10.16]], ["OUT3", [ed.xR, -10.16]], ["OUT4", [ed.xR, -5.08]]];
  for (const [nm, [x, z]] of T) out.push(mk(pins.find((p) => p.name === nm), [x, yTop(x, z), z], { src: "估算（端子块位置）", est: true, tht: false }));
  for (const [nm, dx] of [["+12V", -10], ["GND", -5], ["+5V", 0]]) { const x = (M.lo[0] + M.hi[0]) / 2 - 8 + dx + 13; out.push(mk(pins.find((p) => p.name === nm), [x, yTop(x, ed.zF), ed.zF], { src: "估算（端子块位置）", est: true, tht: false })); }
  return out;
}
function components(M) {
  const V = [], vid = []; const id = new Map(); const key = (q) => q.map((x) => Math.round(x * 200)).join(",");
  for (const t of M.T) for (let k = 0; k < 3; k++) { const s = key(t[k]); if (!id.has(s)) { id.set(s, id.size); V.push(t[k]); } vid.push(id.get(s)); }
  const p = [...Array(id.size).keys()]; const f = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  for (let t = 0; t < vid.length; t += 3) { p[f(vid[t])] = f(vid[t + 1]); p[f(vid[t + 2])] = f(vid[t + 1]); }
  const C = new Map(); V.forEach((q, i) => { const r = f(i); let c = C.get(r); if (!c) { c = { lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] }; C.set(r, c); } for (let k = 0; k < 3; k++) { c.lo[k] = Math.min(c.lo[k], q[k]); c.hi[k] = Math.max(c.hi[k], q[k]); } });
  return [...C.values()].map((c) => ({ ...c, d: c.hi.map((h, k) => h - c.lo[k]) }));
}
// ③ 生成“按封装的近似外形”零件：板 = F.Fab 轮廓（无则用焊盘包围盒 + 1 mm），厚度估算；焊盘 = 封装焊盘
function makeGen(bi, B, fp, pp) {
  const all = fp.pads; const pb = [Math.min(...all.map((p) => p.x - p.w / 2)), Math.min(...all.map((p) => p.y - p.h / 2)), Math.max(...all.map((p) => p.x + p.w / 2)), Math.max(...all.map((p) => p.y + p.h / 2))];
  const ic = B.gen.ic; let b = fp.fab || fp.crt || pb; if (ic === "multiwatt") b = fp.fab; // Multiwatt15 封装外形
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, W = b[2] - b[0], D = b[3] - b[1];
  const id = "p-fp-" + bi.id; const t = B.gen.t;
  const H = ic === "multiwatt" ? 10 : ic === "lga" ? 1.56 : t; // 估算：Multiwatt 塑封体只取 10 mm 高（实物更高、带散热片）；LGA 用 VL53L1x 模型同厚度
  const lift = ic === "multiwatt" ? 4.58 : 0; // 引脚长 4.58 mm（封装名里的 Lead4.58mm）
  const pads = pp.filter((q) => q.pad).map(({ pin, pad }) => { const sw = pad.rot % 180 === 90; const tht = pad.type === "thru_hole";
    return { num: pin.num, name: pin.name, role: pin.role || pin.type, p: [r3(pad.x - cx), r3(ic === "multiwatt" ? 0 : ic === "lga" ? 0 : t), r3(pad.y - cy)], w: r3(sw ? pad.h : pad.w), h: r3(sw ? pad.w : pad.h), tht, d: pad.drill || 0, src: "footprint" }; });
  const prims = [];
  if (ic === "multiwatt") { prims.push({ k: "box", c: [0, lift + H / 2, 0], h: [W / 2, H / 2, D / 2], m: "black" }); for (const q of pads) prims.push({ k: "box", c: [q.p[0], lift / 2, q.p[2]], h: [0.25, lift / 2 + 0.2, 0.25], m: "steel" }); }
  else if (ic === "lga") { prims.push({ k: "box", c: [0, H / 2, 0], h: [W / 2, H / 2, D / 2], m: "black" }); for (const q of pads) q.p[1] = 0; for (const q of pads) prims.push({ k: "box", c: [q.p[0], 0.01, q.p[2]], h: [q.w / 2, 0.01, q.h / 2], m: "brass" }); }
  else { prims.push({ k: "box", c: [0, t / 2, 0], h: [W / 2, t / 2, D / 2], m: B.gen.cat === "driver" ? "red" : bi.id.startsWith("arduino") ? "blue" : "green" });
    for (const q of pads) prims.push(q.tht ? { k: "cyl", c: [q.p[0], t + 0.02, q.p[2]], r: Math.max(q.w, q.h) / 2, h: 0.04, m: "brass" } : { k: "box", c: [q.p[0], t + 0.02, q.p[2]], h: [q.w / 2, 0.02, q.h / 2], m: "brass" }); }
  const colliders = [{ c: [0, ic === "multiwatt" ? (lift + H) / 2 : (H || t) / 2, 0], h: [W / 2, (ic === "multiwatt" ? lift + H : H || t) / 2, D / 2] }];
  const part = { id, board: bi.id, name_zh: `${bi.zh}（按 KiCad 封装生成的近似外形）`, name: `${bi.id} (footprint-derived body)`, cat: B.gen.cat,
    dims_mm: { x: r3(W), y: r3(ic === "multiwatt" ? lift + H : H || t), z: r3(D) }, dims_src: `长宽 = KiCad 封装 ${B.fp} 的 F.Fab 轮廓；厚度 估算`, prims, colliders, pads,
    footprint: { name: B.fp, url: fpUrl(B.fp) }, est: true, W: r3(W), D: r3(D), t, H, lift, ic, color: prims[0].m };
  // 核对：生成件的焊盘本来就按封装放在板面上 → 距离按板面算
  const errs = pads.map((q) => { const inside = Math.abs(q.p[0]) <= W / 2 + q.w / 2 + 1e-6 && Math.abs(q.p[2]) <= D / 2 + q.h / 2 + 1e-6; q.err = inside ? 0 : 9; q.ok = inside; q.hole = null; return q.err; });
  return { part, v: { model: id, glb: null, generated: true, n: pads.length, fail: pads.filter((q) => !q.ok).length, err_max: Math.max(...errs), err_median: median(errs), pads } };
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ generated: report.generated, tol_mm: TOL, footprints: report.footprints, models: modelMap,
  boards: report.boards.map((b) => ({ id: b.id, mode: b.mode, models: Object.keys(b.models), n: Object.values(b.models)[0]?.n, fail: Object.values(b.models).reduce((s, v) => s + v.fail, 0), err_max: Math.max(...Object.values(b.models).map((v) => v.err_max)) })) }));
const compact = gen.map((g) => ({ id: g.id, board: g.board, zh: g.name_zh, cat: g.cat, fp: g.footprint.name, url: g.footprint.url, W: g.W, D: g.D, t: g.t, H: g.H, lift: g.lift, ic: g.ic || null, color: g.color,
  pads: g.pads.map((q) => [q.p[0], q.p[1], q.p[2], q.w, q.h, q.tht ? 1 : 0, q.d, q.num, q.name, q.role]) }));
fs.writeFileSync(path.join(ROOT, "src/assembly/fpBoards.gen.js"), "// 由 scripts/build-physpins.mjs 生成（v22）：只有 KiCad 封装、没有 CAD 模型的板 → 按封装生成的近似外形（mm）。不要手改。\n// pads: [x, y, z, w, h, tht, drill, 引脚号, 名称, 类型]\nexport const FP_BOARDS = " + JSON.stringify(compact) + ";\n");
// 日志
const lines = []; for (const b of report.boards) for (const [id, v] of Object.entries(b.models)) lines.push(`${b.id.padEnd(20)} ${b.mode.padEnd(14)} ${id.padEnd(32)} n=${String(v.n).padStart(2)} fail=${v.fail} max=${v.err_max} med=${v.err_median} pitch=${v.pitch.median}/${v.pitch.expected}${v.pitch.ok ? "" : "✗"} ${v.transform || ""}`);
fs.writeFileSync(path.join(LOG, "physpins.txt"), lines.join("\n") + "\n"); console.log(lines.join("\n"));
