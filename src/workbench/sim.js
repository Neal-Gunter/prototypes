// 运行时的高频状态（每帧都变），放在 React 之外，避免每帧重渲染。
export const sim = {
  servoAngle: {}, // 实际角度（度），servoId -> deg
  servoTarget: {}, // 目标角度
  analysis: null, // 最近一次电路检查结果
  pinCmd: {}, // GPIO 号 -> 固件最近写入的角度
};

const SPEED = 600; // 度/秒，约等于 MG90S 的 0.1 s/60°

export function stepServos(dt, parts) {
  const a = sim.analysis;
  let movedAny = false;
  for (const p of parts) {
    if (p.type !== "servo") continue;
    if (sim.servoAngle[p.id] == null) sim.servoAngle[p.id] = 90;
    const st = a?.servoStatus?.[p.id];
    if (!st || !st.ok) continue; // 没接好：不动（停在原地）
    const gpioNum = Number(st.gpio.replace("GPIO", ""));
    const cmd = sim.pinCmd[gpioNum];
    if (cmd == null) continue;
    sim.servoTarget[p.id] = cmd;
    const cur = sim.servoAngle[p.id];
    const d = cmd - cur;
    const stepMax = SPEED * dt;
    sim.servoAngle[p.id] = Math.abs(d) <= stepMax ? cmd : cur + Math.sign(d) * stepMax;
    if (Math.abs(sim.servoAngle[p.id] - 90) > 10) movedAny = true;
  }
  return movedAny;
}

export function resetSim() {
  sim.servoAngle = {};
  sim.servoTarget = {};
  sim.pinCmd = {};
}
