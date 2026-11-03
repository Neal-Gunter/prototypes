// v34（我的补充）：3D 工作台的键盘操作和读屏标签。
// 画布本身对读屏软件是一块“图”，所以在它上面盖一层可聚焦的区域：Tab 聚焦后
//   ← / → 或 [ / ] 切换选中的零件；Alt + 方向键 在桌面上平移 1 cm（Alt + Shift 为 5 mm），Alt + PageUp / PageDown 抬起 / 放下 3 mm；
//   Enter 读出当前零件的位置；Esc 取消选中。
// 选中和位置变化写进一个 aria-live 区域；另有一份隐藏的零件清单，读屏用户可以逐个点选。早期原型，简化仿真。
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { engine } from "../engine.js";
import { useLang, tr } from "../../i18n.js";

const nameOf = (u, lang) => { const d = engine.parts.get(u)?.def; return d ? (lang === "en" ? d.name || d.name_zh : d.name_zh || d.name) : u; };
const posOf = (u) => { try { return engine.worldPose(u).p; } catch { return null; } };
const cm = (v) => (Math.round(v * 10) / 10).toFixed(1);

export function describe(u, lang, list) {
  const p = posOf(u);
  const i = list.indexOf(u);
  const where = p ? (lang === "en" ? `x ${cm(p.x)} cm, height ${cm(p.y)} cm, z ${cm(p.z)} cm` : `x ${cm(p.x)} 厘米，高 ${cm(p.y)} 厘米，z ${cm(p.z)} 厘米`) : "";
  return lang === "en" ? `Selected ${nameOf(u, lang)} (${i + 1} of ${list.length}). ${where}` : `已选中 ${nameOf(u, lang)}（第 ${i + 1} 个，共 ${list.length} 个）。${where}`;
}

export default function SceneA11y({ uids, sel, onSelect }) {
  const [lang] = useLang();
  const [say, setSay] = useState("");
  const ref = useRef(null);
  const list = uids.filter((u) => engine.parts.has(u));
  const announce = useCallback((u) => setSay(u ? describe(u, lang, list) : tr("没有选中零件", "No part selected")), [lang, list]);
  useEffect(() => { if (sel && document.activeElement === ref.current) announce(sel); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const nudge = (dx, dy, dz) => {
    if (!sel || !engine.parts.has(sel)) return;
    const bid = engine.parts.get(sel).body, b = engine.bodies.get(bid);
    if (!b || !b.rb.isDynamic()) { setSay(tr("这个零件固定住了，不能用键盘移动", "This part is fixed and can't be moved with the keyboard")); return; }
    const bp = engine.bodyPose(bid);
    const np = bp.p.clone().add(new THREE.Vector3(dx, dy, dz));
    if (np.y < bp.p.y && engine.overlapAt(bid, np, bp.q, new Set(b.parts))) { setSay(tr("再往下会压进桌面或别的零件", "Lower would push it into the bench or another part")); return; }
    const hit = dy >= 0 && engine.overlapAt(bid, np, bp.q, new Set(b.parts));
    if (hit && dy === 0) { setSay(tr("这里放不下（会和别的零件穿模）", "Can't move there (it would overlap another part)")); return; }
    const w = engine.worldPose(sel);
    engine.teleport(sel, w.p.clone().add(new THREE.Vector3(dx, dy, dz)), w.q, true);
    announce(sel);
  };
  const key = (e) => {
    if (!list.length) return;
    const i = Math.max(0, list.indexOf(sel));
    const step = e.shiftKey ? 0.5 : 1;
    let done = true;
    if (e.altKey && e.key === "ArrowLeft") nudge(-step, 0, 0);
    else if (e.altKey && e.key === "ArrowRight") nudge(step, 0, 0);
    else if (e.altKey && e.key === "ArrowUp") nudge(0, 0, -step);
    else if (e.altKey && e.key === "ArrowDown") nudge(0, 0, step);
    else if (e.altKey && e.key === "PageUp") nudge(0, 0.3, 0);
    else if (e.altKey && e.key === "PageDown") nudge(0, -0.3, 0);
    else if (e.key === "ArrowRight" || e.key === "]") onSelect(list[sel ? (i + 1) % list.length : 0]);
    else if (e.key === "ArrowLeft" || e.key === "[") onSelect(list[sel ? (i - 1 + list.length) % list.length : list.length - 1]);
    else if (e.key === "Home") onSelect(list[0]);
    else if (e.key === "End") onSelect(list[list.length - 1]);
    else if (e.key === "Enter") announce(sel);
    else if (e.key === "Escape") { onSelect(null); announce(null); }
    else done = false;
    if (done) e.preventDefault();
  };
  const help = tr("3D 工作台。Tab 聚焦后：左右方向键切换零件，Alt 加方向键平移 1 厘米，Alt 加 PageUp / PageDown 抬起或放下，回车读出位置，Esc 取消选中。",
    "3D workbench. When focused: Left / Right arrows pick a part, Alt + arrows move it 1 cm, Alt + PageUp / PageDown lift or lower it, Enter reads its position, Esc clears the selection.");
  return (
    <>
      <div ref={ref} tabIndex={0} role="application" aria-roledescription={tr("3D 场景", "3D scene")} aria-label={help}
        aria-describedby="asm-a11y-say" onKeyDown={key} onFocus={() => announce(sel)} data-testid="asm-a11y"
        className="pointer-events-none absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset" />
      <p id="asm-a11y-say" className="sr-only" aria-live="polite" data-testid="asm-a11y-say">{say}</p>
      <div className="sr-only">
        <h2>{tr("场景里的零件", "Parts in the scene")}（{list.length}）</h2>
        <ul data-testid="asm-a11y-list">
          {list.map((u) => (
            <li key={u}><button type="button" aria-pressed={u === sel} onClick={() => { onSelect(u); announce(u); }}>{nameOf(u, lang)}</button></li>
          ))}
        </ul>
      </div>
    </>
  );
}
