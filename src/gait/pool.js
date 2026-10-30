// v15（我的补充）：评估 Worker 池。浏览器（Web Worker，个数 = navigator.hardwareConcurrency）和 node（worker_threads）共用。
// spawn() → {send(msg), on(fn), kill()}；每个 Worker 先收 {type:"init", job} 建好评估器，再一条一条收 {type:"eval", id, g, o}。
// 每个 Worker 同时只干一件事；多出来的排队。结果顺序由调用方的 Promise.all 保证 → 和串行搜索结果逐位相同。
export class EvalPool {
  constructor(spawn, n, job) {
    this.n = Math.max(1, n | 0); this.q = []; this.wait = new Map(); this.idle = []; this.nextId = 1; this.evals = 0; this.dead = false;
    this.ws = Array.from({ length: this.n }, () => {
      const w = spawn();
      w.on((m) => {
        if (m?.type !== "res") return;
        const p = this.wait.get(m.id); this.wait.delete(m.id); this.evals++;
        this.idle.push(w); this.pump();
        if (p) (m.err ? p.no(new Error(m.err)) : p.ok(m.r));
      });
      w.send({ type: "init", job }); this.idle.push(w); return w;
    });
  }
  eval(g, o) { if (this.dead) return Promise.resolve(null); return new Promise((ok, no) => { this.q.push({ g, o, ok, no }); this.pump(); }); }
  pump() {
    while (this.idle.length && this.q.length && !this.dead) {
      const w = this.idle.shift(), t = this.q.shift(), id = this.nextId++;
      this.wait.set(id, t); w.send({ type: "eval", id, g: t.g, o: t.o });
    }
  }
  // 取消：排队的立刻返回 null；正在算的 Worker 直接结束
  terminate() { this.dead = true; for (const t of this.q) t.ok(null); this.q = []; for (const [, t] of this.wait) t.ok(null); this.wait.clear(); for (const w of this.ws) try { w.kill(); } catch {} }
}
// Worker 里的那一半：收 init / eval，回 res
export function evalHost(post, makeEvaluator) {
  let ready = null;
  return async (m) => {
    if (m?.type === "init") { ready = makeEvaluator(m.job); return; }
    if (m?.type !== "eval") return;
    try { const ev = await ready; const r = await ev(m.g, m.o); post({ type: "res", id: m.id, r }); }
    catch (e) { post({ type: "res", id: m.id, err: String(e?.message || e) }); }
  };
}
