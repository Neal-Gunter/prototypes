// v16 我的补充：三种“线”。都暴露同一个接口：
//   kind, label, isOpen, async open(), async close(), write(line)（line 不含 '\n'），onLine(line), onClose(reason)
// 真实的两种（Web Serial / Web Bluetooth）只能在 Chrome / Edge、HTTPS（或 localhost）下、由一次点击触发打开。
import { LineSplitter, PROTO, NUS } from "./protocol.js";
import { RealClock, rng } from "./clock.js";
import { OctoDevice } from "./device.js";

export function linkSupport(nav = typeof navigator !== "undefined" ? navigator : undefined, ctx = typeof window !== "undefined" ? window : undefined) {
  const secure = !!ctx?.isSecureContext;
  const serial = !!nav?.serial;
  const ble = !!nav?.bluetooth;
  let why = "";
  if (!secure) why = "这个网页不是 HTTPS（或 localhost）打开的，浏览器不给用串口 / 蓝牙。";
  else if (!serial && !ble) why = "这个浏览器不支持 Web Serial / Web Bluetooth。请用电脑上的 Chrome 或 Edge（版本 89 以上）。Firefox、Safari 和 iPhone 上的浏览器都不行。";
  return { secure, serial: secure && serial, ble: secure && ble, why };
}

// ---------- USB 串口（Web Serial） ----------
export class WebSerialTransport {
  constructor({ nav = navigator } = {}) { this.nav = nav; this.kind = "serial"; this.label = "USB 串口"; this.isOpen = false; this.port = null; this.onLine = null; this.onClose = null; }
  async open() {
    if (!this.port) this.port = await this.nav.serial.requestPort(); // 必须在点击里调用
    // 注：很多开发板（带 USB 转串口芯片）打开串口时 DTR/RTS 会让板子复位一次；QT Py S3 原生 USB 一般不会。
    await this.port.open({ baudRate: PROTO.baud });
    try { await this.port.setSignals?.({ dataTerminalReady: true, requestToSend: false }); } catch { /* 不支持就算了 */ }
    this.isOpen = true;
    this.writer = this.port.writable.getWriter();
    this.enc = new TextEncoder();
    const split = new LineSplitter((l) => this.onLine?.(l));
    this.nav.serial.addEventListener?.("disconnect", (this._onDisc = (e) => { if (e.target === this.port) this._closed("USB 线拔掉了"); }));
    this.reading = (async () => {
      const dec = new TextDecoder();
      while (this.isOpen && this.port.readable) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) { const { value, done } = await this.reader.read(); if (done) break; split.push(dec.decode(value, { stream: true })); }
        } catch (e) { this._closed("串口读出错：" + (e?.message || e)); } finally { try { this.reader.releaseLock(); } catch { /* */ } }
      }
    })();
  }
  write(line) { if (!this.isOpen) return false; this.writer.write(this.enc.encode(line + "\n")).catch((e) => this._closed("串口写出错：" + (e?.message || e))); return true; }
  _closed(why) { if (!this.isOpen) return; this.isOpen = false; this.onClose?.(why); }
  async close() {
    const was = this.isOpen; this.isOpen = false;
    try { await this.reader?.cancel(); } catch { /* */ }
    try { this.writer?.releaseLock(); } catch { /* */ }
    try { await this.port?.close(); } catch { /* */ }
    if (was) this.onClose?.("主动断开");
  }
}

// ---------- 蓝牙（Web Bluetooth + Nordic UART Service） ----------
export class BleTransport {
  constructor({ nav = navigator } = {}) { this.nav = nav; this.kind = "ble"; this.label = "蓝牙 BLE"; this.isOpen = false; this.dev = null; this.onLine = null; this.onClose = null; this.q = Promise.resolve(); }
  async open() {
    if (!this.dev) {
      this.dev = await this.nav.bluetooth.requestDevice({ filters: [{ namePrefix: NUS.name }, { services: [NUS.service] }], optionalServices: [NUS.service] });
      this.dev.addEventListener("gattserverdisconnected", () => this._closed("蓝牙断开了"));
    }
    const gatt = await this.dev.gatt.connect(); // 重连时不需要再点一次（同一个已授权设备）
    const svc = await gatt.getPrimaryService(NUS.service);
    this.rx = await svc.getCharacteristic(NUS.rx); // 主机 → 设备（写）
    const tx = await svc.getCharacteristic(NUS.tx); // 设备 → 主机（通知）
    const split = new LineSplitter((l) => this.onLine?.(l)); const dec = new TextDecoder();
    tx.addEventListener("characteristicvaluechanged", (e) => split.push(dec.decode(e.target.value)));
    await tx.startNotifications();
    this.enc = new TextEncoder(); this.isOpen = true;
  }
  write(line) {
    if (!this.isOpen) return false;
    const bytes = this.enc.encode(line + "\n");
    for (let i = 0; i < bytes.length; i += NUS.chunk) {
      const part = bytes.slice(i, i + NUS.chunk);
      this.q = this.q.then(() => (this.rx.writeValueWithoutResponse ? this.rx.writeValueWithoutResponse(part) : this.rx.writeValue(part))).catch((e) => this._closed("蓝牙写出错：" + (e?.message || e)));
    }
    return true;
  }
  _closed(why) { if (!this.isOpen) return; this.isOpen = false; this.onClose?.(why); }
  async close() { const was = this.isOpen; this.isOpen = false; try { this.dev?.gatt?.disconnect(); } catch { /* */ } if (was) this.onClose?.("主动断开"); }
}

