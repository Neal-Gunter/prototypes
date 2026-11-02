// v28（我的补充）：3D 画布 / 2D canvas 里画出来的字也跟着 EN 开关走。
// 画布文字不在 DOM 里，页面翻译层看不到，所以画之前先过一遍 ct()；语言或词典变化时发 "mt-change"，
// 用 useCanvasLang() 的组件会重画贴图。译文来自同一份词典（手写优先，其余是机器辅助翻译）。
import { useSyncExternalStore } from "react";
import { getLang } from "./i18n";
let ver = 0;
const subs = new Set();
if (typeof window !== "undefined") window.addEventListener("mt-change", () => { ver++; for (const f of subs) f(); });
export function onCanvasLang(f) { subs.add(f); return () => subs.delete(f); }
export function useCanvasLang() { return useSyncExternalStore(onCanvasLang, () => ver, () => 0); }
export function ct(s) {
  if (!s || typeof s !== "string" || getLang() !== "en" || typeof window === "undefined" || !window.__mtActive || !window.__mt) return s;
  return window.__mt(s);
}
