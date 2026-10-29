/**
 * FIRMWARE ENGINE
 * A tiny Arduino-like subset. The interpreter walks an AST.
 * It does not call eval or Function, and it does not read page globals.
 * This is not an ESP32-S3 emulator.
 *
 * Event shape consumed by the UI:
 *   { t, type: "log", text }
 *   { t, type: "servo", name, pin, angle }
 *   { t, type: "done" }
 * t is milliseconds on the interpreter clock.
 */

export const FIRMWARE_ID = "javascript-subset-interpreter";

export const FIRMWARE_LIMITS = {
  maxLoops: 3,
  maxDelay: 5000,
  maxSteps: 4000,
  maxSource: 8000,
  maxTime: 20000,
};

export class FirmwareError extends Error {
  constructor(message, line) {
    super(line ? `第 ${line} 行：${message}` : message);
    this.name = "FirmwareError";
    this.line = line;
  }
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  const push = (type, value) => tokens.push({ type, value, line });
  while (index < source.length) {
    const char = source[index];
    if (char === "\n") {
      line += 1;
      index += 1;
      continue;
    }
    if (char === " " || char === "\t" || char === "\r") {
      index += 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") line += 1;
        index += 1;
      }
      if (source[index] !== "*") throw new FirmwareError("注释没有结束", line);
      index += 2;
      continue;
    }
    if (char === '"') {
      index += 1;
      let text = "";
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\n") throw new FirmwareError("字符串没有结束", line);
        if (source[index] === "\\") {
          const next = source[index + 1];
          if (next === "n") text += "\n";
          else if (next === '"') text += '"';
          else if (next === "\\") text += "\\";
          else throw new FirmwareError("不支持这个转义", line);
          index += 2;
          continue;
        }
        text += source[index];
        index += 1;
      }
      if (source[index] !== '"') throw new FirmwareError("字符串没有结束", line);
      index += 1;
      push("string", text);
      continue;
    }
    if (char === "-" && /[0-9]/.test(source[index + 1] || "")) {
      let raw = "-";
      index += 1;
      while (index < source.length && /[0-9]/.test(source[index])) {
        raw += source[index];
        index += 1;
      }
      push("number", Number(raw));
      continue;
    }
    if (/[0-9]/.test(char)) {
      let raw = "";
      while (index < source.length && /[0-9]/.test(source[index])) {
        raw += source[index];
        index += 1;
      }
      push("number", Number(raw));
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let raw = "";
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {
        raw += source[index];
        index += 1;
      }
      push("ident", raw);
      continue;
    }
    if ("(){};,.".includes(char)) {
      push(char, char);
      index += 1;
      continue;
    }
    throw new FirmwareError(`不认识的字符 ${char}`, line);
  }
  push("eof", "");
  return tokens;
}

function parse(tokens) {
  let index = 0;
  const peek = () => tokens[index];
  const eat = (type, value) => {
    const token = tokens[index];
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new FirmwareError(`这里需要 ${value || type}`, token.line);
    }
    index += 1;
    return token;
  };

  function parseBlock() {
    eat("{");
    const body = [];
    while (peek().type !== "}" && peek().type !== "eof") body.push(parseStatement(true));
    eat("}");
    return body;
  }

  function parseStatement(nested) {
    const token = peek();
    if (token.type === "ident" && token.value === "Servo") {
      eat("ident");
      const name = eat("ident").value;
      eat(";");
      return { type: "declare", name, line: token.line };
    }
    if (token.type === "ident" && token.value === "void") {
      eat("ident");
      const name = eat("ident").value;
      if (name !== "setup" && name !== "loop") {
        throw new FirmwareError("只支持 setup 和 loop", token.line);
      }
      if (nested) throw new FirmwareError(`${name} 只能写在最外层`, token.line);
      eat("(");
      eat(")");
      return { type: name, body: parseBlock(), line: token.line };
    }
    if (token.type === "ident" && (token.value === "setup" || token.value === "loop")) {
      const name = token.value;
      eat("ident");
      if (nested) throw new FirmwareError(`${name} 只能写在最外层`, token.line);
      eat("(");
      eat(")");
      return { type: name, body: parseBlock(), line: token.line };
    }
    if (token.type === "ident" && token.value === "delay") {
      eat("ident");
      eat("(");
      const ms = eat("number").value;
      eat(")");
      eat(";");
      return { type: "delay", ms, line: token.line };
    }
    if (token.type === "ident" && token.value === "Serial") {
      eat("ident");
      eat(".");
      const method = eat("ident").value;
      if (method !== "print" && method !== "println") {
        throw new FirmwareError("只支持 Serial.print 和 Serial.println", token.line);
      }
      eat("(");
      let text = "";
      if (peek().type === "string") text = eat("string").value;
      else if (peek().type === "number") text = String(eat("number").value);
      else throw new FirmwareError("Serial 只接受字符串或整数", peek().line);
      eat(")");
      eat(";");
      return { type: "print", text, line: token.line };
    }
    if (token.type === "ident") {
      const name = eat("ident").value;
      eat(".");
      const method = eat("ident").value;
      eat("(");
      const arg = eat("number").value;
      eat(")");
      eat(";");
      if (method === "attach") return { type: "attach", name, pin: arg, line: token.line };
      if (method === "write") return { type: "write", name, angle: arg, line: token.line };
      throw new FirmwareError(`不支持的调用 ${method}`, token.line);
    }
    throw new FirmwareError("不支持的语句", token.line);
  }

  const body = [];
  while (peek().type !== "eof") body.push(parseStatement(false));
  return body;
}

