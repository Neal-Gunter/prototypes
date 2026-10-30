// v16 我的补充：OCTL/1 行协议（浏览器端）。和固件 octopus_link_core.h 逐字节同一套规则，scripts/link-test.mjs 用 gcc 编的 C 解析器对照。
//   帧   := '@' 序号 ' ' 指令 { ' ' 参数 } '*' CRC '\n'
//   CRC-16/CCITT-FALSE（0x1021，初值 0xFFFF），算 '@' 到 '*' 之前的字节，4 位十六进制
export const PROTO = { name: "OCTL", version: 1, maxLine: 160, maxArgs: 24, maxNum: 15, baud: 115200, watchdogMs: 1500 };

// Nordic UART Service（Nordic Semiconductor 定义的 UUID，md「手机大脑」方案用的同一个服务）
export const NUS = {
  service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  rx: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // 主机 → 板子（write）
  tx: "6e400003-b5a3-f393-e0a9-e50e24dcca9e", // 板子 → 主机（notify）
  name: "OctoBrain",
  chunk: 20, // 默认 MTU 23 → 每包 20 字节
};

export const E = { OK: 0, FORMAT: 1, CRC: 2, LEN: 3, ARGS: 4 };
export const NAK = { 1: "格式错", 2: "CRC 错", 3: "太长", 4: "参数个数错", 5: "未知指令", 6: "超出范围", 7: "电量低", 8: "协议版本不符", 9: "急停锁定中（先发 STOP）" };
export const MODES = ["停", "走", "挥手", "收缩", "回中位", "摆姿势"];
export const FLAGS = { relaxed: 1, lowBatt: 2, imu: 4, estop: 8 };
export const EVT = { 1: "心跳超时，板子自己停下", 2: "BLE 断开，板子自己停下", 3: "电量低" };

// 主机 → 板子指令表（范围和固件 Link::Dispatch 一致）
export const COMMANDS = {
  HELLO: { n: 1, ranges: [[1, 1]] },
  PING: { n: 0 },
  GO: { n: 2, ranges: [[0, 1], [-1, 1]] },
  STOP: { n: 0 },
  ESTOP: { n: 0 },
  POSE: { n: "channels", ranges: "pose" },
  GAIT: { n: 6, ranges: [[0.1, 1.2], [0, 55], [0, 55], [0, 360], [0.3, 0.9], [0, 40]] },
  TRIM: { n: 4, ranges: [[0, 15], [-20, 20], [-55, 0], [0, 55]] },
  RATE: { n: 1, ranges: [[30, 240]] },
  TEL: { n: 1, ranges: [[0, 20]] },
};

