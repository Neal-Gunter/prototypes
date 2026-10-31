// v22（我的补充）：命令面板 Ctrl/Cmd-K —— 跳到页面、零件、场景。早期原型，简化仿真。
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang, tr } from "../i18n.js";

const PAGES = [
  ["/", "首页"], ["/example", "示例"], ["/workbench", "工作台"], ["/assembly", "装配台"], ["/assembly/model", "模型 + 功能图（上传模型）"],
  ["/assembly/guide", "装配台说明"], ["/assembly/octopus-guide", "八爪鱼装配指南"], ["/repair", "维修关卡"], ["/project", "动手做：从零做一只八爪鱼（引导项目 + 制作单）"], ["/repair?tab=editor", "维修关卡编辑器"],
  ["/parts", "零件库"], ["/pinouts", "引脚表"], ["/credits", "出处与许可"],
];
const SCENES = [
  ["/assembly?scene=electrics", "电路练习：Pico + LED + 按键 + 电位器 + 舵机"], ["/assembly?scene=fault", "排错练习：1 个虚焊、1 个装反"],
  ["/assembly?scene=octo", "八爪鱼（走路 + 连接实物）"], ["/assembly?scene=octoA", "八爪鱼方案 A"], ["/assembly?scene=octoB", "八爪鱼方案 B（小巧版）"],
];
const norm = (s) => String(s || "").toLowerCase();

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [lang] = useLang(); const L = (it) => (it[0] === "零件" ? it[2] : tr(it[2]));
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [extra, setExtra] = useState({ parts: [], repair: [] });
  const nav = useNavigate(); const inp = useRef(null); const dlg = useRef(null); const back = useRef(null); const list = useRef(null);
  useEffect(() => {
    const on = (e) => { if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } else if (e.key === "Escape") setOpen(false); };
    const ev = () => setOpen(true);
    window.addEventListener("keydown", on); window.addEventListener("open-palette", ev);
    return () => { window.removeEventListener("keydown", on); window.removeEventListener("open-palette", ev); };
  }, []);
  useEffect(() => {
    if (!open) { const b = back.current; back.current = null; if (b && document.contains(b)) b.focus?.(); return; } // v23：关掉后焦点回到打开前的位置
    back.current = document.activeElement; setQ(""); setSel(0); setTimeout(() => inp.current?.focus(), 0);
    if (extra.parts.length) return;
    // 打开时才加载零件索引和维修关卡（不拖慢首屏）
    Promise.all([
      fetch("/lib/index.json").then((r) => r.json()).catch(() => ({ parts: [] })),
      import("../repair/scenarios.js").then((m) => m.SCENARIOS).catch(() => []),
    ]).then(([idx, sc]) => setExtra({
      parts: idx.parts.map((p) => [`/parts?id=${encodeURIComponent(p[0])}`, p[1], p[0]]),
      repair: sc.map((s) => [`/repair?s=${s.id}`, `维修：${s.title}`, s.id]),
    }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => {
    const all = [...PAGES.map((p) => ["页面", ...p]), ...SCENES.map((p) => ["场景", ...p]), ...extra.repair.map((p) => ["场景", ...p]), ...extra.parts.map((p) => ["零件", ...p])];
    const w = norm(q).split(/\s+/).filter(Boolean);
    const hit = w.length ? all.filter((it) => w.every((t) => norm(it[2] + " " + (it[3] || "") + " " + it[0] + (lang === "en" ? " " + L(it) + " " + tr(it[0]) : "")).includes(t))) : all.filter((it) => it[0] !== "零件");
    return hit.slice(0, 40);
  }, [q, extra, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  // v23：选中项滚进可见区（键盘 ↑↓ 时）
  useEffect(() => { list.current?.querySelector(`#pal-opt-${sel}`)?.scrollIntoView?.({ block: "nearest" }); }, [sel]);
  if (!open) return null;
  const go = (it) => { setOpen(false); if (it) nav(it[1]); };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 pt-[12vh]" onMouseDown={() => setOpen(false)} data-testid="palette">
      <div ref={dlg} className="w-[min(92vw,36rem)] border border-ink bg-paper shadow-lg" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr("命令面板")}
        onKeyDown={(e) => { // v23：焦点困在面板里（Tab / Shift+Tab 循环），Esc 关
          if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
          if (e.key !== "Tab") return;
          const f = [...dlg.current.querySelectorAll("input,button")]; if (!f.length) return;
          const a = f.indexOf(document.activeElement); e.preventDefault();
          f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }}>
        <label htmlFor="pal-in" className="sr-only">{tr("搜索页面、零件、场景")}</label>
        <input id="pal-in" ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder={tr("跳到页面、零件、场景…（↑↓ 选，回车打开，Esc 关）")}
          role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" aria-activedescendant={items.length ? `pal-opt-${sel}` : undefined}
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } else if (e.key === "Home" && e.ctrlKey) { e.preventDefault(); setSel(0); } else if (e.key === "End" && e.ctrlKey) { e.preventDefault(); setSel(Math.max(0, items.length - 1)); } else if (e.key === "Enter") go(items[sel]); }}
          className="w-full border-b border-line bg-white px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper" data-testid="palette-input" />
        <ul ref={list} id="pal-list" role="listbox" aria-label={tr("结果")} className="max-h-[50vh] overflow-auto text-sm" data-testid="palette-list">
          {items.map((it, i) => (
            <li key={it[1]} id={`pal-opt-${i}`} role="option" aria-selected={i === sel}><button type="button" tabIndex={-1} onMouseEnter={() => setSel(i)} onClick={() => go(it)} className={`flex w-full gap-2 px-3 py-1.5 text-left ${i === sel ? "bg-ink text-paper-2" : ""}`} data-testid="palette-item">
              <span className={`${lang === "en" ? "w-12" : "w-8"} shrink-0 text-xs opacity-70`}>{tr(it[0])}</span><span className="truncate">{L(it)}</span>{it[3] && <span className="ml-auto shrink-0 font-mono text-[11px] opacity-60">{it[3]}</span>}
            </button></li>
          ))}
          {!items.length && <li role="option" aria-selected="false" aria-disabled="true" className="px-3 py-2 text-ink-soft">{extra.parts.length ? tr("没找到") : tr("正在加载零件索引…")}</li>}
        </ul>
        <p className="sr-only" aria-live="polite">{lang === "en" ? `${items.length} results` : `${items.length} 个结果`}</p>
        <p className="border-t border-line px-3 py-1 text-[11px] text-ink-soft">{tr("我的补充 · Ctrl/⌘ + K 随时打开 · 早期原型，简化仿真")}</p>
      </div>
    </div>
  );
}
