import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { containerClass } from "../container";

const flow = [
  {
    step: "第一步",
    title: "想法",
    body: "写下要做的机构、舵机和控制器。示例是八条触手，控制器是 ESP32‑S3。",
    to: "/example?tab=idea",
  },
  {
    step: "第二步",
    title: "仿真",
    body: "对照机械与物理（MuJoCo WASM），以及 ESP32‑S3 上的固件怎样驱动舵机。示例里这两块是占位。",
    to: "/example?tab=simulate",
  },
  {
    step: "第三步",
    title: "装配",
    body: "按装配和焊接清单逐项做，做完一项勾一项。",
    to: "/example?tab=assemble",
  },
];

const features = [
  {
    title: "机械与物理仿真",
    body: "概念里用 MuJoCo WASM，在浏览器中看机构的机械与物理。",
    to: "/example?tab=simulate",
  },
  {
    title: "固件与 MCU 仿真",
    body: "概念里看 ESP32‑S3 上的固件如何驱动舵机。",
    to: "/example?tab=simulate",
  },
  {
    title: "装配与焊接",
    body: "概念里按顺序给出装配和焊接事项，完成一项勾一项。",
    to: "/example?tab=assemble",
  },
];

const audience = [
  {
    title: "先看机构",
    body: "想在做下去之前，先看机械结构怎么动。",
  },
  {
    title: "先对固件",
    body: "准备用 ESP32‑S3 驱动舵机，想在焊接前看一看固件。",
  },
  {
    title: "按清单装配",
    body: "需要把装配和焊接分成可以勾选的步骤。",
  },
];

const sheet = [
  ["名称", "硬件想法验证"],
  ["路径", "想法 → 仿真 → 装配"],
  ["仿真", "MuJoCo WASM 与 ESP32‑S3"],
  ["状态", "概念演示，不是成品"],
];

function primaryLinkClass() {
  return "inline-flex min-h-11 items-center bg-ink px-4 text-paper-2 hover:bg-copper-deep";
}

