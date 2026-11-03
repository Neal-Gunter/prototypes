// 页面端 Intel HEX 校验器（4.5）：记录格式、校验和、总字节数上限、地址范围、入口向量。
// 早期原型，简化仿真：只检查文件本身，不烧录。
const E = (code, line, msg, msgEn) => ({ code, line, msg, msgEn });
export function parseHex(src) {
  const recs = [], errors = [];
  String(src).split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1, s = raw.trim();
    if (!s) return;
    if (!/^:([0-9A-Fa-f]{2})+$/.test(s)) { errors.push(E("format", n, `第 ${n} 行不是 Intel HEX 记录（要以 : 开头、后面是偶数个十六进制字符）`, `Line ${n} is not an Intel HEX record (must start with : followed by hex byte pairs)`)); return; }
    const b = s.slice(1).match(/../g).map((h) => parseInt(h, 16));
    if (b.length < 5) { errors.push(E("short", n, `第 ${n} 行太短`, `Line ${n} is too short`)); return; }
    const [len, hi, lo, type] = b;
    if (b.length !== len + 5) { errors.push(E("length", n, `第 ${n} 行：长度字段是 ${len}，实际数据 ${b.length - 5} 字节`, `Line ${n}: length field says ${len}, data has ${b.length - 5} bytes`)); return; }
    const sum = b.reduce((a, x) => a + x, 0) & 0xff;
    if (sum !== 0) { const want = (0x100 - (b.slice(0, -1).reduce((a, x) => a + x, 0) & 0xff)) & 0xff; errors.push(E("checksum", n, `第 ${n} 行校验和错误（应为 ${want.toString(16).toUpperCase().padStart(2, "0")}）`, `Line ${n}: bad checksum (should be ${want.toString(16).toUpperCase().padStart(2, "0")})`)); }
    if (type > 5) errors.push(E("type", n, `第 ${n} 行：未知记录类型 ${type}`, `Line ${n}: unknown record type ${type}`));
    recs.push({ n, len, addr: (hi << 8) | lo, type, data: b.slice(4, 4 + len) });
  });
  return { recs, errors };
}
export function validateHex(src, spec = {}) {
  const { recs, errors } = parseHex(src);
  const warnings = [], mem = new Map();
  let base = 0, total = 0, eof = -1, start = null;
  recs.forEach((r, i) => {
    if (eof >= 0) errors.push(E("after-eof", r.n, `第 ${r.n} 行在结束记录之后`, `Line ${r.n} comes after the end-of-file record`));
    if (r.type === 0) {
      for (let k = 0; k < r.len; k++) { const a = base + r.addr + k; if (mem.has(a)) errors.push(E("overlap", r.n, `第 ${r.n} 行：地址 0x${a.toString(16)} 被写了两次`, `Line ${r.n}: address 0x${a.toString(16)} written twice`)); mem.set(a, r.data[k]); }
      total += r.len;
      const lo = base + r.addr, hi = lo + r.len - 1;
      if (spec.addrMin != null && lo < spec.addrMin || spec.addrMax != null && hi > spec.addrMax) errors.push(E("range", r.n, `第 ${r.n} 行：地址 0x${lo.toString(16)}–0x${hi.toString(16)} 超出允许范围`, `Line ${r.n}: address 0x${lo.toString(16)}–0x${hi.toString(16)} is outside the allowed range`));
    } else if (r.type === 1) { if (r.len !== 0) errors.push(E("eof-len", r.n, `第 ${r.n} 行：结束记录不能带数据`, `Line ${r.n}: end-of-file record must have no data`)); eof = i; }
    else if (r.type === 2) base = ((r.data[0] << 8) | r.data[1]) << 4;
    else if (r.type === 4) base = ((r.data[0] << 8) | r.data[1]) * 0x10000;
    else if (r.type === 5) start = ((r.data[0] << 24) | (r.data[1] << 16) | (r.data[2] << 8) | r.data[3]) >>> 0;
    else if (r.type === 3) start = ((r.data[0] << 8) | r.data[1]) * 16 + ((r.data[2] << 8) | r.data[3]);
  });
  if (eof < 0) errors.push(E("no-eof", null, "缺少结束记录 :00000001FF", "Missing end-of-file record :00000001FF"));
  if (spec.maxBytes != null && total > spec.maxBytes) errors.push(E("too-big", null, `数据共 ${total} 字节，超过上限 ${spec.maxBytes}`, `${total} data bytes exceed the limit of ${spec.maxBytes}`));
  if (spec.entry != null && start !== spec.entry) errors.push(E("entry", null, `入口地址应为 0x${spec.entry.toString(16)}，文件里是 ${start == null ? "没有" : "0x" + start.toString(16)}`, `Entry address should be 0x${spec.entry.toString(16)}, file has ${start == null ? "none" : "0x" + start.toString(16)}`));
  for (const v of spec.mustContain || []) {
    const bytes = v.bytes.match(/../g).map((h) => parseInt(h, 16));
    const ok = bytes.every((x, k) => mem.get(v.address + k) === x);
    if (!ok) errors.push(E("vector", null, `地址 0x${v.address.toString(16)} 处应为 ${v.bytes.toUpperCase()}（${v.why || "向量"}）`, `Address 0x${v.address.toString(16)} should hold ${v.bytes.toUpperCase()} (${v.whyEn || "vector"})`));
  }
  return { pass: errors.length === 0, errors, warnings, info: { records: recs.length, bytes: total, start } };
}
