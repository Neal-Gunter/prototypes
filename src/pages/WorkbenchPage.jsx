import { Component, useEffect, useRef, useState } from "react";
import { FIRMWARE_LIMITS } from "../workbench/firmware/engine.js";
import { GUIDE_STEPS } from "../workbench/guide.js";
import { PHYSICS_ID } from "../workbench/physics/adapter.js";
import { BOARD_GPIO, PARTS, PWM_LABEL, endpointLabel, pinTestId, roleHint } from "../workbench/model.js";
import BenchScene from "../workbench/scene/BenchScene";
import useWorkbench from "../workbench/useWorkbench.js";

const wideClass = "mx-auto w-full max-w-6xl px-5 sm:px-6 md:px-10";

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <p className="border border-mark bg-paper-2 p-4 leading-7" role="alert">
          这个浏览器没有画出三维场景（{this.state.error.message}）。旁边的按钮仍然可以放置、接线和焊接。
        </p>
      );
    }
    return this.props.children;
  }
}

function issueClass(level) {
  if (level === "bad") return "text-mark";
  if (level === "warn") return "text-copper-deep";
  return "text-ink-soft";
}

export default function WorkbenchPage() {
  const bench = useWorkbench();
  const [dragOver, setDragOver] = useState(false);
  const logRef = useRef(null);
  const phase = GUIDE_STEPS.find((step) => step.id === bench.phase) || GUIDE_STEPS[0];
  const phaseIndex = GUIDE_STEPS.findIndex((step) => step.id === phase.id);
  const firstBad = bench.analysis.issues.find((issue) => issue.level === "bad");
  const arm = bench.analysis.servoList.find((servo) => servo.id === "servo-0");
  const armAngle = bench.servoAngles["servo-0"];

  useEffect(() => {
    document.title = "工作台 · 早期原型";
  }, []);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [bench.log]);

  return (
    <article className={`${wideClass} py-6 md:py-8`}>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-copper-deep" lang="en">
          Early prototype, simplified simulation
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">工作台</h1>
        <p className="mt-3 leading-7 text-ink-soft">
          早期原型。零件外形、电路规则、固件和触手都做了简化。固件在页面里的 JavaScript
          解释器中运行，不是 ESP32‑S3。触手是运动学加弹簧，没有加载 MuJoCo。
        </p>
      </header>

      <section className="mt-6 border border-ink bg-paper-2 p-4" aria-labelledby="guide-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="guide-heading" className="text-lg font-medium">
            引导
          </h2>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              data-testid="guide-toggle"
              type="checkbox"
              className="size-4 accent-copper"
              checked={bench.guide}
              onChange={(event) => bench.dispatch({ type: "guide", value: event.target.checked })}
            />
            引导模式
          </label>
        </div>
        <p className="mt-2 text-sm text-ink-soft" data-testid="guide-step">
          第 {phaseIndex + 1} 步，共 {GUIDE_STEPS.length} 步：{phase.title}
        </p>
        {bench.guide ? (
          <ol className="mt-3 grid gap-2 md:grid-cols-5">
            {GUIDE_STEPS.map((step, index) => {
              const current = step.id === phase.id;
              const done = index < phaseIndex;
              return (
                <li
                  key={step.id}
                  aria-current={current ? "step" : undefined}
                  className={`border px-2 py-2 text-sm leading-6 ${
                    current ? "border-ink bg-ink text-paper-2" : "border-line"
                  }`}
                >
                  <span className="font-medium">
                    {index + 1} {step.title}
                    {done ? " · 已完成" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 leading-7 text-ink-soft">引导已关闭。放置、接线、焊接和运行都还在。</p>
        )}
        {bench.guide ? <p className="mt-3 leading-7">{phase.body}</p> : null}
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="lg:sticky lg:top-14">
          <div
            data-testid="scene-drop"
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const partId = event.dataTransfer.getData("text/plain") || bench.trayDrag;
              if (partId) bench.place(partId);
            }}
            onContextMenu={(event) => event.preventDefault()}
            className={`relative h-[440px] border bg-paper-2 sm:h-[520px] ${
              dragOver ? "border-copper" : "border-ink"
            }`}
          >
            <SceneBoundary>
              <BenchScene
                placements={bench.placements}
                dragPreview={bench.dragPreview}
                wires={bench.wires}
                pendingPin={bench.pendingPin}
                servoAngles={bench.servoAngles}
                tentacles={bench.tentacles}
                reducedMotion={bench.reducedMotion}
                controlsRef={bench.controlsRef}
                onPin={(partId, pinId) => bench.dispatch({ type: "select-pin", partId, pinId })}
                onPreview={(partId, x, z) => bench.dispatch({ type: "preview", partId, x, z })}
                onDrop={(partId, x, z) => bench.dispatch({ type: "drop-3d", partId, x, z })}
                onCancelDrag={() => bench.dispatch({ type: "preview-clear" })}
                onClearPin={() => bench.dispatch({ type: "clear-pin" })}
                beginHeat={bench.beginHeat}
                endHeat={bench.endHeat}
              />
            </SceneBoundary>
            {bench.wires.length > 0 || bench.analysis.passed ? (
              <p
                data-testid="scene-check"
                className={`pointer-events-none absolute left-3 top-3 max-w-sm border bg-paper-2 px-2 py-1 text-sm leading-6 ${
                  bench.analysis.tone === "ok" ? "border-ink text-ink" : "border-mark text-mark"
                }`}
              >
                {bench.analysis.summary}
                {firstBad ? `：${firstBad.text}` : ""}
              </p>
            ) : (
              <p className="pointer-events-none absolute left-3 top-3 max-w-sm border border-ink bg-paper-2 px-2 py-1 text-sm leading-6">
                简化外形。把零件拖进这里，或用右侧按钮放到基板。
              </p>
            )}
            <p className="pointer-events-none absolute bottom-3 left-3 max-w-sm text-xs leading-5 text-ink-soft">
              左键拖已放上的零件，松手后吸到基板。右键转动视角，滚轮缩放。
            </p>
            <button
              type="button"
              onClick={bench.resetView}
              className="absolute bottom-3 right-3 inline-flex min-h-11 items-center border border-ink bg-paper-2 px-3 text-sm hover:bg-ink hover:text-paper-2"
            >
              复位视角
            </button>
          </div>
          <p className="mt-3 leading-7" data-testid="tentacle-readout">
            {arm?.electrical
              ? `1 号触手跟随舵机 A，目标 ${armAngle}°。简化运动学加弹簧，不是 MuJoCo。`
              : "1 号触手停在休息姿态。舵机 A 还没有按简化规则接通。"}
            <span className="ml-2 font-medium tabular-nums" data-testid="servo-angle">
              {arm?.electrical ? `${armAngle}°` : "—"}
            </span>
          </p>
          <p className="text-sm leading-6 text-ink-soft" role="status" data-testid="notice">
            {bench.notice}
          </p>
        </div>

        <div className="space-y-4">
          <section className="border border-ink bg-paper-2 p-4" aria-labelledby="tray-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="tray-heading" className="text-lg font-medium">
                零件盘
              </h2>
              <button
                type="button"
                onClick={bench.resetBench}
                className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2"
              >
                清空零件和连线
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              拖到左侧基板，或点「放到基板」。松手后吸到空位。外形都是简化的。
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {PARTS.filter((part) => !bench.placements[part.id]).map((part) => (
                <li key={part.id}>
                  <button
                    type="button"
                    draggable
                    data-testid={`place-${part.id}`}
                    title={part.summary}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", part.id);
                      event.dataTransfer.effectAllowed = "move";
                      bench.dispatch({ type: "tray-drag", partId: part.id });
                    }}
                    onDragEnd={() => bench.dispatch({ type: "tray-drag", partId: null })}
                    onClick={() => bench.place(part.id)}
                    className="inline-flex min-h-11 cursor-grab items-center border border-ink bg-ink px-3 text-sm text-paper-2 hover:bg-copper-deep"
                  >
                    放到基板：{part.name}
                  </button>
                </li>
              ))}
            </ul>
            <ul className="mt-3 space-y-3">
              {PARTS.filter((part) => bench.placements[part.id]).map((part) => (
                <li key={part.id} className="border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">{part.name}</h3>
                    <button
                      type="button"
                      onClick={() => bench.dispatch({ type: "unplace", partId: part.id })}
                      className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2"
                    >
                      拿回零件盘
                    </button>
                  </div>
                  <p className="text-sm leading-6 text-ink-soft">{part.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {part.pins.map((pin) => {
                      const selected =
                        bench.pendingPin?.partId === part.id && bench.pendingPin?.pinId === pin.id;
                      return (
                        <button
                          key={pin.id}
                          type="button"
                          data-testid={pinTestId(part.id, pin.id)}
                          aria-pressed={selected}
                          onClick={() =>
                            bench.dispatch({
                              type: "select-pin",
                              partId: part.id,
                              pinId: pin.id,
                            })
                          }
                          className={`min-h-11 border px-2 text-left text-sm leading-5 ${
                            selected
                              ? "border-ink bg-ink text-paper-2"
                              : "border-ink bg-paper hover:bg-paper-2"
                          }`}
                        >
                          <span className="block font-medium">{pin.label}</span>
                          <span className={selected ? "text-paper-2/80" : "text-ink-soft"}>
                            {roleHint(pin.role)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <CheckPanel bench={bench} />
          <FirmwarePanel bench={bench} logRef={logRef} />
        </div>
      </div>

      <details className="mt-6 border border-line bg-paper-2 p-4">
        <summary className="min-h-11 cursor-pointer font-medium">以后可以换上的两处接口</summary>
        <div className="mt-3 space-y-3 leading-7 text-ink-soft">
          <p>
            物理现在是 <code>{PHYSICS_ID}</code>。场景只调用{" "}
            <code>src/workbench/physics/adapter.js</code> 里的 <code>createPhysicsAdapter()</code>
            。以后要换 MuJoCo WASM，就在那个函数里返回同一个接口的实现：
            <code>setTargets(angles)</code>、<code>step(dt, reducedMotion)</code>、<code>dispose()</code>
            。不要在别的文件里加载 MuJoCo。当前模型不是 MuJoCo。
          </p>
          <p>
            固件现在是 JavaScript 子集解释器。页面只调用{" "}
            <code>src/workbench/firmware/runner.js</code> 里的 <code>createFirmwareRunner()</code>
            。它把源码交给 Web Worker，worker 只跑 <code>firmware/engine.js</code>
            ，不使用 eval。以后要换真正的 ESP32‑S3 仿真，替换 worker，只要仍然返回 log、servo、done
            这些事件。解释器不是那颗芯片。
          </p>
        </div>
      </details>
    </article>
  );
}

function CheckPanel({ bench }) {
  const { analysis } = bench;
  return (
    <section
      id="check"
      data-testid="check-panel"
      className="border border-ink bg-paper-2 p-4"
      aria-labelledby="check-heading"
    >
      <h2 id="check-heading" className="text-lg font-medium">
        检查
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        下面是这一页的简化规则，用来标出明显接错、没焊、冷焊和缺地。它不能代替真实电路，也不是焊接教程。
      </p>
      <p
        data-testid="check-summary"
        className={`mt-3 text-lg font-medium ${analysis.tone === "bad" ? "text-mark" : "text-ink"}`}
      >
        {analysis.summary}
      </p>
      <ul className="mt-3 space-y-2" data-testid="issue-list">
        {analysis.issues.map((issue) => (
          <li key={issue.id} data-testid={`issue-${issue.id}`} className={`leading-6 ${issueClass(issue.level)}`}>
            {issue.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{PWM_LABEL}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="tool-iron"
          aria-pressed={bench.tool === "iron"}
          onClick={() =>
            bench.dispatch({ type: "tool", tool: bench.tool === "iron" ? "pointer" : "iron" })
          }
          className={`inline-flex min-h-11 items-center px-3 text-sm ${
            bench.tool === "iron"
              ? "bg-copper-deep text-paper-2"
              : "border border-ink bg-ink text-paper-2 hover:bg-copper-deep"
          }`}
        >
          {bench.tool === "iron" ? "烙铁已拿起" : "拿起烙铁"}
        </button>
      </div>
      {bench.wires.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-soft">还没有线。点两个引脚就会拉一根。</p>
      ) : (
        <ul className="mt-3 border-t border-line">
          {bench.wires.map((wire) => (
            <li key={wire.id} data-solder={wire.solder} className="border-b border-line py-3">
              <p className="leading-6">
                {endpointLabel(wire.from)} → {endpointLabel(wire.to)}
              </p>
              <p className="text-sm text-ink-soft">
                {wire.solder === "good"
                  ? "焊好了"
                  : wire.solder === "cold"
                    ? "冷焊"
                    : wire.solder === "heating"
                      ? "加热中"
                      : "未焊"}
                <span className="ml-2 tabular-nums" data-testid={`wire-${wire.id}-heat`}>
                  {Math.round(wire.heat * 100)}%
                </span>
              </p>
              <div className="mt-2 h-2 border border-ink" aria-hidden="true">
                <div className="h-full bg-copper" style={{ width: `${Math.round(wire.heat * 100)}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid={`wire-${wire.id}-hold`}
                  disabled={wire.solder === "good"}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    bench.beginHeat(wire.id);
                  }}
                  onPointerUp={() => bench.endHeat(wire.id)}
                  onPointerCancel={() => bench.endHeat(wire.id)}
                  onKeyDown={(event) => {
                    if (event.repeat) return;
                    if (event.key !== " " && event.key !== "Enter") return;
                    event.preventDefault();
                    bench.beginHeat(wire.id);
                  }}
                  onKeyUp={(event) => {
                    if (event.key !== " " && event.key !== "Enter") return;
                    event.preventDefault();
                    bench.endHeat(wire.id);
                  }}
                  className="inline-flex min-h-11 select-none items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2 disabled:cursor-default disabled:opacity-60"
                >
                  {wire.solder === "good" ? "焊好了" : wire.solder === "cold" ? "按住重焊" : "按住焊接"}
                </button>
                <button
                  type="button"
                  data-testid={`wire-${wire.id}-remove`}
                  onClick={() => bench.dispatch({ type: "remove-wire", wireId: wire.id })}
                  className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2"
                >
                  拆除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FirmwarePanel({ bench, logRef }) {
  return (
    <section
      id="firmware"
      className="border border-ink bg-paper-2 p-4"
      aria-labelledby="firmware-heading"
    >
      <h2 id="firmware-heading" className="text-lg font-medium">
        固件
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        这段程序由 Web Worker 里的 JavaScript 解释器执行，不是 ESP32‑S3。支持 Servo、attach、write、delay、Serial.println、setup
        和 loop。loop 最多跑 {FIRMWARE_LIMITS.maxLoops} 次。舵机只有在接线正确、焊点合格并且供上电时才会动。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="firmware-run"
          disabled={bench.running}
          onClick={bench.runFirmware}
          className="inline-flex min-h-11 items-center bg-ink px-3 text-sm text-paper-2 hover:bg-copper-deep disabled:opacity-60"
        >
          {bench.running ? "运行中" : "运行"}
        </button>
        <button
          type="button"
          data-testid="firmware-stop"
          onClick={bench.stopFirmware}
          className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2"
        >
          停止
        </button>
        <button
          type="button"
          onClick={() => bench.dispatch({ type: "restore-code" })}
          className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2"
        >
          恢复示例程序
        </button>
      </div>
      <label htmlFor="firmware-code" className="mt-4 block text-sm font-medium">
        程序
      </label>
      <textarea
        id="firmware-code"
        data-testid="firmware-code"
        value={bench.code}
        readOnly={bench.running}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        rows={16}
        onChange={(event) => bench.dispatch({ type: "code", code: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          event.preventDefault();
          const target = event.currentTarget;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const next = `${bench.code.slice(0, start)}  ${bench.code.slice(end)}`;
          bench.dispatch({ type: "code", code: next });
          requestAnimationFrame(() => {
            target.selectionStart = start + 2;
            target.selectionEnd = start + 2;
          });
        }}
        className="mt-2 h-64 w-full resize-y border border-ink bg-paper px-3 py-2 font-mono text-sm leading-6"
      />
      <h3 className="mt-4 text-base font-medium">引脚状态</h3>
      <p className="mt-1 text-sm leading-6 text-ink-soft">这一轮运行里解释器写下的角度。没有测量真实电平。</p>
      <div className="mt-2 overflow-x-auto">
        <table data-testid="pin-state" className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-2 pr-3 font-medium">引脚</th>
              <th className="py-2 pr-3 font-medium">简化角色</th>
              <th className="py-2 pr-3 font-medium">最近写入</th>
              <th className="py-2 font-medium">结果</th>
            </tr>
          </thead>
          <tbody>
            {BOARD_GPIO.map((pin) => {
              const write = bench.pinWrites[pin.id];
              return (
                <tr key={pin.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3">{pin.id}</td>
                  <td className="py-2 pr-3">{pin.pwm ? "PWM" : "非 PWM"}</td>
                  <td className="py-2 pr-3 tabular-nums">{write ? `${write.angle}°` : "—"}</td>
                  <td className={`py-2 ${write && !write.applied ? "text-mark" : ""}`}>
                    {write ? write.detail : "这一轮还没有写入"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 className="mt-4 text-base font-medium">串口</h3>
      <p className="mt-1 text-sm leading-6 text-ink-soft">解释器时钟上的输出，不是芯片串口。</p>
      <ol
        ref={logRef}
        data-testid="serial-log"
        aria-live="polite"
        className="mt-2 max-h-40 space-y-1 overflow-auto border border-line bg-paper p-2 font-mono text-sm leading-6"
      >
        {bench.log.length === 0 ? (
          <li className="text-ink-soft">还没有输出。</li>
        ) : (
          bench.log.map((entry) => (
            <li key={entry.id} className={entry.kind === "bad" ? "text-mark" : ""}>
              <span className="text-ink-soft">{entry.t} ms </span>
              {entry.text}
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
