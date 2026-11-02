// v29（我的补充）：本机“工作台库存”——拆解下来的模块存在 localStorage（bench-inventory），零件库的“拆解所得”视图读它。
export const INV_KEY = "bench-inventory";
export const PROG_KEY = "teardown-progress";
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式 */ } window.dispatchEvent(new Event("inventory-change")); };
export function readInventory() { const v = get(INV_KEY, []); return Array.isArray(v) ? v : []; }
// items: [{ part, from, key, approx }]；同一零件累加数量
export function addToInventory(items) {
  const inv = readInventory();
  for (const it of items) {
    const row = inv.find((r) => r.part === it.part);
    if (row) { row.n += 1; if (!row.from.includes(it.from)) row.from.push(it.from); }
    else inv.push({ part: it.part, n: 1, from: [it.from], approx: !!it.approx, at: Date.now() });
  }
  put(INV_KEY, inv);
  return inv;
}
export function removeFromInventory(part) { put(INV_KEY, readInventory().filter((r) => r.part !== part)); }
export function clearInventory() { put(INV_KEY, []); }
export function readProgress(dev) { return get(PROG_KEY, {})[dev] || { steps: [], mats: [] }; }
export function setProgress(dev, v) { const all = get(PROG_KEY, {}); all[dev] = v; put(PROG_KEY, all); }
