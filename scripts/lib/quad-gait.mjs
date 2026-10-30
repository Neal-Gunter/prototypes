// 四足示例的内置步态（参数由 scripts/quad-search.mjs 选出，我的补充）
export const QUAD_PARAMS = { A: 20, L: 15, f: 1, lead: 90, sgnY: -1, sgnL: 1 }; // sgnY = −1：左右镜像后往 −z（前）走（scripts/quad-search.mjs 8 种组合里实测选的）
export function quadGait(P = QUAD_PARAMS) {
  const legs = [["lf", -1, 0], ["rf", 1, 180], ["lb", -1, 180], ["rb", 1, 0]];
  const joints = [];
  for (const [k, s, ph] of legs) {
    joints.push({ jid: `j-${k}-yaw`, amp: +(P.A * -s * P.sgnY).toFixed(2), phase: ph, offset: 0, freq: P.f, wave: "sine", duty: 0.5 });
    joints.push({ jid: `j-${k}-lift`, amp: +(P.L * s * P.sgnL).toFixed(2), phase: (ph + P.lead + 360) % 360, offset: 0, freq: P.f, wave: "sine", duty: 0.5 });
  }
  return { name: "对角小跑（v13）", joints };
}
export const QUAD_GAIT = quadGait();
