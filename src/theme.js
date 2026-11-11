// v44：配色（系统 / 浅色 / 深色）。记在本机 localStorage，键带版本号；坏数据当成“系统”。
// 默认跟随 prefers-color-scheme。真正的 data-theme 在 index.html 的预渲染脚本里先写上，避免闪一下。
import { useSyncExternalStore } from "react";

export const THEME_KEY = "wb-theme-v1";
export const THEME_PREFS = ["system", "light", "dark"];

const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEME_PREFS.includes(v) ? v : "system";
  } catch {
    return "system";
  }
}

export function resolvedTheme(pref = readThemePref(), osDark = systemDark()) {
  if (pref === "light" || pref === "dark") return pref;
  return osDark ? "dark" : "light";
}

export function applyTheme(pref = readThemePref()) {
  if (typeof document === "undefined") return resolvedTheme(pref);
  const resolved = resolvedTheme(pref);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-pref", pref);
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#1c1915" : "#1b1814");
  return resolved;
}

export function setThemePref(pref) {
  const next = THEME_PREFS.includes(pref) ? pref : "system";
  try { localStorage.setItem(THEME_KEY, next); } catch { /* 隐私模式 */ }
  applyTheme(next);
  emit();
}

export function subscribeTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getThemePref() { return readThemePref(); }
export function getResolvedTheme() { return resolvedTheme(); }

export function useTheme() {
  const pref = useSyncExternalStore(subscribeTheme, getThemePref, () => "system");
  const resolved = useSyncExternalStore(subscribeTheme, getResolvedTheme, () => "light");
  return [pref, setThemePref, resolved];
}

function boot() {
  if (typeof window === "undefined") return;
  applyTheme(readThemePref());
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => { if (readThemePref() === "system") { applyTheme("system"); emit(); } };
  mq.addEventListener("change", onScheme);
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY || e.key === null) { applyTheme(readThemePref()); emit(); }
  });
  window.__theme = { getPref: getThemePref, setPref: setThemePref, resolved: getResolvedTheme, key: THEME_KEY };
}

boot();
