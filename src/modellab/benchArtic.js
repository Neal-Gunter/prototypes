// v12：把带关节的上传工程放到装配台（Rapier 世界和台面其他零件共用）：每个刚体组一个刚体，组之间加关节 + 舵机马达
import * as THREE from "three";
import { ArticCore, buildGroups } from "./artic.js";

export async function addCustomToBench(engine, project, bytes, { x = 0, z = 0, y = 1 } = {}) {
  const { engineFromProject } = await import("./workspace.js");
  const key = `${project.id}-${Date.now().toString(36)}`;
  const { defs, X } = await engineFromProject(project, bytes, key);
  if (!defs.length) throw new Error("这个工程没有可用的模块");
  const defOf = new Map(defs.map((d) => [d.custom.module, d]));
  // 没有网格的模块不进物理；连到它们的关节也去掉
  const pj = { ...project, modules: project.modules.filter((m) => defOf.has(m.id)) };
  pj.joints = (project.joints || []).filter((j) => defOf.has(j.parent) && defOf.has(j.child));
  const G = buildGroups(pj);
  const item = (m, p) => ({ def: defOf.get(m), p: p.clone(), q: new THREE.Quaternion(), label: defOf.get(m).name_zh });
  const base = new THREE.Vector3(x, pj.sim?.fixBase ? 0.02 : y, z);
  if (!G.joints.length) {
    const uids = engine.addAssembly(defs.map((d) => item(d.custom.module, base)), { why: `上传模型“${project.name}”（各模块固定在一起）` });
    return { uids, defs, core: null, G };
  }
  const { uidsByGroup, bids } = engine.addArticulated(G.groups.map((g) => g.mods.map((m) => item(m, base))), { why: `上传模型“${project.name}”：同一刚体组` });
  const rb0 = engine.bodies.get(bids[0]).rb, t = rb0.translation();
  const frame = { p: new THREE.Vector3(t.x, t.y, t.z), q: new THREE.Quaternion() };
  const rbOf = (gi) => engine.bodies.get(bids[gi])?.rb;
  const core = new ArticCore(engine.R, engine.world, pj, X.M, G, rbOf, { frame, onPair: (a, b) => engine.addNoContact(a, b), fixTo: pj.sim?.fixBase ? engine.fixed : null });
  const off = engine.onTick((dt) => core.step(dt));
  core.detach = () => { core.stop(); off(); };
  core.modOf = new Map();
  uidsByGroup.forEach((us, gi) => us.forEach((u, k) => core.modOf.set(u, G.groups[gi].mods[k])));
  return { uids: uidsByGroup.flat(), defs, core, G, project: pj, X };
}
