// v22（我的补充）：装配台首次使用导览，8 步，可跳过；关掉后记在本机 localStorage，不再自动弹。早期原型，简化仿真。
import { useEffect, useState } from "react";

export const TOUR_KEY = "asm-tour-v22-done";
export const STEPS = [
  { sel: '[data-testid="tool-hand"]', tab: "tools", t: "装配", d: "用“手”把零件拖到桌面。零件按真实尺寸，有物理碰撞，不会穿模。" },
  { sel: '[data-testid="preset-electrics"]', tab: "elec", t: "接线", d: "选一个练习或写装配清单，杜邦线插到真实引脚位置。鼠标停在引脚上能看到引脚名和间距。" },
  { sel: '[data-testid="tool-meter"]', tab: "tools", t: "万用表", d: "选“表笔”：左键红笔、右键黑笔，读数在“通电”页。" },
  { sel: '[data-testid="bench-scope-panel"]', tab: "elec", t: "示波器", d: "看开机、舵机起步时的电压波形（简化仿真）。" },
  { sel: 'header a[href$="/repair"]', t: "维修模式", d: "维修关卡：用表笔和烙铁找出虚焊、装反、断线。" },
  { sel: 'header a[href$="/parts"]', t: "零件库", d: "两千多个真实 CAD 零件，可看尺寸、引脚和碰撞体。" },
  { sel: 'header a[href$="/assembly/model"]', t: "上传模型", d: "上传自己的模型和功能图，拆成模块，再放回装配台。" },
  { sel: '[data-testid="tab-octo"]', tab: "octo", t: "连接实物", d: "“八爪鱼”页可以连真实板子，把实测和仿真画在一起对比。" },
];
const done = () => { try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return true; } };

export default function Tour({ setTab }) {
  const [i, setI] = useState(() => {
    const p = new URLSearchParams(location.search).get("tour");
    if (p === "1") return 0;
    if (p === "0" || done() || navigator.webdriver) return -1; // 自动化测试默认不弹（?tour=1 强制打开）
    return 0;
  });
  const [box, setBox] = useState(null);
  useEffect(() => { const ev = () => setI(0); window.addEventListener("open-tour", ev); return () => window.removeEventListener("open-tour", ev); }, []);
  useEffect(() => {
    if (i < 0) return; const s = STEPS[i]; if (s.tab) setTab?.(s.tab);
    let n = 0; const id = setInterval(() => { const el = document.querySelector(s.sel); if (el || ++n > 20) { clearInterval(id); if (el) { el.scrollIntoView?.({ block: "nearest" }); const r = el.getBoundingClientRect(); setBox({ x: r.left, y: r.top, w: r.width, h: r.height }); } else setBox(null); } }, 50);
    return () => clearInterval(id);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (i < 0) return null;
  const s = STEPS[i]; const close = () => { try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* 无痕模式 */ } setI(-1); };
  return (
    <>
      {box && <div className="pointer-events-none fixed z-[55] rounded-sm ring-2 ring-copper ring-offset-2" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} data-testid="tour-ring" />}
      <div className="fixed bottom-4 right-4 z-[56] w-72 border border-ink bg-paper p-3 text-sm shadow-lg" role="dialog" aria-label="新手导览" data-testid="tour">
        <p className="text-xs text-ink-soft">新手导览 {i + 1} / {STEPS.length}</p>
        <p className="mt-1 font-medium" data-testid="tour-title">{s.t}</p>
        <p className="mt-1">{s.d}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={close} className="min-h-8 border border-line px-2 text-xs" data-testid="tour-skip">跳过</button>
          {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="min-h-8 border border-line px-2 text-xs" data-testid="tour-prev">上一步</button>}
          <button type="button" onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : close())} className="ml-auto min-h-8 border border-ink bg-ink px-3 text-xs text-paper-2" data-testid="tour-next">{i + 1 < STEPS.length ? "下一步" : "完成"}</button>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">我的补充 · 早期原型，简化仿真</p>
      </div>
    </>
  );
}
