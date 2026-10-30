// v22：引脚物理位置测试（无浏览器）。
//  ① 每个已映射的 CAD 模型：从发布的 GLB 重新读三角形，逐个引脚算到模型表面的距离（通孔减去孔半径），必须 ≤ 容差；焊盘必须在模型包围盒内
//  ② 引脚间距：和数据手册 / 封装间距一致（HC-SR04 例外：CAD 模型简化成 2.0 mm，必须被标出来）
//  ③ 进引擎后：toDef / 生成件里每个引脚都有锚点 + 名字；Pico / Feather 的焊盘和原来的孔重合（不新增孔）
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core"; import { ALL_EXTENSIONS } from "@gltf-transform/extensions"; import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
let pass = 0, fail = 0; const log = []; const ok = (c, m) => { c ? pass++ : fail++; if (!c || process.env.V) log.push((c ? "✓ " : "✗ ") + m); };
const PD = path.join(ROOT, "public/pinouts/phys"); const IDX = JSON.parse(fs.readFileSync(path.join(PD, "index.json"), "utf8")); const TOL = IDX.tol_mm;
const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
function closest(p, a, b, c) { // Ericson 5.1.5
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
async function tris(glb) { const doc = await io.read(path.join(ROOT, "public", glb)); const T = [];
  for (const nd of doc.getRoot().listNodes()) { const m = nd.getMesh(); if (!m) continue; const W = nd.getWorldMatrix();
    for (const pr of m.listPrimitives()) { const pa = pr.getAttribute("POSITION"), ix = pr.getIndices(); const P = [], v = [0, 0, 0];
      for (let i = 0; i < pa.getCount(); i++) { pa.getElement(i, v); P.push([0, 1, 2].map((k) => 10 * (W[k] * v[0] + W[4 + k] * v[1] + W[8 + k] * v[2] + W[12 + k]))); }
      const n = ix ? ix.getCount() : pa.getCount(); for (let i = 0; i < n; i += 3) T.push([P[ix ? ix.getScalar(i) : i], P[ix ? ix.getScalar(i + 1) : i + 1], P[ix ? ix.getScalar(i + 2) : i + 2]]); } }
  return T; }
const surf = (T, p) => { let b = 1e9; for (const [a, b2, c] of T) { if (Math.min(a[0], b2[0], c[0]) - p[0] > b || p[0] - Math.max(a[0], b2[0], c[0]) > b || Math.min(a[2], b2[2], c[2]) - p[2] > b || p[2] - Math.max(a[2], b2[2], c[2]) > b) continue; const q = closest(p, a, b2, c); b = Math.min(b, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); } return b; };
const stats = []; const boards = new Set();
for (const B of IDX.boards) {
  boards.add(B.id); const J = JSON.parse(fs.readFileSync(path.join(PD, B.id + ".json"), "utf8"));
  ok(J.pins_src || J.src, `${B.id}：记录了来源（${(J.src || "").slice(0, 40)}）`);
  for (const [mid, v] of Object.entries(J.models)) {
    if (v.unmapped) { ok(!IDX.models[mid], `${mid} 映射失败 → 不进目录（照实标出）`); continue; }
    ok(IDX.models[mid] === B.id, `${mid} 在 index.models 里`);
    if (v.generated) { const errs = v.pads.map((q) => q.err); ok(errs.every((e) => e === 0), `${mid}（按封装生成）：${v.n} 个焊盘都在板面上`); stats.push([B.id, mid, "footprint", v.n, 0, 0, 0]); }
    else { const T = await tris(v.glb); const e = []; let est = 0;
      for (const q of v.pads) { if (q.est) { est++; continue; } const d = surf(T, q.p); e.push(Math.max(0, q.tht ? d - (q.d || 1) / 2 : d)); }
      const mx = Math.max(...e), md = e.slice().sort((a, b) => a - b)[e.length >> 1];
      ok(mx <= TOL, `${mid}：${e.length} 个引脚到模型表面最大 ${mx.toFixed(3)} mm（容差 ${TOL}）`); stats.push([B.id, mid, J.mode, e.length, est, +mx.toFixed(3), +md.toFixed(3)]); }
    const P = v.pitch; ok(P && (B.id === "hc-sr04" ? !P.ok && /2\.0 mm/.test(P.note || "") : P.ok), `${mid}：间距 ${P?.mode} mm（应为 ${P?.expected}）${B.id === "hc-sr04" ? " → 已标出不一致" : ""}`);
  }
}
ok(boards.size === 29, `29 块板/模块都有物理引脚表（${boards.size}）`);
// ③ 进引擎
const cat = Object.fromEntries(fs.readdirSync(path.join(ROOT, "public/lib/catalog")).flatMap((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "public/lib/catalog", f), "utf8"))).map((e) => [e.id, e]));
if (!process.env.NOBUNDLE) execSync("npx esbuild src/assembly/catalog.js --bundle --format=esm --platform=node --outfile=.tmp/cat-bundle.mjs --log-level=warning", { cwd: ROOT });
if (!process.env.NOBUNDLE) execSync("npx esbuild src/assembly/procedural.js --bundle --format=esm --platform=node --outfile=.tmp/proc-bundle.mjs --log-level=warning", { cwd: ROOT });
const C = await import(path.join(ROOT, ".tmp/cat-bundle.mjs")); const PR = await import(path.join(ROOT, ".tmp/proc-bundle.mjs"));
let engineN = 0;
for (const [mid, bid] of Object.entries(IDX.models)) {
  const isGen = mid.startsWith("p-fp-"); const def = isGen ? PR.PROC_BY_ID[mid] : C.toDef(cat[mid]);
  ok(def, `${mid} 能建成引擎零件`); if (!def) continue;
  const keys = Object.keys(def.physPins || {}); const n = isGen ? JSON.parse(fs.readFileSync(path.join(PD, bid + ".json"), "utf8")).models[mid].n : cat[mid].phys.pins.length;
  ok(keys.length === n, `${mid}：${keys.length}/${n} 个引脚有锚点和名字`); engineN += keys.length;
  for (const k of keys) { const t = k[0], i = +k.slice(1); const has = t === "p" ? def.anchors.some((a) => a.t === "pinhole" && a.i === i) : t === "s" ? def.anchors.some((a) => a.t === "pad" && a.i === i) : (def.legs || []).some((l) => l.i === i) || def.anchors.some((a) => a.t === "pin-up" && a.i === i); if (!has) { ok(false, `${mid} ${k} 没有锚点`); break; } }
  if (/^kc-raspberrypi_pico$|^ada-3405$|^ada-2821$|^ada-3403$/.test(mid)) ok(keys.every((k) => k[0] === "p") && def.anchors.filter((a) => a.t === "pinhole").length === (cat[mid].pinholes?.length || 40), `${mid}：焊盘全部落在原有的孔上（没有新增孔）`);
  if (mid === "kc-raspberrypi_pico") ok(C.PICO_PINS.every((n, i) => !def.physPins["p" + i] || def.physPins["p" + i].name.replace(/^GPIO/, "GP").replace(/^AGND$/, "GND").split("_ADC")[0] === n), `Pico：封装引脚名和原有 40 脚名表一致（1 号 = ${def.physPins.p0?.name}）`);
}
const out = process.env.OUT || "/tmp/v22phys"; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "physpins-test.txt"), ["board model mode pins est max_mm median_mm", ...stats.map((s) => s.join(" "))].join("\n") + "\n");
console.log(log.join("\n")); console.log(`physpins-test：${pass} 通过 / ${fail} 失败（引擎里 ${engineN} 个有名字的引脚）`); process.exit(fail ? 1 : 0);
