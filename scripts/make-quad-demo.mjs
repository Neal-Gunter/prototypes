// v13：第四个内置示例 = 四足爬行器（8 个舵机：每条腿 髋 偏航 + 膝 抬腿）。本项目自制，CC0。
// 输出 public/demo/quad.{obj,project.json,functions.svg}。尺寸是我定的（我的补充）：机身 50×16×80 mm，腿伸出 40 mm。
// 舵机用 MG90S 预设（datasheet 值，见 servos.js）；质量按 PLA 实心估算（估算），没算舵机本体重量。
import fs from "node:fs";
import { objWriter } from "./lib/linkage.mjs";
const w = objWriter("四足爬行器");
// 机身：x −25..25，y 30..46，z −40..40（前方 = −z）
w.box("机身", [-25, 25], [30, 46], [-40, 40]);
const LEGS = [["lf", "左前", -1, -30], ["rf", "右前", 1, -30], ["lb", "左后", -1, 30], ["rb", "右后", 1, 30]];
// 每条腿：髋座（coxa）x 25..45；腿（L 形）= 横段 45..65 + 竖段 59..67 落到地面 y = 0
const box = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
for (const [, zh, s, z] of LEGS) {
  w.box(`${zh}髋座`, box(s, 25, 45), [33, 43], [z - 5, z + 5]);
  w.box(`${zh}腿横`, box(s, 45, 65), [34, 42], [z - 4, z + 4]);
  w.box(`${zh}腿竖`, box(s, 59, 67), [0, 42], [z - 4, z + 4]);
}
fs.writeFileSync("public/demo/quad.obj", w.text());
const C = { lf: "#2f6fd6", rf: "#d23a2f", lb: "#1f9d55", rb: "#e0b322" };
const mods = [{ id: "body", name: "机身", color: "#c9c2b0", meshes: ["m0"] }];
LEGS.forEach(([k, zh], i) => { mods.push({ id: `${k}-hip`, name: `${zh}髋座`, color: "#8a8f98", meshes: [`m${1 + i * 3}`] }); mods.push({ id: `${k}-leg`, name: `${zh}腿`, color: C[k], meshes: [`m${2 + i * 3}`, `m${3 + i * 3}`] }); });
const modules = mods.map((m) => ({ massG: null, material: "pla", collider: "hull", hidden: false, ...m }));
const drive = { preset: "mg90s", volt: 4.8, torque: 1, speed: 300, forceN: 5, speedMm: 20 };
const joints = [];
for (const [k, zh, s, z] of LEGS) {
  joints.push({ id: `j-${k}-yaw`, name: `${zh}髋（前后摆）`, type: "revolute", parent: "body", child: `${k}-hip`, anchor: [25 * s, 38, z], axis: [0, 1, 0], limits: { min: -40, max: 40 }, drive, home: 0 });
  joints.push({ id: `j-${k}-lift`, name: `${zh}膝（抬腿）`, type: "revolute", parent: `${k}-hip`, child: `${k}-leg`, anchor: [45 * s, 38, z], axis: [0, 0, 1], limits: { min: -40, max: 40 }, drive, home: 0 });
}
// 内置步态（我的补充，v13 用 scripts/quad-search.mjs 调过）：对角小跑 —— 左前+右后 一组，右前+左后 一组，相差 180°；
// 抬腿比前后摆超前 90°（腿在往前摆的时候是抬起来的）。左右两边偏航方向相反（镜像）。
import { QUAD_GAIT } from "./lib/quad-gait.mjs";
const W = 1000, H = 620;
const B = { lf: [40, 110, 210, 150], rf: [270, 110, 210, 150], lb: [500, 110, 210, 150], rb: [730, 110, 230, 150], body: [40, 330, 440, 110], ctrl: [500, 330, 460, 110] };
const rgn = (k) => ({ x: B[k][0] / W, y: B[k][1] / H, w: B[k][2] / W, h: B[k][3] / H });
const functions = [
  ...LEGS.map(([k, zh]) => ({ id: `f-${k}`, name: `${zh}腿`, kind: "执行", color: C[k], regions: [rgn(k)], pins: [{ label: "髋", signal: "MG90S" }, { label: "膝", signal: "MG90S" }], modules: [`${k}-hip`, `${k}-leg`], joints: [`j-${k}-yaw`, `j-${k}-lift`], note: "髋：前后摆；膝：抬腿" })),
  { id: "f-body", name: "机身", kind: "结构", color: "#a89a7a", regions: [rgn("body")], pins: [], modules: ["body"], joints: [], note: "电池、主控放这里（示意，没建模）" },
  { id: "f-gait", name: "步态（对角小跑）", kind: "控制", color: "#7b4bd6", regions: [rgn("ctrl")], pins: [], modules: [], joints: joints.map((j) => j.id), note: "在“步态”面板里改相位 / 幅度 / 频率，点“测量”看走多快" },
];
const poses = [{ id: "p-home", name: "站立", values: Object.fromEntries(joints.map((j) => [j.id, 0])) }];
const project = {
  schema: "proto-modellab/1", id: "builtin-quad", builtin: true, name: "内置示例：四足爬行器（8 舵机）", updated: 0,
  notes: "本项目自制（CC0）。尺寸我定的；舵机 MG90S（datasheet 值）；质量按 PLA 实心估算，没算舵机本体。步态是 v13 搜出来的（仿真，没上实物）。",
  model: { file: "quad.obj", builtin: "demo/quad.obj", units: "mm", scale: 1, upAxis: "y", unitWhy: "画的时候就是毫米", split: "auto" },
  modules, functions, joints, poses, timeline: { loop: false, keys: [] }, sim: { fixBase: false, roundHulls: true }, gait: QUAD_GAIT,
  diagram: { file: "quad-functions.svg", builtin: "demo/quad-functions.svg", mime: "image/svg+xml", w: W, h: H },
};
fs.writeFileSync("public/demo/quad.project.json", JSON.stringify(project, null, 1));
const bx = (k, t, sub, fill) => { const [x, y, ww, h] = B[k]; return `<rect x="${x}" y="${y}" width="${ww}" height="${h}" rx="12" fill="${fill}" stroke="#333" stroke-width="2"/><text x="${x + ww / 2}" y="${y + 44}" font-size="22" text-anchor="middle" font-family="sans-serif" font-weight="bold">${t}</text>${sub.map((s, i) => `<text x="${x + ww / 2}" y="${y + 74 + i * 22}" font-size="15" text-anchor="middle" fill="#444" font-family="sans-serif">${s}</text>`).join("")}`; };
fs.writeFileSync("public/demo/quad-functions.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="40" y="56" font-size="26" font-family="sans-serif" font-weight="bold">四足爬行器 · 功能图（示意）</text>
<text x="${W - 40}" y="56" font-size="15" font-family="sans-serif" text-anchor="end" fill="#666">本项目自制 CC0 · 早期原型，简化仿真</text>
${LEGS.map(([k, zh]) => bx(k, `${zh}腿`, ["髋 MG90S：前后摆", "膝 MG90S：抬腿"], "#eef2f8")).join("\n")}
${bx("body", "机身", ["50 × 16 × 80 mm（PLA）"], "#f1ede4")}
${bx("ctrl", "步态（对角小跑）", ["8 路舵机 · 相位 / 幅度 / 频率", "在模型实验室“步态”面板里改"], "#ece4fb")}
<text x="40" y="540" font-size="15" font-family="sans-serif" fill="#555">前方 = −z（图上“前”）。质量按 PLA 实心估算，舵机本体重量没算（估算）。</text>
</svg>
`);
console.log("quad demo written", modules.length, "modules", joints.length, "joints");
