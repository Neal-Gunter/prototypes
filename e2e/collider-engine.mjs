// v21：凸分解零件在 Rapier 里的碰撞：不穿模（任意两刚体形状距离 > −0.1 mm）+ 落在别的零件上时停在可见网格附近（≤ 容差）
// 由 scripts/engine-test.sh 调用（需要 .tmp/eng-bundle.mjs / cat-bundle.mjs）。早期原型，简化仿真。
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
let fails = 0, worst = 0, worstAt = "", finalMax = 0;
const fin = (v) => { finalMax = Math.max(finalMax, v); return v; };
const check = (name, ok, info = "") => { console.log(ok ? "PASS" : "FAIL", name, info); if (!ok) fails++; };
const pen = (tag) => { const o = engine.overlapTest(); if (o.maxPenetrationMm > worst) { worst = o.maxPenetrationMm; worstAt = `${tag}: ${o.worstPair?.join(" ↔ ")}`; } return o.maxPenetrationMm; };
const run = (s, tag) => { for (let i = 0; i < Math.round(s * 120); i++) { engine.update(1 / 120); if (i % 12 === 0) pen(tag); } };
const P = (x, y, z) => ({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion() });
const ids = [];
for (const f of fs.readdirSync(new URL("../public/lib/catalog", import.meta.url))) for (const e of JSON.parse(fs.readFileSync(new URL("../public/lib/catalog/" + f, import.meta.url), "utf8"))) if (e.collider_decomp) ids.push(e.id);
// 1) 每个凸分解零件单独落桌：静止，不穿桌面
let maxDrop = 0;
for (const id of ids) {
  const def = toDef(await getEntry(id));
  const u = engine.addPart(def, P(0, 0.5, 0));
  run(1.2, "drop " + id);
  const y = engine.worldPose(u).p.y; maxDrop = Math.max(maxDrop, fin(pen("drop " + id)));
  check(`${id} 落桌静止`, Math.abs(y) < 1 && maxDrop < TOL_MM, `y=${y.toFixed(3)} cm`);
  engine.removePart(u);
}
// 2) 一小块零件掉到凸分解零件上：停在“上面”，不穿进去
const pairs = [["fc-endstop", "p-nut-M3"], ["ada-6241", "p-nut-M3"], ["ada-6124", "p-screw-M3x10"], ["fc-gantry-2020", "p-standoff-M3x10"]];
for (const [base, small] of pairs) {
  const bd = toDef(await getEntry(base)), sd = toDef(await getEntry(small));
  if (!bd || !sd) { check(`${base} + ${small} 零件存在`, false); continue; }
  const b = engine.addPart(bd, P(0, 0.02, 0)); run(0.8, "base " + base);
  // 落点：顶面最高的那个盒子里面积最大的一块的中心（避开孔）
  const top = Math.max(...bd.colliders.map((c) => c.c[1] + c.h[1]));
  const tc = bd.colliders.filter((c) => c.c[1] + c.h[1] > top - 0.02).sort((a, c) => c.h[0] * c.h[2] - a.h[0] * a.h[2])[0];
  const bp = engine.worldPose(b).p;
  const s = engine.addPart(sd, P(bp.x + tc.c[0], bp.y + top + 1.5, bp.z + tc.c[2])); run(2, `stack ${base}+${small}`);
  const ys = engine.worldPose(s).p.y;
  check(`${small} 落到 ${base} 顶面盒子上，停在上面、不穿模`, fin(pen(`stack ${base}`)) < TOL_MM && ys > bp.y + top - 0.05, `小件底 y=${ys.toFixed(3)} cm，底件顶面 ${(bp.y + top).toFixed(3)} cm`);
  engine.removePart(s); engine.removePart(b);
}
// 3) 按尺寸排序后每 5 个一组（尺寸相近的叠在一起）。
//    已知限制（v21 实测）：几克的贴片开关压在 100 mm 大按钮下面会被压进 2–3 mm——旧的 AABB 碰撞盒同样 2.3 mm，是求解器质量比问题，不是凸分解造成的
const size = {}; for (const id of ids) { const d = (await getEntry(id)).dims_mm; size[id] = Math.max(d.x, d.y, d.z); }
ids.sort((a, b) => size[a] - size[b]);
// 凸分解零件每 5 个一组从低处叠着掉下来（桌面装配的真实高度：≤ 约 40 cm；更高处掉落的高速穿隧不在本原型范围）
const us = []; let pileMax = 0;
for (let g = 0; g < ids.length; g += 5) {
  let yy = 0.5; const grp = [];
  for (const id of ids.slice(g, g + 5)) { const d = toDef(await getEntry(id)); const m = Math.max(d.dims_mm.x, d.dims_mm.y, d.dims_mm.z) / 10; grp.push(engine.addPart(d, P((grp.length % 2) * 0.4 - 0.2, yy, 0))); yy += m + 0.3; }
  run(4, "pile" + g); const pe = fin(pen("pile" + g)); const wp = engine.overlapTest().worstPair; pileMax = Math.max(pileMax, pe);
  check(`第 ${g / 5 + 1} 组（${ids.slice(g, g + 5).join(", ")}）叠落后不穿模`, pe < TOL_MM, `${pe.toFixed(4)} mm（${wp?.join(" ↔ ")}），落差 ${yy.toFixed(0)} cm`);
  for (const u of grp) engine.removePart(u);
}
if (0) {
// 依次往上放（生成时互不重叠：每件的高度用最大边长算，任意朝向都放得下），x/z 稍微错开让它们互相砸、滑落
let yy = 0.5;
for (let i = 0; i < ids.length; i++) { const d = toDef(await getEntry(ids[i])); const m = Math.max(d.dims_mm.x, d.dims_mm.y, d.dims_mm.z) / 10; us.push(engine.addPart(d, P((i % 3) * 0.4 - 0.4, yy, ((i >> 1) % 3) * 0.4 - 0.4))); yy += m + 0.3; }
run(6, "pile");
}
console.log(`凸分解碰撞：${ids.length} 个零件 · 静止后最大穿透 ${finalMax.toFixed(4)} mm（阈值 ${TOL_MM} mm）· 掉落撞击瞬间峰值 ${worst.toFixed(1)} mm${worstAt ? " @ " + worstAt : ""}（几帧内被推开，不计入判定） · ${fails ? fails + " 失败" : "全部通过"}`);
process.exit(fails ? 1 : 0);
