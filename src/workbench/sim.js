// 运行时的高频状态（每帧都变），放在 React 之外，避免每帧重渲染。
export const sim = {
  servoAngle: {}, // 实际角度（度），servoId -> deg
  servoTarget: {},
  servoDrive: {}, // 0..1：舵机转动能不能传到触手（没固定时只是舵机自己在抖）
  analysis: null,
  pinCmd: {}, // GPIO 号 -> 固件最近写入的角度
  digital: {}, // GPIO 号 -> 0/1
  padT: {}, // 焊盘温度 °C
  hover: null, // 鼠标在桌面上的位置 [x,y,z]
  hoverPin: null,
  smoke: [], // 发烟点 {p:[x,y,z], rate}
  plot: [], // 串口绘图仪数据 {t, values:{name:v}}
  plotNames: [],
  t0: performance.now(),
  shake: {}, // servoId -> 抖动幅度
  ledOn: false,
  neoColor: null,
};

export const AMBIENT = 25;
const SPEED = 600; // 度/秒，约 0.1 s/60°（这类微型舵机的典型标称速度）

export function stepServos(dt, parts, mounted) {
  const a = sim.analysis;
  let movedAny = false;
  for (const p of parts) {
    if (p.type !== "servo") continue;
    if (sim.servoAngle[p.id] == null) sim.servoAngle[p.id] = 90;
    const st = a?.servoStatus?.[p.id];
    sim.servoDrive[p.id] = mounted?.[p.id] ? 1 : 0.12;
    if (!st || !st.ok) {
      sim.shake[p.id] = 0;
      continue;
    }
    const cmd = sim.pinCmd[st.gpio];
    if (cmd == null) continue;
    sim.servoTarget[p.id] = cmd;
    const cur = sim.servoAngle[p.id];
    const d = cmd - cur;
    const stepMax = SPEED * dt;
    sim.servoAngle[p.id] = Math.abs(d) <= stepMax ? cmd : cur + Math.sign(d) * stepMax;
    // 没拧螺丝：反作用力让舵机本体晃
    sim.shake[p.id] = mounted?.[p.id] ? 0 : Math.min(1, Math.abs(d) / 30);
    if (Math.abs(sim.servoAngle[p.id] - 90) > 10 && mounted?.[p.id]) movedAny = true;
  }
  return movedAny;
}

export function pushPlot(values) {
  const t = (performance.now() - sim.t0) / 1000;
  sim.plot.push({ t, values });
  if (sim.plot.length > 400) sim.plot.splice(0, sim.plot.length - 400);
  for (const k of Object.keys(values)) if (!sim.plotNames.includes(k)) sim.plotNames.push(k);
}

export function resetSim() {
  sim.servoAngle = {};
  sim.servoTarget = {};
  sim.pinCmd = {};
  sim.digital = {};
  sim.plot = [];
  sim.plotNames = [];
  sim.shake = {};
  sim.ledOn = false;
}
