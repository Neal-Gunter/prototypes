// 示波器测量光标：时间（竖）和电压（横）用 0–1 屏幕比例。早期原型，简化仿真。
export const CUR_DEFAULT = [0.3, 0.7];
export const VCUR_DEFAULT = [0.3, 0.7];

export function clamp01(x) {
  return Math.max(0, Math.min(1, +x || 0));
}

export function pairOr(cur, fallback = CUR_DEFAULT) {
  if (Array.isArray(cur) && cur.length >= 2 && Number.isFinite(+cur[0]) && Number.isFinite(+cur[1])) {
    return [clamp01(+cur[0]), clamp01(+cur[1])];
  }
  return fallback.slice();
}

// 电压光标：f = 0 在屏幕顶（+4 格），f = 1 在底（−4 格）。用当前通道的 V/div 和偏移。
export function voltAtFrac(f, ch = {}) {
  const vdiv = Number.isFinite(ch.vdiv) && ch.vdiv !== 0 ? ch.vdiv : 1;
  const off = Number.isFinite(ch.off) ? ch.off : 0;
  return (0.5 - f) * 8 * vdiv - off;
}

export function fracAtVolt(v, ch = {}) {
  const vdiv = Number.isFinite(ch.vdiv) && ch.vdiv !== 0 ? ch.vdiv : 1;
  const off = Number.isFinite(ch.off) ? ch.off : 0;
  return clamp01(0.5 - (v + off) / (8 * vdiv));
}

export function deltaV(f1, f2, ch) {
  return voltAtFrac(f2, ch) - voltAtFrac(f1, ch);
}

// 有抓波时用采样时刻；否则按 10 格时基估算。
export function timeAtFrac(f, cap, tdiv) {
  if (cap?.t?.length) {
    const i = Math.min(cap.t.length - 1, Math.max(0, Math.round(f * (cap.t.length - 1))));
    return cap.t[i];
  }
  return clamp01(f) * 10 * (Number.isFinite(tdiv) ? tdiv : 1e-3);
}

export function deltaT(f1, f2, cap, tdiv) {
  return timeAtFrac(f2, cap, tdiv) - timeAtFrac(f1, cap, tdiv);
}

export function invDeltaT(dt) {
  return Number.isFinite(dt) && dt !== 0 ? 1 / Math.abs(dt) : null;
}
