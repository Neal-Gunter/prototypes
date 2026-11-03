// v37（我的补充）：打印版二维码。编码用 uqr（MIT，unjs；算法来自 Project Nayuki 的 QR-Code-generator，MIT），
//   这里只把它给的黑白方格画成一个 SVG path（同一行连着的黑格合成一段），四周留 4 格静区。全部在浏览器里生成。
import { encode } from "uqr";
export const LIVE = "https://neal-gunter.github.io/prototypes/";
export const stepUrl = (base, id, n) => `${base.replace(/\/?$/, "/")}teardown/?d=${encodeURIComponent(id)}${n ? `&s=${n}` : ""}`;
export function qrSvg(text, { mm = 22, label = "" } = {}) {
  const { data, size } = encode(text, { ecc: "M", border: 0 });
  const Q = 4, N = size + Q * 2;
  let d = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!data[y][x]) continue;
    let w = 1; while (x + w < size && data[y][x + w]) w++;
    d += `M${x + Q} ${y + Q}h${w}v1h-${w}z`; x += w - 1;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${mm}mm" height="${mm}mm" shape-rendering="crispEdges" role="img" aria-label="${esc(label)}" data-qr="${esc(text)}" data-qr-size="${size}"><rect width="${N}" height="${N}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
