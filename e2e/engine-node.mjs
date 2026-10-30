// 无浏览器的装配 + 碰撞自动测试（Node + Rapier WASM），由 scripts/engine-test.sh 调用
// 退出码 0 = 全部通过；穿模判定阈值：任意两刚体之间的形状距离 > -0.1 mm
import fs from "node:fs";
import * as THREE from "three";
globalThis.fetch = async (u) => {
  const p = new URL("../public" + u, import.meta.url);
  if (!fs.existsSync(p)) return { ok: false, json: async () => [] };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};
const { engine } = await import("../.tmp/eng-bundle.mjs");
const { getEntry, toDef } = await import("../.tmp/cat-bundle.mjs");
await engine.init();
const TOL_MM = 0.1;
let worstMm = 0, worstAt = "";
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info }); console.log(ok ? "PASS" : "FAIL", name, info); if (!ok && process.env.DBG) console.log("   log:", engine.log.slice(-3).join(" | ")); };
const pen = (tag) => { const o = engine.overlapTest(); if (process.env.PENTRACE && tag === process.env.PENTRACE) console.log("PEN", tag, o.maxPenetrationMm, o.worstPair?.join("/"), globalThis.__LASTU && JSON.stringify(engine.worldPose(globalThis.__LASTU)), globalThis.__LASTU && engine.bodies.get(engine.parts.get(globalThis.__LASTU).body).rb.isSleeping(), globalThis.__LASTU && JSON.stringify(engine.bodies.get(engine.parts.get(globalThis.__LASTU).body).rb.translation()), globalThis.__LASTU && engine.parts.get(globalThis.__LASTU).body); if (o.maxPenetrationMm > worstMm) { worstMm = o.maxPenetrationMm; worstAt = `${tag}: ${o.worstPair?.join(" ↔ ")}`; } return o; };
const run = (s, tag = "") => { for (let i = 0; i < Math.round(s * 120); i++) { engine.update(1 / 120); if (i % (+process.env.PENEVERY || 12) === 0) pen(tag); } };
const P = (x, y, z, yaw = 0) => ({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw) });
const def = async (id, flip) => toDef(await getEntry(id), flip);
const feats = (uid, t) => engine.worldFeatures(engine.parts.get(uid).body).filter((f) => f.uid === uid && (!t || f.t === t));
// 把 uid 的某个特征 df 拖到目标点 tp 正上方 lift 处再松手
const bring = (uid, df, tp0, lift = 0.4, tag = "") => {
  const T = () => (typeof tp0 === "function" ? tp0() : tp0);
  let tp = T();
  const w = engine.worldPose(uid).p.clone();
  engine.beginDrag(uid, w.clone());
  // 像人一样：先提起来（拖拽会把零件扶正），平移到目标上方，再放低
  const hi = Math.max(w.y, tp.y + lift) + 4;
  engine.dragTo(w.clone().setY(hi));
  run(0.6, tag);
  // 等它被扶正（倒在桌上的排针要多转一会儿）
  for (let i = 0; i < 40; i++) { const up = new THREE.Vector3(0, 1, 0).applyQuaternion(engine.worldPose(uid).q); if (up.y > 0.99995) break; run(0.05, tag); }
  // 提起来之后重新取特征的世界坐标（同一个特征：类型相同、局部坐标相同）
  const f = typeof df === "function" ? df() : feats(uid, df.t).find((g) => g.lp.distanceTo(df.lp) < 1e-6) || df;
  const grab = engine.worldPose(uid).p.clone();
  const goal = grab.clone().add(tp.clone().sub(f.wp)).setY(tp.y + lift + (grab.y - f.wp.y));
  if (process.env.DBG && tag === process.env.TRACE) console.log("  ph", engine.worldPose(uid).p.toArray().map((v) => v.toFixed(2)).join(","), "goal", goal.toArray().map((v) => v.toFixed(2)).join(","));
  engine.dragTo(goal.clone().setY(hi));
  run(0.5, tag);
  if (process.env.DBG && tag === process.env.TRACE) console.log("  ph", engine.worldPose(uid).p.toArray().map((v) => v.toFixed(2)).join(","), "goal", goal.toArray().map((v) => v.toFixed(2)).join(","));
  // 悬停在目标上方再对一次（零件在空中可能还有一点晃动/偏转）
  for (let k = 0; k < 2; k++) {
    tp = T();
    const f2 = typeof df === "function" ? df() : feats(uid, df.t).find((g) => g.lp.distanceTo(df.lp) < 1e-6) || df;
    const g2 = engine.worldPose(uid).p.clone();
    if (process.env.DBG && tag === process.env.TRACE) { const P = engine.parts.get(uid); console.log("  rel", P.body, engine.bodies.get(P.body).parts.size ?? engine.bodies.get(P.body).parts.length, JSON.stringify(P.rel), JSON.stringify(engine.bodyPose(P.body))); }
    if (process.env.DBG && tag === process.env.TRACE) console.log("  re", "f", f2.wp.toArray().map((v) => v.toFixed(2)).join(","), "g", g2.toArray().map((v) => v.toFixed(2)).join(","), "tp", tp.toArray().map((v) => v.toFixed(2)).join(","), "up", new THREE.Vector3(0, 1, 0).applyQuaternion(engine.worldPose(uid).q).toArray().map((v) => v.toFixed(3)).join(","));
    goal.copy(g2.clone().add(tp.clone().sub(f2.wp)).setY(tp.y + lift + (g2.y - f2.wp.y)));
    engine.dragTo(goal.clone().setY(tp.y + lift + (g2.y - f2.wp.y) + 1));
    run(0.4, tag);
  }
  engine.dragTo(goal);
  run(0.6, tag);
  if (process.env.DBG && tag === process.env.TRACE) console.log("  ph", engine.worldPose(uid).p.toArray().map((v) => v.toFixed(2)).join(","), "goal", goal.toArray().map((v) => v.toFixed(2)).join(","));
  const r = engine.endDrag();
  if (process.env.DBG && tag === process.env.TRACE) console.log("  end", JSON.stringify(r), engine.worldPose(uid).p.toArray().map((v) => v.toFixed(2)).join(","));
  run(0.25, tag);
  return r || {};
};
const turn = (uid, until = "拧紧", tool = "screwdriver", max = 12) => {
  engine.tool.kind = tool;
  const op = engine.holdScrew(uid);
  let t = 0;
  while (t < max && engine.parts.get(uid).state.screw?.stage !== until) { run(0.05, "turn"); t += 0.05; }
  engine.releaseOps();
  return engine.parts.get(uid).state.screw?.stage;
};
const add = async (id, x, z, flip, yaw = 0) => { const u = engine.addPart(await def(id, flip), P(x, 0.02, z, yaw)); globalThis.__LASTU = u; if (process.env.DEPLAST && id.includes("pico")) globalThis.__DEPBID = engine.parts.get(u).body; run(0.3, "drop " + id); return u; };

