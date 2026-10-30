// v13 闭环连杆测试（node + Rapier）：四连杆示例跟着曲柄走（和解析解比）、曲柄滑块、平行四边形、
// 锁死 / 过约束 / 过驱动 的自由度提示。几何都是测试里现画的方块（本项目自制）。
import fs from "node:fs";
import * as THREE from "three";
import R from "@dimforge/rapier3d-compat";
import { parseModel } from "../src/modellab/load.js";
import { modelXform, analyzeModule } from "../src/modellab/modules.js";
import { sanitize } from "../src/modellab/project.js";
import { buildGroups, mobility, createLabWorld, stepLab, labPenetration, jointToBench } from "../src/modellab/artic.js";
import { objWriter, FOURBAR as F, fourbarPoints, crankQ, circleX } from "./lib/linkage.mjs";
await R.init();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };
const D = Math.PI / 180, deg = (r) => r / D;
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const enc = (s) => { const b = Buffer.from(s, "utf8"); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const out = { at: new Date().toISOString() };
async function setupFrom(objText, project) {
  const parsed = await parseModel(enc(objText), "t.obj");
  project = sanitize(project);
  const X = modelXform(parsed.meshes, project.model);
  const byId = new Map(parsed.meshes.map((m) => [m.id, m]));
  const an = new Map(project.modules.map((m) => [m.id, analyzeModule(m, byId, X.M)]));
  return { parsed, project, X, an };
}
const proj = (mods, joints) => ({
  schema: "proto-modellab/1", name: "t", model: { file: "t.obj", units: "mm", scale: 1, upAxis: "y", split: "auto" },
  modules: mods.map((n, i) => ({ id: "b" + i, name: n, material: "pla", meshes: ["m" + i], collider: "hull", color: "#888" })),
  joints, functions: [], poses: [], timeline: { loop: false, keys: [] }, sim: { fixBase: true },
});
const RJ = (id, parent, child, xz, y, drive = "none", extra = {}) => ({ id, name: id, type: "revolute", parent, child, anchor: [xz[0], y, xz[1]], axis: [0, 1, 0], limits: { min: -180, max: 180 }, drive: { preset: drive, volt: 4.8, torque: 2, speed: 120 }, home: 0, ...extra });
// 刚体上一点（静止位姿下的台面坐标 cm）现在在哪
const wpt = (rb, p) => { const t = rb.translation(), q = rb.rotation(); return new THREE.Vector3(p.x, p.y, p.z).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(t.x, t.y, t.z)); };
const steps = (lab, s, cb) => { const n = Math.round(s * 240); for (let i = 0; i < n; i++) { stepLab(lab, 1 / 240); cb?.(i); } };

console.log("四连杆示例（public/demo/fourbar.*）");
const S = await setupFrom(fs.readFileSync("public/demo/fourbar.obj", "utf8"), JSON.parse(fs.readFileSync("public/demo/fourbar.project.json", "utf8")));
const G = buildGroups(S.project);
const mob = mobility(S.project, G, S.X.M);
ok(G.groups.length === 4 && G.joints.length === 4 && G.loops === 1 && !G.errors.length && G.joints.find((e) => e.j.id === "j-cb").loop, `4 个刚体、4 个转动关节、1 个闭环（闭环关节 = 连杆—摇杆）`);
ok(mob.planar && mob.grublerPlanar === 1 && mob.dof === 1 && mob.redundant === 3 && !mob.locked.length && !mob.msgs.some((m) => m.lvl === "err" || /过驱动/.test(m.t)), `自由度：平面公式 M = ${mob.grublerPlanar}，空间公式 M = ${mob.grubler}，旋量秩 → ${mob.dof} 个自由度、${mob.redundant} 个冗余约束（平面机构在三维里的正常现象）`);
out.fourbarMobility = { grubler: mob.grubler, planar: mob.grublerPlanar, dof: mob.dof, redundant: mob.redundant, msgs: mob.msgs.map((m) => m.t) };
const lab = createLabWorld(R, S.project, S.an, S.X.M, { fixBase: true });
ok(lab.restOverlaps.length === 0, `起始没有不该重叠的零件（${JSON.stringify(lab.restOverlaps)}）`);
const core = lab.core;
const P0 = fourbarPoints(F.theta0);
const Bc = jointToBench(S.project.joints.find((j) => j.id === "j-cb"), S.X.M).p; // 闭环点（静止位姿，cm）
const rbC = lab.rbs[G.groupOf.get("b2")], rbR = lab.rbs[G.groupOf.get("b3")];
let worstErr = 0, worstGap = 0, worstPen = 0, n = 0;
const samples = [];
const analytic = (qc) => { const P = fourbarPoints(F.theta0 - qc * D); return P ? wrap(deg(P0.phi - P.phi)) : null; };
steps(lab, 0.5);
// 曲柄扫 0 → +170 → −170 → 0（电机 120 °/s，估算），每 1/24 s 记一次
const seq = [170, -170, 0];
let qMin = 1e9, qMax = -1e9;
for (const tgt of seq) {
  core.setTarget("j-crank", tgt);
  steps(lab, Math.abs(tgt - core.value("j-crank")) / 120 + 0.6, (i) => {
    if (i % 10) return;
    const qc = core.value("j-crank"), qr = core.value("j-rocker"), a = analytic(qc);
    if (a == null) return;
    const e = Math.abs(wrap(qr - a));
    worstErr = Math.max(worstErr, e); n++;
    worstGap = Math.max(worstGap, wpt(rbC, Bc).distanceTo(wpt(rbR, Bc)) * 10);
    if (i % 30 === 0) worstPen = Math.max(worstPen, labPenetration(lab).mm);
    qMin = Math.min(qMin, qr); qMax = Math.max(qMax, qr);
    if (i % 40 === 0) samples.push([+qc.toFixed(1), +qr.toFixed(2), +a.toFixed(2)]);
  });
}
// 解析摇杆摆角范围（曲柄 −170..+170）
let aMin = 1e9, aMax = -1e9;
for (let q = -170; q <= 170; q += 0.5) { const a = analytic(q); aMin = Math.min(aMin, a); aMax = Math.max(aMax, a); }
ok(n > 100 && worstErr < 2, `摇杆跟着曲柄走：${n} 个采样，和解析解最大差 ${worstErr.toFixed(2)}°（< 2°）`);
ok(Math.abs(qMin - aMin) < 2 && Math.abs(qMax - aMax) < 2, `摇杆摆角范围 ${qMin.toFixed(1)}° ~ ${qMax.toFixed(1)}°，解析 ${aMin.toFixed(1)}° ~ ${aMax.toFixed(1)}°`);
ok(worstGap < 0.5, `闭环关节两端最大分开 ${worstGap.toFixed(3)} mm（< 0.5 mm，Rapier 约束漂移）`);
ok(worstPen < 0.3, `运行中零件最大穿模 ${worstPen.toFixed(3)} mm`);
out.fourbar = { samples: n, worstErrDeg: +worstErr.toFixed(3), rocker: [+qMin.toFixed(2), +qMax.toFixed(2)], analytic: [+aMin.toFixed(2), +aMax.toFixed(2)], loopGapMm: +worstGap.toFixed(4), penMm: worstPen, table: samples };

