import { useEffect } from "react";
import { attachGpioFromCode, useBench } from "../store";
import { jointState } from "../circuit";

const FAULTS = [
  { key: "cold", title: "一个焊点是虚焊", hint: "通断档量一根导线的两头；放大镜看焊点表面" },
  { key: "swap", title: "信号线接的 GPIO 和代码不一致", hint: "顺着舵机橙线找到它焊在哪个脚，再看代码里 attach() 的数字" },
  { key: "ground", title: "电池和开发板没有共地", hint: "通断档量电池盒 − 和 Feather GND；电压档量电池到开发板时读数会乱跳" },
];
const PEN = { burnt: ["烧坏焊盘", 15], bridge: ["桥连", 10], nick: ["剥线伤铜丝", 5], undo: ["撤销", 2], blind: ["没找到原因就动手改", 10] };

export function useRepairWatcher(analysis) {
  const mode = useBench((s) => s.mode);
  const joints = useBench((s) => s.joints);
  const code = useBench((s) => s.code);
  const fw = useBench((s) => s.fw.status);
  const moved = useBench((s) => s.movedOnce);
  const screws = useBench((s) => s.screws);
  useEffect(() => {
    if (mode !== "repair") return;
    const st = useBench.getState();
    const e = analysis.elec;
    const fixed = {
      cold: jointState(joints, "servo1.VCC") === "good" && analysis.servoStatus.servo1 && !analysis.servoStatus.servo1.reasons.some((r) => r.includes("VCC")),
      swap: (() => {
        const g = attachGpioFromCode(code);
        const sig = analysis.netOf("servo1.SIG").filter((p) => p.gpio != null);
        return g != null && sig.length === 1 && sig[0].gpio === g;
      })(),
      ground: e.same("esp32.GND", "battery.-"),
    };
    for (const k of Object.keys(fixed)) if (fixed[k] && !st.repair.fixedOrder[k]) st.noteFixed(k);
    const all = Object.values(fixed).every(Boolean);
    const mounted = (screws.servo1 || [0, 0]).every((v) => v >= 1);
    if (all && mounted && fw === "running" && moved && !st.repair.done) {
      const rp = useBench.getState().repair;
      let score = 100;
      for (const [k, [, w]] of Object.entries(PEN)) score -= (rp.penalties[k] || 0) * w;
      const found = Object.values(rp.found).filter(Boolean).length;
      st.finishRepair({ score: Math.max(0, score), found, secs: Math.round((Date.now() - rp.startAt) / 1000) });
      st.say("修好了！机器人动起来了", "ok");
    }
  }, [mode, analysis, joints, code, fw, moved, screws]);
}

export default function RepairPanel() {
  const rp = useBench((s) => s.repair);
  const mode = useBench((s) => s.mode);
  if (mode !== "repair") return null;
  let live = 100;
  for (const [k, [, w]] of Object.entries(PEN)) live -= (rp.penalties[k] || 0) * w;
  return (
    <section className="flex flex-col gap-2 border-b border-line pb-3 text-sm" data-testid="repair-panel">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">维修任务：这个机器人不动，找出故障</h2>
        <span className={`px-2 py-0.5 text-xs ${rp.done ? "bg-mask text-paper-2" : "bg-line"}`} data-testid="repair-score">
          {rp.done ? `完成 · ${rp.done.score} 分` : `当前 ${Math.max(0, live)} 分`}
        </span>
      </div>
      <p className="text-xs leading-5 text-ink-soft">
        已知：上电后舵机完全不动。里面有 3 个故障。先用万用表（键 8）和放大镜（手工具点焊盘）找到原因，再动手修：没找到原因就改会扣分。另外舵机还没拧螺丝固定。
      </p>
      <ol className="flex flex-col gap-1.5" data-testid="repair-checklist">
        {FAULTS.map((f, i) => {
          const found = rp.found[f.key];
          const fixed = !!rp.fixedOrder[f.key];
          return (
            <li key={f.key} data-fault={f.key} data-found={found ? "1" : "0"} data-fixed={fixed ? "1" : "0"} className="border-l-2 border-line pl-2 text-xs leading-5">
              <div className="flex items-center gap-2">
                <span className={found ? "text-mask" : "text-ink-soft"}>{found ? "✓ 找到" : "○ 未找到"}</span>
                <span className={fixed ? "text-mask" : "text-ink-soft"}>{fixed ? "· 已修好" : ""}</span>
              </div>
              <div className="font-medium">{found ? f.title : `故障 ${i + 1}：？`}</div>
              {found ? (
                <div className="text-ink-soft">
                  {rp.foundHow[f.key]?.how}：{rp.foundHow[f.key]?.text}
                </div>
              ) : (
                <details>
                  <summary className="cursor-pointer text-ink-soft">提示</summary>
                  <span className="text-ink-soft">{f.hint}</span>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      <details>
        <summary className="cursor-pointer text-xs text-ink-soft">测量记录（{rp.log.length}）</summary>
        <ul className="mt-1 max-h-32 overflow-auto font-mono text-[11px] leading-4" data-testid="repair-log">
          {rp.log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </details>
      <div className="text-xs text-ink-soft">
        扣分：
        {Object.entries(PEN).map(([k, [l, w]]) => (
          <span key={k} className="mr-2">
            {l} {rp.penalties[k] || 0}×{w}
          </span>
        ))}
      </div>
      {rp.done && (
        <p className="bg-mask/10 p-2 text-xs text-mask" data-testid="repair-done">
          完成：用时 {rp.done.secs} 秒，先诊断后修复的故障 {rp.done.found} / 3，得分 {rp.done.score}。评分规则是这个原型自己定的，只用来练习。
        </p>
      )}
    </section>
  );
}
