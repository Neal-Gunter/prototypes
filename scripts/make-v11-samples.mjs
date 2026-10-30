// v11：自制 CC0 示例文件（小车 GLB、支架 OBJ、两块 STL、坏 STL、功能图 SVG）。node scripts/make-v11-samples.mjs OUTDIR
import fs from "node:fs";
import path from "node:path";
const OUT = process.argv[2] || "e2e/fixtures/v11";
fs.mkdirSync(OUT, { recursive: true });

function box(c, s) {
  const [cx, cy, cz] = c, [hx, hy, hz] = s.map((v) => v / 2);
  const P = [], I = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, u, v] of faces) {
    const b = P.length / 3;
    for (const [a, d] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.push(cx + (n[0] + a * u[0] + d * v[0]) * hx, cy + (n[1] + a * u[1] + d * v[1]) * hy, cz + (n[2] + a * u[2] + d * v[2]) * hz);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { P, I };
}
function cylX(c, r, len, seg = 24) {
  // 沿 x 轴的圆柱（闭合）
  const P = [], I = [];
  const [cx, cy, cz] = c;
  for (const side of [-1, 1]) { P.push(cx + (side * len) / 2, cy, cz); for (let i = 0; i < seg; i++) { const t = (i / seg) * Math.PI * 2; P.push(cx + (side * len) / 2, cy + r * Math.cos(t), cz + r * Math.sin(t)); } }
  const A = 0, B = seg + 1;
  for (let i = 0; i < seg; i++) {
    const a0 = 1 + i, a1 = 1 + ((i + 1) % seg), b0 = B + 1 + i, b1 = B + 1 + ((i + 1) % seg);
    I.push(A, a1, a0, B, b0, b1, a0, a1, b1, a0, b1, b0);
  }
  return { P, I };
}
const merge = (...ms) => { const P = [], I = []; for (const m of ms) { const b = P.length / 3; P.push(...m.P); I.push(...m.I.map((i) => i + b)); } return { P, I }; };

// ---------- GLB（米，glTF 规范单位）----------
function writeGlb(file, groups) {
  const bufs = [], accessors = [], bufferViews = [], meshes = [], nodes = [], materials = [];
  let off = 0;
  const push = (arr, target) => { const b = Buffer.from(arr.buffer); bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length, target }); bufs.push(b); off += b.length; const pad = (4 - (off % 4)) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); off += pad; } return bufferViews.length - 1; };
  const rootChildren = [];
  for (const g of groups) {
    const kids = [];
    for (const m of g.meshes) {
      const P = new Float32Array(m.geo.P), I = new Uint32Array(m.geo.I);
      const mn = [0, 1, 2].map((k) => Math.min(...P.filter((_, i) => i % 3 === k))), mx = [0, 1, 2].map((k) => Math.max(...P.filter((_, i) => i % 3 === k)));
      const pv = push(P, 34962), iv = push(I, 34963);
      accessors.push({ bufferView: pv, componentType: 5126, count: P.length / 3, type: "VEC3", min: mn, max: mx });
      accessors.push({ bufferView: iv, componentType: 5125, count: I.length, type: "SCALAR" });
      materials.push({ name: m.name, pbrMetallicRoughness: { baseColorFactor: [...m.color, 1], metallicFactor: 0.1, roughnessFactor: 0.7 } });
      meshes.push({ name: m.name, primitives: [{ attributes: { POSITION: accessors.length - 2 }, indices: accessors.length - 1, material: materials.length - 1 }] });
      nodes.push({ name: m.name, mesh: meshes.length - 1 });
      kids.push(nodes.length - 1);
    }
    nodes.push({ name: g.name, children: kids });
    rootChildren.push(nodes.length - 1);
  }
  nodes.push({ name: "小车示例（自制，CC0）", children: rootChildren });
  const j = { asset: { version: "2.0", generator: "prototypes v11 sample (CC0)" }, scene: 0, scenes: [{ nodes: [nodes.length - 1] }], nodes, meshes, materials, accessors, bufferViews, buffers: [{ byteLength: off }] };
  let js = Buffer.from(JSON.stringify(j)); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const bin = Buffer.concat(bufs);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([h, jh, js, bh, bin]));
}
const mm = (v) => v / 1000;
const B = (c, s) => box(c.map(mm), s.map(mm));
writeGlb(path.join(OUT, "sample-rover.glb"), [
  { name: "底盘", meshes: [{ name: "底板", color: [0.25, 0.27, 0.3], geo: B([0, 24, 0], [120, 6, 80]) }] },
  { name: "电池盒", meshes: [{ name: "2×18650 电池盒", color: [0.1, 0.1, 0.1], geo: B([-25, 37, 0], [70, 20, 42]) }] },
  { name: "主控板", meshes: [{ name: "PCB", color: [0.1, 0.45, 0.2], geo: B([30, 28, 0], [50, 1.6, 30]) }, { name: "主控芯片", color: [0.15, 0.15, 0.15], geo: B([30, 30.3, 0], [12, 3, 12]) }] },
  { name: "电机驱动", meshes: [{ name: "驱动板", color: [0.6, 0.1, 0.1], geo: B([30, 22, 25], [30, 1.6, 20]) }] },
  { name: "左电机", meshes: [{ name: "左电机", color: [0.8, 0.7, 0.2], geo: cylX([mm(-0), mm(14), mm(-30)].map((v, i) => (i === 0 ? mm(-45) : v)), mm(10), mm(30)) }] },
  { name: "右电机", meshes: [{ name: "右电机", color: [0.8, 0.7, 0.2], geo: cylX([mm(45), mm(14), mm(-30)], mm(10), mm(30)) }] },
  { name: "左轮", meshes: [{ name: "左轮", color: [0.05, 0.05, 0.05], geo: cylX([mm(-66), mm(20), mm(-30)], mm(20), mm(10)) }] },
  { name: "右轮", meshes: [{ name: "右轮", color: [0.05, 0.05, 0.05], geo: cylX([mm(66), mm(20), mm(-30)], mm(20), mm(10)) }] },
  { name: "万向轮", meshes: [{ name: "万向轮", color: [0.7, 0.7, 0.7], geo: B([0, 10.5, 30], [16, 21, 16]) }] },
]);

