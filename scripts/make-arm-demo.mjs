// v12：第二个内置示例 = 两自由度小机械臂（本项目自己画的，CC0）。输出 public/demo/arm2dof.{obj,project.json,functions.svg}
// 尺寸是我定的（我的补充）：舵机外壳按 MG90S 这一档的大小画成方块（估算外形，不是 datasheet 尺寸）；质量里只有 MG90S 13.4 g 是 datasheet 数，其余按 PLA 体积估算。
import fs from "node:fs";
const W = 1000, H = 620;
// 盒子 / 圆柱 → OBJ（毫米，Y 朝上）
let obj = "# 两自由度小机械臂（本项目自制，CC0 公共领域）。单位 mm，Y 朝上。\n", vn = 0;
const quad = (a, b, c, d) => `f ${a} ${b} ${c}\nf ${a} ${c} ${d}\n`;
function box(name, [x0, x1], [y0, y1], [z0, z1]) {
  obj += `o ${name}\n`;
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  for (const p of P) obj += `v ${p.join(" ")}\n`;
  const i = (k) => vn + k + 1;
  obj += quad(i(0), i(3), i(2), i(1)) + quad(i(4), i(5), i(6), i(7)) + quad(i(0), i(1), i(5), i(4)) + quad(i(3), i(7), i(6), i(2)) + quad(i(0), i(4), i(7), i(3)) + quad(i(1), i(2), i(6), i(5));
  vn += 8;
}
function cyl(name, r, [y0, y1], n = 24) {
  obj += `o ${name}\n`;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; obj += `v ${(r * Math.cos(a)).toFixed(4)} ${y0} ${(r * Math.sin(a)).toFixed(4)}\nv ${(r * Math.cos(a)).toFixed(4)} ${y1} ${(r * Math.sin(a)).toFixed(4)}\n`; }
  obj += `v 0 ${y0} 0\nv 0 ${y1} 0\n`;
  const b = (k) => vn + 2 * (k % n) + 1, t = (k) => b(k) + 1, cb = vn + 2 * n + 1, ct = cb + 1;
  for (let k = 0; k < n; k++) obj += quad(b(k), t(k), t(k + 1), b(k + 1)) + `f ${cb} ${b(k + 1)} ${b(k)}\nf ${ct} ${t(k)} ${t(k + 1)}\n`;
  vn += 2 * n + 2;
}
box("底座", [-30, 30], [0, 8], [-30, 30]);
box("底座舵机 MG90S（偏航）", [-6, 6], [8, 30], [-11, 11]);
cyl("转台", 14, [31, 35]);
box("肩部舵机 MG90S（俯仰）", [-6, 6], [35, 59], [-11, 11]);
box("大臂", [-6, 80], [43, 51], [12, 17]);
box("末端推板", [72, 80], [6, 51], [10, 19]);
fs.writeFileSync("public/demo/arm2dof.obj", obj);

