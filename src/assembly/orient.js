// v37（我的补充）：键盘旋转改成四元数，不再拆成欧拉角再吸附（v36 的做法在前后倾 ±90° 附近会出现万向锁，
//   几次 15° 旋转叠加后吸附会把姿态“拉偏”）。思路：
//   - 每次按键 = 绕世界轴转一个精确角度，乘在“基准姿态”上；
//   - 基准姿态：上一次键盘设定的姿态（物理只让它偏了 < 4°）就用它，否则吸附到最近的 24 个直角姿态之一（< 4°），再否则用当前姿态；
//   - 90° 键的结果吸附到最近的直角姿态；15° 键保持精确组合（每一步都是 15° 的整数倍，本来就在格子上）；
//   - N：只保留绕竖直轴的分量（摆正），朝向取最近的 90°。
//   倾斜量用“零件的上方向和竖直方向的夹角”读出，没有万向锁。早期原型，简化仿真。
import * as THREE from "three";
export const AX = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const qAngle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * R2D;
const rot = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis, deg * D2R);
// 24 个直角姿态（立方体的旋转群），从单位姿态出发乘 X / Y / Z 的 90° 生成
export const CUBE = (() => {
  const out = [new THREE.Quaternion()], g = [rot(AX.X, 90), rot(AX.Y, 90), rot(AX.Z, 90)];
  for (let i = 0; i < out.length; i++) for (const r of g) { const q = r.clone().multiply(out[i]).normalize(); if (!out.some((o) => qAngle(o, q) < 1e-3)) out.push(q); }
  return out;
})();
export const nearest = (q, set) => { let best = set[0], d = 1e9; for (const s of set) { const a = qAngle(s, q); if (a < d) { d = a; best = s; } } return { q: best.clone(), deg: d }; };
export function baseOf(q, memo, tol = 4) {
  if (memo && qAngle(memo, q) < tol) return memo.clone();
  const c = nearest(q, CUBE); return c.deg < tol ? c.q : q.clone();
}
// 按一次键：axis 世界轴，deg 角度；返回目标姿态
export function keyRotate(q, axis, deg, memo) {
  const base = baseOf(q, memo);
  const t = rot(axis, deg).multiply(base).normalize();
  return Math.abs(deg) % 90 === 0 ? nearest(t, CUBE).q : t;
}
// 绕竖直轴的分量（摆动-扭转分解里的“扭转”），单位度
export const headingOf = (q) => { const t = Math.atan2(q.y, q.w) * 2 * R2D; return ((Math.round(t) % 360) + 360) % 360; };
export const tipOf = (q) => Math.round(Math.acos(Math.max(-1, Math.min(1, AX.Y.clone().applyQuaternion(q).y))) * R2D);
export function squareUp(q) { const h = Math.round(headingOf(q) / 90) * 90; return rot(AX.Y, h); }
// 找一个放得下的位置：先原地往上抬（最多 lift cm），再往旁边一圈一圈找（最多 side cm，8 个方向）。
// v39（我的补充）：候选点必须仍在桌面内（默认 60×40 cm，边距 2 cm，和 engine.BENCH 一致）；
//   旁边搜索会试一组叠高（stackYs），不再只试 0 / 0.5 / 1 cm。
export const TABLE = { w: 60, d: 40, margin: 2 };
export function onTable(x, z, { w = TABLE.w, d = TABLE.d, margin = TABLE.margin } = {}) {
  return Math.abs(x) <= w / 2 - margin + 1e-9 && Math.abs(z) <= d / 2 - margin + 1e-9;
}
export function findFit(fits, { lift = 3, side = 6, step = 0.5, dl = 0.25, stackYs, inside } = {}) {
  const ys = stackYs || [0, 0.5, 1, 1.5, 2, 3, 4, 5];
  const ok = (dx, dy, dz) => (!inside || inside(dx, dy, dz)) && !!fits(dx, dy, dz);
  for (let y = 0; y <= lift + 1e-9; y += dl) if (ok(0, y, 0)) return { dx: 0, dy: y, dz: 0, moved: 0, stacked: y > 0 };
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => { const l = Math.hypot(x, z); return [x / l, z / l]; });
  for (let r = step; r <= side + 1e-9; r += step) for (const y of ys) for (const [x, z] of dirs) if (ok(x * r, y, z * r)) return { dx: x * r, dy: y, dz: z * r, moved: r, stacked: y > 0 };
  return null;
}
