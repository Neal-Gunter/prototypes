import { useEffect, useMemo } from "react";
import { useBench } from "../store";
import { pinDisplayName } from "../parts";

export function useGuide(analysis, wiringOnly) {
  const parts = useBench((s) => s.parts);
  const fw = useBench((s) => s.fw);
  const moved = useBench((s) => s.movedOnce);
  const screws = useBench((s) => s.screws);
  const wires = useBench((s) => s.wires);
  return useMemo(() => {
    const servo = parts.find((p) => p.type === "servo");
    const placed = parts.some((p) => p.type === "esp32") && !!servo && parts.some((p) => p.type === "battery");
    const recs = servo
      ? [
          { a: `${servo.id}.SIG`, b: "esp32.5", why: "信号线（橙）接 GPIO5，示例代码里是 attach(5)" },
          { a: `${servo.id}.VCC`, b: "battery.+", why: "舵机电源（红）接电池盒 +" },
          { a: `${servo.id}.GND`, b: "battery.-", why: "舵机地（棕）接电池盒 −" },
          { a: "battery.-", b: "esp32.GND", why: "电池盒 − 接 ESP32 GND，这叫共地" },
        ].map((r) => ({ ...r, done: placed && wiringOnly.netOf(r.a).some((p) => p.id === r.b) }))
      : [];
    const wired = placed && Object.values(wiringOnly.servoStatus).some((s) => s.ok) && wiringOnly.errors === 0;
    const unstripped = wires.filter((w) => w.strip?.a === "none" || w.strip?.b === "none");
    const soldered = wired && analysis.pass;
    const mounted = !!servo && (screws[servo.id] || [0, 0]).every((v) => v >= 1);
    const flashed = soldered && (fw.status === "running" || fw.status === "stopped") && Object.keys(fw.pins).length > 0;
    const done = [placed, wired, soldered, mounted, flashed, flashed && moved && mounted];
    const current = done.findIndex((d) => !d);
    const unsoldered = analysis.wiredPins.filter((p) => useBench.getState().joints[p]?.state !== "good");
    return { done, current: current < 0 ? 6 : current, recs, unsoldered, unstripped, servo };
  }, [parts, fw, moved, analysis, wiringOnly, screws, wires]);
}

const STEPS = ["放置零件", "剪线连线", "剥线 + 焊接", "拧螺丝固定舵机", "插 USB 烧录", "看它动"];

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
              <b>第 1 步：</b>从左边零件盒把 ESP32‑S3、至少一个舵机和电池盒拖到木底板上（点一下也行，会放到推荐位置）。
            </p>
          )}
          {g.current === 1 && (
            <div>
              <p>
                <b>第 2 步：</b>选“导线”工具（键 3），按下面剪四根线：点一个焊盘，再点另一个。3D 里绿色圈是下一根要接的两个引脚。
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
            <div className="flex flex-col gap-1">
              <p>
                <b>第 3 步：</b>
                {g.unstripped.length > 0 ? (
                  <>
                    先剥线：选“剥线钳”（键 2），孔径选 <b>24 AWG</b>（和导线一样），点每根导线的两头。孔径太小会伤铜丝，太大剥不下来。还有 {g.unstripped.length} 根没剥完。
                  </>
                ) : (
                  <>
                    再焊接：选“烙铁”（键 5，默认 330 °C），在焊盘上<b>按住鼠标</b>先加热，看上面的温度条过了绿线，再<b>按住空格</b>送锡，锡量到绿色区间就松开空格，停半秒再抬起鼠标。
                    还剩 {g.unsoldered.length} 个焊点。
                  </>
                )}
              </p>
              <p className="text-xs text-ink-soft">
                送锡太早（焊盘没热）会虚焊；锡太多会和旁边的焊盘桥连；加热太久焊盘会烧坏。焊坏了可以用吸锡带（键 6）或吸锡器（键 7）拆掉重焊，或者 Ctrl+Z 撤销。
              </p>
            </div>
          )}
          {g.current === 3 && (
            <p>
              <b>第 4 步：</b>选“螺丝刀”（键 9），在舵机两个耳朵的螺丝上<b>按住</b>，拧到底。没固定的舵机转起来只会自己晃，触手几乎不动。
            </p>
          )}
          {g.current === 4 && (
            <p>
              <b>第 5 步：</b>点桌上的 USB‑C 线（或工具栏“插 USB‑C”）把开发板连到电脑，然后在下面的固件编辑器里点“烧录并运行”。
            </p>
          )}
          {g.current === 5 && (
            <p>
              <b>第 6 步：</b>看右边机器人：触手 1 会跟着舵机 1 的角度摆动。下面的串口绘图仪会画出指令角度和实际角度。没动的话看串口里的 [仿真] 提示。
            </p>
          )}
          {g.current === 6 && (
            <p className="text-mask">
              <b>完成了。</b>触手 1 正在跟着舵机动。可以改代码（比如换角度或 delay），或者试试“维修任务”。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