// 1) 落桌静置
const plate = await add("p-baseplate", 0, 0);
check("底板落在桌面上", Math.abs(engine.worldPose(plate).p.y) < 0.02, engine.worldPose(plate).p.y.toFixed(4));
// 2) 一堆零件从空中掉下来叠在一起：不穿模
const pile = [];
for (let i = 0; i < 6; i++) pile.push(engine.addPart(await def(["p-nut-M3", "p-screw-M3x10", "kc-sw_push_6mm", "kc-led_d5.0mm", "p-standoff-M3x10", "p-dupont-f1"][i]), P(24 + (i % 2) * 0.3, 3 + i * 1.2, -14 + (i % 3) * 0.2)));
run(2.5, "pile");
check("零件堆叠掉落后不穿模", pen("pile").maxPenetrationMm < TOL_MM, `${pen("pile").maxPenetrationMm} mm`);
// 3) 拖着一个零件去撞另一个：拖的零件停在接触处或推开对方，不穿过去
const sw = pile[2];
const before0 = pile.filter((u) => u !== sw).map((u) => engine.worldPose(u).p.clone());
engine.beginDrag(sw, engine.worldPose(sw).p.clone());
let maxDrag = 0;
// 沿着 LED 所在的那条线推过去（推的高度在 LED 中心附近）
const ledP = engine.worldPose(pile[3]).p.clone();
for (let k = 0; k < 60; k++) { engine.drag.target = new THREE.Vector3(24 - 6 + k * 0.2, 0.3, ledP.z); run(1 / 60, "push"); maxDrag = Math.max(maxDrag, pen("push").maxPenetrationMm); }
engine.endDrag({ snap: false });
run(0.5, "push");
check("拖拽撞上别的零件时不穿模", maxDrag < TOL_MM * 3, `拖拽中最大 ${maxDrag} mm（拖拽是速度控制，允许 0.3 mm 瞬时）`);
{ const mv = Math.max(...pile.filter((u) => u !== sw).map((u, i) => engine.worldPose(u).p.distanceTo(before0[i]))); check("被撞的零件被推开了", mv > 0.1, `最多被推开 ${mv.toFixed(2)} cm`); }
for (const u of pile) engine.removePart(u);
run(0.2);

