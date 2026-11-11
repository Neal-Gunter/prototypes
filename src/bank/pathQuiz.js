// v45：每条学习路径末尾的短测验。题目只根据该路径已有的说明和题面来出，不另编规格。
// 每道题是选择题，每个选项都有说明。早期原型，简化仿真。
import { PATHS } from "./paths.js";

export const PATH_QUIZZES = {
  "path-night-light": {
    questions: [
      {
        id: "nl-first",
        prompt: {
          zh: "这条路径里，电池感应小夜灯「完全不亮」、开关感觉还正常时，更稳妥的第一步是什么？",
          en: "On this path, when the battery motion night light is completely dark and the switch still feels normal, what is the safer first step?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "先换一颗新灯珠再通电。",
            en: "Fit a new LED and apply power.",
            explain: {
              zh: "路径把更稳妥的第一步写成先查电池，而不是一上来就换灯珠。先确认供电，更不容易把好零件装进还有别的问题的灯里。",
              en: "The path asks you to decide that the cells come first, not to swap the LED immediately. Confirm the supply before changing a part, so a good LED is not fitted into a lamp that still has another fault.",
            },
          },
          {
            id: "b",
            zh: "先取出电池，用表量电池电压，并看极性和接触是否干净。",
            en: "Take the battery out, measure its voltage, and check polarity and clean contact.",
            explain: {
              zh: "路径的诊断步骤和维修关卡都按「完全不亮先查电池」来练。取出电池再量电压、核对极性、看接触是否干净，是这条路径自己写明的更稳妥做法。",
              en: "The diagnosis step and the repair level on this path both practise checking the cells first when the lamp is completely dark. Taking the cells out, measuring voltage, and checking polarity and clean contact is the safer first step the path itself describes.",
            },
          },
          {
            id: "c",
            zh: "先把额外的电池叠上去提高电压再试。",
            en: "Stack an extra cell to raise the voltage and try again.",
            explain: {
              zh: "路径没有让人用叠电池的办法来排查。那样既没有先确认原电池的状态，也不是这条路径写下的步骤。",
              en: "The path does not ask you to diagnose the lamp by stacking extra cells. That skips checking the original cells, and it is not a step written on this path.",
            },
          },
        ],
      },
      {
        id: "nl-cells",
        prompt: {
          zh: "这条路径的拆开步骤里，小夜灯用几节什么电池供电？",
          en: "In the teardown step on this path, how is the night light powered?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "一节 18650 锂电池。",
            en: "One 18650 lithium-ion cell.",
            explain: {
              zh: "那是另一条充电宝路径里的电芯，不是这盏电池感应小夜灯。",
              en: "That cell belongs on the power-bank path, not in this battery motion night light.",
            },
          },
          {
            id: "b",
            zh: "3 节 AAA。",
            en: "Three AAA cells.",
            explain: {
              zh: "路径第一步写明：看 3 节 AAA、开关和灯板怎么连。",
              en: "The first step on the path tells you to see how the three AAA cells, the switch and the lamp board are connected.",
            },
          },
          {
            id: "c",
            zh: "一枚 CR2032 纽扣电池。",
            en: "One CR2032 coin cell.",
            explain: {
              zh: "路径没有把这盏灯写成纽扣电池供电。拆开步骤写的是 3 节 AAA。",
              en: "This path does not describe the lamp as coin-cell powered. The teardown step names three AAA cells.",
            },
          },
          {
            id: "d",
            zh: "一块 9 V 层叠电池。",
            en: "One 9 V battery.",
            explain: {
              zh: "路径没有提到 9 V 电池。写明的是 3 节 AAA。",
              en: "The path does not mention a 9 V battery. It names three AAA cells.",
            },
          },
        ],
      },
      {
        id: "nl-stop",
        prompt: {
          zh: "拆开这盏小夜灯时，路径怎么提醒安全和停止点？",
          en: "When opening this night light, what does the path say about safety and stop points?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "可以先不管电池，直接撬开外壳。",
            en: "You can ignore the battery and pry the case open first.",
            explain: {
              zh: "路径要求先处理电池，不是先不管电池再拆。",
              en: "The path tells you to deal with the battery first, not to open the case while ignoring it.",
            },
          },
          {
            id: "b",
            zh: "先处理电池，遇到停止点先停。指南未经实物验证。",
            en: "Deal with the battery first, and stop at every stop point. The guide is not verified on a real device.",
            explain: {
              zh: "这是路径第一步的说明原意：先处理电池，遇到停止点先停，并且写明指南未经实物验证。",
              en: "That is what the first step on the path already says: deal with the battery first, stop at every stop point, and treat the guide as unverified on a real device.",
            },
          },
          {
            id: "c",
            zh: "指南已经过实物验证，可以完全按字面去拆实物。",
            en: "The guide has been verified on hardware, so you can follow it as a lesson on a real device.",
            explain: {
              zh: "路径写明这是简化仿真，不是实物课；指南和题面按公开资料整理，未经实物验证。",
              en: "The path says this is a simplified simulation, not a lesson on a real device. The guide is compiled from public information and not verified on hardware.",
            },
          },
        ],
      },
      {
        id: "nl-sim",
        prompt: {
          zh: "路径最后一步的维修关卡读数，能代替对实物的测量吗？",
          en: "Do the readings in the final repair level on this path replace a real measurement?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "能。关卡读数就是实物电压。",
            en: "Yes. The readings in the level are the voltages of a real device.",
            explain: {
              zh: "路径写明关卡读数来自简化仿真，不能代替实测。",
              en: "The path says the readings in the level come from a simplified simulation and do not replace real measurements.",
            },
          },
          {
            id: "b",
            zh: "不能。关卡读数来自简化仿真，用来练习步骤，不能代替实测。",
            en: "No. The readings come from a simplified simulation for practising the steps; they do not replace a real measurement.",
            explain: {
              zh: "这和路径最后一步的说明一致：关卡读数来自简化仿真，不能代替实测。",
              en: "That matches the last step on the path: the readings come from a simplified simulation and do not replace real measurements.",
            },
          },
        ],
      },
    ],
  },

  "path-led-polarity": {
    questions: [
      {
        id: "lp-res",
        prompt: {
          zh: "这条路径一开始强调的接线规则是什么？",
          en: "What wiring rules does this path emphasise at the start?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "灯可以直接接在电源两端，不用限流电阻。",
            en: "The LED may be wired straight across the supply, without a current-limiting resistor.",
            explain: {
              zh: "路径写明灯必须经过电阻，电源不能直接短接。不经电阻直接接灯，正是要避免的。",
              en: "The path says the LED must go through a resistor and the supply must not be shorted. Wiring the LED without a resistor is one of the cases it tells you not to do.",
            },
          },
          {
            id: "b",
            zh: "灯必须经过限流电阻，而且电源不能直接短接。",
            en: "The LED must go through a current-limiting resistor, and the supply must not be shorted.",
            explain: {
              zh: "路径摘要和前两步都在巩固这两条：灯必须限流，电源不能直接短。",
              en: "The path summary and the first two steps both reinforce these two rules: the LED must be current-limited, and the supply must not be shorted.",
            },
          },
          {
            id: "c",
            zh: "只看 3D 台面上的导线外观就算通过。",
            en: "It is enough to judge the wiring by how the 3D bench looks.",
            explain: {
              zh: "路径写明接线题只检查连通性，不是 3D 台面。",
              en: "The path says wiring tasks score connectivity, not the 3D bench.",
            },
          },
        ],
      },
      {
        id: "lp-cap",
        prompt: {
          zh: "路径里练习电解电容时，正确的朝向和顺序是？",
          en: "When this path practises the electrolytic capacitor, what orientation and order are required?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "先焊接，再把电容转到对着标记的方向。",
            en: "Solder it first, then turn the capacitor to face the mark.",
            explain: {
              zh: "路径对应的题目要求电容在焊接之前就摆好，不要先焊再转方向。",
              en: "The task on this path requires the capacitor to be oriented before soldering. Do not solder it and then turn it.",
            },
          },
          {
            id: "b",
            zh: "先把负极（色条）朝向板上的标记，确认朝向后再焊接。",
            en: "Align the negative lead (the minus stripe) with the mark on the board, then solder.",
            explain: {
              zh: "路径写明有极性的零件要先对朝向，电容和 LED 是同一类教训；对应题目要求朝向为负极对着标记，并且先摆电容再焊接。",
              en: "The path says polarised parts have to be oriented first, and that the capacitor and the LED teach the same lesson. The matching task requires the minus stripe to face the board mark, with the capacitor placed before soldering.",
            },
          },
          {
            id: "c",
            zh: "电解电容没有极性，朝向可以随便。",
            en: "An electrolytic capacitor has no polarity, so any orientation is fine.",
            explain: {
              zh: "路径把电解电容当作有极性零件来练习，不能随便摆。",
              en: "The path treats the electrolytic capacitor as a polarised part. Orientation is not optional.",
            },
          },
        ],
      },
      {
        id: "lp-rev",
        prompt: {
          zh: "路径里「换了灯珠还是不亮」时，上电之前更稳妥的一步是？",
          en: "On this path, when a newly fitted LED still does not light, what is the safer step before applying power?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "先把电源直接加上，看灯会不会亮。",
            en: "Apply power immediately and see if the LED lights.",
            explain: {
              zh: "路径写明上电之前先核对极性标记，再用表确认方向，而不是先通电看结果。",
              en: "The path tells you to check the polarity marks before applying power, then confirm the direction with a meter, not to apply power first and watch.",
            },
          },
          {
            id: "b",
            zh: "先核对 LED 和电源的极性标记，再用表确认电压方向。",
            en: "Check the polarity marks on the LED and the supply, then confirm the voltage direction with a meter.",
            explain: {
              zh: "这是路径诊断步骤写下的更稳妥做法，随后才进入「修装反的 LED」维修关卡。",
              en: "That is the safer first step written on the diagnosis step of this path, before you open the repair level that fixes a reversed LED.",
            },
          },
          {
            id: "c",
            zh: "先把电源电压再升高一档试一次。",
            en: "Raise the supply voltage by a step and try again.",
            explain: {
              zh: "路径没有把升高电压当作第一步。它要求先核对极性。",
              en: "The path does not ask you to raise the supply as a first step. It asks you to check polarity first.",
            },
          },
        ],
      },
      {
        id: "lp-gp15",
        prompt: {
          zh: "路径里给 Pico 接线的那一步，LED 和电阻应当怎么接？",
          en: "In the Pico wiring step on this path, how should the LED and resistor be connected?",
        },
        correct: "a",
        options: [
          {
            id: "a",
            zh: "接到 GP15，阴极经电阻到地；不要把 3V3 和 GND 短接。",
            en: "Connect them to GP15, with the cathode reaching ground through a resistor; do not short 3V3 to GND.",
            explain: {
              zh: "这是路径第一步题面写下的要求：GP15 接 LED，阴极经电阻到 GND，并禁止把 3V3 和 GND 短接。",
              en: "That is what the first task on the path already requires: GP15 to the LED, the cathode to GND through a resistor, and no short between 3V3 and GND.",
            },
          },
          {
            id: "b",
            zh: "把 3V3 不经电阻直接接到 LED 阳极。",
            en: "Tie 3V3 directly to the LED anode without a resistor.",
            explain: {
              zh: "路径下一步明确禁止 3V3 不经电阻直接接到 LED 阳极，也禁止电源短接。",
              en: "The next step on the path forbids tying 3V3 directly to the LED anode without the resistor, and also forbids shorting the supply.",
            },
          },
          {
            id: "c",
            zh: "只接信号线，地线可以不接。",
            en: "Only the signal wire is required; the ground may be left unconnected.",
            explain: {
              zh: "路径第一步要求阴极经电阻到 GND，地线是通路的一部分。",
              en: "The first step requires the cathode to reach GND through the resistor. The ground is part of the required path.",
            },
          },
        ],
      },
    ],
  },

  "path-octo-power": {
    questions: [
      {
        id: "op-fuse",
        prompt: {
          zh: "这条路径要求 5 V 怎样接到 Pico 的 VSYS？",
          en: "On this path, how must 5 V reach the Pico VSYS?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "5 V 不经保险丝直接进 VSYS 即可。",
            en: "5 V may go straight into VSYS without a fuse.",
            explain: {
              zh: "路径要求 5 V 经过保险丝再进 VSYS，并禁止不经保险丝直接相接。",
              en: "The path requires 5 V to go through a fuse into VSYS, and forbids tying 5 V directly to VSYS without the fuse.",
            },
          },
          {
            id: "b",
            zh: "5 V 要经过保险丝再进 VSYS，并且与电源共地。",
            en: "5 V must go through a fuse into VSYS, and share a ground with the supply.",
            explain: {
              zh: "这是路径第一步的标题和题面：5 V 经保险丝进 VSYS，并且共地。",
              en: "That is the first step on the path: 5 V through a fuse into VSYS, with a shared ground.",
            },
          },
          {
            id: "c",
            zh: "把 5 V 接到 GND 也能供电。",
            en: "Tying 5 V to GND will still power the board.",
            explain: {
              zh: "路径禁止把 5 V 接到 GND。那是短接，不是供电路径。",
              en: "The path forbids tying 5 V to GND. That is a short, not a supply path.",
            },
          },
        ],
      },
      {
        id: "op-servo",
        prompt: {
          zh: "路径里关于舵机接线，下列哪一项是对的？",
          en: "Which statement about servo wiring is correct on this path?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "只要把信号线接到单片机，电源和地可以省略。",
            en: "Only the signal wire to the microcontroller is required; the supply and ground may be omitted.",
            explain: {
              zh: "路径写明走路还依赖舵机供电和共地，不是只接一根信号线。",
              en: "The path says walking also depends on the servo supply and a shared ground, not only the signal wire.",
            },
          },
          {
            id: "b",
            zh: "舵机的电源、地和信号都要接到位，并且与控制板共地；不要把 5 V 接到信号脚。",
            en: "The servo supply, ground and signal must all be connected, and share a ground with the controller; do not tie 5 V to the signal pin.",
            explain: {
              zh: "这是路径第二步的说明和题面：电源、地和信号都要接到位并共地，且不要把 5 V 接到信号脚。",
              en: "That is the second step on the path: the supply, ground and signal must all be connected and share a ground, and 5 V must not be tied to the signal pin.",
            },
          },
          {
            id: "c",
            zh: "走路只依赖固件，和供电无关。",
            en: "Walking depends only on firmware, not on the supply.",
            explain: {
              zh: "路径把「能开机但不走路」的第一步写成先查电池电压，说明供电不足时走不动。",
              en: "The path says a robot that powers on but will not walk should start with a battery-voltage check, because it cannot walk when the voltage is low.",
            },
          },
        ],
      },
      {
        id: "op-batt",
        prompt: {
          zh: "「八爪鱼能开机却不走路」时，这条路径认为更合理的第一步是？",
          en: "When the octopus powers on but will not walk, what does this path treat as the more reasonable first step?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "先改固件把步态幅度加到最大。",
            en: "Change the firmware to the maximum gait amplitude first.",
            explain: {
              zh: "路径没有把改固件当成第一步。它要求先判断该量电池电压。",
              en: "The path does not make a firmware change the first step. It asks you to decide that the battery voltage should be measured first.",
            },
          },
          {
            id: "b",
            zh: "先量电池或电源电压；电压过低就先充电或更换，再查别的。",
            en: "Measure the battery or supply voltage first; if it is too low, charge or replace it before looking for other faults.",
            explain: {
              zh: "路径的诊断步骤和摘要都写成：能开机但不走路，先查电池电压，再进入低电维修关卡。",
              en: "The diagnosis step and the path summary both say that when the robot powers on but will not walk, you should check the battery voltage first, then open the low-battery repair level.",
            },
          },
          {
            id: "c",
            zh: "先把舵机信号幅度加倍，先不管供电。",
            en: "Double the servo signal range first, and ignore the supply for now.",
            explain: {
              zh: "路径把供电路径和电池电压放在前面，不是先加大信号幅度。",
              en: "The path puts the supply path and the battery voltage first, not a larger signal range.",
            },
          },
        ],
      },
      {
        id: "op-sim",
        prompt: {
          zh: "路径最后的维修关卡是什么性质？",
          en: "What kind of level is the final repair step on this path?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "对实物电池的校准测量，可直接代替实测。",
            en: "A calibrated measurement of a real battery, which can replace a real-world check.",
            explain: {
              zh: "路径写明关卡是简化仿真，用来练步骤，不能代替实测。",
              en: "The path says the level is a simplified simulation for practising the steps; it does not replace a real measurement.",
            },
          },
          {
            id: "b",
            zh: "简化仿真，用来练步骤，不能代替实测。",
            en: "A simplified simulation for practising the steps; it does not replace a real measurement.",
            explain: {
              zh: "这和路径最后一步的说明一致。",
              en: "That matches the note on the last step of the path.",
            },
          },
        ],
      },
    ],
  },

  "path-powerbank-hot": {
    questions: [
      {
        id: "pb-cell",
        prompt: {
          zh: "这条路径的拆开步骤覆盖的是哪种充电宝？",
          en: "Which power bank does the teardown step on this path cover?",
        },
        correct: "a",
        options: [
          {
            id: "a",
            zh: "单节 18650 USB 充电宝，里面有电芯、保护/充电升压板和 USB 口。",
            en: "A single-cell 18650 USB power bank, with a cell, a protection/charge-boost board and a USB port.",
            explain: {
              zh: "路径摘要和第一步都写明：拆开单节 18650 USB 充电宝，看电芯、保护/充电升压板和 USB 口怎么连。",
              en: "The path summary and the first step both describe opening a single-cell 18650 USB power bank and seeing how the cell, the protection/charge-boost board and the USB port are connected.",
            },
          },
          {
            id: "b",
            zh: "三节 AAA 的电池感应小夜灯。",
            en: "A battery motion night light with three AAA cells.",
            explain: {
              zh: "那是另一条小夜灯路径，不是这条充电宝路径。",
              en: "That device belongs on the night-light path, not on this power-bank path.",
            },
          },
          {
            id: "c",
            zh: "市电输入的台式电源。",
            en: "A mains-powered bench supply.",
            explain: {
              zh: "路径讲的是 USB 充电宝；对应诊断题也写明本题不涉及市电。",
              en: "The path is about a USB power bank. The matching diagnosis task also says it does not involve mains.",
            },
          },
        ],
      },
      {
        id: "pb-hot",
        prompt: {
          zh: "路径里「电源模块一插上就发烫、输出焊盘看起来很近」时，更稳妥的做法是？",
          en: "On this path, when a power module runs hot as soon as it is plugged in and the output pads look close, what is the safer action?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "先加大输入电压看它还烫不烫。",
            en: "Raise the input voltage to see if it still gets hot.",
            explain: {
              zh: "路径对应的诊断题并不把加大输入当作更稳妥的做法。先断电再查短路，才是写下的步骤。",
              en: "The diagnosis task on this path does not treat raising the input as the safer action. It asks you to power down and look for a short first.",
            },
          },
          {
            id: "b",
            zh: "先断电，检查输出端有没有焊锡桥，再用表量输出正负是否短路，确认后再考虑通电。",
            en: "Power down first, inspect the output for a solder bridge, and measure whether the output is shorted, before considering applying power again.",
            explain: {
              zh: "这是路径诊断步骤要练的思路：先判断该不该先查输出端有没有锡桥，再进入维修关卡。",
              en: "That is the reasoning the diagnosis step on this path asks you to practise: decide whether to look for a solder bridge on the output first, then open the repair level.",
            },
          },
          {
            id: "c",
            zh: "先保持通电，用手按住模块等它凉下来。",
            en: "Leave power applied and hold the module until it cools down.",
            explain: {
              zh: "路径要练的是断电后查输出短路，不是继续通电等待。",
              en: "The path is about powering down and checking for an output short, not leaving the module powered and waiting.",
            },
          },
        ],
      },
      {
        id: "pb-model",
        prompt: {
          zh: "路径最后的维修关卡，和这块充电宝是什么关系？",
          en: "How does the final repair level on this path relate to this power bank?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "它是这块充电宝的 1:1 模型，读数可直接当实物结果用。",
            en: "It is a one-to-one model of this power bank, and its readings can be used as real-device results.",
            explain: {
              zh: "路径明确写了：维修关卡是通用的稳压模块简化仿真，不是这块充电宝的 1:1 模型。",
              en: "The path states that the repair level is a generic, simplified regulator simulation, not a one-to-one model of this power bank.",
            },
          },
          {
            id: "b",
            zh: "它是通用稳压模块的简化仿真，用来练同一类短路思路，不能代替对充电宝实物的检查。",
            en: "It is a generic, simplified regulator-module simulation for practising the same kind of short-circuit reasoning; it does not replace inspecting a real power bank.",
            explain: {
              zh: "这和路径摘要以及最后一步的说明一致。",
              en: "That matches the path summary and the note on the last step.",
            },
          },
          {
            id: "c",
            zh: "它演示的是市电侧的故障。",
            en: "It demonstrates a fault on the mains side.",
            explain: {
              zh: "对应诊断题写明不涉及市电；关卡练的是低压稳压模块输出端短路。",
              en: "The matching diagnosis task says it does not involve mains. The level practises an output short on a low-voltage regulator module.",
            },
          },
        ],
      },
      {
        id: "pb-safe",
        prompt: {
          zh: "拆开单节锂电充电宝时，路径怎么提醒？",
          en: "When opening the single-cell lithium power bank, what does the path tell you?",
        },
        correct: "b",
        options: [
          {
            id: "a",
            zh: "锂电芯可以短路或刺穿，用来快速放电。",
            en: "The Li-ion cell may be shorted or punctured to discharge it quickly.",
            explain: {
              zh: "路径写明：锂电芯不要短路或刺穿。",
              en: "The path says: do not short or puncture the Li-ion cell.",
            },
          },
          {
            id: "b",
            zh: "先处理电池，遇到停止点先停；锂电芯不要短路或刺穿。指南未经实物验证。",
            en: "Deal with the battery first, and stop at every stop point. Do not short or puncture the Li-ion cell. The guide is not verified on a real device.",
            explain: {
              zh: "这是路径拆开步骤写下的提醒。",
              en: "That is the warning already written on the teardown step of this path.",
            },
          },
          {
            id: "c",
            zh: "指南已经过实物验证，不必停在停止点。",
            en: "The guide has been verified on hardware, so you need not stop at the stop points.",
            explain: {
              zh: "路径写明指南未经实物验证，并且遇到停止点先停。",
              en: "The path says the guide is not verified on a real device, and that you should stop at every stop point.",
            },
          },
        ],
      },
    ],
  },
};

export function quizFor(pathId) {
  const q = PATH_QUIZZES[pathId];
  return q && Array.isArray(q.questions) ? q : null;
}

export function gradeQuiz(quiz, picks) {
  const questions = quiz?.questions || [];
  const answers = {};
  let correct = 0;
  for (const q of questions) {
    const pick = picks && typeof picks[q.id] === "string" ? picks[q.id] : "";
    if (pick) answers[q.id] = pick;
    if (pick && pick === q.correct) correct++;
  }
  return { answers, correct, total: questions.length };
}

export function optionById(question, id) {
  return (question?.options || []).find((o) => o.id === id) || null;
}

/** Every learning path must have its own 3–5 question quiz (used by tests). */
export function quizCoverage(paths = PATHS, quizzes = PATH_QUIZZES) {
  return (paths || []).map((p) => ({ id: p.id, n: quizzes[p.id]?.questions?.length || 0 }));
}
