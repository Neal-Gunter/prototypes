// v23：贴片 → 转接板 → 排针 → 面包板（无浏览器，Node + Rapier）
//  ① 13 种封装的焊盘来自 KiCad 官方封装库（固定提交），转接板焊盘 = 芯片焊盘（逐个 ≤ 0.01 mm）
//  ② 每种封装：转接板插面包板、芯片贴上去（对位误差 < 0.1 mm）、全部焊好 → 每个芯片焊盘都和它下面那一列面包板孔同一个网络、彼此不短路、不穿模
//  ③ 虚焊 = 开路、连锡 = 和相邻焊盘短路，检查面板会说出来；拆焊重焊后恢复
//  ④ 1 脚方向反了吸不上（提示方向不对）；同一块转接板不能贴两颗
//  ⑤ L298N（Multiwatt15）标明是直插件
import fs from "node:fs"; import * as THREE from "three";
globalThis.fetch = async (u) => { const p = new URL("../public" + u, import.meta.url); if (!fs.existsSync(p)) return { ok: false, json: async () => [] }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) }; };
const { engine } = await import("../.tmp/eng-bundle.mjs");
const X = await import("../.tmp/elec-bundle.mjs");
const C = await import("../.tmp/cat-bundle.mjs");
const BO = await import("../.tmp/bo-bundle.mjs");
await engine.init();
let pass = 0, fail = 0; const rows = [];
const ok = (c, m, info = "") => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", m, info); };
const run = async (s) => { for (let i = 0; i < Math.round(s * 120); i++) engine.update(1 / 120); };
const clear = () => { for (const c of [...engine.cables]) engine.removeCable(c.id); for (const u of [...engine.parts.keys()]) if (engine.parts.has(u)) engine.removePart(u); engine.edges = []; engine.history.length = 0; };
const { SMD_PKGS, SMD_BY_KEY, headerLayout, KICAD_SHA } = BO;
ok(SMD_PKGS.length >= 13 && /^[0-9a-f]{40}$/.test(KICAD_SHA), `封装数 ${SMD_PKGS.length}，KiCad 封装库提交 ${KICAD_SHA.slice(0, 8)}`);
// ① 芯片焊盘 ↔ 转接板焊盘
const chipOf = (g) => g.cad?.[0] || `p-smd-${g.key}`;
for (const g of SMD_PKGS) {
  const e = await C.getEntry(chipOf(g)), b = await C.getEntry(`p-bo-${g.key}`);
  if (!e || !b) { ok(false, `${g.key}：目录里有芯片和转接板`, `${!!e}/${!!b}`); continue; }
  const cd = C.toDef(e), bd = C.toDef(b);
  const pads = cd.anchors.filter((a) => a.t === "pad" && a.pkg === g.key), lands = bd.anchors.filter((a) => a.t === "land");
  ok(pads.length === g.N && lands.length === g.N, `${g.key}：芯片 ${pads.length} 个焊盘 / 转接板 ${lands.length} 个焊盘 = ${g.N}`);
  // 芯片焊盘相对 1 脚 vs 转接板焊盘相对 1 脚
  const rel = (L) => { const p1 = L.find((a) => +a.num === 1).p; return new Map(L.map((a) => [+a.num, [a.p[0] - p1[0], a.p[2] - p1[2]]])); };
  const A = rel(pads), B = rel(lands); let mx = 0;
  for (const [n, v] of A) { const w = B.get(n); mx = Math.max(mx, w ? Math.hypot(v[0] - w[0], v[1] - w[1]) * 10 : 99); }
  ok(mx <= 0.01, `${g.key}：焊盘图形一致（最大差 ${mx.toFixed(4)} mm），间距 ${g.pitch} mm`);
  const hl = headerLayout(g);
  ok([7.62, 15.24].some((v) => Math.abs(hl.S - v) < 0.01) && (g.N <= 16 || hl.S > 10), `${g.key}：排针 ${g.N} 针，两排间距 ${hl.S.toFixed(2)} mm（DIP 0.3″ / 0.6″，2.54 mm 网格）`);
}
// ② 每种封装插面包板 + 贴片 + 焊
const BB = (S) => (S > 10 ? ["b", "f"] : ["e", "f"]); // S：mm
const results = [];
for (const g of SMD_PKGS) {
  clear();
  const B = X.makeBuilder(engine, { run });
  await B.breadboard("p-breadboard-half", 0, 0, "BB1");
  const hl = headerLayout(g); const n = Math.ceil(g.N / 2); const [r1, r2] = BB(hl.S);
  let res = null, err = null;
  // 从 1 脚往列号变小的方向排（转接板 1 脚在左上）
  for (const c of [Math.max(n + 1, 3), 29]) {
    try { res = await B.breakout("U1", chipOf(g), [1, `${r1}${c}`], [g.N, `${r2}${c}`]); break; } catch (e) { err = e.message; if (process.env.DBG) console.log("retry", g.key, c, err); clear(); await B.breadboard("p-breadboard-half", 0, 0, "BB1"); }
  }
  if (!res) { ok(false, `${g.key}：转接板插上 + 贴片`, err); continue; }
  if (process.env.DBG) console.log("pre", g.key, X.buildCircuit(engine).placements.filter((p) => p.uid === res.bo).map((p) => p.hole).join(","));
  await run(0.3);
  const cir = X.buildCircuit(engine);
  if (process.env.DBG) console.log("post", g.key, cir.placements.filter((p) => p.uid === res.bo).map((p) => p.hole).join(","));
  const nets = []; let conn = 0;
  for (let i = 0; i < g.N; i++) {
    const pad = engine.parts.get(res.uid).def.anchors.find((a) => a.t === "pad" && a.pkg === g.key && +a.num === i + 1);
    const pl = cir.placements.find((p) => p.uid === res.bo && p.term === `${res.bo}|l${i}`);
    const a = cir.node(`${res.uid}|s${pad.i}`), b = pl && cir.node(pl.term);
    if (pl && a === b && cir.node(`${pl.at}|n:${engine.worldFeatures(engine.parts.get(pl.at).body).find((h) => h.t === "bbhole" && h.name === pl.hole).net}`) === a) conn++;
    nets.push(a); if (process.env.DBG) console.log(g.key, i, pad.i, a, b);
  }
  const pen = engine.overlapTest();
  const gr = X.jointGrades(engine, res.bo);
  ok(res.err_mm < 0.1, `${g.key}：贴片对位误差 ${res.err_mm.toFixed(3)} mm`);
  ok(conn === g.N && new Set(nets).size === g.N, `${g.key}：${conn}/${g.N} 个焊盘 → 转接板 → 排针 → 面包板列 导通，${new Set(nets).size} 个独立网络`, JSON.stringify(gr));
  ok(pen.maxPenetrationMm < 0.1, `${g.key}：不穿模 ${pen.maxPenetrationMm.toFixed(3)} mm`, pen.worstPair?.join("/") || "");
  results.push({ key: g.key, N: g.N, pitch: g.pitch, err_mm: +res.err_mm.toFixed(3), conn, pen_mm: +pen.maxPenetrationMm.toFixed(3) });
}
// ③ 虚焊 / 连锡
{
  clear(); const B = X.makeBuilder(engine, { run }); await B.breadboard("p-breadboard-half", 0, 0, "BB1");
  const g = SMD_BY_KEY["tssop-16"];
  let res; for (const c of [12, 28]) { try { res = await B.breakout("U1", chipOf(g), [1, `b${c}`], [16, `f${c}`], { cold: [3], bridge: [6] }); break; } catch (e) { console.log("TSSOP retry", c, e.message); clear(); await B.breadboard("p-breadboard-half", 0, 0, "BB1"); } }
  const cir = X.buildCircuit(engine); const sol = X.solve(cir);
  const pad = (n) => engine.parts.get(res.uid).def.anchors.find((a) => a.t === "pad" && a.pkg === "tssop-16" && +a.num === n).i;
  const hdr = (n) => `${res.bo}|l${n - 1}`;
  const gr = X.jointGrades(engine, res.bo);
  ok(gr.cold >= 1 && gr.bridge >= 1, `TSSOP-16 演示：焊点等级 ${JSON.stringify(gr)}`);
  ok(cir.node(`${res.uid}|s${pad(3)}`) !== cir.node(hdr(3)), "虚焊的 3 脚：芯片 → 排针 不通（开路）");
  ok(X.meter(cir, sol, `${res.uid}|s${pad(3)}`, hdr(3), "beep").beep !== true, "万用表蜂鸣档量 3 脚：不响");
  const bridged = [5, 7].filter((m) => cir.node(hdr(6)) === cir.node(hdr(m)));
  ok(bridged.length >= 1, `连锡的 6 脚：和相邻 ${bridged.join(",")} 脚短路`);
  const msgs = X.checks(cir, sol).map((c) => c.msg || c.text || JSON.stringify(c)).join(" | ");
  ok(/虚焊|没焊|不导通/.test(msgs) && /连锡|短路/.test(msgs), "检查面板报出虚焊 + 连锡", msgs.slice(0, 160));
  // 拆焊重焊：吸锡后用助焊剂重新焊
  for (const n of [3, 6]) { const f = B.feats(res.bo, "land").find((x) => +x.num === n); engine.finishOpNow(engine.holdSolder(f.wp, { desolder: true, hold: 1.5 }), 1.5); }
  await B.solderLands(res.bo, { skip: Array.from({ length: 16 }, (_, k) => k + 1).filter((k) => k !== 3 && k !== 6) });
  const c2 = X.buildCircuit(engine); const g2 = X.jointGrades(engine, res.bo);
  ok(c2.node(`${res.uid}|s${pad(3)}`) === c2.node(hdr(3)) && c2.node(hdr(6)) !== c2.node(hdr(5)) && c2.node(hdr(6)) !== c2.node(hdr(7)), `拆焊重焊后：3 脚导通、6 脚不再短路`, JSON.stringify(g2));
  // 杜邦母头插转接板上针
  const ups = B.feats(res.bo, "pin-up");
  ok(ups.length === 16, `转接板有 16 根朝上的排针（可插杜邦母头），${ups.length}`);
  const f = await B.place("p-dupont-f1", [[(x) => x.t === "dupont-f", ups.find((u) => u.i === 0).wp]], { lift: 0.3 });
  const c3 = X.buildCircuit(engine);
  ok(f.ok && c3.node(`${f.uid}|c0`) === c3.node(`${res.uid}|s${pad(1)}`), "杜邦母头套在 1 号针上 → 和芯片 1 脚导通", f.why || "");
  // ④ 同一块板不能贴第二颗；方向反了吸不上
  const d2 = C.toDef(await C.getEntry(chipOf(g)));
  const u2 = engine.addPart(d2, { p: new THREE.Vector3(10, 0.3, 10), q: new THREE.Quaternion() }, { allowOverlap: true });
  const m2 = engine.mountSMD(u2, res.bo);
  ok(!m2.ok, "已经贴了芯片的转接板不能再贴第二颗", m2.why || "");
  engine.removePart(u2);
}
{
  clear(); const B = X.makeBuilder(engine, { run }); await B.breadboard("p-breadboard-half", 0, 0, "BB1");
  const g = SMD_BY_KEY["soic-8"];
  let bo; for (const c of [8, 28]) { bo = await B.place("p-bo-soic-8", [[(f) => f.t === "leg" && f.i === 0, B.holeOf(B.S.bb, `e${c}`)], [(f) => f.t === "leg" && f.i === 7, B.holeOf(B.S.bb, `f${c}`)]]); if (bo.ok) break; }
  const d = C.toDef(await C.getEntry(chipOf(g)));
  const lands = B.feats(bo.uid, "land"); const cen = lands.reduce((s, f) => s.add(f.wp.clone()), lands[0].wp.clone().multiplyScalar(0)).multiplyScalar(1 / lands.length);
  const q = engine.worldPose(bo.uid).q.clone();
  const flipQ = q.clone().multiply(new THREE.Quaternion(0, 1, 0, 0));
  const u = engine.addPart(d, { p: new THREE.Vector3(cen.x, cen.y + 0.4, cen.z), q: flipQ }, { allowOverlap: true });
  const r = engine.trySnap(engine.parts.get(u).body, u);
  ok(!r?.ok && /方向/.test(r?.why || ""), "芯片转 180° 放上去：吸不上，提示 1 脚方向", r?.why || "");
  const m = engine.mountSMD(u, bo.uid);
  ok(m.ok && m.err_mm < 0.1, `用“贴到转接板上”自动摆正：误差 ${m.err_mm?.toFixed(3)} mm`);
}
// ⑤ L298N
{
  const e = await C.getEntry("p-fp-l298n-ic"); const d = e && C.toDef(e);
  ok(d && /Multiwatt15/.test(d.mountNote || "") && /直插/.test(JSON.stringify(d.spec || d.est || "")), "L298N 芯片标明：直插 Multiwatt15，不是贴片、不能直接插面包板", (d?.mountNote || "").slice(0, 40));
  ok(d && !d.smdPkg, "L298N 不提供贴片转接板（直插件）");
}
fs.mkdirSync(process.env.OUT || "/tmp/v23bo", { recursive: true });
fs.writeFileSync((process.env.OUT || "/tmp/v23bo") + "/breakout-results.json", JSON.stringify({ results, pass, fail }, null, 1));
console.log(`breakout-test：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
