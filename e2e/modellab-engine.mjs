// v11：上传的模型（自制小车 GLB、STL 两块）进装配台引擎：落到桌面上、和桌面有接触、不穿模（> -0.1 mm）
import fs from "node:fs";
import * as THREE from "three";
globalThis.fetch = async () => ({ ok: false, json: async () => [] });
const { engine } = await import("../.tmp/eng-bundle.mjs");
const { parseModel } = await import("../src/modellab/load.js");
const { autoSplit, splitConnected, modelXform, engineDefs, mkModule } = await import("../src/modellab/modules.js");
await engine.init();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m); } };
const ab = (f) => { const b = fs.readFileSync("e2e/fixtures/v11/" + f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const run = (s) => { let worst = 0; for (let i = 0; i < Math.round(s * 120); i++) { engine.update(1 / 120); if (i % 12 === 0) worst = Math.max(worst, engine.overlapTest().maxPenetrationMm); } return worst; };
const lowest = (uid, def) => {
  const w = engine.worldPose(uid); let lo = Infinity;
  for (const c of def.colliders) { const h = c.hull; if (!h) continue; for (let i = 0; i < h.length; i += 3) lo = Math.min(lo, new THREE.Vector3(h[i] + c.c[0], h[i + 1] + c.c[1], h[i + 2] + c.c[2]).applyQuaternion(w.q).add(w.p).y); }
  return lo;
};

// 1) 小车：整体一个刚体，从 3 cm 高处落下
const g = await parseModel(ab("sample-rover.glb"), "sample-rover.glb");
const sp = autoSplit(g.meshes);
const X = modelXform(g.meshes, { units: "m" });
const P = { modules: sp.modules.map((m) => ({ ...m, collider: "hull", material: m.name.includes("轮") ? "rubber" : "pla" })) };
const defs = engineDefs(P, new Map(g.meshes.map((m) => [m.id, m])), X.M, "rover");
const uids = engine.addAssembly(defs.map((d) => ({ def: d, p: new THREE.Vector3(-10, 3, 0), q: new THREE.Quaternion(), label: d.name_zh })), { why: "上传模型整体" });
const worst1 = run(2.5);
const o1 = engine.overlapTest();
const lo = Math.min(...uids.map((u, i) => lowest(u, defs[i])));
const rb = engine.bodies.get(engine.parts.get(uids[0]).body).rb;
const v = rb.linvel();
ok(o1.contacts > 0, `小车和桌面有接触（${o1.contacts} 对）`);
ok(worst1 < 0.1, `落下过程中最大穿模 ${worst1} mm < 0.1 mm`);
ok(Math.abs(lo) < 0.05, `最低点 y = ${(lo * 10).toFixed(3)} mm（贴在桌面上，没有掉下去）`);
ok(Math.hypot(v.x, v.y, v.z) < 0.5, `静止下来（速度 ${Math.hypot(v.x, v.y, v.z).toFixed(3)} cm/s）`);
const mass = rb.mass();
const sum = defs.reduce((s, d) => s + d.colliders[0].m, 0);
ok(Math.abs(mass - sum) < 0.01 * sum, `刚体质量 ${mass.toFixed(1)} g = 各模块估算之和 ${sum.toFixed(1)} g`);

// 2) STL 两块：按连通块拆成两个模块，各自一个刚体，放在小车旁边
const s = await parseModel(ab("sample-two-blocks.stl"), "sample-two-blocks.stl");
const parts = splitConnected(s.meshes[0]);
const sX = modelXform(parts, { units: "mm" });
const sdefs = engineDefs({ modules: parts.map((p, i) => mkModule(`块${i + 1}`, [p.id], i)) }, new Map(parts.map((p) => [p.id, p])), sX.M, "stl");
const su = sdefs.map((d) => engine.addPart(d, { p: new THREE.Vector3(12, 1, 0), q: new THREE.Quaternion() }, { label: d.name_zh }));
const worst2 = run(2);
ok(worst2 < 0.1, `两块各自落下不穿模（最大 ${worst2} mm）`);
ok(su.every((u, i) => Math.abs(lowest(u, sdefs[i])) < 0.05), "两块都停在桌面上");
// 3) 把小车再丢到 STL 块上：应该叠上去，不穿过去
const u3 = engine.addAssembly(defs.map((d) => ({ def: { ...d, id: d.id + "b" }, p: new THREE.Vector3(12, 2, 0), q: new THREE.Quaternion() })), {});
const worst3 = run(2.5);
ok(worst3 < 0.1, `第二台小车压在 STL 块上，最大穿模 ${worst3} mm`);
ok(lowest(u3[0], defs[0]) > 0.3 || Math.min(...u3.map((u, i) => lowest(u, defs[i]))) > -0.05, "第二台小车没有穿过桌面");
console.log(`modellab-engine: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