const mods = [
  { id: "a0", name: "底座", color: "#c9c2b0", material: "pla" },
  { id: "a1", name: "底座舵机 MG90S（偏航）", color: "#2f6fd6", material: "mixed", massG: 13.4 },
  { id: "a2", name: "转台", color: "#e0b322", material: "pla" },
  { id: "a3", name: "肩部舵机 MG90S（俯仰）", color: "#2f6fd6", material: "mixed", massG: 13.4 },
  { id: "a4", name: "大臂", color: "#e07a2b", material: "pla" },
  { id: "a5", name: "末端推板", color: "#d23a2f", material: "pla" },
].map((m, i) => ({ massG: null, ...m, meshes: [`m${i}`], collider: "hull", hidden: false }));
const drive = (preset) => ({ preset, volt: 4.8, torque: 1, speed: 300, forceN: 5, speedMm: 20 });
const joints = [
  { id: "j-yaw", name: "底座偏航", type: "revolute", parent: "a1", child: "a2", anchor: [0, 33, 0], axis: [0, 1, 0], limits: { min: -90, max: 90 }, drive: drive("mg90s"), home: 0 },
  { id: "j-turret", name: "肩部舵机固定在转台上", type: "fixed", parent: "a2", child: "a3", anchor: [0, 35, 0], axis: [0, 1, 0], limits: { min: 0, max: 0 }, drive: drive("none"), home: 0 },
  { id: "j-pitch", name: "肩部俯仰", type: "revolute", parent: "a3", child: "a4", anchor: [0, 47, 14.5], axis: [0, 0, 1], limits: { min: -20, max: 80 }, drive: drive("mg90s"), home: 0 },
  { id: "j-paddle", name: "推板粘在大臂上", type: "fixed", parent: "a4", child: "a5", anchor: [76, 47, 14.5], axis: [0, 1, 0], limits: { min: 0, max: 0 }, drive: drive("none"), home: 0 },
];
const B = { yaw: [40, 110, 280, 140], pitch: [360, 110, 280, 140], push: [680, 110, 280, 140], frame: [40, 330, 280, 110], ctl: [360, 330, 280, 110] };
const rgn = (k) => ({ x: B[k][0] / W, y: B[k][1] / H, w: B[k][2] / W, h: B[k][3] / H });
const functions = [
  { id: "f-yaw", name: "底座转动（偏航）", kind: "驱动", color: "#2f6fd6", regions: [rgn("yaw")], pins: [{ label: "PWM1", signal: "50 Hz，0.5–2.5 ms（常见舵机信号，估算）" }], modules: ["a1", "a2"], joints: ["j-yaw"], note: "MG90S 带转台左右转" },
  { id: "f-pitch", name: "抬臂（俯仰）", kind: "驱动", color: "#8a4fbf", regions: [rgn("pitch")], pins: [{ label: "PWM2", signal: "50 Hz" }], modules: ["a3", "a4"], joints: ["j-pitch"], note: "MG90S 带大臂上下摆；压太低推板会碰到地面" },
  { id: "f-push", name: "推方块（执行）", kind: "执行", color: "#d23a2f", regions: [rgn("push")], pins: [], modules: ["a4", "a5"], joints: ["j-yaw", "j-pitch"], note: "两个关节一起动；点“放测试方块”看它把方块推走" },
  { id: "f-frame", name: "结构", kind: "结构", color: "#a89a7a", regions: [rgn("frame")], pins: [], modules: ["a0", "a2"], joints: [], note: "底座用“固定底座”拧在地面上" },
  { id: "f-ctl", name: "主控（没画进 3D）", kind: "控制", color: "#2f8f4e", regions: [rgn("ctl")], pins: [{ label: "PWM1 / PWM2", signal: "任意两路 PWM 输出" }], modules: [], joints: [], note: "示意：任意能出两路 PWM 的板子" },
];
const pose = (id, name, values) => ({ id, name, values });
const poses = [pose("p-home", "回中", { "j-yaw": 0, "j-pitch": 0 }), pose("p-right", "右转", { "j-yaw": -60, "j-pitch": 0 }), pose("p-left", "左转（推方块）", { "j-yaw": 70, "j-pitch": 0 }), pose("p-up", "抬起", { "j-yaw": 70, "j-pitch": 60 }), pose("p-low", "压低（会碰地）", { "j-yaw": 0, "j-pitch": -20 })];
const project = {
  schema: "proto-modellab/1", id: "builtin-arm2dof", builtin: true, name: "内置示例：两自由度小机械臂（关节 + 舵机）", updated: 0,
  notes: "本项目自制（CC0）。外形尺寸是我定的（舵机外壳按 MG90S 这一档画成方块，估算外形）；MG90S 的扭矩、速度、13.4 g 来自 Tower Pro datasheet，其余质量按 PLA 体积估算。",
  model: { file: "arm2dof.obj", builtin: "demo/arm2dof.obj", units: "mm", scale: 1, upAxis: "y", unitWhy: "画的时候就是毫米", split: "auto" },
  modules: mods, functions, joints, poses,
  timeline: { loop: false, keys: [{ t: 0, pose: "p-home" }, { t: 0.8, pose: "p-right" }, { t: 2.4, pose: "p-left" }, { t: 3.4, pose: "p-up" }, { t: 4.4, pose: "p-home" }] },
  sim: { fixBase: true, block: [58, 10, -46] },
  diagram: { file: "arm2dof-functions.svg", builtin: "demo/arm2dof-functions.svg", mime: "image/svg+xml", w: W, h: H },
};
fs.writeFileSync("public/demo/arm2dof.project.json", JSON.stringify(project, null, 1));
const bx = (k, t, sub, fill) => { const [x, y, w, h] = B[k]; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="#333" stroke-width="2"/><text x="${x + w / 2}" y="${y + 44}" font-size="22" text-anchor="middle" font-family="sans-serif" font-weight="bold">${t}</text>${sub.map((s, i) => `<text x="${x + w / 2}" y="${y + 74 + i * 22}" font-size="15" text-anchor="middle" fill="#444" font-family="sans-serif">${s}</text>`).join("")}`; };
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="40" y="56" font-size="26" font-family="sans-serif" font-weight="bold">两自由度小机械臂 · 功能图（示意）</text>
<text x="${W - 40}" y="56" font-size="15" font-family="sans-serif" text-anchor="end" fill="#666">本项目自制 CC0 · 早期原型，简化仿真</text>
${bx("yaw", "底座转动（偏航）", ["MG90S #1 · 关节：底座偏航", "±90°"], "#dfe8fb")}
${bx("pitch", "抬臂（俯仰）", ["MG90S #2 · 关节：肩部俯仰", "−20° ~ +80°"], "#ece0f6")}
${bx("push", "推方块（执行）", ["大臂 + 末端推板", "两个关节一起动"], "#fde2df")}
${bx("frame", "结构", ["底座 · 转台"], "#f1ede4")}
${bx("ctl", "主控（示意）", ["两路 PWM"], "#dff2e4")}
<text x="40" y="540" font-size="15" font-family="sans-serif" fill="#555">点功能图上的方块 → 3D 里高亮对应模块；在“运动”模式下还会播放绑定的关节。</text>
</svg>
`;
fs.writeFileSync("public/demo/arm2dof-functions.svg", svg);
console.log("arm demo ok", obj.length, "bytes obj");