// 4) 铜柱拧进底板，Feather 放上去，4 颗螺丝拧紧
const threads = feats(plate, "thread-f").filter((f) => f.size === "M2.5");
const sos = [];
for (let i = 0; i < 4; i++) {
  const u = await add("p-standoff-M2.5x10", -20 + i * 2, 15);
  const r = bring(u, feats(u, "thread-m")[0], threads[i].wp, 0.3, "standoff");
  check(`铜柱 ${i + 1} 对上螺纹孔`, r.ok, r.why || "");
  check(`铜柱 ${i + 1} 拧到底`, turn(u, "拧紧", "hand") === "拧紧");
  sos.push(u);
}
const fe = await add("ada-5323", 10, 14);
let holes = feats(fe, "hole");
let tops = sos.map((u) => feats(u, "thread-f")[0]);
// Feather 的第 0 个孔对第 0 根铜柱
let r = bring(fe, holes[0], tops.sort((a, b) => (Math.abs(a.wp.x - b.wp.x) > 0.2 ? a.wp.x - b.wp.x : a.wp.z - b.wp.z))[0].wp, 0.3, "feather");
if (process.env.DBG && !r.ok) {
  const bid = engine.parts.get(fe).body;
  engine.beginDrag(fe, engine.worldPose(fe).p.clone());
  engine.dragTo(engine.worldPose(fe).p.clone().add(tops[0].wp.clone().sub(feats(fe, "hole")[0].wp)).add(new THREE.Vector3(0, 0.3, 0)));
  run(0.8);
  const b2 = engine.drag.bid;
  const D = engine.features(b2).filter((f) => f.t === "hole");
  const rule = (await import("../.tmp/eng-bundle.mjs")).RULES.find((r) => r.name === "mount");
  const T = engine.freeFeatures(engine.parts.get(plate).body).filter((f) => rule.t(f, D[0]));
  const pose = engine.bodyPose(b2);
  console.log("D", D.length, "T", T.length, "bottom", engine.bodyBottom(b2).toFixed(3), "Tys", T.map((t) => t.wp.y.toFixed(2)).join(","), "above", rule.above);
  { const q = new THREE.Quaternion(); for (const d of D) { const x = d.lp.x + pose.p.x, z = d.lp.z + pose.p.z; const nn = T.map((t) => Math.hypot(t.wp.x - x, t.wp.z - z)).sort((a, b) => a - b)[0]; console.log("  hole", x.toFixed(3), z.toFixed(3), "nearest", nn.toFixed(3), "y", (d.lp.y + pose.p.y).toFixed(3)); } }
  for (let k = 0; k < 4; k++) console.log(" k", k, JSON.stringify(engine.matchPattern(rule, D, T, pose.p, k * Math.PI / 2, engine.bodyBottom(b2))?.count));
  console.log(" D lp", D.map((d) => d.lp.toArray().map((v) => v.toFixed(2)).join(",")), "pose", pose.p.toArray().map((v) => v.toFixed(2)));
  engine.endDrag({ snap: false });
}
check("Feather 落在 4 根铜柱上", r.ok && r.rule === "mount", r.why || r.rule);
holes = feats(fe, "hole");
for (let k = 0; k < 4; k++) {
  const sc = await add("p-screw-M2.5x6", -10 + k * 2, 16);
  r = bring(sc, feats(sc, "screw")[0], holes[k].wp.clone().setY(holes[k].wp.y), 0.4, "screw");
  check(`螺丝 ${k + 1} 放进孔`, r.ok, r.why || "");
  if (r.ok) check(`螺丝 ${k + 1} 拧紧`, turn(sc) === "拧紧");
}
const long = await add("p-screw-M2.5x20", 18, 16);
const fx = engine.parts.get(fe).body;
r = bring(long, feats(long, "screw")[0], holes[0].wp.clone().add(new THREE.Vector3(0.0, 0, 0)), 0.4, "long");
check("太长的螺丝被拒绝（会顶到孔底/已占用）", !r.ok, r.why || "");
engine.removePart(long);
// 拖底板：Feather + 铜柱 + 螺丝一起走
const fe0 = engine.worldPose(fe).p.clone(), pl0 = engine.worldPose(plate).p.clone();
engine.beginDrag(plate, pl0.clone());
engine.dragTo(pl0.clone().add(new THREE.Vector3(2, 0.3, 0)));
run(0.8, "carry");
engine.endDrag({ snap: false });
run(0.5, "carry");
const d1 = engine.worldPose(plate).p.clone().sub(pl0), d2 = engine.worldPose(fe).p.clone().sub(fe0);
check("拖底板时拧好的 Feather 跟着走", d1.distanceTo(d2) < 0.05 && d1.length() > 1, `${d1.x.toFixed(2)} vs ${d2.x.toFixed(2)}`);

