import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { containerClass } from "../container";
import CommandPalette from "./CommandPalette.jsx";
import { useLang, tr } from "../i18n.js";

function navClass({ isActive }) {
  return `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-3 text-base ${
    isActive
      ? "text-ink underline decoration-copper decoration-2 underline-offset-8"
      : "text-ink-soft hover:text-ink"
  }`;
}

// 这些页面是能交互的早期原型（不是纯概念图）
const PROTO_PATHS = ["/workbench", "/assembly", "/parts", "/credits", "/repair", "/project"];

export default function Layout() {
  const { pathname } = useLocation();
  const [lang, setLang] = useLang();
  const en = lang === "en";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a className="skip-link" href="#main">
        {tr("跳到内容")}
      </a>
      <div className="no-print sticky top-0 z-40 bg-ink px-4 py-2 text-center text-sm leading-6 text-paper-2">
        {PROTO_PATHS.some((p) => pathname.startsWith(p)) ? (
          <p data-testid="banner">
            {en ? <>Early prototype, simplified simulation<span className="hidden sm:inline"> · <span lang="zh-Hans">早期原型，简化仿真</span></span></> : <>早期原型，简化仿真<span className="hidden sm:inline"> · <span lang="en">Early prototype, simplified simulation</span></span></>}
          </p>
        ) : (
          <p data-testid="banner">{en ? <>Concept demo, not a finished product<span className="hidden sm:inline"> · <span lang="zh-Hans">概念演示，不是成品</span></span></> : <>概念演示，不是成品<span className="hidden sm:inline"> · <span lang="en">Concept demo, not a finished product</span></span></>}</p>
        )}
      </div>
      <div className="relative flex flex-1 flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-8 border-r border-mark md:block print:hidden"
        />
        <div className="flex flex-1 flex-col md:pl-8 print:pl-0">
          <header className="border-b border-line">
            <div
              className={`${containerClass} flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3`}
            >
              <NavLink to="/" end className="inline-flex min-h-11 shrink-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full bg-copper"
                />
                <span className="text-lg font-medium tracking-tight">{tr("硬件验证")}</span>
                <span className="border border-line px-1.5 py-0.5 text-xs text-ink-soft">
                  {tr("概念")}
                </span>
              </NavLink>
              <nav aria-label={tr("页面")} className="order-3 flex min-w-0 basis-full items-center overflow-x-auto [scrollbar-width:thin]" data-testid="main-nav">
                <NavLink to="/" end className={navClass}>
                  {tr("首页")}
                </NavLink>
                <NavLink to="/example" className={navClass}>
                  {tr("示例")}
                </NavLink>
                <NavLink to="/workbench" className={navClass}>
                  {tr("工作台")}
                </NavLink>
                <NavLink to="/assembly" className={navClass}>
                  {tr("装配台")}
                </NavLink>
                <NavLink to="/assembly/model" className={navClass}>
                  {tr("模型 + 功能图")}
                </NavLink>
                <NavLink to="/project" className={navClass} data-testid="nav-project">
                  {tr("动手做")}
                </NavLink>
                <NavLink to="/repair" className={navClass}>
                  {tr("维修关卡")}
                </NavLink>
                <NavLink to="/parts" className={navClass}>
                  {tr("零件库")}
                </NavLink>
                <NavLink to="/pinouts" className={navClass}>
                  {tr("引脚表")}
                </NavLink>
                <NavLink to="/credits" className={navClass}>
                  {tr("素材与许可")}
                </NavLink>
              </nav>
              <button type="button" onClick={() => window.dispatchEvent(new Event("open-palette"))} className="inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap border border-line px-2 text-xs text-ink-soft hover:text-ink" title={tr("命令面板：跳到页面、零件、场景")} data-testid="palette-btn">
                {tr("搜索跳转")} <kbd className="hidden font-mono sm:inline">Ctrl/⌘ K</kbd>
              </button>
              <button type="button" onClick={() => setLang(en ? "zh" : "en")} className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap border border-line px-2 text-xs text-ink-soft hover:text-ink" aria-label={en ? "切换到中文界面" : "Switch the UI to English"} title={tr("切换界面语言")} data-testid="lang-toggle" data-lang={lang}>
                {en ? "中文" : "EN"}
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            <Outlet />
          </main>
          <CommandPalette />
          <footer className="border-t border-line">
            <div className={`${containerClass} py-8 text-sm leading-6 text-ink-soft`}>
              <p>{tr("硬件验证 · 概念演示")}</p>
              <p className="mt-1" data-testid="lang-note">界面以中文为主（我的补充）：零件名、数据手册术语和代码保留英文原文。<span lang="en"> The UI is Chinese-first; part names, datasheet terms and code stay in English. v24: an English UI toggle (EN button in the header, remembered on this device) covers the navigation, banner, command palette, bench tour and the main workbench labels; guides, part descriptions, simulation messages and most page body text are still Chinese only.</span></p>
              <p className="mt-1 max-w-2xl">
                页面不会加载 MuJoCo，也不会模拟 ESP32‑S3 / RP2040 芯片：固件由 JS 写的迷你解释器运行；焊接台的舵机物理是简化弹簧模型，装配台的碰撞用 Rapier 刚体引擎（简化碰撞盒）。等候名单里的邮箱和回答都不会发出去，也不会保存。
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
