// v40：把已有的拆解、诊断、接线、装配和维修关卡串成 3–5 步的短学习路径。
// 说明文字自己写，按公开资料整理。早期原型，简化仿真。
export const PATHS = [
  {
    id: "path-night-light",
    title: "小夜灯不亮：从拆开到动手修",
    titleEn: "A night light that stays dark: from teardown to a repair",
    summary: "先看清电池感应小夜灯里面怎么供电，再判断“完全不亮”该先查电池，然后在维修关卡里按同样的思路修。这是简化仿真，不是实物课；指南和题面都按公开资料整理，未经实物验证。",
    summaryEn: "First see how a battery motion night light is powered, then decide whether a completely dark lamp should start with the cells, and finally practise the same idea in a repair level. This is a simplified simulation, not a lesson on a real device. The guide and the tasks are compiled from public information and not verified on hardware.",
    steps: [
      {
        kind: "teardown",
        device: "night-light",
        title: "拆开电池感应小夜灯",
        titleEn: "Open the battery motion night light",
        note: "看 3 节 AAA、开关和灯板怎么连。先处理电池，遇到停止点先停。指南未经实物验证。",
        noteEn: "See how the three AAA cells, the switch and the lamp board are connected. Deal with the battery first, and stop at every stop point. The guide is not verified on a real device.",
      },
      {
        kind: "bank",
        id: "dx-dead-battery-01",
        mode: "diagnosis",
        diff: "intro",
        title: "完全不亮：先查电池还是先换灯珠？",
        titleEn: "Completely dark: check the cells first, or swap the LED?",
        note: "先写出更稳妥的第一步，再打开对应的维修关卡。",
        noteEn: "Pick the safer first step, then open the matching repair level.",
      },
      {
        kind: "repair",
        scene: "led-dead-battery",
        title: "在维修关卡里检查电池",
        titleEn: "Check the battery in the repair level",
        note: "关卡读数来自简化仿真，不能代替实测。",
        noteEn: "The readings in the level come from a simplified simulation and do not replace real measurements.",
      },
    ],
  },
  {
    id: "path-led-polarity",
    title: "灯不亮：先把线和极性接对",
    titleEn: "An LED that will not light: get the wiring and polarity right first",
    summary: "从限流接线和禁止电源短接开始，再练习有极性零件的朝向，然后判断“换了灯珠还不亮”该先核对极性，最后在维修关卡里修装反的灯。题面自己写；接线题只检查连通性，不是 3D 台面。",
    summaryEn: "Start with a series resistor and a supply that must not be shorted, then practise orientation of a polarised part, then decide what to check first when a new LED still does not light, and finally fix a reversed LED in a repair level. The wording is original. Wiring tasks score connectivity, not the 3D bench.",
    steps: [
      {
        kind: "bank",
        id: "wb-led-res-01",
        mode: "workbench",
        diff: "intro",
        title: "给 Pico 的 GP15 接一颗带电阻的 LED",
        titleEn: "Wire an LED and resistor to Pico GP15",
        note: "先把灯和限流电阻接到信号脚上。按连通性检查。",
        noteEn: "Connect the LED and its series resistor to the signal pin. This is a connectivity check.",
      },
      {
        kind: "bank",
        id: "wb-no-short-01",
        mode: "workbench",
        diff: "intro",
        title: "LED 必须经过电阻，电源不能短接",
        titleEn: "The LED must go through a resistor, and the supply must not be shorted",
        note: "巩固“电源不能直接短、灯必须限流”这两条。",
        noteEn: "Reinforce two rules: the supply must not be shorted, and the LED must be current-limited.",
      },
      {
        kind: "bank",
        id: "as-cap-orient-01",
        mode: "assembly",
        diff: "intermediate",
        title: "电解电容负极朝向标记后再焊接",
        titleEn: "Align the electrolytic capacitor’s negative lead with the mark before soldering",
        note: "有极性的零件要先对朝向。电容和 LED 是同一类教训。",
        noteEn: "Polarised parts have to be oriented first. The capacitor and the LED teach the same lesson.",
      },
      {
        kind: "bank",
        id: "dx-reverse-01",
        mode: "diagnosis",
        diff: "intro",
        title: "换了灯珠还是不亮：先查什么？",
        titleEn: "The new LED still does not light: what do you check first?",
        note: "上电之前先核对极性标记，再用表确认方向。",
        noteEn: "Check the polarity marks before applying power, then confirm the direction with a meter.",
      },
      {
        kind: "repair",
        scene: "led-reversed",
        title: "在维修关卡里修装反的 LED",
        titleEn: "Fix a reversed LED in the repair level",
        note: "用已有关卡练习，读数仍是简化仿真。",
        noteEn: "Practise in the existing level. The readings are still a simplified simulation.",
      },
    ],
  },
  {
    id: "path-octo-power",
    title: "八爪鱼能开机却不走路",
    titleEn: "The octopus powers on but will not walk",
    summary: "先练习 5 V 经过保险丝进 VSYS、舵机电源与信号共地，再判断“能开机但不走路”该先量电池电压，然后在维修关卡里查低电。题面自己写，按公开资料整理。",
    summaryEn: "First practise feeding 5 V to VSYS through a fuse, and sharing a ground between the servo supply and its signal, then decide that a robot which powers on but will not walk should start with a battery-voltage check, and finally look at a low battery in the repair level. The wording is original, compiled from public information.",
    steps: [
      {
        kind: "bank",
        id: "wb-fuse-vsys-01",
        mode: "workbench",
        diff: "intermediate",
        title: "5 V 要经过保险丝再进 Pico 的 VSYS，并且共地",
        titleEn: "5 V must go through a fuse into the Pico VSYS, and share a ground",
        note: "先把供电路径接对，再谈为什么电压不够时走不动。",
        noteEn: "Get the supply path right first, then look at why the robot cannot walk when the voltage is low.",
      },
      {
        kind: "bank",
        id: "wb-servo-01",
        mode: "workbench",
        diff: "intermediate",
        title: "舵机电源、地和信号都要接到位，并且共地",
        titleEn: "The servo supply, ground and signal must all be connected, and share a ground",
        note: "走路还依赖舵机供电和共地，不是只接一根信号线。",
        noteEn: "Walking also depends on the servo supply and a shared ground, not only the signal wire.",
      },
      {
        kind: "bank",
        id: "dx-octo-batt-01",
        mode: "diagnosis",
        diff: "intermediate",
        title: "八爪鱼能开机但不走路：先查电池电压",
        titleEn: "The octopus powers on but will not walk: check the battery voltage first",
        note: "先判断该量电池，再进维修关卡。",
        noteEn: "Decide that the battery should be measured first, then open the repair level.",
      },
      {
        kind: "repair",
        scene: "octo-low-battery",
        title: "在维修关卡里查低电",
        titleEn: "Look at a low battery in the repair level",
        note: "关卡是简化仿真，用来练步骤，不能代替实测。",
        noteEn: "The level is a simplified simulation for practising the steps; it does not replace a real measurement.",
      },
    ],
  },
];

export function findPath(id) {
  return PATHS.find((p) => p.id === id) || null;
}

export function pathStepHref(step, pathId) {
  if (!step) return "/bank";
  if (step.kind === "teardown") {
    const n = new URLSearchParams();
    n.set("d", step.device);
    if (pathId) n.set("path", pathId);
    return "/teardown/?" + n.toString();
  }
  if (step.kind === "repair") {
    const n = new URLSearchParams();
    n.set("s", step.scene);
    if (pathId) n.set("path", pathId);
    return "/repair?" + n.toString();
  }
  const n = new URLSearchParams();
  if (step.mode) n.set("mode", step.mode);
  if (step.diff) n.set("diff", step.diff);
  if (step.id) n.set("id", step.id);
  if (pathId) n.set("path", pathId);
  return "/bank?" + n.toString();
}

export function stepIndexForItem(path, itemId) {
  if (!path) return -1;
  return path.steps.findIndex((s) => s.kind === "bank" && s.id === itemId);
}