// 5) 面包板贴到底板上，LED 插进面包板
const bb = await add("p-breadboard-half", 20, 16);
const area = feats(plate, "bb-area")[0];
r = bring(bb, feats(bb, "bb-base")[0], area.wp, 0.4, "bb");
check("面包板贴到底板上", r.ok && r.rule === "bb-area", r.why || r.rule);
const led = await add("kc-led_d5.0mm", 25, -16);
const hole = (name) => feats(bb, "bbhole").find((f) => f.name === name);
r = bring(led, feats(led, "leg")[0], hole("c3").wp, 0.3, "led");
check("LED 插进面包板", r.ok && r.rule === "insert", r.why || r.rule);
const res = await add("kc-r_axial_din0207_l6.3mm_d2.5mm_p10.16mm_horizontal", 27, -16);
r = bring(res, feats(res, "leg")[0], hole("b5").wp, 0.3, "res");
check("电阻插进面包板（另一种孔距会自动转 90° 再试）", r.ok, r.why || r.rule);
// 6) 排针长针朝下插面包板，Pico 套上去并焊接
// 先转 90°（界面里按 R）让排针和面包板的列同向
const h1 = await add("kc-pinheader_1x20_p2.54mm_vertical", -24, -10, true, Math.PI / 2);
const h2 = await add("kc-pinheader_1x20_p2.54mm_vertical", -24, -14, true, Math.PI / 2);
const bbz = (row, col) => hole(`${row}${col}`);
// 排针一端的针对准第 30 列，另一端会落在第 11 列；两端都试一下
const endLegs = (u) => { const L = feats(u, "leg"); const ax = Math.abs(L[0].wp.x - L.at(-1).wp.x) > Math.abs(L[0].wp.z - L.at(-1).wp.z) ? "x" : "z"; L.sort((a, b) => a.wp[ax] - b.wp[ax]); return [L[0], L.at(-1)]; };
const insertHeader = (u, row) => { let rr = {}; for (const e of [1, 0]) { rr = bring(u, () => endLegs(u)[e], () => bbz(row, 30).wp, 0.3, "hdr"); if (rr.ok) break; } return rr; };
r = insertHeader(h1, "c");
if (process.env.DBG && !r.ok) {
  const legs = feats(h1, "leg");
  console.log("H legs", legs.length, JSON.stringify(legs.slice(0, 3).map((f) => f.wp.toArray().map((v) => +v.toFixed(2)).join(",") + " top" + f.top)), JSON.stringify(legs.at(-1).wp));
  console.log("H c30", bbz("c", 30).wp.toArray().map((v) => v.toFixed(2)), "c29", bbz("c", 29).wp.toArray().map((v) => v.toFixed(2)), "d30", bbz("d", 30).wp.toArray().map((v) => v.toFixed(2)));
  console.log("H bottom", engine.bodyBottom(engine.parts.get(h1).body).toFixed(3), "pose", JSON.stringify(engine.worldPose(h1)));
  { const L = endLegs(h1)[0]; const w = engine.worldPose(h1).p.clone(); engine.beginDrag(h1, w.clone()); engine.dragTo(w.clone().setY(8)); run(0.5); const goal = engine.worldPose(h1).p.clone().add(bbz("c", 30).wp.clone().sub(endLegs(h1)[0].wp)).add(new THREE.Vector3(0, 0.3, 0)); engine.dragTo(goal.clone().setY(8)); run(0.6); engine.dragTo(goal); run(0.6); }
  const bid = engine.drag.bid, pose = engine.bodyPose(bid);
  const rule = (await import("../.tmp/eng-bundle.mjs")).RULES.find((r) => r.name === "insert");
  const D0 = engine.features(bid).filter(rule.d); const ax0 = Math.abs(D0[0].lp.x - D0.at(-1).lp.x) > Math.abs(D0[0].lp.z - D0.at(-1).lp.z) ? "x" : "z"; const D = [...D0].sort((a, b) => b.lp[ax0] - a.lp[ax0]); const T = engine.freeFeatures(engine.parts.get(bb).body).filter((f) => rule.t(f, D[0]));
  console.log(" H D", D.length, "T", T.length, "allbb", feats(bb, "bbhole").length);
  for (let k = 0; k < 4; k++) { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * Math.PI / 2); const r0 = D[0].lp.clone().applyQuaternion(q); const tp = bbz("c", 30).wp; const miss = D.map((d) => { const x = tp.x - r0.x + d.lp.clone().applyQuaternion(q).x, z = tp.z - r0.z + d.lp.clone().applyQuaternion(q).z; return Math.min(...T.map((t) => Math.hypot(t.wp.x - x, t.wp.z - z))).toFixed(2); }); console.log(" H miss", k, miss.join(" ")); }
  for (let k = 0; k < 4; k++) console.log(" H k", k, JSON.stringify(engine.matchPattern(rule, D, T, pose.p, k * Math.PI / 2, engine.bodyBottom(bid), pose.q)?.count));
  console.log(" H ys", D.slice(0, 3).map((d) => rule.y(d, T[0]).toFixed(3)).join(","), "bottom", engine.bodyBottom(bid).toFixed(3), "Ty", T[0].wp.y.toFixed(3));
  { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); const refNow = D[0].lp.clone().applyQuaternion(pose.q).add(pose.p); const near = T.filter((t) => Math.hypot(t.wp.x - refNow.x, t.wp.z - refNow.z) < rule.reach); console.log(" H near", near.length, near.slice(0, 5).map((t) => t.t + ":" + (t.name || "") + "@" + t.wp.y.toFixed(2)).join(" "), "refNow", refNow.toArray().map((v) => v.toFixed(2)).join(","));
    const others = T.filter((t) => t.t !== "bbhole"); console.log(" H others", others.length, others.slice(0, 4).map((t) => t.uid.slice(0, 14) + ":" + t.t + "@" + t.wp.toArray().map((v) => v.toFixed(2)).join(",")).join(" | ")); }
  engine.endDrag({ snap: false });
}
check("排针 1 插进面包板", r.ok, r.why || r.rule);
r = insertHeader(h2, "h");
check("排针 2 插进面包板", r.ok, r.why || r.rule);
const pico = await add("kc-raspberrypi_pico", -20, 12, false, Math.PI / 2);
// Pico 也转 90°，让它的长边和排针同向；最左边一排的端孔对准最左边的针尖
const minX = (arr) => arr.slice().sort((a, b) => (Math.abs(a.wp.x - b.wp.x) > 0.1 ? a.wp.x - b.wp.x : a.wp.z - b.wp.z))[0];
const pinsNow0 = [...feats(h1, "pin-up"), ...feats(h2, "pin-up")];
r = bring(pico, () => minX(feats(pico, "pinhole")), minX(pinsNow0).wp, 0.4, "pico");
check("Pico 套到排针上", r.ok && r.rule === "onpins", r.why || r.rule);
const ph2 = feats(pico, "pinhole");
let soldered = 0;
const pinsNow = [...feats(h1, "pin-up"), ...feats(h2, "pin-up")];
const onPin = ph2.filter((f) => pinsNow.some((g) => Math.hypot(g.wp.x - f.wp.x, g.wp.z - f.wp.z) < 0.08));
const over = (h) => ph2.filter((f) => feats(h, "pin-up").some((g) => Math.hypot(g.wp.x - f.wp.x, g.wp.z - f.wp.z) < 0.08));
for (const f of over(h1).slice(0, 3).concat(over(h2).slice(0, 3))) {
  const op = engine.holdSolder(f.wp.clone().add(new THREE.Vector3(0, 0.1, 0)), { hold: 0.8 });
  if (op) { run(0.8, "solder"); soldered++; }
}
check("用烙铁焊了 6 个点", soldered === 6 && (engine.parts.get(pico).state.solder?.length || 0) === 6, `${soldered}`);
const pk0 = engine.worldPose(h1).p.clone();
engine.beginDrag(pico, engine.worldPose(pico).p.clone());
engine.dragTo(engine.worldPose(pico).p.clone().add(new THREE.Vector3(0, 3, 0)));
run(0.8, "lift pico");
const lifted = engine.worldPose(h1).p.y - pk0.y;
// 放回去：先放低到离面包板 3 mm 再松手（从 3 cm 高直接扔下去的冲击见“已知限制”）
engine.dragTo(engine.worldPose(pico).p.clone().add(new THREE.Vector3(0, -2.7, 0)));
run(0.8, "lift pico");
engine.endDrag({ snap: false });
run(0.8, "lift pico");
check("拎起焊好的 Pico，排针一起被拔出面包板", lifted > 1, lifted.toFixed(2) + " cm");

