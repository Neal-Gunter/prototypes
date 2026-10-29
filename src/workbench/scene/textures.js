import * as THREE from "three";
import { pinsOfType } from "../parts";

// 程序绘制的贴图（不下载）：Feather 丝印/焊盘、硅胶维修垫、烟雾粒子
const FONT = `"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif`;
const MONO = `"DejaVu Sans Mono","Menlo","Consolas",monospace`;

let featherTex = null;
// 板子坐标：毫米，原点在左前角（USB‑C 一端、长排一侧）。glTF 贴图不翻转，v = 1 − y/22.86
export function featherBoardTexture() {
  if (featherTex) return featherTex;
  const W = 2048;
  const H = Math.round((W * 22.86) / 50.8);
  const k = W / 50.8;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const X = (mm) => mm * k;
  const Y = (mm) => H - mm * k; // y = 0 在画布底边
  // 阻焊层：黑色哑光，底下隐约有铜皮和走线
  g.fillStyle = "#0d0e10";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(60,64,70,0.55)";
  g.lineWidth = X(0.25);
  const rnd = mulberry(7);
  for (let i = 0; i < 60; i++) {
    let x = X(6 + rnd() * 40);
    let y = Y(4 + rnd() * 15);
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      if (rnd() > 0.5) x += X((rnd() - 0.5) * 12);
      else y += X((rnd() - 0.5) * 8);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = "rgba(40,44,48,0.5)";
  g.fillRect(X(3), Y(20.5), X(44), X(1.2));
  // 板边一圈阻焊开窗留出的铜（很细）
  g.strokeStyle = "#1c1d20";
  g.lineWidth = X(0.4);
  g.strokeRect(X(0.2), X(0.2), W - X(0.4), H - X(0.4));

  // 安装孔
  for (const [x, y] of [
    [2.54, 2.54],
    [48.26, 2.54],
    [2.54, 20.32],
    [48.26, 20.32],
  ])
    pad(g, X(x), Y(y), X(1.25), X(0.75));

  // 排针孔（长排 y=1.27，短排 y=21.59），1 号脚方形
  const pins = pinsOfType("esp32");
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const p of pins) {
    const xmm = 25.4 + p.local[0] * 10;
    const ymm = 11.43 - p.local[2] * 10;
    const square = p.idx === 0;
    pad(g, X(xmm), Y(ymm), X(0.85), X(0.5), square);
    // 丝印：白色，竖着写在焊盘内侧
    const label = p.label;
    g.save();
    const inward = p.row === "long" ? 1 : -1;
    g.translate(X(xmm), Y(ymm + inward * 2.35));
    g.rotate(-Math.PI / 2);
    g.fillStyle = "#f2f2ee";
    g.font = `700 ${X(label.length > 2 ? 0.95 : 1.05)}px ${FONT}`;
    g.fillText(label, 0, 0);
    g.restore();
  }
  // 板名
  g.fillStyle = "#f2f2ee";
  g.font = `700 ${X(1.5)}px ${FONT}`;
  g.textAlign = "left";
  g.fillText("Feather ESP32-S3", X(9.5), Y(11.0));
  // 丝印框：USB‑C、按钮、STEMMA QT
  g.strokeStyle = "#e8e8e2";
  g.lineWidth = X(0.18);
  g.strokeRect(X(0.2), Y(15.2), X(8.4), X(7.6));
  g.font = `700 ${X(0.9)}px ${FONT}`;
  g.fillText("USB", X(3.0), Y(6.3));
  g.fillText("RST", X(9.2), Y(4.2));
  g.fillText("BOOT", X(9.2), Y(19.0));
  g.fillText("CHG", X(1.2), Y(16.6));
  // 1 号脚角标
  g.beginPath();
  g.moveTo(X(4.6), Y(3.2));
  g.lineTo(X(5.4), Y(3.2));
  g.lineTo(X(5.0), Y(3.9));
  g.fill();

  featherTex = new THREE.CanvasTexture(c);
  featherTex.colorSpace = THREE.SRGBColorSpace;
  featherTex.flipY = false;
  featherTex.anisotropy = 8;
  return featherTex;
}

