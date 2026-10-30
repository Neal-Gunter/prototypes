import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await p.goto("http://localhost:4173/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForTimeout(1500);
for (const k of [process.argv[2] || "B-plus"]) {
await p.evaluate(() => { window.__octoBuilt = null; }); await p.click(`[data-testid=octo-preset-${k}]`);
await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await p.waitForTimeout(2000);
const r = await p.evaluate(() => {
  const e = window.__asm.engine, R = e.R;
  const parts = [...e.parts.entries()];
  const lab = (u) => e.parts.get(u).label || e.parts.get(u).opts?.label || e.parts.get(u).def.id;
  const frame = parts.find(([u, x]) => x.def.id === "p-octo-frame");
  const C = e.worldPose(frame[0]).p;
  // 按名字找每条触手的模块零件（俯仰支架、俯仰舵机、触手）
  const mod = (a) => parts.filter(([u, x]) => { const l = String(x.label || ""); return new RegExp(`^${a} 号(俯仰舵机支架|触手舵机（俯仰）|触手)$`).test(l); }).map(([u]) => u);
  const cols = (uids) => { const out = []; for (const u of uids) { const pt = e.parts.get(u); const bd = e.bodies.get(pt.body); const list = bd.colliders.get(u) || []; for (const { col } of list) out.push({ u, shape: col.shape, t: col.translation(), q: col.rotation() }); } return out; };
  const res = {};
  const labels = parts.slice(0, 3).map(([u, x]) => Object.keys(x));
  for (const a of [1, 2]) {
    const m1 = mod(a), m2 = mod(a + 1);
    if (!m1.length) { res.err = { labels, sample: parts.slice(0, 60).map(([u, x]) => x.label) }; break; }
    const c1 = cols(m1), c2 = cols(m2);
    const th = (k) => ((-90 + k * 45) * Math.PI) / 180;
    const piv = (k) => ({ x: C.x + 3.8 * Math.cos(th(k)), z: C.z + 3.8 * Math.sin(th(k)) });
    const rot = (c, k, d) => { const P = piv(k), dx = c.t.x - P.x, dz = c.t.z - P.z; const cs = Math.cos(d), sn = Math.sin(d); const t = { x: P.x + cs * dx + sn * dz, y: c.t.y, z: P.z - sn * dx + cs * dz }; const qy = { x: 0, y: Math.sin(d / 2), z: 0, w: Math.cos(d / 2) }; const q = c.q; const m = { w: qy.w * q.w - qy.y * q.y, x: qy.w * q.x + qy.y * q.z, y: qy.w * q.y + qy.y * q.w, z: qy.w * q.z - qy.y * q.x }; return { t, q: m }; };
    let hit = null;
    // 两条相向转：+δ / -δ（three.js 绕 +y 转），也试反向
    for (const sgn of [1, -1]) {
      for (let deg = 0; deg <= 40; deg += 0.5) {
        const d = (deg * Math.PI) / 180; let found = null;
        for (const x of c1) { const A = rot(x, a, sgn * d); for (const y of c2) { const Bq = rot(y, a + 1, -sgn * d); if (x.shape.intersectsShape(A.t, A.q, y.shape, Bq.t, Bq.q)) { found = [lab(x.u), lab(y.u)]; break; } } if (found) break; }
        if (found) { res[`arm${a}-${a + 1} sgn${sgn}`] = { relDeg: 2 * deg, found }; hit = 1; break; }
      }
      if (!hit) res[`arm${a}-${a + 1} sgn${sgn}`] = "none ≤80°"; hit = null;
    }
  }
  return res;
});
console.log(k, JSON.stringify(r, null, 1));
}
await b.close();
