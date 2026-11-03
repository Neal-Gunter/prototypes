// v29（我的补充）：拆解模式里拆下来、零件库没有对应件的模块 —— 程序生成的近似件（尺寸全是估算，形状是示意）。
// 坐标同 procedural.js：y 朝上、底面 y = 0、xz 居中，单位 cm；dims_mm 给人看。
const box = (c, h, m = "white") => ({ k: "box", c, h, m });
const cyl = (c, r, h, m = "white", ax = "y") => ({ k: "cyl", c, r, h, ax, m });
function make(id, name_zh, name, cat, prims, spec) {
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const colliders = prims.map((p) => {
    const h = p.k === "box" ? p.h : p.ax === "x" ? [p.h / 2, p.r, p.r] : p.ax === "z" ? [p.r, p.r, p.h / 2] : [p.r, p.h / 2, p.r];
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.c[i] - h[i]); hi[i] = Math.max(hi[i], p.c[i] + h[i]); }
    return { c: p.c, h };
  });
  const dims_mm = { x: +((hi[0] - lo[0]) * 10).toFixed(1), y: +((hi[1] - lo[1]) * 10).toFixed(1), z: +((hi[2] - lo[2]) * 10).toFixed(1) };
  return {
    id, name_zh: `${name_zh}（近似件 · 拆解模式）`, name: `${name} (approximate, teardown)`, cat, approx: true, teardown: true,
    proc: { type: "prims", prims }, colliders, dims_mm, density: 1.3,
    dims_src: "按公开资料的常见尺寸估算，未经实物测量", spec, est: ["全部尺寸", "形状（示意）"], anchors: [],
  };
}
export const TD_PROCEDURAL = [
  make("td-servo-case-top", "微型舵机上盖", "Micro servo top cover", "enclosure",
    [box([0, 0.3, 0], [1.15, 0.3, 0.6], "blue"), cyl([0.55, 0.75, 0], 0.32, 0.3, "blue")], "SG90 一类微型舵机的上盖，内侧有齿轮轴孔。"),
  make("td-servo-case-mid", "微型舵机中壳（带安装耳）", "Micro servo middle case with mounting ears", "enclosure",
    [box([0, 0.8, 0], [1.15, 0.8, 0.6], "blue"), box([0, 1.45, 0], [1.6, 0.12, 0.6], "blue")], "中壳装电机和控制板，两侧安装耳各有一个螺丝孔。"),
  make("td-servo-case-bot", "微型舵机底盖", "Micro servo bottom cover", "enclosure",
    [box([0, 0.2, 0], [1.15, 0.2, 0.6], "blue")], "底盖，两颗长螺丝从这里穿到上盖。"),
  make("td-servo-gearset", "微型舵机齿轮组（4 级）", "Micro servo gear set (4 stages)", "motor",
    [cyl([-0.35, 0.1, 0], 0.55, 0.2), cyl([0.1, 0.35, 0], 0.5, 0.2), cyl([0.45, 0.6, 0], 0.45, 0.2), cyl([0.55, 0.9, 0], 0.4, 0.35), cyl([0.55, 1.2, 0], 0.15, 0.3, "steel")], "塑料（或金属）减速齿轮，最上面一个是带花键的输出齿轮。"),
  make("td-servo-board", "舵机控制板 + 反馈电位器", "Servo control board + feedback potentiometer", "driver",
    [box([0, 0.08, 0], [0.55, 0.08, 0.5], "green"), cyl([0, 0.4, 0], 0.4, 0.5, "black"), box([-0.3, 0.2, 0.2], [0.15, 0.05, 0.12], "black")], "控制芯片读电位器的位置，和输入脉冲比较后驱动电机；电位器的轴就是输出轴。"),
  make("td-pb-board", "充电宝控制板（充电 + 升压 + 保护）", "Power bank board (charge + boost + protection)", "power",
    [box([0, 0.08, 0], [2.6, 0.08, 1.0], "green"), box([2.2, 0.45, 0], [0.4, 0.33, 0.65], "steel"), box([-2.3, 0.2, 0.3], [0.35, 0.12, 0.45], "steel"), cyl([0, 0.3, -0.4], 0.3, 0.3, "black"), box([0.9, 0.15, 0.5], [0.2, 0.08, 0.15], "black")], "常见是一颗集成芯片：USB 充电管理、升压到 5 V、电量指示灯；有的另有保护板。USB-A 输出口 + USB-C 或 Micro-USB 输入口。"),
  make("td-pb-case", "充电宝外壳（单节 18650）", "Power bank shell (one 18650)", "enclosure",
    [box([0, 0.12, 0], [4.8, 0.12, 1.25], "white"), box([0, 1.25, 1.15], [4.8, 1.25, 0.1], "white"), box([0, 1.25, -1.15], [4.8, 1.25, 0.1], "white"), box([0, 2.38, 0], [4.8, 0.12, 1.25], "white")], "两半卡扣外壳，接缝处常有胶。"),
  make("td-fan-blade", "小风扇扇叶（5 叶）", "Mini fan blade (5 blades)", "motor",
    [cyl([0, 0.4, 0], 0.6, 0.8, "white"), ...[0, 1, 2, 3, 4].map((i) => box([Math.cos(i * 1.2566) * 2.6, 0.4, Math.sin(i * 1.2566) * 2.6], [0.9, 0.05, 0.9], "white"))], "压在电机轴上的塑料扇叶；中心孔和电机轴是过盈配合。"),
  make("td-fan-grille", "小风扇前后网罩", "Mini fan front/back grille", "enclosure",
    [cyl([0, 0.1, 0], 4.5, 0.2, "white"), cyl([0, 0.5, 0], 0.9, 0.6, "white")], "卡扣或螺丝固定的网罩，示意成一个圆盘。"),
  make("td-fan-usb-cable", "USB-A 供电线（只有 5 V 和 GND）", "USB-A power lead (5 V and GND only)", "wire",
    [box([0, 0.35, 0], [0.6, 0.22, 0.8], "black"), box([0, 0.35, 1.2], [0.6, 0.2, 0.4], "steel"), box([0, 0.2, -3], [0.15, 0.15, 2.3], "black")], "便宜 USB 风扇的线通常只接红（5 V）黑（GND）两根，没有数据线。"),
  // v30（我的补充）：有线鼠标 / 蓝牙音箱 / 厨房秤的近似件（尺寸全是估算）
  make("td-mouse-top", "鼠标上壳（带左右键）", "Mouse top shell (with buttons)", "enclosure",
    [box([0, 0.6, 0], [3.0, 0.6, 5.4], "black"), box([0, 1.4, -0.8], [2.6, 0.3, 3.4], "black")], "上壳前端就是左右键，按下去压到主板上的微动开关。"),
  make("td-mouse-bottom", "鼠标下壳", "Mouse bottom shell", "enclosure",
    [box([0, 0.15, 0], [3.0, 0.15, 5.4], "black"), box([0, 0.5, -5.2], [2.6, 0.35, 0.15], "black")], "下壳中间有给光学传感器开的窗口，四周有脚垫。"),
  make("td-mouse-pcb", "鼠标主板（带光学传感器）", "Mouse board (with optical sensor)", "driver",
    [box([0, 0.08, 0], [2.4, 0.08, 4.0], "green"), box([0, 0.35, -0.4], [0.5, 0.2, 0.6], "black"), cyl([0, -0.1, -0.4], 0.3, 0.2, "white")], "主控和光学传感器常是一颗芯片，下面有透镜和照明 LED。"),
  make("td-mouse-wheel", "鼠标滚轮", "Mouse scroll wheel", "motor",
    [cyl([0, 1.1, 0], 1.1, 0.7, "black", "x"), cyl([0, 1.1, 0], 0.12, 1.6, "white", "x")], "带橡胶圈的塑料滚轮，一端是插进编码器的方轴。"),
  make("td-mouse-cable", "鼠标 USB 线（4 芯）", "Mouse USB cable (4 wires)", "wire",
    [box([0, 0.35, 0], [0.6, 0.22, 0.8], "black"), box([0, 0.35, 1.2], [0.6, 0.2, 0.4], "steel"), box([0, 0.2, -3], [0.15, 0.15, 2.3], "black")], "USB 鼠标的线有电源、地和两根数据线，一般直接焊在主板上。"),
  make("td-spk-grille", "音箱网罩", "Speaker grille", "enclosure",
    [cyl([0, 0.1, 0], 2.8, 0.2, "steel"), cyl([0, 0.3, 0], 2.9, 0.2, "black")], "金属或布面网罩，示意成一个圆盘。"),
  make("td-spk-board", "蓝牙 + 功放主板", "Bluetooth + amplifier board", "module",
    [box([0, 0.08, 0], [1.8, 0.08, 1.2], "green"), box([-0.6, 0.2, 0], [0.35, 0.08, 0.35], "black"), box([0.6, 0.18, 0.3], [0.25, 0.06, 0.2], "black"), box([1.2, 0.12, -0.8], [0.4, 0.02, 0.3], "steel")], "一般是一颗蓝牙音频芯片 + 一颗小功放芯片 + 充电管理，PCB 边上是天线走线。"),
  make("td-spk-shell", "音箱外壳", "Speaker shell", "enclosure",
    [cyl([0, 2.6, 0], 3.1, 5.2, "black", "z")], "塑料或硅胶外壳，示意成一个圆筒。"),
  make("td-scale-platform", "厨房秤秤盘", "Kitchen scale platform", "enclosure",
    [box([0, 0.3, 0], [7.5, 0.3, 7.5], "acrylic")], "钢化玻璃或塑料面板，四个角压在称重传感器上。"),
  make("td-scale-base", "厨房秤底壳", "Kitchen scale base", "enclosure",
    [box([0, 0.15, 0], [7.5, 0.15, 7.5], "black"), box([0, 0.7, 7.3], [7.5, 0.55, 0.2], "black")], "底壳带电池仓，四个角是传感器的安装座。"),
  make("td-scale-loadcell", "称重传感器（半桥）", "Load cell (half bridge)", "sensor",
    [cyl([0, 0.4, 0], 1.7, 0.8, "steel"), cyl([0, 0.95, 0], 0.5, 0.3, "steel")], "冲压金属片上贴应变片，受力时电阻有很小的变化；厨房秤里常是 4 个一组。"),
  make("td-scale-board", "厨房秤主板（模数转换 + 段码屏）", "Kitchen scale board (ADC + segment LCD)", "driver",
    [box([0, 0.08, 0], [2.8, 0.08, 1.4], "green"), box([0, 0.3, 0], [2.0, 0.14, 1.0], "acrylic"), box([-2.2, 0.15, 0.6], [0.3, 0.05, 0.3], "black")], "一颗专用的称重模数转换芯片（或集成在主控里），屏是用导电胶条压在板上的段码液晶。"),
  // v31（我的补充）：LED 手电筒 / TP4056 充电板的近似件（尺寸全是估算）
  make("td-fl-led-star", "手电 LED（带圆形铝基板）", "Flashlight LED on round aluminium board", "led",
    [cyl([0, 0.08, 0], 0.8, 0.16, "steel"), box([0, 0.24, 0], [0.18, 0.08, 0.18], "white"), cyl([0, 0.34, 0], 0.15, 0.08, "acrylic")], "大功率 LED 焊在圆形铝基板上帮它散热，示意成一个金属圆片。"),
  make("td-fl-driver", "手电驱动板（限流 / 多档）", "Flashlight driver board (current limit / modes)", "driver",
    [cyl([0, 0.08, 0], 0.85, 0.16, "green"), box([0, 0.24, 0], [0.25, 0.08, 0.2], "black"), cyl([0, -0.15, 0], 0.25, 0.3, "steel")], "圆形小板，背面的弹簧或铜柱顶住电池正极；有的只有一个电阻。"),
  make("td-fl-reflector", "手电反光杯 + 透镜", "Flashlight reflector + lens", "enclosure",
    [cyl([0, 0.7, 0], 1.0, 1.4, "steel"), cyl([0, 1.45, 0], 1.05, 0.1, "acrylic")], "抛光或橘皮面的反光杯，前面压一片玻璃或塑料透镜。"),
  make("td-fl-body", "手电铝筒身", "Flashlight aluminium body", "enclosure",
    [cyl([0, 0, 0], 0.95, 8.5, "black", "x")], "阳极氧化铝管，两端有螺纹，本身也是电流回路的一部分。"),
  make("td-tp4056-board", "TP4056 充电板（带保护）", "TP4056 charger board (with protection)", "power",
    [box([0, 0.06, 0], [1.3, 0.06, 0.85], "blue"), box([-1.1, 0.25, 0], [0.3, 0.14, 0.38], "steel"), box([-0.2, 0.18, 0], [0.25, 0.06, 0.2], "black"), box([0.55, 0.16, -0.25], [0.15, 0.04, 0.15], "black"), box([0.55, 0.16, 0.25], [0.2, 0.04, 0.15], "black")], "TP4056 线性充电芯片 + 保护芯片 + 双 MOS 管 + 两颗指示灯；尺寸按常见小板估算。"),
  // v32（我的补充）：9V LED 测试器 / OTG 集线器的近似件（尺寸全是估算）
  make("td-9v-snap", "9V 电池扣（带红黑线）", "9 V snap clip (red and black leads)", "power",
    [box([0, 0.35, 0], [1.3, 0.35, 0.85], "black"), cyl([-0.65, 0.85, 0], 0.3, 0.3, "steel"), cyl([0.65, 0.85, 0], 0.35, 0.3, "steel")], "塑料扣上两个金属按扣，一大一小防插反；尺寸按常见 9V 电池估算。"),
  make("td-9v-tester-case", "LED 测试器外壳", "LED tester case", "enclosure",
    [box([0, 0.1, 0], [3.2, 0.1, 2.0], "black"), box([0, 1.1, 1.9], [3.2, 0.9, 0.1], "black"), box([0, 1.1, -1.9], [3.2, 0.9, 0.1], "black"), box([3.1, 1.1, 0], [0.1, 0.9, 1.8], "black"), box([-3.1, 1.1, 0], [0.1, 0.9, 1.8], "black")], "能装下一节 9V 电池和一块小板的塑料盒，示意成开口盒。"),
  make("td-otg-hub-board", "OTG 集线器板（芯片 + 晶振 + 母座）", "OTG hub board (chip + crystal + sockets)", "module",
    [box([0, 0.06, 0], [3.0, 0.06, 1.0], "green"), box([-0.8, 0.2, 0], [0.35, 0.08, 0.35], "black"), box([-0.1, 0.18, 0.2], [0.2, 0.06, 0.1], "steel"), box([1.7, 0.45, 0], [1.2, 0.4, 0.75], "steel"), box([-3.0, 0.2, 0], [0.5, 0.14, 0.45], "steel")], "一颗 USB 2.0 集线器芯片、晶振、电容，一头插头、一头几个 USB-A 母座；尺寸按常见小型集线器估算。"),
  make("td-otg-hub-shell", "OTG 集线器外壳", "OTG hub shell", "enclosure",
    [box([0, 0.08, 0], [3.4, 0.08, 1.3], "white"), box([0, 0.65, 1.25], [3.4, 0.5, 0.08], "white"), box([0, 0.65, -1.25], [3.4, 0.5, 0.08], "white")], "上下两半卡在一起的塑料壳，示意成下半壳。"),
  // v33（我的补充）：AA 电池玩具车的两个近似件，尺寸按常见小型玩具车估算
  make("td-aa-car-chassis", "玩具车底盘（带电池仓）", "Toy car chassis (with battery bay)", "enclosure",
    [box([0, 0.15, 0], [6.0, 0.15, 2.8], "black"), box([-1.0, 0.6, 0], [1.6, 0.3, 1.5], "black"), box([0, 0.5, 2.7], [6.0, 0.35, 0.1], "black"), box([0, 0.5, -2.7], [6.0, 0.35, 0.1], "black")], "一块塑料底盘，中间是放两节 AA 电池的凹槽，两侧有轴孔；示意成平板 + 电池仓 + 两条侧边。"),
  make("td-aa-car-gearbox", "电机齿轮箱（小直流电机 + 减速齿轮）", "Motor gearbox (small DC motor + reduction gears)", "mech",
    [box([0, 0.9, 0], [1.6, 0.9, 1.1], "yellow"), cyl([-2.2, 0.9, 0], 0.7, 1.2, "steel"), cyl([0.6, 0.9, 1.5], 0.15, 0.6, "steel"), cyl([0.6, 0.9, -1.5], 0.15, 0.6, "steel")], "常见的透明或黄色齿轮箱，一头伸出小直流电机，两侧伸出驱动轴；尺寸是估算。"),
  // v35（我的补充）：两节 AAA 的红外遥控器的三个近似件，尺寸按常见电视遥控器估算
  make("td-ir-remote-shell", "遥控器外壳（下半壳，带电池仓）", "Remote control shell (lower half, with battery bay)", "enclosure",
    [box([0, 0.1, 0], [2.2, 0.1, 8.0], "black"), box([2.1, 0.6, 0], [0.1, 0.5, 8.0], "black"), box([-2.1, 0.6, 0], [0.1, 0.5, 8.0], "black"), box([0, 0.45, -5.4], [1.3, 0.35, 2.4], "black")], "上下两半卡在一起的长条塑料壳，示意成下半壳，一头是放两节 AAA 电池的凹槽。"),
  make("td-ir-remote-keypad", "硅胶按键垫（带导电碳点）", "Silicone keypad (with conductive carbon pads)", "mech",
    [box([0, 0.08, 0], [1.9, 0.08, 5.0], "white"), box([0, 0.35, -1.5], [1.2, 0.2, 1.2], "white"), box([0, 0.35, 2.0], [1.2, 0.2, 1.8], "white")], "一整块软硅胶，每个按键背面有一颗导电碳点；按下时碳点把电路板上的两片梳齿铜皮接通。形状是示意。"),
  make("td-ir-remote-pcb", "遥控器电路板（梳齿触点 + 编码芯片）", "Remote control board (interdigitated pads + encoder chip)", "module",
    [box([0, 0.06, 0], [1.9, 0.06, 5.6], "green"), box([0.6, 0.2, 4.4], [0.35, 0.1, 0.5], "black"), cyl([0, 0.3, 5.9], 0.25, 0.6, "white", "z")], "一块单面电路板：按键位置是成对的梳齿铜皮，一头有一颗编码芯片（常是黑色胶封）和红外 LED。尺寸是估算。"),
  // v36（我的补充）：一节 AAA 的电子厨房计时器的三个近似件，尺寸按常见方形磁吸计时器估算
  make("td-ktimer-shell", "计时器外壳（后盖，带电池仓和磁铁位）", "Timer shell (back cover, with battery bay and magnet seat)", "enclosure",
    [box([0, 0.1, 0], [3.2, 0.1, 3.2], "white"), box([3.1, 0.7, 0], [0.1, 0.6, 3.2], "white"), box([-3.1, 0.7, 0], [0.1, 0.6, 3.2], "white"), box([0, 0.45, -1.6], [2.4, 0.35, 0.65], "white"), cyl([0, 0.15, 1.3], 0.9, 0.1, "steel")], "前后两半卡在一起的方形塑料壳，示意成后盖：一条放一节 AAA 的凹槽，背面一块圆形磁铁。尺寸是估算。"),
  make("td-ktimer-lcd", "段码液晶屏 + 导电胶条", "Segment LCD + elastomer (zebra) strip", "display",
    [box([0, 0.12, 0], [2.4, 0.12, 1.2], "acrylic"), box([0, 0.3, -1.25], [2.2, 0.06, 0.08], "black")], "只能显示几位数字和几个符号的段码液晶片，靠一条黑白相间的导电胶条压在电路板的触点上，没有焊线。尺寸是估算。"),
  make("td-ktimer-pcb", "计时器电路板（胶封芯片 + 按键触点）", "Timer board (epoxy-blob chip + key pads)", "module",
    [box([0, 0.06, 0], [2.8, 0.06, 2.6], "green"), cyl([0.8, 0.18, 0.6], 0.45, 0.12, "black"), box([-1.5, 0.12, 1.6], [0.3, 0.06, 0.3], "steel"), box([0, 0.12, 1.6], [0.3, 0.06, 0.3], "steel"), box([1.5, 0.12, 1.6], [0.3, 0.06, 0.3], "steel")], "一块单面板：中间一团黑色胶封的计时芯片（芯片直接粘在板上），旁边一颗小晶振，下沿是几组按键触点。尺寸是估算。"),
  // v37（我的补充）：电池感应小夜灯的三个近似件，尺寸按常见 3 × AAA 长条小夜灯估算
  make("td-nlight-shell", "小夜灯外壳（后盖 + 乳白灯罩）", "Night light shell (back cover + milky diffuser)", "enclosure",
    [box([0, 0.1, 0], [4.2, 0.1, 1.8], "white"), box([0, 0.9, 1.75], [4.2, 0.8, 0.05], "acrylic"), box([0, 0.9, -1.75], [4.2, 0.8, 0.05], "white"), box([4.15, 0.9, 0], [0.05, 0.8, 1.8], "white"), box([-4.15, 0.9, 0], [0.05, 0.8, 1.8], "white")], "长条形塑料壳，示意成后盖加一片乳白色灯罩：灯罩把几颗 LED 的光打散，后盖里是 3 节 AAA 的电池仓。尺寸是估算。"),
  make("td-nlight-pcb", "小夜灯 LED 灯板（贴片 LED + 控制芯片）", "Night light LED board (SMD LEDs + control chip)", "module",
    [box([0, 0.06, 0], [3.6, 0.06, 1.2], "green"), ...[-2.4, -1.2, 0, 1.2, 2.4].map((x) => box([x, 0.16, 0.5], [0.25, 0.08, 0.25], "white")), box([1.2, 0.14, -0.6], [0.35, 0.06, 0.25], "black")], "一块长条板：一排贴片 LED，一颗控制芯片，旁边是限流电阻和开关管。尺寸是估算，具体芯片型号各厂不同。"),
  make("td-nlight-pir", "人体感应头（菲涅尔透镜 + 热释电传感器）", "PIR head (Fresnel lens + pyroelectric sensor)", "sensor",
    [box([0, 0.05, 0], [0.8, 0.05, 0.8], "green"), cyl([0, 0.3, 0], 0.48, 0.4, "steel"), cyl([0, 0.75, 0], 0.6, 0.5, "white")], "白色圆顶是菲涅尔透镜，下面是一颗带小窗口的金属圆罐热释电传感器，焊在一小块板上。尺寸是估算。"),
];