// ---------- 模拟设备（浏览器里的虚拟板子；不是实物） ----------
export const MOCK_PRESETS = {
  serial: { latencyMs: 4, jitterMs: 3, drop: 0, corrupt: 0.002, chunk: 64 },
  ble: { latencyMs: 30, jitterMs: 15, drop: 0.02, corrupt: 0.003, chunk: 20 },
};
export class MockTransport {
  constructor({ clock = new RealClock(), flavor = "ble", device = null, seed = 11, ...opt } = {}) {
    this.clock = clock; this.flavor = flavor; this.kind = "mock"; this.label = `模拟设备（${flavor === "ble" ? "像蓝牙" : "像串口"}，不是实物）`;
    Object.assign(this, MOCK_PRESETS[flavor] || MOCK_PRESETS.ble, opt);
    this.rand = rng(seed);
    this.device = device || new OctoDevice({ noise: true, seed: seed + 1, drift: 2e-4 });
    this.device.onLine = (l) => this._send(l, "up");
    this.isOpen = false; this.onLine = null; this.onClose = null; this.writes = 0;
    this.blackholeUntil = 0; this.frozenUntil = 0; this.unpluggedUntil = 0; this.lastAt = { up: 0, down: 0 }; this.timers = new Set();
    this.stats = { sent: 0, dropped: 0, corrupted: 0 };
    this.last = clock.now();
    this.tick = clock.every(10, () => {
      const now = clock.now(), dt = now - this.last; this.last = now;
      if (now < this.frozenUntil) return; // 固件卡死：时间不走，也不回包
      this.device.advance(Math.min(dt, 200));
    });
  }
  async open() {
    if (this.clock.now() < this.unpluggedUntil) throw new Error("模拟：线还没插回去");
    this.isOpen = true;
  }
  write(line) { if (!this.isOpen) return false; this.writes++; this._send(line, "down"); return true; }
  _send(line, dir) {
    if (dir === "down" ? !this.isOpen : false) return;
    const now = this.clock.now();
    this.stats.sent++;
    if (now < this.blackholeUntil || (dir === "up" && !this.isOpen)) { this.stats.dropped++; return; }
    if (this.rand() < this.drop) { this.stats.dropped++; return; }
    if (this.rand() < this.corrupt) { // 翻一个字符：CRC 必须抓住它
      const i = Math.floor(this.rand() * line.length); const c = line.charCodeAt(i) ^ (1 << Math.floor(this.rand() * 5));
      line = line.slice(0, i) + String.fromCharCode(c >= 32 && c < 127 && c !== 10 ? c : 63) + line.slice(i + 1); this.stats.corrupted++;
    }
    // 保序：串口 / BLE 不会乱序
    const at = Math.max(now + this.latencyMs + (this.rand() * 2 - 1) * this.jitterMs, this.lastAt[dir]);
    this.lastAt[dir] = at;
    const id = this.clock.setTimeout(() => {
      this.timers.delete(id);
      if (dir === "down") { if (this.clock.now() >= this.frozenUntil) this.device.receive(line); }
      else if (this.isOpen) this.onLine?.(line);
    }, at - now);
    this.timers.add(id);
  }
  // 故障注入
  fault(kind, ms = 3000) {
    const now = this.clock.now();
    if (kind === "drop") this.blackholeUntil = now + ms; // 走出信号范围：两边都收不到，线却“没断”
    else if (kind === "freeze") this.frozenUntil = now + ms;
    else if (kind === "brownout") this.device.brownout();
    else if (kind === "unplug") {
      this.unpluggedUntil = now + ms;
      if (this.flavor === "ble") this.device.disconnect();
      if (this.isOpen) { this.isOpen = false; this.onClose?.(this.flavor === "ble" ? "蓝牙断开了（模拟）" : "USB 线拔掉了（模拟）"); }
    }
  }
  async close() { const was = this.isOpen; this.isOpen = false; if (this.flavor === "ble") this.device.disconnect(); if (was) this.onClose?.("主动断开"); }
  destroy() { this.isOpen = false; this.clock.cancel(this.tick); for (const id of this.timers) this.clock.clearTimeout(id); this.timers.clear(); }
}