// 7) 舵机进支架 + 螺母固定支架 + 舵盘 + 触手
const br = engine.addPart(await def("p-servo-bracket"), P(28, 0.02, 14));
run(0.3, "drop p-servo-bracket");
r = bring(br, feats(br, "hole")[0], feats(plate, "stud-up")[0].wp, 1.0, "bracket");
check("舵机支架套到底板的 M3 螺柱上", r.ok, r.why || r.rule);
for (let k = 0; k < 2; k++) {
  const n = await add("p-nut-M3", 20 + k * 2, -17);
  const stud = feats(plate, "stud-up")[k];
  r = bring(n, feats(n, "nut")[0], stud.wp.clone().setY(stud.wp.y + stud.len), 0.3, "nut");
  check(`M3 螺母 ${k + 1} 套上螺柱`, r.ok, r.why || "");
  if (r.ok) check(`M3 螺母 ${k + 1} 拧紧`, turn(n) === "拧紧");
}
const sv = await add("ada-1143", 26, -12);
r = bring(sv, feats(sv, "servo-body")[0], feats(br, "servo-slot")[0].wp, 1.0, "servo");
check("舵机放进支架", r.ok && r.rule === "servo-seat", r.why || r.rule);
const hn = await add("p-servo-horn", 22, -8);
r = bring(hn, feats(hn, "hub")[0], feats(sv, "shaft")[0].wp, 0.3, "horn");
check("舵盘对上输出轴", r.ok, r.why || "");
if (r.ok) { engine.holdPress(hn); run(1.0, "press"); check("舵盘压到位", engine.edges.some((e) => e.a === hn && e.kind === "fasten")); }
const tc = await add("p-tentacle", 20, -6);
r = bring(tc, feats(tc, "arm-mount")[0], feats(hn, "arm-tip")[0].wp, 0.3, "tentacle");
check("触手装到舵盘上", r.ok, r.why || "");
if (r.ok) { engine.holdPress(tc); run(1.0, "press"); }

