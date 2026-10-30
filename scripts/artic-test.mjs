// v12 单元测试（node + Rapier）：关节建立 / 分组校验、限位、舵机限速、关节推动碰撞、球关节软限位、滑轨、八爪鱼关节、工程 ZIP 往返
import fs from "node:fs";
import * as THREE from "three";
import R from "@dimforge/rapier3d-compat";
import { parseModel } from "../src/modellab/load.js";
import { autoSplit, modelXform, analyzeModule } from "../src/modellab/modules.js";
import { sanitize, exportZip, importZip } from "../src/modellab/project.js";
import { buildGroups, newJoint, createLabWorld, labPenetration, addBlock, stepLab, benchToRaw, axisToRaw, jointToBench, effLimits } from "../src/modellab/artic.js";
import { driveParams, KGFCM } from "../src/modellab/servos.js";
await R.init();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };
const ab = (f) => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const setup = async (projFile, modelFile, mut) => {
  const parsed = await parseModel(ab(modelFile), modelFile.split("/").pop());
  let project = sanitize(JSON.parse(fs.readFileSync(projFile, "utf8")));
  if (mut) { project = clone(project); mut(project); project = sanitize(project); }
  const X = modelXform(parsed.meshes, project.model);
  const byId = new Map(parsed.meshes.map((m) => [m.id, m]));
  const an = new Map(project.modules.map((m) => [m.id, analyzeModule(m, byId, X.M)]));
  return { parsed, project, X, an };
};
const run = (lab, s, every = 6) => { let worst = 0; const n = Math.round(s * 240); for (let i = 0; i < n; i++) { stepLab(lab, 1 / 240); if (i % every === 0) worst = Math.max(worst, labPenetration(lab).mm); } return worst; };
const ARM = ["public/demo/arm2dof.project.json", "public/demo/arm2dof.obj"];

console.log("机械臂示例：解析 + 分组");
const A = await setup(...ARM);
const sp = autoSplit(A.parsed.meshes);
ok(sp.modules.length === 6 && sp.modules.map((m) => m.meshes[0]).join() === "m0,m1,m2,m3,m4,m5", `OBJ 拆成 6 个模块，网格 id 和工程对得上（${sp.how}）`);
const G = buildGroups(A.project);
ok(G.groups.length === 3 && G.joints.length === 2 && G.fixedCount === 2 && !G.errors.length, `3 个刚体组、2 个活动关节、2 个固定关节（${G.groups.map((g) => g.mods.join("+")).join(" / ")}）`);
ok(G.groups[0].mods.join() === "a0,a1" && G.groups.find((g) => g.mods.includes("a3")).mods.includes("a2"), "底座+底座舵机是根；肩部舵机被固定关节并到转台上");
const S = effLimits(A.project.joints[0]);
ok(S.min === -90 && S.max === 90, "偏航限位 ±90°（MG90S 行程内）");
const dp = driveParams(A.project.joints[0]);
ok(Math.abs(dp.maxF - 1.8 * KGFCM) < 1 && Math.abs((dp.speed * 180) / Math.PI - 600) < 0.01, `MG90S @4.8 V：堵转 1.8 kgf·cm、600 °/s（${dp.label}）`);
const dp6 = driveParams({ ...A.project.joints[0], drive: { ...A.project.joints[0].drive, volt: 6 } });
ok(Math.abs(dp6.maxF - 2.2 * KGFCM) < 1 && Math.abs((dp6.speed * 180) / Math.PI - 750) < 0.01, `MG90S @6 V：2.2 kgf·cm、750 °/s（0.08 s/60°）`);

