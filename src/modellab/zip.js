// 极简 ZIP（存储，不压缩）写入 + 读取（支持存储和 deflate；deflate 用浏览器自带的 DecompressionStream）
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const enc = new TextEncoder();
export function zipStore(files) {
  // files: [{name, data: Uint8Array}]
  const parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), d = f.data, crc = crc32(d);
    const h = new Uint8Array(30 + name.length), v = new DataView(h.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
    v.setUint32(14, crc, true); v.setUint32(18, d.length, true); v.setUint32(22, d.length, true); v.setUint16(26, name.length, true);
    h.set(name, 30);
    const c = new Uint8Array(46 + name.length), w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true);
    w.setUint32(16, crc, true); w.setUint32(20, d.length, true); w.setUint32(24, d.length, true); w.setUint16(28, name.length, true); w.setUint32(42, off, true);
    c.set(name, 46);
    parts.push(h, d); central.push(c);
    off += h.length + d.length;
  }
  const csize = central.reduce((s, c) => s + c.length, 0);
  const e = new Uint8Array(22), ev = new DataView(e.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, csize, true); ev.setUint32(16, off, true);
  return new Blob([...parts, ...central, e], { type: "application/zip" });
}
export async function unzip(buf, { maxEntries = 32, maxTotal = 200 * 1024 * 1024 } = {}) {
  const u8 = new Uint8Array(buf), v = new DataView(buf);
  let eo = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw new Error("不是 ZIP 文件（找不到目录结尾）");
  const n = v.getUint16(eo + 10, true), cdo = v.getUint32(eo + 16, true);
  if (n > maxEntries) throw new Error(`ZIP 里文件太多（${n}）`);
  const out = new Map();
  let p = cdo, total = 0;
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP 目录损坏");
    const method = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), usz = v.getUint32(p + 24, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (name.endsWith("/")) continue;
    if (/(^|\/)\.\.(\/|$)|^\//.test(name)) throw new Error("ZIP 里有不安全的路径：" + name);
    total += usz;
    if (total > maxTotal) throw new Error("ZIP 解开后太大");
    const lnl = v.getUint16(lo + 26, true), lxl = v.getUint16(lo + 28, true), ds = lo + 30 + lnl + lxl;
    if (ds + csz > u8.length) throw new Error("ZIP 被截断");
    const raw = u8.slice(ds, ds + csz);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else throw new Error(`ZIP 压缩方式 ${method} 不支持`);
    if (data.length !== usz) throw new Error("ZIP 里的文件长度不对：" + name);
    out.set(name, data);
  }
  return out;
}
