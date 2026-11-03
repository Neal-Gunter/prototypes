// 页面端汇编校验器（4.5）：指令白名单、寄存器白名单、标签定义 / 跳转目标存在性、操作数数量。
// 早期原型，简化仿真：只看文本结构，不汇编、不执行。默认指令集是本站自定的「ARM 风格教学子集」（我的补充），
// 不是完整 ARM7 指令集；题目可以在 spec 里换成自己的表。
export const TOY_ARM = {
  instructions: { mov: 2, mvn: 2, add: 3, sub: 3, and: 3, orr: 3, eor: 3, lsl: 3, lsr: 3, cmp: 2, ldr: 2, str: 2, b: 1, beq: 1, bne: 1, blt: 1, bgt: 1, bl: 1, bx: 1, push: 1, pop: 1, nop: 0, swi: 1 },
  branches: ["b", "beq", "bne", "blt", "bgt", "bl"],
  registers: ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10", "r11", "r12", "sp", "lr", "pc"],
  directives: [".text", ".data", ".global", ".org", ".word", ".byte", ".align", ".equ"],
};
const E = (code, line, msg, msgEn) => ({ code, line, msg, msgEn });

function splitOperands(s) {
  const out = []; let d = 0, cur = "";
  for (const ch of s) {
    if (ch === "[" || ch === "{") d++;
    if (ch === "]" || ch === "}") d--;
    if (ch === "," && d === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export function parseAsm(src) {
  const lines = [], labels = new Map();
  String(src).split(/\r?\n/).forEach((raw, idx) => {
    const n = idx + 1;
    let s = raw.replace(/(;|@|\/\/).*$/, "").trim();
    let m;
    while ((m = /^([A-Za-z_.][\w.]*)\s*:\s*/.exec(s))) { if (!labels.has(m[1])) labels.set(m[1], n); else lines.push({ n, dupLabel: m[1] }); s = s.slice(m[0].length); }
    if (!s) return;
    m = /^(\.?[A-Za-z]+)\s*(.*)$/.exec(s);
    if (!m) { lines.push({ n, bad: s }); return; }
    lines.push({ n, op: m[1].toLowerCase(), operands: m[2] ? splitOperands(m[2]) : [] });
  });
  return { lines, labels };
}
export function validateAsm(src, spec = {}) {
  const isa = { ...TOY_ARM, ...(spec.isa || {}) };
  const allowed = spec.allowedInstructions ? Object.fromEntries(spec.allowedInstructions.map((i) => [i, isa.instructions[i] ?? null])) : isa.instructions;
  const regs = new Set(spec.allowedRegisters || isa.registers);
  const branches = new Set(isa.branches);
  const { lines, labels } = parseAsm(src);
  const errors = [], warnings = [];
  const equ = new Set(lines.filter((l) => l.op === ".equ").map((l) => l.operands[0]));
  let count = 0;
  for (const l of lines) {
    if (l.dupLabel) { errors.push(E("dup-label", l.n, `第 ${l.n} 行：标签 ${l.dupLabel} 重复定义`, `Line ${l.n}: label ${l.dupLabel} defined twice`)); continue; }
    if (l.bad) { errors.push(E("syntax", l.n, `第 ${l.n} 行看不懂：${l.bad}`, `Line ${l.n} cannot be read: ${l.bad}`)); continue; }
    if (l.op.startsWith(".")) { if (!isa.directives.includes(l.op)) errors.push(E("directive", l.n, `第 ${l.n} 行：不支持的伪指令 ${l.op}`, `Line ${l.n}: unsupported directive ${l.op}`)); continue; }
    count++;
    if (!(l.op in allowed)) { errors.push(E("instruction", l.n, `第 ${l.n} 行：${l.op} 不在本题允许的指令里`, `Line ${l.n}: ${l.op} is not an allowed instruction here`)); continue; }
    const want = allowed[l.op];
    if (want != null && l.operands.length !== want) errors.push(E("operands", l.n, `第 ${l.n} 行：${l.op} 需要 ${want} 个操作数，写了 ${l.operands.length} 个`, `Line ${l.n}: ${l.op} takes ${want} operands, found ${l.operands.length}`));
    l.operands.forEach((o, k) => {
      if (branches.has(l.op) && k === 0) {
        if (!/^#?-?\d/.test(o) && !labels.has(o)) errors.push(E("label", l.n, `第 ${l.n} 行：跳转目标 ${o} 没有定义`, `Line ${l.n}: branch target ${o} is not defined`));
        return;
      }
      for (const w of o.replace(/[[\]{}!]/g, " ").split(/[\s,-]+/).filter(Boolean)) {
        if (/^#/.test(w) || /^=/.test(w) || /^-?(0x[\da-f]+|\d+)$/i.test(w) || equ.has(w) || labels.has(w)) continue;
        if (/^[a-z]+\d*$/i.test(w) && !regs.has(w.toLowerCase())) errors.push(E("register", l.n, `第 ${l.n} 行：${w} 不是允许的寄存器或已定义的标签`, `Line ${l.n}: ${w} is not an allowed register or a defined label`));
      }
    });
  }
  for (const lb of spec.requiredLabels || []) if (!labels.has(lb)) errors.push(E("required-label", null, `缺少标签 ${lb}`, `Missing label ${lb}`));
  if (spec.maxInstructions && count > spec.maxInstructions) errors.push(E("too-long", null, `指令数 ${count} 超过上限 ${spec.maxInstructions}`, `${count} instructions exceed the limit of ${spec.maxInstructions}`));
  for (const op of spec.requiredInstructions || []) if (!lines.some((l) => l.op === op)) errors.push(E("required-instruction", null, `本题要求用到 ${op}`, `This task requires ${op}`));
  return { pass: errors.length === 0, errors, warnings, info: { instructions: count, labels: [...labels.keys()] } };
}
