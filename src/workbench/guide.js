export const GUIDE_STEPS = [
  {
    id: "place",
    title: "放置",
    body: "把 ESP32-S3、电池和舵机 A 放到基板上。可以拖到左侧场景，也可以点「放到基板」。松手后吸到空位。外形是简化的，不是 CAD。",
  },
  {
    id: "wire",
    title: "接线",
    body: "先点一个引脚，再点另一个零件上的引脚。示例：电池 BAT+ 到 5V，BAT− 到 GND，舵机 A 的 VCC 到 BAT+，GND 到 GND，SIG 到 GPIO4。把 SIG 接到 GPIO1 时，检查会标成非 PWM。这是简化规则，不是原理图。",
  },
  {
    id: "solder",
    title: "焊接",
    body: "点「拿起烙铁」，再按住每根线的焊点，直到热量条走满。大约要按住一秒。提前松开会记成冷焊，可以按住重焊。",
  },
  {
    id: "flash",
    title: "固件",
    body: "示例程序用 arm.attach(4) 和 arm.write。点运行后，Web Worker 里的 JavaScript 解释器执行它，不是 ESP32-S3。",
  },
  {
    id: "watch",
    title: "观察",
    body: "舵机 A 按简化规则接通之后，1 号触手跟着角度走。运动是运动学加弹簧，不是 MuJoCo。",
  },
];

export function guidePhase({ partsReady, topologyReady, powerReady, sawMotion }) {
  if (!partsReady) return "place";
  if (!topologyReady) return "wire";
  if (!powerReady) return "solder";
  if (!sawMotion) return "flash";
  return "watch";
}
