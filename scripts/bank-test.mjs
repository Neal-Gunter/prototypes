// v38：题库管线 + 页面校验器单测（不开浏览器）。早期原型，简化仿真。
import { gzipSync } from "node:zlib";
import { readFileSync, mkdirSync, rmSync, cpSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { tokenize, skipTemplateParams, validateCSource, analyze, findCalls, maxLoopDepth, checkBalanced } from "../src/validators/c-lite.js";
import { validateAsm } from "../src/validators/asm.js";
import { validateHex } from "../src/validators/hex.js";
import { validateCode } from "../src/validators/index.js";
import { runTimeline, checkTimeline } from "../src/bank/timeline.js";
import { checkConnectionGraph, checkAssembly, netsOf } from "../src/bank/graph.js";
import { freshnessFlag, itemStale, SOON_MS } from "../src/bank/load.js";
import { computeFreshness, buildIndex, groupBank, build, assembleItems } from "./build-bank.js";
import { validateBank } from "./validate-bank.js";
import { DATA, ROOT, hash, writeJSON, readJSON, MODES, DIFFICULTIES } from "./bank/lib.js";
import { classify, scoreSeed, tier, extract, FAILURE_PATTERNS } from "./extract-fault-seeds.js";
import { mergeForks } from "./parse-fromthetransistor.js";
import { parseReadme } from "./bank/ftt-parsers.js";

let pass = 0, fail = 0;
const ok = (c, m, x = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", m, x); };

// ---------- c-lite ----------
{
  const src = "int x = 42; // 注释\n#define FOO 1\nint main() { return x; }\n";
  const t = tokenize(src);
  ok(t.some((x) => x.type === "number" && x.text === "42"), "tokenizer：数字不会被当成 ident");
  ok(!t.some((x) => x.text === "FOO" || x.text === "#"), "tokenizer：预处理行被抹掉");
}
{
  // 我的补充 2：括号里的 > 不算
  const t = tokenize("template<int N = (3>2)> class X {};");
  const i = t.findIndex((x) => x.text === "template");
  const after = skipTemplateParams(t, i);
  ok(t[after]?.text === "class" || t[after - 0]?.text === "class", `skipTemplateParams 跨过括号里的 >，下一个是 class（得到 ${t[after]?.text}）`);
}
{
  const t = tokenize("template<typename T> class Vec { void f() { if (a > b) { } } };");
  const r = analyze(t);
  ok(r.scopes.some((s) => s.kind === "class" && s.name === "Vec" && s.isTemplate), "findScopes：函数体里的 } 不会提前关掉类");
}
{
  const r = validateCSource("template<class T> class Box { T v; };", { requiredClasses: ["Box"], requiredTemplates: ["Box"] });
  ok(r.pass, "template<class T> 的参数不会被认成 class T", r.errors.map((e) => e.msg).join(";"));
}
{
  const r = validateCSource("void f(struct S *p, enum class Color c) { (void)p; (void)c; }", { requiredClasses: ["S"] });
  ok(!r.pass && r.errors.some((e) => e.name === "S"), "参数列表里的 struct S 不算类定义");
}
{
  const r = validateCSource("namespace { int x; } namespace N { int y; }", { requiredNamespaces: ["N"] });
  ok(r.pass && r.info.scopes.includes("namespace <anonymous>"), "匿名命名空间记作 <anonymous>，不吃掉下一个标识符");
}
{
  const r = validateCSource("template<typename T> T max(T a, T b) { return a > b ? a : b; }", { requiredTemplates: ["max"], requiredFunctions: ["max"] });
  ok(r.pass, "带返回类型的模板函数会被标成模板", JSON.stringify(r.info));
}
{
  const src = "template<typename T> struct C { void set(T); };\ntemplate<typename T> void C<T>::set(T v) { (void)v; }\nC::~C() {}\n";
  const r = validateCSource(src, { requiredFunctions: ["C::set"] });
  ok(r.info.functions.some((f) => f.includes("set")), "C<T>::set 外联能识别", r.info.functions.join(","));
}
{
  const r = validateCSource("int main() { if (1) {} for (int i=0;i<3;i++) {} }", { requiredFunctions: ["main"] });
  ok(r.pass && !r.info.functions.includes("if") && !r.info.functions.includes("for"), "if/for 不会被当成函数");
}
{
  const r = validateCSource("class Gpio { void set() {} };", { requiredFunctions: ["Gpio::set"], requiredClasses: ["Gpio"] });
  ok(r.pass, "类内联成员能对上 Gpio::set");
}
{
  const r = validateCSource("int foo() { return 1; }\nint main() { foo(); new int; malloc(1); bar<int>(1); }\n", { requiredCalls: ["foo", "new", "malloc", "bar"], requiredFunctions: ["foo", "main"] });
  ok(r.pass, "findCalls：定义不算调用；能认出 new、malloc、foo<int>(", r.info.calls.join(","));
  const r2 = validateCSource("int foo() { return 1; }", { forbiddenCalls: ["foo"] });
  ok(r2.pass, "函数定义本身不会被当成调用了 foo");
}
{
  const r = validateCSource("int main() { for(;;) { while(1) { } } }", { requiredFunctions: ["main"], maxLoopDepth: 1 });
  ok(r.pass && r.warnings.some((w) => w.code === "loop-depth") && r.info.loopDepth >= 2, `循环深度 ${r.info.loopDepth}，超过建议值给警告`);
}
{
  const bad = checkBalanced(tokenize("int main() { if (1) { }"));
  ok(bad && bad.code === "unbalanced-open", "checkBalanced 能发现未闭合的 {");
}
{
  const r = validateCSource("template<typename T> class A { }; template<typename T> class B { A<A<T>> x; };", { requiredTemplates: ["A", "B"] });
  ok(r.pass, "模板参数里的 >> 能跳过");
}
{
  const bytes = gzipSync(readFileSync(new URL("../src/validators/c-lite.js", import.meta.url)), { level: 9 }).length;
  ok(bytes < 35 * 1024, `c-lite.js gzip ${bytes} B < 35 KB`);
}
ok(!/WebAssembly|wasm/.test(readFileSync(new URL("../src/validators/c-lite.js", import.meta.url), "utf8") + readFileSync(new URL("../src/validators/index.js", import.meta.url), "utf8")), "页面校验器源码不加载 WASM");

// ---------- asm / hex ----------
{
  const r = validateAsm(".text\nstart:\n  mov r0, #1\n  add r0, r0, #1\n  b start\n", { requiredInstructions: ["mov", "add"], requiredLabels: ["start"] });
  ok(r.pass, "asm：合法的 mov/add/b");
  const r2 = validateAsm("foo:\n  b bar\n", {});
  ok(!r2.pass && r2.errors.some((e) => e.code === "label"), "asm：跳转目标不存在");
  const r3 = validateAsm("mov r0, #1, #2, #3\n", {});
  ok(!r3.pass && r3.errors.some((e) => e.code === "operands"), "asm：操作数数量不对");
  const r4 = validateAsm("mov foo0, #1\n", {});
  ok(!r4.pass && r4.errors.some((e) => e.code === "register"), "asm：寄存器不在白名单");
}
{
  const okHex = ":0100000000FF\n:00000001FF\n";
  ok(validateHex(okHex, { maxBytes: 8 }).pass, "hex：合法记录 + EOF + 校验和");
  ok(!validateHex(":010000000000\n:00000001FF\n").pass, "hex：校验和错误");
  ok(!validateHex(":0100000000FF\n").pass, "hex：缺少 EOF");
  const entry = ":020000040800F2\n:020100000001FC\n:0400000508000100EE\n:00000001FF\n";
  // checksum of type 05 will be verified by parser — if I got it wrong the test tells us
  const v = validateHex(readFileSync(join(ROOT, "data/seeds/reference/cc-hex-entry-01.hex"), "utf8"), { entry: 0x08000100, mustContain: [{ address: 0x08000100, bytes: "0001" }], addrMin: 0x08000000, addrMax: 0x0800ffff, maxBytes: 32 });
  ok(v.pass, "hex：入口与复位向量", v.errors.map((e) => e.msg).join(";"));
}

// ---------- timeline ----------
{
  const src = "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(500);digitalWrite(LED_BUILTIN,LOW);delay(500);}";
  const ev = runTimeline(src, { horizonMs: 1500 });
  const r = checkTimeline(ev, { pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }, { t: 500, pin: "LED", state: "LOW" }, { t: 1000, pin: "LED", state: "HIGH" }], toleranceMs: 100 });
  ok(r.pass, "firmware 时间线：500 ms 闪烁");
  const bad = "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(50);digitalWrite(LED_BUILTIN,LOW);delay(50);}";
  const r2 = checkTimeline(runTimeline(bad, { horizonMs: 1500 }), { pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }, { t: 500, pin: "LED", state: "LOW" }], toleranceMs: 100 });
  ok(!r2.pass, "firmware 时间线：周期不对会失败；乱翻转也会因 extra 失败");
}

