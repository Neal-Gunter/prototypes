import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { containerClass } from "../container";
import ServoDemo from "../components/ServoDemo";
import TentacleFigure from "../components/TentacleFigure";

const tabs = [
  { id: "idea", label: "想法" },
  { id: "simulate", label: "仿真" },
  { id: "assemble", label: "装配" },
];

const facts = [
  ["机构", "八条触手，姿态由舵机改变"],
  ["控制器", "ESP32‑S3"],
  ["固件", "向舵机发出信号"],
  ["一起看", "机械运动、固件驱动、焊接与装配"],
];

const checklist = [
  "把 ESP32‑S3 固定到本体上",
  "核对电源线、地线和信号线的去向",
  "焊接舵机电源线",
  "焊接舵机地线",
  "把舵机信号线焊到 ESP32‑S3",
  "查看焊点，留意连锡和虚焊",
  "固定八条触手，并接上各自的舵机",
  "上电前再核对一遍线的去向",
];

function tabFromParam(value) {
  return tabs.some((tab) => tab.id === value) ? value : "idea";
}

export default function ExamplePage() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParam(params.get("tab"));
  const [checked, setChecked] = useState(() => checklist.map(() => false));
  const checkedCount = checked.filter(Boolean).length;

  useEffect(() => {
    document.title = "八触手机器人 · 硬件验证概念";
  }, []);

  function selectTab(id) {
    setParams({ tab: id });
  }

  function toggleItem(index) {
    setChecked((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? !item : item)),
    );
  }

  return (
    <article>
      <header className={`${containerClass} py-12 md:py-16`}>
        <p className="text-sm font-medium text-copper-deep">示例</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">八触手机器人</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-soft">
          ESP32‑S3 驱动舵机，舵机改变八条触手的姿态。按想法、仿真、装配点开看。仿真里的两块面板是占位。
        </p>
        <p className="mt-3 max-w-2xl leading-7 text-ink-soft">
          这页仍是概念占位。可交互的简化原型在{" "}
          <Link to="/workbench" className="underline decoration-copper decoration-2 underline-offset-4">
            工作台
          </Link>
          。
        </p>
      </header>

      <div className={`${containerClass} pb-16`}>
        <div role="tablist" aria-label="示例步骤" className="grid grid-cols-3 border border-ink">
          {tabs.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(item.id)}
                onKeyDown={(event) => {
                  const index = tabs.findIndex((entry) => entry.id === tab);
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                  event.preventDefault();
                  const direction = event.key === "ArrowRight" ? 1 : -1;
                  const next = tabs[(index + direction + tabs.length) % tabs.length];
                  selectTab(next.id);
                  requestAnimationFrame(() => {
                    document.getElementById(`tab-${next.id}`)?.focus();
                  });
                }}
                className={`min-h-11 border-r border-ink px-2 text-sm font-medium last:border-r-0 sm:text-base ${
                  selected ? "bg-ink text-paper-2" : "bg-paper-2 text-ink hover:bg-paper"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="border border-t-0 border-ink bg-paper-2 p-5 sm:p-6"
        >
          {tab === "idea" ? (
            <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_16rem]">
              <div>
                <h2 className="text-2xl font-medium">想法</h2>
                <p className="mt-3 leading-7 text-ink-soft">
                  这台机器人有八条触手。舵机改变触手的姿态，ESP32‑S3 上的固件向舵机发出信号。
                </p>
                <dl className="mt-6 border-t border-line">
                  {facts.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid gap-1 border-b border-line py-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4"
                    >
                      <dt className="text-sm text-ink-soft">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <TentacleFigure angle={36} caption="八条触手的示意图，不是仿真结果。" />
            </div>
          ) : null}

          {tab === "simulate" ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-medium">仿真</h2>
                <p className="mt-3 max-w-2xl leading-7 text-ink-soft">
                  下面两块是预留位置。舵机滑块单独放在后面，不驱动这两块。
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="hatch min-h-52 border border-dashed border-ink/40 p-5">
                  <p className="inline-block border border-copper-deep px-1.5 py-0.5 text-xs font-medium text-copper-deep">
                    占位
                  </p>
                  <h3 className="mt-4 text-xl font-medium">MuJoCo WASM</h3>
                  <p className="mt-2 text-sm text-ink-soft">机械与物理</p>
                  <p className="mt-4 leading-7">
                    这里预留给浏览器中的机械与物理仿真。当前没有加载 MuJoCo。
                  </p>
                </section>
                <section className="hatch min-h-52 border border-dashed border-ink/40 p-5">
                  <p className="inline-block border border-copper-deep px-1.5 py-0.5 text-xs font-medium text-copper-deep">
                    占位
                  </p>
                  <h3 className="mt-4 text-xl font-medium">ESP32‑S3</h3>
                  <p className="mt-2 text-sm text-ink-soft">固件 / MCU</p>
                  <p className="mt-4 leading-7">
                    这里预留给固件仿真，用来看这颗芯片如何驱动舵机。当前没有模拟 ESP32‑S3。
                  </p>
                </section>
              </div>
              <ServoDemo />
            </div>
          ) : null}

          {tab === "assemble" ? (
            <div>
              <h2 className="text-2xl font-medium">装配</h2>
              <p className="mt-3 max-w-2xl leading-7 text-ink-soft">
                这是演示用的焊接与装配清单。勾选只留在这个页面上，不能当作真实的焊接步骤。
              </p>
              <p className="mt-4 text-sm font-medium">
                {checkedCount === checklist.length
                  ? "清单已全部勾选。"
                  : `${checkedCount} 项已勾选`}
              </p>
              <ul className="mt-4 border-t border-line">
                {checklist.map((item, index) => (
                  <li key={item} className="border-b border-line">
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 accent-copper"
                        checked={checked[index]}
                        onChange={() => toggleItem(index)}
                      />
                      <span className="leading-7">{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
