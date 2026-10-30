// 预设和“从清单导入”共用的搭建器：每个零件先摆到目标正上方 1.5 mm，再走和手动拖放完全相同的
// trySnap（同一套插接规则 + 穿模检查）。焊点也是用同一个 holdSolder 焊出来的。
import * as THREE from "three";
import { getEntry, toDef } from "./catalog.js";
import { boardOf, boardPins, ensureRefs } from "./netlist.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const yawQ = (y) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), y);
const HEADERS = [2, 3, 4, 6, 8, 10, 12, 16, 20, 40];

export function makeBuilder(engine, { run = async () => {}, log = () => {} } = {}) {
  const cache = new Map();
  const def = async (id, flip = false) => {
    const k = id + (flip ? "~f" : "");
    if (!cache.has(k)) {
      const e = await getEntry(id);
      if (!e) throw new Error(`零件库里没有「${id}」`);
      cache.set(k, toDef(e, flip));
    }
    return cache.get(k);
  };
  const feats = (uid, t) => engine.worldFeatures(engine.parts.get(uid).body).filter((f) => f.uid === uid && (!t || f.t === t));
  const localFeats = (d) => {
    const f = [];
    for (const a of d.anchors || []) f.push({ ...a, lp: V(...a.p) });
    for (const l of d.legs || []) f.push({ t: "leg", lp: V(...l.p), top: l.top, i: l.i });
    return f;
  };
  // 脚的“清单顺序”：先按 x、再按 z 排（模型里脚的原始顺序是乱的）。LED：阴极 K、阳极 A；电位器：1、滑片、3；排针：按 z
  const legOrder = (d) => [...(d.legs || [])].map((l, k) => ({ i: l.i ?? k, p: l.p })).sort((a, b) => a.p[0] - b.p[0] || a.p[2] - b.p[2]).map((l) => l.i);
  const bottomLocal = (d) => Math.min(...(d.colliders || []).map((c) => c.c[1] - c.h[1]), 0);
  const holeOf = (bbUid, name) => {
    const f = feats(bbUid, "bbhole").find((h) => h.name === name);
    if (!f) throw new Error(`面包板上没有孔「${name}」`);
    return f.wp;
  };
  const S = { refs: new Map(), bb: null, log: [] };
  const setRef = (uid, ref) => { if (ref) { engine.parts.get(uid).state.ref = ref; S.refs.set(ref, uid); } };

  // pairs: [[局部特征（选择函数或下标）, 世界目标点]]；在 4 个 90° 朝向里选误差最小的
  async function place(id, pairs, { flip = false, ref, yaw: yawHint, state, lift = 0.15, align3d = false } = {}) {
    const d = await def(id, flip);
    const L = localFeats(d);
    const pick = (s) => (typeof s === "function" ? L.find(s) : L[s]);
    const P = pairs.map(([s, tp]) => [pick(s), tp]);
    if (P.some(([f]) => !f)) throw new Error(`「${id}」上找不到要对准的脚/接口`);
    let best = null;
    for (let k = 0; k < 4; k++) {
      const y = yawHint != null ? yawHint : (k * Math.PI) / 2;
      const q = yawQ(y);
      // 最小二乘：让所有脚的平均误差最小（6 mm 按键的脚距 6.5×4.5 mm 本来就和 2.54 网格对不齐，真实中靠脚稍微掰一下）
      const cl = V(0, 0, 0), ct = V(0, 0, 0);
      for (const [f, tp] of P) { cl.add(f.lp.clone().applyQuaternion(q)); ct.add(tp); }
      cl.divideScalar(P.length); ct.divideScalar(P.length);
      const pos = ct.clone().sub(cl);
      let err = 0;
      for (const [f, tp] of P) { const w = f.lp.clone().applyQuaternion(q).add(pos); err = Math.max(err, Math.hypot(w.x - tp.x, w.z - tp.z)); }
      if (!best || err < best.err - 1e-6) best = { y, q, pos, err };
      if (yawHint != null) break;
    }
    if (align3d) best.pos.y = P[0][1].y - P[0][0].lp.clone().applyQuaternion(best.q).y;
    else {
      const maxY = Math.max(...P.map(([, tp]) => tp.y));
      best.pos.y = maxY - bottomLocal(d) + lift;
    }
    const uid = engine.addPart(d, { p: V(best.pos.x, 30, best.pos.z), q: best.q }, { allowOverlap: true, state });
    engine.teleport(uid, best.pos, best.q);
    const r = engine.trySnap(engine.parts.get(uid).body, uid);
    if (!r?.ok) { engine.depenetrate(engine.parts.get(uid).body, 6); S.log.push(`${ref || id}：${r?.why || "没有吸上"}`); }
    setRef(uid, ref);
    await run(0.05);
    return { uid, ok: !!r?.ok, why: r?.why, err: best.err };
  }
  async function free(id, x, z, { ref, yaw = 0, state } = {}) {
    const uid = engine.addPart(await def(id), { p: V(x, 0.05, z), q: yawQ(yaw) }, { state });
    setRef(uid, ref);
    await run(0.2);
    return uid;
  }
  const breadboard = async (id = "p-breadboard-half", x = 0, z = 0, ref = "BB1") => { S.bb = await free(id, x, z, { ref }); await run(0.4); return S.bb; };
  // 板子：两个“脚 → 面包板孔”对应关系确定位置；每一排焊盘下面先插一条长针朝下的排针，再把板子套上去
  async function board(ref, id, a, b, { solder = "all", flux = true, cold = [] } = {}) {
    const d = await def(id);
    const pins = boardPins(d);
    const idx = (n) => { const i = pins.findIndex((p) => p && (p.phys === +n || p.name === n || p.label === n)); if (i < 0) throw new Error(`${ref}：没有「${n}」脚`); return i; };
    const hA = holeOf(S.bb, a[1]), hB = holeOf(S.bb, b[1]);
    const ph = (d.anchors || []).filter((f) => f.t === "pinhole");
    // 先算出板子放好之后每个焊盘落在哪个孔上
    const L = ph.map((f) => V(...f.p));
    let best = null;
    for (let k = 0; k < 4; k++) {
      const q = yawQ((k * Math.PI) / 2);
      const pos = hA.clone().sub(L[idx(a[0])].clone().applyQuaternion(q));
      const w = L[idx(b[0])].clone().applyQuaternion(q).add(pos);
      const e = Math.hypot(w.x - hB.x, w.z - hB.z);
      if (!best || e < best.e) best = { q, pos, e };
    }
    if (best.e > 0.1) throw new Error(`${ref}：${a[0]}=${a[1]} 和 ${b[0]}=${b[1]} 的距离和板子上不一致（差 ${(best.e * 10).toFixed(1)} mm）`);
    const holes = feats(S.bb, "bbhole");
    const under = L.map((lp) => { const w = lp.clone().applyQuaternion(best.q).add(best.pos); return holes.find((h) => Math.hypot(h.wp.x - w.x, h.wp.z - w.z) < 0.08); });
    // 按排分组（同一条直线、相邻）
    const rows = new Map();
    under.forEach((h, i) => { if (!h) return; const r = h.name.replace(/\d+$/, ""); if (!rows.has(r)) rows.set(r, []); rows.get(r).push({ i, h, c: +h.name.match(/\d+$/)[0] }); });
    const headers = [];
    for (const [r, list] of rows) {
      list.sort((x, y) => x.c - y.c);
      const n = list.length;
      const hn = HEADERS.find((k) => k >= n) || 40;
      if (hn !== n) throw new Error(`${ref}：${r} 排有 ${n} 个焊盘，库里没有 1x${n} 排针`);
      const hid = `kc-pinheader_1x${String(n).padStart(2, "0")}_p2.54mm_vertical`;
      const hd = await def(hid, true), ord = legOrder(hd);
      const res = await place(hid, [[(f) => f.t === "leg" && f.i === ord[0], list[0].h.wp], [(f) => f.t === "leg" && f.i === ord[n - 1], list[n - 1].h.wp]], { flip: true, ref: `J${headers.length + 1}${ref}` });
      headers.push(res.uid);
    }
    // 板子：焊盘孔对准排针的针尖
    const pinUp = (uid) => feats(uid, "pin-up");
    const ups = headers.flatMap(pinUp);
    const tgt = (i) => { const w = L[i].clone().applyQuaternion(best.q).add(best.pos); const u = ups.find((f) => Math.hypot(f.wp.x - w.x, f.wp.z - w.z) < 0.1); return u ? u.wp : w; };
    const res = await place(id, [[(f) => f.t === "pinhole" && f.i === ph[idx(a[0])].i, tgt(idx(a[0]))], [(f) => f.t === "pinhole" && f.i === ph[idx(b[0])].i, tgt(idx(b[0]))]], { ref, lift: 0.4 });
    await run(0.3);
    if (res.ok && solder) {
      // cold: 物理脚号列表 → 这些点不涂助焊剂、加热时间不够（虚焊）
      const plan = solder === "all" && !cold?.length ? "all" : pins.map((p) => (cold?.includes(p?.phys) ? "cold" : solder === false ? "skip" : "good"));
      await solderBoard(res.uid, plan, flux);
    }
    return res;
  }
  // solder: "all" | 数组（每个下标对应质量："good" | "cold" | "skip"），按焊盘顺序
  async function solderBoard(uid, solder = "all", flux = true) {
    const ph = feats(uid, "pinhole");
    for (let i = 0; i < ph.length; i++) {
      const want = Array.isArray(solder) ? solder[i] || "good" : solder === "all" ? "good" : "skip";
      if (want === "skip") continue;
      const hasPin = engine.findSolderJoint(ph[i].wp);
      if (!hasPin) continue;
      const hold = want === "cold" ? 0.9 : flux ? 0.8 : 1.6;
      engine.finishOpNow(engine.holdSolder(ph[i].wp, { flux: want === "cold" ? false : flux, hold }), hold);
    }
    engine.toast(`${engine.parts.get(uid).state.ref || ""} 焊完 ${(engine.parts.get(uid).state.solder || []).length} 个点`, "ok");
  }
  // v23（我的补充）：贴片芯片 → 转接板。a/b：两个“排针号 → 面包板孔”（定位转接板）；芯片按焊盘号贴到转接板上，再逐个焊
  //   plan：{ cold: [焊盘号], bridge: [焊盘号], skip: [焊盘号] }（演示虚焊 / 连锡）
  async function breakout(ref, chipId, a, b, { solder = true, cold = [], bridge = [], skip = [] } = {}) {
    const cd = await def(chipId);
    if (!cd.smdPkg) throw new Error(`${ref}：「${chipId}」不是贴片封装（直插件直接插面包板）`);
    const boId = `p-bo-${cd.smdPkg}`;
    const ia = +a[0] - 1, ib = +b[0] - 1;
    const bo = await place(boId, [[(f) => f.t === "leg" && f.i === ia, holeOf(S.bb, a[1])], [(f) => f.t === "leg" && f.i === ib, holeOf(S.bb, b[1])]], { ref: `${ref}-BO` });
    if (!bo.ok || bo.err > 0.05) { engine.removePart(bo.uid); throw new Error(`${ref}：转接板没插进面包板（${bo.err > 0.05 ? `${a[0]} 脚和 ${b[0]} 脚的孔距和转接板差 ${(bo.err * 10).toFixed(1)} mm` : bo.why || "对不上孔"}）`); }
    { const lg = feats(bo.uid, "leg"), ha = holeOf(S.bb, a[1]), hb = holeOf(S.bb, b[1]); const la = lg.find((f) => f.i === ia), lb = lg.find((f) => f.i === ib);
      const e = Math.max(Math.hypot(la.wp.x - ha.x, la.wp.z - ha.z), Math.hypot(lb.wp.x - hb.x, lb.wp.z - hb.z));
      if (e > 0.05) { engine.removePart(bo.uid); throw new Error(`${ref}：转接板吸到了别的孔上（偏 ${(e * 10).toFixed(1)} mm）`); } }
    const bw = engine.worldPose(bo.uid).p;
    const chip = engine.addPart(cd, { p: V(bw.x + 4, 0.3, bw.z), q: yawQ(0) }, { allowOverlap: true });
    await run(0.1);
    setRef(chip, ref);
    const m = engine.mountSMD(chip, bo.uid);
    if (!m.ok) throw new Error(`${ref}：${m.why}`);
    await run(0.1);
    if (solder) await solderLands(bo.uid, { cold, bridge, skip });
    return { uid: chip, bo: bo.uid, err_mm: m.err_mm };
  }
  async function solderLands(boUid, { cold = [], bridge = [], skip = [], flux = true } = {}) {
    const lands = feats(boUid, "land");
    for (const f of lands) {
      const n = +f.num;
      if (skip.includes(n)) continue;
      const want = cold.includes(n) ? "cold" : bridge.includes(n) ? "bridge" : "good";
      const hold = want === "cold" ? 0.9 : want === "bridge" ? 2.6 : 0.8;
      const op = engine.holdSolder(f.wp, { flux: want === "good" ? flux : false, hold });
      if (op) engine.finishOpNow(op, hold);
    }
  }
  // 两脚/多脚元件：holes 按脚的顺序
  async function part(ref, id, holes, opts = {}) {
    const d = await def(id);
    const ord = legOrder(d);
    if (holes.length !== ord.length) throw new Error(`${ref}：${d.name_zh || id} 有 ${ord.length} 个脚，清单里写了 ${holes.length} 个孔`);
    const legs = ord.map((li, k) => [(f) => f.t === "leg" && f.i === li, holeOf(S.bb, holes[k])]);
    if (legs.length < Math.min(2, (d.legs || []).length)) throw new Error(`${ref}：脚的数量和孔的数量对不上`);
    return place(id, legs, { ref, ...opts });
  }
  async function jumper(ref, h1, h2, color) {
    const a = holeOf(S.bb, h1), b = holeOf(S.bb, h2);
    const n = Math.round(a.distanceTo(b) / 0.254);
    if (Math.abs(a.distanceTo(b) - n * 0.254) > 0.05 || ![1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].includes(n)) throw new Error(`${ref}：${h1}–${h2} 不是成套跳线的长度（${n} 格）`);
    return place(`p-jumper-${n}`, [[(f) => f.t === "leg" && f.i === 0, a], [(f) => f.t === "leg" && f.i === 1, b]], { ref, state: color ? { color } : undefined });
  }
  // 杜邦线：端点是面包板孔（公头）或 “J1U1:3” 这种排针脚（母头）
  async function wire(ref, kind, e1, e2) {
    const end = async (e, k) => {
      if (/^[a-j]\d+$|^[+-]?[A-Za-z]*\d+$/.test(e) && !e.includes(":")) {
        return (await place("p-dupont-m1", [[(f) => f.t === "dupont-m", holeOf(S.bb, e)]], { ref: `${ref}${k}` })).uid;
      }
      const [h, n] = e.split(":");
      const hu = S.refs.get(h);
      if (!hu) throw new Error(`${ref}：找不到排针 ${h}`);
      const up = feats(hu, "pin-up").sort((x, y) => x.lp.z - y.lp.z || x.lp.x - y.lp.x)[+n - 1];
      if (!up) throw new Error(`${ref}：${h} 没有第 ${n} 针`);
      return (await place("p-dupont-f1", [[(f) => f.t === "dupont-f", up.wp]], { ref: `${ref}${k}`, lift: 0.3 })).uid;
    };
    const a = await end(e1, "a"), b = await end(e2, "b");
    engine.addCable(kind, [a, b]);
    await run(0.4);
    return [a, b];
  }
  async function usb(boardRef) {
    const u = S.refs.get(boardRef);
    if (!u) throw new Error(`USB：找不到板子 ${boardRef}`);
    const port = feats(u, "port").find((f) => /usb/.test(f.kind));
    if (!port) throw new Error(`${boardRef} 没有 USB 口`);
    const dirW = V(...(port.dir || [0, 0, -1])).applyQuaternion(engine.worldPose(u).q).setY(0).normalize();
    const r = await place(`p-plug-${port.kind}`, [[(f) => f.t === "plug", port.wp.clone().addScaledVector(dirW, 0.8)]], { ref: `USB${boardRef}`, align3d: true });
    const far = port.wp.clone().addScaledVector(dirW, 8).setY(0.3);
    far.x = Math.max(-28, Math.min(28, far.x));
    far.z = Math.max(-18, Math.min(18, far.z));
    engine.addCable(port.kind, [r.uid, null], far);
    await run(0.6);
    return r;
  }
  // 舵机：摆在桌上 (x,z)，一条 3 针排针插面包板，舵机引线的 3 针母头套上去
  async function servo(ref, id, x, z, holes) {
    const sv = await free(id, x, z, { ref });
    const o3 = legOrder(await def("kc-pinheader_1x03_p2.54mm_vertical", true));
    const hd = await place("kc-pinheader_1x03_p2.54mm_vertical", [[(f) => f.t === "leg" && f.i === o3[0], holeOf(S.bb, holes[0])], [(f) => f.t === "leg" && f.i === o3[2], holeOf(S.bb, holes[2])]], { flip: true, ref: `J${ref}` });
    const ups = feats(hd.uid, "pin-up");
    const h0 = holeOf(S.bb, holes[0]);
    ups.sort((p, q) => p.wp.distanceTo(h0) - q.wp.distanceTo(h0));
    const f3 = await place("p-dupont-f3", [[(f) => f.t === "dupont-f" && f.k === 0, ups[0].wp], [(f) => f.t === "dupont-f" && f.k === 2, ups[2].wp]], { ref: `P${ref}`, lift: 0.3 });
    engine.addCable("servo-lead", [sv, f3.uid]);
    await run(0.5);
    return sv;
  }
  return { def, feats, place, free, breadboard, board, part, jumper, wire, usb, servo, solderBoard, breakout, solderLands, S, holeOf, done: () => ensureRefs(engine) };
}