function secondaryLinkClass() {
  return "inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2";
}

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [building, setBuilding] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    document.title = "硬件验证 · 概念演示";
  }, []);

  function submitWaitlist(event) {
    event.preventDefault();
    const nextEmail = email.trim();
    const nextBuilding = building.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("请填写有效的邮箱。");
      setSubmitted(null);
      return;
    }
    setError("");
    setSubmitted({ email: nextEmail, building: nextBuilding });
  }

  return (
    <>
      <section>
        <div
          className={`${containerClass} grid items-start gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:gap-16`}
        >
          <div>
            <p className="text-sm font-medium text-copper-deep">给硬件想法用的浏览器概念</p>
            <h1 className="mt-3 max-w-xl text-4xl font-medium leading-tight tracking-tight text-balance sm:text-5xl">
              把一个硬件想法
              <br />
              一次看完
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
              这是一个可点击的概念页面。路径是想法、仿真、装配：先写下想法，再看机械与物理（MuJoCo
              WASM）和 ESP32‑S3 怎样驱动舵机，然后按装配和焊接清单动手。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/example" className={primaryLinkClass()}>
                看示例
              </Link>
              <Link to="/workbench" data-testid="open-workbench" className={secondaryLinkClass()}>
                打开工作台
              </Link>
              <a href="#waitlist" className={secondaryLinkClass()}>
                留下邮箱
              </a>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-ink-soft">
              工作台是单独的一页，早期原型，里面是简化仿真。这一页和示例页仍然是概念演示。
            </p>
          </div>
          <aside className="border border-ink bg-paper-2" aria-label="概念说明">
            <p className="border-b border-ink px-4 py-2 text-sm font-medium">概念说明</p>
            <dl>
              {sheet.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] border-b border-line last:border-b-0"
                >
                  <dt className="border-r border-line px-4 py-3 text-sm text-ink-soft">
                    {label}
                  </dt>
                  <dd className="px-4 py-3 text-sm leading-6">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="flow-heading">
        <div className={`${containerClass} py-14 md:py-20`}>
          <h2 id="flow-heading" className="text-3xl font-medium tracking-tight">
            想法，仿真，装配
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-ink-soft">
            示例页按这个顺序可以点开。
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {flow.map((item) => (
              <li key={item.title}>
                <Link
                  to={item.to}
                  className="flex h-full flex-col border border-line bg-paper-2 p-5 hover:border-ink"
                >
                  <span className="text-sm font-medium text-copper-deep">{item.step}</span>
                  <h3 className="mt-3 text-2xl font-medium">{item.title}</h3>
                  <p className="mt-3 flex-1 leading-7 text-ink-soft">{item.body}</p>
                  <span className="mt-5 text-sm font-medium">打开这一步</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="feature-heading">
        <div className={`${containerClass} py-14 md:py-20`}>
          <h2 id="feature-heading" className="text-3xl font-medium tracking-tight">
            放在一起的三块
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-ink-soft">
            这个概念只包含这三块。本页不会加载它们。
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title}>
                <Link
                  to={feature.to}
                  className="flex h-full flex-col border border-ink bg-paper-2 p-5 hover:bg-ink hover:text-paper-2"
                >
                  <h3 className="text-xl font-medium">{feature.title}</h3>
                  <p className="mt-3 flex-1 leading-7 opacity-80">{feature.body}</p>
                  <span className="mt-5 text-sm font-medium">在示例里查看</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-mask text-paper-2" aria-labelledby="audience-heading">
        <div className={`${containerClass} py-14 md:py-16`}>
          <h2 id="audience-heading" className="text-3xl font-medium tracking-tight">
            适合谁
          </h2>
          <ul className="mt-8 grid gap-8 md:grid-cols-3 md:gap-0">
            {audience.map((item) => (
              <li
                key={item.title}
                className="md:border-l md:border-paper-2/25 md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
              >
                <h3 className="text-xl font-medium">{item.title}</h3>
                <p className="mt-3 leading-7 text-paper-2/85">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="waitlist" className="border-t border-line" aria-labelledby="waitlist-heading">
        <div className={`${containerClass} py-14 md:py-20`}>
          <div className="max-w-2xl">
            <h2 id="waitlist-heading" className="text-3xl font-medium tracking-tight">
              等候名单
            </h2>
            <p className="mt-3 leading-7 text-ink-soft">
              留下邮箱，表示想在它能用的时候得到消息。也可以回答下面的可选问题。提交后的内容只出现在这个页面上，不会发送，也不会保存。
            </p>
            {submitted ? (
              <div role="status" className="mt-6 border border-ink bg-paper-2 p-5">
                <p className="text-lg font-medium">已留在这个页面上</p>
                <p className="mt-2 break-all leading-7">邮箱：{submitted.email}</p>
                {submitted.building ? (
                  <p className="mt-2 whitespace-pre-wrap break-words leading-7">
                    回答：{submitted.building}
                  </p>
                ) : (
                  <p className="mt-2 leading-7">可选问题没有填写。</p>
                )}
                <p className="mt-2 leading-7">
                  这些内容没有发送，也没有保存。刷新或离开这个页面后就不会再看到。
                </p>
              </div>
            ) : (
              <form noValidate className="mt-6" onSubmit={submitWaitlist}>
                <label htmlFor="email" className="block text-sm font-medium">
                  邮箱
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  className="mt-2 w-full min-h-11 border border-ink bg-paper-2 px-3 text-base"
                />
                {error ? (
                  <p role="alert" className="mt-2 text-sm text-mark">
                    {error}
                  </p>
                ) : null}
                <label htmlFor="building" className="mt-5 block">
                  <span className="text-sm font-medium">可选</span>
                  <span className="mt-1 block leading-7">
                    你在做什么？在买零件之前，你用什么来检查它？
                  </span>
                  <span lang="en" className="mt-1 block text-sm leading-6 text-ink-soft">
                    What are you building, and what do you use to check it before you buy parts?
                  </span>
                </label>
                <textarea
                  id="building"
                  name="building"
                  rows={4}
                  value={building}
                  onChange={(event) => setBuilding(event.target.value)}
                  className="mt-2 w-full resize-y border border-ink bg-paper-2 px-3 py-2 text-base"
                />
                <button
                  type="submit"
                  className="mt-4 inline-flex min-h-11 items-center bg-ink px-4 text-paper-2 hover:bg-copper-deep"
                >
                  提交
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