// ---------- graph / assembly ----------
{
  const ok1 = checkConnectionGraph({ wires: [{ a: "pico.GP15", b: "led.A" }, { a: "led.K", b: "r220.1" }, { a: "r220.2", b: "pico.GND" }] }, { requiredEdges: [{ a: "pico.GP15", b: "led.A" }, { a: "led.K", b: "r220.1" }, { a: "r220.2", b: "pico.GND" }], forbiddenEdges: [{ a: "pico.3V3", b: "pico.GND" }] });
  ok(ok1.pass, "连接图：经电阻到地通过");
  const short = checkConnectionGraph({ wires: [{ a: "pico.3V3", b: "pico.GND" }] }, { forbiddenEdges: [{ a: "pico.3V3", b: "pico.GND" }] });
  ok(!short.pass, "连接图：电源短接失败");
  const aok = checkAssembly({ steps: [{ part: "copper-standoff" }, { part: "board" }, { part: "screw" }] }, { requiredParts: ["copper-standoff", "board", "screw"], order: [{ before: "copper-standoff", after: "board" }, { before: "board", after: "screw" }] });
  ok(aok.pass, "装配顺序：铜柱 → 板 → 螺丝");
  const aBad = checkAssembly({ steps: [{ part: "screw" }, { part: "board" }] }, { requiredParts: ["board", "screw"], order: [{ before: "board", after: "screw" }] });
  ok(!aBad.pass, "装配顺序：先拧螺丝会失败");
}

