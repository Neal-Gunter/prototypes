// “大模型”替身（模拟）：把一句中文按关键词规则翻成 MCP 工具调用。真实小智是 语音 → 云端 ASR/LLM → MCP 调用。
const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function num(s) {
  if (s == null) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return +s;
  if (s.length === 1 && s in CN) return CN[s];
  if (s.startsWith("十")) return 10 + (CN[s[1]] || 0);
  if (s.length >= 2 && s[1] === "十") return CN[s[0]] * 10 + (CN[s[2]] || 0);
  return null;
}
const N = "(\\d+(?:\\.\\d+)?|[零〇一二两三四五六七八九十]+)";
// 返回 { calls: [{tool, args}], serial: "GO" 之类（蓝牙串口模式用）, zh: 解释 }
export function parseNL(text) {
  const t = (text || "").replace(/\s+/g, "");
  const m = (re) => t.match(new RegExp(re));
  let r;
  if (!t) return { calls: [], zh: "没听清" };
  if ((r = m(`(步态|频率|幅度|摆幅|相位)`))) {
    const a = {};
    let x;
    if ((x = m(`频率${N}`))) a.freq = Math.round(num(x[1]) * (num(x[1]) < 2.5 ? 10 : 1));
    if ((x = m(`(?:幅度|摆幅)${N}`))) a.amplitude = num(x[1]);
    if ((x = m(`相位${N}`))) a.phase = num(x[1]);
    if (Object.keys(a).length) return { calls: [{ tool: "self.octopus.set_gait", args: a }], serial: `GAIT ${a.freq ? `F=${a.freq / 10} ` : ""}${a.amplitude != null ? `YAW=${a.amplitude} ` : ""}${a.phase != null ? `PHASE=${a.phase}` : ""}`.trim(), zh: "调步态参数" };
  }
  if ((r = m(`(?:挥|招)(?:一?下)?${N}?号?(?:手|触手)?`)) && /挥|招/.test(t)) {
    const x = m(`${N}号`) || m(`挥${N}`);
    const arm = x ? Math.max(0, Math.min(7, num(x[1]))) : 0;
    return { calls: [{ tool: "self.octopus.move", args: { action: "wave", arm } }], serial: `WAVE ${arm}`, zh: `挥 ${arm} 号触手` };
  }
  if (/收缩|脉冲|缩一缩|呼吸/.test(t)) {
    const x = m(`${N}(?:次|下)`);
    const n = x ? num(x[1]) : 1;
    return { calls: [{ tool: "self.octopus.move", args: { action: "pulse", steps: n } }], serial: `PULSE ${n}`, zh: `收缩 ${n} 次` };
  }
  if (/回中|归位|站好|回到中间/.test(t)) return { calls: [{ tool: "self.octopus.move", args: { action: "home" } }], serial: "HOME", zh: "回中位" };
  if (/停|休息|放松|别动|躺/.test(t)) return { calls: [{ tool: "self.octopus.move", args: { action: "rest" } }], serial: "STOP", zh: "停下放松" };
  if (/左转|往左|向左/.test(t) || /右转|往右|向右/.test(t) || /爬|走|前进|往前|向前|过来/.test(t)) {
    const x = m(`${N}步`);
    const steps = x ? num(x[1]) : 3;
    const dir = /左/.test(t) ? -100 : /右/.test(t) ? 100 : 0;
    const speed = /快/.test(t) ? 600 : /慢/.test(t) ? 1600 : 1000;
    return { calls: [{ tool: "self.octopus.move", args: { action: "crawl", steps, direction: dir, speed } }], serial: dir < 0 ? "LEFT" : dir > 0 ? "RIGHT" : "GO", zh: `${dir < 0 ? "左转" : dir > 0 ? "右转" : "往前"}爬 ${steps} 步${speed !== 1000 ? (speed < 1000 ? "（快）" : "（慢）") : ""}` };
  }
  return { calls: [], zh: "这句没对上任何动作（模拟的“大模型”只认：往前爬 N 步 / 左转 / 右转 / 挥 N 号手 / 收缩 N 次 / 回中 / 停 / 步态 频率 幅度 相位）" };
}
