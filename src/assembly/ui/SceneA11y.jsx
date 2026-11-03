// v34（我的补充）：3D 工作台的键盘操作和读屏标签。
// 画布本身对读屏软件是一块“图”，所以在它上面盖一层可聚焦的区域：Tab 聚焦后
//   ← / → 或 [ / ] 切换选中的零件；Alt + 方向键 在桌面上平移 1 cm（Alt + Shift 为 5 mm），Alt + PageUp / PageDown 抬起 / 放下 3 mm；
//   Enter 读出当前零件的位置；Esc 取消选中。
// v35：R / Shift + R 绕竖直轴转 90°（和鼠标拖动时的 R 一致），Alt + R / Alt + Shift + R 细调 15°；转之前检查会不会和别的零件穿模。
// v36（我的补充）：T / Shift + T 绕左右轴（前后倾）、F / Shift + F 绕前后轴（左右倾）各转 90°，加 Alt 为 15°；
//   键盘旋转后的角度都吸附到网格（90° 键吸附到 90° 的倍数，15° 键吸附到 15° 的倍数），N 把当前姿态摆正到最近的 90°。
//   转动会穿模时先试着往上抬（最多 3 cm）再转，还不行就拒绝并读出原因。
// v37（我的补充）：旋转改成四元数（orient.js），不再经过欧拉角吸附，前后倾 90° 时左右倾也精确；
//   原地抬 3 cm 还放不下时，往旁边一圈一圈找空位（最多 6 cm），挪了多少读出来。读出“倾斜 N°”（上方向和竖直夹角）。
// 选中和位置变化写进一个 aria-live 区域；另有一份隐藏的零件清单，读屏用户可以逐个点选。早期原型，简化仿真。
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { engine } from "../engine.js";
import { keyRotate, squareUp, findFit, tipOf } from "../orient.js";
import { useLang, tr } from "../../i18n.js";

const nameOf = (u, lang) => { const d = engine.parts.get(u)?.def; return d ? (lang === "en" ? d.name || d.name_zh : d.name_zh || d.name) : u; };
const posOf = (u) => { try { return engine.worldPose(u).p; } catch { return null; } };
const cm = (v) => (Math.round(v * 10) / 10).toFixed(1);
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const R2D = THREE.MathUtils.radToDeg, D2R = THREE.MathUtils.degToRad;
const norm = (d) => ((Math.round(d) % 360) + 360) % 360;
// 姿态拆成 YXZ 欧拉角（朝向 / 前后倾 / 左右倾），单位度
export const anglesOf = (q) => { const e = new THREE.Euler().setFromQuaternion(q, "YXZ"); return { yaw: norm(R2D(e.y)), pitch: norm(R2D(e.x)), roll: norm(R2D(e.z)) }; };
export const yawOf = (q) => { const e = new THREE.Euler().setFromQuaternion(q, "YXZ"); return ((Math.round(THREE.MathUtils.radToDeg(e.y)) % 360) + 360) % 360; };

export function describe(u, lang, list) {
  const p = posOf(u);
  const i = list.indexOf(u);
  let yaw = null; try { yaw = yawOf(engine.worldPose(u).q); } catch { /* */ }
  let a = null; try { a = anglesOf(engine.worldPose(u).q); } catch { /* */ }
  let tip = 0; try { tip = tipOf(engine.worldPose(u).q); } catch { /* */ }
  const tilt = a && (a.pitch || a.roll) ? (lang === "en" ? `, tipped ${a.pitch}° front-back, ${a.roll}° side (tilt ${tip}°)` : `，前后倾 ${a.pitch}°，左右倾 ${a.roll}°（倾斜 ${tip}°）`) : "";
  const where = p ? (lang === "en" ? `x ${cm(p.x)} cm, height ${cm(p.y)} cm, z ${cm(p.z)} cm, turned ${yaw}°${tilt}` : `x ${cm(p.x)} 厘米，高 ${cm(p.y)} 厘米，z ${cm(p.z)} 厘米，朝向 ${yaw}°${tilt}`) : "";
  return lang === "en" ? `Selected ${nameOf(u, lang)} (${i + 1} of ${list.length}). ${where}` : `已选中 ${nameOf(u, lang)}（第 ${i + 1} 个，共 ${list.length} 个）。${where}`;
}

