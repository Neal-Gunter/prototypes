// v22（我的补充）：引脚物理位置 → 引擎锚点 + 悬停标签。
//   数据来自 scripts/build-physpins.mjs：KiCad 封装焊盘坐标换算到 CAD 模型上并逐个核对（容差 0.5 mm），
//   或在 CAD 网格里量出来的针脚（HC-SR04 / L298N 模块），或只有封装时按封装生成的近似外形。早期原型，简化仿真。
//   pins 每项：[x, y, z (mm, 零件局部), 引脚号, 名称, 类型, tht, w, h, 估算?, 侧向针?]
const SRC_ZH = { "cad+footprint": "KiCad 封装 → CAD 模型（已核对）", cad: "CAD 模型量出", footprint: "KiCad 封装（数据手册焊盘图）" };
export const physSrcZh = (m) => SRC_ZH[m] || "估算";
export function attachPhys(def, phys, F = (p) => p) {
  if (!phys?.pins?.length) return def;
  const pins = {}; const ph = def.anchors.filter((a) => a.t === "pinhole");
  let ni = ph.reduce((m, a) => Math.max(m, a.i + 1), 0), si = 0, ui = 100;
  for (const q of phys.pins) {
    const p = F([q[0] / 10, q[1] / 10, q[2] / 10]);
    const info = { num: q[3], name: q[4], role: q[5], tht: !!q[6], est: !!q[9], src: q[9] ? "估算" : physSrcZh(phys.mode) };
    let key = null;
    if (q[6] && !q[10]) {
      const near = ph.find((a) => Math.hypot(a.p[0] - p[0], a.p[2] - p[2]) < 0.06);
      if (near) key = `p${near.i}`;
      else { const lg = (def.legs || []).find((l) => Math.hypot(l.p[0] - p[0], l.p[2] - p[2]) < 0.06); if (lg) key = `l${lg.i}`; }
      if (!key && phys.mode === "cad") { const i = ui++; def.anchors.push({ t: "pin-up", p, base: p[1] - 0.6, i }); key = `l${i}`; } // CAD 里量出的竖直排针：杜邦母头能插
      if (!key && phys.mode !== "cad") { const i = ni++; def.anchors.push({ t: "pinhole", d: q[11] || 1.0, p, i }); key = `p${i}`; }
    }
    if (!key) { const i = si++; def.anchors.push({ t: "pad", p, i, w: q[7] / 10, h: q[8] / 10 }); key = `s${i}`; }
    pins[key] = info;
  }
  def.physPins = pins;
  def.physInfo = { board: phys.b, mode: phys.mode, src: physSrcZh(phys.mode), pitch: phys.pitch, err_max: phys.err_max };
  return def;
}
// 悬停 / 表笔：零件上离 (局部或世界) 点最近的“有名字的引脚”
export function pinLabel(def, key) {
  const q = def?.physPins?.[key]; if (!q) return null;
  const pitch = def.physInfo?.pitch;
  if (key[0] === "t" && def.boPitch) return { title: `${q.name}（引脚 ${q.num}）`, sub: `转接板贴片焊盘 · ${q.src}`, pitch: `焊盘间距 ${def.boPitch} mm · 要先把芯片焊上（排针那头才是 2.54 mm）` };
  const pt = pitch ? `间距 ${pitch.mode} mm${pitch.ok ? "" : `（数据手册 ${pitch.expected} mm，不一致${pitch.note ? "：" + pitch.note : ""}）`}${pitch.breadboard ? " · 可插面包板" : ""}` : "";
  return { title: `${q.name}（引脚 ${q.num}）`, sub: `${q.tht ? "通孔 / 排针" : "贴片焊盘"} · ${q.src}${q.est ? " · 估算" : ""}`, pitch: pt };
}