console.log("曲柄滑块");
{
  const a = 15, b = 50, th0 = Math.PI / 2;
  const A = [a * Math.cos(th0), a * Math.sin(th0)], C = [Math.sqrt(b * b - A[1] * A[1]) + A[0], 0];
  const w = objWriter("曲柄滑块");
  w.box("机架", [-12, 90], [0, 6], [-8, 8]);
  w.bar("曲柄", [0, 0], A, 8, [6, 10]);
  w.bar("连杆", A, C, 8, [10, 14]);
  w.box("滑块", [C[0] - 8, C[0] + 8], [6, 12], [-6, 6]);
  const p = proj(["机架", "曲柄", "连杆", "滑块"], [
    RJ("crank", "b0", "b1", [0, 0], 6, "custom"), RJ("ca", "b1", "b2", A, 10),
    { id: "slide", name: "slide", type: "prismatic", parent: "b0", child: "b3", anchor: [C[0], 6, 0], axis: [1, 0, 0], limits: { min: -60, max: 60 }, drive: { preset: "none" }, home: 0 },
    RJ("cs", "b2", "b3", C, 10),
  ]);
  const T = await setupFrom(w.text(), p);
  const g = buildGroups(T.project), m = mobility(T.project, g, T.X.M);
  ok(g.loops === 1 && m.planar && m.grublerPlanar === 1 && m.dof === 1, `平面公式 M = ${m.grublerPlanar}，旋量秩 → ${m.dof} 个自由度`);
  const L = createLabWorld(R, T.project, T.an, T.X.M, { fixBase: true });
  const rbS = L.rbs[g.groupOf.get("b3")], x0 = rbS.translation().x;
  steps(L, 0.3);
  let worst = 0, k = 0;
  for (const tgt of [150, -150, 0]) {
    L.core.setTarget("crank", tgt);
    steps(L, Math.abs(tgt - L.core.value("crank")) / 120 + 0.5, (i) => {
      if (i % 12) return;
      const th = th0 - L.core.value("crank") * D, yA = a * Math.sin(th);
      const xs = a * Math.cos(th) + Math.sqrt(b * b - yA * yA);
      worst = Math.max(worst, Math.abs((rbS.translation().x - x0) * 10 - (xs - C[0]))); k++;
    });
  }
  ok(k > 50 && worst < 1, `滑块位移和解析解最大差 ${worst.toFixed(3)} mm（< 1 mm，${k} 个采样，行程 ${(b - a).toFixed(0)}–${(b + a).toFixed(0)} mm）`);
  out.sliderCrank = { worstMm: +worst.toFixed(4), samples: k };
}

