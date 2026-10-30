// v13：连杆机构的几何（本项目自制，CC0）。单位 mm，Y 朝上，机构画在 XZ 平面里（转轴 = Y）。
// 给四连杆示例（make-fourbar-demo.mjs）和闭环测试（loop-test.mjs）共用。
export function objWriter(title) {
  let obj = `# ${title}（本项目自制，CC0 公共领域）。单位 mm，Y 朝上。\n`, vn = 0;
  const quad = (a, b, c, d) => `f ${a} ${b} ${c}\nf ${a} ${c} ${d}\n`;
  // 沿 XZ 平面里 p→q 方向的长条（两端各伸出 ext），宽 w、y 从 y0 到 y1
  function bar(name, p, q, w, [y0, y1], ext = 6) {
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    const a = [p[0] - ux * ext, p[1] - uz * ext], b = [q[0] + ux * ext, q[1] + uz * ext];
    const C = [[a[0] - nx * w / 2, a[1] - nz * w / 2], [b[0] - nx * w / 2, b[1] - nz * w / 2], [b[0] + nx * w / 2, b[1] + nz * w / 2], [a[0] + nx * w / 2, a[1] + nz * w / 2]];
    box8(name, [...C.map(([x, z]) => [x, y0, z]), ...C.map(([x, z]) => [x, y1, z])]);
  }
  function box(name, [x0, x1], [y0, y1], [z0, z1]) { box8(name, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]); }
  function box8(name, P) {
    obj += `o ${name}\n`;
    for (const p of P) obj += `v ${p.map((v) => +v.toFixed(4)).join(" ")}\n`;
    const i = (k) => vn + k + 1;
    // 底 0123、顶 4567
    obj += quad(i(0), i(1), i(2), i(3)) + quad(i(4), i(7), i(6), i(5)) + quad(i(0), i(4), i(5), i(1)) + quad(i(1), i(5), i(6), i(2)) + quad(i(2), i(6), i(7), i(3)) + quad(i(3), i(7), i(4), i(0));
    vn += 8;
  }
  return { bar, box, text: () => obj };
}
// 两圆交点（取 z 大的那个 = “开口”装配）
export function circleX(c1, r1, c2, r2, pick = 1) {
  const dx = c2[0] - c1[0], dz = c2[1] - c1[1], d = Math.hypot(dx, dz);
  if (d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / d, mz = c1[1] + (a * dz) / d;
  const s1 = [mx - (h * dz) / d, mz + (h * dx) / d], s2 = [mx + (h * dz) / d, mz - (h * dx) / d];
  return (pick > 0 ? s1[1] >= s2[1] : s1[1] < s2[1]) ? s1 : s2;
}
// 曲柄摇杆（Grashof）：机架 d、曲柄 a、连杆 b、摇杆 c。输入曲柄平面角 θ（rad，atan2(z, x)），输出摇杆平面角 φ
export const FOURBAR = { d: 80, a: 20, b: 70, c: 60, theta0: Math.PI / 2 };
export function fourbarPoints(theta, F = FOURBAR, pick = 1) {
  const O2 = [0, 0], O4 = [F.d, 0], A = [F.a * Math.cos(theta), F.a * Math.sin(theta)];
  const B = circleX(A, F.b, O4, F.c, pick);
  return B && { O2, O4, A, B, phi: Math.atan2(B[1], B[0] - F.d) };
}
// 关节角（绕 +Y 转 q：平面角 ψ 变成 ψ − q）
export const crankQ = (theta, F = FOURBAR) => F.theta0 - theta;
