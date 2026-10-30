// v11 功能图：PNG / JPG / SVG 直接用；PDF 用 pdf.js 在本地把一页画成 PNG。全部在浏览器里，不上传
import { IMAGE_EXT, LIMITS, UserError, extOf, mb } from "./limits.js";

export function imageSize(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res({ w: im.naturalWidth || 1000, h: im.naturalHeight || 700 }); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new UserError("图片打不开（文件损坏，或不是 PNG / JPG / SVG）")); };
    im.src = url;
  });
}
// SVG：只当图片显示（<img> 里脚本不会运行、外部资源不会加载）；另外拒绝明显的外链和脚本，免得导出后在别处被当网页打开
function checkSvg(text) {
  if (!/<svg[\s>]/i.test(text)) throw new UserError("这个 .svg 里没有 <svg> 根元素");
  if (/<script[\s>]|\son[a-z]+\s*=|javascript:/i.test(text)) throw new UserError("SVG 里有脚本或事件属性，为安全起见不接受（请在绘图软件里另存为纯 SVG 或 PNG）");
  if (/(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i.test(text) || /url\(\s*["']?\s*(?:https?:)?\/\//i.test(text)) throw new UserError("SVG 引用了外部网址的资源；这里只在本地解析，不会去下载。请把图片嵌进 SVG 或另存为 PNG");
}
let pdfP = null;
async function pdfjs() {
  pdfP ||= (async () => {
    const [lib, { default: workerUrl }] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
    return lib;
  })();
  return pdfP;
}
export async function pdfPageCount(bytes) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false, disableFontFace: false, useSystemFonts: true, stopAtErrors: false }).promise;
  const n = doc.numPages; await doc.destroy(); return n;
}
export async function pdfPageToPng(bytes, page = 1) {
  const lib = await pdfjs();
  let doc;
  try { doc = await lib.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false, useSystemFonts: true }).promise; } catch (e) { throw new UserError("PDF 打不开：" + String(e.message || e).slice(0, 120)); }
  const pages = doc.numPages;
  const pg = await doc.getPage(Math.min(Math.max(1, page), pages));
  const v0 = pg.getViewport({ scale: 1 });
  const scale = Math.min(3, 2400 / Math.max(v0.width, v0.height));
  const vp = pg.getViewport({ scale });
  const cv = document.createElement("canvas");
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  await doc.destroy();
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  return { blob, w: cv.width, h: cv.height, pages };
}
// 读入一个功能图文件 → { blob, mime, w, h, fromPdf? }
export async function loadDiagramFile(file, { page = 1 } = {}) {
  const mime = IMAGE_EXT[extOf(file.name)] || (file.type === "application/pdf" ? "application/pdf" : IMAGE_EXT[(file.type.split("/")[1] || "").replace("jpeg", "jpg")]);
  if (!mime) throw new UserError(`不支持的功能图格式：“${file.name}”。支持 PNG / JPG / SVG / PDF`);
  const lim = mime === "application/pdf" ? LIMITS.pdfBytes : LIMITS.imageBytes;
  if (file.size === 0) throw new UserError("功能图文件是空的");
  if (file.size > lim) throw new UserError(`功能图太大：${mb(file.size)}，上限 ${mb(lim)}`);
  const bytes = await file.arrayBuffer();
  if (mime === "application/pdf") {
    if (new TextDecoder().decode(new Uint8Array(bytes, 0, 5)) !== "%PDF-") throw new UserError("这个文件不是 PDF（开头不是 %PDF-）");
    const r = await pdfPageToPng(bytes, page);
    return { blob: r.blob, mime: "image/png", w: r.w, h: r.h, fromPdf: { page: Math.min(page, r.pages), pages: r.pages }, pdfBytes: bytes, name: file.name };
  }
  if (mime === "image/svg+xml") checkSvg(new TextDecoder().decode(bytes));
  else {
    const u = new Uint8Array(bytes, 0, 4);
    const png = u[0] === 0x89 && u[1] === 0x50, jpg = u[0] === 0xff && u[1] === 0xd8;
    if (!(mime === "image/png" ? png : jpg)) throw new UserError(`文件内容不是 ${mime === "image/png" ? "PNG" : "JPG"}（扩展名和内容对不上）`);
  }
  const blob = new Blob([bytes], { type: mime });
  const { w, h } = await imageSize(blob);
  if (Math.max(w, h) > LIMITS.imagePx) throw new UserError(`图片太大：${w}×${h} 像素，最长边上限 ${LIMITS.imagePx}`);
  return { blob, mime, w, h, name: file.name };
}
