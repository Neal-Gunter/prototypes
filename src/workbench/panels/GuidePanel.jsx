import { useEffect, useMemo } from "react";
import { useBench } from "../store";
import { pinDisplayName } from "../parts";

export function useGuide(analysis, wiringOnly) {
  const parts = useBench((s) => s.parts);
  const fw = useBench((s) => s.fw);
  const moved = useBench((s) => s.movedOnce);
  return useMemo(() => {
    const servo = parts.find((p) => p.type === "servo");
    const placed = parts.some((p) => p.type === "esp32") && !!servo && parts.some((p) => p.type === "battery");
    const recs = servo
      ? [
          { a: `${servo.id}.SIG`, b: "esp32.GPIO4", why: "信号线（橙）接 GPIO4，示例代码用的就是它" },
          { a: `${servo.id}.VCC`, b: "battery.+", why: "舵机电源（红）接电池盒 +" },
          { a: `${servo.id}.GND`, b: "battery.-", why: "舵机地（棕）接电池盒 −" },
          { a: "battery.-", b: "esp32.GND", why: "电池盒 − 接 ESP32 GND，这叫共地" },
        ].map((r) => ({ ...r, done: placed && wiringOnly.netOf(r.a).some((p) => p.id === r.b) }))
      : [];
    const wired = placed && Object.values(wiringOnly.servoStatus).some((s) => s.ok) && wiringOnly.errors === 0;
    const soldered = wired && analysis.pass;
    const flashed = soldered && (fw.status === "running" || fw.status === "stopped") && Object.keys(fw.pins).length > 0;
    const done = [placed, wired, soldered, flashed, flashed && moved];
    const current = done.findIndex((d) => !d);
    const unsoldered = analysis.wiredPins.filter((p) => useBench.getState().joints[p] !== "good");
    return { done, current: current < 0 ? 5 : current, recs, unsoldered, servo };
  }, [parts, fw, moved, analysis, wiringOnly]);
}

const STEPS = ["放置零件", "连线", "焊接", "烧录代码", "看它动"];

export default function GuidePanel({ analysis, wiringOnly }) {
  const guided = useBench((s) => s.guided);
  const parts = useBench((s) => s.parts);
  const g = useGuide(analysis, wiringOnly);

  // 在 3D 里高亮当前提示的引脚
  useEffect(() => {
    let hint = [];
    if (guided && g.current === 1) {
      const r = g.recs.find((x) => !x.done);
      if (r) hint = [r.a, r.b];
    } else if (guided && g.current === 2) hint = g.unsoldered.slice(0, 1);
    useBench.setState({ hintPins: hint });
  }, [guided, g]);

  return (
    <section aria-label="引导模式" className="border-b border-line bg-paper-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={guided} onChange={(e) => useBench.getState().setGuided(e.target.checked)} />
          引导模式
        </label>
        <ol className="flex flex-wrap items-center gap-1 text-sm" data-testid="guide-steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              data-done={g.done[i] ? "1" : "0"}
              className={`flex items-center gap-1 px-2 py-1 ${g.done[i] ? "text-mask" : i === g.current ? "bg-ink text-paper-2" : "text-ink-soft"}`}
            >
              <span aria-hidden="true">{g.done[i] ? "✓" : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      {guided && (
        <div className="border-t border-line px-4 py-3 text-sm leading-6" data-testid="guide-hint">
          {g.current === 0 && (
            <p>
              <b>第 1 步：</b>从左边零件盒把 ESP32‑S3、至少一个舵机和电池盒拖到绿色底板上（点一下也行，会放到推荐位置）。
            </p>
          )}
          {g.current === 1 && (
            <div>
              <p>
                <b>第 2 步：</b>选“连线”工具，按下面接四根线。3D 里绿色圈是下一根要接的两个引脚。
              </p>
              <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
                {g.recs.map((r) => (
                  <li key={r.a + r.b} className={r.done ? "text-mask" : ""}>
                    {r.done ? "✓" : "○"} {pinDisplayName(parts, r.a)} → {pinDisplayName(parts, r.b)}
                    <span className="block text-xs text-ink-soft">{r.why}</span>
                  </li>
                ))}
              </ul>
              {wiringOnly.errors > 0 && <p className="mt-1 text-mark">右边“电路检查”里有错误，先改掉。</p>}
            </div>
          )}
          {g.current === 2 && (
            <p>
              <b>第 3 步：</b>选“烙铁”，在每个接线的引脚上<b>按住</b>鼠标：前 0.5 秒加热焊盘，再保持到 1.3 秒送锡。松手太早会虚焊，可以再焊一次。
              还剩 {g.unsoldered.length} 个焊点{analysis.errors > 0 ? "，并且检查里还有错误" : ""}。
            </p>
          )}
          {g.current === 3 && (
            <p>
              <b>第 4 步：</b>在下面的固件编辑器里看一下示例代码（舵机接 GPIO4），点“烧录并运行”。
            </p>
          )}
          {g.current === 4 && (
            <p>
              <b>第 5 步：</b>看右边机器人：触手 1 会跟着舵机 1 的角度摆动。如果没动，看串口里的 [仿真] 提示。
            </p>
          )}
          {g.current === 5 && (
            <p className="text-mask">
              <b>完成了。</b>触手 1 正在跟着舵机动。可以改代码（比如换角度或 delay），或者再加一个舵机接 GPIO5 驱动触手 2。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