export function crc16(str) {
  let c = 0xffff;
  for (let i = 0; i < str.length; i++) {
    c ^= (str.charCodeAt(i) & 0xff) << 8;
    for (let b = 0; b < 8; b++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c;
}
const hex4 = (c) => c.toString(16).toUpperCase().padStart(4, "0");

// 数字 → 记号：最多 2 位小数，不出现指数；NaN → '-'
export function fmtNum(v, dp = 2) {
  if (v == null || Number.isNaN(v)) return "-";
  if (!Number.isFinite(v)) throw new Error("非有限数");
  let s = (Math.round(v * 10 ** dp) / 10 ** dp).toFixed(dp);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  return s;
}

export function encode(seq, cmd, args = [], dp = 2) {
  if (!Number.isInteger(seq) || seq < 0 || seq > 65535) throw new Error("序号越界");
  if (!/^[A-Z]{1,7}$/.test(cmd)) throw new Error("指令名不合法");
  if (args.length > PROTO.maxArgs) throw new Error("参数太多");
  const body = `@${seq} ${cmd}${args.map((a) => " " + (typeof a === "string" ? a : fmtNum(a, dp))).join("")}`;
  const line = `${body}*${hex4(crc16(body))}`;
  if (line.length > PROTO.maxLine) throw new Error("帧太长");
  return line;
}

const NUM_RE = /^-?[0-9]+(\.[0-9]+)?$/;
// 返回 { ok:true, seq, cmd, args } 或 { ok:false, err }；line 不含 '\n'
export function parse(line) {
  if (line.endsWith("\r")) line = line.slice(0, -1);
  if (line.length > PROTO.maxLine) return { ok: false, err: E.LEN };
  if (line.length < 8 || line[0] !== "@") return { ok: false, err: E.FORMAT };
  const star = line.length - 5;
  if (line[star] !== "*") return { ok: false, err: E.FORMAT };
  const h = line.slice(star + 1);
  if (!/^[0-9A-Fa-f]{4}$/.test(h)) return { ok: false, err: E.FORMAT };
  for (let i = 1; i < star; i++) {
    const c = line.charCodeAt(i);
    if (c < 0x20 || c > 0x7e || c === 0x2a || c === 0x40) return { ok: false, err: E.FORMAT };
  }
  if (crc16(line.slice(0, star)) !== parseInt(h, 16)) return { ok: false, err: E.CRC };
  // 和 C 版一样按顺序逐个记号检查（出错码的先后也一致）
  const toks = line.slice(1, star).split(" ");
  let seq = 0, cmd = "";
  const args = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t === "") return { ok: false, err: E.FORMAT };
    if (k === 0) { if (!/^[0-9]{1,5}$/.test(t) || +t > 65535) return { ok: false, err: E.FORMAT }; seq = +t; }
    else if (k === 1) { if (!/^[A-Z]{1,7}$/.test(t)) return { ok: false, err: E.FORMAT }; cmd = t; }
    else {
      if (args.length >= PROTO.maxArgs) return { ok: false, err: E.ARGS };
      if (t === "-") { args.push(NaN); continue; }
      if (t.length > PROTO.maxNum || !NUM_RE.test(t)) return { ok: false, err: E.FORMAT };
      args.push(Number(t));
    }
  }
  if (toks.length < 2) return { ok: false, err: E.FORMAT };
  return { ok: true, seq, cmd, args };
}

// 指令参数检查（主机先查一遍，固件再查一遍）；返回 null 或 NAK 码
export function validate(cmd, args, channels = 8) {
  const spec = COMMANDS[cmd];
  if (!spec) return 5;
  const n = spec.n === "channels" ? channels : spec.n;
  if (args.length !== n) return 4;
  for (let i = 0; i < n; i++) {
    const [lo, hi] = spec.ranges === "pose" ? [-55, 55] : cmd === "TRIM" && i === 0 ? [0, channels - 1] : spec.ranges[i];
    const v = args[i];
    if (Number.isNaN(v) || v < lo || v > hi) return 6;
  }
  return null;
}

// 字节流 → 行（串口 / BLE 分包都走这里）；超长行整行丢弃直到下一个换行
export class LineSplitter {
  constructor(onLine, max = PROTO.maxLine + 2) { this.onLine = onLine; this.max = max; this.buf = ""; this.skip = false; this.overflow = 0; }
  push(chunk) {
    for (const ch of chunk) {
      if (ch === "\n") {
        if (!this.skip && this.buf.length) this.onLine(this.buf.replace(/\r$/, ""));
        this.buf = ""; this.skip = false;
      } else if (!this.skip) {
        this.buf += ch;
        if (this.buf.length > this.max) { this.buf = ""; this.skip = true; this.overflow++; }
      }
    }
  }
}

// TEL 帧 → 对象
export function parseTel(args) {
  if (args.length < 7) return null;
  const [n, up, vbat, roll, pitch, mode, flags, ...a] = args;
  return { n, up, vbat, roll, pitch, mode, flags, relaxed: !!(flags & 1), lowBatt: !!(flags & 2), imu: !!(flags & 4), estop: !!(flags & 8), a };
}
