// v14（我的补充）：可复现的随机数。mulberry32 + Box–Muller。同一个种子 → 同一串数（浏览器 / node / Worker 一样）
export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function gaussFn(rnd) {
  let spare = null;
  return () => {
    if (spare != null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0; while (u < 1e-12) u = rnd(); v = rnd();
    const r = Math.sqrt(-2 * Math.log(u)); spare = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v);
  };
}
// 从一个主种子派生子种子（例如“第 k 个鲁棒性种子”）
export const subSeed = (seed, k) => (Math.imul((seed >>> 0) ^ 0x85ebca6b, 0xc2b2ae35) + Math.imul(k + 1, 0x27d4eb2f)) >>> 0;
