// v27（我的补充）：英文模式下的“整页翻译层”。
// 手写词典（i18n.js 的 EN）优先；其余中文用离线机翻词典 public/i18n/en-mt.json（Argos Translate zh→en 生成，
// 机器辅助翻译，可能不通顺）。只在英文模式下加载；切回中文时把原文还原。
// 做法：MutationObserver 盯住正文的文本节点和 title / placeholder / aria-label / alt 属性；
// 先整句查，查不到再按“中文片段”逐段替换（切分规则和抽取脚本共用 i18n-runs.js）。
// 已知限制：3D 画布里画出来的文字、浏览器原生对话框以外的系统弹窗不翻译。
import { EN, getLang, onLang } from "./i18n";
import { RUN_RE, SUB_RE, HAS_CJK } from "./i18n-runs";

let DICT = null, loading = null, observer = null;
const ATTRS = ["title", "placeholder", "aria-label", "alt"];
const orig = new Map(); // 节点 → { text?, attrs: {name: 原文} , out?: 译文 }
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT"]);
const missing = (typeof window !== "undefined" && (window.__mtMissing ||= new Set())) || new Set();
const PUNCT = { "（": " (", "）": ") ", "：": ": ", "，": ", ", "。": ". ", "、": ", ", "；": "; ", "“": "\"", "”": "\"", "‘": "'", "’": "'", "！": "! ", "？": "? ", "【": "[", "】": "]", "《": "\"", "》": "\"", "…": "…", "—": "—", "～": "~", "　": " " };
const norm = (s) => s.replace(/\s+/g, " ").trim();
const look = (k) => EN[k] ?? DICT?.[k];

export function mt(s) {
  if (!s || !HAS_CJK.test(s)) return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = norm(s);
  const w = look(core);
  if (w != null) return lead + w + trail;
  let out = core.replace(RUN_RE, (run) => {
    const r = look(run.trim());
    if (r != null) return " " + r + " ";
    return run.replace(SUB_RE, (sub) => { const t = look(sub); if (t == null) { missing.add(sub); return sub; } return " " + t + " "; });
  });
  out = out.replace(/[（）：，。、；“”‘’！？【】《》～　]/g, (c) => PUNCT[c]).replace(/ {2,}/g, " ").replace(/ ([,.;:!?)])/g, "$1").replace(/\( /g, "(").trim();
  return lead + out + trail;
}

function skipEl(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) { if (SKIP.has(e.tagName) || e.isContentEditable || e.hasAttribute?.("data-no-mt") || /^zh/.test(e.getAttribute?.("lang") || "")) return true; }
  return false;
}
function doText(n) {
  const rec = orig.get(n);
  if (rec && n.data === rec.out) return;
  if (!HAS_CJK.test(n.data) || skipEl(n.parentElement)) return;
  const o = n.data, t = mt(o);
  if (t !== o) { orig.set(n, { ...(rec || {}), text: o, out: t }); n.data = t; }
}
function doAttrs(el) {
  if (skipEl(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (!v || !HAS_CJK.test(v)) continue;
    const rec = orig.get(el) || { attrs: {} }; rec.attrs ||= {};
    rec.attrs[a] = v; orig.set(el, rec); el.setAttribute(a, mt(v));
  }
}
function scan(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) doAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) n.nodeType === 3 ? doText(n) : doAttrs(n);
}
let titleOrig = null;
function doTitle() { if (HAS_CJK.test(document.title)) { titleOrig = document.title; document.title = mt(document.title); } }

function start() {
  if (observer) return;
  scan(document.body); doTitle();
  observer = new MutationObserver((ms) => {
    if (getLang() !== "en") return;
    for (const m of ms) {
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") { const rec = orig.get(m.target); const v = m.target.getAttribute(m.attributeName); if (v && HAS_CJK.test(v) && !(rec?.attrs && mt(rec.attrs[m.attributeName]) === v)) doAttrs(m.target); }
      else m.addedNodes.forEach(scan);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const head = document.querySelector("title"); if (head) new MutationObserver(() => getLang() === "en" && doTitle()).observe(head, { childList: true });
  window.__mtActive = true;
}
function stop() {
  observer?.disconnect(); observer = null; window.__mtActive = false;
  for (const [n, rec] of orig) {
    if (!n.isConnected) continue;
    if (rec.text != null && n.data === rec.out) n.data = rec.text;
    if (rec.attrs) for (const [a, v] of Object.entries(rec.attrs)) n.setAttribute(a, v);
  }
  orig.clear(); if (titleOrig && !HAS_CJK.test(document.title)) document.title = titleOrig;
}
export function loadMT() {
  if (DICT) return Promise.resolve(DICT);
  return (loading ||= fetch("/i18n/en-mt.json").then((r) => r.json()).then((d) => { DICT = d.dict || d; window.__mtMeta = d.meta; return DICT; }).catch(() => (DICT = {})));
}
async function sync() {
  if (getLang() === "en") { await loadMT(); if (getLang() === "en") start(); } else stop();
}
// 浏览器原生对话框里的中文也走同一套翻译
if (typeof window !== "undefined") {
  for (const k of ["alert", "confirm", "prompt"]) { const f = window[k]?.bind(window); if (f) window[k] = (msg, ...r) => f(getLang() === "en" && typeof msg === "string" ? mt(msg) : msg, ...r); }
  window.__mt = mt;
  // 走查用：页面上还剩多少个可见中文字符
  window.__cjkLeft = () => { const t = document.body.innerText || ""; const m = t.match(/[\u4e00-\u9fff]/g) || []; const runs = [...new Set(t.match(/[\u4e00-\u9fff][\u4e00-\u9fff\s，。、：；（）]*/g) || [])]; return { chars: m.length, total: t.replace(/\s/g, "").length, sample: runs.slice(0, 20) }; };
  onLang(sync);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync); else sync();
}
