// v29（我的补充）：拆解模式的设备数据。全部文字是本项目自己写的，按公开的通用常识整理，未经实物验证；
// 没有复制任何拆解指南的文字或照片（灵感来源见“出处与许可”页）。
// part：零件库里的 id（match = "same" 同类件 / "similar" 相近件 / "approx" 程序生成近似件）。
// ex：爆炸图里的位置 p 和拆开方向 d（cm，y 朝上）。fig：步骤插图（本项目自绘 SVG）用到的图层。
export const UNVERIFIED = { zh: "按公开资料整理，未经实物验证", en: "Compiled from public information; not verified on a real device" };
const T = (zh, en) => ({ zh, en });

export const COMMON_SAFETY = [
  T("有电池的设备：先处理电池。先关机、拔线，再把电池断开并用绝缘胶带包住端子，然后才拆别的。", "Devices with a battery: deal with the battery first. Switch off, unplug, disconnect the battery and tape its terminals before you take anything else apart."),
  T("防静电：拆电路板前先摸一下接地的金属（或戴防静电腕带），板子放在防静电垫或纸板上，不要放在化纤布上。", "ESD: touch grounded metal (or wear a wrist strap) before handling boards. Put boards on an ESD mat or cardboard, not on synthetic fabric."),
  T("每一步都有“停止点”：看到鼓包、漏液、焦味、发烫，或者需要更大的力才能继续，就停下来，不要硬撬。", "Every guide has stop points. If you see swelling, leaks, a burnt smell or heat, or if it takes a lot of force to go on, stop. Do not force it."),
  T("戴护目镜。卡扣和弹簧会弹出来，小螺丝按步骤分格放。", "Wear eye protection. Clips and springs can fly out. Keep small screws in a tray, one compartment per step."),
];

