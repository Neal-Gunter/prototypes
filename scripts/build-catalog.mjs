// 把 ../libsrc/manifest.json（来源、许可）和 ../libsrc/meta/*.json（转换时从 CAD 量出来的尺寸、碰撞盒、引脚）
// 合成网页用的目录：public/lib/catalog/<分类>.json（按分类懒加载）+ public/lib/index.json（搜索用的轻量索引）。
// 只做合并和少量“按数据手册/实测”的覆盖，不臆造参数。用法：node scripts/build-catalog.mjs
import fs from "node:fs";
import path from "node:path";
import { CATS } from "./lib/manifest.mjs";

const LIB = path.resolve("../libsrc");
const OUT = path.resolve("public/lib");
const man = JSON.parse(fs.readFileSync(path.join(LIB, "manifest.json"), "utf8"));
const r2 = (v) => Math.round(v * 100) / 100;

// ---- 覆盖：都写清楚依据 ----
const OVERRIDE = {
  // Adafruit Feather ESP32‑S3（5323）：安装孔按 Adafruit 产品页“2.5 mm 安装孔、45.72 × 17.78 mm 间距”统一成 Ø2.5；
  // 接口位置取自 CAD 里 USB‑C 和 JST‑PH 两个元件的包围盒（转换时量的）
  "ada-5323": (e) => {
    e.holes = e.holes.map((h) => ({ ...h, d: 2.5 }));
    e.holes_src = "Adafruit 产品页：Ø2.5 mm 安装孔（位置取 CAD）";
    e.board = "feather-s3";
    e.ports = [
      { kind: "usb-c", p: [-26.11, 2.69, 0], dir: [-1, 0, 0], src: "CAD 中 USB‑C 座包围盒" },
      { kind: "jst-ph2", p: [-18.06, 3.97, -7.34], dir: [-1, 0, 0], src: "CAD 中 JST‑PH 座包围盒" },
    ];
  },
  // Raspberry Pi Pico（KiCad 模型带焊好的排针）：安装孔按树莓派官方 Pico 数据手册 Ø2.1 mm、47.0 × 11.4 mm；
  // 孔所在高度 = 排针塑料底座 2.5 mm + Pico 板厚 1 mm（数据手册）以上
  "kc-raspberrypi_pico_h": (e) => {
    const y = r2(e.pcb_top_y + 2.5 + 1.0);
    e.holes = [[-5.7, -23.5], [5.7, -23.5], [-5.7, 23.5], [5.7, 23.5]].map(([x, z]) => ({ p: [x, y, z], d: 2.1 }));
    e.holes_src = "树莓派 Pico 数据手册：Ø2.1 mm，47.0 × 11.4 mm";
    e.board = "pico";
    e.ports = [{ kind: "micro-usb", p: [0, r2((y + e.dims_mm.y) / 2), -e.dims_mm.z / 2], dir: [0, 0, -1], src: "CAD 包围盒（估算）" }];
  },
  // 微型舵机（1143）：转换器把机身和耳朵并成一个大盒子，这里按 CAD 实测重新分层：耳朵在 18.8–20.8 mm，孔 Ø≈1.7 mm
  "ada-1143": (e) => {
    const box = (x0, x1, y0, y1, z0, z1) => ({ c: [r2((x0 + x1) / 20), r2((y0 + y1) / 20), r2((z0 + z1) / 20)], h: [r2((x1 - x0) / 20), r2((y1 - y0) / 20), r2((z1 - z0) / 20)] });
    e.colliders = [box(-6, 6, 0, 18.8, -11.45, 11.15), box(-6, 6, 18.8, 20.8, -15.65, 15.65), box(-6, 6, 20.8, 27.18, -11.45, 11.15), box(-2.5, 2.5, 27.18, 30.68, 2.68, 7.62)];
    e.holes = [{ p: [0, 20.8, 14.75], d: 1.7 }, { p: [0, 20.8, -14.68], d: 1.7 }];
    e.holes_src = "CAD 实测（耳朵上的两个孔）";
    e.servo = { tabBottom: 18.8, tabTop: 20.8, shaft: [0, 30.68, 5.15], body: [12, 22.6] };
  },
};

fs.rmSync(path.join(OUT, "catalog"), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "catalog"), { recursive: true });
const byCat = {};
const index = [];
let skipped = 0;
for (const m of man) {
  const f = path.join(LIB, "meta", m.id + ".json");
  if (!fs.existsSync(f)) { skipped++; continue; }
  const meta = JSON.parse(fs.readFileSync(f, "utf8"));
  if (meta.error) { skipped++; continue; }
  const e = {
    id: m.id,
    name: m.name,
    name_zh: m.name_zh,
    cat: m.cat,
    glb: `/lib/${m.cat}/${m.id}.glb`,
    thumb: `/lib/thumbs/${m.id}.webp`,
    dims_mm: meta.dims_mm,
    dims_src: meta.dims_src,
    tris: meta.tris,
    kb: Math.round(meta.glb_bytes / 1024),
    colliders: meta.colliders,
    legs: meta.legs?.length ? meta.legs : undefined,
    pcb_top_y: meta.pcb_top_y ?? undefined,
    holes: meta.holes?.length ? meta.holes : undefined,
    pinholes: meta.pinholes?.length ? meta.pinholes : undefined,
    pitch_mm: m.pitch_mm ?? undefined,
    product: m.product,
    source: m.source,
    licence: m.licence,
    url: m.url,
    product_url: m.product_url,
    mass: null, // 质量没有核实来源：页面上按碰撞盒体积 × 材料密度显示“估算”
  };
  OVERRIDE[m.id]?.(e);
  (byCat[m.cat] ||= []).push(e);
  index.push([e.id, e.name_zh, e.name, e.cat, [r2(e.dims_mm.x), r2(e.dims_mm.z), r2(e.dims_mm.y)], e.licence.startsWith("MIT") ? "MIT" : "CC-BY-SA-4.0"]);
}
for (const [cat, list] of Object.entries(byCat)) {
  list.sort((a, b) => a.name_zh.localeCompare(b.name_zh, "zh"));
  fs.writeFileSync(path.join(OUT, "catalog", cat + ".json"), JSON.stringify(list));
}
const cats = Object.entries(CATS).map(([key, label]) => ({ key, label, real: byCat[key]?.length || 0 }));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), total: index.length, cats, parts: index }));
console.log("parts", index.length, "skipped", skipped);
console.log(cats.map((c) => `${c.key}:${c.real}`).join(" "));
