// v37：四元数键盘旋转的单元测试（不开浏览器）。对比 v36 的欧拉角吸附，证明新做法在万向锁附近不跑偏。
import * as THREE from "three";
const O = await import("../src/assembly/orient.js");
let pass = 0, fail = 0; const ok = (c, m, x = "") => { c ? pass++ : fail++; console.log(c ? "✓" : "✗", m, x); };
const R = (a, d) => new THREE.Quaternion().setFromAxisAngle(O.AX[a], d * Math.PI / 180);
// v36 旧做法（用来对比）
const oldSnap = (q, step) => { const e = new THREE.Euler().setFromQuaternion(q, "YXZ"); const s = (r) => Math.round(r * 180 / Math.PI / step) * step * Math.PI / 180; return new THREE.Quaternion().setFromEuler(new THREE.Euler(s(e.x), s(e.y), s(e.z), "YXZ")); };
ok(O.CUBE.length === 24, `直角姿态 ${O.CUBE.length} 个`);
const seqs = [["X", 15], ["Z", 15], ["Y", 15], ["X", 15], ["Z", -15], ["X", 15], ["Z", 15], ["Y", -15], ["X", 15], ["Z", 15]];
let qn = new THREE.Quaternion(), qo = new THREE.Quaternion(), exp = new THREE.Quaternion(), memo = null, worstOld = 0, worstNew = 0;
for (const [a, d] of seqs) {
  exp = R(a, d).multiply(exp);
  qn = O.keyRotate(qn, O.AX[a], d, memo); memo = qn.clone();
  qo = oldSnap(R(a, d).multiply(qo), 15);
  worstNew = Math.max(worstNew, O.qAngle(qn, exp)); worstOld = Math.max(worstOld, O.qAngle(qo, exp));
}
ok(worstNew < 0.01, `10 次混合 15° 旋转：新做法最大偏差 ${worstNew.toFixed(4)}°`);
ok(worstOld > 1, `同样的按键，v36 欧拉吸附最大偏差 ${worstOld.toFixed(1)}°（证明旧做法会跑偏）`);
// 万向锁：先前后倾 90°，再按 15° 左右倾
let g = O.keyRotate(new THREE.Quaternion(), O.AX.X, 90, null); const g1 = O.keyRotate(g, O.AX.Z, 15, g);
ok(O.qAngle(g1, R("Z", 15).multiply(R("X", 90))) < 0.01, "前后倾 90° 后再左右倾 15°：精确");
ok(O.tipOf(g) === 90, `倾斜量 ${O.tipOf(g)}°（上方向和竖直夹角）`);
// 物理让它偏了 2°：还是按记住的姿态算
const drift = R("Y", 2).multiply(g);
ok(O.qAngle(O.keyRotate(drift, O.AX.X, -90, g), new THREE.Quaternion()) < 0.01, "偏了 2° 也能精确转回平放");
// 偏了 3° 且没有记忆：吸附到最近直角姿态
ok(O.qAngle(O.keyRotate(R("Z", 3), O.AX.Y, 90, null), R("Y", 90)) < 0.01, "没有记忆时先吸附到直角姿态");
// 90° 键结果总在直角姿态上
let c = R("X", 15); c = O.keyRotate(c, O.AX.Z, 90, c);
ok(O.nearest(c, O.CUBE).deg < 0.01, "从 15° 倾斜按 90° 键 → 吸附到直角姿态");
// N 摆正
const sq = O.squareUp(R("Y", 100).multiply(R("X", 0)));
ok(O.headingOf(sq) === 90 && O.tipOf(sq) === 0, `N 摆正：朝向 ${O.headingOf(sq)}°、倾斜 ${O.tipOf(sq)}°`);
const sq2 = O.squareUp(R("Z", 10).multiply(R("Y", 181)));
ok(O.headingOf(sq2) === 180 && O.tipOf(sq2) === 0, `N 摆正（倾斜 10°、朝向 181°）→ ${O.headingOf(sq2)}°`);
// 找空位
const wall = (dx, dy) => dx > 2.9 || dy > 5; // 只有往右 3 cm 以上（或抬 5 cm）才放得下
const f = O.findFit((dx, dy, dz) => wall(dx, dy, dz));
ok(f && f.moved === 3 && f.dx === 3 && f.dy === 0, `往上抬不够时往旁边找：右移 ${f?.dx} cm`);
ok(O.findFit((dx, dy) => dy >= 1)?.dy === 1, "能抬高就先抬高，不挪");
ok(O.findFit(() => false) === null, "到处都放不下 → null");
ok(O.onTable(0, 0) && O.onTable(28, 18) && !O.onTable(29, 0) && !O.onTable(0, 19), "桌面边界是 ±(边/2 − 2) cm");
// 零件靠近 +x 边，只有往右才“放得下”，但往右会出界 → 不能选越界点
const edge = O.findFit((dx) => dx > 0, { inside: (dx, _dy, dz) => O.onTable(28.1 + dx, dz), step: 0.5, side: 6 });
ok(edge === null, `靠近桌边时不把零件推出桌外（得到 ${JSON.stringify(edge)}）`);
// 原地抬 3 cm 仍不够，旁边贴地也放不下，只有叠到 ≥ 4 cm 才行
const stack = O.findFit((dx, dy) => dy >= 4, { lift: 3, side: 6 });
ok(stack && stack.dy >= 4 && stack.moved > 0, `旁边搜索会试叠高：dy=${stack?.dy} moved=${stack?.moved}`);
const stay = O.findFit(() => true, { inside: (dx, _dy, dz) => O.onTable(dx, dz) });
ok(stay && stay.dx === 0 && stay.dy === 0, "在桌面内原地就行时不挪");
console.log(`orient-test ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