console.log("平行四边形 + 第三根平行曲柄（几何特殊）");
{
  const d = 60, a = 25, mk = (third) => {
    const w = objWriter("平行四边形");
    w.box("机架", [-12, d + 42], [0, 6], [-8, 8]);
    w.bar("左曲柄", [0, 0], [0, a], 8, [6, 10]);
    w.bar("右曲柄", [d, 0], [d, a], 8, [6, 10]);
    w.bar("连杆", [0, a], [d + (third ? 30 : 0), a], 8, [10, 14]);
    if (third) w.bar("第三曲柄", [d + 30, 0], [d + 30, a], 8, [6, 10]);
    const js = [RJ("L", "b0", "b1", [0, 0], 6, "custom"), RJ("La", "b1", "b3", [0, a], 10), RJ("Rr", "b0", "b2", [d, 0], 6), RJ("Ra", "b3", "b2", [d, a], 10)];
    if (third) js.push(RJ("T", "b0", "b4", [d + 30, 0], 6), RJ("Ta", "b3", "b4", [d + 30, a], 10));
    return { obj: w.text(), p: proj(third ? ["机架", "左曲柄", "右曲柄", "连杆", "第三曲柄"] : ["机架", "左曲柄", "右曲柄", "连杆"], js) };
  };
  const t1 = mk(false), T = await setupFrom(t1.obj, t1.p);
  const g = buildGroups(T.project), m = mobility(T.project, g, T.X.M);
  ok(m.dof === 1 && m.grublerPlanar === 1, `平行四边形：1 个自由度`);
  const L = createLabWorld(R, T.project, T.an, T.X.M, { fixBase: true });
  steps(L, 0.3);
  let worstPar = 0, worstEq = 0;
  for (const tgt of [60, -60, 0]) {
    L.core.setTarget("L", tgt);
    steps(L, Math.abs(tgt - L.core.value("L")) / 120 + 0.5, (i) => {
      if (i % 12) return;
      const q = L.rbs[g.groupOf.get("b3")].rotation();
      worstPar = Math.max(worstPar, deg(2 * Math.asin(Math.min(1, Math.hypot(q.x, q.y, q.z)))));
      worstEq = Math.max(worstEq, Math.abs(L.core.value("L") - L.core.value("Rr")));
    });
  }
  ok(worstPar < 1.5 && worstEq < 1.5, `连杆一直平移不转（最大转角 ${worstPar.toFixed(2)}°），两根曲柄同角度（最大差 ${worstEq.toFixed(2)}°）`);
  out.parallelogram = { coupleRotDeg: +worstPar.toFixed(3), crankDiffDeg: +worstEq.toFixed(3) };
  const t2 = mk(true), T2 = await setupFrom(t2.obj, t2.p);
  const g2 = buildGroups(T2.project), m2 = mobility(T2.project, g2, T2.X.M);
  ok(g2.loops === 2 && m2.grublerPlanar === 0 && m2.dof === 1 && m2.msgs.some((x) => /几何特殊/.test(x.t)), `加第三根等长平行曲柄：平面公式数出 M = 0，几何上其实还能动（旋量秩 → ${m2.dof}），老实提示“几何特殊”`);
}

console.log("锁死 / 过驱动");
{
  const w = objWriter("三角形");
  w.box("机架", [-12, 72], [0, 6], [-8, 8]);
  w.bar("杆 1", [0, 0], [30, 40], 8, [6, 10]);
  w.bar("杆 2", [60, 0], [30, 40], 8, [10, 14]);
  const p = proj(["机架", "杆 1", "杆 2"], [RJ("r1", "b0", "b1", [0, 0], 6, "custom"), RJ("r2", "b1", "b2", [30, 40], 10), RJ("r3", "b0", "b2", [60, 0], 6)]);
  const T = await setupFrom(w.text(), p);
  const g = buildGroups(T.project), m = mobility(T.project, g, T.X.M);
  ok(m.dof === 0 && m.grublerPlanar === 0 && m.msgs.some((x) => x.lvl === "err" && /锁死/.test(x.t)), `三根杆连成三角形：自由度 0 → 报“锁死”（${m.msgs.find((x) => x.lvl === "err")?.t}）`);
  const L = createLabWorld(R, T.project, T.an, T.X.M, { fixBase: true });
  L.core.setTarget("r1", 60);
  steps(L, 1);
  ok(Math.abs(L.core.value("r1")) < 3, `仿真里电机转不动它（目标 60°，实际 ${L.core.value("r1").toFixed(2)}°）`);
  out.triangle = { dof: m.dof, moved: +L.core.value("r1").toFixed(3) };
  const od = JSON.parse(fs.readFileSync("public/demo/fourbar.project.json", "utf8"));
  od.joints.find((j) => j.id === "j-rocker").drive = { preset: "mg90s", volt: 4.8 };
  const T2 = await setupFrom(fs.readFileSync("public/demo/fourbar.obj", "utf8"), od);
  const m2 = mobility(T2.project, buildGroups(T2.project), T2.X.M);
  ok(m2.msgs.some((x) => /过驱动/.test(x.t)), `四连杆两个关节都配马达 → 提示“过驱动”（${m2.msgs.find((x) => /过驱动/.test(x.t))?.t}）`);
}
fs.mkdirSync("/workspace/proto-site/v13/logs", { recursive: true });
fs.writeFileSync("/workspace/proto-site/v13/logs/loop-test.json", JSON.stringify(out, null, 1));
console.log(`\n闭环测试：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
