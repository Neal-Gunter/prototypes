// v13：第三个内置示例 = 四连杆（曲柄摇杆，闭环）。本项目自制，CC0。输出 public/demo/fourbar.{obj,project.json,functions.svg}
// 杆长是我定的（我的补充）：机架 80、曲柄 20、连杆 70、摇杆 60 mm（Grashof：20 + 80 ≤ 70 + 60 → 曲柄能整周转）。
import fs from "node:fs";
import { objWriter, FOURBAR as F, fourbarPoints } from "./lib/linkage.mjs";
const P = fourbarPoints(F.theta0);
const r = (v) => +v.toFixed(4);
const w = objWriter("四连杆（曲柄摇杆）");
w.box("机架（底座）", [-12, F.d + 12], [0, 6], [-8, 8]);
w.bar("曲柄", P.O2, P.A, 8, [6, 10]);
w.bar("连杆", P.A, P.B, 8, [10, 14]);
w.bar("摇杆（输出）", P.O4, P.B, 8, [6, 10]);
fs.writeFileSync("public/demo/fourbar.obj", w.text());
const mods = [
  { id: "b0", name: "机架（底座）", color: "#c9c2b0" }, { id: "b1", name: "曲柄", color: "#2f6fd6" },
  { id: "b2", name: "连杆", color: "#e0b322" }, { id: "b3", name: "摇杆（输出）", color: "#d23a2f" },
].map((m, i) => ({ massG: null, material: "pla", ...m, meshes: [`m${i}`], collider: "hull", hidden: false }));
const drive = (preset, extra = {}) => ({ preset, volt: 4.8, torque: 1, speed: 300, forceN: 5, speedMm: 20, ...extra });
const J = (id, name, parent, child, xz, y, lim, dr) => ({ id, name, type: "revolute", parent, child, anchor: [r(xz[0]), y, r(xz[1])], axis: [0, 1, 0], limits: lim, drive: dr, home: 0 });
const joints = [
  J("j-crank", "曲柄转轴（电机）", "b0", "b1", P.O2, 6, { min: -170, max: 170 }, drive("custom", { torque: 2, speed: 120 })),
  J("j-ca", "曲柄—连杆", "b1", "b2", P.A, 10, { min: -180, max: 180 }, drive("none")),
  J("j-rocker", "摇杆转轴", "b0", "b3", P.O4, 6, { min: -180, max: 180 }, drive("none")),
  J("j-cb", "连杆—摇杆（闭环）", "b2", "b3", P.B, 10, { min: -180, max: 180 }, drive("none")),
];
const W = 1000, H = 620;
const B = { crank: [40, 110, 280, 140], rocker: [360, 110, 280, 140], loop: [680, 110, 280, 140], frame: [40, 330, 280, 110] };
const rgn = (k) => ({ x: B[k][0] / W, y: B[k][1] / H, w: B[k][2] / W, h: B[k][3] / H });
const functions = [
  { id: "f-crank", name: "曲柄转动（输入）", kind: "驱动", color: "#2f6fd6", regions: [rgn("crank")], pins: [{ label: "M1", signal: "自定义电机（2 kgf·cm、120 °/s，估算）" }], modules: ["b1"], joints: ["j-crank"], note: "唯一带驱动的关节；四连杆只有 1 个自由度" },
  { id: "f-rocker", name: "摇杆摆动（输出）", kind: "执行", color: "#d23a2f", regions: [rgn("rocker")], pins: [], modules: ["b3"], joints: [], note: "被连杆带着来回摆，没有马达" },
  { id: "f-loop", name: "闭环", kind: "结构", color: "#e0b322", regions: [rgn("loop")], pins: [], modules: ["b2"], joints: [], note: "连杆两头都连着：机架 → 曲柄 → 连杆 → 摇杆 → 机架" },
  { id: "f-frame", name: "机架", kind: "结构", color: "#a89a7a", regions: [rgn("frame")], pins: [], modules: ["b0"], joints: [], note: "底座固定在地面上" },
];
const poses = [["p-0", "曲柄 0°", 0], ["p-90", "曲柄 +90°", 90], ["p-m90", "曲柄 −90°", -90], ["p-170", "曲柄 +170°", 170], ["p-m170", "曲柄 −170°", -170]].map(([id, name, v]) => ({ id, name, values: { "j-crank": v } }));
const project = {
  schema: "proto-modellab/1", id: "builtin-fourbar", builtin: true, name: "内置示例：四连杆（曲柄摇杆，闭环）", updated: 0,
  notes: `本项目自制（CC0）。杆长 机架 ${F.d} / 曲柄 ${F.a} / 连杆 ${F.b} / 摇杆 ${F.c} mm（我定的）；电机参数是估算。`,
  model: { file: "fourbar.obj", builtin: "demo/fourbar.obj", units: "mm", scale: 1, upAxis: "y", unitWhy: "画的时候就是毫米", split: "auto" },
  modules: mods, functions, joints, poses,
  timeline: { loop: true, keys: [{ t: 0, pose: "p-0" }, { t: 1.5, pose: "p-170" }, { t: 4.5, pose: "p-m170" }, { t: 6, pose: "p-0" }] },
  sim: { fixBase: true },
  diagram: { file: "fourbar-functions.svg", builtin: "demo/fourbar-functions.svg", mime: "image/svg+xml", w: W, h: H },
};
fs.writeFileSync("public/demo/fourbar.project.json", JSON.stringify(project, null, 1));
const bx = (k, t, sub, fill) => { const [x, y, ww, h] = B[k]; return `<rect x="${x}" y="${y}" width="${ww}" height="${h}" rx="12" fill="${fill}" stroke="#333" stroke-width="2"/><text x="${x + ww / 2}" y="${y + 44}" font-size="22" text-anchor="middle" font-family="sans-serif" font-weight="bold">${t}</text>${sub.map((s, i) => `<text x="${x + ww / 2}" y="${y + 74 + i * 22}" font-size="15" text-anchor="middle" fill="#444" font-family="sans-serif">${s}</text>`).join("")}`; };
fs.writeFileSync("public/demo/fourbar-functions.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="40" y="56" font-size="26" font-family="sans-serif" font-weight="bold">四连杆（曲柄摇杆）· 功能图（示意）</text>
<text x="${W - 40}" y="56" font-size="15" font-family="sans-serif" text-anchor="end" fill="#666">本项目自制 CC0 · 早期原型，简化仿真</text>
${bx("crank", "曲柄转动（输入）", ["电机 · 关节：曲柄转轴", "−170° ~ +170°"], "#dfe8fb")}
${bx("rocker", "摇杆摆动（输出）", ["被动 · 摇杆转轴", "摆角由杆长决定"], "#fde2df")}
${bx("loop", "闭环", ["连杆两头都连着", "1 个自由度"], "#fbf1d2")}
${bx("frame", "机架", ["固定在地面上"], "#f1ede4")}
<text x="40" y="540" font-size="15" font-family="sans-serif" fill="#555">机架 ${F.d} · 曲柄 ${F.a} · 连杆 ${F.b} · 摇杆 ${F.c} mm（Grashof：最短 + 最长 ≤ 其余两杆之和，曲柄能整周转）</text>
</svg>
`);
console.log("fourbar: A", P.A.map(r), "B", P.B.map(r), "phi0", (P.phi * 180 / Math.PI).toFixed(2));