export default function SceneA11y({ uids, sel, onSelect }) {
  const [lang] = useLang();
  const [say, setSay] = useState("");
  const ref = useRef(null);
  const memo = useRef(new Map()); // 每个零件上一次键盘设定的姿态（四元数）
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
  // axis：Y 竖直 / X 左右轴 / Z 前后轴；deg = 0 是 N 键（摆正）
  const rotate = (deg, axis = Y) => {
    if (!sel || !engine.parts.has(sel)) return;
    const bid = engine.parts.get(sel).body, b = engine.bodies.get(bid);
    if (!b || !b.rb.isDynamic()) { setSay(tr("这个零件固定住了，不能用键盘旋转", "This part is fixed and can't be turned with the keyboard")); return; }
    const w = engine.worldPose(sel), bp = engine.bodyPose(bid);
    const tq = deg === 0 ? squareUp(w.q) : keyRotate(w.q, axis, deg, memo.current.get(sel));
    const r = tq.clone().multiply(w.q.clone().invert());
    const nq = r.clone().multiply(bp.q), off = bp.p.clone().sub(w.p).applyQuaternion(r);
    const mine = new Set(b.parts);
    const fit = findFit((dx, dy, dz) => !engine.overlapAt(bid, w.p.clone().add(off).add(new THREE.Vector3(dx, dy, dz)), nq, mine));
    if (!fit) { setSay(tr("这里转不开（会和别的零件穿模，旁边 6 厘米内也没有空位），先挪开一点再转", "Can't turn here (it would overlap another part and there is no free spot within 6 cm); move it a little first")); return; }
    memo.current.set(sel, tq.clone());
    engine.teleport(sel, w.p.clone().add(new THREE.Vector3(fit.dx, fit.dy, fit.dz)), tq, true);
    const moved = fit.moved ? tr(`（原地放不下，往旁边挪了 ${cm(fit.moved)} 厘米）`, ` (no room in place; moved ${cm(fit.moved)} cm to the side)`) : "";
    setSay(describe(sel, lang, list) + moved);
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
    else if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) rotate((e.altKey ? 15 : 90) * (e.shiftKey ? -1 : 1), Y);
    else if (e.code === "KeyT" && !e.ctrlKey && !e.metaKey) rotate((e.altKey ? 15 : 90) * (e.shiftKey ? -1 : 1), X);
    else if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey) rotate((e.altKey ? 15 : 90) * (e.shiftKey ? -1 : 1), Z);
    else if (e.code === "KeyN" && !e.ctrlKey && !e.metaKey) rotate(0, Y);
    else if (e.key === "ArrowRight" || e.key === "]") onSelect(list[sel ? (i + 1) % list.length : 0]);
    else if (e.key === "ArrowLeft" || e.key === "[") onSelect(list[sel ? (i - 1 + list.length) % list.length : list.length - 1]);
    else if (e.key === "Home") onSelect(list[0]);
    else if (e.key === "End") onSelect(list[list.length - 1]);
    else if (e.key === "Enter") announce(sel);
    else if (e.key === "Escape") { onSelect(null); announce(null); }
    else done = false;
    if (done) e.preventDefault();
  };
  const help = tr("3D 工作台。Tab 聚焦后：左右方向键切换零件，Alt 加方向键平移 1 厘米，Alt 加 PageUp / PageDown 抬起或放下，R 绕竖直轴旋转 90 度，T 前后倾 90 度，F 左右倾 90 度（加 Alt 转 15 度，加 Shift 反向，角度自动吸附），N 摆正（转不开时自动往上抬或往旁边找空位），回车读出位置，Esc 取消选中。",
    "3D workbench. When focused: Left / Right arrows pick a part, Alt + arrows move it 1 cm, Alt + PageUp / PageDown lift or lower it, R turns it 90° about the vertical axis, T tips it 90° front-back, F tips it 90° sideways (add Alt for 15°, Shift to turn back; angles snap), N squares it up (if there is no room it lifts the part or finds a free spot beside it), Enter reads its position, Esc clears the selection.");
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
