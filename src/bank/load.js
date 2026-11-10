// 页面按需加载题库：先读 index.json，再读 mode/difficulty。纯静态，无 WASM。
export const MODES = ["firmware", "workbench", "assembly", "diagnosis", "code-check"];
export const DIFFICULTIES = ["intro", "intermediate", "advanced"];
export const SOON_MS = 30 * 24 * 3600 * 1000; // 我的补充：staleEarliest 距今 <30 天时黄标

export function bankUrl(path) {
  const base = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
  return String(base).replace(/\/?$/, "/") + String(path).replace(/^\//, "");
}

export async function loadIndex(fetchImpl = fetch) {
  const r = await fetchImpl(bankUrl("bank/index.json"));
  if (!r.ok) throw new Error(`index.json HTTP ${r.status}`);
  return r.json();
}
export async function loadBank(mode, difficulty, fetchImpl = fetch) {
  const r = await fetchImpl(bankUrl(`bank/${mode}/${difficulty}.json`));
  if (!r.ok) return [];
  return r.json();
}

// none | soon（黄标）| stale（已过期，不阻断）
export function freshnessFlag(entry, now = Date.now()) {
  if (!entry) return "none";
  if ((entry.staleCount || 0) > 0) return "stale";
  const t = entry.staleEarliest ? Date.parse(entry.staleEarliest) : NaN;
  if (Number.isNaN(t)) return "none";
  if (t < now) return "stale";
  if (t - now <= SOON_MS) return "soon";
  return "none";
}
export function itemStale(item, now = Date.now()) {
  if (item?._stale) return true;
  const t = item?.staleAfter ? Date.parse(item.staleAfter) : NaN;
  return !Number.isNaN(t) && t < now;
}
