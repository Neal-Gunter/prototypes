// 迷你“类 Arduino”解释器：手写的词法/语法分析 + 生成器求值。
// 不调用 eval / new Function，代码只能访问这里列出的内置函数。
// 这不是 C++ 编译器，也不是 ESP32‑S3 仿真：只支持一小部分语法。

export class FwError extends Error {
  constructor(msg, line) {
    super(msg);
    this.line = line;
  }
}

const TYPES = new Set(["void", "int", "float", "double", "long", "bool", "boolean", "byte", "char", "String", "Servo", "unsigned", "const", "uint8_t", "uint16_t", "uint32_t", "int16_t", "int32_t", "size_t"]);
const INT_TYPES = new Set(["int", "long", "byte", "unsigned", "uint8_t", "uint16_t", "uint32_t", "int16_t", "int32_t", "size_t", "char"]);
const KEYWORDS = new Set(["if", "else", "for", "while", "return", "break", "continue", "true", "false"]);
const OPS = ["<<=", ">>=", "++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=", "<=", ">=", "&&", "||", "<<", ">>", "+", "-", "*", "/", "%", "<", ">", "=", "!", "(", ")", "{", "}", "[", "]", ";", ",", ".", "?", ":", "&", "|", "^", "~"];

export function tokenize(src) {
  const toks = [];
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (src.startsWith("//", i)) { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) throw new FwError("注释 /* 没有结束", line);
      for (let k = i; k < end; k++) if (src[k] === "\n") line++;
      i = end + 2;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1]))) {
      const m = /^(0x[0-9a-fA-F]+|[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?)[uUlLfF]*/.exec(src.slice(i));
      const raw = m[1];
      toks.push({ t: "num", v: Number(raw), float: raw.includes("."), line });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      const w = m[0];
      toks.push({ t: KEYWORDS.has(w) ? "kw" : TYPES.has(w) ? "type" : "id", v: w, line });
      i += w.length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\n") throw new FwError("字符串没有结束", line);
        if (src[j] === "\\") {
          const n = src[j + 1];
          s += n === "n" ? "\n" : n === "t" ? "\t" : n;
          j += 2;
        } else s += src[j++];
      }
      if (j >= src.length) throw new FwError("字符串没有结束", line);
      toks.push({ t: "str", v: s, line });
      i = j + 1;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new FwError(`不认识的字符 “${c}”`, line);
    toks.push({ t: "op", v: op, line });
    i += op.length;
  }
  toks.push({ t: "eof", v: "", line });
  return toks;
}

