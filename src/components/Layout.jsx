import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { containerClass } from "../container";

function navClass({ isActive }) {
  return `inline-flex min-h-11 items-center px-3 text-base ${
    isActive
      ? "text-ink underline decoration-copper decoration-2 underline-offset-8"
      : "text-ink-soft hover:text-ink"
  }`;
}

export default function Layout() {
  const { pathname } = useLocation();
  const isWorkbench = pathname === "/workbench";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a className="skip-link" href="#main">
        跳到内容
      </a>
      <div className="sticky top-0 z-40 bg-ink px-4 py-2 text-center text-sm leading-6 text-paper-2">
        <p lang="en">
          {isWorkbench
            ? "Early prototype, simplified simulation"
            : "Concept mock, not a working product"}
        </p>
      </div>
      <div className="relative flex flex-1 flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-8 border-r border-mark md:block"
        />
        <div className="flex flex-1 flex-col md:pl-8">
          <header className="border-b border-line">
            <div
              className={`${containerClass} flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3`}
            >
              <NavLink to="/" end className="inline-flex min-h-11 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full bg-copper"
                />
                <span className="text-lg font-medium tracking-tight">硬件验证</span>
                <span className="border border-line px-1.5 py-0.5 text-xs text-ink-soft">
                  {isWorkbench ? "原型" : "概念"}
                </span>
              </NavLink>
              <nav aria-label="页面" className="flex items-center">
                <NavLink to="/" end className={navClass}>
                  首页
                </NavLink>
                <NavLink to="/example" className={navClass}>
                  示例
                </NavLink>
                <NavLink to="/workbench" data-testid="nav-workbench" className={navClass}>
                  工作台
                </NavLink>
              </nav>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            <Outlet />
          </main>
          <footer className="border-t border-line">
            <div className={`${containerClass} py-8 text-sm leading-6 text-ink-soft`}>
              <p>硬件验证 · 概念演示</p>
              <p className="mt-1 max-w-2xl">
                {isWorkbench
                  ? "工作台里的固件由页面内的 JavaScript 解释器执行，不是 ESP32‑S3 仿真。触手用简化运动模型，没有加载 MuJoCo。等候名单里的邮箱和回答都不会发出去，也不会保存。"
                  : "页面不会加载 MuJoCo，也不会模拟 ESP32‑S3。等候名单里的邮箱和回答都不会发出去，也不会保存。"}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