export function interpretSource(source) {
  if (typeof source !== "string") throw new FirmwareError("程序必须是文本");
  if (source.length > FIRMWARE_LIMITS.maxSource) throw new FirmwareError("程序太长");
  const body = parse(tokenize(source));
  if (body.length === 0) throw new FirmwareError("没有可执行的语句");

  const servos = new Map();
  const events = [];
  let time = 0;
  let steps = 0;

  function ensure(name) {
    if (!servos.has(name)) servos.set(name, { pin: null });
    return servos.get(name);
  }

  function execList(list) {
    for (const statement of list) exec(statement);
  }

  function exec(statement) {
    steps += 1;
    if (steps > FIRMWARE_LIMITS.maxSteps) {
      throw new FirmwareError("超过简化解释器的步数上限", statement.line);
    }
    if (time > FIRMWARE_LIMITS.maxTime) return;
    switch (statement.type) {
      case "declare":
        ensure(statement.name);
        break;
      case "attach": {
        const servo = ensure(statement.name);
        if (!Number.isInteger(statement.pin) || statement.pin < 0 || statement.pin > 48) {
          throw new FirmwareError("引脚号要是 0 到 48 的整数", statement.line);
        }
        servo.pin = statement.pin;
        events.push({
          t: time,
          type: "log",
          text: `${statement.name}.attach(${statement.pin})`,
        });
        break;
      }
      case "write": {
        const servo = ensure(statement.name);
        if (servo.pin == null) {
          throw new FirmwareError(`${statement.name} 还没有 attach`, statement.line);
        }
        let angle = statement.angle;
        if (!Number.isInteger(angle)) {
          throw new FirmwareError("角度要是整数", statement.line);
        }
        if (angle < 0 || angle > 180) {
          const clamped = Math.max(0, Math.min(180, angle));
          events.push({
            t: time,
            type: "log",
            text: `${statement.name}.write(${angle}) 超出 0–180，已夹到 ${clamped}`,
          });
          angle = clamped;
        }
        events.push({
          t: time,
          type: "servo",
          name: statement.name,
          pin: servo.pin,
          angle,
        });
        break;
      }
      case "delay":
        if (
          !Number.isInteger(statement.ms) ||
          statement.ms < 0 ||
          statement.ms > FIRMWARE_LIMITS.maxDelay
        ) {
          throw new FirmwareError("delay 只接受 0 到 5000 的整数毫秒", statement.line);
        }
        time += statement.ms;
        break;
      case "print":
        events.push({ t: time, type: "log", text: statement.text });
        break;
      case "setup":
        execList(statement.body);
        break;
      case "loop":
        break;
      default:
        throw new FirmwareError("不支持的语句", statement.line);
    }
  }

  const loops = [];
  const setups = [];
  const top = [];
  for (const statement of body) {
    if (statement.type === "loop") loops.push(statement);
    else if (statement.type === "setup") setups.push(statement);
    else top.push(statement);
  }
  if (loops.length > 1) throw new FirmwareError("只能有一个 loop");
  if (setups.length > 1) throw new FirmwareError("只能有一个 setup");
  execList(top);
  for (const setup of setups) execList(setup.body);
  if (loops.length === 1) {
    for (let count = 0; count < FIRMWARE_LIMITS.maxLoops; count += 1) {
      if (time > FIRMWARE_LIMITS.maxTime) break;
      execList(loops[0].body);
    }
    events.push({
      t: time,
      type: "log",
      text: `loop 运行了 ${FIRMWARE_LIMITS.maxLoops} 次后停止（简化解释器上限）`,
    });
  }
  events.push({ t: time, type: "done" });
  return events;
}