// ---------- OBJ（毫米，o 分组）----------
function objText(objs) {
  let s = "# 自制 L 形支架示例（CC0），单位毫米\n", vb = 1;
  for (const o of objs) {
    s += `o ${o.name}\n`;
    for (let i = 0; i < o.geo.P.length; i += 3) s += `v ${o.geo.P[i].toFixed(3)} ${o.geo.P[i + 1].toFixed(3)} ${o.geo.P[i + 2].toFixed(3)}\n`;
    for (let i = 0; i < o.geo.I.length; i += 3) s += `f ${o.geo.I[i] + vb} ${o.geo.I[i + 1] + vb} ${o.geo.I[i + 2] + vb}\n`;
    vb += o.geo.P.length / 3;
  }
  return s;
}
fs.writeFileSync(path.join(OUT, "sample-bracket.obj"), objText([
  { name: "底板", geo: box([0, 1.5, 0], [40, 3, 30]) },
  { name: "立板", geo: box([-18.5, 18, 0], [3, 30, 30]) },
  { name: "加强筋", geo: box([-10, 10, 0], [12, 12, 3]) },
]));

// ---------- STL（二进制，毫米，两块不相连）----------
function writeStl(file, geo, { truncate = false } = {}) {
  const n = geo.I.length / 3;
  const b = Buffer.alloc(84 + n * 50);
  b.write("prototypes v11 sample STL (CC0) two blocks, mm", 0);
  b.writeUInt32LE(n, 80);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50;
    for (let k = 0; k < 3; k++) { const v = geo.I[t * 3 + k]; for (let a = 0; a < 3; a++) b.writeFloatLE(geo.P[v * 3 + a], o + 12 + k * 12 + a * 4); }
  }
  fs.writeFileSync(file, truncate ? b.subarray(0, 84 + Math.floor(n / 2) * 50) : b);
}
const two = merge(box([0, 5, 0], [20, 10, 10]), box([20, 5, 0], [10, 10, 10]));
writeStl(path.join(OUT, "sample-two-blocks.stl"), two);
writeStl(path.join(OUT, "broken-truncated.stl"), two, { truncate: true });
fs.writeFileSync(path.join(OUT, "broken-not-a-model.glb"), "this is not a glb file\n");

// ---------- 功能图 SVG（小车）----------
const blk = (x, y, w, h, t, sub, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${c}" stroke="#333" stroke-width="2"/><text x="${x + w / 2}" y="${y + h / 2 - 4}" font-size="22" text-anchor="middle" font-family="sans-serif">${t}</text><text x="${x + w / 2}" y="${y + h / 2 + 22}" font-size="15" text-anchor="middle" fill="#444" font-family="sans-serif">${sub}</text>`;
const arr = (x1, y1, x2, y2, t) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="2.5" marker-end="url(#a)"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" font-size="14" text-anchor="middle" font-family="sans-serif" fill="#a33">${t}</text>`;
fs.writeFileSync(path.join(OUT, "sample-rover-functions.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560" viewBox="0 0 1000 560">
<defs><marker id="a" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>
<rect width="1000" height="560" fill="#fff"/>
<text x="20" y="36" font-size="24" font-family="sans-serif">小车功能图（自制示例，CC0）</text>
${blk(40, 90, 200, 110, "供电", "2×18650 电池盒", "#fde2df")}
${blk(400, 90, 200, 110, "控制", "主控板", "#dfe8fb")}
${blk(760, 90, 200, 110, "通信", "主控板上的无线", "#e8dcf3")}
${blk(400, 330, 200, 110, "驱动", "电机驱动板", "#fff3c9")}
${blk(150, 330, 200, 110, "执行（左）", "左电机 + 左轮", "#dff2e4")}
${blk(650, 330, 200, 110, "执行（右）", "右电机 + 右轮", "#dff2e4")}
${blk(40, 470, 920, 70, "结构", "底盘 + 万向轮", "#eeeeee")}
${arr(240, 145, 400, 145, "VBAT 7.4 V")}${arr(600, 145, 760, 145, "UART")}${arr(500, 200, 500, 330, "PWM ×2")}${arr(400, 385, 350, 385, "M1")}${arr(600, 385, 650, 385, "M2")}${arr(140, 200, 420, 330, "VM")}
</svg>
`);
fs.writeFileSync(path.join(OUT, "LICENSE-samples.txt"), "这些示例文件（sample-*.glb/.obj/.stl/.svg/.png、broken-*）由本项目脚本 scripts/make-v11-samples.mjs 自制，按 CC0 1.0 放弃版权，可随意使用。\nThese sample files were generated by scripts/make-v11-samples.mjs and are dedicated to the public domain under CC0 1.0.\n");
console.log("samples →", OUT, fs.readdirSync(OUT));
