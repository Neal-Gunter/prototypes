// v14（我的补充）：手写的 sep-CMA-ES（对角协方差的 CMA-ES，Ros & Hansen 2008）。不依赖任何库。
// 在归一化的 [0,1]^n 里搜索：ask() 给一代候选，tell(xs, fs) 按分数（越大越好）更新均值、步长和每一维的方差。
// periodic[i] = true 的维（相位）回绕，其他维超出 [0,1] 就截断（截断后的点参与更新——简单的修复法）。
import { mulberry32, gaussFn } from "./rng.js";
export class SepCMA {
  constructor({ x0, sigma = 0.15, lambda = 0, seed = 1, periodic = [] }) {
    const n = x0.length; this.n = n; this.periodic = periodic;
    this.rnd = mulberry32(seed); this.gauss = gaussFn(this.rnd);
    this.lambda = lambda || 4 + Math.floor(3 * Math.log(n));
    this.mu = Math.floor(this.lambda / 2);
    const w = Array.from({ length: this.mu }, (_, i) => Math.log(this.mu + 0.5) - Math.log(i + 1)), sw = w.reduce((a, b) => a + b, 0);
    this.w = w.map((x) => x / sw); this.mueff = 1 / this.w.reduce((a, b) => a + b * b, 0);
    const me = this.mueff;
    this.cs = (me + 2) / (n + me + 5);
    this.ds = 1 + 2 * Math.max(0, Math.sqrt((me - 1) / (n + 1)) - 1) + this.cs;
    this.cc = (4 + me / n) / (n + 4 + (2 * me) / n);
    const sep = (n + 2) / 3; // sep-CMA 的学习率放大
    this.c1 = Math.min(1, (sep * 2) / ((n + 1.3) ** 2 + me));
    this.cmu = Math.min(1 - this.c1, (sep * 2 * (me - 2 + 1 / me)) / ((n + 2) ** 2 + me));
    this.chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
    this.m = x0.slice(); this.sigma = sigma; this.C = new Array(n).fill(1); this.ps = new Array(n).fill(0); this.pc = new Array(n).fill(0); this.gen = 0;
  }
  repair(x) { return x.map((v, i) => (this.periodic[i] ? v - Math.floor(v) : Math.max(0, Math.min(1, v)))); }
  ask() {
    const out = [];
    for (let k = 0; k < this.lambda; k++) {
      const z = Array.from({ length: this.n }, () => this.gauss());
      out.push(this.repair(this.m.map((m, i) => m + this.sigma * Math.sqrt(this.C[i]) * z[i])));
    }
    return out;
  }
  // 相位维：差值按最近的一圈算
  diff(a, b, i) { let d = a - b; if (this.periodic[i]) d -= Math.round(d); return d; }
  tell(xs, fs) {
    const n = this.n, idx = fs.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]).slice(0, this.mu).map((x) => x[1]);
    const ys = idx.map((k) => xs[k].map((v, i) => this.diff(v, this.m[i], i) / this.sigma));
    const yw = new Array(n).fill(0);
    ys.forEach((y, r) => { for (let i = 0; i < n; i++) yw[i] += this.w[r] * y[i]; });
    this.m = this.repair(this.m.map((m, i) => m + this.sigma * yw[i]));
    const csn = Math.sqrt(this.cs * (2 - this.cs) * this.mueff);
    for (let i = 0; i < n; i++) this.ps[i] = (1 - this.cs) * this.ps[i] + (csn * yw[i]) / Math.sqrt(this.C[i]);
    const psN = Math.hypot(...this.ps);
    const hsig = psN / Math.sqrt(1 - (1 - this.cs) ** (2 * (this.gen + 1))) / this.chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
    const ccn = Math.sqrt(this.cc * (2 - this.cc) * this.mueff);
    for (let i = 0; i < n; i++) {
      this.pc[i] = (1 - this.cc) * this.pc[i] + hsig * ccn * yw[i];
      let r = 0; ys.forEach((y, k) => { r += this.w[k] * y[i] * y[i]; });
      this.C[i] = (1 - this.c1 - this.cmu) * this.C[i] + this.c1 * (this.pc[i] ** 2 + (1 - hsig) * this.cc * (2 - this.cc) * this.C[i]) + this.cmu * r;
      this.C[i] = Math.max(1e-8, Math.min(1e4, this.C[i]));
    }
    this.sigma *= Math.exp((this.cs / this.ds) * (psN / this.chiN - 1));
    this.sigma = Math.max(1e-4, Math.min(0.5, this.sigma));
    this.gen++;
  }
}