// 镀金焊盘（沉金 ENIG）+ 中间的孔
function pad(g, x, y, ro, ri, square = false) {
  const grd = g.createRadialGradient(x - ro * 0.3, y - ro * 0.3, ro * 0.1, x, y, ro);
  grd.addColorStop(0, "#f3d58a");
  grd.addColorStop(0.6, "#d6ad52");
  grd.addColorStop(1, "#a8823a");
  g.fillStyle = grd;
  g.beginPath();
  if (square) g.rect(x - ro, y - ro, ro * 2, ro * 2);
  else g.arc(x, y, ro, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#050505";
  g.beginPath();
  g.arc(x, y, ri, 0, Math.PI * 2);
  g.fill();
}

// 金属粗糙度贴图：焊盘处金属、光滑；其它地方是哑光阻焊
let featherMR = null;
export function featherMetalRough() {
  if (featherMR) return featherMR;
  const src = featherBoardTexture().image;
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i];
    const gg = a[i + 1];
    const b = a[i + 2];
    const gold = r > 140 && r - b > 60;
    const silk = r > 200 && b > 200;
    // glTF：G 通道 = 粗糙度，B 通道 = 金属度
    a[i] = 0;
    a[i + 1] = gold ? 70 : silk ? 200 : 150;
    a[i + 2] = gold ? 255 : 0;
    a[i + 3] = 255;
    void gg;
  }
  g.putImageData(d, 0, 0);
  featherMR = new THREE.CanvasTexture(c);
  featherMR.flipY = false;
  return featherMR;
}

let matTex = null;
// 蓝灰色耐热硅胶维修垫：1 cm 网格、刻度尺、螺丝分格
export function matTexture(w = 40, d = 28) {
  if (matTex) return matTex;
  const k = 40;
  const c = document.createElement("canvas");
  c.width = w * k;
  c.height = d * k;
  const g = c.getContext("2d");
  g.fillStyle = "#3d6470";
  g.fillRect(0, 0, c.width, c.height);
  // 细微颗粒
  const rnd = mulberry(3);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${rnd() > 0.5 ? "255,255,255" : "0,0,0"},${0.02 + rnd() * 0.03})`;
    g.fillRect(rnd() * c.width, rnd() * c.height, 2, 2);
  }
  g.strokeStyle = "rgba(215,232,236,0.22)";
  g.lineWidth = 1;
  for (let x = 0; x <= w; x++) {
    g.beginPath();
    g.moveTo(x * k + 0.5, 0);
    g.lineTo(x * k + 0.5, c.height);
    g.stroke();
  }
  for (let y = 0; y <= d; y++) {
    g.beginPath();
    g.moveTo(0, y * k + 0.5);
    g.lineTo(c.width, y * k + 0.5);
    g.stroke();
  }
  // 底边刻度尺
  g.fillStyle = "rgba(240,246,247,0.85)";
  g.font = `600 14px ${MONO}`;
  g.textAlign = "center";
  for (let mm = 0; mm <= w * 10; mm++) {
    const x = (mm / 10) * k;
    const len = mm % 10 === 0 ? 14 : mm % 5 === 0 ? 9 : 5;
    g.fillRect(x, c.height - 4 - len, 1.2, len);
    if (mm % 50 === 0 && mm > 0 && mm < w * 10) g.fillText(String(mm / 10), x, c.height - 24);
  }
  // 左上角：螺丝分格（印刷的）
  g.strokeStyle = "rgba(240,246,247,0.5)";
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.roundRect(30 + i * 110, 30, 96, 96, 14);
    g.stroke();
  }
  g.fillStyle = "rgba(240,246,247,0.55)";
  g.font = `600 16px ${FONT}`;
  g.textAlign = "left";
  g.fillText("螺丝 · 小零件", 32, 150);
  g.font = `600 18px ${FONT}`;
  g.fillText("耐热硅胶维修垫 · 网格 1 cm", c.width - 300, c.height - 50);
  matTex = new THREE.CanvasTexture(c);
  matTex.colorSpace = THREE.SRGBColorSpace;
  matTex.anisotropy = 8;
  return matTex;
}

let smokeTex = null;
export function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

// 七段数码管风格的万用表屏幕
export function drawLcd(canvas, { text = "", unit = "", mode = "", beep = false, off = false, note = "" }) {
  const g = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = off ? "#59614f" : "#a9b78f";
  g.fillRect(0, 0, W, H);
  if (off) return;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "rgba(255,255,255,0.15)");
  grd.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#1d2318";
  g.font = `700 ${H * 0.58}px ${MONO}`;
  g.textAlign = "right";
  g.textBaseline = "middle";
  g.fillText(text, W * 0.78, H * 0.56);
  g.font = `700 ${H * 0.24}px ${MONO}`;
  g.textAlign = "left";
  g.fillText(unit, W * 0.8, H * 0.62);
  g.font = `700 ${H * 0.16}px ${FONT}`;
  g.fillText(mode, W * 0.05, H * 0.17);
  if (beep) g.fillText("•))", W * 0.82, H * 0.17);
  if (note) {
    g.font = `600 ${H * 0.13}px ${FONT}`;
    g.fillText(note, W * 0.05, H * 0.9);
  }
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
