import{a as e,c as t,n,o as r,r as i,s as a,t as o}from"./parts-CeMWIC77.js";var s={src:`Adafruit 2201 SG51R 页面：4.8 V 堵转 0.6 kgf·cm、0.1 s/60°、5 g；脉宽 0.75–2.25 ms 对应全行程（≈ 180°）`,stallAt48:.6,speed48:600,mass:.005,us0:750,us1:2250};function c(e){return e>0?e>=4.8?.6:e/4.8*.6:0}var l={src:`Adafruit 4654 MiniBoost（TPS61023）页面：输出 5.2 V；最大输出 800 mA@3 V、1100 mA@3.5 V、1400 mA@4 V；3.7 V 输入时 ≤ 500 mA 效率 88%、1 A 78%；EN 拉低 = 输出真断开；1.0 g`,vout:5.2,limit:[[2,.3],[2.5,.5],[3,.8],[3.5,1.1],[4,1.4]],mass:.001},u=e=>{let t=l.limit;if(e<=t[0][0])return e>=1.8?t[0][1]:0;for(let n=1;n<t.length;n++)if(e<=t[n][0]){let[r,i]=t[n-1],[a,o]=t[n];return i+(e-r)/(a-r)*(o-i)}return t.at(-1)[1]},d=e=>e<=.5?.88:e>=1?.78:.88-(e-.5)/.5*.1,f={src:`Adafruit 258 页面：3.7 V 1200 mAh、约 4.5 Wh、23 g、34 × 62 × 5 mm；保护板 3.0 V 左右切断；线材按 2 A 设计`,mah:1200,wh:4.44,mass:.023,cut:3},p={src:`Adafruit 5426 QT Py ESP32‑S3（无 PSRAM，8 MB Flash）：1.2 g；背面 BAT 焊盘 3–6 V；3.3 V 稳压最大 600 mA`,mass:.0012},m={src:`Adafruit 4410 Micro‑Lipo USB‑C：充电电流 100 / 500 mA 可选（板上跳线）；重量页面没写`,mass:.002,massEst:!0},h={src:`Adafruit 805 拨动开关：0.07 g；页面没写额定电流 → 只让它过小电流（QT Py + 两个 EN），舵机大电流不经过它`,mass:7e-5},g=[{pad:`A0`,gpio:18},{pad:`A1`,gpio:17},{pad:`A2`,gpio:9},{pad:`SDA`,gpio:7},{pad:`SCL`,gpio:6},{pad:`TX`,gpio:5},{pad:`RX`,gpio:16},{pad:`SCK`,gpio:36}],_={pad:`A3`,gpio:8,ratio:2,cut:3.55,resume:3.75,src:`100k / 100k 分压 → A3（GPIO8，ADC1_CH7）：4.2 V → 2.1 V（< 2.9 V 校准量程，乐鑫文档）。3.55 V 停运动、3.75 V 恢复是估算阈值：保护板 3.0 V 才切断，但 BAT 焊盘二极管 + 3.3 V LDO 让 QT Py 在电芯带载约 3.4 V 以下就会掉电复位（仿真里会反复重启），所以要提前停`},v=[{k:`SG51R × 8`,g:40,src:`V`},{k:`1200 mAh LiPo`,g:23,src:`V`},{k:`QT Py ESP32‑S3`,g:1.2,src:`V`},{k:`MiniBoost × 2`,g:2,src:`V`},{k:`拨动开关`,g:.07,src:`V`},{k:`USB‑C 充电板`,g:2,src:`E`},{k:`分压板 + 2 颗电容`,g:1.5,src:`E`},{k:`导线`,g:4,src:`E`},{k:`万向珠 × 3`,g:9,src:`E`},{k:`PLA 骨架`,g:22,src:`E`},{k:`PLA 触手 × 8`,g:12,src:`E`}],y=()=>v.reduce((e,t)=>e+t.g,0)/1e3,b={plateR:e.R,plateT:e.t,yawR:e.yawR,yawH:e.t+t.shaftTop,tip:o.tip,seg:o.seg,segR:.15,horn:[.5,.15,.25],hornAt:.5,armI:.15,comY:2,rg:4,stall:c,servoMass:s.mass},x={current:`SG51R 电流页面没写：把 MG90S 的估算模型按堵转扭矩比 0.6 / 1.8 = 1/3 缩小——保持 0.0033 A、运动 0.04 + 0.15·(速度/最高速) A、堵转 0.23 A（估算）`,qtpy:`QT Py + BLE 平均 0.08 A @3.7 V（估算；WiFi 发射峰值更高）`,armI:`SG51R 转子反射惯量 0.15 kg·cm²（MG90S 估算值 0.5 按体积缩小，估算）`,gap:`相邻触手：在 v10 触手的 2D 轮廓上扫遍 ±55°，夹角 < −35° 才碰（scripts/octo-test.mjs 里复算），软件限位 ±55° 内碰不到`},S={red:`#d23a2f`,black:`#1e1f22`,orange:`#e07a2b`,yellow:`#e0b322`,blue:`#2f6fd6`,green:`#2f8f4e`,white:`#f1efe9`,purple:`#8a4fbf`,brown:`#7a4a2a`},C=[{k:`none`,zh:`正常（按 md 接好）`},{k:`nognd`,zh:`没有共地：ESP32 插电脑 USB 供电，没接 GND 到 PCA9685`,md:`采购清单 · 故障表“舵机完全不动 / 抖动 → 没有共地”`},{k:`pwm200`,zh:`PWM 频率不是 50 Hz（固件里漏了设预分频，PCA9685 上电默认约 200 Hz）`,md:`采购清单 · 故障表“舵机完全不动 → PWM 频率不是 50Hz” / README §8`},{k:`vplus-esp`,zh:`舵机 V+ 从 ESP32 的 5V 脚取电（ESP32 插 USB）`,md:`采购清单 · 故障表“舵机一转板子就重启”`},{k:`servo360`,zh:`买成了 360° 连续旋转舵机（3 号触手）`,md:`采购清单 · 故障表“抖动、抽搐 → 买了 360° 舵机”`},{k:`mech`,zh:`摆幅太大 + 转弯：超出机械极限、相邻触手打架`,md:`采购清单 · 故障表“到位后一直咯咯响 → 超出机械极限”`},{k:`phase0`,zh:`步态参数不对：phase = 0（八条同步，原地抽动）`,md:`采购清单 · 故障表“八个不同步 → 步态参数问题” / octopus_gait.h 注释`},{k:`i2caddr`,zh:`只有部分通道有反应：第二块 PCA9685 地址冲突（方案 C 才有两块，这里只说明）`,md:`采购清单 · 故障表“只有部分通道有反应”`,textOnly:!0},{k:`u1unset`,zh:`6 V 降压模块没先调压就接舵机（补充，md 没写）`,md:`补充：XL4015 出厂输出电压不确定`},{k:`lowbat`,zh:`电池快没电（md：6.3 V，低于 6.4 V 截止线；完善版：3S 9.4 V，低于 9.6 V）`,md:`无线架构 §6 · 低于 6.4V 停运动；完善版阈值为我的补充（估算）`}],w=[{k:0,zh:`阶段 0：先只跑通小智语音（不接舵机）`,md:`README §7 阶段 0（半天）`,roles:[`ESP`,`MIC`,`AMP`,`SPK`,`OLED`]},{k:1,zh:`阶段 1：1 个舵机 + 最小 MCP 工具`,md:`README §7 阶段 1（半天）；舵机接哪个脚文档未写，这里接 PCA9685 通道 0`,servos:1},{k:2,zh:`阶段 2：PCA9685 + 独立电源，4 个舵机`,md:`README §7 阶段 2（1 天）`,servos:4},{k:3,zh:`阶段 3：打印组装，整只八爪鱼上台`,md:`README §7 阶段 3（2–3 天）`,robot:!0},{k:4,zh:`阶段 4：调 CPG 步态（freq 0.6 / yaw 38 / duty 0.65 / phase 45 起步）`,md:`README §7 阶段 4`,robot:!0,tune:!0},{k:5,zh:`阶段 5：升级（总线舵机 / IMU）——只有文字，台面不做`,md:`README §7 阶段 5`,robot:!0,textOnly:!0}],T=(e,t,n,r,i,a)=>({a:e,b:t,kind:n,color:S[r]||r,why:i,md:a}),E=[{k:`md`,zh:`md 原样`,tip:`完全按 md 的接线、代码和数值（错的也照搬，方便对照）`},{k:`plus`,zh:`完善版（我的补充）`,tip:`按数据手册和推理补齐 md 没写清楚 / 写错的地方，每一处都标“我的补充”`},{k:`v10`,zh:`v10 紧凑无线版（我的补充）`,tip:`全部板载：1S 1200 mAh 电池 + QT Py ESP32‑S3 直接出 8 路 PWM + 2 个 5.2 V 升压 + 8 个 SG51R 小舵机；不插电，手机走 BLE`}],D=`我的补充`;function O({plan:e=`A`,phase:t=3,fault:n=`none`,variant:r=`md`}={}){if(r===`v10`)return A({fault:n});let i=r===`plus`,a=w.find(e=>e.k===t)||w[3],o=a.robot?8:a.servos||0,s=a.roles?[...a.roles]:[`ESP`,`MIC`,`AMP`,`SPK`,`OLED`,`PCA`,`BAT`,`U1`,`U2`,...i?[`DIV`]:[]],c=[],l=t===0||n===`nognd`||n===`vplus-esp`;c.push(T([`ESP`,`J1.5`],[`MIC`,`SCK`],`octo-dupont-20`,`yellow`,`GPIO5 → INMP441 SCK`,`README §4`),T([`ESP`,`J1.4`],[`MIC`,`WS`],`octo-dupont-20`,`green`,`GPIO4 → INMP441 WS`,`README §4`),T([`ESP`,`J1.6`],[`MIC`,`SD`],`octo-dupont-20`,`blue`,`GPIO6 → INMP441 SD`,`README §4`),T([`ESP`,`J1.2`],[`MIC`,`VDD`],`octo-dupont-20`,`orange`,`3V3 → INMP441 VDD`,`文档未写（数据手册 1.62–3.63 V）`),T([`ESP`,`J3.21`],[`MIC`,`GND`],`octo-dupont-20`,`black`,`GND → INMP441 GND`,`文档未写`),T([`ESP`,`J3.22`],[`MIC`,`L/R`],`octo-dupont-20`,`black`,`L/R 接 GND = 左声道`,`文档未写（数据手册）`),T([`ESP`,`J1.8`],[`AMP`,`BCLK`],`octo-dupont-20`,`yellow`,`GPIO15 → MAX98357A BCLK`,`README §4`),T([`ESP`,`J1.9`],[`AMP`,`LRC`],`octo-dupont-20`,`green`,`GPIO16 → MAX98357A LRC`,`README §4`),T([`ESP`,`J1.7`],[`AMP`,`DIN`],`octo-dupont-20`,`blue`,`GPIO7 → MAX98357A DIN`,`README §4`),T([`AMP`,`SPK+`],[`SPK`,`+`],`octo-dupont-20`,`red`,`功放 + → 喇叭 +`,`README §3`),T([`AMP`,`SPK-`],[`SPK`,`-`],`octo-dupont-20`,`black`,`功放 − → 喇叭 −`,`README §3`)),t===0?(c.push(T([`ESP`,`J1.21`],[`AMP`,`Vin`],`octo-dupont-20`,`red`,`5V（USB）→ 功放 Vin`,`文档未写`),T([`ESP`,`J1.22`],[`AMP`,`GND`],`octo-dupont-20`,`black`,`GND → 功放 GND`,`文档未写`)),c.push(T([`ESP`,`J1.1`],[`OLED`,`VCC`],`octo-dupont-20`,`orange`,`3V3 → OLED VCC`,`文档未写`),T([`ESP`,`J3.1`],[`OLED`,`GND`],`octo-dupont-20`,`black`,`GND → OLED GND`,`文档未写`),T([`ESP`,`J1.12`],[`OLED`,`SDA`],`octo-dupont-20`,`blue`,`GPIO8 → OLED SDA`,`README §4`),T([`ESP`,`J1.15`],[`OLED`,`SCL`],`octo-dupont-20`,`yellow`,`GPIO9 → OLED SCL`,`README §4`))):(c.push(T([`U2`,`OUT+`],[`AMP`,`Vin`],`octo-dupont-20`,`red`,`5V → 功放 Vin`,`文档未写`),T([`U2`,`OUT-`],[`AMP`,`GND`],`octo-dupont-20`,`black`,`GND → 功放 GND`,`文档未写`),T([`ESP`,`J1.12`],[`PCA`,`L.SDA`],`octo-dupont-30`,`blue`,`GPIO8 → PCA9685 SDA`,`README §4 / .ino I2C_SDA 8`),T([`ESP`,`J1.15`],[`PCA`,`L.SCL`],`octo-dupont-30`,`yellow`,`GPIO9 → PCA9685 SCL`,`README §4 / .ino I2C_SCL 9`),T([`ESP`,`J1.1`],[`PCA`,`L.VCC`],`octo-dupont-30`,`orange`,`3V3 → PCA9685 VCC（逻辑）`,`README §4`),T([`PCA`,`R.VCC`],[`OLED`,`VCC`],`octo-dupont-20`,`orange`,`3V3（经 PCA 排针）→ OLED VCC`,`文档未写`),T([`PCA`,`R.GND`],[`OLED`,`GND`],`octo-dupont-20`,`black`,`GND → OLED GND`,`文档未写`),T([`PCA`,`R.SDA`],[`OLED`,`SDA`],`octo-dupont-20`,`blue`,`SDA 同一条 I2C → OLED`,`README §4`),T([`PCA`,`R.SCL`],[`OLED`,`SCL`],`octo-dupont-20`,`yellow`,`SCL 同一条 I2C → OLED`,`README §4`),T([`BAT`,`BAT+`],[`U1`,`IN+`],`octo-wire`,`red`,`电池 + → 6 V 降压 IN+`,`README §4`),T([`BAT`,`BAT-`],[`U1`,`IN-`],`octo-wire`,`black`,`电池 − → 6 V 降压 IN−`,`README §4`),T([`BAT`,`BAT+`],[`U2`,`IN+`],`octo-wire`,`red`,`电池 + → 5 V 降压 IN+`,`补充（md 只写一块 XL4015 同时出 6 V 和 5 V，单块做不到）`),T([`BAT`,`BAT-`],[`U2`,`IN-`],`octo-wire`,`black`,`电池 − → 5 V 降压 IN−`,`补充`)),n===`vplus-esp`?c.push(T([`ESP`,`J1.21`],[`PCA`,`T.V+`],`octo-dupont-30`,`red`,`（故障）ESP32 5V → PCA9685 V+`,`反例`),T([`ESP`,`J1.22`],[`PCA`,`T.GND`],`octo-dupont-30`,`black`,`（故障）ESP32 GND → PCA9685 GND 端子`,`反例`)):c.push(T([`U1`,`OUT+`],[`PCA`,`T.V+`],`octo-wire`,`red`,`6 V → PCA9685 V+ 螺丝端子`,`README §4`),T([`U1`,`OUT-`],[`PCA`,`T.GND`],`octo-wire`,`black`,`GND → PCA9685 GND 端子`,`README §4`)),l||c.push(T([`U2`,`OUT+`],[`ESP`,`J1.21`],`octo-wire`,`red`,`5 V → ESP32 5V 脚`,`README §4（md 写 VIN/5V；DevKitC‑1 丝印是 5V）`),T([`U2`,`OUT-`],[`ESP`,`J1.22`],`octo-wire`,`black`,`GND → ESP32 GND（共地）`,`README §4`)),n!==`nognd`&&c.push(T([`ESP`,`J3.1`],[`PCA`,`L.GND`],`octo-dupont-30`,`black`,`GND → PCA9685 GND（逻辑地，共地）`,`README §4`)),i&&c.push(T([`BAT`,`BAT+`],[`DIV`,`IN`],`octo-dupont-20`,`red`,`电池 + → 分压板 IN（100k 上臂）`,`${D} · 替代 md 的 GPIO4 电池检测`),T([`BAT`,`BAT-`],[`DIV`,`GND`],`octo-dupont-20`,`black`,`电池 − → 分压板 GND（22k 下臂）`,D),T([`DIV`,`OUT`],[`ESP`,`J1.16`],`octo-dupont-20`,`purple`,`分压 OUT → GPIO10（ADC1_CH9）`,`${D} · GPIO4 已给麦克风 WS，GPIO1/2 留给采购清单第二批 I2C`)));let u=[],d=e===`B`&&a.robot?2:1;for(let e=0;e<o;e++)for(let t=0;t<d;t++){let r=d===2?e*2+t:e,i=d===2?`S${e}${t?`p`:`y`}`:`S${e}`;u.push({role:i,arm:e,slot:t,ch:`CH${r}`,type:n===`servo360`&&e===3&&t===0?`360`:`180`}),c.push({a:[i,`LEAD`],b:[`PCA`,`CH${r}`],kind:`octo-servo`,color:S.brown,why:`${i} 舵机引线 → PCA9685 通道 ${r}`,md:d===2?`octopus_body.h · ChannelOf(kDual16) = arm×2+slot`:`octopus_body.h · ChannelOf(kSingle8) = arm`})}let f=n===`lowbat`;return{plan:e,phase:t,fault:n,variant:r,ph:a,roles:s,wires:c,servos:u,usb:l,defs:i?{BAT:`p-octo-3s-pack`}:{},plusHw:i&&e===`A`&&a.robot?{casters:!0,pads:!0,tipShare:.3}:{},vbat:i?f?9.4:11.1:f?6.3:7.4,caps:a.robot?u.length:0,u1Unset:n===`u1unset`,robot:!!a.robot}}var k=[{k:`none`,zh:`正常（按 v10 接线）`},{k:`nognd`,zh:`QT Py 的 GND 没接到电池 / 升压地`},{k:`lowbat`,zh:`电池快没电（空载 3.55 V，带载低于 3.55 V 停运动阈值，估算）`},{k:`swoff`,zh:`电源开关拨到 OFF（EN 拉低，升压和 QT Py 都断电）`},{k:`onebst`,zh:`只装一个升压，8 个舵机全挂在它上面`}];function A({fault:e=`none`}={}){let t=`我的补充 · v10`,n=[`QTPY`,`BAT`,`CHG`,`BST1`,`BST2`,`SW`,`DIV`,`CAP1`,`CAP2`],r=[],i=e===`onebst`;r.push(T([`BAT`,`BAT+`],[`CHG`,`JST+`],`octo-jst`,`red`,`LiPo JST‑PH 插进充电板的电池座`,`Adafruit 4410：JST‑PH 电池座 + BAT 焊盘`),T([`BAT`,`BAT-`],[`CHG`,`JST-`],`octo-jst`,`black`,`（同一根 JST 线的黑线）`,`Adafruit 258：JST‑PH 2 针`),T([`CHG`,`BAT`],[`BST1`,`IN`],`octo-v10-power`,`red`,`充电板 BAT 焊盘 → 升压 1 IN（舵机大电流不过开关）`,t),T([`CHG`,`GND`],[`BST1`,`GND`],`octo-v10-power`,`black`,`GND → 升压 1 GND`,t),T([`CHG`,`BAT`],[`SW`,`1`],`octo-v10-wire`,`red`,`BAT → 开关 1 脚`,t),T([`CHG`,`GND`],[`SW`,`3`],`octo-v10-wire`,`black`,`GND → 开关 3 脚（拨到这边 = EN 接地 = 关）`,t),T([`SW`,`COM`],[`BST1`,`EN`],`octo-v10-wire`,`orange`,`开关 COM → 升压 1 EN`,`Adafruit 4654：EN 拉低 = 输出真断开`),T([`SW`,`COM`],[`QTPY`,`BAT`],`octo-v10-wire`,`orange`,`开关 COM → QT Py 背面 BAT 焊盘（3–6 V，带二极管）`,`Adafruit 5426：BAT 焊盘`),T([`SW`,`COM`],[`DIV`,`IN`],`octo-v10-wire`,`orange`,`开关 COM → 分压 IN`,t),T([`DIV`,`GND`],[`CHG`,`GND`],`octo-v10-wire`,`black`,`分压 GND`,t),T([`DIV`,`OUT`],[`QTPY`,`A3`],`octo-v10-wire`,`purple`,`分压 OUT → A3（GPIO8）电池检测`,t),T([`BST1`,`OUT`],[`CAP1`,`+`],`octo-v10-wire`,`red`,`升压 1 OUT → 电容 +`,`${t} · 电容值估算`),T([`BST1`,`GND`],[`CAP1`,`-`],`octo-v10-wire`,`black`,`电容 −`,t)),e!==`nognd`&&r.push(T([`QTPY`,`BGND`],[`CHG`,`GND`],`octo-v10-wire`,`black`,`QT Py BAT 旁的 GND 焊盘 → 电池地（共地）`,t)),i||r.push(T([`CHG`,`BAT`],[`BST2`,`IN`],`octo-v10-power`,`red`,`充电板 BAT 焊盘 → 升压 2 IN`,t),T([`CHG`,`GND`],[`BST2`,`GND`],`octo-v10-power`,`black`,`GND → 升压 2 GND`,t),T([`SW`,`COM`],[`BST2`,`EN`],`octo-v10-wire`,`orange`,`开关 COM → 升压 2 EN`,t),T([`BST2`,`OUT`],[`CAP2`,`+`],`octo-v10-wire`,`red`,`升压 2 OUT → 电容 +`,t),T([`BST2`,`GND`],[`CAP2`,`-`],`octo-v10-wire`,`black`,`电容 −`,t));let a=[];for(let e=0;e<8;e++){let n=`S${e}`,o=i||e<4?`BST1`:`BST2`,s=g[e];a.push({role:n,arm:e,slot:0,ch:`CH${e}`,type:`sg51r`,pad:s.pad,gpio:s.gpio,rail:o}),r.push({a:[n,`LEAD`],b:[`QTPY`,s.pad],kind:`octo-v10-servo`,rail:o,color:S.brown,why:`${n}：橙 PWM → QT Py ${s.pad}（GPIO${s.gpio}，LEDC 通道 ${e}）；红 V+ / 棕 GND → ${o}`,md:t})}return{plan:`A`,phase:3,fault:e,variant:`v10`,ph:w[3],roles:n,wires:r,servos:a,usb:!1,defs:{BAT:`ada-258`,DIV:`p-octo-vdiv-1s`,QTPY:`ada-5426`,CHG:`ada-4410`,BST1:`ada-4654`,BST2:`ada-4654`,SW:`ada-805`,CAP1:`kc-cp_radial_d6.3mm_p2.50mm`,CAP2:`kc-cp_radial_d6.3mm_p2.50mm`},plusHw:{casters:!0,pads:!0,tipShare:.3},vbat:e===`lowbat`?3.55:3.85,swOn:e!==`swoff`,caps:2,u1Unset:!1,robot:!0,board:`v10`}}var j={ESP:`p-octo-devkitc1`,PCA:`ada-815`,MIC:`p-octo-inmp441`,AMP:`ada-3006`,SPK:`ada-3923`,BAT:`p-octo-2s-lipo`,U1:`p-octo-xl4015-6v`,U2:`p-octo-xl4015-5v`,OLED:`p-octo-oled096`,DIV:`p-octo-vdiv`},M=Object.fromEntries(a.map(e=>[e.id,e])),N=(e,t)=>{let n=t?.defs?.[e]||j[e];return M[n]?.octo||r[n]||{pins:{},ties:[]}},P=class{constructor(){this.p=new Map}f(e){this.p.has(e)||this.p.set(e,e);let t=e;for(;this.p.get(t)!==t;)t=this.p.get(t);return this.p.set(e,t),t}u(e,t){this.p.set(this.f(e),this.f(t))}},F=e=>{if(e.kind===`octo-servo`){let[t]=e.a,n=e.b[1];return[[`${t}:GND`,`PCA:${n}.GND`],[`${t}:V+`,`PCA:${n}.V+`],[`${t}:PWM`,`PCA:${n}.PWM`]]}if(e.kind===`octo-v10-servo`){let[t]=e.a,n=e.b[1],r=e.rail;return[[`${t}:GND`,`${r}:GND`],[`${t}:V+`,`${r}:OUT`],[`${t}:PWM`,`QTPY:${n}`]]}return[[`${e.a[0]}:${e.a[1]}`,`${e.b[0]}:${e.b[1]}`]]};function I(e){if(e._uf)return e._uf;let t=new P;Object.defineProperty(e,"_uf",{value:t,enumerable:!1});let n=e.board===`v10`?e.roles:Object.keys(j);e.board===`v10`&&t.u(`SW:COM`,e.swOn?`SW:1`:`SW:3`);for(let r of n)for(let n of N(r,e).ties)for(let e=1;e<n.length;e++)t.u(`${r}:${n[0]}`,`${r}:${n[e]}`);for(let n of e.wires)for(let[e,r]of F(n))t.u(e,r);return e.usb&&t.u(`USB:GND`,`USB:GND`),t}var ee=.12,te=.02,ne=.0014,re=.003;function L(e,t={}){if(e.board===`v10`)return R(e,t);let n=I(e),r=(e,t)=>n.f(e)===n.f(t),i=t.servoI||0,a={checks:[],rails:{},warn:[]},o=e.vbat??7.4,s=r(`U1:IN+`,`BAT:BAT+`)&&r(`U1:IN-`,`BAT:BAT-`),c=r(`U2:IN+`,`BAT:BAT+`)&&r(`U2:IN-`,`BAT:BAT-`),l=t=>e.roles.includes(t),u=!!e.usb,d=l(`U2`)&&c&&r(`ESP:J1.21`,`U2:OUT+`);r(`ESP:J1.22`,`U2:OUT-`);let f=l(`U1`)&&s&&r(`PCA:T.V+`,`U1:OUT+`),p=l(`PCA`)&&r(`PCA:T.V+`,`ESP:J1.21`),m=e.variant===`plus`,h=m?o<9.8?.45:.15:e.vbat<6.6?.5:.12,g=e.u1Unset?null:6,_=0,v=0,y=0,b=(ee+(l(`OLED`)?te:0)+(l(`MIC`)?ne:0))*5+(l(`AMP`)?re*5:0);f&&(y+=i*6/.9),d&&(y+=b/.88),y/=Math.max(5.5,o);let x=o-y*h,S=.8;f&&(v=Math.min(g??x-S,x-S-i*.05)),d&&(_=Math.min(5,x-S)),u&&(_=Math.max(_,5-(p?i*1.4:0)-.05)),p&&(v=_-.3);let C=_>=4.3,w=r(`ESP:J3.1`,`PCA:L.GND`)||r(`ESP:J1.22`,`BAT:BAT-`)&&r(`PCA:T.GND`,`BAT:BAT-`),T=r(`PCA:L.VCC`,`ESP:J1.1`),E=C&&T&&(w||p&&u),D={sda:r(`PCA:L.SDA`,`ESP:J1.12`),scl:r(`PCA:L.SCL`,`ESP:J1.15`)},O=l(`DIV`)&&r(`DIV:IN`,`BAT:BAT+`)&&r(`DIV:GND`,`BAT:BAT-`)&&r(`DIV:OUT`,`ESP:J1.16`)&&r(`BAT:BAT-`,`ESP:J1.22`);a.rails={battSense:O,vbat:l(`BAT`)?+x.toFixed(2):null,vservo:+v.toFixed(2),espIn:+_.toFixed(2),v33:C?3.3:0,iBat:+y.toFixed(2),servoI:+i.toFixed(2),espOn:C,pcaLogic:E,gndCommon:w,i2cWired:D.sda&&D.scl,vpFromEsp:p,vpFromU1:f};let k=(e,t,n,r=`err`)=>a.checks.push({ok:!!e,zh:t,md:n,level:e?`ok`:r});return l(`PCA`)&&(k(w,`共地：ESP32 的 GND 和 PCA9685 / 电池 GND 连在一起`,`README §4 三条铁律 · 共地`),k(!p,`舵机 V+ 不从 ESP32 取电（走 PCA9685 的 V+ 螺丝端子）`,`README §4 三条铁律 · V+ 绝不从 ESP32 取`),k(T,`PCA9685 VCC 接 ESP32 3V3（逻辑电源）`,`README §4 接线表 · 3V3/GND → PCA VCC`),k(D.sda&&D.scl,`I2C：GPIO8 → SDA，GPIO9 → SCL`,`README §4 接线表 / body_firmware_A.ino #define I2C_SDA 8`),k(f,`V+ 端子 ← XL4015 调到 6 V`,`README §4 供电 · 7.4V → XL4015 → 6V`)),l(`MIC`)&&(k(r(`MIC:SCK`,`ESP:J1.5`)&&r(`MIC:WS`,`ESP:J1.4`)&&r(`MIC:SD`,`ESP:J1.6`),`麦克风 INMP441：SCK=GPIO5，WS=GPIO4，SD=GPIO6`,`README §4 接线表`),k(r(`MIC:L/R`,`ESP:J3.1`),`INMP441 L/R 接 GND（选左声道）`,`文档未写（按 INMP441 数据手册补）`,`warn`),k(r(`MIC:VDD`,`ESP:J1.1`),`INMP441 VDD 接 3V3`,`文档未写（数据手册 1.62–3.63 V）`,`warn`)),l(`AMP`)&&(k(r(`AMP:BCLK`,`ESP:J1.8`)&&r(`AMP:LRC`,`ESP:J1.9`)&&r(`AMP:DIN`,`ESP:J1.7`),`功放 MAX98357A：BCLK=GPIO15，LRC=GPIO16，DIN=GPIO7`,`README §4 接线表`),k(r(`AMP:SPK+`,`SPK:+`)&&r(`AMP:SPK-`,`SPK:-`),`喇叭接功放输出`,`README §3 物料（8Ω 2W 喇叭）`)),l(`SPK`)&&l(`MIC`)&&t.micSpkCm!=null&&k(t.micSpkCm>=5,`麦克风离喇叭 ${t.micSpkCm.toFixed(1)} cm（≥ 5 cm）`,`README §8 · 麦克风和喇叭至少隔 5 cm`),l(`OLED`)&&k(r(`OLED:SDA`,`PCA:L.SDA`)&&r(`OLED:SCL`,`PCA:L.SCL`),`OLED 和 PCA9685 共用 I2C（0x3C / 0x40 不冲突）`,`README §4 · 屏幕同一条 I2C`),l(`BAT`)&&(m?k(o>=8,`XL4015 输入 ${o.toFixed(1)} V（3S，截止 9.6 V 也高于数据手册下限 8 V）`,`我的补充 · XLSEMI XL4015 数据手册 8–36 V`,`warn`):k(o>=8,`XL4015 输入 ${o.toFixed(1)} V：数据手册下限 8 V，2S 电池大部分时间低于它`,`md 没提；XLSEMI XL4015 数据手册`,`warn`),m&&k(O,`电池检测：分压板 IN ← 电池 +、OUT → GPIO10（ADC1_CH9），12.6 V 时 2.27 V < 2.9 V 量程`,`我的补充 · 乐鑫 ESP32‑S3 ADC 文档（11 dB 校准量程 0–2900 mV）`,`warn`),k(!e.u1Unset,`6 V 那块降压先空载调好再接舵机`,`补充（md 没写调压步骤）`,`warn`),e.u1Unset&&a.warn.push(`U1 没调：输出接近输入（约 ${(x-S).toFixed(1)} V），超过 MG90S 标称 6.0 V`)),(e.servos||[]).forEach((t,n)=>{let r=t.ch;if(r==null)return;let i=e.plan===`B`?null:n;i!=null&&r!==`CH${i}`&&k(!1,`触手 ${n} 的舵机插在 ${r}，md 约定 ${i} 号触手 = 通道 ${i}`,`octopus_body.h · ChannelOf(kSingle8)`,`warn`)}),e.caps!=null&&l(`PCA`)&&k(e.caps>=(e.servos?.length||0),`每个舵机旁一颗 220µF（${e.caps} / ${e.servos?.length||0}）`,`README §4 三条铁律 · 每个舵机旁 220µF`,`warn`),i>5&&a.warn.push(`舵机电流 ${i.toFixed(1)} A 超过 XL4015 标称 5 A`),v>0&&v<4.6&&i>.3&&a.warn.push(`舵机电压掉到 ${v.toFixed(2)} V`),a.errCount=a.checks.filter(e=>e.level===`err`).length,a.warnCount=a.checks.filter(e=>e.level===`warn`).length+a.warn.length,a.same=r,a}var ie=.08;function R(e,t={}){let n=I(e),r=(e,t)=>n.f(e)===n.f(t),i={checks:[],rails:{},warn:[]},a=(e,t,n,r=`err`)=>i.checks.push({ok:!!e,zh:t,md:n,level:e?`ok`:r}),o=t.servoI||0,s=t.railI||null,c=e.vbat,f=c<3.6?.3:.15,p=r(`CHG:JST+`,`BAT:BAT+`)&&r(`CHG:JST-`,`BAT:BAT-`),m=e=>p&&r(`${e}:IN`,`BAT:BAT+`)&&r(`${e}:GND`,`BAT:BAT-`),h=r(`SW:COM`,`BAT:BAT+`),v=e=>r(`${e}:EN`,`BAT:BAT+`),y=[`BST1`,`BST2`].filter(t=>e.roles.includes(t)&&m(t)),b={};for(let t of e.servos)b[t.role]=[`BST1`,`BST2`].find(e=>r(`${t.role}:V+`,`${e}:OUT`)&&r(`${t.role}:GND`,`BAT:BAT-`))||null;let x={BST1:0,BST2:0};if(s)for(let t of e.servos){let e=b[t.role];e&&(x[e]+=s[t.role]||0)}else{let t=e.servos.length;for(let n of e.servos){let e=b[n.role];e&&(x[e]+=o/t)}}let S=h&&p&&r(`QTPY:BAT`,`BAT:BAT+`),C=c,w=0,T={};for(let e=0;e<3;e++){w=S?ie:0;for(let e of[`BST1`,`BST2`]){let t=y.includes(e)&&v(e),n=u(C),r=t?x[e]:0,i=t?r<=n?l.vout:l.vout*Math.max(0,n/r):0,a=r<=n?r:n;T[e]={on:t,v:i,I:r,lim:n,sat:t&&r>n},t&&(w+=i*a/d(a)/Math.max(2.5,C)+2e-4)}C=c-w*f}let E=S?C-.3:0,D=E>=3.1,O=r(`QTPY:BGND`,`BAT:BAT-`),k=r(`DIV:IN`,`SW:COM`)&&r(`DIV:GND`,`BAT:BAT-`)&&r(`DIV:OUT`,`QTPY:${_.pad}`),A={};for(let t of e.servos){let e=g.find(e=>r(`${t.role}:PWM`,`QTPY:${e.pad}`));A[t.role]=e&&O?e.gpio:null}let j=Object.fromEntries(e.servos.map(e=>[e.role,b[e.role]?T[b[e.role]].v:0])),M=Object.values(j),N=M.length?Math.min(...M):0;i.rails={battSense:k,vbat:+C.toFixed(3),vbatSw:h?+C.toFixed(3):0,vservo:+N.toFixed(2),vservoOf:j,espIn:+E.toFixed(2),v33:D?3.3:0,iBat:+w.toFixed(3),servoI:+o.toFixed(3),espOn:D,pcaLogic:D,gndCommon:O,i2cWired:!0,vpFromEsp:!1,vpFromU1:!1,boost:T,pwmGpio:A,swOn:h,usb:!1,pBat:+(w*C).toFixed(3)},a(p,`LiPo JST 插进充电板电池座`,`Adafruit 4410 / 258`),a(h,`电源开关拨到 ON（COM 接电池 +，两个升压 EN 拉高、QT Py 上电）`,`Adafruit 4654：EN 拉低 = 真断开`,`warn`),a(O,`共地：QT Py BAT 旁的 GND 焊盘接电池地（PWM 才有参考）`,`舵机 PWM 是相对 GND 的信号`),a(e.servos.every(e=>b[e.role]),`每个舵机红线 / 棕线接在升压 OUT / GND 上（不从 QT Py 取电）`,`我的补充 · QT Py 3.3 V 稳压 600 mA 峰值，带不动舵机`),a(e.servos.every(e=>A[e.role]!=null),`8 根橙线接 QT Py 的 8 个焊盘（A0 A1 A2 SDA SCL TX RX SCK）`,`ESP32‑S3 LEDC 8 个通道（乐鑫文档）`),a(k,`电池检测：开关后的电池 + → 100k/100k → A3（GPIO8）；4.2 V → 2.1 V < 2.9 V 量程`,_.src,`warn`);let P=e.servos.filter(e=>b[e.role]===`BST1`).length,F=e.servos.filter(e=>b[e.role]===`BST2`).length;a(P<=4&&F<=4,`两个升压各带 ≤ 4 个舵机（现在 ${P} + ${F}）`,`我的补充 · MiniBoost 3.7 V 输入时最大输出约 1.2 A（页面：1.1 A@3.5 V、1.4 A@4 V，插值）`,`warn`),a(!0,`工作时不插 USB：USB‑C 只用来充电（充电板 100 mA 默认 / 500 mA 跳线）`,`Adafruit 4410`),a(!1,`舵机电压 5.2 V 高于 SG51R 页面写的 4.8 V（页面没写最高电压；我没找到 5 V 以下的 1S 升压现成小板）`,`Adafruit 2201 / 4654 · 我的补充`,`warn`),a(!1,`拨动开关页面没写额定电流：这里只让它过 QT Py + EN 的小电流（< 0.2 A，估算），舵机电流不经过它`,`Adafruit 805`,`warn`);for(let e of[`BST1`,`BST2`])T[e]?.sat&&i.warn.push(`${e===`BST1`?`升压 1`:`升压 2`} 要 ${T[e].I.toFixed(2)} A，超过 ${C.toFixed(2)} V 输入时的上限 ${T[e].lim.toFixed(2)} A → 输出掉到 ${T[e].v.toFixed(2)} V`);return w>2&&i.warn.push(`电池电流 ${w.toFixed(2)} A 超过 LiPo 线材额定 2 A（Adafruit 258 页面）`),c<_.cut&&i.warn.push(`电池 ${c.toFixed(2)} V 低于 ${_.cut} V（估算阈值）：固件会停运动，请充电`),i.errCount=i.checks.filter(e=>e.level===`err`).length,i.warnCount=i.checks.filter(e=>e.level===`warn`).length+i.warn.length,i.same=r,i}var z=(e,t,n)=>e<t?t:e>n?n:e,B=(e,t)=>e%t,V=[{k:`rig8`,zh:`RigType 改成 kSingle8（方案 A 只有 8 个舵机；md 的 .ino 写的是 kDual16）`,md:`body_firmware_A.ino · setup()`},{k:`compile`,zh:`能在 ESP32‑S3 上编译：蓝牙串口换 BLE（S3 没有经典蓝牙，BluetoothSerial 用不了）；Pca9685 补默认构造（boards_[3] 需要）`,md:`body_firmware_A.ino 头部 / octopus_body.h`},{k:`gaitParse`,zh:`GAIT 指令：toUpperCase() 之后按大写的 F= / YAW= … 匹配（原样永远匹配不上，等于没调）`,md:`body_firmware_A.ino · setGait()`},{k:`lat`,zh:`左右舷判断用 cos(安装角)（原样 sin 区分的是前后，LEFT/RIGHT 转不了弯）`,md:`octopus_gait.h · Lateriality()`},{k:`softHome`,zh:`SoftHome 真的一路一路上电（原样第一次 Tick 就把所有通道一起写出去）`,md:`octopus_body.h · SoftHome() / octopus_bus.h · last_written_`},{k:`pulse`,zh:`脉宽按 MG90S 常见 0.5–2.5 ms 标定：SetPulseRange(102, 512)（原样 150–600 = 0.73–2.93 ms，中位 1.83 ms）`,md:`octopus_bus.h · Pca9685 构造参数`},{k:`single8`,zh:`kSingle8 下 wave / pulse 改用偏航舵机（原样只写 lift，8 舵机版本挥手 / 脉冲没有动作）`,md:`octopus_body.h · WriteArm()`},{k:`rest`,zh:`Rest 交给运动任务按限速回中位、并停步态（原样在 loop 里连 Tick 20 次，瞬间跳回 90°，还和运动任务抢 bank_）`,md:`octopus_body.h · ReleaseHard()`},{k:`home`,zh:`HOME / MCP home 先停步态再 SoftHome（原样 HOME 时步态还在跑；MCP 的 home 实际调的是 Rest）`,md:`body_firmware_A.ino · handleCommand() / octopus_mcp.cpp`},{k:`steps`,zh:`MCP crawl 的 steps 生效：走够步数自动停（原样 steps 被忽略，一直走到 15 s 超时）`,md:`octopus_mcp.cpp · crawl`},{k:`limit`,zh:`每路加软件限位 90°±55°，相邻触手不打架（md 第 8 节建议 SetTrim / SetLimit，但代码里没调用）`,md:`README §8 / octopus_bus.h · SetLimit()`},{k:`gait2`,plus:!0,zh:`我的补充 · 镜像步态：左右两舷反向扫（cos(安装角) 加权），直行时转矩抵消；A 靠单向脚垫、差速转弯；B 默认 phase 180 交替步态 + 支撑相下压 20°（v9 物理实测：v8 的 phase 0 触手尖只悬空 1.2 mm、走 0 cm），原地转时八条同向扫`,md:`octopus_gait.h · Yaw()（md 的 CPG 八条同向扫，台面里 B 原地转、A 只蹭）`},{k:`antiCollide`,plus:!0,zh:`我的补充 · 邻臂防撞软限位：每帧检查相邻两条的夹角，小于机械间隙（A 12°、B 16°；B 为 v8 在 3D 碰撞体上实测 13° + 余量）+3° 余量就两边各退一半`,md:`md 无（README §8 只说“相邻触手打架”）`},{k:`speed`,plus:!0,zh:`我的补充 · MCP speed 夹到 ≥ 834 ms/周期（≤ 1.2 Hz，md 自己写的舵机跟得上的上限）`,md:`octopus_mcp.cpp · hz = 1000 / speed`},{k:`batt`,plus:!0,zh:`我的补充 · 电池检测改到 GPIO10（ADC1_CH9，避开麦克风 WS 的 GPIO4 和采购清单第二批 I2C 的 GPIO1/2），100k/22k 分压，3S 低于 9.6 V 停运动、回到 10.2 V 才恢复（估算阈值）`,md:`body_firmware_A.ino BATTERY_PIN 4 / 无线架构 §6`},{k:`relax`,plus:!0,zh:`我的补充 · Rest 回到中位 1 s 后把 PWM 设成 FULL OFF（舵机不再出力、不再耗电），下次动作前重新写出`,md:`octopus_body.h · Rest()（原样舵机一直出力）`},{k:`pcaWake`,plus:!0,zh:`我的补充 · PCA9685 退出 SLEEP 后等 500 µs 再写 RESTART（NXP 数据手册：振荡器最长 500 µs 稳定）。仿真不模拟时序，只在固件里改`,md:`octopus_bus.h · Pca9685::Init()`}],H=e=>Object.fromEntries(V.map(t=>[t.k,!!e&&!t.plus])),U=()=>Object.fromEntries(V.map(e=>[e.k,!0])),W=e=>e===`B`?{freq_hz:.6,yaw_amp_deg:20,lift_amp_deg:25,phase_deg:180,duty:.55,press_deg:20}:{freq_hz:.6,yaw_amp_deg:30,lift_amp_deg:20,phase_deg:45,duty:.6},G={A:12,B:16,v10:-30},K=class{constructor(e,t=750,n=2250){this.pins=e,this.us0=t,this.us1=n,this.write_=null}Init(e,t){this.rt=t;for(let e of this.pins)if(!t.ledcAttach(e,50,14))return!1;return!0}Duty(e){return Math.round(e/2e4*16383)}SetAngle(e,t){let n=z(t,0,180);return this.rt.ledcWrite(this.pins[e],this.Duty(this.us0+(this.us1-this.us0)*n/180))}SetRaw(e,t,n){return this.rt.ledcWrite(this.pins[e],n&4096?0:this.Duty((n-t)/4096*2e4))}},q=()=>({freq_hz:.6,yaw_amp_deg:38,lift_amp_deg:20,phase_deg:45,duty:.65}),J=class e{constructor(e){this.F=e,this.params_=q(),this.phase_=0,this.steer_=0,this.throttle_=1,this.spinTurn=!1}SetParams(e){this.params_={...e}}Params(){return this.params_}Tick(e){for(this.phase_+=e*this.params_.freq_hz*360;this.phase_>=360;)this.phase_-=360;for(;this.phase_<0;)this.phase_+=360}Reset(){this.phase_=0}SetSteer(e){this.steer_=z(e,-1,1)}SetThrottle(e){this.throttle_=z(e,0,1)}Phase01(e){let t=B(this.phase_+this.params_.phase_deg*e,360)/360;return t<0?t+1:t}Yaw(e){let t=this.Phase01(e),n=z(this.params_.duty,.05,.95),r=t<n?1-t/n*2:-1+2*((t-n)/(1-n));return this.F.gait2?r*this.params_.yaw_amp_deg*this.Sweep(e)*this.throttle_:r*this.params_.yaw_amp_deg*this.Gain(e)*this.throttle_}Sweep(t){let n=Math.cos(e.MountAngle(t)*Math.PI/180),r=this.steer_;return this.spinTurn?z((1-Math.abs(r))*n-r,-1,1):z(n*(1-r*Math.sign(n)),-1,1)}Lift(e){let t=this.Phase01(e),n=z(this.params_.duty,.05,.95),r=this.params_.press_deg||0;return t<n?-r:-r+Math.sin((t-n)/(1-n)*Math.PI)*(this.params_.lift_amp_deg+r)}IsPowerStroke(e){return this.Phase01(e)<this.params_.duty}static MountAngle(e){return-90+e*45}Lateriality(t){let n=e.MountAngle(t)*Math.PI/180;return this.F.lat?Math.cos(n):Math.sin(n)}Gain(e){return 1+this.steer_*this.Lateriality(e)*.85}},Y=class{constructor(e,t=150,n=600){this.addr_=e,this.pulse_min_=t,this.pulse_max_=n,this.write_=null}SetPulseRange(e,t){this.pulse_min_=e,this.pulse_max_=t}AngleToPulse(e){let t=z(e,0,180);return Math.trunc(this.pulse_min_+(this.pulse_max_-this.pulse_min_)*(t/180))&65535}Init(e,t,n=50,r=!1){if(this.write_=t,!t||!this.Write(0,[128])||!this.Write(0,[48]))return!1;let i=Math.trunc(25e6/(4096*n)+.5);return i=z(i,3,255),!(!r&&!this.Write(254,[i-1])||!this.Write(0,[32])||!this.Write(1,[4]))}SetRaw(e,t,n){return this.Write(6+4*e,[t&255,t>>8,n&255,n>>8])}SetAngle(e,t){return this.SetRaw(e,0,this.AngleToPulse(t))}Write(e,t){return this.write_(this.addr_,e,t)===0}},ae=class{constructor(){this.boards_=null,this.board_count_=0,this.channels_=0,this.max_rate_=360;let e=()=>Array(48).fill(0);this.trim_=e(),this.lo_=e(),this.hi_=e(),this.target_=e(),this.present_=e(),this.last_written_=e()}Bind(e,t){this.boards_=e,this.board_count_=t}Begin(e,t=90){this.channels_=e;for(let e=0;e<48;e++)this.target_[e]=t,this.present_[e]=t,this.trim_[e]=0,this.lo_[e]=0,this.hi_[e]=180;return!0}SetTrim(e,t){this.Valid(e)&&(this.trim_[e]=t)}SetLimit(e,t,n){this.Valid(e)&&(this.lo_[e]=t,this.hi_[e]=n)}SetTarget(e,t){if(!this.Valid(e))return;let n=t+this.trim_[e];n=z(n,this.lo_[e],this.hi_[e]),this.target_[e]=n}SetMaxRate(e){this.max_rate_=e}Tick(e){if(!this.boards_)return;let t=this.max_rate_*e;for(let e=0;e<this.channels_;e++){let n=this.target_[e]-this.present_[e];Math.abs(n)<=t?this.present_[e]=this.target_[e]:this.present_[e]+=n>0?t:-t,Math.abs(this.present_[e]-this.last_written_[e])>=.35&&(this.WriteChannel(e,this.present_[e]),this.last_written_[e]=this.present_[e])}}ReleaseAll(){for(let e=0;e<this.channels_;e++)this.target_[e]=90+this.trim_[e]}Present(e){return this.Valid(e)?this.present_[e]:0}Valid(e){return e>=0&&e<this.channels_}WriteChannel(e,t){let n=Math.floor(e/16),r=e%16;n>=this.board_count_||this.boards_[n].SetAngle(r,t)}},X={kSingle8:`kSingle8`,kDual16:`kDual16`},oe=e=>e===`kDual16`?16:8,Z=(e,t,n)=>e===`kDual16`?t*2+n:t,Q=class{constructor(e){this.rt=e,this.F=e.F,this.rig_=`kDual16`,this.channels_=16,this.boards_=[],this.bank_=new ae,this.gait_=new J(e.F),this.mode_=`idle`,this.running_=!1,this.wave_arm_=0,this.wave_timer_=0,this.pulse_left_=0,this.pulse_period_=.6,this.pulse_timer_=0,this.crawlCycles=null}Init(e,t){this.rig_=e,this.channels_=oe(e);let n=Math.ceil(this.channels_/16);if(this.rt.board===`v10`){if(this.boards_[0]=new K(this.rt.servoPins),!this.boards_[0].Init(null,this.rt))return this.rt.log(`E OctopusBody: ledcAttach 失败`),!1;this.rt.log(`I OctopusBody: LEDC 8 路就绪（GPIO ${this.rt.servoPins.join(` `)}，50 Hz / 14 位）`)}else for(let e=0;e<n;e++){if(this.boards_[e]=new Y(64+e),this.F.pulse&&this.boards_[e].SetPulseRange(102,512),!this.boards_[e].Init(null,t,50,this.rt.skipPrescale))return this.rt.log(`E OctopusBody: PCA9685 #${e} (0x${(64+e).toString(16).toUpperCase()}) 初始化失败`),!1;this.rt.log(`I OctopusBody: PCA9685 #${e} (0x${(64+e).toString(16).toUpperCase()}) 就绪`)}if(this.bank_.Bind(this.boards_,n),this.bank_.Begin(this.channels_,90),this.bank_.SetMaxRate(300),this.F.limit)for(let e=0;e<this.channels_;e++)this.bank_.SetLimit(e,35,145);if(this.F.softHome)for(let e=0;e<48;e++)this.bank_.last_written_[e]=NaN;return this.gait_.spinTurn=e===`kDual16`,this.F.gait2&&this.gait_.SetParams(W(this.rt.plan)),!0}*SoftHome(){if(this.F.softHome&&this.running_)for(let e=0;e<this.channels_;e++)this.bank_.SetTarget(e,90),yield 150;else if(this.F.softHome)for(let e=0;e<this.channels_;e++)this.bank_.SetTarget(e,90),this.bank_.present_[e]=this.bank_.target_[e],this.bank_.WriteChannel(e,this.bank_.present_[e]),this.bank_.last_written_[e]=this.bank_.present_[e],yield 150;else for(let e=0;e<this.channels_;e++){this.bank_.SetTarget(e,90);for(let e=0;e<3;e++)this.bank_.Tick(.02),yield 16}}Start(){this.running_||(this.running_=!0,this.rt.spawn(`octo_motion`,this.TaskLoop()))}*TaskLoop(){for(;this.running_;)this.Step(.02),yield 20}Relax(e){if(!this.F.relax)return;if(this.mode_!==`idle`||this.wantRelax!==!0){if(this.idleT=0,this.relaxed_&&this.mode_!==`idle`){this.relaxed_=!1;for(let e=0;e<48;e++)this.bank_.last_written_[e]=1e9}return}let t=!0;for(let e=0;e<this.channels_;e++)Math.abs(this.bank_.present_[e]-this.bank_.target_[e])>.01&&(t=!1);if(this.idleT=t?(this.idleT||0)+e:0,this.idleT>=1&&!this.relaxed_){this.relaxed_=!0;for(let e=0;e<this.channels_;e++)this.boards_[Math.floor(e/16)].SetRaw(e%16,0,4096);this.rt.log(`Rest：PWM 全部 FULL OFF（舵机放松，我的补充）`)}}SetVelocity(e,t){this.gait_.SetThrottle(e),this.gait_.SetSteer(t),this.mode_=`gait`,this.wantRelax=!1}SetGaitParams(e){this.gait_.SetParams(e)}GaitParamsSnapshot(){return{...this.gait_.Params()}}Rest(){this.mode_=`idle`,this.crawlCycles=null,this.wantRelax=!0,this.ReleaseHard()}RelaxNow(){if(this.mode_=`idle`,this.crawlCycles=null,this.wantRelax=!1,!this.relaxed_){this.relaxed_=!0;for(let e=0;e<this.channels_;e++)this.boards_[Math.floor(e/16)].SetRaw(e%16,0,4096);this.rt.log(`低电：PWM 立刻全部停掉（舵机放松，我的补充）`)}}WaveOnce(e){this.mode_=`idle`,this.wave_arm_=e%8,this.wave_timer_=0,this.mode_=`wave`}Pulse(e,t=.6){this.mode_=`pulse`,this.pulse_left_=e,this.pulse_period_=t,this.pulse_timer_=0}Step(e){this.mode_===`gait`?this.StepGait(e):this.mode_===`wave`?this.StepWave(e):this.mode_===`pulse`?this.StepPulse(e):this.StepIdle(e),this.mode_!==`idle`&&(this.wantRelax=!1),this.Relax(e),!this.relaxed_&&this.bank_.Tick(e)}ReleaseHard(){if(this.bank_.ReleaseAll(),!this.F.rest)for(let e=0;e<20;e++)this.bank_.Tick(.02)}WriteArm(e,t,n){e%=8,this.rig_===`kSingle8`?this.bank_.SetTarget(Z(this.rig_,e,0),90+t):(this.bank_.SetTarget(Z(this.rig_,e,0),90+t),this.bank_.SetTarget(Z(this.rig_,e,1),90+n))}StepGait(e){let t=this.gait_.phase_;if(this.gait_.Tick(e),this.crawlCycles!=null&&this.gait_.phase_<t&&--this.crawlCycles<=0){this.crawlCycles=null,this.mode_=`idle`,this.bank_.ReleaseAll();return}let n=Array.from({length:8},(e,t)=>this.gait_.Yaw(t));this.F.antiCollide&&$(n,this.rt.board===`v10`?G.v10:G[this.rt.plan]+3);for(let e=0;e<8;e++)this.WriteArm(e,n[e],this.gait_.Lift(e))}StepWave(e){this.gait_.Reset(),this.wave_timer_+=e;let t=1.2;if(this.wave_timer_>=t){this.mode_=`idle`;return}let n=this.wave_timer_/t,r=Math.sin(n*Math.PI),i=this.F.single8&&this.rig_===`kSingle8`;for(let e=0;e<8;e++)i?this.WriteArm(e,e===this.wave_arm_?r*40*Math.sin(n*6*Math.PI):0,0):this.WriteArm(e,0,e===this.wave_arm_?r*45:0)}StepPulse(e){if(this.pulse_timer_+=e,this.pulse_timer_>=this.pulse_period_&&(this.pulse_timer_=0,--this.pulse_left_<=0)){this.mode_=`idle`;return}let t=this.pulse_timer_/this.pulse_period_,n=Math.sin(t*Math.PI)*40,r=this.F.single8&&this.rig_===`kSingle8`;for(let e=0;e<8;e++)this.WriteArm(e,r?(e%2?1:-1)*n*.6:0,r?0:n)}StepIdle(){this.gait_.Reset();for(let e=0;e<8;e++)this.WriteArm(e,0,0)}};function $(e,t){for(let n=0;n<40;n++)for(let n=0;n<8;n++){let r=(n+1)%8,i=45-e[r]+e[n];if(i<t){let a=(t-i)/2;e[n]+=a,e[r]-=a}}return e}var se=class{constructor({F:e,i2cWrite:t,log:n,skipPrescale:r=!1,mode:i=`ino`,plan:a=`A`,adcMv:o=null,board:s=`pca`,servoPins:c=null,ledcWrite:l=null}){this.board=s,this.servoPins=c,this.ledcWriteFn=l||(()=>0),this.adcMv=o||(()=>0),this.vbat=null,this.lowBatt=!1,this.F=e,this.i2cWrite=t,this.logFn=n||(()=>{}),this.skipPrescale=r,this.mode=i,this.plan=a,this.now=0,this.tasks=[],this.lines=[],this.out=[],this.body=new Q(this),this.lastCmdMs=0,this.halted=null,this.boots=0}ledcAttach(e,t,n){return this.ledcFreq=t,this.ledcBits=n,this.ledcWriteFn(e,0,t,n),!0}ledcWrite(e,t){return this.ledcWriteFn(e,t,this.ledcFreq,this.ledcBits)!==!1}log(e){this.out.push(`[${(this.now/1e3).toFixed(2)}s] ${e}`),this.out.length>200&&this.out.shift(),this.logFn(e)}millis(){return Math.floor(this.now)}spawn(e,t){this.tasks.push({name:e,gen:t,wake:this.now})}boot(){this.tasks=[],this.body=new Q(this),this.boots++,this.halted=null,this.spawn(this.mode===`mcp`?`xiaozhi_main`:`loopTask`,this.mode===`mcp`?this.mcpMain():this.inoMain())}*inoMain(){this.log(`ESP-ROM: boot（模拟）`);let e=this.plan===`B`?X.kDual16:this.F.rig8?X.kSingle8:X.kDual16;if(!this.body.Init(e,this.i2cWrite))for(this.log(this.board===`v10`?`LEDC 初始化失败`:`PCA9685 初始化失败！检查 SDA/SCL 接线、供电、I2C 地址`),this.halted=`PCA9685 初始化失败，程序停在 while(1)`;;)yield 1e3;for(yield*this.body.SoftHome(),this.body.Start(),this.F.batt&&(this.board===`v10`&&this.battCheck(),this.spawn(`batt`,this.battTask())),this.log(this.F.compile?`BLE 串口已广播：OctoBrain（模拟）`:`SerialBT.begin("OctoBrain")（原样在 S3 上编译不过；这里假设已改好，按模拟串口继续）`),this.log(`Octopus body ready. BT name = OctoBrain`),this.lastCmdMs=this.millis();;){for(;this.lines.length;)yield*this.handleCommand(this.lines.shift());this.millis()-this.lastCmdMs>15e3&&(this.body.Rest(),this.lastCmdMs=this.millis(),this.log(`15 s 没有指令 → 自动 Rest`)),yield 10}}*mcpMain(){let e=this.plan===`B`||!this.F.rig8?X.kDual16:X.kSingle8;if(!this.body.Init(this.plan===`B`?X.kDual16:e,this.i2cWrite))for(this.log(`PCA9685 初始化失败`),this.halted=`PCA9685 初始化失败`;;)yield 1e3;for(yield*this.body.SoftHome(),this.body.Start(),this.F.batt&&(this.board===`v10`&&this.battCheck(),this.spawn(`batt`,this.battTask())),this.log(`小智固件（模拟）：已注册 self.octopus.action / self.octopus.set_gait`),this.mcpReady=!0;;)yield 50}battCheck(){let e=this.board===`v10`,t=e?2:122/22,n=e?3.55:9.6,r=e?3.75:10.2,i=e?8:10,a=0;for(let e=0;e<16;e++)a+=Math.min(2900,Math.max(0,this.adcMv(i)));let o=a/16/1e3*t;this.vbat=o,!this.lowBatt&&o<n?(this.lowBatt=!0,e?this.body.RelaxNow():this.body.Rest(),this.log(`电池 ${o.toFixed(2)} V < ${n} V：停止运动，请充电（我的补充）`)):this.lowBatt&&o>r&&(this.lowBatt=!1,this.log(`电池回到 ${o.toFixed(2)} V，恢复接受指令`))}*battTask(){for(;;)this.battCheck(),yield 500}send(e){this.lines.push(e)}*handleCommand(e){let t=e.trim().toUpperCase();this.lastCmdMs=this.millis(),this.log(`> `+t);let n=this.body;if(t===`STOP`||t===`REST`)n.Rest();else if(this.lowBatt&&!t.startsWith(`GAIT`))this.log(`电池电压低，忽略动作指令（我的补充）`);else if(t===`GO`||t===`WALK`||t===`FWD`)n.SetVelocity(1,0);else if(t===`LEFT`||t===`TURNL`)n.SetVelocity(1,-1);else if(t===`RIGHT`||t===`TURNR`)n.SetVelocity(1,1);else if(t.startsWith(`WAVE`)){let e=parseInt(t.substring(4).trim(),10)||0;(e<0||e>7)&&(e=0),n.WaveOnce(e)}else if(t.startsWith(`PULSE`)){let e=parseInt(t.substring(5).trim(),10)||0;e<1&&(e=1),n.Pulse(e)}else t.startsWith(`HOME`)?(this.F.home&&(n.mode_=`idle`),yield*n.SoftHome()):t.startsWith(`GAIT`)?this.setGait(t):this.log(`? unknown: `+t)}setGait(e){let t=this.body.GaitParamsSnapshot(),n=this.F.gaitParse?[`F=`,`YAW=`,`LIFT=`,`PHASE=`,`DUTY=`]:[`f=`,`yaw=`,`lift=`,`phase=`,`duty=`];this.F.gait2&&n.push(`PRESS=`);let r=0,i=0;for(;r<e.length;){let a=e.indexOf(` `,r),o=a===-1?e.substring(r):e.substring(r,a),s=e=>parseFloat(o.substring(e))||0;o.startsWith(n[0])?(t.freq_hz=s(2),i++):o.startsWith(n[1])?(t.yaw_amp_deg=s(4),i++):o.startsWith(n[2])?(t.lift_amp_deg=s(5),i++):o.startsWith(n[3])?(t.phase_deg=s(6),i++):o.startsWith(n[4])?(t.duty=s(5),i++):n[5]&&o.startsWith(n[5])&&(t.press_deg=s(6),i++),r=a===-1?e.length:a+1}return this.body.SetGaitParams(t),this.log(`gait updated`+(i?``:`（注意：一个参数都没匹配上，参数没变）`)),i}mcp(e,t={}){let n=this.body;if(!this.running())return`body not ready`;if(e===`self.octopus.set_gait`){let e=n.GaitParamsSnapshot(),r=z(t.freq??6,2,20),i=z(t.amplitude??38,0,60),a=z(t.phase??45,0,180);return e.freq_hz=r/10,e.yaw_amp_deg=i,e.phase_deg=a,n.SetGaitParams(e),`步态已更新`}if(e!==`self.octopus.action`)return`未知工具: `+e;let r=t.action??`crawl`,i=z(t.steps??3,1,100),a=z(t.direction??0,-100,100),o=z(t.speed??1e3,300,3e3),s=z(t.arm??0,0,7);if(this.lowBatt&&r!==`rest`)return`电池电压低，请先充电`;let c=1e3/(this.F.speed?Math.max(834,o):o>0?o:1e3);if(r===`crawl`){let e=n.GaitParamsSnapshot();return e.freq_hz=c,n.SetGaitParams(e),n.SetVelocity(1,a/100*.6),this.F.steps&&(n.crawlCycles=i),`开始爬行`}return r===`wave`?(n.WaveOnce(s),`挥手`):r===`pulse`?(n.Pulse(i),`脉冲收缩`):r===`rest`?(n.Rest(),`已放松`):r===`home`?(this.F.home?(n.mode_=`idle`,n.crawlCycles=null,this.spawn(`home`,n.SoftHome())):n.Rest(),`已回中位`):`未知动作: `+r}running(){return this.body.running_}step(e){this.now+=e;for(let e of this.tasks){let t=0;for(;!e.done&&e.wake<=this.now&&t++<400;){let t=e.gen.next();if(t.done){e.done=!0;break}e.wake+=Math.max(.001,t.value||0)}}this.tasks=this.tasks.filter(e=>!e.done)}},ce=class{constructor(e=64){this.addr=e,this.reset()}reset(){this.regs=new Uint8Array(256),this.regs[0]=17,this.regs[1]=4,this.regs[254]=30,this.writes=0,this.lastWriteMs=Array(16).fill(-1)}write(e,t,n=0){let r=e;for(let e of t)r===254?this.regs[0]&16&&(this.regs[254]=Math.max(3,e)):r===0?this.regs[0]=e&127:this.regs[r]=e,r>=6&&r<70&&(this.lastWriteMs[Math.floor((r-6)/4)]=n),this.regs[0]&32&&(r=r+1&255);return this.writes++,0}get sleeping(){return!!(this.regs[0]&16)}get freq(){return 25e6/(4096*(this.regs[254]+1))}channel(e){let t=6+4*e,n=this.regs,r=n[t]|(n[t+1]&15)<<8,i=n[t+2]|(n[t+3]&15)<<8,a=n[t+1]&16,o=n[t+3]&16;if(this.sleeping||o)return{us:0,ticks:0,on:r,off:i};let s=1e6/this.freq;if(a)return{us:s,ticks:4096,on:r,off:i};let c=(i-r+4096)%4096;return{us:c/4096*s,ticks:c,on:r,off:i}}},le=class{constructor(){this.reset()}reset(){this.duty=new Map,this.freqHz=50,this.bits=14,this.writes=0}write(e,t,n,r){return this.duty.set(e,t),n&&(this.freqHz=n),r&&(this.bits=r),this.writes++,0}get freq(){return this.freqHz}gpio(e){return{us:(this.duty.get(e)||0)/((1<<this.bits)-1)*(1e6/this.freqHz)}}},ue={pulse:`舵机脉宽 0.5–2.5 ms ↔ 0–180°（MG90S 常见标定，估算）`,speed:`空载 0.1 s/60°@4.8 V、0.08 s/60°@6 V（MG90S 常见标称），按电压线性插值`,current:`电流：保持 0.01 A，运动 0.12 + 0.45·(速度/最高速) A，堵转 0.7 A（估算）`,frame:`只有 10–30 ms 周期（33–100 Hz）的 PWM 舵机才认（模拟舵机估算）`,friction:`v9 走路是物理仿真（Rapier）：机身是有重力的刚体，触手是舵机关节连着的刚体，只靠触手和桌面的接触摩擦推着走；摩擦系数、PLA 质量等是估算（见下面“走路物理”）`,plusA:`完善版 A（我的补充）：底板下 3 个万向珠（滚动阻力系数约 0.02）、调高度让触手尖分担约 30% 重量 + 触手尖单向鳞片脚垫（向后滑 0.45、向前滑 0.15）——全部估算`,gap:`相邻触手最小夹角：方案 A 12°（按触手根部宽度）；方案 B 13°（v8 在 3D 碰撞体上实测，见 e2e/gapB.mjs）——A 为估算`},de=12;function fe(e){let t=e>>>0||1;return()=>(t=t*1664525+1013904223>>>0)/4294967296}var pe=class{constructor(e={}){this.o={plan:`A`,phase:3,fault:`none`,mode:`ino`,variant:`md`,seed:7,tipShare:.15,...e},this.o.F||(this.o.F=this.o.variant===`plus`||this.o.variant===`v10`?U():H(!1)),this.rebuild()}set(e){Object.assign(this.o,e),this.rebuild()}rebuild(){let e=this.o;this.bench=O(e),this.r=fe(e.seed),this.v10=this.bench.board===`v10`,this.dev=this.v10?new le:new ce(64),this.t=0,this.servoI=0,this.peakI=0,this.events=[],this.phys=null,this.pose={x:0,z:0,h:0},this.trace=[{x:0,z:0,h:0,t:0}],this.servos=this.bench.servos.map(e=>({...e,chN:+e.ch.slice(2),ang:72+this.r()*36,w:0,cmd:null,us:0,I:0,stall:!1,buzz:!1,collide:!1})),this.res=L(this.bench,{servoI:0,micSpkCm:e.micSpkCm}),this.espOn=!1,this.offFor=1e9,this.boots=0,this.scenarioDone=!1,this.rt=this.bench.phase===0?null:new se({F:e.F,mode:e.mode,plan:e.plan,skipPrescale:e.fault===`pwm200`,i2cWrite:(e,t,n)=>this.i2c(e,t,n),adcMv:e=>this.adcMv(e),...this.v10?{board:`v10`,servoPins:g.map(e=>e.gpio),ledcWrite:(e,t,n,r)=>this.espOn?this.dev.write(e,t,n,r):!1}:{}}),this.step(.001)}i2c(e,t,n){if(e!==64)return 2;let r=this.res.rails;return!r.pcaLogic||!r.i2cWired?2:(this.dev.write(t,n,this.rt.now),0)}adcMv(e){let t=this.res.rails;return this.v10?e===_.gpio&&t.battSense&&t.espOn?Math.min(2900,t.vbatSw/_.ratio*1e3+(this.r()-.5)*10):0:e!==10||!t.battSense||!t.espOn?0:Math.min(2900,t.vbat*22/122*1e3+(this.r()-.5)*20)}ev(e){this.events.push({t:+this.t.toFixed(2),zh:e}),this.events.length>60&&this.events.shift()}send(e){this.rt&&this.espOn?this.rt.send(e):this.ev(`ESP32 没在运行，指令没发出去`)}mcp(e,t){if(this.o.mode!==`mcp`)return`当前是蓝牙串口 .ino 模式`;if(!this.rt||!this.espOn)return`ESP32 没在运行`;let n=this.rt.mcp(e,t);return this.ev(`MCP ${e} ${JSON.stringify(t)} → ${n}`),n}step(e){let t=.005,n=Math.max(1,Math.round(e/t));for(;n--;)this.sub(t)}sub(e){this.t+=e;let t=this.o,n=this.bench;this.res=L(n,{servoI:this.servoI,micSpkCm:t.micSpkCm,railI:this.v10?Object.fromEntries(this.servos.map(e=>[e.role,e.I])):null});let r=this.res.rails;if(this.rt){if(r.espOn&&!this.espOn&&this.offFor>.3?(this.espOn=!0,this.boots++,this.dev.reset(),this.rt.now=this.t*1e3,this.rt.boot(),this.boots>1&&this.ev(`ESP32 重新启动（第 ${this.boots} 次）`),this.scenarioDone=!1):!r.espOn&&this.espOn&&(this.espOn=!1,this.offFor=0,this.ev(this.v10?`QT Py 电源掉到 ${r.espIn.toFixed(2)} V → 欠压复位`:`ESP32 5V 掉到 ${r.espIn.toFixed(2)} V → 欠压复位`),r.vpFromU1||this.dev.reset()),this.espOn||(this.offFor+=e),this.espOn&&(this.rt.step(e*1e3),!this.scenarioDone&&this.rt.body.running_)){if(this.scenarioDone=!0,t.fault===`mech`){let e=this.rt.body.GaitParamsSnapshot();e.yaw_amp_deg=60,this.rt.body.SetGaitParams(e),this.rt.body.SetVelocity(1,1),this.ev(`场景：步态 yaw 被改成 60°，并且右转`)}if(t.fault===`phase0`){let e=this.rt.body.GaitParamsSnapshot();e.phase_deg=0,this.rt.body.SetGaitParams(e),this.rt.body.SetVelocity(1,0),this.ev(`场景：phase = 0，八条触手同相`)}}}else this.espOn=r.espOn;let i=1e6/this.dev.freq,a=r.vservo,o=i>=1e4&&i<=3e4,c=e=>this.v10?e<3.5?0:s.speed48*Math.min(1,e/4.8):e<3.5?0:600+(Math.min(e,6.5)-4.8)*125,l=c(a),u=0;for(let t of this.servos){let n=this.v10?r.pwmGpio?.[t.role]:null,i=this.v10?n!=null&&r.espOn?this.dev.gpio(n):{us:0}:r.pcaLogic||r.vpFromU1?this.dev.channel(t.chN):{us:0},u=this.v10?c(r.vservoOf?.[t.role]??a):l;t.wmax=u,t.us=i.us,t.stall=!1,t.buzz=!1;let d=o&&i.us>=400&&i.us<=2700&&u>0;t.cmd=d?this.v10?(i.us-s.us0)/(s.us1-s.us0)*180:(i.us-500)/2e3*180:null;let f=0;if(t.type===`360`)d&&Math.abs(i.us-1500)>20&&(f=Math.max(-1,Math.min(1,(i.us-1500)/500))*780*(l/750)),t.ang+=f*e;else if(t.cmd!=null){let n=Math.max(-3,Math.min(183,t.cmd))-t.ang,r=u*e,i=Math.abs(n)<=r?n:Math.sign(n)*r;t.ang+=i,f=i/e,(t.cmd>183.5||t.cmd<-3.5)&&Math.abs(n)<.5&&(t.stall=!0,t.buzz=!0)}t.w=f}let d=this.yawServos();for(let e of d)e.collide=!1;if(d.length===8)for(let e=0;e<8;e++){let t=d[e],n=d[(e+1)%8],r=45-(n.ang-90)+(t.ang-90),i=this.v10?-35:this.bench.plan===`B`&&this.bench.robot?13:de;if(r<i){let e=(i-r)/2;t.ang+=e,n.ang-=e,t.stall=n.stall=!0,t.collide=n.collide=!0,t.buzz=n.buzz=!0}}for(let e of this.servos){if(this.v10){let t=e.wmax||0,n=r.vservoOf?.[e.role]??a;e.I=e.stall?.233*Math.min(1,n/4.8):t>0?.0033+(Math.abs(e.w)>1?.04+.15*Math.min(1,Math.abs(e.w)/t):0):0}else e.I=e.stall?.7*Math.min(1,a/6):l>0?.01+(Math.abs(e.w)>1?.12+.45*Math.min(1,Math.abs(e.w)/l):0):0;t.plan===`B`&&e.slot===1&&this.stanceArm(e.arm)&&(e.I+=.15),u+=e.I}if(this.servoI=u,this.avgI=(this.avgI||0)+(u-(this.avgI||0))*Math.min(1,e/.2),this.peakI=Math.max(this.peakI,this.avgI),this.peakInst=Math.max(this.peakInst||0,u),this.v10&&(this.eJ=(this.eJ||0)+(r.pBat||0)*e,this.eT=(this.eT||0)+e),n.robot&&this.phys){this.phys.step(e),this.pose=this.phys.pose2d();let t=this.phys.meas;this.vel={v:t.v,slip:t.slip}}this.t-(this.trace.at(-1)?.t||0)>.05&&(this.trace.push({...this.pose,t:this.t}),this.trace.length>3e3&&this.trace.shift())}yawServos(){return this.servos.filter(e=>e.slot===0&&e.arm!=null).sort((e,t)=>e.arm-t.arm)}liftOf(e){let t=this.servos.find(t=>t.arm===e&&t.slot===1);return t?t.ang-90:0}stanceArm(e){return this.liftOf(e)<=5}armPose(e){let t=this.servos.find(t=>t.arm===e&&t.slot===0);return{yaw:t?t.ang-90:0,lift:this.liftOf(e)}}attachPhys(e){this.phys=e,this.pose=e?e.pose2d():{x:0,z:0,h:0},this.trace=[{...this.pose,t:this.t}]}snapshot(){let e=this.res.rails;return{t:this.t,espOn:this.espOn,boots:this.boots,halted:this.rt?.halted||null,rails:e,checks:this.res.checks,warn:this.res.warn,servos:this.servos.map(e=>({role:e.role,ch:e.ch,arm:e.arm,slot:e.slot,us:e.us,ang:e.ang,cmd:e.cmd,I:e.I,stall:e.stall,buzz:e.buzz,collide:e.collide,type:e.type})),pBatAvg:this.v10&&this.eT?this.eJ/this.eT:null,servoI:this.servoI,avgI:this.avgI||0,peakI:this.peakI,peakInst:this.peakInst||0,vel:this.vel,freq:this.dev.freq,pose:{...this.pose},loco:this.phys?this.phys.snapshot():null,log:this.rt?this.rt.out.slice(-40):[],events:this.events.slice(-20),mode:this.rt?.body.mode_,gait:this.rt?.body.GaitParamsSnapshot?.()}}},me=`/*
 * 八爪鱼身体固件 · 方案 A（手机手动蓝牙控制，零代码）
 * ============================================================
 * 手机装一个蓝牙串口 App，手动发送指令（WALK / LEFT / STOP ...）
 * 就能控制八爪鱼。步态引擎跑在本机 ESP32-S3 上，手机只发"动词"，
 * 不碰任何一个舵机角度。
 *
 * 依赖：把 octopus_gait.h / octopus_bus.h / octopus_body.h 三个头文件
 *       和本 .ino 放在【同一个 Arduino 工程文件夹】里。
 *
 * 板型：ESP32-S3 Dev Module（最小系统板，¥25~35）
 * 库：   BluetoothSerial（ESP32 核心自带，不用额外安装）
 * 烧录： Arduino IDE → 开发板选 "ESP32S3 Dev Module"
 */

#define OCTO_USE_ARDUINO          // 让 octopus_bus.h 编译 Arduino 版 I2C 驱动
#include <Wire.h>
#include <BluetoothSerial.h>

#include "octopus_gait.h"
#include "octopus_bus.h"
#include "octopus_body.h"

// ---- 引脚（按你手上的板子改，下面是最通用的 ESP32-S3 选择）----
#define I2C_SDA  8
#define I2C_SCL  9
//#define BATTERY_PIN 4          // 接电池分压，想启用低压保护就取消注释

BluetoothSerial SerialBT;
octo::OctopusBody body;

String line;
uint32_t lastCmdMs = 0;
const uint32_t AUTO_REST_MS = 15000;   // 15 秒没指令就自动回到待机，防失控

// 若启用电池检测，按你的分压电阻比改这个（示例：100k+100k 分压 → 2.0）
// vbat = adc * (3.1/4095) * VBAT_DIVISOR
#define VBAT_DIVISOR 2.0f

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);               // PCA9685 支持 400kHz

#ifdef BATTERY_PIN
  pinMode(BATTERY_PIN, INPUT);
  analogSetAttenuation(ADC_11db);      // 量程拉到 ~3.1V，适配分压后电压
#endif

  // 初始化运动控制器（16 路 / 双自由度 / 8 条触手）
  if (!body.Init(octo::RigType::kDual16, &Wire, octo::I2cWriteArduino)) {
    Serial.println("PCA9685 初始化失败！检查 SDA/SCL 接线、供电、I2C 地址");
    while (1) delay(1000);
  }
  body.SoftHome();   // 分时把 16 路拉到中位，避免上电瞬间拉塌电源
  body.Start();      // 启动 50Hz 运动任务（FreeRTOS，固定跑在核心 0）

  SerialBT.begin("OctoBrain");  // 手机蓝牙里搜这个名字
  Serial.println("Octopus body ready. BT name = OctoBrain");
  SerialBT.println("Octopus ready");
  lastCmdMs = millis();
}

void loop() {
  // —— 读蓝牙指令（手机蓝牙串口 App 发的）——
  while (SerialBT.available()) {
    char c = SerialBT.read();
    if (c == '\\n' || c == '\\r') {
      if (line.length()) { handleCommand(line); line = ""; }
    } else {
      line += c;
    }
  }
  // —— 同时支持 USB 串口调试（没蓝牙时也能用电脑测）——
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\\n' || c == '\\r') {
      if (line.length()) { handleCommand(line); line = ""; }
    } else {
      line += c;
    }
  }

  // —— 安全：超时自动待机，避免断开后一直动 ——
  if (millis() - lastCmdMs > AUTO_REST_MS) {
    body.Rest();
    lastCmdMs = millis();   // 避免反复触发
  }

  // —— 低压保护：电池快没电时停运动，防止舵机抖 / 板子重启 ——
#ifdef BATTERY_PIN
  float vbat = analogRead(BATTERY_PIN) * (3.1f / 4095.0f) * VBAT_DIVISOR;
  if (vbat < 6.4f) {
    body.Rest();
    SerialBT.println("LOW BATTERY - stopped");
    delay(5000);
  }
#endif

  delay(10);
}

// ---------------------------------------------------------------------------
// 指令解析：手机只发"动词"，角度计算全在身体 ESP32 上
// ---------------------------------------------------------------------------
void handleCommand(String s) {
  s.trim();
  s.toUpperCase();
  lastCmdMs = millis();
  SerialBT.println("> " + s);

  if (s == "STOP" || s == "REST") {
    body.Rest();
    return;
  }
  if (s == "GO" || s == "WALK" || s == "FWD") {
    body.SetVelocity(1.0f, 0.0f);     // 爬行（相对自身向前）
    return;
  }
  if (s == "LEFT" || s == "TURNL") {
    body.SetVelocity(1.0f, -1.0f);    // 左转（差速）
    return;
  }
  if (s == "RIGHT" || s == "TURNR") {
    body.SetVelocity(1.0f, 1.0f);     // 右转
    return;
  }
  if (s.startsWith("WAVE")) {          // WAVE 3 → 第 3 号触手挥一下（0~7）
    int a = s.substring(4).toInt();
    if (a < 0 || a > 7) a = 0;
    body.WaveOnce(a);
    return;
  }
  if (s.startsWith("PULSE")) {        // PULSE 3 → 缩成一团 3 次
    int n = s.substring(5).toInt();
    if (n < 1) n = 1;
    body.Pulse(n);
    return;
  }
  if (s.startsWith("HOME")) {          // 回中位
    body.SoftHome();
    return;
  }
  if (s.startsWith("GAIT")) {          // GAIT f=0.6 yaw=38 lift=20 phase=45 duty=0.65
    setGait(s);
    return;
  }
  SerialBT.println("? unknown: " + s);
}

// 现场调 CPG 参数，不用重新烧录
void setGait(String s) {
  octo::GaitParams p = body.GaitParamsSnapshot();
  int i = 0;
  while (i < s.length()) {
    int sp = s.indexOf(' ', i);
    String tok = (sp == -1) ? s.substring(i) : s.substring(i, sp);
    if      (tok.startsWith("f="))    p.freq_hz     = tok.substring(2).toFloat();
    else if (tok.startsWith("yaw="))  p.yaw_amp_deg = tok.substring(4).toFloat();
    else if (tok.startsWith("lift=")) p.lift_amp_deg = tok.substring(5).toFloat();
    else if (tok.startsWith("phase=")) p.phase_deg  = tok.substring(6).toFloat();
    else if (tok.startsWith("duty=")) p.duty        = tok.substring(5).toFloat();
    i = (sp == -1) ? s.length() : sp + 1;
  }
  body.SetGaitParams(p);
  SerialBT.println("gait updated");
}
`,he=`#pragma once
// PCA9685 多舵机总线 + 软启动/限速保护
//
// 为什么必须用 PCA9685，而不是像很多 4 舵机例程那样拿 ESP32 的 LEDC 直驱：
//   1) ESP32-S3 的 LEDC 通道数名义上够，但和音频任务的 I2S DMA、Wi-Fi 抢定时器，
//      实际波形会抖，8 路以上尤其明显。
//   2) 音频播放（Opus 解码 + I2S 推送）会长时间占住一个核，软件 PWM 必抖。
//   3) PCA9685 自带 25MHz 振荡器，一旦写入就自己维持波形，主控可以长时间不理它。
//   4) 舵机电源从 PCA9685 的 V+ 螺丝端子独立引入，浪涌电流不经过 ESP32。

#include <cmath>
#include <cstdint>
#include <cstddef>

#include "octopus_gait.h"

#if defined(OCTO_USE_ESP_IDF)
#include "esp_err.h"
#include "esp_log.h"
#include "driver/i2c_master.h"
#elif defined(OCTO_USE_ARDUINO)
#include <Wire.h>
#endif

namespace octo {

class Pca9685 {
public:
    // —— 寄存器 ——
    static constexpr uint8_t kRegMode1     = 0x00;
    static constexpr uint8_t kRegMode2     = 0x01;
    static constexpr uint8_t kRegPrescale  = 0xFE;
    static constexpr uint8_t kRegLed0OnL   = 0x06;

    static constexpr uint8_t kBaseAddr     = 0x40;  // A5..A0 全接地时的地址
    static constexpr uint32_t kOscHz       = 25000000UL;
    static constexpr uint16_t kResolution  = 4096;

    Pca9685(uint8_t addr, uint16_t pulse_min = 150, uint16_t pulse_max = 600)
        : addr_(addr), pulse_min_(pulse_min), pulse_max_(pulse_max) {}

    uint8_t Addr() const { return addr_; }

    void SetPulseRange(uint16_t lo, uint16_t hi) { pulse_min_ = lo; pulse_max_ = hi; }

    uint16_t AngleToPulse(float deg) const {
        float d = deg < 0.0f ? 0.0f : (deg > 180.0f ? 180.0f : deg);
        return static_cast<uint16_t>(pulse_min_ + (pulse_max_ - pulse_min_) * (d / 180.0f));
    }

    // ---- 需要外部提供 I2C 写字节序列的实现 ----
    // WriteBytes(dev_addr, reg, data, len) -> 0 成功，其它为负 errno/esp_err_t
    //ReadBytes 仅在启动时可选用于校验
    using WriteFn = int (*)(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len);

    bool Init(void* ctx, WriteFn write_fn, float freq_hz = 50.0f) {
        ctx_ = ctx;
        write_ = write_fn;
        if (!write_) return false;

        uint8_t reset = 0x80;                        // MODE1 RESTART
        if (Write(kRegMode1, &reset, 1) != 0) return false;

        uint8_t sleep_ai = 0x10 | 0x20;              // SLEEP + AI(自动地址递增)
        if (Write(kRegMode1, &sleep_ai, 1) != 0) return false;

        // 预分频必须在 SLEEP 状态下写入
        uint32_t prescale = static_cast<uint32_t>(kOscHz / (kResolution * freq_hz) + 0.5f);
        if (prescale < 3) prescale = 3;
        if (prescale > 255) prescale = 255;
        uint8_t ps = static_cast<uint8_t>(prescale - 1);
        if (Write(kRegPrescale, &ps, 1) != 0) return false;

        uint8_t normal_ai = 0x20;                    // 退出 SLEEP，保留 AI
        if (Write(kRegMode1, &normal_ai, 1) != 0) return false;

        uint8_t mode2 = 0x04;                        // OUTDRV = 推挽输出
        if (Write(kRegMode2, &mode2, 1) != 0) return false;

        return true;
    }

    bool SetRaw(int ch, uint16_t on, uint16_t off) const {
        uint8_t buf[4] = {
            static_cast<uint8_t>(on & 0xFF),
            static_cast<uint8_t>(on >> 8),
            static_cast<uint8_t>(off & 0xFF),
            static_cast<uint8_t>(off >> 8),
        };
        return Write(static_cast<uint8_t>(kRegLed0OnL + 4 * ch), buf, 4) == 0;
    }

    bool SetAngle(int ch, float deg) const { return SetRaw(ch, 0, AngleToPulse(deg)); }

    void SetChannelInvert(bool inv) { invert_ = inv; }

private:
    bool Write(uint8_t reg, const uint8_t* data, size_t len) const {
        return write_(ctx_, addr_, reg, data, len) == 0;
    }

    uint8_t addr_;
    uint16_t pulse_min_, pulse_max_;
    bool invert_ = false;
    void* ctx_ = nullptr;
    WriteFn write_ = nullptr;
};

// ---------------------------------------------------------------------------
// ServoBank: 在 Pca9685 之上加一层"限速 + 软启动"，这是能不能跑稳的关键
// ---------------------------------------------------------------------------
class ServoBank {
public:
    void Bind(const Pca9685* boards, int board_count) {
        boards_ = boards;
        board_count_ = board_count;
    }

    // channels <= board_count * 16
    bool Begin(int channels, float home_angle = 90.0f) {
        channels_ = channels;
        for (int i = 0; i < kMaxChannels; i++) {
            target_[i] = home_angle;
            present_[i] = home_angle;
            trim_[i] = 0.0f;
            limit_lo_[i] = 0.0f;
            limit_hi_[i] = 180.0f;
        }
        return true;
    }

    // 单点标定：装歪了不用拆下来重装，写个偏移量就行（建议存 NVS）
    void SetTrim(int ch, float deg) { if (Valid(ch)) trim_[ch] = deg; }
    void SetLimit(int ch, float lo, float hi) {
        if (!Valid(ch)) return;
        limit_lo_[ch] = lo;
        limit_hi_[ch] = hi;
    }

    void SetTarget(int ch, float deg) {
        if (!Valid(ch)) return;
        float v = deg + trim_[ch];
        if (v < limit_lo_[ch]) v = limit_lo_[ch];
        if (v > limit_hi_[ch]) v = limit_hi_[ch];
        target_[ch] = v;
    }

    // 最大角速度限制。多个舵机同时大角度跳跃是掉电重启的头号原因。
    void SetMaxRate(float deg_per_s) { max_rate_ = deg_per_s; }

    // 每帧调用。会按 max_rate_ 把 present_ 推向 target_，并只在变化超阈值时写 I2C
    void Tick(float dt) {
        if (!boards_) return;
        const float step = max_rate_ * dt;
        for (int i = 0; i < channels_; i++) {
            float d = target_[i] - present_[i];
            if (std::fabs(d) <= step) {
                present_[i] = target_[i];
            } else {
                present_[i] += (d > 0) ? step : -step;
            }
            if (std::fabs(present_[i] - last_written_[i]) >= 0.35f) {
                WriteChannel(i, present_[i]);
                last_written_[i] = present_[i];
            }
        }
    }

    void ReleaseAll() {
        for (int i = 0; i < channels_; i++) {
            target_[i] = 90.0f + trim_[i];
        }
    }

    float Present(int ch) const { return Valid(ch) ? present_[ch] : 0.0f; }
    int Channels() const { return channels_; }

private:
    static constexpr int kMaxChannels = 48;  // 支持到方案 C 的 24 路还有余量

    bool Valid(int ch) const { return ch >= 0 && ch < channels_; }

    void WriteChannel(int ch, float deg) const {
        int b = ch / 16, c = ch % 16;
        if (b >= board_count_) return;
        boards_[b].SetAngle(c, deg);
    }

    const Pca9685* boards_ = nullptr;
    int board_count_ = 0;
    int channels_ = 0;
    float max_rate_ = 360.0f;  // 默认 360°/s，肉眼看着还算利落
    float trim_[kMaxChannels];
    float limit_lo_[kMaxChannels];
    float limit_hi_[kMaxChannels];
    float target_[kMaxChannels];
    float present_[kMaxChannels];
    float last_written_[kMaxChannels];
};

// ---------------------------------------------------------------------------
// I2C 传输实现（二选一）
// ---------------------------------------------------------------------------
#if defined(OCTO_USE_ESP_IDF)

// ESP-IDF v5.2+ / v6 的 i2c_master 新驱动
inline int I2cWriteIdf(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    i2c_master_dev_handle_t dev = *static_cast<i2c_master_dev_handle_t*>(ctx);
    uint8_t buf[8];
    if (len + 1 > sizeof(buf)) return -1;
    buf[0] = reg;
    for (size_t i = 0; i < len; i++) buf[i + 1] = data[i];
    return i2c_master_transmit(dev, buf, len + 1, 100);  // xTicksToWait
}

// 用法示例：
//   i2c_master_bus_config_t bus_cfg = {
//       .i2c_port = I2C_NUM_0,
//       .sda_io_num = GPIO_NUM_8,
//       .scl_io_num = GPIO_NUM_9,
//       .clk_source = I2C_CLK_SRC_DEFAULT,
//       .glitch_ignore_cnt = 7,
//       .flags = {.enable_internal_pullup = true},
//   };
//   i2c_master_bus_handle_t bus;
//   i2c_new_master_bus(&bus_cfg, &bus);
//   i2c_device_config_t dev_cfg = {
//       .dev_addr_length = I2C_ADDR_BIT_LEN_7,
//       .device_address = 0x40,
//       .scl_speed_hz = 400000,
//   };
//   i2c_master_dev_handle_t dev;
//   i2c_master_bus_add_device(bus, &dev_cfg, &dev);
//   board.Init(&dev, octo::I2cWriteIdf, 50.0f);

#elif defined(OCTO_USE_ARDUINO)

inline int I2cWriteArduino(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    TwoWire* wire = static_cast<TwoWire*>(ctx);
    wire->beginTransmission(addr);
    wire->write(reg);
    for (size_t i = 0; i < len; i++) wire->write(data[i]);
    return wire->endTransmission() == 0 ? 0 : -1;
}

#endif

}  // namespace octo
`,ge=`#pragma once
// 八触手 CPG 步态发生器 —— 纯数学层，不依赖任何硬件。
// 可以直接在 PC 上单元测试，也可以塞进 ESP-IDF / Arduino 工程。
//
// 核心思想：不做逆运动学求解，只用一个带相位偏移的振荡器阵列。
// 每条触手 = 一个振荡器，相邻触手固定相差 params.phase_deg，
// 八个振荡器绕一圈自然形成"逆行波"(metachronal wave)，这就是章鱼爬行的样子。

#include <cmath>
#include <cstdint>

namespace octo {

static constexpr int kArmCount = 8;

// 每条触手最多 2 个自由度时的通道序号编排
// yaw = 偏航(前后扫动), lift = 俯仰(抬起放下)
struct ArmChannels {
    int yaw;
    int lift;
};

struct GaitParams {
    float freq_hz       = 0.6f;   // 步频，0.3 稳一点，超过 1.2 舵机会跟不上
    float yaw_amp_deg   = 38.0f;  // 偏航摆幅
    float lift_amp_deg  = 20.0f;  // 抬起幅度
    float phase_deg     = 45.0f;  // 相邻触手相位差：0=同步脉冲 45=环形波 180=交替
    float duty          = 0.65f;  // 推进相占比。>0.5 才像"慢慢推、快速收"
};

class Gait {
public:
    void SetParams(const GaitParams& p) { params_ = p; }
    const GaitParams& Params() const { return params_; }

    // 每帧调用一次，dt 单位秒
    void Tick(float dt) {
        phase_ += dt * params_.freq_hz * 360.0f;
        while (phase_ >= 360.0f) phase_ -= 360.0f;
        while (phase_ < 0.0f) phase_ += 360.0f;
    }

    void Reset() { phase_ = 0.0f; }

    // steer: -1 全力左转, 0 直行, +1 全力右转
    void SetSteer(float s) { steer_ = Clamp(s, -1.0f, 1.0f); }
    void SetThrottle(float t) { throttle_ = Clamp(t, 0.0f, 1.0f); }

    // 该触手在一个周期内的归一化相位 0..1
    float Phase01(int arm) const {
        float p = std::fmod(phase_ + params_.phase_deg * arm, 360.0f) / 360.0f;
        return (p < 0.0f) ? p + 1.0f : p;
    }

    // 偏航角：推进相缓慢线性扫过，回复相快速弹回（三角波 + 可调占空比）
    float Yaw(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        float tri;
        if (p < d) {
            tri = 1.0f - 2.0f * (p / d);          // +amp -> -amp，撑地推进
        } else {
            tri = -1.0f + 2.0f * ((p - d) / (1.0f - d));  // -amp -> +amp，空中回复
        }
        return tri * params_.yaw_amp_deg * Gain(arm) * throttle_;
    }

    // 抬起角：只在回复相抬起，推进相贴地
    float Lift(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        if (p < d) return 0.0f;
        float k = (p - d) / (1.0f - d);
        return std::sin(k * static_cast<float>(M_PI)) * params_.lift_amp_deg;
    }

    bool IsPowerStroke(int arm) const { return Phase01(arm) < params_.duty; }

    // 第 arm 条触手的安装方位角(度)：0 号在正前方，顺时针排布
    static float MountAngle(int arm) { return -90.0f + arm * 45.0f; }

    // 把 [-180,180] 的方位角压到 [-90,90]，用于判断左右舷
    static float Lateriality(int arm) {
        return std::sin(MountAngle(arm) * static_cast<float>(M_PI) / 180.0f);
    }

private:
    // 转向增益：左右舷摆幅不对称，差速转弯
    float Gain(int arm) const {
        return 1.0f + steer_ * Lateriality(arm) * 0.85f;
    }

    static float Clamp(float v, float lo, float hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    GaitParams params_;
    float phase_ = 0.0f;
    float steer_ = 0.0f;
    float throttle_ = 1.0f;
};

// ---------------------------------------------------------------------------
// 固定 pose 插值器：用于 MCP 调用的"跳舞/挥手/缩成一团"这类定式动作
// ---------------------------------------------------------------------------
template <int N>
struct Pose {
    float ch[N];  // N 路舵机的目标角度（度）
};

template <int N>
class PoseBlender {
public:
    void Play(const Pose<N>& target, float duration_s) {
        for (int i = 0; i < N; i++) from_.ch[i] = current_.ch[i];
        target_ = target;
        duration_ = duration_s;
        elapsed_ = 0.0f;
        playing_ = duration_ > 0.0f;
    }

    void Tick(float dt) {
        if (!playing_) return;
        elapsed_ += dt;
        float k = elapsed_ / duration_;
        if (k >= 1.0f) { k = 1.0f; playing_ = false; }
        // smootherstep：起停都没有速度突变，舵机不会抖
        float e = k * k * k * (k * (k * 6.0f - 15.0f) + 10.0f);
        for (int i = 0; i < N; i++) {
            current_.ch[i] = from_.ch[i] + (target_.ch[i] - from_.ch[i]) * e;
        }
    }

    bool IsPlaying() const { return playing_; }
    const Pose<N>& Current() const { return current_; }
    void Snapshot(const Pose<N>& p) { current_ = p; }

private:
    Pose<N> current_{};
    Pose<N> from_{};
    Pose<N> target_{};
    float duration_ = 0.0f;
    float elapsed_ = 0.0f;
    bool playing_ = false;
};

}  // namespace octo
`,_e=`#pragma once
// OctopusBody：把「步态发生器」和「舵机总线」粘起来的运动控制器。
// 自己开一个 FreeRTOS 任务跑 50Hz 控制环，不占用音频任务的 CPU 时间。

#include <cmath>
#include <cstdint>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

#include "octopus_gait.h"
#include "octopus_bus.h"

namespace octo {

// 三种机械形态，对应 README 里的方案 A / B / C
enum class RigType {
    kSingle8,   // 8 路：每条触手 1 个偏航舵机
    kDual16,    // 16 路：每条触手 偏航 + 俯仰
    kTendon24,  // 24 路：每条触手 3 根腱绳，真软体
};

inline int ChannelsFor(RigType rig) {
    switch (rig) {
        case RigType::kSingle8:  return 8;
        case RigType::kDual16:   return 16;
        case RigType::kTendon24: return 24;
    }
    return 8;
}

// 第 arm 条触手的第 slot 个舵机对应全局通道号
inline int ChannelOf(RigType rig, int arm, int slot) {
    switch (rig) {
        case RigType::kSingle8:  return arm;
        case RigType::kDual16:   return arm * 2 + slot;
        case RigType::kTendon24: return arm * 3 + slot;
    }
    return arm;
}

class OctopusBody {
public:
    static constexpr const char* kTag = "OctopusBody";

    ~OctopusBody() { Stop(); }

    bool Init(RigType rig,
              void* i2c_ctx,
              Pca9685::WriteFn write_fn,
              int sda_gpio_unused = -1) {
        rig_ = rig;
        channels_ = ChannelsFor(rig);
        board_count_ = (channels_ + 15) / 16;

        for (int i = 0; i < board_count_; i++) {
            boards_[i] = Pca9685(static_cast<uint8_t>(Pca9685::kBaseAddr + i));
            if (!boards_[i].Init(i2c_ctx, write_fn, 50.0f)) {
                ESP_LOGE(kTag, "PCA9685 #%d (0x%02X) 初始化失败", i, Pca9685::kBaseAddr + i);
                return false;
            }
            ESP_LOGI(kTag, "PCA9685 #%d (0x%02X) 就绪", i, Pca9685::kBaseAddr + i);
        }

        bank_.Bind(boards_, board_count_);
        bank_.Begin(channels_, HomeAngle());
        bank_.SetMaxRate(300.0f);  // 300°/s，粗糙吃不消就往 200 调

        return true;
    }

    // 软启动：一个一个把舵机拉到中位，避免上电瞬间 16 路同时堵转把电源拉塌。
    // 这是从 xiaozhi-esp32-pet 项目踩过的坑里学来的：峰值电流能从 2.3A 降到 1.3A。
    void SoftHome() {
        for (int i = 0; i < channels_; i++) {
            bank_.SetTarget(i, HomeAngle());
            for (int k = 0; k < 3; k++) {
                bank_.Tick(0.02f);
                vTaskDelay(pdMS_TO_TICKS(16));
            }
        }
    }

    void Start() {
        if (task_) return;
        running_ = true;
        xTaskCreatePinnedToCore(&OctopusBody::TaskEntry, "octo_motion", 4096, this, 6, &task_, 0);
    }

    void Stop() {
        running_ = false;
        if (task_) {
            vTaskDelay(pdMS_TO_TICKS(100));
            vTaskDelete(task_);
            task_ = nullptr;
        }
    }

    // ---------- 运动指令（由 MCP 工具调用） ----------

    void SetVelocity(float throttle, float steer) {
        gait_.SetThrottle(throttle);
        gait_.SetSteer(steer);
        mode_ = Mode::kGait;
    }

    void SetGaitParams(const GaitParams& p) { gait_.SetParams(p); }
    GaitParams GaitParamsSnapshot() const { return gait_.Params(); }

    void Rest() { mode_ = Mode::kIdle; ReleaseHard(); }

    // 第 arm 条触手挥一下，可以连续多次调用做出"波浪"手势
    void WaveOnce(int arm) {
        mode_ = Mode::kIdle;
        wave_arm_ = arm % kArmCount;
        wave_timer_ = 0.0f;
        mode_ = Mode::kWave;
    }

    // 像水母一样八条同步收缩 —— 用于"害怕/缩成一团"这类情绪表达
    void Pulse(int times, float period_s = 0.6f) {
        mode_ = Mode::kPulse;
        pulse_left_ = times;
        pulse_period_ = period_s;
        pulse_timer_ = 0.0f;
    }

    RigType Rig() const { return rig_; }
    int Channels() const { return channels_; }

private:
    enum class Mode { kIdle, kGait, kWave, kPulse };

    static float HomeAngle() { return 90.0f; }

    static void TaskEntry(void* arg) { static_cast<OctopusBody*>(arg)->TaskLoop(); }

    void TaskLoop() {
        const TickType_t period = pdMS_TO_TICKS(20);  // 50Hz
        while (running_) {
            Step(0.02f);
            vTaskDelay(period);
        }
        ReleaseHard();
        vTaskDelete(nullptr);
    }

    void Step(float dt) {
        switch (mode_) {
            case Mode::kGait:  StepGait(dt);  break;
            case Mode::kWave:  StepWave(dt);  break;
            case Mode::kPulse: StepPulse(dt); break;
            case Mode::kIdle:
            default:           StepIdle(dt);  break;
        }
        bank_.Tick(dt);
    }

    void ReleaseHard() {
        bank_.ReleaseAll();
        for (int i = 0; i < 20; i++) bank_.Tick(0.02f);
    }

    void WriteArm(int arm, float yaw_deg, float lift_deg) {
        arm %= kArmCount;
        if (rig_ == RigType::kSingle8) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), HomeAngle() + yaw_deg);
        } else if (rig_ == RigType::kDual16) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), HomeAngle() + yaw_deg);
            bank_.SetTarget(ChannelOf(rig_, arm, 1), HomeAngle() + lift_deg);
        } else {
            // 腱绳连续体：把 (yaw, lift) 解成三根绳的张力分配
            // 三根绳在截面按 120° 分布，绳 j 的收紧量 ∝ cos(φ - θj)
            float phi = yaw_deg * static_cast<float>(M_PI) / 180.0f;
            float curve = 0.25f + lift_deg / 90.0f;  // 曲率
            for (int j = 0; j < 3; j++) {
                float theta = 2.0f * static_cast<float>(M_PI) * j / 3.0f;
                float tension = std::cos(phi - theta) * curve * 30.0f;
                bank_.SetTarget(ChannelOf(rig_, arm, j), HomeAngle() + tension);
            }
        }
    }

    void StepGait(float dt) {
        gait_.Tick(dt);
        for (int a = 0; a < kArmCount; a++) {
            WriteArm(a, gait_.Yaw(a), gait_.Lift(a));
        }
    }

    void StepWave(float dt) {
        gait_.Reset();
        wave_timer_ += dt;
        const float dur = 1.2f;
        if (wave_timer_ >= dur) { mode_ = Mode::kIdle; return; }
        float k = wave_timer_ / dur;
        float env = std::sin(k * static_cast<float>(M_PI));
        for (int a = 0; a < kArmCount; a++) {
            WriteArm(a, 0.0f, (a == wave_arm_) ? env * 45.0f : 0.0f);
        }
    }

    void StepPulse(float dt) {
        pulse_timer_ += dt;
        if (pulse_timer_ >= pulse_period_) {
            pulse_timer_ = 0.0f;
            if (--pulse_left_ <= 0) { mode_ = Mode::kIdle; return; }
        }
        float k = pulse_timer_ / pulse_period_;
        float curl = std::sin(k * static_cast<float>(M_PI)) * 40.0f;
        for (int a = 0; a < kArmCount; a++) WriteArm(a, 0.0f, curl);
    }

    void StepIdle(float dt) {
        gait_.Reset();
        for (int a = 0; a < kArmCount; a++) WriteArm(a, 0.0f, 0.0f);
    }

    RigType rig_ = RigType::kDual16;
    int channels_ = 16;
    int board_count_ = 1;

    Pca9685 boards_[3];
    ServoBank bank_;
    Gait gait_;

    Mode mode_ = Mode::kIdle;
    TaskHandle_t task_ = nullptr;
    volatile bool running_ = false;

    int wave_arm_ = 0;
    float wave_timer_ = 0.0f;
    int pulse_left_ = 0;
    float pulse_period_ = 0.6f;
    float pulse_timer_ = 0.0f;
};

}  // namespace octo
`,ve=`// 把八爪鱼的动作注册成小智固件的 MCP 工具 —— 接进 xiaozhi-esp32 的示例。
//
// 放哪儿：main/boards/octopus/octopus_mcp.cpp，然后在 CMakeLists.txt 的 SRCS 里加上。
// 调用点：在你的板子 Initialize() 末尾（Display / Buttons 初始化之后）调 RegisterOctopusTools(body);
//
// 设计说明（重要）：
//   这里刻意采用「一个统一工具 + action 参数」，而不是「一个动作一个工具」。
//   这是抄官方 main/boards/otto-robot/ 的做法（它用 self.otto.action）。
//   原因：注册十几个工具会让大模型的选择变困难，还容易调错；
//   单个工具配一个枚举型的 action 参数，命中率明显更高，工具列表也干净。
//
// ⚠️ 注意 API 版本：xiaozhi-esp32 的 McpServer::AddTool 签名在 v1.x → v2.x 之间变过。
//    下面用的是 v2.x / v2.5 的常见写法。如果你的 fork 编译报错，去对着
//    main/boards/otto-robot/otto_controller.cc 里的 AddTool 调用改一下参数包即可，
//    运动层代码一行都不用动。

#include <string>

#include "mcp_server.h"
#include "octopus_body.h"

namespace {

octo::OctopusBody* g_body = nullptr;

}  // namespace

void RegisterOctopusTools(octo::OctopusBody& body) {
    g_body = &body;

    auto& mcp = McpServer::GetInstance();

    // 统一动作接口：大模型只需要决定 action 和几个数值参数
    mcp.AddTool(
        "self.octopus.action",
        "执行八爪鱼动作。"
        "action 取值："
        "crawl(爬行, 需 steps/speed/direction 参数)、"
        "wave(用某条触手挥手, 需 arm 参数)、"
        "pulse(八触手同步收缩, 像水母脉冲, 需 steps)、"
        "rest(停止并放松)、"
        "home(回到中位)。"
        "direction: -100 全左转, 0 直行, +100 全右转。"
        "speed: 数值越小越快, 建议 500-2000。",
        PropertyList({
            Property("action", kPropertyTypeString, "crawl"),
            Property("steps", kPropertyTypeInteger, 3, 1, 100),
            Property("direction", kPropertyTypeInteger, 0, -100, 100),
            Property("speed", kPropertyTypeInteger, 1000, 300, 3000),
            Property("arm", kPropertyTypeInteger, 0, 0, 7),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");

            std::string action = props["action"].value<std::string>();
            int steps = props["steps"].value<int>();
            int dir = props["direction"].value<int>();
            int speed = props["speed"].value<int>();
            int arm = props["arm"].value<int>();

            // speed 是毫秒为单位的周期，转成 Hz
            float hz = 1000.0f / static_cast<float>(speed > 0 ? speed : 1000);

            if (action == "crawl") {
                auto p = b->GaitParamsSnapshot();
                p.freq_hz = hz;
                b->SetGaitParams(p);
                b->SetVelocity(1.0f, dir / 100.0f * 0.6f);
                return std::string("开始爬行");
            } else if (action == "wave") {
                b->WaveOnce(arm);
                return std::string("挥手");
            } else if (action == "pulse") {
                b->Pulse(steps);
                return std::string("脉冲收缩");
            } else if (action == "rest") {
                b->Rest();
                return std::string("已放松");
            } else if (action == "home") {
                b->Rest();
                return std::string("已回中位");
            }
            return std::string("未知动作: ") + action;
        });

    // 单独一个调步态的工具：把「怎么走」和「做什么动作」分开，方便大模型微调
    mcp.AddTool(
        "self.octopus.set_gait",
        "微调步态参数，不改变当前是否在动。"
        "freq 按 x10 倍传入（例如 6 表示 0.6Hz，超过 12 舵机就跟不上了），"
        "amplitude 是触手摆幅角度（0-60），"
        "phase 是相邻触手相位差：0 表示八条同步，45 表示环形逆行波（最像真章鱼），180 表示交替步态。",
        PropertyList({
            Property("freq", kPropertyTypeInteger, 6, 2, 20),
            Property("amplitude", kPropertyTypeInteger, 38, 0, 60),
            Property("phase", kPropertyTypeInteger, 45, 0, 180),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");
            octo::GaitParams p = b->GaitParamsSnapshot();
            p.freq_hz = props["freq"].value<int>() / 10.0f;
            p.yaw_amp_deg = static_cast<float>(props["amplitude"].value<int>());
            p.phase_deg = static_cast<float>(props["phase"].value<int>());
            b->SetGaitParams(p);
            return std::string("步态已更新");
        });
}

// ---------------------------------------------------------------------------
// 配套：粘贴到 xiaozhi.me 控制台的「角色人设」里，动作才有灵魂。
// 这个模板是照 otto-robot 的 README 改的，实测能让大模型主动调用动作，
// 而不是等你追问。
//
//   我的身份：我是一只八爪鱼机器人，有八条灵活的触手，能爬行、挥手、脉冲收缩。
//
//   我的动作能力（通过 self.octopus.action 调用）：
//   - crawl：爬行，用 steps 控制步数，direction 控制方向
//   - wave：指定某条触手挥手打招呼，arm 取值 0-7
//   - pulse：八条触手同步收缩，像水母一样，表达害怕或兴奋
//   - rest：停下来放松
//
//   我的性格：我很活泼，说话前会先做一个相应的动作表达情绪（先发动作指令再说话）。
//   打招呼时会 wave，高兴时会 pulse，被夸奖时会 crawl 转一圈，累了就 rest。
//   根据对话内容选择合适的动作，不要每次都一样。
// ---------------------------------------------------------------------------
`,ye={"octopus_plus/octopus_plus.ino":`/*
 * 小智八爪鱼 · 身体固件（完善版 / 我的补充）
 * ============================================================
 * 基于 md 的 body_firmware_A.ino。所有改动处都标了「我的补充」，对应指南里的“完善版改动表”。
 * 这是早期原型：已在仿真台面里跑过同样的逻辑，未在实物上验证。
 *
 * 文件：octopus_plus.ino + octopus_gait.h + octopus_bus.h + octopus_body.h + octopus_batt.h
 *       放在同一个 Arduino 工程文件夹（文件夹名必须是 octopus_plus）。
 * 板型：ESP32-S3-DevKitC-1（Arduino IDE 选 “ESP32S3 Dev Module”，arduino-esp32 3.x）
 * 库：  只用 ESP32 核心自带的 Wire 和 BLE，不需要额外安装。
 *
 * 手机：任意 BLE 串口 App（Nordic UART Service），连 “OctoBrain”，发文本指令：
 *   GO / WALK / FWD    向前爬
 *   LEFT / RIGHT       左转 / 右转（A 差速转，B 原地转）
 *   STOP / REST        停下，1 s 后舵机放松（FULL OFF）
 *   HOME               逐路回中位
 *   WAVE n             第 n 号触手挥手（0~7）
 *   PULSE n            八条一起收缩 n 次
 *   GAIT f=0.6 yaw=30 lift=20 phase=45 duty=0.6 press=20   现场调步态（大小写都行；press 只对 B 有用）
 *   BATT               回报电池电压
 * 15 s 没收到指令会自动 REST（md 的安全特性，保留）；想一直走，App 每 5 s 重发一次 GO。
 */

// —— 我的补充：编译开关，选方案。8 = 方案 A（kSingle8），16 = 方案 B（kDual16）——
#ifndef OCTO_RIG
#define OCTO_RIG 8
#endif
// 我的补充 · v10 紧凑无线版：-DOCTO_V10=1（板子选 Adafruit QT Py ESP32-S3 No PSRAM）。只支持 8 舵机。
#ifndef OCTO_V10
#define OCTO_V10 0
#endif
#if OCTO_V10 && OCTO_RIG != 8
#error "v10 only has 8 servos (OCTO_RIG=8)"
#endif

#define OCTO_USE_ARDUINO
#include <Wire.h>
// 我的补充：ESP32-S3 只有低功耗蓝牙，md 用的 BluetoothSerial 在 S3 上编译不过，改 BLE Nordic UART
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#if !defined(CONFIG_BT_NIMBLE_ENABLED) && !defined(CONFIG_NIMBLE_ENABLED)
#include <BLE2902.h>   // Bluedroid 需要手动加 CCCD；NimBLE（arduino-esp32 3.3 起）自动加
#define OCTO_NEED_2902
#endif

#include "octopus_gait.h"
#include "octopus_bus.h"
#include "octopus_body.h"
#include "octopus_batt.h"

// ---- 引脚（按 README / md .ino）----
#define I2C_SDA 8
#define I2C_SCL 9
// 我的补充：电池检测在 GPIO10（见 octopus_batt.h），不用 md 写的 GPIO4（已被麦克风 WS 占用）

// Nordic UART Service UUID（我的补充）
#define NUS_SERVICE "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"   // 手机 → 板子（write）
#define NUS_TX      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"   // 板子 → 手机（notify）

octo::OctopusBody body;
octo::Battery batt;

BLECharacteristic* txChar = nullptr;
volatile bool bleConnected = false;
QueueHandle_t lineQueue = nullptr;     // 我的补充：BLE 回调只把整行塞进队列，loop() 里解析

struct Line { char s[64]; };

String usbLine;
uint32_t lastCmdMs = 0;
uint32_t lastBattMs = 0;
const uint32_t AUTO_REST_MS = 15000;   // md：15 s 没指令自动待机

void reply(const String& s) {
  Serial.println(s);
  if (bleConnected && txChar) {
    txChar->setValue((uint8_t*)s.c_str(), s.length());
    txChar->notify();
  }
}

class ServerCb : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { bleConnected = true; }
  void onDisconnect(BLEServer* srv) override {
    bleConnected = false;
    srv->getAdvertising()->start();   // 断开后继续广播
  }
};

class RxCb : public BLECharacteristicCallbacks {
  String buf;
  void onWrite(BLECharacteristic* c) override {
    String v = c->getValue();
    for (size_t i = 0; i < v.length(); i++) {
      char ch = v[i];
      if (ch == '\\n' || ch == '\\r') { push(); }
      else if (buf.length() < 63) buf += ch;
    }
    // 很多 App 发送时不带换行：一次 write 当一行
    push();
  }
  void push() {
    if (!buf.length()) return;
    Line l;
    strncpy(l.s, buf.c_str(), sizeof(l.s) - 1);
    l.s[sizeof(l.s) - 1] = 0;
    xQueueSend(lineQueue, &l, 0);
    buf = "";
  }
};

void setupBle() {
  BLEDevice::init("OctoBrain");
  BLEServer* srv = BLEDevice::createServer();
  srv->setCallbacks(new ServerCb());
  BLEService* svc = srv->createService(NUS_SERVICE);
  txChar = svc->createCharacteristic(NUS_TX, BLECharacteristic::PROPERTY_NOTIFY);
#ifdef OCTO_NEED_2902
  txChar->addDescriptor(new BLE2902());
#endif
  BLECharacteristic* rx = svc->createCharacteristic(
      NUS_RX, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxCb());
  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SERVICE);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
}

void setup() {
  Serial.begin(115200);
#if !OCTO_V10
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);
#endif
  batt.Begin();
  lineQueue = xQueueCreate(8, sizeof(Line));

#if OCTO_RIG == 16
  const octo::RigType rig = octo::RigType::kDual16;
#else
  const octo::RigType rig = octo::RigType::kSingle8;   // 我的补充：md 写死 kDual16，方案 A 只有 8 个舵机
#endif

  if (!body.Init(rig, &Wire, octo::I2cWriteArduino)) {
#if OCTO_V10
    Serial.println("LEDC init failed: check servo pins");
#else
    Serial.println("PCA9685 init failed: check SDA/SCL, V+ / VCC, address 0x40");
#endif
    while (1) delay(1000);
  }
  body.SoftHomeBlocking();   // 我的补充：真正逐路上电（每路间隔 150 ms）
  body.Start();

  setupBle();
  reply(String(OCTO_V10 ? "Octopus ready (v10 wireless)" : "Octopus ready (plus)") + ". BLE name = OctoBrain, rig = " + String(OCTO_RIG));
  if (batt.Low()) reply("LOW BATTERY " + String(batt.Volts(), 2) + " V - charge first");   // 我的补充：开机就低电
  lastCmdMs = millis();
}

void handleCommand(String s);

void loop() {
  Line l;
  while (xQueueReceive(lineQueue, &l, 0) == pdTRUE) handleCommand(String(l.s));

  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\\n' || c == '\\r') { if (usbLine.length()) { handleCommand(usbLine); usbLine = ""; } }
    else if (usbLine.length() < 63) usbLine += c;
  }

  if (millis() - lastCmdMs > AUTO_REST_MS) {
    body.Rest();
    lastCmdMs = millis();
  }

  // 我的补充：每 500 ms 查一次电池，带迟滞
  if (millis() - lastBattMs > 500) {
    lastBattMs = millis();
    if (batt.Update()) {
      if (batt.Low()) {
#if OCTO_V10
        body.RelaxNow();
#else
        body.Rest();
#endif
        reply("LOW BATTERY " + String(batt.Volts(), 2) + " V - stopped");
      }
      else reply("battery OK " + String(batt.Volts(), 2) + " V");
    }
  }

  delay(10);
}

void handleCommand(String s) {
  s.trim();
  s.toUpperCase();
  lastCmdMs = millis();
  reply("> " + s);

  if (s == "STOP" || s == "REST") { body.Rest(); return; }
  if (s == "BATT") { reply(String(batt.Read(), 2) + " V"); return; }
  // 我的补充：低电量时只接受 STOP / REST / BATT
  if (batt.Low()) { reply("battery low, charge first"); return; }

  if (s == "GO" || s == "WALK" || s == "FWD") { body.SetVelocity(1.0f, 0.0f); return; }
  if (s == "LEFT" || s == "TURNL")  { body.SetVelocity(1.0f, -1.0f); return; }
  if (s == "RIGHT" || s == "TURNR") { body.SetVelocity(1.0f, 1.0f); return; }
  if (s.startsWith("WAVE")) {
    int a = s.substring(4).toInt();
    if (a < 0 || a > 7) a = 0;
    body.WaveOnce(a);
    return;
  }
  if (s.startsWith("PULSE")) {
    int n = s.substring(5).toInt();
    if (n < 1) n = 1;
    body.Pulse(n);
    return;
  }
  if (s.startsWith("HOME")) { body.Home(); return; }   // 我的补充：交给运动任务，先停步态
  if (s.startsWith("GAIT")) { setGait(s); return; }
  reply("? unknown: " + s);
}

// 我的补充：toUpperCase() 之后按大写键名匹配（md 找小写，永远匹配不上）
void setGait(const String& s) {
  octo::GaitParams p = body.GaitParamsSnapshot();
  int i = 0, hit = 0;
  while (i < (int)s.length()) {
    int sp = s.indexOf(' ', i);
    String tok = (sp == -1) ? s.substring(i) : s.substring(i, sp);
    if      (tok.startsWith("F="))     { p.freq_hz      = tok.substring(2).toFloat(); hit++; }
    else if (tok.startsWith("YAW="))   { p.yaw_amp_deg  = tok.substring(4).toFloat(); hit++; }
    else if (tok.startsWith("LIFT="))  { p.lift_amp_deg = tok.substring(5).toFloat(); hit++; }
    else if (tok.startsWith("PHASE=")) { p.phase_deg    = tok.substring(6).toFloat(); hit++; }
    else if (tok.startsWith("DUTY="))  { p.duty         = tok.substring(5).toFloat(); hit++; }
    else if (tok.startsWith("PRESS=")) { p.press_deg    = tok.substring(6).toFloat(); hit++; }
    i = (sp == -1) ? s.length() : sp + 1;
  }
  // 我的补充：夹到 md 写的安全范围
  if (p.freq_hz > 1.2f) p.freq_hz = 1.2f;
  if (p.freq_hz < 0.1f) p.freq_hz = 0.1f;
  if (p.yaw_amp_deg > 55.0f) p.yaw_amp_deg = 55.0f;
  body.SetGaitParams(p);
  reply(hit ? "gait updated" : "gait: no key matched (use F= YAW= LIFT= PHASE= DUTY= PRESS=)");
}
`,"octopus_plus/octopus_gait.h":`#pragma once
// 八触手 CPG 步态发生器（完善版）—— 纯数学层，不依赖任何硬件。
// 基于 md 的 octopus_gait.h；改动处都标了「我的补充」。
//
// 我的补充：md 的 Yaw() 让八条触手往同一个方向扫，左右舷判断 Lateriality() 用的是 sin(安装角)，
// 实际区分的是前后，LEFT / RIGHT 转不了弯，转弯增益 1.85 还会让摆幅超过相邻 45° 的间隔。
// 完善版改成「镜像扫动」Sweep()：按 cos(安装角) 区分左右舷，左右两边反向扫，直行时转矩抵消；
//   - 方案 A（只有偏航，kSingle8）：一侧摆幅变小 = 差速转弯；
//   - 方案 B（偏航 + 俯仰，kDual16）：八条同向扫 = 原地转。
// 结果夹在 [-1, 1]，任何时候摆幅都不会超过设定值。

#include <cmath>
#include <cstdint>

namespace octo {

static constexpr int kArmCount = 8;

struct ArmChannels {
    int yaw;
    int lift;
};

struct GaitParams {
    float freq_hz       = 0.6f;   // 步频，0.3 稳一点，超过 1.2 舵机会跟不上（md）
    float yaw_amp_deg   = 30.0f;  // 我的补充：A 默认 30°（md 38°）；B 由 OctopusBody 改成 20°（v8；相邻差最大 0.71×20≈14°，45−14=31° > 间隙 16+3，估算）
    float lift_amp_deg  = 20.0f;
    float phase_deg     = 45.0f;  // 0=同步划水 45=环形波 180=交替
    float duty          = 0.6f;   // 我的补充：A 0.6 / B 0.55（md 0.65）
    float press_deg     = 0.0f;   // 我的补充（v9）：B 支撑相俯仰往下压的角度，把机身从底板上撑起来；A 没有俯仰舵机 = 0
};

class Gait {
public:
    void SetParams(const GaitParams& p) { params_ = p; }
    const GaitParams& Params() const { return params_; }

    // 我的补充：B（kDual16）原地转；A（kSingle8）差速转
    void SetSpinTurn(bool on) { spin_turn_ = on; }

    void Tick(float dt) {
        phase_ += dt * params_.freq_hz * 360.0f;
        while (phase_ >= 360.0f) { phase_ -= 360.0f; cycles_++; }
        while (phase_ < 0.0f) phase_ += 360.0f;
    }

    void Reset() { phase_ = 0.0f; cycles_ = 0; }
    uint32_t Cycles() const { return cycles_; }   // 我的补充：给 MCP steps 计数

    void SetSteer(float s) { steer_ = Clamp(s, -1.0f, 1.0f); }
    void SetThrottle(float t) { throttle_ = Clamp(t, 0.0f, 1.0f); }

    float Phase01(int arm) const {
        float p = std::fmod(phase_ + params_.phase_deg * arm, 360.0f) / 360.0f;
        return (p < 0.0f) ? p + 1.0f : p;
    }

    float Yaw(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        float tri;
        if (p < d) {
            tri = 1.0f - 2.0f * (p / d);
        } else {
            tri = -1.0f + 2.0f * ((p - d) / (1.0f - d));
        }
        return tri * params_.yaw_amp_deg * Sweep(arm) * throttle_;
    }

    float Lift(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        float pr = params_.press_deg;
        if (p < d) return -pr;
        float k = (p - d) / (1.0f - d);
        return -pr + std::sin(k * static_cast<float>(M_PI)) * (params_.lift_amp_deg + pr);
    }

    bool IsPowerStroke(int arm) const { return Phase01(arm) < params_.duty; }

    // 0 号在正前方，顺时针排布（md）
    static float MountAngle(int arm) { return -90.0f + arm * 45.0f; }

    // 我的补充：左右舷 = cos(安装角)：右舷 > 0，左舷 < 0，正前 / 正后 = 0
    static float Side(int arm) {
        return std::cos(MountAngle(arm) * static_cast<float>(M_PI) / 180.0f);
    }

private:
    // 我的补充：镜像扫动（替代 md 的 Gain()）
    float Sweep(int arm) const {
        const float c = Side(arm), s = steer_;
        if (spin_turn_) return Clamp((1.0f - std::fabs(s)) * c - s, -1.0f, 1.0f);
        const float sg = (c > 1e-6f) ? 1.0f : (c < -1e-6f ? -1.0f : 0.0f);
        return Clamp(c * (1.0f - s * sg), -1.0f, 1.0f);
    }

    static float Clamp(float v, float lo, float hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    GaitParams params_;
    float phase_ = 0.0f;
    float steer_ = 0.0f;
    float throttle_ = 1.0f;
    bool spin_turn_ = false;
    uint32_t cycles_ = 0;
};

// 我的补充：相邻触手防碰撞。相邻两条的夹角 = 45° − yaw[i+1] + yaw[i]，
// 小于 gmin（机械间隙 + 3° 余量；A 12°、B 16°；B 为 v8 在 3D 碰撞体上实测 13° + 余量）就两边各退一半，迭代收敛。
inline void AntiCollide(float* yaw, float gmin) {
    for (int it = 0; it < 40; it++) {
        for (int a = 0; a < kArmCount; a++) {
            int b = (a + 1) % kArmCount;
            float gap = 45.0f - yaw[b] + yaw[a];
            if (gap < gmin) { float f = (gmin - gap) * 0.5f; yaw[a] += f; yaw[b] -= f; }
        }
    }
}

}  // namespace octo
`,"octopus_plus/octopus_bus.h":`#pragma once
// PCA9685 多舵机总线 + 软启动/限速保护（完善版）。基于 md 的 octopus_bus.h，改动处标「我的补充」。

#include <cmath>
#include <cstdint>
#include <cstddef>

#include "octopus_gait.h"

// 我的补充 · v10 紧凑无线版：-DOCTO_V10=1 时不用 PCA9685，8 个舵机直接接 QT Py ESP32-S3 的 GPIO，用 LEDC 出 PWM
#ifndef OCTO_V10
#define OCTO_V10 0
#endif

#if defined(OCTO_USE_ESP_IDF)
#include "esp_err.h"
#include "esp_log.h"
#include "esp_rom_sys.h"
#include "driver/i2c_master.h"
#define OCTO_DELAY_US(us) esp_rom_delay_us(us)
#elif defined(OCTO_USE_ARDUINO)
#include <Arduino.h>
#include <Wire.h>
#define OCTO_DELAY_US(us) delayMicroseconds(us)
#else
#define OCTO_DELAY_US(us) ((void)0)
#endif

namespace octo {

class Pca9685 {
public:
    static constexpr uint8_t kRegMode1     = 0x00;
    static constexpr uint8_t kRegMode2     = 0x01;
    static constexpr uint8_t kRegPrescale  = 0xFE;
    static constexpr uint8_t kRegLed0OnL   = 0x06;

    static constexpr uint8_t kBaseAddr     = 0x40;
    static constexpr uint32_t kOscHz       = 25000000UL;
    static constexpr uint16_t kResolution  = 4096;

    // 我的补充：脉宽 0.5–2.5 ms ↔ 0–180°（50 Hz 下 20 ms = 4096 计数 → 102 / 512），90° = 1.5 ms。
    // md 原值 150–600（0.73–2.93 ms），90° 落在 1.83 ms。每个舵机仍需 SetTrim 单点校准。
    static constexpr uint16_t kPulseMin = 102;
    static constexpr uint16_t kPulseMax = 512;

    // 我的补充：默认构造（OctopusBody 里的 boards_[3] 数组需要，md 版编译不过）
    Pca9685() : Pca9685(kBaseAddr) {}
    explicit Pca9685(uint8_t addr, uint16_t pulse_min = kPulseMin, uint16_t pulse_max = kPulseMax)
        : addr_(addr), pulse_min_(pulse_min), pulse_max_(pulse_max) {}

    uint8_t Addr() const { return addr_; }
    void SetPulseRange(uint16_t lo, uint16_t hi) { pulse_min_ = lo; pulse_max_ = hi; }

    uint16_t AngleToPulse(float deg) const {
        float d = deg < 0.0f ? 0.0f : (deg > 180.0f ? 180.0f : deg);
        return static_cast<uint16_t>(pulse_min_ + (pulse_max_ - pulse_min_) * (d / 180.0f) + 0.5f);
    }

    using WriteFn = int (*)(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len);

    bool Init(void* ctx, WriteFn write_fn, float freq_hz = 50.0f) {
        ctx_ = ctx;
        write_ = write_fn;
        if (!write_) return false;

        uint8_t sleep_ai = 0x10 | 0x20;              // SLEEP + AI；预分频只能在 SLEEP 时写
        if (Write(kRegMode1, &sleep_ai, 1) != 0) return false;

        uint32_t prescale = static_cast<uint32_t>(kOscHz / (kResolution * freq_hz) + 0.5f);
        if (prescale < 3) prescale = 3;
        if (prescale > 255) prescale = 255;
        uint8_t ps = static_cast<uint8_t>(prescale - 1);
        if (Write(kRegPrescale, &ps, 1) != 0) return false;

        uint8_t normal_ai = 0x20;                    // 退出 SLEEP，保留 AI
        if (Write(kRegMode1, &normal_ai, 1) != 0) return false;

        // 我的补充：振荡器唤醒后最多 500 µs 才稳定（PCA9685 数据手册），等够再写 RESTART
        OCTO_DELAY_US(500);
        uint8_t restart = 0x80 | 0x20;               // RESTART + AI
        if (Write(kRegMode1, &restart, 1) != 0) return false;

        uint8_t mode2 = 0x04;                        // OUTDRV = 推挽
        if (Write(kRegMode2, &mode2, 1) != 0) return false;
        return true;
    }

    bool SetRaw(int ch, uint16_t on, uint16_t off) const {
        uint8_t buf[4] = {
            static_cast<uint8_t>(on & 0xFF), static_cast<uint8_t>(on >> 8),
            static_cast<uint8_t>(off & 0xFF), static_cast<uint8_t>(off >> 8),
        };
        return Write(static_cast<uint8_t>(kRegLed0OnL + 4 * ch), buf, 4);
    }

    bool SetAngle(int ch, float deg) const { return SetRaw(ch, 0, AngleToPulse(deg)); }

    // 我的补充：FULL OFF（LEDn_OFF_H bit4 = 1），输出常低，舵机不再出力
    bool SetOff(int ch) const { return SetRaw(ch, 0, 0x1000); }

private:
    int Write(uint8_t reg, const uint8_t* data, size_t len) const {
        return write_(ctx_, addr_, reg, data, len);
    }
    // 注：md 版的 Write() 返回 bool 却和 0 比较（!= 0 表示失败），写成功时 Init 反而返回 false。
    // 完善版统一返回 int（0 = 成功）。

    uint8_t addr_;
    uint16_t pulse_min_, pulse_max_;
    void* ctx_ = nullptr;
    WriteFn write_ = nullptr;
};

#if OCTO_V10
// 我的补充 · v10：和 Pca9685 同样的 SetAngle / SetOff 接口，ServoBank / OctopusBody / Gait 不用改。
// arduino-esp32 3.x 的 LEDC API：ledcAttach(pin, 50 Hz, 14 位) 自动分配通道；ledcWrite(pin, duty)。
// 脉宽按 SG51R（Adafruit 2201）页面：0.75–2.25 ms 对应全行程。
class LedcBoard {
public:
    static constexpr float kUs0 = 750.0f, kUs1 = 2250.0f;
    bool Init(const uint8_t* pins, int n) {
        pins_ = pins; n_ = n;
        for (int i = 0; i < n; i++) if (!ledcAttach(pins[i], 50, 14)) return false;
        return true;
    }
    static uint32_t Duty(float us) { return static_cast<uint32_t>(std::lround(us / 20000.0f * 16383.0f)); }
    void SetAngle(int ch, float deg) const {
        if (ch < 0 || ch >= n_) return;
        if (deg < 0.0f) deg = 0.0f;
        if (deg > 180.0f) deg = 180.0f;
        ledcWrite(pins_[ch], Duty(kUs0 + (kUs1 - kUs0) * deg / 180.0f));
    }
    void SetOff(int ch) const { if (ch >= 0 && ch < n_) ledcWrite(pins_[ch], 0); }   // 占空比 0 = 不出脉冲，舵机放松
private:
    const uint8_t* pins_ = nullptr;
    int n_ = 0;
};
using BankBoard = LedcBoard;
#else
using BankBoard = Pca9685;
#endif

class ServoBank {
public:
    void Bind(const BankBoard* boards, int board_count) { boards_ = boards; board_count_ = board_count; }

    bool Begin(int channels, float home_angle = 90.0f) {
        channels_ = channels;
        for (int i = 0; i < kMaxChannels; i++) {
            target_[i] = home_angle;
            present_[i] = home_angle;
            trim_[i] = 0.0f;
            limit_lo_[i] = 0.0f;
            limit_hi_[i] = 180.0f;
            last_written_[i] = kNever;   // 我的补充：md 初值 0，SoftHome 第一轮 Tick 会同时写出全部通道
            armed_[i] = false;           // 我的补充：SoftHome 逐路 Arm，没 Arm 的通道 Tick 不写
        }
        relaxed_ = false;
        return true;
    }

    void SetTrim(int ch, float deg) { if (Valid(ch)) trim_[ch] = deg; }
    void SetLimit(int ch, float lo, float hi) { if (!Valid(ch)) return; limit_lo_[ch] = lo; limit_hi_[ch] = hi; }

    void SetTarget(int ch, float deg) {
        if (!Valid(ch)) return;
        float v = deg + trim_[ch];
        if (v < limit_lo_[ch]) v = limit_lo_[ch];
        if (v > limit_hi_[ch]) v = limit_hi_[ch];
        target_[ch] = v;
    }

    void SetMaxRate(float deg_per_s) { max_rate_ = deg_per_s; }

    // 我的补充：把一路立即写到目标并“上电”（SoftHome 用）
    void ArmNow(int ch) {
        if (!Valid(ch)) return;
        present_[ch] = target_[ch];
        WriteChannel(ch, present_[ch]);
        last_written_[ch] = present_[ch];
        armed_[ch] = true;
    }

    void Tick(float dt) {
        if (!boards_ || relaxed_) return;
        const float step = max_rate_ * dt;
        for (int i = 0; i < channels_; i++) {
            float d = target_[i] - present_[i];
            if (std::fabs(d) <= step) present_[i] = target_[i];
            else present_[i] += (d > 0) ? step : -step;
            if (armed_[i] && std::fabs(present_[i] - last_written_[i]) >= 0.35f) {
                WriteChannel(i, present_[i]);
                last_written_[i] = present_[i];
            }
        }
    }

    void ReleaseAll() { for (int i = 0; i < channels_; i++) target_[i] = 90.0f + trim_[i]; }

    // 我的补充：全部通道到位了吗（Rest 后判断能不能放松）
    bool Settled() const {
        for (int i = 0; i < channels_; i++) if (std::fabs(target_[i] - present_[i]) > 0.01f) return false;
        return true;
    }

    // 我的补充：放松 = 全部 FULL OFF；唤醒 = 下一次 Tick 重新写出全部通道
    void Relax() {
        if (relaxed_ || !boards_) return;
        for (int i = 0; i < channels_; i++) { int b = i / 16; if (b < board_count_) boards_[b].SetOff(i % 16); }
        relaxed_ = true;
    }
    void Wake() {
        if (!relaxed_) return;
        relaxed_ = false;
        for (int i = 0; i < channels_; i++) last_written_[i] = kNever;
    }
    bool Relaxed() const { return relaxed_; }

    float Present(int ch) const { return Valid(ch) ? present_[ch] : 0.0f; }
    int Channels() const { return channels_; }

private:
    static constexpr int kMaxChannels = 48;
    static constexpr float kNever = 1e9f;

    bool Valid(int ch) const { return ch >= 0 && ch < channels_; }

    void WriteChannel(int ch, float deg) const {
        int b = ch / 16, c = ch % 16;
        if (b >= board_count_) return;
        boards_[b].SetAngle(c, deg);
    }

    const BankBoard* boards_ = nullptr;
    int board_count_ = 0;
    int channels_ = 0;
    float max_rate_ = 360.0f;
    bool relaxed_ = false;
    float trim_[kMaxChannels];
    float limit_lo_[kMaxChannels];
    float limit_hi_[kMaxChannels];
    float target_[kMaxChannels];
    float present_[kMaxChannels];
    float last_written_[kMaxChannels];
    bool armed_[kMaxChannels];
};

#if defined(OCTO_USE_ESP_IDF)
inline int I2cWriteIdf(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    (void)addr;
    i2c_master_dev_handle_t dev = *static_cast<i2c_master_dev_handle_t*>(ctx);
    uint8_t buf[8];
    if (len + 1 > sizeof(buf)) return -1;
    buf[0] = reg;
    for (size_t i = 0; i < len; i++) buf[i + 1] = data[i];
    return i2c_master_transmit(dev, buf, len + 1, 100);
}
#elif defined(OCTO_USE_ARDUINO)
inline int I2cWriteArduino(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    TwoWire* wire = static_cast<TwoWire*>(ctx);
    wire->beginTransmission(addr);
    wire->write(reg);
    for (size_t i = 0; i < len; i++) wire->write(data[i]);
    return wire->endTransmission() == 0 ? 0 : -1;
}
#endif

}  // namespace octo
`,"octopus_plus/octopus_body.h":`#pragma once
// OctopusBody（完善版）：步态发生器 + 舵机总线 + 50 Hz 运动任务。基于 md 的 octopus_body.h，改动处标「我的补充」。
//
// 我的补充：所有指令（走 / 停 / 挥手 / 回中位 / 调参）都通过 FreeRTOS 队列交给运动任务，
// 只有运动任务写舵机，loop()、BLE 回调、MCP 回调都不再直接动 bank_（md 里存在两边同时写的竞争）。

#include <cmath>
#include <cstdint>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"

#include "octopus_gait.h"
#include "octopus_bus.h"

namespace octo {

enum class RigType {
    kSingle8,   // 方案 A：8 路，每条触手 1 个偏航舵机
    kDual16,    // 方案 B：16 路，每条触手 偏航 + 俯仰
    kTendon24,  // md 方案 C（完善版未改动、未验证）
};

inline int ChannelsFor(RigType rig) {
    switch (rig) {
        case RigType::kSingle8:  return 8;
        case RigType::kDual16:   return 16;
        case RigType::kTendon24: return 24;
    }
    return 8;
}

inline int ChannelOf(RigType rig, int arm, int slot) {
    switch (rig) {
        case RigType::kSingle8:  return arm;
        case RigType::kDual16:   return arm * 2 + slot;
        case RigType::kTendon24: return arm * 3 + slot;
    }
    return arm;
}

class OctopusBody {
public:
    static constexpr const char* kTag = "OctopusBody";

    // 我的补充：相邻触手机械间隙（°，按 3D 结构估算，需实物验证）
    static constexpr float kMinGapA = 12.0f;
    static constexpr float kMinGapB = 16.0f;
#if OCTO_V10
    // 我的补充 · v10：舵机橙线接的 QT Py 焊盘 A0 A1 A2 SDA SCL TX RX SCK → GPIO（Adafruit 5426 引脚图）
    static constexpr uint8_t kV10Pins[8] = {18, 17, 9, 7, 6, 5, 16, 36};
    // v10 短触手：2D 轮廓扫 ±55°，夹角 < −35° 才碰；+5° 余量 = −30（限位内等于不需要防撞）
    static constexpr float kMinGapV10 = -30.0f;
#endif

    ~OctopusBody() { Stop(); }

    bool Init(RigType rig, void* i2c_ctx, Pca9685::WriteFn write_fn) {
        rig_ = rig;
        channels_ = ChannelsFor(rig);
        board_count_ = (channels_ + 15) / 16;

#if OCTO_V10
        (void)i2c_ctx; (void)write_fn;
        board_count_ = 1;
        if (!boards_[0].Init(kV10Pins, 8)) { ESP_LOGE(kTag, "ledcAttach failed"); return false; }
#else
        for (int i = 0; i < board_count_; i++) {
            boards_[i] = Pca9685(static_cast<uint8_t>(Pca9685::kBaseAddr + i));
            if (!boards_[i].Init(i2c_ctx, write_fn, 50.0f)) {
                ESP_LOGE(kTag, "PCA9685 #%d (0x%02X) init failed", i, Pca9685::kBaseAddr + i);
                return false;
            }
        }
#endif

        bank_.Bind(boards_, board_count_);
        bank_.Begin(channels_, kHome);
        bank_.SetMaxRate(300.0f);
        // 我的补充：每路软件限位 90°±55°（md §8 提到 SetLimit 但代码没调用）
        for (int i = 0; i < channels_; i++) bank_.SetLimit(i, kHome - 55.0f, kHome + 55.0f);

        // 我的补充：完善版默认步态（估算，台面里调出来的）
        GaitParams p;
        if (rig_ == RigType::kDual16) {
            p.freq_hz = 0.6f; p.yaw_amp_deg = 20.0f; p.lift_amp_deg = 25.0f; p.phase_deg = 180.0f; p.duty = 0.55f; p.press_deg = 20.0f;  // v9：两组交替 + 支撑相下压（物理仿真实测，我的补充）
        } else {
            p.freq_hz = 0.6f; p.yaw_amp_deg = 30.0f; p.lift_amp_deg = 20.0f; p.phase_deg = 45.0f; p.duty = 0.6f;
        }
        gait_.SetParams(p);
        gait_.SetSpinTurn(rig_ == RigType::kDual16);

        queue_ = xQueueCreate(8, sizeof(Cmd));
        return queue_ != nullptr;
    }

    // 我的补充：真正逐路上电。每路直接写到中位并 Arm，路与路之间隔 150 ms（舵机上电位置未知，只能错开）。
    // 只在 Start() 之前调用；运动任务跑起来之后用 Home()。
    void SoftHomeBlocking() {
        for (int i = 0; i < channels_; i++) {
            bank_.SetTarget(i, kHome);
            bank_.ArmNow(i);
            vTaskDelay(pdMS_TO_TICKS(150));
        }
    }

    void Start() {
        if (task_) return;
        running_ = true;
        xTaskCreatePinnedToCore(&OctopusBody::TaskEntry, "octo_motion", 4096, this, 6, &task_, 0);
    }

    void Stop() {
        if (!task_) return;
        running_ = false;
        vTaskDelay(pdMS_TO_TICKS(100));   // 任务自己退出并删除
        task_ = nullptr;
    }

    // ---------- 运动指令（线程安全：只入队） ----------
    void SetVelocity(float throttle, float steer, int cycles = 0) { Post({CmdType::kGait, throttle, steer, cycles, {}}); }
    void Rest()                 { Post({CmdType::kRest, 0, 0, 0, {}}); }
    // 我的补充 · v10 低电：不回中位，立刻停 PWM（舵机放松、不再耗电）。回中位时 8 个舵机一起动的电流会把快没电的单节电池拉到 QT Py 欠压复位（仿真估算）
    void RelaxNow()             { Post({CmdType::kRelax, 0, 0, 0, {}}); }
    void Home()                 { Post({CmdType::kHome, 0, 0, 0, {}}); }
    void WaveOnce(int arm)      { Post({CmdType::kWave, 0, 0, arm, {}}); }
    void Pulse(int times)       { Post({CmdType::kPulse, 0, 0, times, {}}); }
    void SetGaitParams(const GaitParams& p) { Post({CmdType::kParams, 0, 0, 0, p}); }

    // 读快照只读 Params()，不写（float 读写在 ESP32 上是原子的）
    GaitParams GaitParamsSnapshot() const { return gait_.Params(); }

    RigType Rig() const { return rig_; }
    int Channels() const { return channels_; }
    bool Relaxed() const { return bank_.Relaxed(); }

private:
    enum class Mode { kIdle, kGait, kWave, kPulse, kHoming };
    enum class CmdType { kGait, kRest, kHome, kWave, kPulse, kParams, kRelax };
    struct Cmd {
        CmdType type;
        float throttle;
        float steer;
        int n;            // gait：周期数（0 = 不限）；wave：触手号；pulse：次数
        GaitParams params;
    };

    static constexpr float kHome = 90.0f;

    void Post(const Cmd& c) { if (queue_) xQueueSend(queue_, &c, pdMS_TO_TICKS(20)); }

    static void TaskEntry(void* arg) { static_cast<OctopusBody*>(arg)->TaskLoop(); }

    void TaskLoop() {
        const TickType_t period = pdMS_TO_TICKS(20);  // 50 Hz
        TickType_t last = xTaskGetTickCount();
        while (running_) {
            Cmd c;
            while (xQueueReceive(queue_, &c, 0) == pdTRUE) Apply(c);
            Step(0.02f);
            vTaskDelayUntil(&last, period);
        }
        bank_.ReleaseAll();
        vTaskDelete(nullptr);
    }

    void Apply(const Cmd& c) {
        switch (c.type) {
            case CmdType::kGait:
                gait_.SetThrottle(c.throttle);
                gait_.SetSteer(c.steer);
                cycles_left_ = c.n;
                cycle_mark_ = gait_.Cycles();
                Enter(Mode::kGait);
                break;
            case CmdType::kRest:
                Enter(Mode::kIdle);
                want_relax_ = true;
                bank_.ReleaseAll();               // 我的补充：只改目标，由限速慢慢回中位
                break;
            case CmdType::kRelax:
                Enter(Mode::kIdle);
                want_relax_ = false;
                bank_.Relax();                     // 我的补充：立刻 FULL OFF / 占空比 0
                break;
            case CmdType::kHome:
                Enter(Mode::kHoming);              // 我的补充：先停步态，再一路一路回中位
                home_idx_ = 0;
                home_timer_ = 0.0f;
                break;
            case CmdType::kWave:
                gait_.Reset();
                wave_arm_ = ((c.n % kArmCount) + kArmCount) % kArmCount;
                wave_timer_ = 0.0f;
                Enter(Mode::kWave);
                break;
            case CmdType::kPulse:
                pulse_left_ = c.n < 1 ? 1 : c.n;
                pulse_timer_ = 0.0f;
                Enter(Mode::kPulse);
                break;
            case CmdType::kParams:
                gait_.SetParams(c.params);
                break;
        }
    }

    void Enter(Mode m) {
        mode_ = m;
        if (m != Mode::kIdle) { want_relax_ = false; idle_t_ = 0.0f; bank_.Wake(); }
    }

    void Step(float dt) {
        switch (mode_) {
            case Mode::kGait:   StepGait(dt);   break;
            case Mode::kWave:   StepWave(dt);   break;
            case Mode::kPulse:  StepPulse(dt);  break;
            case Mode::kHoming: StepHoming(dt); break;
            case Mode::kIdle:
            default:            StepIdle();     break;
        }
        RelaxCheck(dt);
        bank_.Tick(dt);
    }

    // 我的补充：Rest 之后全部到位、静止 1 s → FULL OFF
    void RelaxCheck(float dt) {
        if (mode_ != Mode::kIdle || !want_relax_ || bank_.Relaxed()) { idle_t_ = 0.0f; return; }
        idle_t_ = bank_.Settled() ? idle_t_ + dt : 0.0f;
        if (idle_t_ >= 1.0f) { bank_.Relax(); ESP_LOGI(kTag, "relaxed (FULL OFF)"); }
    }

    void WriteArm(int arm, float yaw_deg, float lift_deg) {
        arm %= kArmCount;
        if (rig_ == RigType::kSingle8) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), kHome + yaw_deg);
        } else if (rig_ == RigType::kDual16) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), kHome + yaw_deg);
            bank_.SetTarget(ChannelOf(rig_, arm, 1), kHome + lift_deg);
        } else {
            float phi = yaw_deg * static_cast<float>(M_PI) / 180.0f;
            float curve = 0.25f + lift_deg / 90.0f;
            for (int j = 0; j < 3; j++) {
                float theta = 2.0f * static_cast<float>(M_PI) * j / 3.0f;
                bank_.SetTarget(ChannelOf(rig_, arm, j), kHome + std::cos(phi - theta) * curve * 30.0f);
            }
        }
    }

    void StepGait(float dt) {
        gait_.Tick(dt);
        // 我的补充：MCP steps → 走够周期数自动 Rest
        if (cycles_left_ > 0 && gait_.Cycles() - cycle_mark_ >= static_cast<uint32_t>(cycles_left_)) {
            cycles_left_ = 0;
            Apply({CmdType::kRest, 0, 0, 0, {}});
            return;
        }
        float yaw[kArmCount];
        for (int a = 0; a < kArmCount; a++) yaw[a] = gait_.Yaw(a);
        // 我的补充：邻臂防撞
#if OCTO_V10
        AntiCollide(yaw, kMinGapV10);
#else
        AntiCollide(yaw, (rig_ == RigType::kDual16 ? kMinGapB : kMinGapA) + 3.0f);
#endif
        for (int a = 0; a < kArmCount; a++) WriteArm(a, yaw[a], gait_.Lift(a));
    }

    void StepWave(float dt) {
        wave_timer_ += dt;
        const float dur = 1.2f;
        if (wave_timer_ >= dur) { mode_ = Mode::kIdle; return; }
        float k = wave_timer_ / dur;
        float env = std::sin(k * static_cast<float>(M_PI));
        for (int a = 0; a < kArmCount; a++) {
            if (rig_ == RigType::kSingle8) {
                // 我的补充：8 舵机版用偏航来回摆表示挥手
                WriteArm(a, a == wave_arm_ ? env * 40.0f * std::sin(k * 6.0f * static_cast<float>(M_PI)) : 0.0f, 0.0f);
            } else {
                WriteArm(a, 0.0f, a == wave_arm_ ? env * 45.0f : 0.0f);
            }
        }
    }

    void StepPulse(float dt) {
        pulse_timer_ += dt;
        if (pulse_timer_ >= pulse_period_) {
            pulse_timer_ = 0.0f;
            if (--pulse_left_ <= 0) { mode_ = Mode::kIdle; return; }
        }
        float k = pulse_timer_ / pulse_period_;
        float curl = std::sin(k * static_cast<float>(M_PI)) * 40.0f;
        for (int a = 0; a < kArmCount; a++) {
            if (rig_ == RigType::kSingle8) WriteArm(a, (a % 2 ? 1.0f : -1.0f) * curl * 0.6f, 0.0f);  // 我的补充
            else WriteArm(a, 0.0f, curl);
        }
    }

    // 我的补充：运动任务里的逐路回中位（每 150 ms 一路）
    void StepHoming(float dt) {
        gait_.Reset();
        home_timer_ -= dt;
        if (home_timer_ > 0.0f) return;
        if (home_idx_ >= channels_) { mode_ = Mode::kIdle; return; }
        bank_.SetTarget(home_idx_++, kHome);
        home_timer_ = 0.15f;
    }

    void StepIdle() {
        gait_.Reset();
        for (int a = 0; a < kArmCount; a++) WriteArm(a, 0.0f, 0.0f);
    }

    RigType rig_ = RigType::kSingle8;
    int channels_ = 8;
    int board_count_ = 1;

    BankBoard boards_[3];     // 需要 Pca9685 默认构造（我的补充）
    ServoBank bank_;
    Gait gait_;

    QueueHandle_t queue_ = nullptr;
    Mode mode_ = Mode::kIdle;
    TaskHandle_t task_ = nullptr;
    volatile bool running_ = false;

    bool want_relax_ = false;
    float idle_t_ = 0.0f;
    int cycles_left_ = 0;
    uint32_t cycle_mark_ = 0;
    int home_idx_ = 0;
    float home_timer_ = 0.0f;
    int wave_arm_ = 0;
    float wave_timer_ = 0.0f;
    int pulse_left_ = 0;
    float pulse_period_ = 0.6f;
    float pulse_timer_ = 0.0f;
};

}  // namespace octo
`,"octopus_plus/octopus_batt.h":`#pragma once
// 我的补充：3S 电池电压检测（md 没有这一部分的完整实现）。
//   GPIO10 = ADC1_CH9（ESP32-S3 数据手册；ADC1 不受 WiFi 影响）
//   分压 100 kΩ（上）/ 22 kΩ（下），12.6 V → 2.27 V；ADC 脚对地并 0.1 µF
//   11 dB 衰减，analogReadMilliVolts() 用芯片里的校准值，量程约 0–2900 mV
//   低于 9.6 V（3 × 3.2 V，估算）停运动，回到 10.2 V 才恢复（迟滞，防止反复启停）

#include <Arduino.h>
#ifndef OCTO_V10
#define OCTO_V10 0
#endif

namespace octo {

class Battery {
public:
#if OCTO_V10
    // 我的补充 · v10：1S LiPo，100k / 100k 分压 → A3（GPIO8，ADC1_CH7），4.2 V → 2.1 V。
    // 3.55 V 停运动、3.75 V 恢复（估算）：保护板 3.0 V 才切，但 BAT 焊盘二极管 + LDO 让 QT Py 在电芯带载约 3.4 V 以下掉电复位，所以提前停
    static constexpr int   kPin       = 8;
    static constexpr float kRatio     = 2.0f;
    static constexpr float kCutoff    = 3.55f;
    static constexpr float kResume    = 3.75f;
#else
    static constexpr int   kPin       = 10;
    static constexpr float kRatio     = (100.0f + 22.0f) / 22.0f;
    static constexpr float kCutoff    = 9.6f;
    static constexpr float kResume    = 10.2f;
#endif

    void Begin() {
        pinMode(kPin, INPUT);
        analogSetPinAttenuation(kPin, ADC_11db);
        Update();   // 我的补充：开机先读一次，电池低就从一开始拒绝动作指令
    }

    // 16 次平均，返回电池电压（V）
    float Read() {
        uint32_t mv = 0;
        for (int i = 0; i < 16; i++) mv += analogReadMilliVolts(kPin);
        volts_ = (mv / 16.0f / 1000.0f) * kRatio;
        return volts_;
    }

    // 返回 true 表示状态刚刚变化
    bool Update() {
        float v = Read();
        if (!low_ && v < kCutoff) { low_ = true; return true; }
        if (low_ && v > kResume)  { low_ = false; return true; }
        return false;
    }

    bool Low() const { return low_; }
    float Volts() const { return volts_; }

private:
    bool low_ = false;
    float volts_ = 0.0f;
};

}  // namespace octo
`,"xiaozhi/octopus_mcp.cpp":`// 小智 MCP 工具（完善版 / 我的补充）—— 基于 md 的 octopus_mcp.cpp。
// ⚠️ 这个文件依赖 xiaozhi-esp32 工程里的 mcp_server.h，本仓库里没有编译过（未实机编译），
//    AddTool 的参数写法沿用 md；如果你的 fork 报错，对照 main/boards/otto-robot/ 改参数包即可。
// 放法：main/boards/octopus/octopus_mcp.cpp，同目录放完善版的 octopus_gait.h / octopus_bus.h / octopus_body.h，
//       板子初始化里先 body.Init(...) → body.SoftHomeBlocking() → body.Start()，再调 RegisterOctopusTools(body)。
// 改动（我的补充）：home 真的回中位；steps 生效；speed 夹到 ≥ 834 ms（≤ 1.2 Hz）；所有调用只入队，由运动任务写舵机。
#include <string>

#include "mcp_server.h"
#include "octopus_body.h"

namespace {

octo::OctopusBody* g_body = nullptr;

}  // namespace

void RegisterOctopusTools(octo::OctopusBody& body) {
    g_body = &body;

    auto& mcp = McpServer::GetInstance();

    // 统一动作接口：大模型只需要决定 action 和几个数值参数
    mcp.AddTool(
        "self.octopus.action",
        "执行八爪鱼动作。"
        "action 取值："
        "crawl(爬行, 需 steps/speed/direction 参数)、"
        "wave(用某条触手挥手, 需 arm 参数)、"
        "pulse(八触手同步收缩, 像水母脉冲, 需 steps)、"
        "rest(停止并放松)、"
        "home(回到中位)。"
        "direction: -100 全左转, 0 直行, +100 全右转。"
        "speed: 每个步态周期的毫秒数, 数值越小越快, 834-3000（小于 834 按 834）。",
        PropertyList({
            Property("action", kPropertyTypeString, "crawl"),
            Property("steps", kPropertyTypeInteger, 3, 1, 100),
            Property("direction", kPropertyTypeInteger, 0, -100, 100),
            Property("speed", kPropertyTypeInteger, 1000, 300, 3000),
            Property("arm", kPropertyTypeInteger, 0, 0, 7),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");

            std::string action = props["action"].value<std::string>();
            int steps = props["steps"].value<int>();
            int dir = props["direction"].value<int>();
            int speed = props["speed"].value<int>();
            int arm = props["arm"].value<int>();

            // 我的补充：speed 是毫秒为单位的周期；夹到 ≥ 834 ms（≈1.2 Hz，md 写的舵机上限）
            if (speed < 834) speed = 834;
            float hz = 1000.0f / static_cast<float>(speed);
            if (steps < 1) steps = 1;

            if (action == "crawl") {
                auto p = b->GaitParamsSnapshot();
                p.freq_hz = hz;
                b->SetGaitParams(p);
                b->SetVelocity(1.0f, dir / 100.0f * 0.6f, steps);   // 我的补充：走够 steps 个周期自动停
                return std::string("开始爬行");
            } else if (action == "wave") {
                b->WaveOnce(arm);
                return std::string("挥手");
            } else if (action == "pulse") {
                b->Pulse(steps);
                return std::string("脉冲收缩");
            } else if (action == "rest") {
                b->Rest();
                return std::string("已放松");
            } else if (action == "home") {
                b->Home();   // 我的补充：md 这里调的是 Rest
                return std::string("已回中位");
            }
            return std::string("未知动作: ") + action;
        });

    // 单独一个调步态的工具：把「怎么走」和「做什么动作」分开，方便大模型微调
    mcp.AddTool(
        "self.octopus.set_gait",
        "微调步态参数，不改变当前是否在动。"
        "freq 按 x10 倍传入（例如 6 表示 0.6Hz，超过 12 舵机就跟不上了），"
        "amplitude 是触手摆幅角度（0-60），"
        "phase 是相邻触手相位差：0 表示八条同步，45 表示环形逆行波（最像真章鱼），180 表示交替步态。",
        PropertyList({
            Property("freq", kPropertyTypeInteger, 6, 2, 20),
            Property("amplitude", kPropertyTypeInteger, 38, 0, 60),
            Property("phase", kPropertyTypeInteger, 45, 0, 180),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");
            octo::GaitParams p = b->GaitParamsSnapshot();
            // 我的补充：freq 上限 12（1.2 Hz）
            p.freq_hz = (props["freq"].value<int>() > 12 ? 12 : props["freq"].value<int>()) / 10.0f;
            p.yaw_amp_deg = static_cast<float>(props["amplitude"].value<int>());
            p.phase_deg = static_cast<float>(props["phase"].value<int>());
            b->SetGaitParams(p);
            return std::string("步态已更新");
        });
}

// ---------------------------------------------------------------------------
// 配套：粘贴到 xiaozhi.me 控制台的「角色人设」里，动作才有灵魂。
// 这个模板是照 otto-robot 的 README 改的，实测能让大模型主动调用动作，
// 而不是等你追问。
//
//   我的身份：我是一只八爪鱼机器人，有八条灵活的触手，能爬行、挥手、脉冲收缩。
//
//   我的动作能力（通过 self.octopus.action 调用）：
//   - crawl：爬行，用 steps 控制步数，direction 控制方向
//   - wave：指定某条触手挥手打招呼，arm 取值 0-7
//   - pulse：八条触手同步收缩，像水母一样，表达害怕或兴奋
//   - rest：停下来放松
//
//   我的性格：我很活泼，说话前会先做一个相应的动作表达情绪（先发动作指令再说话）。
//   打招呼时会 wave，高兴时会 pulse，被夸奖时会 crawl 转一圈，累了就 rest。
//   根据对话内容选择合适的动作，不要每次都一样。
// ---------------------------------------------------------------------------
`,"小智八爪鱼-完善版.md":`# 小智八爪鱼 · 完善版（我的补充）

> 早期原型，简化仿真。本文在你给的 md（README / 采购清单 / 手机控制指南 / 无线架构 / 4 个代码文件）基础上整理。
> **凡是 md 没写清楚、写错或互相矛盾的地方，我都按自己的判断补上了，并标注「我的补充」。**
> 依据分三种：**datasheet**（芯片 / 模块资料里查得到的事实）、**推理**（读 md 代码或简单计算）、**估算**（仿真台面或经验值，必须实物验证）。
> 价格只抄 md；md 没写价格的件写“md 无价格”，不编数字。所有电流、速度、间隙数字都来自仿真台面，属于估算。

## 0. 一句话

和 md 一样：8 个带相位差的振荡器（CPG）驱动 8 条触手，动作注册成小智 MCP 工具。
完善版改了三件大事（我的补充）：**供电改 3S**、**步态改成左右镜像扫动（能直行、能转弯、不打架）**、**固件能在 ESP32‑S3 上编译**（BLE 代替经典蓝牙）。

## 1. 方案命名（我的补充）

md 里“方案 A”有两个意思，.ino 又写死 16 路。完善版统一为：

| | 方案 A | 方案 B |
|---|---|---|
| 每条触手 | 1 个舵机（偏航） | 2 个舵机（偏航 + 俯仰） |
| 舵机总数 | 8（\`RigType::kSingle8\`） | 16（\`RigType::kDual16\`） |
| 固件开关 | \`#define OCTO_RIG 8\` | \`#define OCTO_RIG 16\` |
| 怎么走（估算） | 镜像扫 + 2 个万向球 + 触手尖单向防滑垫，差速转弯 | v9：交替步态（phase 180，duty 0.55）+ 支撑相俯仰下压 20° 把机身撑离桌面，原地转（v8 的同步划水 phase 0 在物理仿真里走 0 cm） |
| 默认步态（估算） | f 0.6 Hz, yaw 30°, phase 45°, duty 0.6 | f 0.6 Hz, yaw 20°（v8 由 15° 调大，见下）, lift 25°, phase 0°, duty 0.5 |

“手机蓝牙手动控制”改叫 **控制方式：手机 BLE**，A / B 都能用；**控制方式：小智语音（MCP）** 也是 A / B 都能用。md 的方案 C（腱绳 24 路）完善版没改、没验证。

## 2. 供电（我的补充）

\`\`\`
3S 锂电组 11.1 V（满 12.6 V / 截止 9.6 V，带 3S 保护板）
  └─ 主开关 ─ 保险丝（规格估算 5 A）
       ├─ XL4015 U1 → 6.0 V → PCA9685 V+ 螺丝端子 → 舵机
       ├─ XL4015 U2 → 5.0 V → DevKitC-1 的 5V 脚（J1 第 21 脚）
       └─ 100 kΩ / 22 kΩ 分压 → GPIO10（ADC1_CH9），ADC 脚对地 0.1 µF
GND 全部共地；PCA9685 V+ 端子并 220 µF，每个舵机插头旁再一个 220 µF
充电：3S 平衡充电器（不要用 TP4056）
\`\`\`

为什么：

- **XL4015 只有一路输出**（datasheet），md 一块做不出 6 V + 5 V，所以用两块。
- **XL4015 输入 8–36 V**（datasheet）：2S 电池 6.4–8.4 V 大部分时间低于下限；3S 9.6–12.6 V 全程在范围内。
- **TP4056 是单节 4.2 V 充电芯片**（datasheet），不能给串联电池组充。
- 分压 100k/22k：12.6 V → 2.27 V，在 ESP32‑S3 11 dB 衰减的校准量程（约 0–2900 mV，datasheet）里。
- DevKitC-1 丝印是 **5V**，没有 VIN（DevKitC-1 用户指南）。
- 电池外形按 3 节 18650（Φ18×65 mm）摆，容量 md 没写，自己按续航选。

## 3. 接线（补齐 md 没写的脚，我的补充）

| ESP32‑S3 | 外设 | 备注 |
|---|---|---|
| GPIO8 / GPIO9 | PCA9685 SDA / SCL，OLED SDA / SCL | 按 README / .ino（采购清单第二批写的 GPIO1/2 不用） |
| 3V3 / GND | PCA9685 VCC / GND | 只给逻辑供电 |
| GND | PCA9685 **OE** | OE 低有效，接地 = 常开输出 |
| GPIO5 / 4 / 6 | INMP441 SCK / WS / SD | INMP441 **VDD → 3V3，L/R → GND**（左声道） |
| GPIO15 / 16 / 7 | MAX98357A BCLK / LRC / DIN | MAX98357A **VIN → 5V** |
| 3V3 | OLED VCC | |
| GPIO10 | 电池分压中点 | **不用 GPIO4**（已是麦克风 WS） |

语音件只在“小智语音”玩法里装；“手机 BLE”玩法不需要麦克风 / 功放 / OLED。

## 4. 固件（完善版）

指南页可以下载：\`octopus_plus/\`（.ino + 4 个头文件）和 \`xiaozhi/octopus_mcp.cpp\`。

- **octopus_plus.ino**：Arduino（arduino-esp32 3.x，ESP32S3 Dev Module）。v8（2026-10-30）用 arduino-cli 1.5.1 + esp32:esp32 3.3.12 重新编译通过：OCTO_RIG 8 / 16 都是程序 620 776 B（47%）、全局变量 30 720 B（9%），我们自己的文件 0 个 warning（\`scripts/fw-compile.sh\`）。未上实物。
- **xiaozhi/octopus_mcp.cpp**：依赖 xiaozhi-esp32 的 \`mcp_server.h\`。v8 只做了**桩编译**：对着上游 xiaozhi-esp32 提交 addb1ed 的 \`mcp_server.h\`（原样下载，需 \`-std=gnu++23\`，见 stub_compile/build_opt.h）+ 空实现的 McpServer（\`stub_compile/mcp_server_stub.cpp\`）编译链接通过、0 warning。这只证明语法和 AddTool/Property 参数对得上，**不是**在小智工程里的真编译。

改动一览（都在代码里标了 \`我的补充\`）：

1. BLE Nordic UART（服务 \`6E400001-B5A3-F393-E0A9-E50E24DCCA9E\`，RX \`…0002\` 写，TX \`…0003\` 通知）代替 BluetoothSerial：ESP32‑S3 只有低功耗蓝牙（datasheet）。
2. \`Pca9685\` 加默认构造（\`boards_[3]\` 需要）；\`Init()\` 的返回值判断修正（md 的 \`Write()\` 成功返回 true，又拿 \`!= 0\` 当失败，写成功反而返回 false）。
3. \`Init()\`：SLEEP|AI → 预分频 → AI → **等 500 µs** → RESTART|AI → MODE2 推挽（datasheet：振荡器最长 500 µs 稳定）。
4. 脉宽 0.5–2.5 ms = 计数 102–512（50 Hz），90° = 1.5 ms（推理；具体舵机以实测为准，每路仍用 \`SetTrim\` 校准）。
5. \`last_written_\` 初值“从未写过”，\`SoftHomeBlocking()\` 每路直接写出并 Arm，路间隔 150 ms：真正分时上电。
6. 所有指令进 FreeRTOS 队列，**只有运动任务写舵机**；REST 按限速回中位，静止 1 s 后 FULL OFF（LEDn_OFF_H bit4，datasheet），下个指令自动唤醒。
7. 每路软件限位 90°±55°；**邻臂防撞** AntiCollide（相邻夹角 ≥ 机械间隙 + 3°，间隙 A 12° / B 16°。B 的 16° 是 v8 在 3D 碰撞体上实测：相邻两个模块夹角到 13° 才接触，再加 3° 余量；v7 的 40° 把两个模块当成绕躯干中心转来算，过于保守，把 B 的摆幅压到了约 ±6°）。
8. 新步态：左右舷按 cos(安装角) 区分，左右镜像；转弯增益夹在 1 以内（md 的 1.85 × 38° ≈ 70° 超过 45° 间隔）。
9. \`GAIT\` 指令大小写都行；频率夹到 ≤ 1.2 Hz。
10. kSingle8 下 WAVE / PULSE 用偏航舵机表达。
11. MCP：home 真的回中位；steps 生效；speed ≥ 834 ms（≈1.2 Hz）。
12. 电池：GPIO10，16 次平均，< 9.6 V 停运动只留通信，> 10.2 V 恢复（阈值估算）。

## 5. 手机 BLE 控制（我的补充）

用任意 BLE 串口 App（例如 nRF Toolbox 的 UART），连 **OctoBrain**，发：

\`GO\` \`LEFT\` \`RIGHT\` \`STOP\` \`HOME\` \`WAVE 3\` \`PULSE 2\` \`GAIT f=0.5 yaw=25\` \`BATT\`

**AUTO_REST**：15 s 没收到指令会自动停（md 的安全特性，保留）。想一直走，让 App 每 5 s 重发一次 \`GO\`（心跳）。

## 6. 物料（只用 md 价格，我的补充）

| 类别 | 型号 | 数量 | 价格 | 出处 |
|---|---|---|---|---|
| 主控 | ESP32-S3-DevKitC-1（或兼容） | 1 | ¥25~35 | 采购清单 无线化 |
| 舵机驱动 | PCA9685 16 路 | 1 | ¥12~25 | 采购清单 第二批 |
| 舵机（A） | MG90S 金属齿 | 8 | ¥40~64 | 采购清单 ¥5~8/个 |
| 舵机（B） | MG90S 金属齿 | 16 | ¥80~128 | 采购清单 ¥5~8/个 |
| 降压 | XL4015 ×2 | 2 | ¥16 | 采购清单 ¥8 × 2 |
| 电池 | 3S 锂电组 11.1 V + 3S 保护板 | 1 | md 无价格 | 我的补充 |
| 充电 | 3S 平衡充电器 | 1 | md 无价格 | 我的补充 |
| 电池检测 | 100 kΩ + 22 kΩ + 0.1 µF | 1 | md 无价格 | 我的补充 |
| 电源 | 主开关 + 保险丝（规格估算 5 A） | 1 | md 无价格 | 我的补充 |
| 电容 | 220 µF 电解 | A 9 / B 17 | A ¥9 / B ¥15 | 采购清单 ¥3/4 个 |
| 结构 | PLA 耗材 | 1 kg | ¥50 | 采购清单 第三批 |
| 方案 A 脚 | 万向球 ×2 + 防滑垫 | 1 套 | md 无价格 | 我的补充 |
| 语音（可选） | INMP441 / MAX98357A / 喇叭 / OLED | 各 1 | ¥5 / ¥6 / ¥4 / ¥10 | README §3 |

md 有价格部分（不含语音件）：**方案 A ≈ ¥152~201，方案 B ≈ ¥198~271**；没含 md 无价格的新增件。
md 里 MG90S 有三个价格（¥12、¥5~8/个、12 个 ¥60~95），完善版统一按采购清单 ¥5~8/个；README 的“合计约 ¥350”和逐项相加对不上，不再引用。

## 7. 推进顺序（同 md，补两点）

0. 小智语音链路跑通 → 1. 1 个舵机 + 最小 MCP → 2. PCA9685 + **两块 XL4015** + 3S 电池，先测 6.0 V / 5.0 V 再接负载 → 3. 组装 → 4. 调 CPG → 5. 升级。

- 第 2 步先只接 4 路，用万用表看电池电流；电流峰值的数字以你的实测为准（md 两处数字 2.3→1.3 A 和“3~5 A”互相矛盾，完善版不引用，台面里的电流是估算）。
- 方案 B 在 10 cm 躯干里相邻两条几乎没有摆动空间（台面几何估算）：现实中建议把俯仰舵机径向安装，或者加大躯干。

## 8. 还是仿真 / 未验证的部分

- 摩擦、步态速度、电流、机械间隙：仿真台面的简化模型，需要实物验证。
- \`octopus_mcp.cpp\`：只做过桩编译（上游 mcp_server.h + 空 McpServer），没在 xiaozhi-esp32 工程里编译。
- md 原样的 body_firmware_A.ino：ESP32‑S3 上编译失败（S3 没有经典蓝牙 \`BluetoothSerial\`；另外 \`OctopusBody\` 缺默认构造，\`Pca9685\` 没有无参构造），换经典 ESP32 也因后两条失败。
- \`octopus_plus.ino\`：编译通过（v8 复测），未上实物。
- 方案 C（腱绳）：沿用 md，未改动。

## 9. 改正的文字问题

- 无线架构里“立创实战派”一处乱码，已改正。
- “ESP32 的 VIN/5V 引脚” → “DevKitC-1 的 5V 脚（J1 第 21 脚）”。
- 方案 A 电源示意的“16 路舵机” → “8 路舵机”。
- 不再引用 MT3608 升压 / 照抄 xiaozhi-esp32-pet 的 BSP（本方案是降压供电）。
`},be={"body_firmware_A.ino":me,"octopus_bus.h":he,"octopus_gait.h":ge,"octopus_body.h":_e,"octopus_mcp.cpp":ve},xe={note:`价格全部来自你的 md（2026 年给的文档），台面物料表不写价格。md 没有单独的方案 A 物料表，README §2 只写了“舵机成本 ~60 元”。`,readmeB:{src:`README §3 物料清单（方案 B）`,rows:[[`主控`,`ESP32-S3 N16R8 开发板`,`1`,`¥45`],[`麦克风`,`INMP441 数字麦克风`,`1`,`¥5`],[`功放`,`MAX98357A 模块`,`1`,`¥6`],[`喇叭`,`8Ω 2W 小喇叭`,`1`,`¥4`],[`屏幕`,`SSD1306 OLED 0.96"（可选）`,`1`,`¥10`],[`舵机驱动`,`PCA9685 16 路模块`,`1`,`¥12`],[`舵机`,`MG90S 金属齿（别用 SG90）`,`16`,`¥12`],[`降压`,`XL4015 DC-DC 5A`,`1`,`¥8`],[`电池`,`2S 航模/21700 电池组 7.4V`,`1`,`¥35`],[`充电`,`2S 平衡充 / TP4056×2`,`1`,`¥15`],[`被动件`,`220µF 电解电容、端子、杜邦线`,`若干`,`¥15`],[`结构`,`PLA 打印料 ~200g`,`1`,`¥20`]],total:`md 写“合计约 ¥350”（按表逐项加：舵机按单价 ×16 是 ¥367；按 ¥12 总价是 ¥187——md 没说清 ¥12 是单价还是总价）`},servoCost:{src:`README §2 三档方案选型`,rows:[[`方案 A`,`~60 元`],[`方案 B`,`~150 元`],[`方案 C`,`~250 元`]]},batches:{src:`采购清单-零基础`,rows:[[`第一批`,`立创·实战派 ESP32-S3 开发板 ×1`,`¥148`],[`第二批`,`PCA9685 ×1`,`¥12~25`],[`第二批`,`MG90S ×4`,`¥5~8/个`],[`第二批`,`5V 6A 电源适配器`,`¥20~30`],[`第二批`,`DC 母头转接线`,`¥3`],[`第二批`,`杜邦线一套`,`¥6`],[`第二批`,`小号十字螺丝刀`,`¥5`],[`第三批`,`MG90S 再买 12 个`,`¥60~95`],[`第三批`,`PLA 耗材 1kg`,`¥50`],[`第三批`,`220µF 电解电容 ×4`,`¥3`],[`第三批`,`扎带 / 双面胶 / 热熔胶枪`,`¥20`],[`无线化`,`最小 ESP32-S3 开发板（DevKitC-1 或兼容）`,`¥25~35`],[`无线化`,`2S 锂聚合物电池 7.4V 2000mAh（带保护板）`,`¥35~50`],[`无线化`,`XL4015 降压模块`,`¥8`],[`无线化`,`2S USB-C 平衡充`,`¥15`],[`无线化`,`电池低压检测`,`¥5`]]}};function Se(e){let t=[],r=e=>{let[t,r]=e.split(`.`);return(t===`J1`?n:i)?.[r-1]||e};for(let n of e.wires)for(let[e,i]of[[n.a,n.b],[n.b,n.a]])e[0]===`ESP`&&t.push({pin:e[1],gpio:r(e[1]),to:`${i[0]} ${i[1]}`,why:n.why,md:n.md});return t.sort((e,t)=>e.pin.localeCompare(t.pin,`en`,{numeric:!0}))}var Ce=[[`主控`,`md 写“ESP32-S3 N16R8 开发板”（README）/“最小 ESP32-S3 板，如 DevKitC-1”（无线架构 §8）。台面摆的是 DevKitC-1 外形（程序生成，尺寸按乐鑫资料 63×25.4 mm 左右），上面的 WROOM-1 模组是库里的真实 CAD。`,`估算`],[`INMP441 / OLED / XL4015 / 2S 电池`,`库里没有这些模块的 CAD，按常见模块尺寸程序生成（INMP441 约 14×14 mm、0.96" OLED 约 27×27 mm、XL4015 约 51×26 mm、2S 2000 mAh 约 70×34×18 mm）。`,`估算`],[`PCA9685 / MAX98357A / 喇叭 / MG90S / 220µF`,`用库里的真实 CAD：PCA9685 用 Adafruit 815、功放用 Adafruit 3006、喇叭用 Adafruit 3923（8 Ω 1 W 椭圆，md 写 8 Ω 2 W，最接近的真实件）、舵机用 Adafruit 1143（MG90S 同尺寸金属齿微型舵机）、电容用 KiCad Φ6.3 mm 电解。`,`最接近的真实件`],[`降压模块`,`md 写一块 XL4015 同时出 6 V 和 5 V——一块 XL4015 只有一路输出。台面放了两块（6 V 给舵机、5 V 给 ESP32）。另外 XL4015 标称输入 8–36 V，2S 电池满电 8.4 V、标称 7.4 V，大部分时间低于下限：现实里建议换低压差的降压（文档未写型号）。`,`补充`],[`机身`,`md 只写“躯干约 10 cm、触手 7–9 cm”，没有结构图。骨架（底板 + 立柱 + 上层板）和触手是本项目按这个尺寸设计的，全部估算。`,`估算`],[`方案 B 结构`,`md 只写“每条 2 个舵机（偏航 + 俯仰）”。台面把俯仰舵机侧躺装在偏航舵盘的支架上——这样 10 cm 躯干上相邻俯仰舵机只剩约 5° 的相对摆动空间（估算），按 md 默认 38° 摆幅会互相顶住。现实里需要更大的躯干或更小的摆幅。`,`估算`],[`导线`,`按引脚连接；长度按走线计（真实杜邦线 20/30 cm，多出来的要扎好）。舵机线 25 cm 盘在机身里。电容只摆在舵机旁，没画到每个舵机的导线（示意）。`,`示意`],[`固件`,`md 的 C++ 逐行移植成 JS，FreeRTOS 任务换成协程；I2C 写进一个寄存器级的 PCA9685 替身（MODE1 / PRESCALE / LEDn）。“全部原样”时行为和 md 代码一致（包括 bug），“修正”逐项可开关。`,`仿真`],[`语音 / 大模型 / 无线`,`小智的语音、云端大模型、WiFi、BLE / 蓝牙串口都是模拟：对话框用关键词规则把一句中文翻成 MCP 调用或串口指令。`,`模拟`],[`运动`,`舵机按脉宽→角度、限速、机械止位、堵转电流估算；桌面爬行用二维库仑摩擦估算，3D 机身不跟着走（看俯视轨迹）。`,`估算`],[`电`,`电池内阻、降压压差、ESP32 欠压复位门限（4.3 V）、舵机电流都是估算，不是 SPICE。`,`估算`]],we=[[`方案 A = 8 个舵机、每条只有偏航`,`README §2 三档方案选型`],[`方案 B = 16 个舵机、偏航 + 俯仰`,`README §2 / §3`],[`ESP32-S3 主控`,`README §3；无线架构 §8（最小板 DevKitC-1）`],[`INMP441 / MAX98357A / 喇叭 / OLED`,`README §3；采购清单 第一批（实战派板载）`],[`PCA9685 一块`,`README §2（A/B 都是 1 块）、§3`],[`MG90S 金属齿`,`README §3（别用 SG90）；采购清单 第二批 选购要点`],[`2S 7.4 V 电池 → XL4015 → 6 V 舵机 / 5 V ESP32`,`README §4；无线架构 §6`],[`第二块降压（5 V）`,`补充（md 只写一块）`],[`220µF 每个舵机旁一个`,`README §4 电源三原则 3`],[`GPIO 8/9 = I2C SDA/SCL，PCA9685 + OLED 同一条总线`,`README §4；body_firmware_A.ino I2C_SDA / I2C_SCL`],[`GPIO 5/4/6 → INMP441 SCK/WS/SD`,`README §4`],[`GPIO 15/16/7 → MAX98357A BCLK/LRC/DIN`,`README §4`],[`3V3 → PCA9685 VCC（只给逻辑）`,`README §4`],[`舵机 V+ 只走 PCA9685 螺丝端子、全部共地`,`README §4 电源三原则 1、2`],[`通道映射 kSingle8 = 第 n 条触手 → CHn；kDual16 = 2n / 2n+1`,`octopus_body.h ChannelOf()`],[`0 号触手在正前方，顺时针排布（每 45°）`,`octopus_gait.h MountAngle() 注释`],[`步态起点 0.6 Hz / 38° / duty 0.65 / phase 45°`,`README §7；octopus_gait.h GaitParams`],[`串口指令 GO / LEFT / RIGHT / STOP / HOME / WAVE n / PULSE n / GAIT`,`body_firmware_A.ino handleCommand()；手机控制指南 §4`],[`MCP 工具 self.octopus.action / set_gait`,`octopus_mcp.cpp`],[`50 Hz PWM、SoftHome 分时上电`,`README §8；octopus_bus.h / octopus_body.h`],[`低压截止 6.4 V`,`无线架构 §6；采购清单 无线化追加清单`],[`15 s 没指令自动停（AUTO_REST）`,`body_firmware_A.ino`],[`阶段 0–5`,`README §7 推进顺序`],[`故障场景`,`采购清单 故障表；README §8；补充项标“补充”`],[`麦克风和喇叭 ≥ 5 cm`,`README §8`]],Te={QTPY:`QT Py ESP32‑S3（Adafruit 5426）`,BAT:`1200 mAh 单节 LiPo（Adafruit 258）`,CHG:`USB‑C LiPo 充电板（Adafruit 4410）`,BST1:`MiniBoost 5 V #1（Adafruit 4654）`,BST2:`MiniBoost 5 V #2（Adafruit 4654）`,SW:`拨动开关（Adafruit 805）`,DIV:`1S 分压板 100k/100k（我的补充，程序生成）`,CAP1:`电解电容（升压 1 输出，KiCad 封装）`,CAP2:`电解电容（升压 2 输出，KiCad 封装）`};function Ee(e,t){let n=e.bench,r=[];if(t){let e=new Map;for(let n of t.parts.values()){let t=n.def,r=t.id;e.has(r)||e.set(r,{id:r,zh:t.name_zh||t.name,n:0,real:!/^p-/.test(r),dims:t.dims_mm,src:t.dims_src||``,licence:t.licence||``}),e.get(r).n++}r.push(...e.values());let n=new Map;for(let e of t.cables)n.set(e.kind,(n.get(e.kind)||0)+1);for(let[e,t]of n)r.push({id:e,zh:{"octo-dupont-20":`杜邦线 20 cm`,"octo-dupont-30":`杜邦线 30 cm`,"octo-wire":`电源线（估算 20 AWG）`,"octo-servo":`舵机引线（MG90S 自带 25 cm，估算）`}[e]||e,n:t,real:!1,cable:!0})}else{let t={ESP:`ESP32‑S3‑DevKitC‑1（程序生成，估算）`,PCA:`PCA9685 16 路（Adafruit 815 CAD）`,MIC:`INMP441（程序生成，估算）`,AMP:`MAX98357A（Adafruit 3006 CAD）`,SPK:`喇叭（Adafruit 3923 CAD）`,BAT:`2S 7.4 V 锂电池（程序生成，估算）`,U1:`XL4015 降压 6 V（程序生成，估算）`,U2:`XL4015 降压 5 V（补充，程序生成）`,OLED:`0.96" OLED（程序生成，估算）`};e.o.variant===`plus`&&Object.assign(t,{BAT:`3S 锂电组 11.1 V（我的补充，程序生成，估算）`,U2:`XL4015 降压 5 V（我的补充，程序生成）`,DIV:`电池分压 100k/22k → GPIO10（我的补充）`});let i=e.o.variant===`v10`;i&&Object.assign(t,Te);for(let e of n.roles)r.push({id:e,zh:t[e]||e,n:1,real:i?e!==`DIV`:[`PCA`,`AMP`,`SPK`].includes(e)});n.servos.length&&r.push(i?{id:`ada-2201`,zh:`SG51R 微型舵机（Adafruit 2201，按页面尺寸建模）`,n:n.servos.length,real:!0}:{id:`ada-1143`,zh:`MG90S 舵机（Adafruit 1143 CAD）`,n:n.servos.length,real:!0}),n.caps&&r.push({id:`cap`,zh:`220µF 电解电容（KiCad CAD）`,n:n.caps,real:!0})}return{title:e.o.variant===`v10`?`小智八爪鱼 v10 紧凑无线版（我的补充）`:`小智八爪鱼 方案${n.plan}${e.o.variant===`plus`?` · 完善版（我的补充）`:``}`,plan:n.plan,variant:e.o.variant||`md`,phase:n.phase,phaseZh:w.find(e=>e.k===n.phase)?.zh,fault:C.find(e=>e.k===n.fault)?.zh,fixes:V.filter(t=>e.o.F[t.k]).map(e=>e.zh),mode:e.o.mode,created:new Date().toISOString(),bom:r,wires:n.wires.map(e=>({a:e.a.join(` `),b:e.b.join(` `),why:e.why,md:e.md,kind:e.kind})),pinmap:e.o.variant===`v10`?[]:Se(n),servos:n.servos}}export{p as C,x as D,h as E,y as O,v as S,s as T,_,we as a,b,pe as c,H as d,U as f,E as g,w as h,Ce as i,V as l,k as m,be as n,Ee as o,C as p,ye as r,ue as s,xe as t,J as u,l as v,g as w,f as x,m as y};