export const DEVICES = [
  {
    id: "micro-servo",
    name: T("微型舵机（SG90 一类，9 g）", "Micro servo (SG90-class, 9 g)"),
    model: "SG90 / MG90S / 9g micro servo",
    alias: ["sg90", "mg90", "9g", "servo", "舵机", "微型舵机"],
    difficulty: 1, minutes: 20,
    summary: T("最常见的 9 g 小舵机：塑料外壳里有一个小直流电机、一组减速齿轮、一块控制板，输出轴下面连着反馈电位器。拆开能看懂舵机为什么能停在指定角度。", "The common 9 g hobby servo. The plastic case holds a small DC motor, a reduction gear train and a control board. A feedback potentiometer sits under the output shaft. Opening one shows how a servo holds a set angle."),
    battery: false,
    materials: [
      T("小号十字螺丝刀（常见是 PH0 或 PH00）", "Small Phillips screwdriver (usually PH0 or PH00)"),
      T("塑料撬片", "Plastic spudger"),
      T("镊子", "Tweezers"),
      T("分格零件盒 + 手机（拍照记齿轮顺序）", "Parts tray with compartments, and a phone to photograph the gear order"),
      T("烙铁 + 吸锡带（只在要拆下电机时用）", "Soldering iron and desoldering braid (only if you remove the motor)"),
    ],
    safety: [
      T("没有电池，但如果舵机还接在电路上，先断电、拔掉三根线。", "There is no battery, but if the servo is still wired up, power it down and unplug the three wires first."),
      T("齿轮很小、容易丢；取齿轮前先拍照。", "The gears are tiny and easy to lose. Take a photo before you lift them out."),
      T("控制板上的芯片怕静电，拿板子前先放电。", "The chip on the control board is ESD-sensitive. Discharge yourself before touching it."),
    ],
    fig: [
      { id: "horn", x: 74, y: 8, w: 36, h: 8, c: "#f1efe9", t: T("舵盘", "Horn") },
      { id: "top", x: 60, y: 20, w: 70, h: 22, c: "#2f6fd6", t: T("上盖", "Top cover") },
      { id: "gears", x: 66, y: 24, w: 58, h: 14, c: "#e2b524", t: T("齿轮组", "Gears") },
      { id: "mid", x: 48, y: 44, w: 94, h: 40, c: "#2f6fd6", t: T("中壳", "Middle case") },
      { id: "motor", x: 64, y: 50, w: 28, h: 28, c: "#b8bcc2", t: T("电机", "Motor") },
      { id: "board", x: 96, y: 52, w: 34, h: 24, c: "#2f8f4e", t: T("控制板", "Board") },
      { id: "bot", x: 60, y: 86, w: 70, h: 12, c: "#2f6fd6", t: T("底盖", "Bottom cover") },
      { id: "screws", x: 62, y: 100, w: 66, h: 6, c: "#5b6168", t: T("长螺丝 ×2", "Long screws ×2") },
    ],
    steps: [
      { t: T("断电、拍照记录", "Power off and take a photo"), d: T("把舵机从电路上拔下来。拍一张舵盘角度和线序（通常棕/红/橙 = GND/V+/信号）的照片，装回去时要对照。", "Unplug the servo from your circuit. Photograph the horn angle and the wire order (usually brown/red/orange = GND/V+/signal) so you can put it back the same way."), fig: { hi: ["horn"] } },
      { t: T("卸下舵盘", "Remove the horn"), d: T("拧下舵盘中间的小螺丝，把舵盘竖直向上拔出。不要左右掰，花键是塑料的。", "Undo the small screw in the middle of the horn and pull the horn straight up. Do not rock it sideways: the spline is plastic."), fig: { hi: ["horn"], off: { horn: [0, -6] } } },
      { t: T("拧下底部长螺丝", "Undo the long screws on the bottom"), d: T("翻过来，底盖上通常有 2 颗贯穿整个外壳的长螺丝（有的型号是 4 颗）。全部拧下，放进第 1 格。", "Turn it over. The bottom cover usually has 2 long screws that run through the whole case (some models have 4). Remove them all and put them in compartment 1."), fig: { hi: ["screws"], off: { screws: [0, 10] } } },
      { t: T("先打开上盖，记录齿轮顺序", "Open the top cover first and record the gear order"), d: T("舵机正面朝上放平，慢慢提起上盖。齿轮会留在中壳上。拍照记下每个齿轮的位置和朝向，再用镊子一个个取出，按顺序排好。", "Keep the servo upright and lift the top cover slowly. The gears stay on the middle case. Photograph where each gear sits and which way up it goes, then lift them out one by one with tweezers and lay them out in order."), fig: { hi: ["top", "gears"], off: { horn: [0, -10], top: [0, -8], gears: [44, -10] } }, stop: T("停止点：只想换齿轮的话到这里就够了，换好按反顺序装回。", "Stop point: if you only want to replace the gears, stop here and reassemble in reverse order.") },
      { t: T("取下底盖，看控制板和电机", "Remove the bottom cover to see the board and motor"), d: T("取下底盖。控制板一般竖着或平躺在电机旁边，电机两脚直接焊在板上，电位器的轴从板子穿到上面当输出轴。", "Lift off the bottom cover. The control board sits upright or flat next to the motor. The motor's two tabs are soldered straight onto the board, and the potentiometer shaft passes up through the case to become the output shaft."), fig: { hi: ["bot", "board", "motor"], off: { bot: [0, 8], screws: [0, 14], top: [0, -8], gears: [44, -10], horn: [0, -10] } } },
      { t: T("（可选）拆焊电机", "(Optional) Desolder the motor"), d: T("要单独拿出电机时：用烙铁和吸锡带拆焊电机两脚，再把电机从中壳里推出来。电位器通常焊在同一块板上，跟板子算一个模块。", "If you want the motor on its own, desolder its two tabs with the iron and braid, then push the motor out of the middle case. The potentiometer is usually soldered to the same board, so treat board and pot as one module."), warn: T("烙铁头约 300 °C 以上，用烙铁架；焊完等冷却再碰。", "The iron tip is above about 300 °C. Use the stand and let joints cool before touching."), stop: T("停止点：拆焊后舵机就不能原样装回了；还想用这只舵机就不要做这一步。", "Stop point: after desoldering, the servo cannot simply be reassembled. Skip this step if you want to keep using the servo."), fig: { hi: ["motor", "board"], off: { motor: [-40, 0], board: [40, 0], bot: [0, 8], screws: [0, 14], top: [0, -8], gears: [44, -10], horn: [0, -10] } } },
      { t: T("整理模块，存进零件库", "Sort the modules and save them to the parts library"), d: T("一般能得到：外壳 3 件、齿轮组、直流电机、控制板（带电位器）、舵盘、3 芯线。点下面“存进零件库”，这些模块会出现在零件库的“拆解所得”里，可以拿到装配台上用。", "You usually end up with: 3 case parts, the gear set, the DC motor, the control board (with the pot), the horn and the 3-wire lead. Press 'Save modules to parts library' below and they appear under 'From teardowns' in the parts browser, ready to use on the assembly bench."), fig: { off: { motor: [-40, 0], board: [40, 0], bot: [0, 8], screws: [0, 14], top: [0, -8], gears: [44, -10], horn: [0, -10] } } },
    ],
    modules: [
      { key: "horn", part: "fc-servo-sg90-horn1", match: "same", t: T("舵盘", "Servo horn"), ex: { p: [0.55, 3.4, 0], d: [0, 1.6, 0] } },
      { key: "top", part: "td-servo-case-top", match: "approx", t: T("上盖", "Top cover"), ex: { p: [0, 2.9, 0], d: [0, 1.1, 0] } },
      { key: "gears", part: "td-servo-gearset", match: "approx", t: T("齿轮组", "Gear set"), ex: { p: [0, 1.7, 0], d: [0, 0.6, 1.2] } },
      { key: "mid", part: "td-servo-case-mid", match: "approx", t: T("中壳（带安装耳）", "Middle case (with ears)"), ex: { p: [0, 0.0, 0], d: [0, 0, 0] } },
      { key: "motor", part: "fc-dc-6v-servo", match: "similar", t: T("直流电机", "DC motor"), ex: { p: [-0.5, 0.4, 0], d: [-1.6, -0.6, 0] } },
      { key: "board", part: "td-servo-board", match: "approx", t: T("控制板 + 电位器", "Control board + pot"), ex: { p: [0.55, 0.4, 0], d: [1.6, -0.6, 0] } },
      { key: "bot", part: "td-servo-case-bot", match: "approx", t: T("底盖", "Bottom cover"), ex: { p: [0, -0.5, 0], d: [0, -1.4, 0] } },
      { key: "lead", part: "p-dupont-housing-1x3", match: "similar", t: T("3 芯线（杜邦头）", "3-wire lead (DuPont plug)"), ex: { p: [-1.2, 0.2, 0], d: [-1, -0.4, 1] } },
    ],
    explode: true,
  },
  {
    id: "powerbank-18650",
    name: T("单节 18650 USB 充电宝", "USB power bank with one 18650 cell"),
    model: "1×18650 power bank (2000–3000 mAh class)",
    alias: ["18650", "power bank", "充电宝", "移动电源", "锂电池", "li-ion"],
    difficulty: 2, minutes: 30,
    summary: T("便宜的小充电宝：一节 18650 锂离子电芯 + 一块控制板（充电管理、升压到 5 V、电量灯）。拆它主要是学会安全处理锂电池，以及看懂“锂电 → 5 V USB”这一路是怎么来的。", "A cheap small power bank: one 18650 Li-ion cell and one board that handles charging, boosts to 5 V and drives the charge LEDs. The point of opening one is to learn to handle a Li-ion cell safely and to see how 'Li-ion to 5 V USB' works."),
    battery: true,
    materials: [
      T("塑料撬片 ×2（不要用金属刀）", "Two plastic spudgers (no metal blades)"),
      T("绝缘胶带（或高温胶带）", "Insulating tape (or Kapton tape)"),
      T("万用表（量电芯电压）", "Multimeter (to measure the cell voltage)"),
      T("绝缘柄斜口钳（剪镍片用）", "Flush cutters with insulated handles (for the nickel strips)"),
      T("不可燃的台面（瓷砖 / 金属托盘），旁边放一桶沙或防火袋", "A non-flammable surface (tile or metal tray), with a bucket of sand or a fire bag nearby"),
      T("护目镜", "Eye protection"),
    ],
    safety: [
      T("电池先处理：先关机拔线，打开外壳后第一件事就是断开电芯，再碰控制板。", "Battery first: switch off and unplug. Once the shell is open, disconnect the cell before you touch the board."),
      T("不要满电拆。拆前先用到电量灯只剩 1–2 格。", "Do not open it fully charged. Run it down to 1–2 charge LEDs first."),
      T("一次只剪一根镍片，剪完马上用胶带包住，绝对不要让工具同时碰到电芯两极。", "Cut only one nickel strip at a time and tape it straight away. Never let a tool touch both ends of the cell at once."),
      T("不要用烙铁直接焊电芯，不要刺穿、挤压、弯折电芯。", "Never solder directly onto the cell, and never puncture, crush or bend it."),
      T("鼓包、漏液、有甜味/焦味、发烫：立即停止，把设备放到不可燃的地方，按当地规定交回收点。", "Swelling, leaks, a sweet or burnt smell, or heat: stop at once, move the device to a non-flammable place and take it to a battery recycling point."),
    ],
    fig: [
      { id: "shell", x: 14, y: 18, w: 172, h: 70, c: "#f1efe9", t: T("外壳", "Shell") },
      { id: "cell", x: 24, y: 30, w: 104, h: 30, c: "#d9792b", t: T("18650 电芯", "18650 cell") },
      { id: "tabs", x: 128, y: 36, w: 8, h: 18, c: "#b8bcc2", t: T("镍片", "Strip") },
      { id: "board", x: 138, y: 28, w: 40, h: 50, c: "#2f8f4e", t: T("控制板", "Board") },
      { id: "usb", x: 176, y: 40, w: 10, h: 16, c: "#5b6168", t: T("USB", "USB") },
      { id: "led", x: 148, y: 66, w: 20, h: 6, c: "#e2b524", t: T("电量灯", "LEDs") },
    ],
    steps: [
      { t: T("先检查外观（停止点）", "Check the outside first (stop point)"), d: T("看外壳有没有鼓起、开裂、变形，摸有没有发热，闻有没有甜味或焦味。", "Look for a bulging, cracked or warped shell, feel for heat, and smell for anything sweet or burnt."), stop: T("停止点：有任何一项就不要拆，送去电池回收点。", "Stop point: if you find any of these, do not open it. Take it to a battery recycling point."), fig: { hi: ["shell"] } },
      { t: T("放电、关机、拔线", "Run it down, switch off, unplug"), d: T("把电量用到只剩 1–2 格灯，然后拔掉所有线。", "Use it until only 1–2 LEDs are left, then unplug every cable."), fig: { hi: ["led", "usb"] } },
      { t: T("沿接缝撬开外壳", "Open the shell along the seam"), d: T("在不可燃台面上，用两片塑料撬片沿接缝一点点撬开卡扣。撬片只插浅浅一下，金属工具不要伸进去，下面就是电芯。", "On the non-flammable surface, work two plastic spudgers along the seam to release the clips. Insert them only a little way and keep metal tools out: the cell is right underneath."), warn: T("外壳卡得很紧、要用很大力：停止，可能是胶粘的，强撬会压到电芯。", "If the shell is very tight and needs a lot of force, stop. It may be glued, and forcing it can crush the cell."), fig: { hi: ["shell"], off: { shell: [0, -12] } } },
      { t: T("先断开电芯（电池先处理）", "Disconnect the cell first (battery first)"), d: T("找到电芯和控制板之间的镍片或导线。先断负极（标 B− 或接电芯平头那端）：剪断后立刻用胶带包住两边；再断正极，同样包好。", "Find the nickel strips or wires between the cell and the board. Cut the negative first (marked B− or on the flat end of the cell) and tape both cut ends straight away. Then cut the positive and tape it the same way."), warn: T("一次只剪一根；钳子不要同时碰到两根。", "One strip at a time. Never let the cutters touch both strips."), fig: { hi: ["tabs"], off: { shell: [0, -12] } } },
      { t: T("量电芯电压并记录", "Measure and note the cell voltage"), d: T("用万用表直流电压档量电芯两端。满电约 4.2 V，常见用完约 3.0–3.5 V。明显低于约 2.5 V 的电芯通常不建议再充。", "Measure across the cell on the DC volts range. A full cell reads about 4.2 V; a run-down one is typically 3.0–3.5 V. A cell well below about 2.5 V is usually not worth recharging."), stop: T("停止点：电芯发热或电压异常跳动，停止，送回收。", "Stop point: if the cell gets warm or the reading jumps around, stop and recycle it."), fig: { hi: ["cell"], off: { shell: [0, -12], cell: [-6, 30] } } },
      { t: T("取出控制板，认识上面的东西", "Lift out the board and identify its parts"), d: T("控制板上一般能看到：USB-A 输出口、USB-C 或 Micro-USB 充电口、一颗主控芯片、一个功率电感（升压用）、几颗电量 LED，可能还有一个按键。", "On the board you will usually find: a USB-A output, a USB-C or Micro-USB charge input, one main chip, a power inductor (for the boost converter), a few charge LEDs and perhaps a button."), fig: { hi: ["board", "usb", "led"], off: { shell: [0, -12], cell: [-6, 30], board: [6, 30], usb: [6, 30], led: [6, 30] } } },
      { t: T("整理模块，存进零件库", "Sort the modules and save them to the parts library"), d: T("得到：18650 电芯（两端已包胶带）、控制板、外壳。电芯如果要再用，必须配带保护的充电板和电池盒，不要直接接线使用。", "You get the 18650 cell (ends taped), the board and the shell. To reuse the cell, put it in a holder with a protected charger board. Do not wire it up bare."), fig: { off: { shell: [0, -12], cell: [-6, 30], board: [6, 30], usb: [6, 30], led: [6, 30] } } },
    ],
    modules: [
      { key: "cell", part: "p-cell-18650", match: "same", t: T("18650 锂离子电芯", "18650 Li-ion cell"), ex: { p: [-1.2, 0.3, 0], d: [0, 0, 2.2] } },
      { key: "board", part: "td-pb-board", match: "approx", t: T("充电宝控制板", "Power bank board"), ex: { p: [3.9, 0.4, 0], d: [2.0, 0.6, 0] } },
      { key: "usbc", part: "kc-usb_c_receptacle_gct_usb4105-xx-a_16p_topmnt_horizontal", match: "similar", t: T("USB-C 母座（如果是 USB-C 输入）", "USB-C socket (if the input is USB-C)"), ex: { p: [3.9, 0.5, 1.0], d: [2.4, 1.2, 1.4] } },
      { key: "case", part: "td-pb-case", match: "approx", t: T("外壳", "Shell"), ex: { p: [0, -0.1, 0], d: [0, -1.8, 0] } },
      { key: "holder", part: "kc-batteryholder_keystone_1042_1x18650", match: "similar", t: T("（建议添置）18650 电池盒，再用电芯时用", "(Suggested) 18650 holder for reusing the cell"), ex: { p: [-1.2, 0.0, -3.2], d: [0, 0, -1.2] }, suggest: true },
    ],
  },
  {
    id: "usb-mini-fan",
    name: T("USB 桌面小风扇", "USB desktop mini fan"),
    model: "USB 5 V desk fan (non-rechargeable)",
    alias: ["fan", "风扇", "usb fan", "小风扇", "desk fan", "130 motor"],
    difficulty: 1, minutes: 15,
    summary: T("插 USB 的桌面小风扇：一般就是一个 130 型一类的小直流电机、一个开关、一根只接 5 V 和地的 USB 线，加上扇叶和网罩。最适合第一次拆。", "A USB desk fan: usually a small DC motor (often 130-size), a switch and a USB lead with only 5 V and ground, plus the blade and grille. A good first teardown."),
    battery: false,
    materials: [
      T("十字螺丝刀（PH1 左右）", "Phillips screwdriver (about PH1)"),
      T("塑料撬片", "Plastic spudger"),
      T("斜口钳 + 剥线钳（要留下 USB 线时）", "Cutters and wire strippers (if you keep the USB lead)"),
      T("烙铁（可选，拆电机和开关的焊点）", "Soldering iron (optional, for the motor and switch joints)"),
    ],
    safety: [
      T("先拔掉 USB。", "Unplug the USB lead first."),
      T("带内置电池（可充电款）的风扇：按“单节 18650 充电宝”那份的电池步骤先处理电池。", "If your fan has a built-in battery (rechargeable model), follow the battery steps in the 18650 power bank guide first."),
      T("扇叶边缘可能有毛刺，拔扇叶时手不要握在叶片边上。", "Blade edges can be sharp. Do not grip the blade edges when pulling it off."),
    ],
    fig: [
      { id: "grille", x: 30, y: 10, w: 80, h: 80, c: "#dfe9ee", t: T("网罩", "Grille"), round: true },
      { id: "blade", x: 46, y: 26, w: 48, h: 48, c: "#f1efe9", t: T("扇叶", "Blade"), round: true },
      { id: "motor", x: 60, y: 40, w: 20, h: 20, c: "#b8bcc2", t: T("电机", "Motor") },
      { id: "base", x: 40, y: 96, w: 60, h: 24, c: "#26272a", t: T("底座", "Base") },
      { id: "switch", x: 62, y: 100, w: 16, h: 8, c: "#e2b524", t: T("开关", "Switch") },
      { id: "cable", x: 100, y: 108, w: 70, h: 5, c: "#5b6168", t: T("USB 线", "USB lead") },
    ],
    steps: [
      { t: T("拔线，看有没有电池", "Unplug and check for a battery"), d: T("拔掉 USB 线。底座上如果有充电口、电量灯，或者说明书写着“可充电”，里面就有电池。", "Unplug the USB lead. A charge port, a battery LED or 'rechargeable' on the box means there is a battery inside."), stop: T("停止点：有电池就先按充电宝那份处理电池。", "Stop point: if there is a battery, handle it first using the power bank guide."), fig: { hi: ["cable"] } },
      { t: T("取下前网罩", "Remove the front grille"), d: T("前网罩一般是卡扣或旋转锁住的：找边上的小卡扣用撬片按下，或者逆时针转一下再拿下。", "The front grille is usually held by clips or a twist lock. Press the small clips with a spudger, or turn it anticlockwise and lift it off."), fig: { hi: ["grille"], off: { grille: [-24, -4] } } },
      { t: T("拔下扇叶", "Pull off the blade"), d: T("扇叶是压在电机轴上的。捏住中心的轮毂，一边轻轻转一边竖直往外拔；有的中间有一颗小螺丝或卡帽，先拿掉。", "The blade is a press fit on the motor shaft. Hold the hub, twist gently and pull straight off. Some have a small screw or cap in the middle: remove it first."), warn: T("不要撬叶片，容易断。", "Do not lever on the blades: they snap."), fig: { hi: ["blade"], off: { grille: [-24, -4], blade: [60, -10] } } },
      { t: T("打开电机罩和底座", "Open the motor housing and base"), d: T("后网罩或电机罩的螺丝常常藏在贴纸、脚垫下面。拧下后分开，能看到电机、两根线连到底座里的开关。", "Screws for the back cover or motor housing are often hidden under stickers or feet. Remove them and separate the halves to reveal the motor, with two wires running to the switch in the base."), fig: { hi: ["motor", "base", "switch"], off: { grille: [-24, -4], blade: [60, -10] } } },
      { t: T("拆下电机和开关", "Remove the motor and switch"), d: T("拆焊或在靠近焊点处剪断线，记下哪根接电机哪一端（反接只会反转，不会坏）。开关一般是拨动或按压开关，串在 5 V 那根线上。", "Desolder, or cut the wires close to the joints, noting which wire went to which motor tab (reversing it only reverses the fan; it does no harm). The switch is usually a slide or push switch in series with the 5 V wire."), stop: T("停止点：还想用这台风扇就不要剪线。", "Stop point: do not cut wires if you want to keep using the fan."), fig: { hi: ["motor", "switch"], off: { grille: [-24, -4], blade: [60, -10], motor: [60, 30], switch: [-50, 0] } } },
      { t: T("整理模块，存进零件库", "Sort the modules and save them to the parts library"), d: T("得到：小直流电机（多数是 130 一类）、开关、USB 供电线、扇叶、网罩、底座。小电机拿来做小车、搅拌器都行，但要用 MOSFET 或电机驱动来带，不能直接接单片机引脚。", "You get a small DC motor (usually 130-size), a switch, the USB power lead, the blade, the grille and the base. The motor is handy for small cars or stirrers, but drive it through a MOSFET or motor driver, never straight from a microcontroller pin."), fig: { off: { grille: [-24, -4], blade: [60, -10], motor: [60, 30], switch: [-50, 0] } } },
    ],
    modules: [
      { key: "grille", part: "td-fan-grille", match: "approx", t: T("网罩", "Grille"), ex: { p: [0, 0, 1.2], d: [0, 0, 3.0], rx: Math.PI / 2 } },
      { key: "blade", part: "td-fan-blade", match: "approx", t: T("扇叶", "Blade"), ex: { p: [0, 0, 0.2], d: [0, 0, 1.6], rx: Math.PI / 2 } },
      { key: "motor", part: "p-motor-130", match: "similar", t: T("小直流电机（130 一类）", "Small DC motor (130-class)"), ex: { p: [0, -0.7, -1.8], d: [0, 0, -1.4], ry: Math.PI / 2 } },
      { key: "switch", part: "kc-sw_e-switch_eg1224_spdt_angled", match: "similar", t: T("开关（拨动）", "Switch (slide)"), ex: { p: [0, -4.6, 0], d: [-2.4, -0.4, 0] } },
      { key: "cable", part: "td-fan-usb-cable", match: "approx", t: T("USB-A 供电线", "USB-A power lead"), ex: { p: [2.0, -4.8, 0], d: [2.4, -0.6, 0] } },
    ],
    explode: true,
  },
];
export const DEVICE_BY_ID = Object.fromEntries(DEVICES.map((d) => [d.id, d]));
export function searchDevices(q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return DEVICES;
  return DEVICES.filter((d) => [d.name.zh, d.name.en, d.model, ...d.alias].some((x) => x.toLowerCase().includes(s)));
}
