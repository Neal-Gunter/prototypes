// v24（我的补充）：拆焊返修（无浏览器，Node + Rapier）。简化规则，阈值为估算：
//  ① 贴片：SOIC-8 焊在转接板上 → 拆焊模式逐点吸锡 → 芯片和排针全部断开 → 拿下来 → 贴到另一块转接板重焊 → 8 个脚重新导通（netlist 逐脚核对）
//  ② 同一个焊盘拆第 3 次 → 焊盘翘起：开路、检查面板报错、不能再焊；飞线补救后能重焊并导通
//  ③ 一次吸锡加热超过 4 s → 焊盘翘起
//  ④ 直插：Pico 套在排针上焊好 → 拆一个脚：这个脚断开、其它不变 → 重焊恢复；全部拆掉 → 拿下来 → 放回原位重焊 → netlist 和拆之前一样
//  ⑤ 还有焊点时拿不下来；累计受热记录
import fs from "node:fs"; import * as THREE from "three";
globalThis.fetch = async (u) => { const p = new URL("../public" + u, import.meta.url); if (!fs.existsSync(p)) return { ok: false, json: async () => [] }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) }; };
const ENG = await import("../.tmp/eng-bundle.mjs"); const { engine } = ENG;
const X = await import("../.tmp/elec-bundle.mjs");
const C = await import("../.tmp/cat-bundle.mjs");
const BO = await import("../.tmp/bo-bundle.mjs");
await engine.init();
let pass = 0, fail = 0; const rows = [];
const ok = (c, m, info = "") => { c ? pass++ : fail++; rows.push({ ok: !!c, m, info: String(info) }); console.log(c ? "PASS" : "FAIL", m, info); };
const run = async (s) => { for (let i = 0; i < Math.round(s * 120); i++) engine.update(1 / 120); };
const clear = () => { for (const c of [...engine.cables]) engine.removeCable(c.id); for (const u of [...engine.parts.keys()]) if (engine.parts.has(u)) engine.removePart(u); engine.edges = []; engine.history.length = 0; engine.rework.length = 0; };
const msgsOf = () => { const cir = X.buildCircuit(engine); return X.checks(cir, X.solve(cir)).map((c) => c.msg || c.text || JSON.stringify(c)).join(" | "); };
ok(ENG.PAD_REWORK_MAX === 3 && ENG.DESOLDER_OVERHEAT_S === 4, `规则常量：第 ${ENG.PAD_REWORK_MAX} 次拆焊翘起，吸锡超过 ${ENG.DESOLDER_OVERHEAT_S} s 翘起，零件受热提示 ${ENG.PART_HEAT_MAX_S} s（估算）`);
// ---------- ① 贴片返修 + 复用 ----------
const g = BO.SMD_BY_KEY["soic-8"];
const chipId = g.cad?.[0] || "p-smd-soic-8";
clear();
let B = X.makeBuilder(engine, { run });
await B.breadboard("p-breadboard-half", 0, 0, "BB1");
let r1 = null; for (const c of [8, 10]) { try { r1 = await B.breakout("U1", chipId, [1, `b${c}`], [8, `f${c}`]); break; } catch (e) { console.log("retry", c, e.message); } }
const padI = (uid, n) => engine.parts.get(uid).def.anchors.find((a) => a.t === "pad" && a.pkg === "soic-8" && +a.num === n).i;
const conn = (chip, bo) => { const cir = X.buildCircuit(engine); let n = 0; const nets = new Set(); for (let k = 1; k <= 8; k++) { const a = cir.node(`${chip}|s${padI(chip, k)}`); nets.add(a); if (a === cir.node(`${bo}|l${k - 1}`)) n++; } return { n, nets: nets.size }; };
ok(r1 && conn(r1.uid, r1.bo).n === 8, `SOIC-8 焊好：8/8 个脚 → 转接板排针导通`, JSON.stringify(r1 && conn(r1.uid, r1.bo)));
const busy = engine.liftOff(r1.uid);
ok(!busy.ok && busy.left === 8, "还有 8 个焊点时拿不下来", busy.why);
const d1 = engine.desolderAll(r1.uid, { hold: 1.2 });
const c1 = conn(r1.uid, r1.bo);
ok(d1.n === 8 && d1.lifted === 0 && c1.n === 0, `拆焊模式：吸掉 ${d1.n} 个焊点（翘起 ${d1.lifted}），芯片 → 排针 0/8 导通`, JSON.stringify(c1));
ok(/没焊|还没焊/.test(msgsOf()), "检查面板：转接板上的焊盘变成“没焊”");
const h1 = engine.parts.get(r1.uid).state.heat;
ok(h1 > 8 && h1 < 30, `芯片累计受热 ${h1} s（焊 8×0.8 s + 拆 8×1.2 s，估算记录）`);
const lo = engine.liftOff(r1.uid, new THREE.Vector3(12, 1, 10));
await run(0.5);
const cp = engine.worldPose(r1.uid).p;
ok(lo.ok && lo.group.length === 1 && Math.hypot(cp.x - 12, cp.z - 10) < 1, `拿下芯片（只带走芯片本身），放到 (${cp.x.toFixed(1)}, ${cp.z.toFixed(1)})`, lo.why || "");
let bo2 = null; for (const c of [22, 24, 26]) { const r = await B.place("p-bo-soic-8", [[(f) => f.t === "leg" && f.i === 0, B.holeOf(B.S.bb, `b${c}`)], [(f) => f.t === "leg" && f.i === 7, B.holeOf(B.S.bb, `f${c}`)]], { ref: "U2-BO" }); if (r.ok) { bo2 = r.uid; break; } if (r.uid) engine.removePart(r.uid); }
const m2 = bo2 && engine.mountSMD(r1.uid, bo2);
await run(0.2);
ok(m2?.ok && m2.err_mm < 0.1, `同一颗芯片贴到第二块转接板：对位误差 ${m2?.err_mm?.toFixed(3)} mm`, m2?.why || "");
await B.solderLands(bo2);
const c2 = conn(r1.uid, bo2), c2old = conn(r1.uid, r1.bo);
ok(c2.n === 8 && c2.nets === 8 && c2old.n === 0, `重焊后：8/8 个脚 → 新转接板导通、8 个独立网络；旧转接板 0 导通`, JSON.stringify({ c2, c2old }));
const pen1 = engine.overlapTest();
ok(pen1.maxPenetrationMm < 0.1, `复用后不穿模 ${pen1.maxPenetrationMm.toFixed(3)} mm`, pen1.worstPair?.join("/") || "");
// ---------- ② 反复返修 → 焊盘翘起 → 飞线 ----------
const land = (bo, n) => B.feats(bo, "land").find((x) => +x.num === n);
const L1 = land(bo2, 1);
const cyc = [];
for (let k = 0; k < 3; k++) {
  if (k > 0) { const op = engine.holdSolder(land(bo2, 1).wp, { hold: 0.8 }); if (op) engine.finishOpNow(op, 0.8); }
  const op = engine.holdSolder(land(bo2, 1).wp, { desolder: true, hold: 1.2 });
  engine.finishOpNow(op, 1.2);
  cyc.push((engine.parts.get(bo2).state.lifted || []).includes(`t${L1.i}`));
}
ok(cyc.join() === "false,false,true", `同一个焊盘拆 1/2/3 次：翘起 = ${cyc.join("/")}`);
const again = engine.holdSolder(land(bo2, 1).wp, { hold: 0.8 });
ok(again === false, "翘起的焊盘不能再焊");
const cir3 = X.buildCircuit(engine);
ok(cir3.node(`${r1.uid}|s${padI(r1.uid, 1)}`) !== cir3.node(`${bo2}|l0`) && conn(r1.uid, bo2).n === 7, "翘起 = 开路：1 脚断开、其它 7 脚照常导通");
ok(/焊盘翘起/.test(msgsOf()), "检查面板报出“焊盘翘起”", msgsOf().match(/[^|]*翘起[^|]*/)?.[0] || "");
ok(X.jointGrades(engine, bo2).lifted === 1, "焊点统计里有 1 个翘起的焊盘");
ok(engine.repairPad(bo2, `t${L1.i}`), "飞线补救");
{ const op = engine.holdSolder(land(bo2, 1).wp, { hold: 0.8 }); if (op) engine.finishOpNow(op, 0.8); }
ok(conn(r1.uid, bo2).n === 8 && !/焊盘翘起/.test(msgsOf()), "飞线补救后重焊：8/8 导通，不再报翘起");
// ---------- ③ 加热过久 ----------
{
  const op = engine.holdSolder(land(bo2, 2).wp, { desolder: true, hold: 4.5 });
  engine.finishOpNow(op, 4.5);
  const last = engine.rework.at(-1);
  ok(last?.lifted && last.why === "heat" && (engine.parts.get(bo2).state.lifted || []).includes(`t${land(bo2, 2).i}`), `吸锡一次加热 4.5 s：焊盘翘起（第 ${last?.wear} 次拆，原因 ${last?.why}）`);
  ok(conn(r1.uid, bo2).n === 7, "这个脚开路：7/8 导通");
}
// ---------- ④ 直插：Pico ----------
clear();
const rb = await X.buildFromList(engine, X.PRESETS.electrics.text, { run });
await run(0.5);
const pico = [...engine.parts.values()].find((p) => /pico/i.test(p.def.id || ""))?.uid;
const sig = () => { const cir = X.buildCircuit(engine); const by = new Map(); for (const j of cir.joints.filter((j) => j.board === pico)) { const k = `${j.k || "p"}${j.i}`; const q = by.get(k); if (!q || q === "none") by.set(k, j.q); } const v = [...by.values()]; return { good: v.filter((q) => q === "good").length, none: v.filter((q) => q === "none").length, lifted: v.filter((q) => q === "lifted").length, n: v.length }; };
// 网络签名：Pico 每个焊盘 p{i} 所在网络里有哪些面包板孔 / 其它零件端子
const nets = () => { const cir = X.buildCircuit(engine); const pl = new Map(); for (const x of cir.placements) { const k = cir.node(x.term); if (!pl.has(k)) pl.set(k, []); pl.get(k).push(x.hole || `${x.uid}:${x.term}`); } const n = engine.parts.get(pico).def.anchors.filter((a) => a.t === "pinhole").length; const out = []; for (let i = 0; i < n; i++) out.push(`${i}:${(pl.get(cir.node(`${pico}|p${i}`)) || []).sort().join(",")}`); return out.join(";"); };
const s0 = sig(), n0 = nets(), m0 = msgsOf();
ok(rb.fails.length === 0 && pico && s0.good === 40 && n0.split(";").filter((x) => !x.endsWith(":")).length >= 10, `预设“电路练习”：Pico 有 ${s0.good} 个合格焊点`, rb.fails.join(" | "));
const J = engine.jointsOf(pico);
const pin20 = J.find((j) => j.i === 19) || J[0];
{ const op = engine.holdSolder(pin20.wp, { desolder: true, hold: 1.0 }); engine.finishOpNow(op, 1.0); }
const s1 = sig();
ok(s1.good === s0.good - 1 && s1.none === s0.none + 1, `拆 Pico 一个脚：合格 ${s0.good}→${s1.good}，没焊 ${s0.none}→${s1.none}`);
{ const a = n0.split(";")[pin20.i], b = nets().split(";")[pin20.i]; ok(a !== b, `这个脚断开后它的网络变了：${a.slice(0, 40)} → ${b.slice(0, 40) || "（空）"}`); }
{ const op = engine.holdSolder(pin20.wp, { hold: 0.8 }); engine.finishOpNow(op, 0.8); }
ok(nets() === n0 && sig().good === s0.good, "重焊这个脚：网络和拆之前完全一样");
const pose0 = engine.worldPose(pico);
const busy2 = engine.liftOff(pico);
ok(!busy2.ok, "Pico 还焊着：拿不下来", busy2.why);
const d2 = engine.desolderAll(pico, { hold: 1.0 });
ok(d2.n === s0.good && d2.lifted === 0, `拆焊模式：吸掉 Pico 的 ${d2.n} 个焊点，0 个翘起（这个脚第 2 次拆，提示“再拆一次会翘起”）`);
const lo2 = engine.liftOff(pico, pose0.p.clone().add(new THREE.Vector3(0, 4, 0)));
const hdrLeft = [...engine.parts.values()].filter((p) => /pinheader/.test(p.def.id || "") && !lo2.group?.includes(p.uid)).length;
ok(lo2.ok && engine.worldPose(pico).p.y > pose0.p.y + 2 && hdrLeft >= 2, `拿下 Pico（${hdrLeft} 条排针留在面包板上，带走 ${lo2.group?.length} 个零件：Pico 和插在它上面的 USB 线）`, lo2.why || "");
ok(!X.buildCircuit(engine).joints.some((j) => j.board === pico), "拿下后：Pico 没有任何针脚穿在孔里");
await run(0.05);
// 放回：对准原位置，吸附到排针上，再焊
const bid = engine.parts.get(pico).body; const rbd = engine.bodies.get(bid).rb;
rbd.setTranslation({ x: pose0.p.x, y: pose0.p.y + 0.25, z: pose0.p.z }, true); rbd.setRotation({ x: pose0.q.x, y: pose0.q.y, z: pose0.q.z, w: pose0.q.w }, true);
const sn = engine.trySnap(bid, pico);
await run(0.4);
ok(sn?.ok !== false, "放回原来的排针上（吸附）", sn?.why || "");
const B2 = X.makeBuilder(engine, { run });
await B2.solderBoard(pico);
const s3 = sig();
const pinL = (engine.parts.get(pico).state.lifted || []);
ok(s3.good === s0.good && pinL.length === 0, `重焊后：${s3.good} 个合格焊点，翘起 ${pinL.length}`);
ok(nets() === n0, "Pico 复用后：网络和最初完全一样（逐个端子比对）");
const pen2 = engine.overlapTest();
ok(pen2.maxPenetrationMm < 0.1, `直插返修后不穿模 ${pen2.maxPenetrationMm.toFixed(3)} mm`, pen2.worstPair?.join("/") || "");
fs.mkdirSync(process.env.OUT || "/tmp/v24rw", { recursive: true });
fs.writeFileSync((process.env.OUT || "/tmp/v24rw") + "/rework-results.json", JSON.stringify({ pass, fail, rows, rework: engine.rework }, null, 1));
console.log(`rework-test：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
