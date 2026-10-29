import { useEffect, useRef, useState } from "react";
import TentacleFigure from "./TentacleFigure";

export default function ServoDemo() {
  const [angle, setAngle] = useState(90);
  const [held, setHeld] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const angleRef = useRef(90);
  const animate = !reduceMotion && !held;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!animate) return undefined;
    const amplitude = 90;
    const midpoint = 90;
    const current = Math.min(180, Math.max(0, angleRef.current));
    const ratio = (current - midpoint) / amplitude;
    let phase = Math.asin(Math.max(-1, Math.min(1, ratio)));
    let last = performance.now();
    let frame = 0;

    const tick = (now) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      phase += delta * 1.5;
      const next = Math.round(midpoint + Math.sin(phase) * amplitude);
      if (next !== angleRef.current) {
        angleRef.current = next;
        setAngle(next);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  function changeAngle(event) {
    const next = Number(event.target.value);
    angleRef.current = next;
    setAngle(next);
  }

  let motionLabel = "滑块正在自行往复";
  if (reduceMotion) motionLabel = "已按系统设置停住，可以拖动";
  else if (held) motionLabel = "往复已暂停，可以拖动";

  return (
    <div className="grid items-center gap-8 border border-ink bg-paper-2 p-5 sm:p-6 md:grid-cols-2">
      <TentacleFigure
        angle={angle}
        caption="八条触手随这个角度弯曲，只是示意。"
      />
      <div>
        <h3 className="text-lg font-medium">舵机滑块</h3>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          滑块单独演示角度。它不连接上面的占位面板。
        </p>
        <p className="mt-4 font-medium text-6xl tabular-nums leading-none tracking-tight">
          <span aria-hidden="true">{angle}°</span>
        </p>
        <label htmlFor="servo-angle" className="mt-5 block text-sm font-medium">
          舵机角度
        </label>
        <input
          id="servo-angle"
          type="range"
          min={0}
          max={180}
          step={1}
          value={angle}
          aria-valuemin={0}
          aria-valuemax={180}
          aria-valuenow={angle}
          aria-valuetext={`${angle} 度`}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          onChange={changeAngle}
        />
        <p className="text-sm leading-6 text-ink-soft">{motionLabel}</p>
      </div>
    </div>
  );
}