// 8) 线缆：杜邦线插面包板，USB 插 Feather
const dm = await add("p-dupont-m1", -6, -17);
r = bring(dm, feats(dm, "dupont-m")[0], hole("a20").wp, 0.3, "dupont");
check("杜邦公头插进面包板", r.ok, r.why || "");
const usb = await add("p-plug-usb-c", -26, 4);
const port = feats(fe, "port").find((f) => f.kind === "usb-c");
r = bring(usb, feats(usb, "plug")[0], port.wp, 0.1, "usb");
check("USB‑C 插头插进 Feather", r.ok && r.rule === "plug", r.why || r.rule);
engine.addCable("usb-c", [usb, null], new THREE.Vector3(-29, 0.3, 0));
run(2.0, "cable");
check("线缆（绳子）稳定、没有飞走", engine.cables.every((c) => c.segs.every((s) => Math.abs(s.translation().x) < 40 && s.translation().y > -0.5)));

// 9) 汇总
run(1.5, "final");
const fin = pen("final");
check(`全程任意两零件穿透 < ${TOL_MM} mm`, worstMm < TOL_MM, `最深 ${worstMm} mm @ ${worstAt}`);
const summary = { passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, worstPenetrationMm: worstMm, worstAt, final: fin, parts: engine.parts.size, bodies: engine.bodies.size, edges: engine.edges.length };
console.log(JSON.stringify(summary, null, 1));
fs.mkdirSync("../v5", { recursive: true });
fs.writeFileSync("../v5/engine-test.json", JSON.stringify({ summary, results, log: engine.log }, null, 1));
process.exit(summary.failed ? 1 : 0);
