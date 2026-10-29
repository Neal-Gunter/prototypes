import { useEffect } from "react";
import { Link } from "react-router-dom";
import { containerClass } from "../container";

export default function NotFoundPage() {
  useEffect(() => {
    document.title = "没有这个页面 · 硬件验证概念";
  }, []);

  return (
    <section className={`${containerClass} py-20`}>
      <h1 className="text-3xl font-medium tracking-tight">没有这个页面</h1>
      <p className="mt-3 leading-7 text-ink-soft">这个地址不在概念演示里。</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2"
      >
        回到首页
      </Link>
    </section>
  );
}