// ---------- freshness ----------
{
  const now = Date.parse("2026-11-10T00:00:00Z");
  const entries = [{ staleAfter: "2026-10-01" }, { staleAfter: "2026-11-25" }, { staleAfter: "2027-11-01" }];
  const f = computeFreshness(entries, now);
  ok(f.staleCount === 1, `staleCount=${f.staleCount}（只有 2026-10-01 已过期）`);
  ok(f.staleEarliest === "2026-10-01T00:00:00.000Z" || f.staleEarliest.startsWith("2026-10-01"), `staleEarliest=${f.staleEarliest}`);
  ok(freshnessFlag({ staleEarliest: "2026-11-25T00:00:00Z", staleCount: 0 }, now) === "soon", "距今 <30 天黄标");
  ok(freshnessFlag({ staleEarliest: "2027-11-01T00:00:00Z", staleCount: 0 }, now) === "none", "一年后不过期，不黄标");
  ok(freshnessFlag({ staleCount: 1, staleEarliest: "2026-10-01T00:00:00Z" }, now) === "stale", "已过期条目记 stale");
  ok(itemStale({ staleAfter: "2026-10-01" }, now) && !itemStale({ staleAfter: "2027-11-01" }, now), "itemStale 按 staleAfter 判断");
  ok(SOON_MS === 30 * 24 * 3600 * 1000, "黄标窗口是 30 天");
}

// ---------- index updatedAt hash ----------
{
  const now = Date.parse("2026-11-10T00:00:00Z");
  const { bank } = groupBank([
    { id: "a", mode: "firmware", difficulty: "intro", source: { repo: "x" }, staleAfter: "2027-01-01", title: "t", passCondition: { type: "behaviorTimeline", expected: [] } },
  ], now);
  const i1 = buildIndex(bank, null, now);
  const later = now + 86400000;
  const i2 = buildIndex(bank, i1, later);
  ok(i1.modes.firmware.intro.updatedAt === i1.generatedAt, "首次 updatedAt = generatedAt");
  ok(i2.modes.firmware.intro.updatedAt === i1.modes.firmware.intro.updatedAt, "内容不变时保留上次 updatedAt");
  ok(i2.modes.firmware.intro.contentHash === i1.modes.firmware.intro.contentHash, "内容 hash 不变");
  bank.firmware.intro[0] = { ...bank.firmware.intro[0], title: "changed" };
  const i3 = buildIndex(bank, i2, later + 1000);
  ok(i3.modes.firmware.intro.updatedAt === i3.generatedAt, "内容变了才更新 updatedAt");
}

// ---------- fork parsers still work ----------
{
  const md1 = "## Sec\n- [ ] **Blinking an LED (Verilog, 10 LOC)**\n";
  const md2 = "| Project | Lang | LOC |\n| --- | --- | --- |\n| UART bringup | C | 80 |\n";
  const a = parseReadme(md1), b = parseReadme(md2);
  ok(a.projects.length >= 1 && b.projects.length >= 1 && a.format !== b.format, `至少两种 README 格式能解析（${a.format} / ${b.format}）`);
  const r = mergeForks(
    [{ repo: "geohot/fromthetransistor" }, { repo: "someone/fromthetransistor" }, { repo: "empty/fromthetransistor" }],
    (repo) => repo === "empty/fromthetransistor" ? "# empty\nno projects here\n" : md1,
    (repo) => repo === "someone/fromthetransistor" ? { projects: [{ section: "S", title: "Override project", language: "C", locEstimate: 3 }] } : null,
  );
  ok(r.skipped.some((s) => s.repo === "empty/fromthetransistor" && s._skipped), "解析失败的 fork 被标 _skipped");
  ok(r.projects.some((p) => p.source.via === "override"), "override 优先于自动解析");
}

