// 装配台“自动演示”：和 e2e/engine-node.mjs 同样的步骤，只是用真实时间一步步做给人看
// run(s) 在浏览器里等 s 秒（画面循环在推进物理），每一步都经过同一套碰撞和装配规则，没有“瞬移”
import * as THREE from "three";
import { getEntry, toDef } from "./catalog.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = (x, y, z, yaw = 0) => ({ p: V(x, y, z), q: new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw) });

export async function runDemo(engine, { run, say = () => {}, stop = () => false, showTool = () => {} }) {
  // 演示里的工具只画出来、不放碰撞体（和自动测试一致），避免工具模型把旁边的零件碰歪
  const def = async (id, flip) => toDef(await getEntry(id), flip);
  const feats = (uid, t) => engine.worldFeatures(engine.parts.get(uid).body).filter((f) => f.uid === uid && (!t || f.t === t));
  const add = async (id, x, z, flip, yaw = 0) => {
    const u = engine.addPart(await def(id, flip), P(x, 0.02, z, yaw));
    await run(0.3);
    return u;
  };
  const bring = async (uid, df, tp0, lift = 0.4) => {
    const T = () => (typeof tp0 === "function" ? tp0() : tp0);
    let tp = T();
    const w = engine.worldPose(uid).p.clone();
    engine.beginDrag(uid, w.clone());
    const hi = Math.max(w.y, tp.y + lift) + 4;
    engine.dragTo(w.clone().setY(hi));
    await run(0.6);
    for (let i = 0; i < 40; i++) {
      const up = V(0, 1, 0).applyQuaternion(engine.worldPose(uid).q);
      if (up.y > 0.99995) break;
      await run(0.05);
    }
    const f = typeof df === "function" ? df() : feats(uid, df.t).find((g) => g.lp.distanceTo(df.lp) < 1e-6) || df;
    const grab = engine.worldPose(uid).p.clone();
    const goal = grab.clone().add(tp.clone().sub(f.wp)).setY(tp.y + lift + (grab.y - f.wp.y));
    engine.dragTo(goal.clone().setY(hi));
    await run(0.5);
    for (let k = 0; k < 2; k++) {
      tp = T();
      const f2 = typeof df === "function" ? df() : feats(uid, df.t).find((g) => g.lp.distanceTo(df.lp) < 1e-6) || df;
      const g2 = engine.worldPose(uid).p.clone();
      goal.copy(g2.clone().add(tp.clone().sub(f2.wp)).setY(tp.y + lift + (g2.y - f2.wp.y)));
      engine.dragTo(goal.clone().setY(goal.y + 1));
      await run(0.4);
    }
    engine.dragTo(goal);
    await run(0.6);
    const r = engine.endDrag();
    await run(0.25);
    return r || {};
  };
  const turn = async (uid, tool = "screwdriver", max = 12) => {
    engine.tool.kind = tool;
    showTool(tool, engine.worldPose(uid).p.clone().add(V(0, 1.4, 0)));
    engine.holdScrew(uid);
    let t = 0;
    while (t < max && engine.parts.get(uid).state.screw?.stage !== "拧紧") {
      await run(0.05);
      t += 0.05;
    }
    engine.releaseOps();
    engine.tool.kind = "hand";
    showTool(null);
  };
  const steps = [];
  const step = (zh, fn) => steps.push({ zh, fn });

  let plate, sos = [], fe, bb, h1, h2, pico, br, sv, hn;
  step("底板落到桌面上", async () => { plate = await add("p-baseplate", 0, 0); await run(0.5); });
  step("4 根 M2.5 铜柱拧进底板", async () => {
    const threads = feats(plate, "thread-f").filter((f) => f.size === "M2.5");
    for (let i = 0; i < 4 && !stop(); i++) {
      const u = await add("p-standoff-M2.5x10", -20 + i * 2, 15);
      const r = await bring(u, feats(u, "thread-m")[0], threads[i].wp, 0.3);
      if (r.ok) await turn(u, "hand");
      sos.push(u);
    }
  });
  step("Feather 放到铜柱上，4 颗 M2.5 螺丝拧紧", async () => {
    fe = await add("ada-5323", 10, 14);
    const tops = sos.map((u) => feats(u, "thread-f")[0]).sort((a, b) => (Math.abs(a.wp.x - b.wp.x) > 0.2 ? a.wp.x - b.wp.x : a.wp.z - b.wp.z));
    await bring(fe, feats(fe, "hole")[0], tops[0].wp, 0.3);
    const holes = feats(fe, "hole");
    for (let k = 0; k < 4 && !stop(); k++) {
      const sc = await add("p-screw-M2.5x6", -10 + k * 2, 16);
      const r = await bring(sc, feats(sc, "screw")[0], holes[k].wp, 0.4);
      if (r.ok) await turn(sc);
    }
  });
  step("面包板贴到底板，LED 和电阻插进面包板", async () => {
    bb = await add("p-breadboard-half", 20, 16);
    await bring(bb, feats(bb, "bb-base")[0], feats(plate, "bb-area")[0].wp, 0.4);
    const hole = (n) => feats(bb, "bbhole").find((f) => f.name === n);
    const led = await add("kc-led_d5.0mm", 25, -16);
    await bring(led, feats(led, "leg")[0], hole("c3").wp, 0.3);
    const res = await add("kc-r_axial_din0207_l6.3mm_d2.5mm_p10.16mm_horizontal", 27, -16);
    await bring(res, feats(res, "leg")[0], hole("b5").wp, 0.3);
  });
  step("两条排针插进面包板，Pico 套上去，焊 6 个点", async () => {
    const hole = (n) => feats(bb, "bbhole").find((f) => f.name === n);
    h1 = await add("kc-pinheader_1x20_p2.54mm_vertical", -24, -10, true, Math.PI / 2);
    h2 = await add("kc-pinheader_1x20_p2.54mm_vertical", -24, -14, true, Math.PI / 2);
    const endLegs = (u) => { const L = feats(u, "leg"); const ax = Math.abs(L[0].wp.x - L.at(-1).wp.x) > Math.abs(L[0].wp.z - L.at(-1).wp.z) ? "x" : "z"; L.sort((a, b) => a.wp[ax] - b.wp[ax]); return [L[0], L.at(-1)]; };
    for (const [u, row] of [[h1, "c"], [h2, "h"]]) for (const e of [1, 0]) { const r = await bring(u, () => endLegs(u)[e], () => hole(`${row}30`).wp, 0.3); if (r.ok) break; }
    pico = await add("kc-raspberrypi_pico", -20, 12, false, Math.PI / 2);
    const minX = (a) => a.slice().sort((x, y) => (Math.abs(x.wp.x - y.wp.x) > 0.1 ? x.wp.x - y.wp.x : x.wp.z - y.wp.z))[0];
    await bring(pico, () => minX(feats(pico, "pinhole")), minX([...feats(h1, "pin-up"), ...feats(h2, "pin-up")]).wp, 0.4);
    const ph = feats(pico, "pinhole");
    const over = (h) => ph.filter((f) => feats(h, "pin-up").some((g) => Math.hypot(g.wp.x - f.wp.x, g.wp.z - f.wp.z) < 0.08));
    engine.tool.kind = "iron";
    for (const f of over(h1).slice(0, 3).concat(over(h2).slice(0, 3))) {
      if (stop()) break;
      showTool("iron", f.wp.clone().add(V(0, 0.12, 0)));
      if (engine.holdSolder(f.wp.clone().add(V(0, 0.1, 0)), { hold: 0.8 })) await run(0.8);
    }
    showTool(null);
    engine.tool.kind = "hand";
  });
  step("舵机支架套上 M3 螺柱、螺母拧紧，舵机进支架，装舵盘和触手", async () => {
    br = engine.addPart(await def("p-servo-bracket"), P(28, 0.02, 14));
    await run(0.3);
    await bring(br, feats(br, "hole")[0], feats(plate, "stud-up")[0].wp, 1.0);
    for (let k = 0; k < 2 && !stop(); k++) {
      const n = await add("p-nut-M3", 20 + k * 2, -17);
      const stud = feats(plate, "stud-up")[k];
      const r = await bring(n, feats(n, "nut")[0], stud.wp.clone().setY(stud.wp.y + stud.len), 0.3);
      if (r.ok) await turn(n);
    }
    sv = await add("ada-1143", 26, -12);
    await bring(sv, feats(sv, "servo-body")[0], feats(br, "servo-slot")[0].wp, 1.0);
    hn = await add("p-servo-horn", 22, -8);
    let r = await bring(hn, feats(hn, "hub")[0], feats(sv, "shaft")[0].wp, 0.3);
    if (r.ok) { engine.holdPress(hn); await run(1.0); engine.releaseOps(); }
    const tc = await add("p-tentacle", 20, -6);
    r = await bring(tc, feats(tc, "arm-mount")[0], feats(hn, "arm-tip")[0].wp, 0.3);
    if (r.ok) { engine.holdPress(tc); await run(1.0); engine.releaseOps(); }
  });
  step("杜邦线插面包板，USB‑C 线插进 Feather", async () => {
    const hole = (n) => feats(bb, "bbhole").find((f) => f.name === n);
    const dm = await add("p-dupont-m1", -6, -17);
    await bring(dm, feats(dm, "dupont-m")[0], hole("a20").wp, 0.3);
    const usb = await add("p-plug-usb-c", -26, 4);
    const port = feats(fe, "port").find((f) => f.kind === "usb-c");
    await bring(usb, feats(usb, "plug")[0], port.wp, 0.1);
    engine.addCable("usb-c", [usb, null], V(-29, 0.3, 0));
    await run(1.5);
  });
  for (let i = 0; i < steps.length; i++) {
    if (stop()) return false;
    say(`第 ${i + 1}/${steps.length} 步：${steps[i].zh}`, i);
    await steps[i].fn();
  }
  return true;
}
