import * as THREE from "three";

const cache = new Map();

// 用 Canvas 画文字贴图（不从网络加载字体）
export function textTexture(text, { color = "#f7f3ea", bg = null, size = 64, weight = 600, width } = {}) {
  const key = `${text}|${color}|${bg}|${size}|${weight}|${width}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const font = `${weight} ${size}px "Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.font = font;
  const w = width ?? Math.ceil(ctx.measureText(text).width + size * 0.6);
  c.width = w;
  c.height = Math.ceil(size * 1.4);
  ctx.font = font;
  if (bg) {
    ctx.fillStyle = bg;
    const r = size * 0.3;
    ctx.beginPath();
    ctx.roundRect(0, 0, c.width, c.height, r);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const out = { tex, aspect: c.width / c.height };
  cache.set(key, out);
  return out;
}
