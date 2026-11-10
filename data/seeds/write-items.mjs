// 一次性写出 data/seeds/bank-items.json 和 reference 源文件。题目正文全部自己写。
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = dirname(fileURLToPath(import.meta.url));
const hexRec = (type, addr, data = []) => {
  const b = [data.length, (addr >> 8) & 0xff, addr & 0xff, type, ...data];
  b.push((0x100 - (b.reduce((a, x) => a + x, 0) & 0xff)) & 0xff);
  return ":" + b.map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join("");
};
const HEX_EOF = hexRec(1, 0, []);

const item = (o) => ({
  attribution: "按公开资料整理",
  staleAfter: o.staleAfter || "2027-11-01",
  hints: o.hints || [],
  hintsEn: o.hintsEn || [],
  ...o,
});

const items = [
  // ---------- firmware (8) ----------
  item({
    id: "fw-led-blink-01", mode: "firmware", difficulty: "intro",
    source: { repo: "geohot/fromthetransistor", path: "Section 2: Bringup", originalProject: "Blinking an LED (Verilog, 10 LOC)", adaptation: "translated-to-js-timing", note: "只取标题、语言和 LOC；题面自己写" },
    title: "让板载 LED 以 500 ms 为周期闪烁",
    titleEn: "Blink the onboard LED on a 500 ms period",
    prompt: "用页面里的类 Arduino 解释器，让 LED_BUILTIN 先亮 500 ms，再灭 500 ms，如此循环。时间只在 delay() 里前进。这是简化仿真，不是真实芯片。",
    promptEn: "Using the on-page Arduino-like interpreter, drive LED_BUILTIN high for 500 ms and low for 500 ms, and repeat. Time only advances inside delay(). This is a simplified simulation, not a real chip.",
    firmwareTemplate: "// 在这里写闪烁逻辑\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  \n}\n",
    passCondition: { type: "behaviorTimeline", pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }, { t: 500, pin: "LED", state: "LOW" }, { t: 1000, pin: "LED", state: "HIGH" }], toleranceMs: 100, horizonMs: 2500 },
    hints: ["解释器支持 pinMode、digitalWrite 和 delay。", "LED_BUILTIN 在这里等于 48。"],
    hintsEn: ["The interpreter supports pinMode, digitalWrite and delay.", "LED_BUILTIN equals 48 here."],
    referenceFirmware: "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(500);digitalWrite(LED_BUILTIN,LOW);delay(500);}",
  }),
  item({
    id: "fw-led-hold-01", mode: "firmware", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "上电后点亮 LED 并保持",
    titleEn: "Turn the LED on at start and leave it on",
    prompt: "在 setup 里把 LED_BUILTIN 设为输出并拉高。loop 里不要再翻转它。页面会检查 t=0 时已是高电平，并且在观察窗里不要再出现跳变。",
    promptEn: "In setup, set LED_BUILTIN as an output and drive it high. Do not toggle it in loop. The page checks that it is high at t=0 and that it does not toggle again in the observation window.",
    firmwareTemplate: "void setup() {\n  \n}\nvoid loop() {\n}\n",
    passCondition: { type: "behaviorTimeline", pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }], toleranceMs: 50, horizonMs: 1000 },
    referenceFirmware: "void setup(){pinMode(LED_BUILTIN,OUTPUT);digitalWrite(LED_BUILTIN,HIGH);}void loop(){}",
  }),
  item({
    id: "fw-serial-hello-01", mode: "firmware", difficulty: "intro",
    source: { repo: "geohot/fromthetransistor", path: "Section 2: Bringup", originalProject: "Bootstrapping a C compiler (C, 10000? LOC)", adaptation: "translated-to-js-timing", note: "只借用‘上电后给出可观察输出’这一判断点，题面和代码自己写" },
    title: "上电后从串口打出 ready",
    titleEn: "Print ready on the serial port at start",
    prompt: "在 setup 里调用 Serial.println(\"ready\")。页面只看这一行文本，不检查波特率（解释器没有真实 UART）。",
    promptEn: "Call Serial.println(\"ready\") in setup. The page only checks that text; baud rate is not modelled (the interpreter has no real UART).",
    firmwareTemplate: "void setup() {\n  \n}\nvoid loop() {\n}\n",
    passCondition: { type: "behaviorTimeline", expected: [{ t: 0, serial: "ready" }], toleranceMs: 50, horizonMs: 500 },
    referenceFirmware: "void setup(){Serial.println(\"ready\");}void loop(){}",
  }),
  item({
    id: "fw-btn-led-01", mode: "firmware", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "按键为高时点亮 LED",
    titleEn: "Light the LED while the button reads high",
    prompt: "引脚 2 在本题里被设成稳定高电平（模拟按下）。请读取这个引脚，为高时把 LED_BUILTIN 拉高。没有按下时不要亮（本题输入一直为高）。",
    promptEn: "Pin 2 is held high in this task (a pressed button). Read that pin and drive LED_BUILTIN high when it is high. The input stays high for the whole run.",
    firmwareTemplate: "void setup() {\n  pinMode(2, INPUT);\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  \n}\n",
    passCondition: { type: "behaviorTimeline", pins: { LED: 48 }, inputs: { d2: 1 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }], toleranceMs: 50, horizonMs: 500 },
    referenceFirmware: "void setup(){pinMode(2,INPUT);pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,digitalRead(2));}",
  }),
  item({
    id: "fw-led-duty-01", mode: "firmware", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "20% 占空比的 LED 闪烁（200 ms 亮、800 ms 灭）",
    titleEn: "Blink the LED at 20% duty (200 ms on, 800 ms off)",
    prompt: "让 LED_BUILTIN 亮 200 ms、灭 800 ms，重复。允许 ±100 ms。这是时序练习，不是 PWM 硬件。",
    promptEn: "Drive LED_BUILTIN high for 200 ms and low for 800 ms, and repeat. ±100 ms is accepted. This is a timing exercise, not hardware PWM.",
    firmwareTemplate: "void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  \n}\n",
    passCondition: { type: "behaviorTimeline", pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }, { t: 200, pin: "LED", state: "LOW" }, { t: 1000, pin: "LED", state: "HIGH" }, { t: 1200, pin: "LED", state: "LOW" }], toleranceMs: 100, horizonMs: 2500 },
    referenceFirmware: "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(200);digitalWrite(LED_BUILTIN,LOW);delay(800);}",
  }),
  item({
    id: "fw-serial-tick-01", mode: "firmware", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "每秒从串口打出 tick",
    titleEn: "Print tick on serial once a second",
    prompt: "从 t=0 开始，每隔 1000 ms 调用一次 Serial.println(\"tick\")，至少打出三次。时间仍只在 delay() 里走。",
    promptEn: "Starting at t=0, call Serial.println(\"tick\") every 1000 ms, at least three times. Time still only advances inside delay().",
    firmwareTemplate: "void setup() {\n}\nvoid loop() {\n  \n}\n",
    passCondition: { type: "behaviorTimeline", expected: [{ t: 0, serial: "tick" }, { t: 1000, serial: "tick" }, { t: 2000, serial: "tick" }], toleranceMs: 80, horizonMs: 2500 },
    referenceFirmware: "void setup(){}void loop(){Serial.println(\"tick\");delay(1000);}",
  }),
  item({
    id: "fw-two-phase-01", mode: "firmware", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "先快闪两次，再停 600 ms",
    titleEn: "Two short flashes, then a 600 ms pause",
    prompt: "LED_BUILTIN：亮 100 ms、灭 100 ms、再亮 100 ms、再灭 600 ms，然后重复。检查前两个亮灭和第三次变亮。",
    promptEn: "On LED_BUILTIN: 100 ms on, 100 ms off, 100 ms on, 600 ms off, then repeat. The check covers the first two flashes and the start of the next cycle.",
    firmwareTemplate: "void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  \n}\n",
    passCondition: { type: "behaviorTimeline", pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }, { t: 100, pin: "LED", state: "LOW" }, { t: 200, pin: "LED", state: "HIGH" }, { t: 300, pin: "LED", state: "LOW" }, { t: 900, pin: "LED", state: "HIGH" }], toleranceMs: 80, horizonMs: 2000 },
    referenceFirmware: "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(100);digitalWrite(LED_BUILTIN,LOW);delay(100);digitalWrite(LED_BUILTIN,HIGH);delay(100);digitalWrite(LED_BUILTIN,LOW);delay(600);}",
  }),
  item({
    id: "fw-burst-01", mode: "firmware", difficulty: "advanced",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "三次 80 ms 短脉冲后长灭",
    titleEn: "Three 80 ms pulses followed by a long off period",
    prompt: "LED_BUILTIN 连续三次：亮 80 ms、灭 80 ms；第三次灭之后再多灭 400 ms（也就是第三次亮之后一共灭 480 ms），然后重复。允许 ±50 ms。乱翻翻转碰运气会被判失败。",
    promptEn: "On LED_BUILTIN, three times: 80 ms on, 80 ms off; after the third off, wait an extra 400 ms (480 ms off after the third on), then repeat. ±50 ms is accepted. Extra toggles fail the check.",
    firmwareTemplate: "void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  \n}\n",
    passCondition: { type: "behaviorTimeline", pins: { LED: 48 }, expected: [
      { t: 0, pin: "LED", state: "HIGH" }, { t: 80, pin: "LED", state: "LOW" },
      { t: 160, pin: "LED", state: "HIGH" }, { t: 240, pin: "LED", state: "LOW" },
      { t: 320, pin: "LED", state: "HIGH" }, { t: 400, pin: "LED", state: "LOW" },
      { t: 880, pin: "LED", state: "HIGH" }
    ], toleranceMs: 50, horizonMs: 1500 },
    referenceFirmware: "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){for(int i=0;i<3;i++){digitalWrite(LED_BUILTIN,HIGH);delay(80);digitalWrite(LED_BUILTIN,LOW);delay(80);}delay(400);}",
  }),

  // ---------- code-check (12) ----------
  item({
    id: "cc-c-blink-fn-01", mode: "code-check", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "写出一个名为 blink 的 C 函数",
    titleEn: "Write a C function named blink",
    prompt: "在下面写出至少两个函数：main 和 blink。blink 要有函数体（空的也行）。这是结构检查，不编译、不运行。",
    promptEn: "Write at least two functions: main and blink. blink must have a body (an empty body is fine). This is a structure check; nothing is compiled or run.",
    starter: "/* 在这里写 */\n",
    passCondition: { type: "codeCheck", format: "c", spec: { requiredFunctions: ["main", "blink"] }, referenceAnswer: "data/seeds/reference/cc-c-blink-fn-01.c" },
  }),
  item({
    id: "cc-c-noprintf-01", mode: "code-check", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "写 main，但不要调用 printf 或 malloc",
    titleEn: "Write main without calling printf or malloc",
    prompt: "实现 main。本题禁止调用 printf 和 malloc（教学用的静态检查，不是完整的链接器）。",
    promptEn: "Implement main. This task forbids calls to printf and malloc (a teaching static check, not a full linker).",
    starter: "int main(void) {\n  return 0;\n}\n",
    passCondition: { type: "codeCheck", format: "c", spec: { requiredFunctions: ["main"], forbiddenCalls: ["printf", "malloc"] }, referenceAnswer: "data/seeds/reference/cc-c-noprintf-01.c" },
  }),
  item({
    id: "cc-asm-add-01", mode: "code-check", difficulty: "intro",
    source: { repo: "geohot/fromthetransistor", path: "Section 5: Assembler", originalProject: "Assembler (Python, 2000?+ LOC)", adaptation: "original-asm-subset", note: "只取标题、语言和 LOC；指令集是本站教学子集，不是原项目的汇编器" },
    title: "用 mov 和 add 把 r0 写成 2",
    titleEn: "Use mov and add so r0 becomes 2",
    prompt: "用本站的 ARM 风格教学子集：至少写一条 mov 和一条 add。操作数个数要符合表。不汇编、不执行，只做文本检查。",
    promptEn: "Using this site's ARM-style teaching subset, write at least one mov and one add. Operand counts must match the table. This is a text check; nothing is assembled or executed.",
    starter: ".text\nstart:\n  \n",
    passCondition: { type: "codeCheck", format: "asm", spec: { requiredInstructions: ["mov", "add"], requiredLabels: ["start"] }, referenceAnswer: "data/seeds/reference/cc-asm-add-01.s" },
  }),
  item({
    id: "cc-hex-eof-01", mode: "code-check", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "写一份带结束记录的 Intel HEX",
    titleEn: "Write an Intel HEX file that includes an end record",
    prompt: "提交一份合法的 Intel HEX：至少有一条数据记录，并以 :00000001FF 结束。校验和必须正确。不烧录。",
    promptEn: "Submit a valid Intel HEX file with at least one data record, ending with :00000001FF. Checksums must be correct. Nothing is flashed.",
    starter: ":0100000000FF\n:00000001FF\n",
    passCondition: { type: "codeCheck", format: "hex", spec: { maxBytes: 64 }, referenceAnswer: "data/seeds/reference/cc-hex-eof-01.hex" },
  }),
  item({
    id: "cc-cpp-ns-01", mode: "code-check", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "在命名空间 hal 里实现 init",
    titleEn: "Implement init inside namespace hal",
    prompt: "写出 namespace hal { ... }，并在其中定义 init()。也可以写成 hal::init()。页面检查命名空间和函数名，不做类型检查。",
    promptEn: "Write namespace hal { ... } and define init() inside it. hal::init() written out-of-line is also accepted. The page checks names, not types.",
    starter: "namespace hal {\n  \n}\n",
    passCondition: { type: "codeCheck", format: "cpp", spec: { requiredNamespaces: ["hal"], requiredFunctions: ["init", "hal::init"] }, referenceAnswer: "data/seeds/reference/cc-cpp-ns-01.cpp" },
  }),
  item({
    id: "cc-cpp-gpio-01", mode: "code-check", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "写出类 Gpio，并提供 Gpio::set",
    titleEn: "Write class Gpio with a Gpio::set method",
    prompt: "定义 class Gpio，并实现 void set(...)（写在类里或类外都可以）。还要有 main，并在里面调用 gpio_init。不要调用 printf。",
    promptEn: "Define class Gpio and implement void set(...) (inside or outside the class). Also write main and call gpio_init from it. Do not call printf.",
    starter: "void gpio_init();\n\n",
    passCondition: { type: "codeCheck", format: "cpp", spec: { requiredClasses: ["Gpio"], requiredFunctions: ["Gpio::set", "main"], requiredCalls: ["gpio_init"], forbiddenCalls: ["printf"] }, referenceAnswer: "data/seeds/reference/cc-cpp-gpio-01.cpp" },
  }),
  item({
    id: "cc-cpp-ctor-01", mode: "code-check", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "为 Led 写出构造函数和析构函数",
    titleEn: "Write a constructor and destructor for Led",
    prompt: "定义 class Led，并写出 Led::Led() 和 Led::~Led()（类内或类外都可以）。页面能识别 C::C() 和 ~C 这两种写法。",
    promptEn: "Define class Led and write Led::Led() and Led::~Led() (inside or outside the class). The page recognises both C::C() and ~C forms.",
    starter: "class Led {\npublic:\n  \n};\n",
    passCondition: { type: "codeCheck", format: "cpp", spec: { requiredClasses: ["Led"], requiredFunctions: ["Led::Led", "Led::~Led"] }, referenceAnswer: "data/seeds/reference/cc-cpp-ctor-01.cpp" },
  }),
  item({
    id: "cc-asm-loop-01", mode: "code-check", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "写一个带 loop 标签的跳转",
    titleEn: "Write a branch to a loop label",
    prompt: "定义标签 loop，并用 b 或 beq 等跳回去。跳转目标必须是已定义的标签。指令数不超过 16 条。",
    promptEn: "Define a label called loop and branch back to it with b or beq (or similar). The branch target must be a defined label. At most 16 instructions.",
    starter: ".text\nloop:\n  \n",
    passCondition: { type: "codeCheck", format: "asm", spec: { requiredLabels: ["loop"], requiredInstructions: ["b"], maxInstructions: 16 }, referenceAnswer: "data/seeds/reference/cc-asm-loop-01.s" },
  }),
  item({
    id: "cc-cpp-tpl-max-01", mode: "code-check", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "写出模板函数 max",
    titleEn: "Write a template function max",
    prompt: "写出 template<typename T> T max(T a, T b) { ... }。页面检查 requiredTemplates 里的 max（模板函数和模板类合并检查，这是已确认的决定）。",
    promptEn: "Write template<typename T> T max(T a, T b) { ... }. The page checks max in requiredTemplates (template functions and template classes share one set; this is an agreed decision).",
    starter: "template<typename T>\n",
    passCondition: { type: "codeCheck", format: "cpp", spec: { requiredTemplates: ["max"], requiredFunctions: ["max"] }, referenceAnswer: "data/seeds/reference/cc-cpp-tpl-max-01.cpp" },
  }),
  item({
    id: "cc-cpp-tpl-ring-01", mode: "code-check", difficulty: "advanced",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "写出模板类 RingBuffer，参数里允许出现 >>",
    titleEn: "Write template class RingBuffer, including a >> in the template arguments",
    prompt: "定义 template<typename T, typename Buf = Slot<Slot<T>>> class RingBuffer { ... }（或等价的嵌套 <> / >>）。还要有成员函数 push。这是在检查解析器能不能跨过 >>，不是要你实现真正的容器。",
    promptEn: "Define template<typename T, typename Buf = Slot<Slot<T>>> class RingBuffer { ... } (or an equivalent nested <> / >>). Also provide a member function push. This checks that the parser can skip >>, not that you implement a real container.",
    starter: "template<typename T>\nclass Slot {};\n\n",
    passCondition: { type: "codeCheck", format: "cpp", spec: { requiredTemplates: ["RingBuffer"], requiredClasses: ["RingBuffer"], requiredFunctions: ["RingBuffer::push"] }, referenceAnswer: "data/seeds/reference/cc-cpp-tpl-ring-01.cpp" },
  }),
  item({
    id: "cc-hex-entry-01", mode: "code-check", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "HEX 文件要带入口地址，复位向量处写入指定字节",
    titleEn: "The HEX file must include an entry address and a reset vector",
    prompt: "提交 Intel HEX：入口地址（类型 05 记录）为 0x08000100，并且地址 0x08000100 起的两个字节是 00 01。总数据不超过 32 字节。数字是本题约定的练习值，不是某一款 MCU 的实测向量（估算/约定）。",
    promptEn: "Submit Intel HEX with a type-05 start address of 0x08000100, and bytes 00 01 at address 0x08000100. At most 32 data bytes. These numbers are a teaching convention, not a measured vector from a particular MCU (estimate / convention).",
    starter: "",
    passCondition: { type: "codeCheck", format: "hex", spec: { entry: 0x08000100, maxBytes: 32, addrMin: 0x08000000, addrMax: 0x0800ffff, mustContain: [{ address: 0x08000100, bytes: "0001", why: "复位向量约定值", whyEn: "agreed reset-vector bytes" }] }, referenceAnswer: "data/seeds/reference/cc-hex-entry-01.hex" },
  }),
  item({
    id: "cc-c-calls-01", mode: "code-check", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "在 main 里调用 gpio_init，循环不要嵌套超过 2 层",
    titleEn: "Call gpio_init from main; keep loop nesting at most 2",
    prompt: "实现 main，并调用 gpio_init。不要调用 printf。循环嵌套超过 2 层会给警告（仍可通过）。",
    promptEn: "Implement main and call gpio_init. Do not call printf. Loop nesting deeper than 2 produces a warning (the check can still pass).",
    starter: "void gpio_init(void);\n\nint main(void) {\n  \n}\n",
    passCondition: { type: "codeCheck", format: "c", spec: { requiredFunctions: ["main"], requiredCalls: ["gpio_init"], forbiddenCalls: ["printf"], maxLoopDepth: 2 }, referenceAnswer: "data/seeds/reference/cc-c-calls-01.c" },
  }),

  // ---------- diagnosis (8) ----------
  item({
    id: "dx-reverse-01", mode: "diagnosis", difficulty: "intro",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-reverse-polarity-01", adaptation: "original-diagnosis-prompt", ref: "nasa-llis-1398", note: "题面自己写；只引用公开 NASA Lessons Learned 编号和失效模式名" },
    title: "换了灯珠还是不亮：先查什么？",
    titleEn: "The new LED still does not light: what do you check first?",
    prompt: "客户说刚换的 LED 还是不亮，电源极性可能被接反。下面哪一项是更稳妥的第一步？做完选择题可以进入对应的维修关卡。失效模式名称来自公开资料，题面是自己写的。按公开资料整理。",
    promptEn: "A customer says a newly replaced LED still does not light, and the supply polarity may be reversed. Which first step is safer? After the quiz you can open the matching repair level. The failure-mode name comes from public sources; the wording is original. Compiled from public information.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-reverse-polarity-01"], repairUrl: "/repair?s=led-reversed", scenario: "led-reversed", questions: [{ id: "q1", prompt: "上电之前更稳妥的一步是？", promptEn: "Before applying power, which step is safer?", options: [{ id: "a", zh: "先把电源直接加上，看灯会不会亮", en: "Apply power immediately and see if the LED lights" }, { id: "b", zh: "先核对 LED 和电源的极性标记，再用表确认电压方向", en: "Check polarity markings on the LED and supply, then confirm voltage direction with a meter" }, { id: "c", zh: "先换一颗更大电流的灯珠再试", en: "Fit a higher-current LED and try again" }], answer: "b" }] },
  }),
  item({
    id: "dx-connector-01", mode: "diagnosis", difficulty: "intro",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-connector-misinsert-01", adaptation: "original-diagnosis-prompt", note: "题面自己写" },
    title: "某一路没有输出：会不会是插头插反？",
    titleEn: "One channel has no output: could the connector be reversed?",
    prompt: "设备有一路完全没有输出，相邻一路正常。连接器带键位，但键位可能被强行插反。请选出更合理的检查顺序。按公开资料整理。",
    promptEn: "One channel has no output at all; a neighbour works. The connector is keyed, but the key may have been forced the wrong way. Pick the more reasonable check order. Compiled from public information.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-connector-misinsert-01"], repairUrl: "/repair?s=octo-plug-out", scenario: "octo-plug-out", questions: [{ id: "q1", prompt: "更合理的第一步？", promptEn: "The more reasonable first step?", options: [{ id: "a", zh: "先看插头和插座的键位、丝印是否对上，再通电", en: "Check that the key and silkscreen on the plug and socket line up, before applying power" }, { id: "b", zh: "先加大电源电流把那一路‘顶亮’", en: "Raise the supply current to force that channel on" }, { id: "c", zh: "先把两路输出短接对比", en: "Short the two outputs together to compare them" }], answer: "a" }] },
  }),
  item({
    id: "dx-cold-solder-01", mode: "diagnosis", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-cold-solder-01", adaptation: "original-diagnosis-prompt", ref: "NASA / public-domain soldering notes", note: "题面自己写；不复制外部指南原文" },
    title: "轻敲会恢复：更像什么故障？",
    titleEn: "It recovers when tapped: which fault is more likely?",
    prompt: "灯有时亮有时不亮，轻敲板边又好了。下面哪个判断更合理？可以随后在维修关卡里用万用表核实。按公开资料整理。",
    promptEn: "The lamp works intermittently and recovers when the board edge is tapped. Which reading is more reasonable? You can then confirm it with a meter in the repair level. Compiled from public information.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-cold-solder-01"], repairUrl: "/repair?s=led-cold-joint", scenario: "led-cold-joint", questions: [{ id: "q1", prompt: "这种‘轻敲恢复’更常见于？", promptEn: "This ‘recovers when tapped’ symptom is more often seen with?", options: [{ id: "a", zh: "程序被擦掉了", en: "The firmware having been erased" }, { id: "b", zh: "虚焊或冷焊，接触随机械扰动变化", en: "A cold solder joint whose contact changes with mechanical disturbance" }, { id: "c", zh: "电池电压精确等于门槛值", en: "The battery voltage sitting exactly on a threshold" }], answer: "b" }] },
  }),
  item({
    id: "dx-pad-lift-01", mode: "diagnosis", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-pad-lift-01", adaptation: "original-diagnosis-prompt" },
    title: "焊点看着完整，走线却是开路",
    titleEn: "The joint looks intact but the trace is open",
    prompt: "焊点外观正常，量对应焊盘到下一颗零件却是开路。更可能是焊盘起翘或铜皮断裂。下一步怎么核实？按公开资料整理。",
    promptEn: "The joint looks fine, but the pad measures open to the next part. A lifted pad or broken copper is more likely. How would you confirm it? Compiled from public information.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-pad-lift-01"], repairUrl: "/repair?s=sensor-cracked-trace", scenario: "sensor-cracked-trace", questions: [{ id: "q1", prompt: "更稳妥的核实方法？", promptEn: "The safer way to confirm it?", options: [{ id: "a", zh: "用表从焊盘沿走线逐段量通断，并用放大镜看焊盘边缘是否离开基板", en: "Measure continuity along the trace from the pad, and use a magnifier to see if the pad has lifted off the board" }, { id: "b", zh: "直接加大烙铁温度再焊一次", en: "Turn the iron up and solder the joint again" }, { id: "c", zh: "更换整块电源模块，不再测量", en: "Replace the whole power module without measuring" }], answer: "a" }] },
  }),
  item({
    id: "dx-harness-01", mode: "diagnosis", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-harness-overbend-01", adaptation: "original-diagnosis-prompt" },
    title: "线束弯折处间歇性断电",
    titleEn: "Intermittent power loss at a tight bend in the harness",
    prompt: "设备一走动就重启，线束在铰接处弯得很紧。更应该先查什么？按公开资料整理。",
    promptEn: "The device reboots when it starts moving, and the harness has a tight bend at a hinge. What should you check first? Compiled from public information.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-harness-overbend-01"], repairUrl: "/repair?s=octo-thin-wire", scenario: "octo-thin-wire", questions: [{ id: "q1", prompt: "优先检查？", promptEn: "Check first?", options: [{ id: "a", zh: "弯折处导线是否过细、外皮是否破裂，弯折半径是否过小", en: "Whether the wire at the bend is too thin, the jacket is cracked, or the bend radius is too tight" }, { id: "b", zh: "只重新烧录固件", en: "Reflash the firmware only" }, { id: "c", zh: "把电机电压再提高一档", en: "Raise the motor voltage by one step" }], answer: "a" }] },
  }),
  item({
    id: "dx-thermal-01", mode: "diagnosis", difficulty: "advanced",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-thermal-failure-01", adaptation: "original-diagnosis-prompt", ref: "datasheet absolute maximum ratings (facts in own words)" },
    title: "带载后输出下跌：热还是接错？",
    titleEn: "Output drops under load: heat, or a wrong part?",
    prompt: "空载电压看起来正常，带载后输出慢慢下降。可能是稳压器件过热或型号装错。哪种测量顺序更合理？按公开资料整理。数值不要当作某一型号的实测。",
    promptEn: "The voltage looks fine at no load and slowly falls under load. The regulator may be overheating or the wrong part may be fitted. Which measurement order is more reasonable? Compiled from public information. Do not treat the numbers as a measurement of one specific part.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-thermal-failure-01"], repairUrl: "/repair?s=psu-wrong-ldo", scenario: "psu-wrong-ldo", questions: [{ id: "q1", prompt: "更合理的顺序？", promptEn: "The more reasonable order?", options: [{ id: "a", zh: "先量空载和带载输出，再轻轻探温度（注意烫伤），最后核对器件字标与规格书绝对最大额定值", en: "Measure no-load and loaded output, then carefully check temperature (avoid burns), then compare the part marking with the datasheet absolute maximum ratings" }, { id: "b", zh: "先用手按住发热器件继续加负载", en: "Hold the hot part down by hand and increase the load" }, { id: "c", zh: "先把输入电压加到绝对最大额定值以上试试", en: "Raise the input above the absolute maximum rating to see what happens" }], answer: "a" }] },
  }),
  item({
    id: "dx-imc-01", mode: "diagnosis", difficulty: "advanced",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-imc-thick-01", adaptation: "original-diagnosis-prompt", ref: "NASA NEPP public-domain notes on intermetallics (own words)" },
    title: "温度变化时焊点开路：可能和金属间化合物有关",
    titleEn: "The joint opens when temperature changes: intermetallics may be involved",
    prompt: "设备在温度来回变化后出现开路，焊点发脆。教学上会提到金属间化合物层过厚。下面哪个做法更合适？本题只讨论低压板，不涉及市电。按公开资料整理。",
    promptEn: "After temperature cycling the device goes open and the joints look brittle. Teaching notes often mention a thick intermetallic layer. Which action is more appropriate? This task stays on a low-voltage board; no mains. Compiled from public information.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-imc-thick-01"], repairUrl: "/repair?s=led-cold-joint", scenario: "led-cold-joint", questions: [{ id: "q1", prompt: "更合适的做法？", promptEn: "The more appropriate action?", options: [{ id: "a", zh: "记录失效条件，在维修关卡里观察焊点并按流程返修，不把教学描述当成金相结论", en: "Record the failure conditions, inspect the joint in the repair level and rework it by the usual process; do not treat the teaching note as a metallurgical conclusion" }, { id: "b", zh: "用更高温度长时间焊，把金属层‘烧回去’", en: "Solder much hotter and longer to ‘burn back’ the metal layer" }, { id: "c", zh: "不再检查，直接判定芯片报废", en: "Skip inspection and scrap the chip immediately" }], answer: "a" }] },
  }),
  item({
    id: "dx-multi-01", mode: "diagnosis", difficulty: "advanced",
    source: { repo: "prototypes/original", path: "fault-seeds", seed: "fault-intermittent-multi-01", adaptation: "original-diagnosis-prompt" },
    title: "修一个还有一个：多故障怎么排",
    titleEn: "Fixing one fault leaves another: how to work a multi-fault board",
    prompt: "八爪鱼两条腿不动，走几步又没劲。可能不止一个故障。怎样排更稳？按公开资料整理。",
    promptEn: "Two octopus legs do not move, and after a few steps it also loses strength. There may be more than one fault. What is a more stable way to work? Compiled from public information.",
    passCondition: { type: "diagnosisQuiz", faultPool: ["fault-intermittent-multi-01"], repairUrl: "/repair?s=octo-combo", scenario: "octo-combo", questions: [{ id: "q1", prompt: "更稳妥的策略？", promptEn: "The more stable strategy?", options: [{ id: "a", zh: "一次只改一个点，改完再量一遍电源和信号，不要同时换好几处", en: "Change one thing at a time, then re-measure power and signals; do not replace several parts at once" }, { id: "b", zh: "把所有能拆的零件一次性换掉", en: "Replace every part that can be removed, all at once" }, { id: "c", zh: "先改固件参数，硬件不再量", en: "Start by changing firmware parameters and stop measuring the hardware" }], answer: "a" }] },
  }),

  // ---------- workbench (5) ----------
  item({
    id: "wb-led-res-01", mode: "workbench", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "给 Pico 的 GP15 接一颗带电阻的 LED",
    titleEn: "Wire an LED and resistor to Pico GP15",
    prompt: "用连线列表把电路写出来（不是 3D 台面）。要求：GP15 与 LED 阳极连通，LED 阴极经电阻到 GND。禁止把 3V3 和 GND 短接。节点名用 pico.GP15、pico.GND、pico.3V3、led.A、led.K、r220.1、r220.2。",
    promptEn: "Describe the circuit as a wire list (not the 3D bench). GP15 must connect to the LED anode, and the LED cathode must reach GND through a resistor. Do not short 3V3 to GND. Use the node names pico.GP15, pico.GND, pico.3V3, led.A, led.K, r220.1, r220.2.",
    starterWires: [],
    passCondition: { type: "connectionGraphConstraint", requiredNodes: ["pico.GP15", "led.A", "led.K", "r220.1", "r220.2", "pico.GND"], requiredEdges: [{ a: "pico.GP15", b: "led.A" }, { a: "led.K", b: "r220.1" }, { a: "r220.2", b: "pico.GND" }], forbiddenEdges: [{ a: "pico.3V3", b: "pico.GND" }] },
    referenceAnswer: { wires: [{ a: "pico.GP15", b: "led.A" }, { a: "led.K", b: "r220.1" }, { a: "r220.2", b: "pico.GND" }] },
  }),
  item({
    id: "wb-btn-pullup-01", mode: "workbench", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "按键接到 GP14 和地之间",
    titleEn: "Wire a button between GP14 and ground",
    prompt: "把 button.1 接到 pico.GP14，button.2 接到 pico.GND。不要把 GP14 直接短到 3V3（上拉在本题里由程序或内部上拉完成）。",
    promptEn: "Connect button.1 to pico.GP14 and button.2 to pico.GND. Do not short GP14 directly to 3V3 (the pull-up is provided in software or by the internal pull-up in this task).",
    starterWires: [],
    passCondition: { type: "connectionGraphConstraint", requiredEdges: [{ a: "button.1", b: "pico.GP14" }, { a: "button.2", b: "pico.GND" }], forbiddenEdges: [{ a: "pico.GP14", b: "pico.3V3" }] },
    referenceAnswer: { wires: [{ a: "button.1", b: "pico.GP14" }, { a: "button.2", b: "pico.GND" }] },
  }),
  item({
    id: "wb-servo-01", mode: "workbench", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "舵机电源、地和信号都要接到位，并且共地",
    titleEn: "Wire servo power, ground and signal, with a common ground",
    prompt: "servo.VCC 接 psu.5V，servo.GND 接 psu.GND，servo.SIG 接 pico.GP16。pico.GND 必须和 psu.GND 共地。不要把 5V 接到信号脚。",
    promptEn: "Connect servo.VCC to psu.5V, servo.GND to psu.GND, and servo.SIG to pico.GP16. pico.GND must share a ground with psu.GND. Do not tie 5V to the signal pin.",
    starterWires: [],
    passCondition: { type: "connectionGraphConstraint", requiredEdges: [{ a: "servo.VCC", b: "psu.5V" }, { a: "servo.GND", b: "psu.GND" }, { a: "servo.SIG", b: "pico.GP16" }], requiredNets: [["pico.GND", "psu.GND", "servo.GND"]], forbiddenEdges: [{ a: "psu.5V", b: "servo.SIG" }, { a: "psu.5V", b: "psu.GND" }] },
    referenceAnswer: { wires: [{ a: "servo.VCC", b: "psu.5V" }, { a: "servo.GND", b: "psu.GND" }, { a: "servo.SIG", b: "pico.GP16" }, { a: "pico.GND", b: "psu.GND" }] },
  }),
  item({
    id: "wb-i2c-01", mode: "workbench", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "接好 I²C 的 SDA、SCL、上拉和地",
    titleEn: "Wire I²C SDA, SCL, pull-ups and ground",
    prompt: "sensor.SDA 接 pico.GP6，sensor.SCL 接 pico.GP7。两根线都要经过上拉电阻到 pico.3V3（sda.pu 的一端接 SDA 网，另一端接 3V3；scl.pu 同理）。sensor.GND 与 pico.GND 共地。不要把 SDA 和 SCL 短在一起。",
    promptEn: "Connect sensor.SDA to pico.GP6 and sensor.SCL to pico.GP7. Both lines need a pull-up to pico.3V3 (one end of sda.pu on the SDA net, the other on 3V3; likewise scl.pu). sensor.GND must share a ground with pico.GND. Do not short SDA to SCL.",
    starterWires: [],
    passCondition: { type: "connectionGraphConstraint", requiredNets: [["sensor.SDA", "pico.GP6", "sda.pu.1"], ["sda.pu.2", "pico.3V3"], ["sensor.SCL", "pico.GP7", "scl.pu.1"], ["scl.pu.2", "pico.3V3"], ["sensor.GND", "pico.GND"]], forbiddenEdges: [{ a: "sensor.SDA", b: "sensor.SCL" }] },
    referenceAnswer: { wires: [{ a: "sensor.SDA", b: "pico.GP6" }, { a: "pico.GP6", b: "sda.pu.1" }, { a: "sda.pu.2", b: "pico.3V3" }, { a: "sensor.SCL", b: "pico.GP7" }, { a: "pico.GP7", b: "scl.pu.1" }, { a: "scl.pu.2", b: "pico.3V3" }, { a: "sensor.GND", b: "pico.GND" }] },
  }),
  item({
    id: "wb-no-short-01", mode: "workbench", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "LED 必须经过电阻，电源不能短接",
    titleEn: "The LED must go through a resistor; do not short the supply",
    prompt: "3V3 经 r220 再到 led.A，led.K 接地。禁止 3V3 直接接到 GND，也禁止 3V3 不经电阻直接接到 LED 阳极。",
    promptEn: "3V3 must reach led.A through r220, and led.K must go to ground. Do not short 3V3 to GND, and do not tie 3V3 directly to the LED anode without the resistor.",
    starterWires: [],
    passCondition: { type: "connectionGraphConstraint", requiredEdges: [{ a: "pico.3V3", b: "r220.1" }, { a: "r220.2", b: "led.A" }, { a: "led.K", b: "pico.GND" }], forbiddenEdges: [{ a: "pico.3V3", b: "pico.GND" }, { a: "pico.3V3", b: "led.A" }] },
    referenceAnswer: { wires: [{ a: "pico.3V3", b: "r220.1" }, { a: "r220.2", b: "led.A" }, { a: "led.K", b: "pico.GND" }] },
  }),

  // ---------- assembly (5) ----------
  item({
    id: "as-standoff-01", mode: "assembly", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "先装铜柱，再放板子，最后拧螺丝",
    titleEn: "Fit the standoffs, then the board, then the screws",
    prompt: "按安装顺序列出零件：copper-standoff、board、screw。铜柱必须在板子之前，板子必须在螺丝之前。这是顺序练习，不是力矩规范。",
    promptEn: "List the parts in install order: copper-standoff, board, screw. The standoff must come before the board, and the board before the screw. This is an order exercise, not a torque spec.",
    starterSteps: [{ part: "" }],
    passCondition: { type: "assemblyConstraint", requiredParts: ["copper-standoff", "board", "screw"], order: [{ before: "copper-standoff", after: "board" }, { before: "board", after: "screw" }] },
    referenceAnswer: { steps: [{ part: "copper-standoff" }, { part: "board" }, { part: "screw" }] },
  }),
  item({
    id: "as-header-01", mode: "assembly", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "排针先对准 1 脚再插线",
    titleEn: "Align header pin 1 before plugging the jumper",
    prompt: "顺序：header 在 jumper 之前。header 的朝向必须是 pin1。",
    promptEn: "Order: header before jumper. The header orientation must be pin1.",
    starterSteps: [{ part: "header", orient: "" }],
    passCondition: { type: "assemblyConstraint", requiredParts: ["header", "jumper"], order: [{ before: "header", after: "jumper" }], orientation: [{ part: "header", must: "pin1" }] },
    referenceAnswer: { steps: [{ part: "header", orient: "pin1" }, { part: "jumper" }] },
  }),
  item({
    id: "as-jst-01", mode: "assembly", difficulty: "intermediate",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "JST 插头按键位插好后再上电",
    titleEn: "Seat the keyed JST connector before applying power",
    prompt: "顺序：jst-plug 在 power 之前。jst-plug 朝向必须是 keyed。不要先通电再插插头。",
    promptEn: "Order: jst-plug before power. The jst-plug orientation must be keyed. Do not apply power before the connector is seated.",
    starterSteps: [],
    passCondition: { type: "assemblyConstraint", requiredParts: ["jst-plug", "power"], order: [{ before: "jst-plug", after: "power" }], orientation: [{ part: "jst-plug", must: "keyed" }] },
    referenceAnswer: { steps: [{ part: "jst-plug", orient: "keyed" }, { part: "power" }] },
  }),
  item({
    id: "as-washer-01", mode: "assembly", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "螺丝下面要垫垫圈",
    titleEn: "Put a washer under the screw",
    prompt: "顺序：washer 在 screw 之前，board 在 washer 之前。需要出现 board、washer、screw。",
    promptEn: "Order: washer before screw, and board before washer. board, washer and screw must all appear.",
    starterSteps: [],
    passCondition: { type: "assemblyConstraint", requiredParts: ["board", "washer", "screw"], order: [{ before: "board", after: "washer" }, { before: "washer", after: "screw" }] },
    referenceAnswer: { steps: [{ part: "board" }, { part: "washer" }, { part: "screw" }] },
  }),
  item({
    id: "as-servo-horn-01", mode: "assembly", difficulty: "intro",
    source: { repo: "prototypes/original", path: "data/seeds/bank-items.json", adaptation: "original" },
    title: "舵机臂对准花键后再锁螺丝",
    titleEn: "Align the servo horn on the spline, then fit the screw",
    prompt: "顺序：servo 在 horn 之前，horn 在 horn-screw 之前。horn 朝向必须是 spline-aligned。",
    promptEn: "Order: servo before horn, horn before horn-screw. The horn orientation must be spline-aligned.",
    starterSteps: [],
    passCondition: { type: "assemblyConstraint", requiredParts: ["servo", "horn", "horn-screw"], order: [{ before: "servo", after: "horn" }, { before: "horn", after: "horn-screw" }], orientation: [{ part: "horn", must: "spline-aligned" }] },
    referenceAnswer: { steps: [{ part: "servo" }, { part: "horn", orient: "spline-aligned" }, { part: "horn-screw" }] },
  }),
];