// ---------------- 预设 ----------------
const BASE = `# 早期原型，简化仿真。每行一个零件；这张清单可以复制、修改后粘贴到“导入”里重建
# 面包板孔名：a–j 行 + 1–30 列（a–e 一组、f–j 一组，同一列 5 个孔导通）
面包板 BB1 p-breadboard-half 0,-4
# Pico 跨在中间槽上：1 脚在 h1，20 脚在 h20（21–40 脚落在 c20…c1）
板子 U1 kc-raspberrypi_pico 1脚=h1 20脚=h20{COLD}
# LED 电路：GP15(20脚) → 220Ω → LED 阳极；LED 阴极 → 杜邦线 → GND(18脚)
零件 R1 kc-r_axial_din0207_l6.3mm_d2.5mm_p10.16mm_horizontal i20 i24
零件 D1 kc-led_d5.0mm {LED}   # 孔按脚的顺序：阴极K（短脚） 阳极A（长脚）
导线 W1 dupont-mm j25 j18
# 按键：一对脚在 f27/i27、另一对在 f29/i29；按下时 27 列和 29 列接通。GP14(19脚) 用内部上拉
零件 SW1 kc-sw_push_6mm f27 f29 i27 i29   # 4 个脚的顺序：先左后右、先上后下（左上、左下、右上、右下）
导线 W2 dupont-mm j27 j19
导线 W3 dupont-mm j29 j13
# 电位器：两端接 GND(38脚) 和 3V3(36脚)，滑片接 GP26/ADC0(31脚)
零件 RV1 kc-potentiometer_bourns_3386w_horizontal a26 a27 a28
导线 W4 dupont-mm c26 a3
导线 W5 dupont-mm c27 a10
导线 W6 dupont-mm c28 a5
# 舵机：3 针排针插 d22–d24，舵机线母头套上去；棕 GND→23脚、红 VCC→VBUS(40脚, USB 5V)、橙 SIG→GP16(21脚)
舵机 M1 ada-1143 14,2 d22,d23,d24
导线 W7 dupont-mm b22 a18
导线 W8 dupont-mm b23 a1
导线 W9 dupont-mm b24 a20
USB U1`;
// v23（我的补充）：贴片转接板练习——三种贴片芯片先焊到转接板，再按 DIP 插面包板；TSSOP 故意留一个虚焊、一个连锡给检查面板找
const SMD_LIST = `# 早期原型，简化仿真。贴片芯片 → 转接板 → 面包板
面包板 BB1 p-breadboard-half 0,-4
# TSSOP-16（0.65 mm 间距）：转接板两排 15.24 mm，跨中间槽插 b/f 两排；3 脚虚焊、6 脚连锡（演示）
转接板 U1 kc-tssop-16_4.4x5mm_p0.65mm 1脚=b9 16脚=f9 虚焊=3 连锡=6
# SOIC-8（1.27 mm）：焊盘外沿 6.9 mm，放不进 7.62 mm 两排之间，所以转接板两排 15.24 mm，插 b/f
转接板 U2 p-smd-soic-8 1脚=b15 8脚=f15
# SOT-23（3 脚）：3 脚在 1 脚对面
转接板 Q1 kc-sot-23 1脚=e20 3脚=f20
# 0805 电阻：两个焊盘 → 两根针
转接板 R1 kc-r_0805_2012metric 1脚=e25 2脚=f25`;
export const PRESETS = {
  electrics: { zh: "电路练习：Pico + LED + 按键 + 电位器 + 舵机", text: BASE.replace("{COLD}", "").replace("{LED}", "g25 g24") },
  fault: { zh: "排错练习：有 1 个虚焊、1 个装反的零件", text: BASE.replace("{COLD}", " 虚焊=20").replace("{LED}", "g24 g25") },
};
// 文本清单 → 步骤；每行一个零件。“#” 后面是注释
PRESETS.smd = { zh: "贴片转接板练习：TSSOP-16 + SOIC-8 + SOT-23 + 0805", text: SMD_LIST };
export function parseList(text) {
  const steps = [], errors = [];
  text.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) return;
    const t = line.split(/\s+/);
    const kw = t[0];
    const bad = (m) => errors.push(`第 ${n + 1} 行：${m}`);
    if (kw === "面包板") { const [x, z] = (t[3] || "0,0").split(",").map(Number); steps.push({ k: "bb", ref: t[1], id: t[2], x, z }); }
    else if (kw === "板子") { const kv = t.slice(3).map((s) => s.split("=")); if (kv.length < 2) return bad("板子需要两个“脚=孔”，例如 1脚=h1 20脚=h20"); const cold = (kv.find((x) => x[0] === "虚焊")?.[1] || "").split(",").filter(Boolean).map(Number); steps.push({ k: "board", ref: t[1], id: t[2], a: [kv[0][0].replace(/脚$/, ""), kv[0][1]], b: [kv[1][0].replace(/脚$/, ""), kv[1][1]], solder: t.includes("不焊") ? false : "all", cold }); }
    else if (kw === "转接板") { const kv = t.slice(3).filter((x) => x.includes("=")).map((s) => s.split("=")); if (kv.length < 2) return bad("转接板需要两个“排针=孔”，例如 1脚=e10 16脚=f10"); const L = (k) => (kv.find((x) => x[0] === k)?.[1] || "").split(",").filter(Boolean).map(Number); steps.push({ k: "breakout", ref: t[1], id: t[2], a: [kv[0][0].replace(/脚$/, ""), kv[0][1]], b: [kv[1][0].replace(/脚$/, ""), kv[1][1]], solder: !t.includes("不焊"), cold: L("虚焊"), bridge: L("连锡") }); }
    else if (kw === "零件") { if (t.length < 5) return bad("零件需要：编号 零件id 孔1 孔2 …"); steps.push({ k: "part", ref: t[1], id: t[2], holes: t.slice(3) }); }
    else if (kw === "跳线") steps.push({ k: "jumper", ref: t[1], a: t[2], b: t[3] });
    else if (kw === "导线") steps.push({ k: "wire", ref: t[1], kind: t[2], a: t[3], b: t[4] });
    else if (kw === "舵机") { const [x, z] = t[3].split(",").map(Number); steps.push({ k: "servo", ref: t[1], id: t[2], x, z, holes: t[4].split(",") }); }
    else if (kw === "USB" || kw === "usb") steps.push({ k: "usb", ref: t[1] });
    else bad(`看不懂“${kw}”（可用：面包板 / 板子 / 转接板 / 零件 / 跳线 / 导线 / 舵机 / USB）`);
  });
  return { steps, errors };
}
export async function buildFromList(engine, text, opts = {}) {
  const { steps, errors } = parseList(text);
  const B = makeBuilder(engine, opts);
  const fails = [...errors];
  for (const s of steps) {
    if (opts.stop?.()) break;
    opts.say?.(`${s.ref || ""} ${s.k}`);
    try {
      if (s.k === "bb") await B.breadboard(s.id, s.x, s.z, s.ref);
      else if (!B.S.bb && s.k !== "usb") throw new Error("请先放面包板");
      else if (s.k === "board") await B.board(s.ref, s.id, s.a, s.b, { solder: s.solder, cold: s.cold });
      else if (s.k === "part") await B.part(s.ref, s.id, s.holes);
      else if (s.k === "breakout") await B.breakout(s.ref, s.id, s.a, s.b, { solder: s.solder, cold: s.cold, bridge: s.bridge });
      else if (s.k === "jumper") await B.jumper(s.ref, s.a, s.b);
      else if (s.k === "wire") await B.wire(s.ref, s.kind, s.a, s.b);
      else if (s.k === "servo") await B.servo(s.ref, s.id, s.x, s.z, s.holes);
      else if (s.k === "usb") await B.usb(s.ref);
    } catch (e) { fails.push(`${s.ref || s.k}：${e.message}`); }
  }
  B.done();
  return { B, fails: [...fails, ...B.S.log], steps };
}