console.log("关节建立 / 校验");
const pick = new THREE.Vector3(1, 4.7, 0.3);
const raw = benchToRaw(pick, A.X.M);
const nj = newJoint("a4", "a5", raw, axisToRaw(new THREE.Vector3(0, 0, 1), A.X.M), 4);
const back = jointToBench(nj, A.X.M);
ok(back.p.distanceTo(pick) < 1e-4 && back.axis.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-6, "3D 里点的点 → 原始坐标 → 再变回来，位置和轴不变");
const bad = clone(A.project);
bad.joints.push({ ...nj, id: "jx1", parent: "a0", child: "a4" }); // a4 已经挂在肩部俯仰上
bad.joints.push({ ...nj, id: "jx2", parent: "a5", child: "a5" });
bad.joints.push({ ...nj, id: "jx3", parent: "a4", child: "nope" });
const sb = sanitize(bad);
ok(sb.joints.length === 5, `清洗：父子相同、引用不存在模块的关节被丢掉（剩 ${sb.joints.length}）`);
const Gb = buildGroups(sb);
ok(Gb.errors.length === 1 && /已经有父关节/.test(Gb.errors[0]) && Gb.joints.length === 2, `一块挂两个父关节 → 报错并忽略（${Gb.errors[0]}）`);
const cyc = clone(A.project);
cyc.joints = [{ ...nj, id: "c1", parent: "a2", child: "a4" }, { ...nj, id: "c2", parent: "a4", child: "a2" }];
const Gc = buildGroups(sanitize(cyc));
ok(Gc.errors.some((e) => /环|父关节/.test(e)) && Gc.joints.length === 1, `关节连成环 → 报错并去掉一个（${Gc.errors.join("；")}）`);

console.log("物理：舵机限速、到位、限位");
const lab = createLabWorld(R, A.project, A.an, A.X.M, { fixBase: true });
ok(lab.restOverlaps.length === 0, `起始没有“不该重叠”的模块对（${JSON.stringify(lab.restOverlaps)}）`);
let w = run(lab, 0.5);
ok(Math.abs(lab.core.value("j-yaw")) < 1 && Math.abs(lab.core.value("j-pitch")) < 2, `静止在回中（偏航 ${lab.core.value("j-yaw").toFixed(2)}°、俯仰 ${lab.core.value("j-pitch").toFixed(2)}°）`);
ok(w < 0.1, `静止时最大穿模 ${w} mm < 0.1 mm`);
lab.core.setTarget("j-yaw", 60);
run(lab, 0.05);
const v05 = lab.core.value("j-yaw");
ok(v05 <= 600 * 0.05 + 3 && v05 > 5, `限速：50 ms 后才转到 ${v05.toFixed(1)}°（MG90S 600 °/s → ≤ 30°）`);
run(lab, 0.5);
ok(Math.abs(lab.core.value("j-yaw") - 60) < 2, `0.55 s 后到位 60°（${lab.core.value("j-yaw").toFixed(2)}°）`);
lab.core.setTarget("j-yaw", 170);
ok(lab.core.J.get("j-yaw").target === 90, "目标 170° 被截到限位 90°");
run(lab, 0.6);
ok(lab.core.value("j-yaw") <= 91 && lab.core.value("j-yaw") > 85, `转到 90° 限位（${lab.core.value("j-yaw").toFixed(2)}°）`);
// 无驱动 + 外力猛推：Rapier 原生限位挡住
const B = await setup(...ARM, (p) => { p.joints.find((j) => j.id === "j-pitch").drive.preset = "none"; });
const lab2 = createLabWorld(R, B.project, B.an, B.X.M, { fixBase: true });
const arm2 = lab2.rbs[lab2.G.groupOf.get("a4")];
let maxP = -1e9, minP = 1e9;
for (let k = 0; k < 6; k++) {
  arm2.resetTorques(true);
  arm2.addTorque({ x: 0, y: 0, z: (k % 2 ? -1 : 1) * 3 * KGFCM }, true); // 3 kgf·cm：比 MG90S 堵转还大
  for (let i = 0; i < 120; i++) { stepLab(lab2, 1 / 240); const v = lab2.core.value("j-pitch"); maxP = Math.max(maxP, v); minP = Math.min(minP, v); }
}
arm2.resetTorques(true);
ok(maxP <= 80 + 4 && maxP > 60, `无驱动俯仰被 3 kgf·cm 来回扳：最大 ${maxP.toFixed(1)}°，80° 限位挡住（Rapier 限位是软约束，硬扳允许超 ≤ 4°）`);
ok(minP >= -20 - 2, `最小 ${minP.toFixed(1)}° ≥ −20° 限位（推板也可能先碰到地面）`);

