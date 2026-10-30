// v16：时钟抽象。浏览器用 RealClock；单元测试用 ManualClock（完全确定、可快进）。
export class RealClock {
  now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }
  setTimeout(fn, ms) { return setTimeout(fn, ms); }
  clearTimeout(id) { clearTimeout(id); }
  every(ms, fn) { return setInterval(fn, ms); }
  cancel(id) { clearInterval(id); }
}

export class ManualClock {
  constructor() { this.t = 0; this.q = []; this.id = 0; }
  now() { return this.t; }
  setTimeout(fn, ms) { const id = ++this.id; this.q.push({ id, at: this.t + Math.max(0, ms), fn }); return id; }
  clearTimeout(id) { this.q = this.q.filter((x) => x.id !== id); }
  every(ms, fn) { const id = ++this.id; this.q.push({ id, at: this.t + ms, fn, every: ms }); return id; }
  cancel(id) { this.clearTimeout(id); }
  // 快进 ms：按时间顺序跑到期的定时器（同一时刻按注册顺序）
  advance(ms) {
    const end = this.t + ms;
    for (let guard = 0; guard < 1e7; guard++) {
      let k = -1;
      for (let i = 0; i < this.q.length; i++) if (this.q[i].at <= end && (k < 0 || this.q[i].at < this.q[k].at || (this.q[i].at === this.q[k].at && this.q[i].id < this.q[k].id))) k = i;
      if (k < 0) break;
      const x = this.q[k];
      this.t = Math.max(this.t, x.at);
      if (x.every) x.at += x.every; else this.q.splice(k, 1);
      x.fn();
    }
    this.t = end;
  }
}

// 确定的伪随机（mulberry32）
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
