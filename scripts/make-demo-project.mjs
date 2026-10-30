// v11：内置示例工程 = v10 八爪鱼 GLB（从装配台导出）+ 自制功能图 SVG + 模块↔功能绑定。输出到 public/demo/
import fs from "node:fs";
import { parseModel } from "../src/modellab/load.js";
import { autoSplit } from "../src/modellab/modules.js";
import { SERVO_PINS, BATT_PIN } from "../src/assembly/octopus/v10.js";
import { SG51R_GEO } from "../src/assembly/octopus/parts.js";
import * as THREE from "three";
const W = 1200, H = 760;
const b = fs.readFileSync("public/demo/octo-v10.glb");
const r = await parseModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), "octo-v10.glb");
const sp = autoSplit(r.meshes);
const COL = { 骨架: "#c9c2b0", 舵机: "#2f6fd6", 触手: "#e07a2b", QT: "#2f8f4e", LiPo: "#5b6168", 充电: "#8a4fbf", MiniBoost: "#d23a2f", 开关: "#7a4a2a", 分压: "#1f9aa6", 电容: "#e0b322", 导线: "#c2477d" };
const modules = sp.modules.map((m, i) => ({ ...m, id: `d${String(i).padStart(2, "0")}`, color: Object.entries(COL).find(([k]) => m.name.includes(k))?.[1] || "#9aa3ad", material: /触手|骨架/.test(m.name) ? "pla" : /LiPo|舵机/.test(m.name) ? "mixed" : /导线/.test(m.name) ? "copper" : "pcb", collider: "hull" }));
const ids = (re) => modules.filter((m) => re.test(m.name)).map((m) => m.id);
// 功能图上的方块（像素，1200×760）
const B = {
  bat: [40, 90, 300, 150], bst: [440, 90, 320, 150], ctl: [440, 330, 320, 150], ble: [860, 330, 300, 150],
  sense: [40, 330, 300, 150], drv: [440, 560, 320, 150], arm: [860, 560, 300, 150], frame: [40, 560, 300, 70], wire: [40, 650, 300, 60],
};
const rgn = (k) => ({ x: B[k][0] / W, y: B[k][1] / H, w: B[k][2] / W, h: B[k][3] / H });
const fn = (id, name, kind, color, k, mods, pins, note) => ({ id, name, kind, color, regions: [rgn(k)], pins, modules: mods, note });
const functions = [
  fn("f-bat", "电池与充电", "供电", "#5b6168", "bat", ids(/LiPo|充电|开关/), [{ label: "BAT+", signal: "3.0–4.2 V（1S）" }, { label: "USB‑C", signal: "5 V，只在充电时插" }], "1S 1200 mAh → 拨动开关 → 两个升压板；充电板只在充电时接 USB‑C"),
  fn("f-bst", "5.2 V 升压 ×2", "供电", "#d23a2f", "bst", ids(/MiniBoost|电容/), [{ label: "BST1 OUT", signal: "→ 0–3 号舵机" }, { label: "BST2 OUT", signal: "→ 4–7 号舵机" }], "每个升压板带 4 个舵机，输出端各一颗电容"),
  fn("f-ctl", "主控（QT Py ESP32‑S3）", "控制", "#2f8f4e", "ctl", ids(/QT Py/), SERVO_PINS.map((p, i) => ({ label: `S${i} PWM`, signal: `${p.pad} / GPIO${p.gpio}` })), "直接用 LEDC 出 8 路 50 Hz PWM"),
  fn("f-ble", "无线通信（BLE）", "通信", "#8a4fbf", "ble", ids(/QT Py/), [{ label: "BLE", signal: "手机 → QT Py（模拟）" }], "和主控是同一块板：一个模块可以属于多个功能"),
  fn("f-sense", "电池电压检测", "传感", "#1f9aa6", "sense", ids(/分压/), [{ label: "VBAT/2", signal: `${BATT_PIN.pad} / GPIO${BATT_PIN.gpio}` }], `100k/100k 分压，${BATT_PIN.cut} V 停运动、${BATT_PIN.resume} V 恢复（估算阈值）`),
  fn("f-drv", "8 路舵机驱动", "驱动", "#2f6fd6", "drv", ids(/舵机/), [], "SG51R ×8，橙线 PWM / 红线 V+ / 棕线 GND"),
  fn("f-arm", "触手（执行）", "执行", "#e07a2b", "arm", ids(/短触手/), [], "每个舵机带一条短触手"),
  fn("f-frame", "结构（骨架 + 上层板）", "结构", "#a89a7a", "frame", ids(/骨架/), [], ""),
  fn("f-wire", "导线", "连接", "#c2477d", "wire", ids(/导线/), [], "35 根，3D 里合成一个模块（碰撞用凸包，比真实导线胖）"),
];
const project = {
  schema: "proto-modellab/1", id: "builtin-octo-v10", builtin: true, name: "内置示例：v10 八爪鱼（模块 ↔ 功能图）", updated: 0,
  notes: "模型从装配台的 v10 预设导出（零件尺寸来自零件库，标“估算”的除外）；功能图是本项目自制的示意图，不是原理图。",
  model: { file: "octo-v10.glb", builtin: "demo/octo-v10.glb", units: "m", scale: 1, upAxis: "y", unitWhy: "导出时就是米（glTF 规范）", split: "auto" },
  modules, functions,
  diagram: { file: "octo-v10-functions.svg", builtin: "demo/octo-v10-functions.svg", mime: "image/svg+xml", w: W, h: H },
};
// 质量：用 v10 质量表（MASS_V10：页面数字 / 估算），不用“体积 × 密度”（短触手、导线的凸包会大很多）
const MASS = [[/充电板/, 2], [/舵机/, 5], [/LiPo/, 23], [/QT Py/, 1.2], [/MiniBoost/, 1], [/开关/, 0.07], [/分压/, 0.7], [/电容/, 0.4], [/导线/, 4], [/骨架/, 31], [/短触手/, 1.5]];
project.modules = project.modules.map(({ id, name, color, meshes, collider, material }) => ({ id, name, color, meshes, collider, material, massG: MASS.find(([re]) => re.test(name))?.[1] ?? null, hidden: false }));
project.notes += " 质量用 v10 质量表（舵机、电池、QT Py、升压板、开关是商品页数字；骨架含 3 个万向珠、触手、导线、充电板、分压板和电容是估算）。";
// v12：8 个偏航关节（竖直轴，和 octopus/loco.js 的 v10 一样）：父 = n 号舵机，子 = n 号短触手；SG51R，软件限位 ±55°（v10 固件同款）
const boxOf = (m) => { const b = new THREE.Box3(); for (const id of m.meshes) { const me = r.meshes.find((x) => x.id === id); me.geom.computeBoundingBox(); b.union(me.geom.boundingBox); } return b; };
const all = new THREE.Box3(); for (const me of r.meshes) { me.geom.computeBoundingBox(); all.union(me.geom.boundingBox); }
const C = all.getCenter(new THREE.Vector3());
project.joints = [];
for (let i = 0; i < 8; i++) {
  const sv = project.modules.find((m) => m.name.startsWith(`${i} 号触手舵机`)), arm = project.modules.find((m) => m.name === `${i} 号短触手`);
  const sb = boxOf(sv), sc = sb.getCenter(new THREE.Vector3()), ac = boxOf(arm).getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(ac.x - C.x, 0, ac.z - C.z).normalize();
  const sh = (SG51R_GEO.shaftX / 100); // 舵机中心到输出轴 0.605 cm（米）
  const p = [sc.x + dir.x * sh, sb.max.y, sc.z + dir.z * sh].map((v) => +v.toFixed(6));
  project.joints.push({ id: `j-yaw${i}`, name: `${i} 号触手偏航`, type: "revolute", parent: sv.id, child: arm.id, anchor: p, axis: [0, 1, 0], limits: { min: -55, max: 55 }, drive: { preset: "sg51r", volt: 5.2, torque: 1, speed: 300, forceN: 5, speedMm: 20 }, home: 0 });
}
const allJ = project.joints.map((j) => j.id);
for (const f of project.functions) f.joints = f.id === "f-drv" || f.id === "f-arm" ? allJ : [];
const sw = (a) => Object.fromEntries(allJ.map((id, i) => [id, a(i)]));
project.poses = [
  { id: "p-home", name: "回中", values: sw(() => 0) },
  { id: "p-ccw", name: "全部左摆 35°", values: sw(() => 35) },
  { id: "p-cw", name: "全部右摆 35°", values: sw(() => -35) },
  { id: "p-alt", name: "交替张合", values: sw((i) => (i % 2 ? 30 : -30)) },
];
project.timeline = { loop: false, keys: [{ t: 0, pose: "p-home" }, { t: 0.6, pose: "p-ccw" }, { t: 1.4, pose: "p-cw" }, { t: 2.2, pose: "p-alt" }, { t: 3.0, pose: "p-home" }] };
project.sim = { fixBase: false };
project.notes += " v12：8 个偏航关节（SG51R，±55°），两个功能（舵机驱动、触手）绑定了这 8 个关节。";
fs.writeFileSync("public/demo/octo-v10.project.json", JSON.stringify(project, null, 1));
// ---------- 功能图 SVG ----------
const box = (k, t, sub, fill) => { const [x, y, w, h] = B[k]; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="#333" stroke-width="2"/><text x="${x + w / 2}" y="${y + (h > 90 ? 50 : 30)}" font-size="24" text-anchor="middle" font-family="sans-serif" font-weight="bold">${t}</text>${sub.map((s, i) => `<text x="${x + w / 2}" y="${y + (h > 90 ? 82 : 52) + i * 24}" font-size="16" text-anchor="middle" fill="#444" font-family="sans-serif">${s}</text>`).join("")}`; };
const ar = (x1, y1, x2, y2, t, dy = -8) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="2.5" marker-end="url(#a)"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + dy}" font-size="15" text-anchor="middle" font-family="sans-serif" fill="#a33">${t}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><marker id="a" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="40" y="50" font-size="28" font-family="sans-serif" font-weight="bold">v10 八爪鱼 · 功能图（示意，不是原理图）</text>
<text x="${W - 40}" y="50" font-size="16" font-family="sans-serif" text-anchor="end" fill="#666">本项目自制 · 早期原型，简化仿真</text>
${box("bat", "电池与充电", ["1S 1200 mAh LiPo", "USB‑C 充电板 · 拨动开关"], "#eceff3")}
${box("bst", "5.2 V 升压 ×2", ["MiniBoost #1 → S0–S3", "MiniBoost #2 → S4–S7 · 各带电容"], "#fde2df")}
${box("ctl", "主控 QT Py ESP32‑S3", ["8 路 LEDC PWM（50 Hz）", "A0 A1 A2 SDA SCL TX RX SCK"], "#dff2e4")}
${box("ble", "无线通信（BLE）", ["手机 App → QT Py", "（仿真里是模拟的）"], "#ece0f6")}
${box("sense", "电池电压检测", ["100k / 100k 分压", `→ ${BATT_PIN.pad}（GPIO${BATT_PIN.gpio}）`], "#dcf1f3")}
${box("drv", "8 路舵机", ["SG51R ×8", "橙 PWM · 红 V+ · 棕 GND"], "#dfe8fb")}
${box("arm", "触手 ×8", ["每个舵机带一条短触手"], "#fbe6d4")}
${box("frame", "结构：骨架 + 上层板", [], "#f1ede4")}
${box("wire", "导线 ×35", [], "#f6dfea")}
${ar(340, 165, 440, 165, "VBAT（开关后）")}${ar(600, 240, 600, 330, "5.2 V → QT Py 5V", 0)}${ar(860, 405, 760, 405, "BLE")}${ar(190, 240, 190, 330, "VBAT", 0)}${ar(340, 405, 440, 405, "A3")}${ar(600, 480, 600, 560, "PWM ×8", 0)}${ar(760, 165, 1010, 560, "V+ ×8", 0)}${ar(760, 635, 860, 635, "转动")}
</svg>
`;
fs.writeFileSync("public/demo/octo-v10-functions.svg", svg);
console.log("modules", modules.length, functions.map((f) => `${f.name}:${f.modules.length}`).join(" "));
