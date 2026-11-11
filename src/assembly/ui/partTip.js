// 装配台零件提示：名称 + 一条主要规格（中/英）。只读 def，不改物理。
export function partTipText(def, lang = "zh") {
  if (!def) return { name: "", spec: "" };
  const en = lang === "en";
  const name = en ? (def.name || def.name_zh || def.id || "") : (def.name_zh || def.name || def.id || "");
  const bits = [];
  const d = def.dims_mm;
  if (d && (d.x != null || d.y != null || d.z != null)) bits.push(`${d.x ?? "—"} × ${d.y ?? "—"} × ${d.z ?? "—"} mm`);
  if (def.spec) bits.push(String(def.spec));
  if (def.volt) bits.push(String(def.volt));
  if (def.rating) bits.push(String(def.rating));
  if (def.smdPkg) bits.push(String(def.smdPkg).toUpperCase());
  if (def.dims_src && bits.length < 2) bits.push(en ? `size: ${def.dims_src}` : `尺寸：${def.dims_src}`);
  return { name, spec: bits.filter(Boolean).slice(0, 3).join(" · ") };
}

// 用碰撞盒（cm）或 dims_mm 得到描边盒子。略放大，不碰到共享材质。
export function highlightBox(def) {
  const cols = def?.colliders || [];
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], any = false;
  for (const c of cols) {
    if (!c?.c || !c?.h) continue;
    any = true;
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], c.c[k] - c.h[k]);
      hi[k] = Math.max(hi[k], c.c[k] + c.h[k]);
    }
  }
  if (any && lo[0] < hi[0]) {
    return {
      c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
      s: [Math.max(0.08, (hi[0] - lo[0]) * 1.06), Math.max(0.08, (hi[1] - lo[1]) * 1.06), Math.max(0.08, (hi[2] - lo[2]) * 1.06)],
    };
  }
  const d = def?.dims_mm || { x: 10, y: 8, z: 10 };
  return { c: [0, (d.y || 8) / 20, 0], s: [((d.x || 10) / 10) * 1.06, ((d.y || 8) / 10) * 1.06, ((d.z || 10) / 10) * 1.06] };
}
