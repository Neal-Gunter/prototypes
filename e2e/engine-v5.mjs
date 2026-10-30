// v5 新增的自动测试：新零件落桌不穿模、面包板孔数、工具推开零件、导线（绳子）不穿过板子
import fs from "node:fs";
import * as THREE from "three";
globalThis.fetch = async (u) => {
  const p = new URL("../public" + u, import.meta.url);
  if (!fs.existsSync(p)) return { ok: false, json: async () => [] };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};
const { engine } = await import("../.tmp/eng-bundle.mjs");
const { getEntry, toDef } = await import("../.tmp/cat-bundle.mjs");
const { PROCEDURAL } = await import("../.tmp/proc-bundle.mjs");
await engine.init();
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info }); console.log(ok ? "PASS" : "FAIL", name, info); };
const run = (s, f) => { for (let i = 0; i < Math.round(s * 120); i++) { engine.update(1 / 120); if (f && i % 6 === 0) f(); } };
const P = (x, y, z) => ({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion() });
const def = async (id) => toDef(await getEntry(id));
const pen = (ropes = false) => engine.overlapTest({ includeRopes: ropes }).maxPenetrationMm;

// 1) 新零件：每个从 2 cm 高掉到桌上（一次两个挨着），不穿模、停在桌面上
const NEW = /^p-(capscrew|washer|breadboard-(830|170)|motor-|handtool-|jumper-(20|25|30)$)/;
const ids = PROCEDURAL.filter((d) => NEW.test(d.id)).map((d) => d.id);
let worst = 0, worstId = "", below = [];
for (const id of ids) {
  const u = engine.addPart(await def(id), P(-6, 2, 0));
  const v = engine.addPart(await def(id), P(-6 + 0.3, 3 + (PROCEDURAL.find((d) => d.id === id).dims_mm.y / 10), 0.2));
  run(2.0, () => { const m = pen(); if (m > worst) { worst = m; worstId = id; } });
  for (const w of [u, v]) {
    const y = engine.worldPose(w).p.y;
    if (y < -0.02 || Math.abs(engine.worldPose(w).p.x) > 30) below.push(`${id}@${y.toFixed(3)}`);
  }
  engine.removePart(u); engine.removePart(v); run(0.05);
}
check(`新增 ${ids.length} 种程序零件落桌、两两叠落不穿模（< 0.1 mm）`, worst < 0.1, `最深 ${worst} mm ${worstId}`);
check("新增零件都停在桌面上（没掉下去、没飞走）", !below.length, below.slice(0, 4).join(", "));

// 2) 面包板孔数：830 / 400 / 170
for (const [id, n] of [["p-breadboard-830", 830], ["p-breadboard-half", 400], ["p-breadboard-170", 170]]) {
  const d = await def(id);
  check(`${d.name_zh} 有 ${n} 个孔`, d.bbHoles.length === n, `${d.bbHoles.length}`);
}

// 3) 工具是运动学碰撞体：螺丝刀从侧面扫过去，把步进电机推开，而不是穿过去
{
  const m = engine.addPart(await def("p-motor-nema17-40"), P(0, 0.02, 0));
  run(1.0);
  const p0 = engine.worldPose(m).p.clone();
  engine.setTool("screwdriver");
  let wm = 0;
  for (let k = 0; k <= 120; k++) { engine.setToolPos(new THREE.Vector3(-8 + k * 0.1, 0.5, 0)); run(1 / 120); wm = Math.max(wm, pen()); }
  engine.setToolPos(new THREE.Vector3(0, 30, 0)); run(0.5);
  const mv = engine.worldPose(m).p.distanceTo(p0);
  check("螺丝刀扫过步进电机：电机被推开", mv > 1, `推开 ${mv.toFixed(2)} cm`);
  check("工具和零件之间不穿模（运动学刚体，允许 0.5 mm 瞬时）", wm < 0.5, `最深 ${wm} mm`);
  engine.setTool(null);
  engine.removePart(m); run(0.1);
}

// 4) 导线（20 段胶囊绳）：面包板压在线上，线不穿过板子
{
  const a = engine.addPart(await def("p-dupont-m1"), P(-12, 0.02, 3));
  const b = engine.addPart(await def("p-dupont-m1"), P(12, 0.02, 3));
  run(0.5);
  engine.addCable("dupont-mm-30", [a, b]);
  run(2.0);
  const bb = engine.addPart(await def("p-breadboard-830"), P(0, 3, 3));
  let wr = 0;
  run(3.0, () => { wr = Math.max(wr, pen(true)); });
  const c = engine.cables.at(-1);
  const B = engine.worldPose(bb).p, d = engine.parts.get(bb).def;
  const hx = d.dims_mm.x / 20, hz = d.dims_mm.z / 20, h = d.dims_mm.y / 10;
  // 板子是斜着压在线上的，所以在板子自己的坐标系里看线段中心是不是在板子里面
  const inv = engine.worldPose(bb).q.clone().invert();
  const inside = c.segs.filter((s) => { const t = s.translation(); const l = new THREE.Vector3(t.x, t.y, t.z).sub(B).applyQuaternion(inv); return Math.abs(l.x) < hx - 0.1 && Math.abs(l.z) < hz - 0.1 && l.y > 0.05 && l.y < h - 0.05; }).length;
  check("面包板压在导线上：没有一段线跑进板子里", inside === 0, `板内线段 ${inside}/${c.N}`);
  check("导线和板子之间穿透 < 0.5 mm（含绳子）", wr < 0.5, `最深 ${wr} mm`);
  // 拖板子把线压住再拖走：线还是连着两头
  engine.beginDrag(bb, B.clone());
  for (let k = 0; k < 60; k++) { engine.dragTo(B.clone().add(new THREE.Vector3(k * 0.15, 0.5, 0))); run(1 / 60, () => { wr = Math.max(wr, pen(true)); }); }
  engine.endDrag({ snap: false }); run(0.8);
  const seg = c.segs.map((s) => s.translation());
  const maxGap = Math.max(...seg.slice(1).map((t, i) => Math.hypot(t.x - seg[i].x, t.y - seg[i].y, t.z - seg[i].z)));
  check("拖动压在线上的板子后，导线各段仍连着（没被扯断/卡进去）", maxGap < c.segLen * 1.3, `相邻段最大间距 ${maxGap.toFixed(2)} cm（段长 ${c.segLen.toFixed(2)}）`);
  check("拖动过程中导线和板子穿透 < 0.5 mm", wr < 0.5, `最深 ${wr} mm`);
}

const summary = { passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, newProcedural: ids.length };
console.log(summary.failed ? "SOME FAIL" : "ALL PASS", `${summary.passed}/${results.length}`);
fs.mkdirSync("../v5", { recursive: true });
fs.writeFileSync("../v5/engine-v5-test.json", JSON.stringify({ summary, results }, null, 1));
process.exit(summary.failed ? 1 : 0);