// 我的补充：故意放 1 道即将过期、1 道已过期，用来演示黄标和 staleCount（正文仍可用，不阻断练习）
const soon = items.find((x) => x.id === "fw-serial-tick-01");
if (soon) soon.staleAfter = "2026-11-25";
const stale = items.find((x) => x.id === "cc-c-noprintf-01");
if (stale) stale.staleAfter = "2026-10-01";

const refs = {
  "cc-c-blink-fn-01.c": "void blink(void) {}\nint main(void) { blink(); return 0; }\n",
  "cc-c-noprintf-01.c": "int main(void) { return 0; }\n",
  "cc-asm-add-01.s": ".text\nstart:\n  mov r0, #1\n  add r0, r0, #1\n",
  "cc-hex-eof-01.hex": hexRec(0, 0, [0]) + "\n" + HEX_EOF + "\n",
  "cc-cpp-ns-01.cpp": "namespace hal { void init() {} }\n",
  "cc-cpp-gpio-01.cpp": "void gpio_init() {}\nclass Gpio { public: void set(int v) { (void)v; } };\nint main() { gpio_init(); Gpio g; g.set(1); }\n",
  "cc-cpp-ctor-01.cpp": "class Led { public: Led() {} ~Led() {} };\nLed::Led() {}\nLed::~Led() {}\n",
  // 上面会重复定义构造——修正：只在类外定义
  "cc-asm-loop-01.s": ".text\nloop:\n  nop\n  b loop\n",
  "cc-cpp-tpl-max-01.cpp": "template<typename T> T max(T a, T b) { return a > b ? a : b; }\n",
  "cc-cpp-tpl-ring-01.cpp": "template<typename T> class Slot {};\ntemplate<typename T, typename Buf = Slot<Slot<T>>> class RingBuffer {\npublic:\n  void push(const T&) {}\n};\n",
  "cc-c-calls-01.c": "void gpio_init(void) {}\nint main(void) { gpio_init(); return 0; }\n",
};

// 修正构造函数参考答案：只在类外定义，避免重复
refs["cc-cpp-ctor-01.cpp"] = "class Led {\npublic:\n  Led();\n  ~Led();\n};\nLed::Led() {}\nLed::~Led() {}\n";

// HEX 入口 + 向量
{
  const recs = [];
  recs.push(hexRec(4, 0, [0x08, 0x00])); // base 0x08000000
  recs.push(hexRec(0, 0x0100, [0x00, 0x01]));
  recs.push(hexRec(5, 0, [0x08, 0x00, 0x01, 0x00]));
  recs.push(HEX_EOF);
  refs["cc-hex-entry-01.hex"] = recs.join("\n") + "\n";
}

mkdirSync(join(DIR, "reference"), { recursive: true });
for (const [name, body] of Object.entries(refs)) writeFileSync(join(DIR, "reference", name), body);
writeFileSync(join(DIR, "bank-items.json"), JSON.stringify({
  note: "全部题面为自己撰写。fromthetransistor 只记录标题 / 语言 / LOC。故障题只引用公开来源的链接和失效模式名称。按公开资料整理。",
  attribution: "按公开资料整理",
  items,
}, null, 2) + "\n");
console.log("wrote", items.length, "items");
