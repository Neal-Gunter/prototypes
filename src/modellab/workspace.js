// v11：从“工程 + 模型字节”重建可用的数据（网格、变换、每个模块的分析、引擎零件定义）。实验室页和装配台都用它
import { parseModel, guessUnits } from "./load.js";
import { analyzeModule, autoSplit, engineDefs, modelXform, rawSize, splitConnected } from "./modules.js";
import { registerModel } from "./registry.js";

export async function parseForProject(bytes, model) {
  const r = await parseModel(bytes, model.file);
  let meshes = r.meshes;
  if (model.split === "connected") meshes = meshes.flatMap((m) => splitConnected(m));
  const raw = rawSize(meshes);
  const units = guessUnits(Math.max(raw.x, raw.y, raw.z), r.format, r.unitHint);
  return { ...r, meshes, raw, unitGuess: units };
}
export function firstModules(parsed) {
  return autoSplit(parsed.meshes);
}
export function computeWorkspace(project, parsed) {
  const X = modelXform(parsed.meshes, project.model);
  const byId = new Map(parsed.meshes.map((m) => [m.id, m]));
  const an = new Map();
  for (const mod of project.modules) { const a = analyzeModule(mod, byId, X.M); if (a) an.set(mod.id, a); }
  return { X, byId, an };
}
export async function engineFromProject(project, bytes, key) {
  const parsed = await parseForProject(bytes, project.model);
  const X = modelXform(parsed.meshes, project.model);
  const byId = new Map(parsed.meshes.map((m) => [m.id, m]));
  registerModel(key, parsed.meshes, project.modules, X.M);
  return { defs: engineDefs(project, byId, X.M, key), X, parsed };
}