console.log("物理：关节带动碰撞");
const lab3 = createLabWorld(R, A.project, A.an, A.X.M, { fixBase: true });
const bp = new THREE.Vector3(...A.project.sim.block).applyMatrix4(A.X.M);
const blk = addBlock(R, lab3, bp.toArray());
w = run(lab3, 0.4);
const b0 = blk.translation();
lab3.core.playTimeline(A.project);
let worst = 0;
for (let i = 0; i < 5.2 * 240; i++) { stepLab(lab3, 1 / 240); if (i % 4 === 0) worst = Math.max(worst, labPenetration(lab3).mm); }
const b1 = blk.translation();
const moved = Math.hypot(b1.x - b0.x, b1.z - b0.z);
ok(moved > 1, `时间轴播放：推板把 2 cm 测试方块推走 ${moved.toFixed(2)} cm`);
ok(worst < 0.1, `推的过程中最大穿模 ${worst} mm < 0.1 mm（方块 / 推板 / 地面）`);
ok(!lab3.core.playing(), "时间轴播完自动停");
// 压低到 −20°：推板先碰到地面，被地面挡住（舵机堵转），不会穿进地面
lab3.core.setTarget("j-pitch", -20);
worst = run(lab3, 1.0, 4);
const pv = lab3.core.value("j-pitch");
ok(pv > -19 && worst < 0.1, `压低：推板碰地停在 ${pv.toFixed(1)}°（没到 −20°），最大穿模 ${worst} mm`);
ok(lab3.core.stats().find((s) => s.id === "j-pitch").stalled, "俯仰显示“堵转”");

console.log("球关节 / 滑轨");
const C = await setup(...ARM, (p) => { const j = p.joints.find((x) => x.id === "j-pitch"); j.type = "ball"; j.axis = [1, 0, 0]; j.limits = { min: 0, max: 3 }; j.drive.preset = "none"; });
const lab4 = createLabWorld(R, C.project, C.an, C.X.M, { fixBase: true });
let sw = 0;
for (let i = 0; i < 480; i++) { stepLab(lab4, 1 / 240); sw = Math.max(sw, lab4.core.value("j-pitch")); }
ok(sw > 2 && sw < 3.6, `球关节靠重力往下垂，软限位 3° 挡住（推板离地还差 ~4.4°；最大摆角 ${sw.toFixed(2)}°）`);
const D = await setup(...ARM, (p) => { const j = p.joints.find((x) => x.id === "j-pitch"); j.type = "prismatic"; j.axis = [1, 0, 0]; j.limits = { min: 0, max: 20 }; j.drive = { preset: "linear", forceN: 5, speedMm: 40 }; });
const lab5 = createLabWorld(R, D.project, D.an, D.X.M, { fixBase: true });
lab5.core.setTarget("j-pitch", 15);
run(lab5, 1.0);
ok(Math.abs(lab5.core.value("j-pitch") - 15) < 1, `滑轨推到 15 mm（${lab5.core.value("j-pitch").toFixed(2)} mm）`);
lab5.core.setTarget("j-pitch", 50);
run(lab5, 1.0);
ok(lab5.core.value("j-pitch") <= 20.5 && lab5.core.value("j-pitch") > 18, `目标 50 mm 截到限位 20 mm（${lab5.core.value("j-pitch").toFixed(2)} mm）`);

