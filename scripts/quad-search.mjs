// v13：四足示例的步态测量 / 小搜索（node scripts/quad-search.mjs [sec]）。只用本机，不联网。
import fs from "node:fs";
import R from "@dimforge/rapier3d-compat";
import { parseModel } from "../src/modellab/load.js";
import { modelXform, analyzeModule } from "../src/modellab/modules.js";
import { sanitize } from "../src/modellab/project.js";
import { gaitForProject, measureArtic } from "../src/gait/artic-gait.js";
import { quadGait, QUAD_PARAMS } from "./lib/quad-gait.mjs";
await R.init();
const enc = (s) => { const b = Buffer.from(s, "utf8"); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
export async function quadSetup() {
  const parsed = await parseModel(enc(fs.readFileSync("public/demo/quad.obj", "utf8")), "quad.obj");
  const project = sanitize(JSON.parse(fs.readFileSync("public/demo/quad.project.json", "utf8")));
  const X = modelXform(parsed.meshes, project.model);
  const byId = new Map(parsed.meshes.map((m) => [m.id, m]));
  const an = new Map(project.modules.map((m) => [m.id, analyzeModule(m, byId, X.M)]));
  return { project, X, an };
}
export const f2 = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? +v.toFixed(3) : v]));
if (import.meta.url === `file://${process.argv[1]}`) {
  const sec = +(process.argv[2] || 6);
  const S = await quadSetup();
  const run = async (P) => { const p = { ...S.project, gait: quadGait(P) }; return measureArtic(R, p, S.an, S.X.M, gaitForProject(p), { sec }); };
  const zero = await run({ ...QUAD_PARAMS, A: 0, L: 0 });
  console.log("静止", JSON.stringify(f2(zero)));
  const out = [];
  for (const sgnY of [1, -1]) for (const sgnL of [1, -1]) for (const lead of [90, -90]) {
    const P = { ...QUAD_PARAMS, sgnY, sgnL, lead };
    const r = await run(P); out.push({ P, r: f2(r) });
    console.log(JSON.stringify(P), "fwd", r.fwd.toFixed(2), "dx", r.dx.toFixed(2), "dh", r.dh.toFixed(1), "tilt", r.tiltMax.toFixed(1), "pen", r.pen);
  }
}