// ---------- fault seeds still work ----------
{
  const hits = classify("reversed polarity caused no power. 反接后不上电。");
  ok(hits.some((h) => h.failureMode === "reverse-polarity" && h.matchedKeywords.length >= 1), "故障规则能分出反接");
  ok(tier(0.9) === "high" && tier(0.5) === "medium" && tier(0.2) === "low", "打分分档");
  const seeds = readJSON(join(DATA, "seeds/fault-seeds.json"))?.seeds || [];
  const review = readJSON(join(DATA, "seeds/fault-seeds-review.json"))?.items || [];
  ok(seeds.length >= 1 && review.length >= 1, `故障种子入库 ${seeds.length}，review ${review.length}（不阻断）`);
  ok(seeds.every((s) => s.source.type !== "link-only"), "link-only 来源不入库");
}

// ---------- build + validate + failure protection ----------
{
  const r = build({ now: Date.parse("2026-11-10T00:00:00Z") });
  ok(r.ok && r.total >= 30, `build-bank 写出 ${r.total} 条（≥30）`);
  const v = validateBank({ now: Date.parse("2026-11-10T00:00:00Z") });
  ok(v.ok, "validate-bank 通过", v.errors?.join(";"));
  const idx = readJSON(join(DATA, "bank/index.json"));
  const intro = idx.modes["code-check"].intro;
  ok(intro.staleCount === 1 && intro.count >= 1, `code-check/intro staleCount=${intro.staleCount}（故意过期的那一题）`);
  const fwInt = idx.modes.firmware.intermediate;
  ok(fwInt.staleCount === 0 && fwInt.staleEarliest && Date.parse(fwInt.staleEarliest) > Date.parse("2026-11-10"), "即将过期的题计入 staleEarliest，但不计入 staleCount");
  ok(existsSync(join(ROOT, "public/bank/index.json")), "public/bank 已同步");
  // 0 条不覆盖
  const tmp = join(tmpdir(), "bank-data-" + Date.now());
  mkdirSync(join(tmp, "seeds"), { recursive: true });
  mkdirSync(join(tmp, "meta"), { recursive: true });
  mkdirSync(join(tmp, "bank"), { recursive: true });
  writeFileSync(join(tmp, "bank/marker.txt"), "keep-me");
  writeJSON(join(tmp, "seeds/bank-items.json"), { items: [] });
  let threw = false;
  try { build({ dataDir: tmp, dest: join(tmp, "bank"), publicDir: null, seedsPath: join(tmp, "seeds/bank-items.json") }); } catch { threw = true; }
  ok(threw && existsSync(join(tmp, "bank/marker.txt")) && !existsSync(join(tmp, "bank/index.json")), "0 条时不覆盖已有产物，只写 build-report");
  const rep = readJSON(join(tmp, "meta/build-report.json"));
  ok(rep && rep.ok === false && rep.errors?.length, "失败时写下 build-report.json");
  rmSync(tmp, { recursive: true, force: true });
}

// ---------- 参考答案用页面校验器自检（构建期也用） ----------
{
  const doc = readJSON(join(DATA, "seeds/bank-items.json"));
  let n = 0, bad = [];
  for (const it of doc.items) {
    const pc = it.passCondition;
    if (pc.type === "codeCheck" && pc.referenceAnswer) {
      const src = readFileSync(join(ROOT, pc.referenceAnswer), "utf8");
      const r = validateCode(pc.format, src, pc.spec);
      n++;
      if (!r.pass) bad.push(it.id + ": " + r.errors.map((e) => e.msg).join(","));
    } else if (pc.type === "behaviorTimeline" && it.referenceFirmware) {
      const ev = runTimeline(it.referenceFirmware, { horizonMs: pc.horizonMs || 3000, inputs: pc.inputs || {} });
      const r = checkTimeline(ev, pc);
      n++;
      if (!r.pass) bad.push(it.id + ": timeline");
    } else if (pc.type === "connectionGraphConstraint" && it.referenceAnswer) {
      const r = checkConnectionGraph(it.referenceAnswer, pc);
      n++;
      if (!r.pass) bad.push(it.id + ": " + r.errors.map((e) => e.msg).join(","));
    } else if (pc.type === "assemblyConstraint" && it.referenceAnswer) {
      const r = checkAssembly(it.referenceAnswer, pc);
      n++;
      if (!r.pass) bad.push(it.id + ": " + r.errors.map((e) => e.msg).join(","));
    } else if (pc.type === "diagnosisQuiz") {
      n++;
      const qok = (pc.questions || []).every((q) => q.answer && (q.options || []).some((o) => o.id === q.answer)) && pc.repairUrl;
      if (!qok) bad.push(it.id + ": quiz");
    }
  }
  ok(bad.length === 0 && n >= 30, `参考答案 / 题面自检 ${n} 条，失败 ${bad.length}`, bad.join("; "));
}

console.log(`bank-test ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