console.log("八爪鱼示例：8 个偏航关节");
const O = await setup("public/demo/octo-v10.project.json", "public/demo/octo-v10.glb");
const GO = buildGroups(O.project);
ok(GO.groups.length === 9 && GO.joints.length === 8 && GO.groups[0].mods.length === 19, `9 个刚体组（根 19 个模块 + 8 条触手）、8 个关节`);
ok(O.project.functions.find((f) => f.id === "f-arm").joints.length === 8, "“触手”功能绑定了 8 个关节");
const lab6 = createLabWorld(R, O.project, O.an, O.X.M, {});
ok(lab6.restOverlaps.length === 0, `起始没有不该重叠的模块对（${lab6.restOverlaps.map((o) => o.a + "×" + o.b + " " + o.mm + "mm").join("，") || "无"}）`);
run(lab6, 0.6);
lab6.core.playFunction(O.project.functions.find((f) => f.id === "f-arm"));
let ow = 0, omax = 0;
for (let i = 0; i < 3.6 * 240; i++) { stepLab(lab6, 1 / 240); if (i % 6 === 0) { ow = Math.max(ow, labPenetration(lab6).mm); for (let k = 0; k < 8; k++) omax = Math.max(omax, Math.abs(lab6.core.value(`j-yaw${k}`))); } }
ok(omax <= 56 && omax > 30, `播放“触手”功能：最大偏航 ${omax.toFixed(1)}°（≤ ±55° 限位）`);
ok(ow < 0.1, `最大穿模 ${ow} mm < 0.1 mm（触手之间、触手和地面）`);

console.log("工程 ZIP 往返");
const proj = clone(A.project);
proj.joints.push(nj);
proj.functions[0].joints.push(nj.id);
proj.poses.push({ id: "p-new", name: "新姿态", values: { [nj.id]: 0, "j-yaw": 33 } });
proj.timeline.keys.push({ t: 5, pose: "p-new" });
proj.timeline.loop = true;
const zip = await exportZip(proj, { model: ab(ARM[1]), diagram: new Blob([fs.readFileSync("public/demo/arm2dof-functions.svg")], { type: "image/svg+xml" }) });
const imp = await importZip(await zip.arrayBuffer());
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
ok(eq(imp.project.joints, proj.joints), `关节原样回来（${imp.project.joints.length} 个）`);
ok(eq(imp.project.poses, proj.poses) && eq(imp.project.timeline, proj.timeline), "姿态、时间轴（含循环）原样回来");
ok(eq(imp.project.functions.map((f) => f.joints), proj.functions.map((f) => f.joints)) && eq(imp.project.sim, proj.sim), "功能 ↔ 关节绑定、固定底座、测试方块位置原样回来");
const v11 = clone(proj); delete v11.joints; delete v11.poses; delete v11.timeline; delete v11.sim; v11.functions.forEach((f) => delete f.joints);
const s11 = sanitize(v11);
ok(s11.joints.length === 0 && s11.poses.length === 0 && s11.functions.every((f) => eq(f.joints, [])), "v11 的旧工程（没有关节字段）照样能打开");
const dirty = clone(proj);
dirty.joints[0].limits = { min: 500, max: -500 }; dirty.joints[0].type = "weird"; dirty.poses[0].values = { "j-yaw": "x", nope: 3, "j-pitch": 1e9 };
dirty.timeline.keys.push({ t: 1, pose: "missing" });
const sd = sanitize(dirty);
ok(sd.joints[0].type === "revolute" && sd.joints[0].limits.min === -180 && sd.joints[0].limits.max === 180, "清洗：未知类型 → 转动；限位截到 ±180° 并排好大小");
ok(eq(sd.poses[0].values, { "j-pitch": 1000 }) && sd.timeline.keys.every((k) => k.pose !== "missing"), "清洗：姿态里的坏值 / 不存在的关节去掉；时间轴引用不存在的姿态去掉");

console.log(`\n关节测试：${pass} 通过，${fail} 失败`);
fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(".tmp/artic-test.json", JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