export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const next = () => toks[p++];
  const is = (v, o = 0) => peek(o).v === v && peek(o).t !== "str";
  const expect = (v) => {
    const t = next();
    if (t.v !== v || t.t === "str") throw new FwError(`这里应该是 “${v}”，但看到 “${t.v || "文件结尾"}”`, t.line);
    return t;
  };
  const ident = () => {
    const t = next();
    if (t.t !== "id") throw new FwError(`这里应该是一个名字，但看到 “${t.v || "文件结尾"}”`, t.line);
    return t.v;
  };
  const parseType = () => {
    const parts = [];
    while (peek().t === "type") parts.push(next().v);
    const base = parts.filter((x) => x !== "const" && x !== "unsigned").pop() || (parts.includes("unsigned") ? "int" : "int");
    return { name: base, isInt: parts.some((x) => INT_TYPES.has(x)) };
  };

  function parseDeclarators(type, line) {
    const decls = [];
    do {
      const nm = ident();
      let size = null;
      let arr = false;
      if (is("[")) {
        next();
        arr = true;
        if (!is("]")) size = parseExpr();
        expect("]");
      }
      let init = null;
      if (is("=")) {
        next();
        if (is("{")) {
          next();
          const items = [];
          while (!is("}")) {
            items.push(parseExpr());
            if (is(",")) next();
            else break;
          }
          expect("}");
          init = { k: "list", items, line };
        } else init = parseExpr();
      }
      decls.push({ name: nm, arr, size, init });
    } while (is(",") && next());
    expect(";");
    return { k: "decl", type, decls, line };
  }

  function parseBlock() {
    const t = expect("{");
    const body = [];
    while (!is("}")) {
      if (peek().t === "eof") throw new FwError("缺少 “}”", t.line);
      body.push(parseStmt());
    }
    next();
    return { k: "block", body, line: t.line };
  }

  function parseStmt() {
    const t = peek();
    if (is("{")) return parseBlock();
    if (t.t === "type") {
      next();
      p--;
      const type = parseType();
      return parseDeclarators(type, t.line);
    }
    if (t.t === "kw") {
      if (t.v === "if") {
        next(); expect("(");
        const cond = parseExpr();
        expect(")");
        const then = parseStmt();
        let els = null;
        if (is("else")) { next(); els = parseStmt(); }
        return { k: "if", cond, then, els, line: t.line };
      }
      if (t.v === "while") {
        next(); expect("(");
        const cond = parseExpr();
        expect(")");
        return { k: "while", cond, body: parseStmt(), line: t.line };
      }
      if (t.v === "for") {
        next(); expect("(");
        let init = null;
        if (peek().t === "type") init = parseDeclarators(parseType(), t.line);
        else if (is(";")) next();
        else { init = { k: "expr", e: parseExpr(), line: t.line }; expect(";"); }
        const cond = is(";") ? null : parseExpr();
        expect(";");
        const upd = is(")") ? null : parseExpr();
        expect(")");
        return { k: "for", init, cond, upd, body: parseStmt(), line: t.line };
      }
      if (t.v === "return") {
        next();
        const e = is(";") ? null : parseExpr();
        expect(";");
        return { k: "return", e, line: t.line };
      }
      if (t.v === "break" || t.v === "continue") { next(); expect(";"); return { k: t.v, line: t.line }; }
    }
    if (is(";")) { next(); return { k: "block", body: [], line: t.line }; }
    const e = parseExpr();
    expect(";");
    return { k: "expr", e, line: t.line };
  }

  // 表达式（优先级由低到高）
  function parseExpr() { return parseAssign(); }
  function parseAssign() {
    const left = parseTernary();
    if (["=", "+=", "-=", "*=", "/=", "%="].includes(peek().v) && peek().t === "op") {
      const op = next();
      if (left.k !== "id" && left.k !== "index") throw new FwError("等号左边必须是变量", op.line);
      return { k: "assign", op: op.v, target: left, value: parseAssign(), line: op.line };
    }
    return left;
  }
  function parseTernary() {
    const c = parseBin(0);
    if (is("?")) {
      const t = next();
      const a = parseAssign();
      expect(":");
      const b = parseAssign();
      return { k: "tern", c, a, b, line: t.line };
    }
    return c;
  }
  const LEVELS = [["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", ">", "<=", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"]];
  function parseBin(level) {
    if (level >= LEVELS.length) return parseUnary();
    let left = parseBin(level + 1);
    while (peek().t === "op" && LEVELS[level].includes(peek().v)) {
      const op = next();
      left = { k: "bin", op: op.v, a: left, b: parseBin(level + 1), line: op.line };
    }
    return left;
  }
  function parseUnary() {
    const t = peek();
    if (t.t === "op" && ["-", "+", "!", "~"].includes(t.v)) { next(); return { k: "un", op: t.v, a: parseUnary(), line: t.line }; }
    if (t.t === "op" && (t.v === "++" || t.v === "--")) {
      next();
      return { k: "incdec", op: t.v, prefix: true, target: parseUnary(), line: t.line };
    }
    if (t.t === "op" && t.v === "(" && peek(1).t === "type" && peek(2).v === ")") {
      next(); const ty = next().v; next();
      return { k: "cast", type: ty, a: parseUnary(), line: t.line };
    }
    return parsePostfix();
  }
  function parsePostfix() {
    let e = parsePrimary();
    for (;;) {
      const t = peek();
      if (is("(")) {
        next();
        const args = [];
        while (!is(")")) {
          args.push(parseAssign());
          if (is(",")) next();
          else break;
        }
        expect(")");
        e = { k: "call", callee: e, args, line: t.line };
      } else if (is(".")) {
        next();
        e = { k: "member", obj: e, prop: ident(), line: t.line };
      } else if (is("[")) {
        next();
        const idx = parseExpr();
        expect("]");
        e = { k: "index", obj: e, idx, line: t.line };
      } else if (t.t === "op" && (t.v === "++" || t.v === "--")) {
        next();
        e = { k: "incdec", op: t.v, prefix: false, target: e, line: t.line };
      } else return e;
    }
  }
  function parsePrimary() {
    const t = next();
    if (t.t === "num") return { k: "num", v: t.v, line: t.line };
    if (t.t === "str") return { k: "str", v: t.v, line: t.line };
    if (t.t === "kw" && (t.v === "true" || t.v === "false")) return { k: "num", v: t.v === "true" ? 1 : 0, line: t.line };
    if (t.t === "id") return { k: "id", name: t.v, line: t.line };
    if (t.v === "(" && t.t === "op") {
      const e = parseExpr();
      expect(")");
      return e;
    }
    throw new FwError(`看不懂 “${t.v || "文件结尾"}”`, t.line);
  }

  // 顶层：全局变量和函数
  const globals = [];
  const funcs = {};
  while (peek().t !== "eof") {
    const t = peek();
    if (t.t !== "type") throw new FwError(`顶层只能写变量或函数定义，看到 “${t.v}”`, t.line);
    const type = parseType();
    if (peek().t === "id" && is("(", 1)) {
      const nm = ident();
      expect("(");
      const params = [];
      while (!is(")")) {
        if (peek().t === "type") {
          const pt = parseType();
          if (is(")")) break; // void
          params.push({ name: ident(), type: pt });
        } else throw new FwError("参数要写类型，例如 int angle", peek().line);
        if (is(",")) next();
        else break;
      }
      expect(")");
      if (is(";")) { next(); continue; } // 前置声明
      funcs[nm] = { name: nm, params, body: parseBlock(), type, line: t.line };
    } else {
      globals.push(parseDeclarators(type, t.line));
    }
  }
  if (!funcs.setup) throw new FwError("没有找到 void setup()", 1);
  if (!funcs.loop) throw new FwError("没有找到 void loop()", 1);
  return { globals, funcs };
}

const BREAK = Symbol("break");
const CONTINUE = Symbol("continue");
class Ret { constructor(v) { this.v = v; } }

const CONSTS = { HIGH: 1, LOW: 0, OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, LED_BUILTIN: 48, PI: Math.PI };
const MAX_ATTACHED = 8;

/**
 * 创建一个可单步执行的程序。io 是宿主提供的输出通道：
 *  io.emit(event)  -> {type:'serial'|'attach'|'write'|'detach'|'pin', ...}
 *  io.now()        -> 毫秒
 * run() 返回生成器：yield {delay: ms} 表示需要等待。
 */
export function createProgram(src, io) {
  const ast = parse(src);
  let servoSeq = 0;
  const scopes = [new Map()];
  let ops = 0;
  const startedAt = io.now();
  const modes = {};
  // ADC 默认位数：arduino-esp32 默认 12 位，arduino-pico 默认 10 位（由宿主传入）
  let adcBits = io.adcBits || 12;

  const lookup = (name, line) => {
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
    throw new FwError(`变量 “${name}” 还没定义`, line);
  };
  const declare = (name, cell) => scopes[scopes.length - 1].set(name, cell);

  function makeValue(type) {
    if (type.name === "Servo") return { kind: "servo", id: ++servoSeq, pin: null, angle: 90 };
    if (type.name === "String") return "";
    return 0;
  }
  function coerce(type, v) {
    if (type && type.isInt && typeof v === "number") return Math.trunc(v);
    if (type && (type.name === "bool" || type.name === "boolean")) return v ? 1 : 0;
    return v;
  }
  const num = (v, line) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return v;
    throw new FwError("这里需要一个数字", line);
  };
  const fmt = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : typeof v === "string" ? v : v?.kind === "servo" ? "[Servo]" : String(v));

  function* tick() {
    if (++ops % 5000 === 0) yield { delay: 0 };
  }

  function* declStmt(s) {
    for (const d of s.decls) {
      if (d.arr) {
        let arr = [];
        if (d.init && d.init.k === "list") {
          for (const it of d.init.items) arr.push(coerce(s.type, yield* evalE(it)));
        }
        const size = d.size ? Math.trunc(yield* evalE(d.size)) : arr.length;
        if (size > 1000) throw new FwError("数组太大（简化解释器最多 1000 个元素）", s.line);
        while (arr.length < size) arr.push(makeValue(s.type));
        declare(d.name, { v: arr, type: s.type, arr: true });
      } else {
        let v = makeValue(s.type);
        if (d.init) v = coerce(s.type, yield* evalE(d.init));
        declare(d.name, { v, type: s.type });
      }
    }
  }

  function* exec(s) {
    yield* tick();
    switch (s.k) {
      case "block": {
        scopes.push(new Map());
        try {
          for (const st of s.body) {
            const r = yield* exec(st);
            if (r) return r;
          }
        } finally { scopes.pop(); }
        return null;
      }
      case "decl": yield* declStmt(s); return null;
      case "expr": yield* evalE(s.e); return null;
      case "if":
        if (yield* evalE(s.cond)) return yield* exec(s.then);
        if (s.els) return yield* exec(s.els);
        return null;
      case "while":
        while (yield* evalE(s.cond)) {
          const r = yield* exec(s.body);
          if (r === BREAK) break;
          if (r instanceof Ret) return r;
          yield* tick();
        }
        return null;
      case "for": {
        scopes.push(new Map());
        try {
          if (s.init) yield* exec(s.init);
          while (s.cond ? yield* evalE(s.cond) : true) {
            const r = yield* exec(s.body);
            if (r === BREAK) break;
            if (r instanceof Ret) return r;
            if (s.upd) yield* evalE(s.upd);
            yield* tick();
          }
        } finally { scopes.pop(); }
        return null;
      }
      case "return": return new Ret(s.e ? yield* evalE(s.e) : undefined);
      case "break": return BREAK;
      case "continue": return CONTINUE;
      default: throw new FwError("不支持的语句", s.line);
    }
  }

  function* lref(e) {
    if (e.k === "id") {
      const cell = lookup(e.name, e.line);
      return { get: () => cell.v, set: (v) => (cell.v = coerce(cell.type, v)) };
    }
    if (e.k === "index") {
      const arrCell = e.obj.k === "id" ? lookup(e.obj.name, e.line) : null;
      const arr = arrCell ? arrCell.v : yield* evalE(e.obj);
      const i = Math.trunc(yield* evalE(e.idx));
      if (!Array.isArray(arr)) throw new FwError("这不是数组", e.line);
      if (i < 0 || i >= arr.length) throw new FwError(`数组下标越界：${i}`, e.line);
      return { get: () => arr[i], set: (v) => (arr[i] = coerce(arrCell?.type, v)) };
    }
    throw new FwError("这里需要一个变量", e.line);
  }

  function arith(op, a, b, line) {
    if (op === "+" && (typeof a === "string" || typeof b === "string")) return fmt(a) + fmt(b);
    a = num(a, line); b = num(b, line);
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/":
        if (b === 0) throw new FwError("除以 0", line);
        return Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b;
      case "%":
        if (b === 0) throw new FwError("对 0 取余", line);
        return a % b;
      case "<": return a < b ? 1 : 0;
      case ">": return a > b ? 1 : 0;
      case "<=": return a <= b ? 1 : 0;
      case ">=": return a >= b ? 1 : 0;
      case "==": return a === b ? 1 : 0;
      case "!=": return a !== b ? 1 : 0;
      case "&": return a & b;
      case "|": return a | b;
      case "^": return a ^ b;
      case "<<": return a << b;
      case ">>": return a >> b;
      default: throw new FwError(`不支持的运算 ${op}`, line);
    }
  }

  function* evalE(e) {
    switch (e.k) {
      case "num": return e.v;
      case "str": return e.v;
      case "id": {
        if (e.name in CONSTS) {
          try { return lookup(e.name, e.line).v; } catch { return CONSTS[e.name]; }
        }
        return lookup(e.name, e.line).v;
      }
      case "un": {
        const v = yield* evalE(e.a);
        if (e.op === "-") return -num(v, e.line);
        if (e.op === "+") return num(v, e.line);
        if (e.op === "~") return ~num(v, e.line);
        return v ? 0 : 1;
      }
      case "cast": {
        const v = yield* evalE(e.a);
        return INT_TYPES.has(e.type) ? Math.trunc(v) : v;
      }
      case "bin": {
        if (e.op === "&&") return (yield* evalE(e.a)) ? ((yield* evalE(e.b)) ? 1 : 0) : 0;
        if (e.op === "||") return (yield* evalE(e.a)) ? 1 : (yield* evalE(e.b)) ? 1 : 0;
        const a = yield* evalE(e.a);
        const b = yield* evalE(e.b);
        return arith(e.op, a, b, e.line);
      }
      case "tern": return (yield* evalE(e.c)) ? yield* evalE(e.a) : yield* evalE(e.b);
      case "assign": {
        const ref = yield* lref(e.target);
        const v = yield* evalE(e.value);
        const nv = e.op === "=" ? v : arith(e.op[0], ref.get(), v, e.line);
        ref.set(nv);
        return ref.get();
      }
      case "incdec": {
        const ref = yield* lref(e.target);
        const old = num(ref.get(), e.line);
        ref.set(old + (e.op === "++" ? 1 : -1));
        return e.prefix ? ref.get() : old;
      }
      case "index": {
        const ref = yield* lref(e);
        return ref.get();
      }
      case "member": throw new FwError(`“${e.prop}” 后面要加括号调用`, e.line);
      case "call": return yield* call(e);
      default: throw new FwError("不支持的表达式", e.line);
    }
  }

  function* args(e) {
    const out = [];
    for (const a of e.args) out.push(yield* evalE(a));
    return out;
  }
  const need = (e, n, name) => {
    if (e.args.length < n) throw new FwError(`${name} 需要 ${n} 个参数`, e.line);
  };

  function* call(e) {
    const c = e.callee;
    if (c.k === "member") {
      // Serial.xxx
      if (c.obj.k === "id" && c.obj.name === "Serial") {
        const a = yield* args(e);
        if (c.prop === "begin") return 0;
        if (c.prop === "println") { io.emit({ type: "serial", text: a.length ? fmt(a[0]) : "", nl: true }); return 0; }
        if (c.prop === "print") { io.emit({ type: "serial", text: a.length ? fmt(a[0]) : "", nl: false }); return 0; }
        throw new FwError(`不支持 Serial.${c.prop}`, e.line);
      }
      const obj = yield* evalE(c.obj);
      if (!obj || obj.kind !== "servo") throw new FwError(`只有 Servo 对象才能调用 .${c.prop}()`, e.line);
      const a = yield* args(e);
      switch (c.prop) {
        case "attach": {
          need(e, 1, "attach(pin)");
          if (servoSeq > MAX_ATTACHED) throw new FwError("舵机对象太多", e.line);
          obj.pin = Math.trunc(a[0]);
          io.emit({ type: "attach", servo: obj.id, pin: obj.pin, line: e.line });
          return 1;
        }
        case "write": {
          need(e, 1, "write(angle)");
          if (obj.pin == null) throw new FwError("舵机还没 attach(pin) 就调用了 write()", e.line);
          const ang = Math.max(0, Math.min(180, Math.trunc(a[0])));
          obj.angle = ang;
          io.emit({ type: "write", servo: obj.id, pin: obj.pin, angle: ang, line: e.line });
          return 0;
        }
        case "read": return obj.angle;
        case "attached": return obj.pin != null ? 1 : 0;
        case "detach":
          io.emit({ type: "detach", servo: obj.id, pin: obj.pin });
          obj.pin = null;
          return 0;
        default: throw new FwError(`Servo 没有 .${c.prop}()`, e.line);
      }
    }
    if (c.k !== "id") throw new FwError("这里不能调用", e.line);
    const fn = ast.funcs[c.name];
    if (fn) {
      const a = yield* args(e);
      if (scopes.length > 200) throw new FwError("函数调用太深（是不是无限递归？）", e.line);
      scopes.push(new Map());
      fn.params.forEach((p, i) => declare(p.name, { v: coerce(p.type, a[i] ?? 0), type: p.type }));
      try {
        const r = yield* exec(fn.body);
        return r instanceof Ret ? coerce(fn.type, r.v) : 0;
      } finally { scopes.pop(); }
    }
    const a = yield* args(e);
    switch (c.name) {
      case "delay": {
        need(e, 1, "delay(ms)");
        const ms = Math.max(0, Number(a[0]) || 0);
        yield { delay: ms };
        return 0;
      }
      case "delayMicroseconds": yield { delay: (Number(a[0]) || 0) / 1000 }; return 0;
      case "millis": return Math.floor(io.now() - startedAt);
      case "micros": return Math.floor((io.now() - startedAt) * 1000);
      case "pinMode": {
        need(e, 2, "pinMode(pin, mode)");
        const mode = a[1] === 1 ? "OUTPUT" : a[1] === 2 ? "INPUT_PULLUP" : "INPUT";
        modes[Math.trunc(a[0])] = mode;
        io.emit({ type: "pin", pin: Math.trunc(a[0]), mode, line: e.line });
        return 0;
      }
      case "digitalWrite": need(e, 2, "digitalWrite(pin, v)"); io.emit({ type: "pin", pin: Math.trunc(a[0]), value: a[1] ? 1 : 0, line: e.line }); return 0;
      // 输入由页面根据电路算好后发进来（简化：只有高/低和一个 0–1 的模拟量），没有就当悬空
      case "digitalRead": {
        need(e, 1, "digitalRead(pin)");
        const pin = Math.trunc(a[0]);
        const v = io.read ? io.read("d", pin, modes[pin] || "INPUT") : null;
        return v == null ? (modes[pin] === "INPUT_PULLUP" ? 1 : 0) : v ? 1 : 0;
      }
      case "analogRead": {
        need(e, 1, "analogRead(pin)");
        const v = io.read ? io.read("a", Math.trunc(a[0])) : null;
        return Math.round((v == null ? 0 : Math.min(1, Math.max(0, v))) * ((1 << adcBits) - 1));
      }
      case "analogReadResolution": need(e, 1, "analogReadResolution(bits)"); adcBits = Math.min(16, Math.max(1, Math.trunc(a[0]))); return 0;
      case "map": need(e, 5, "map()"); return Math.trunc(((a[0] - a[1]) * (a[4] - a[3])) / (a[2] - a[1]) + a[3]);
      case "constrain": need(e, 3, "constrain()"); return Math.min(Math.max(a[0], a[1]), a[2]);
      case "abs": return Math.abs(a[0]);
      case "min": return Math.min(a[0], a[1]);
      case "max": return Math.max(a[0], a[1]);
      case "sin": return Math.sin(a[0]);
      case "cos": return Math.cos(a[0]);
      case "sqrt": return Math.sqrt(a[0]);
      case "pow": return Math.pow(a[0], a[1]);
      case "random": return a.length >= 2 ? a[0] + Math.floor(Math.random() * (a[1] - a[0])) : Math.floor(Math.random() * (a[0] || 1));
      case "randomSeed": return 0;
      default: throw new FwError(`不认识的函数 “${c.name}()”（简化解释器只支持一小部分 Arduino API）`, e.line);
    }
  }

  function* run() {
    for (const g of ast.globals) yield* declStmt(g);
    yield* call({ k: "call", callee: { k: "id", name: "setup" }, args: [], line: ast.funcs.setup.line });
    for (;;) {
      yield* call({ k: "call", callee: { k: "id", name: "loop" }, args: [], line: ast.funcs.loop.line });
      yield { delay: 0, loopEnd: true };
    }
  }

  return { run };
}
