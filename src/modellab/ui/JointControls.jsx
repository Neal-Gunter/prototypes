// v12：关节运行面板（模型页和装配台共用）：每个关节一个滑块 + 测试，功能播放，姿态调用，时间轴播放
import { useEffect, useState } from "react";
import { JOINT_TYPES, unitOf } from "../artic.js";

const btn = "min-h-8 border border-line bg-white px-2 text-xs hover:border-copper disabled:opacity-40";
export default function JointControls({ core, project, pen, onSavePose, onPlayFn, compact = false }) {
  const [stats, setStats] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [lost, setLost] = useState(null);
  const [pm, setPm] = useState(null);
  useEffect(() => {
    setStats([]); setLost(null);
    if (!core) return;
    const t = setInterval(() => {
      if (!core.alive()) { setLost(core.lost); return; }
      setStats(core.stats()); setPlaying(core.playing());
      if (pen) setPm(pen());
    }, 100);
    return () => clearInterval(t);
  }, [core, pen]);
  if (!core) return null;
  if (lost) return <p className="text-xs text-mark" data-testid="joints-lost">⚠ {lost}。重新放入模型即可恢复。</p>;
  const fns = (project.functions || []).filter((f) => (f.joints || []).some((id) => core.J.has(id)));
  const keys = project.timeline?.keys || [];
  return (
    <div className="space-y-2 text-xs" data-testid="joint-controls">
      {pm && <p className="font-mono" data-testid="lab-pen">穿透：当前最深 {pm.mm.toFixed(3)} mm（关节两侧那一对不算）· 接触 {pm.contacts} 对</p>}
      {playing && <p className="text-copper" data-testid="playing">▶ 正在播放：{playing} <button className="ml-1 underline" onClick={() => core.stop()}>停</button></p>}
      <ul className="space-y-1.5">
        {stats.map((s) => {
          const st = core.J.get(s.id), u = unitOf(s.type);
          if (!st) return null;
          return (
            <li key={s.id} data-joint={s.id} className="border border-line bg-white p-1.5">
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="text-ink-soft">{JOINT_TYPES[s.type]} · {st.dp.label}</span>
              </div>
              {s.type === "ball" ? (
                <p className="mt-0.5">摆角 {s.value.toFixed(1)}°（软限位 {s.limits.max}°，没有马达，靠重力 / 碰撞 / 拖动）</p>
              ) : (
                <>
                  <input type="range" className="w-full" aria-label={`${s.name} 目标`} data-testid={`slider-${s.id}`} min={s.limits.min} max={s.limits.max} step={s.type === "prismatic" ? 0.5 : 1} value={s.target}
                    onChange={(e) => { core.stop(); core.setTarget(s.id, +e.target.value); }} disabled={!st.dp.on} />
                  <div className="flex flex-wrap items-center gap-x-2 font-mono">
                    <span>实际 {s.value.toFixed(1)}{u}</span><span>目标 {s.target.toFixed(1)}{u}</span><span className="text-ink-soft">限位 {s.limits.min}…{s.limits.max}{u}</span>
                    {st.dp.on && <span className={s.load > 80 ? "text-mark" : ""}>负载 {s.load.toFixed(0)}%（估算）</span>}
                    {s.stalled && <span className="text-mark" data-testid={`stall-${s.id}`}>堵转 / 被挡住</span>}
                    <button className={btn + " ml-auto"} data-testid={`test-${s.id}`} disabled={!st.dp.on} onClick={() => core.testSweep(s.id)}>测试</button>
                  </div>
                  {!st.dp.on && <p className="text-ink-soft">没有驱动：只能被推 / 被重力带着动</p>}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {fns.length > 0 && (
        <div><span className="font-medium">按功能播放：</span>{fns.map((f) => (
          <button key={f.id} className={btn + " ml-1 mt-1"} data-testid={`play-fn-${f.id}`} onClick={() => (onPlayFn ? onPlayFn(f) : core.playFunction(f))}><span style={{ color: f.color }}>■</span> {f.name}</button>))}</div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-medium">姿态：</span>
        {(project.poses || []).map((p) => <button key={p.id} className={btn} data-testid={`pose-${p.id}`} onClick={() => { core.stop(); core.setTargets(p.values); }}>{p.name}</button>)}
        {onSavePose && <button className={btn} data-testid="save-pose" onClick={() => onSavePose(core.targets())}>+ 存当前姿态</button>}
        <button className={btn} onClick={() => { core.stop(); core.setTargets(Object.fromEntries([...core.J].map(([k, st]) => [k, st.j.home || 0]))); }}>回中</button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-medium">时间轴：</span>{keys.length} 个关键帧{keys.length ? `，${keys[keys.length - 1].t.toFixed(1)} s` : ""}{project.timeline?.loop ? "，循环" : ""}
        <button className={btn} data-testid="play-timeline" disabled={!keys.length} onClick={() => core.playTimeline(project)}>▶ 播放</button>
        <button className={btn} onClick={() => core.stop()}>■ 停</button>
      </div>
      {!compact && <p className="text-ink-soft">舵机 = Rapier 力控位置马达：最大扭矩取 datasheet 堵转扭矩，转速取 datasheet 空载速度；“负载”按位置误差估算。</p>}
    </div>
  );
}
