import{o as e,s as t}from"./parts-BRocpuEe.js";import{c as n,f as r,n as i,p as a,t as o}from"./v10-DhkWcI5n.js";var s={red:`#d23a2f`,black:`#1e1f22`,orange:`#e07a2b`,yellow:`#e0b322`,blue:`#2f6fd6`,green:`#2f8f4e`,white:`#f1efe9`,purple:`#8a4fbf`,brown:`#7a4a2a`},c=[{k:`none`,zh:`正常（按 md 接好）`},{k:`nognd`,zh:`没有共地：ESP32 插电脑 USB 供电，没接 GND 到 PCA9685`,md:`采购清单 · 故障表“舵机完全不动 / 抖动 → 没有共地”`},{k:`pwm200`,zh:`PWM 频率不是 50 Hz（固件里漏了设预分频，PCA9685 上电默认约 200 Hz）`,md:`采购清单 · 故障表“舵机完全不动 → PWM 频率不是 50Hz” / README §8`},{k:`vplus-esp`,zh:`舵机 V+ 从 ESP32 的 5V 脚取电（ESP32 插 USB）`,md:`采购清单 · 故障表“舵机一转板子就重启”`},{k:`servo360`,zh:`买成了 360° 连续旋转舵机（3 号触手）`,md:`采购清单 · 故障表“抖动、抽搐 → 买了 360° 舵机”`},{k:`mech`,zh:`摆幅太大 + 转弯：超出机械极限、相邻触手打架`,md:`采购清单 · 故障表“到位后一直咯咯响 → 超出机械极限”`},{k:`phase0`,zh:`步态参数不对：phase = 0（八条同步，原地抽动）`,md:`采购清单 · 故障表“八个不同步 → 步态参数问题” / octopus_gait.h 注释`},{k:`i2caddr`,zh:`只有部分通道有反应：第二块 PCA9685 地址冲突（方案 C 才有两块，这里只说明）`,md:`采购清单 · 故障表“只有部分通道有反应”`,textOnly:!0},{k:`u1unset`,zh:`6 V 降压模块没先调压就接舵机（补充，md 没写）`,md:`补充：XL4015 出厂输出电压不确定`},{k:`lowbat`,zh:`电池快没电（md：6.3 V，低于 6.4 V 截止线；完善版：3S 9.4 V，低于 9.6 V）`,md:`无线架构 §6 · 低于 6.4V 停运动；完善版阈值为我的补充（估算）`}],l=[{k:0,zh:`阶段 0：先只跑通小智语音（不接舵机）`,md:`README §7 阶段 0（半天）`,roles:[`ESP`,`MIC`,`AMP`,`SPK`,`OLED`]},{k:1,zh:`阶段 1：1 个舵机 + 最小 MCP 工具`,md:`README §7 阶段 1（半天）；舵机接哪个脚文档未写，这里接 PCA9685 通道 0`,servos:1},{k:2,zh:`阶段 2：PCA9685 + 独立电源，4 个舵机`,md:`README §7 阶段 2（1 天）`,servos:4},{k:3,zh:`阶段 3：打印组装，整只八爪鱼上台`,md:`README §7 阶段 3（2–3 天）`,robot:!0},{k:4,zh:`阶段 4：调 CPG 步态（freq 0.6 / yaw 38 / duty 0.65 / phase 45 起步）`,md:`README §7 阶段 4`,robot:!0,tune:!0},{k:5,zh:`阶段 5：升级（总线舵机 / IMU）——只有文字，台面不做`,md:`README §7 阶段 5`,robot:!0,textOnly:!0}],u=(e,t,n,r,i,a)=>({a:e,b:t,kind:n,color:s[r]||r,why:i,md:a}),d=[{k:`md`,zh:`md 原样`,tip:`完全按 md 的接线、代码和数值（错的也照搬，方便对照）`},{k:`plus`,zh:`完善版（我的补充）`,tip:`按数据手册和推理补齐 md 没写清楚 / 写错的地方，每一处都标“我的补充”`},{k:`v10`,zh:`v10 紧凑无线版（我的补充）`,tip:`全部板载：1S 1200 mAh 电池 + QT Py ESP32‑S3 直接出 8 路 PWM + 2 个 5.2 V 升压 + 8 个 SG51R 小舵机；不插电，手机走 BLE`}],f=`我的补充`;function p({plan:e=`A`,phase:t=3,fault:n=`none`,variant:r=`md`}={}){if(r===`v10`)return h({fault:n});let i=r===`plus`,a=l.find(e=>e.k===t)||l[3],o=a.robot?8:a.servos||0,c=a.roles?[...a.roles]:[`ESP`,`MIC`,`AMP`,`SPK`,`OLED`,`PCA`,`BAT`,`U1`,`U2`,...i?[`DIV`]:[]],d=[],p=t===0||n===`nognd`||n===`vplus-esp`;d.push(u([`ESP`,`J1.5`],[`MIC`,`SCK`],`octo-dupont-20`,`yellow`,`GPIO5 → INMP441 SCK`,`README §4`),u([`ESP`,`J1.4`],[`MIC`,`WS`],`octo-dupont-20`,`green`,`GPIO4 → INMP441 WS`,`README §4`),u([`ESP`,`J1.6`],[`MIC`,`SD`],`octo-dupont-20`,`blue`,`GPIO6 → INMP441 SD`,`README §4`),u([`ESP`,`J1.2`],[`MIC`,`VDD`],`octo-dupont-20`,`orange`,`3V3 → INMP441 VDD`,`文档未写（数据手册 1.62–3.63 V）`),u([`ESP`,`J3.21`],[`MIC`,`GND`],`octo-dupont-20`,`black`,`GND → INMP441 GND`,`文档未写`),u([`ESP`,`J3.22`],[`MIC`,`L/R`],`octo-dupont-20`,`black`,`L/R 接 GND = 左声道`,`文档未写（数据手册）`),u([`ESP`,`J1.8`],[`AMP`,`BCLK`],`octo-dupont-20`,`yellow`,`GPIO15 → MAX98357A BCLK`,`README §4`),u([`ESP`,`J1.9`],[`AMP`,`LRC`],`octo-dupont-20`,`green`,`GPIO16 → MAX98357A LRC`,`README §4`),u([`ESP`,`J1.7`],[`AMP`,`DIN`],`octo-dupont-20`,`blue`,`GPIO7 → MAX98357A DIN`,`README §4`),u([`AMP`,`SPK+`],[`SPK`,`+`],`octo-dupont-20`,`red`,`功放 + → 喇叭 +`,`README §3`),u([`AMP`,`SPK-`],[`SPK`,`-`],`octo-dupont-20`,`black`,`功放 − → 喇叭 −`,`README §3`)),t===0?(d.push(u([`ESP`,`J1.21`],[`AMP`,`Vin`],`octo-dupont-20`,`red`,`5V（USB）→ 功放 Vin`,`文档未写`),u([`ESP`,`J1.22`],[`AMP`,`GND`],`octo-dupont-20`,`black`,`GND → 功放 GND`,`文档未写`)),d.push(u([`ESP`,`J1.1`],[`OLED`,`VCC`],`octo-dupont-20`,`orange`,`3V3 → OLED VCC`,`文档未写`),u([`ESP`,`J3.1`],[`OLED`,`GND`],`octo-dupont-20`,`black`,`GND → OLED GND`,`文档未写`),u([`ESP`,`J1.12`],[`OLED`,`SDA`],`octo-dupont-20`,`blue`,`GPIO8 → OLED SDA`,`README §4`),u([`ESP`,`J1.15`],[`OLED`,`SCL`],`octo-dupont-20`,`yellow`,`GPIO9 → OLED SCL`,`README §4`))):(d.push(u([`U2`,`OUT+`],[`AMP`,`Vin`],`octo-dupont-20`,`red`,`5V → 功放 Vin`,`文档未写`),u([`U2`,`OUT-`],[`AMP`,`GND`],`octo-dupont-20`,`black`,`GND → 功放 GND`,`文档未写`),u([`ESP`,`J1.12`],[`PCA`,`L.SDA`],`octo-dupont-30`,`blue`,`GPIO8 → PCA9685 SDA`,`README §4 / .ino I2C_SDA 8`),u([`ESP`,`J1.15`],[`PCA`,`L.SCL`],`octo-dupont-30`,`yellow`,`GPIO9 → PCA9685 SCL`,`README §4 / .ino I2C_SCL 9`),u([`ESP`,`J1.1`],[`PCA`,`L.VCC`],`octo-dupont-30`,`orange`,`3V3 → PCA9685 VCC（逻辑）`,`README §4`),u([`PCA`,`R.VCC`],[`OLED`,`VCC`],`octo-dupont-20`,`orange`,`3V3（经 PCA 排针）→ OLED VCC`,`文档未写`),u([`PCA`,`R.GND`],[`OLED`,`GND`],`octo-dupont-20`,`black`,`GND → OLED GND`,`文档未写`),u([`PCA`,`R.SDA`],[`OLED`,`SDA`],`octo-dupont-20`,`blue`,`SDA 同一条 I2C → OLED`,`README §4`),u([`PCA`,`R.SCL`],[`OLED`,`SCL`],`octo-dupont-20`,`yellow`,`SCL 同一条 I2C → OLED`,`README §4`),u([`BAT`,`BAT+`],[`U1`,`IN+`],`octo-wire`,`red`,`电池 + → 6 V 降压 IN+`,`README §4`),u([`BAT`,`BAT-`],[`U1`,`IN-`],`octo-wire`,`black`,`电池 − → 6 V 降压 IN−`,`README §4`),u([`BAT`,`BAT+`],[`U2`,`IN+`],`octo-wire`,`red`,`电池 + → 5 V 降压 IN+`,`补充（md 只写一块 XL4015 同时出 6 V 和 5 V，单块做不到）`),u([`BAT`,`BAT-`],[`U2`,`IN-`],`octo-wire`,`black`,`电池 − → 5 V 降压 IN−`,`补充`)),n===`vplus-esp`?d.push(u([`ESP`,`J1.21`],[`PCA`,`T.V+`],`octo-dupont-30`,`red`,`（故障）ESP32 5V → PCA9685 V+`,`反例`),u([`ESP`,`J1.22`],[`PCA`,`T.GND`],`octo-dupont-30`,`black`,`（故障）ESP32 GND → PCA9685 GND 端子`,`反例`)):d.push(u([`U1`,`OUT+`],[`PCA`,`T.V+`],`octo-wire`,`red`,`6 V → PCA9685 V+ 螺丝端子`,`README §4`),u([`U1`,`OUT-`],[`PCA`,`T.GND`],`octo-wire`,`black`,`GND → PCA9685 GND 端子`,`README §4`)),p||d.push(u([`U2`,`OUT+`],[`ESP`,`J1.21`],`octo-wire`,`red`,`5 V → ESP32 5V 脚`,`README §4（md 写 VIN/5V；DevKitC‑1 丝印是 5V）`),u([`U2`,`OUT-`],[`ESP`,`J1.22`],`octo-wire`,`black`,`GND → ESP32 GND（共地）`,`README §4`)),n!==`nognd`&&d.push(u([`ESP`,`J3.1`],[`PCA`,`L.GND`],`octo-dupont-30`,`black`,`GND → PCA9685 GND（逻辑地，共地）`,`README §4`)),i&&d.push(u([`BAT`,`BAT+`],[`DIV`,`IN`],`octo-dupont-20`,`red`,`电池 + → 分压板 IN（100k 上臂）`,`${f} · 替代 md 的 GPIO4 电池检测`),u([`BAT`,`BAT-`],[`DIV`,`GND`],`octo-dupont-20`,`black`,`电池 − → 分压板 GND（22k 下臂）`,f),u([`DIV`,`OUT`],[`ESP`,`J1.16`],`octo-dupont-20`,`purple`,`分压 OUT → GPIO10（ADC1_CH9）`,`${f} · GPIO4 已给麦克风 WS，GPIO1/2 留给采购清单第二批 I2C`)));let m=[],g=e===`B`&&a.robot?2:1;for(let e=0;e<o;e++)for(let t=0;t<g;t++){let r=g===2?e*2+t:e,i=g===2?`S${e}${t?`p`:`y`}`:`S${e}`;m.push({role:i,arm:e,slot:t,ch:`CH${r}`,type:n===`servo360`&&e===3&&t===0?`360`:`180`}),d.push({a:[i,`LEAD`],b:[`PCA`,`CH${r}`],kind:`octo-servo`,color:s.brown,why:`${i} 舵机引线 → PCA9685 通道 ${r}`,md:g===2?`octopus_body.h · ChannelOf(kDual16) = arm×2+slot`:`octopus_body.h · ChannelOf(kSingle8) = arm`})}let _=n===`lowbat`;return{plan:e,phase:t,fault:n,variant:r,ph:a,roles:c,wires:d,servos:m,usb:p,defs:i?{BAT:`p-octo-3s-pack`}:{},plusHw:i&&e===`A`&&a.robot?{casters:!0,pads:!0,tipShare:.3}:{},vbat:i?_?9.4:11.1:_?6.3:7.4,caps:a.robot?m.length:0,u1Unset:n===`u1unset`,robot:!!a.robot}}var m=[{k:`none`,zh:`正常（按 v10 接线）`},{k:`nognd`,zh:`QT Py 的 GND 没接到电池 / 升压地`},{k:`lowbat`,zh:`电池快没电（空载 3.55 V，带载低于 3.55 V 停运动阈值，估算）`},{k:`swoff`,zh:`电源开关拨到 OFF（EN 拉低，升压和 QT Py 都断电）`},{k:`onebst`,zh:`只装一个升压，8 个舵机全挂在它上面`}];function h({fault:e=`none`}={}){let t=`我的补充 · v10`,r=[`QTPY`,`BAT`,`CHG`,`BST1`,`BST2`,`SW`,`DIV`,`CAP1`,`CAP2`],i=[],a=e===`onebst`;i.push(u([`BAT`,`BAT+`],[`CHG`,`JST+`],`octo-jst`,`red`,`LiPo JST‑PH 插进充电板的电池座`,`Adafruit 4410：JST‑PH 电池座 + BAT 焊盘`),u([`BAT`,`BAT-`],[`CHG`,`JST-`],`octo-jst`,`black`,`（同一根 JST 线的黑线）`,`Adafruit 258：JST‑PH 2 针`),u([`CHG`,`BAT`],[`BST1`,`IN`],`octo-v10-power`,`red`,`充电板 BAT 焊盘 → 升压 1 IN（舵机大电流不过开关）`,t),u([`CHG`,`GND`],[`BST1`,`GND`],`octo-v10-power`,`black`,`GND → 升压 1 GND`,t),u([`CHG`,`BAT`],[`SW`,`1`],`octo-v10-wire`,`red`,`BAT → 开关 1 脚`,t),u([`CHG`,`GND`],[`SW`,`3`],`octo-v10-wire`,`black`,`GND → 开关 3 脚（拨到这边 = EN 接地 = 关）`,t),u([`SW`,`COM`],[`BST1`,`EN`],`octo-v10-wire`,`orange`,`开关 COM → 升压 1 EN`,`Adafruit 4654：EN 拉低 = 输出真断开`),u([`SW`,`COM`],[`QTPY`,`BAT`],`octo-v10-wire`,`orange`,`开关 COM → QT Py 背面 BAT 焊盘（3–6 V，带二极管）`,`Adafruit 5426：BAT 焊盘`),u([`SW`,`COM`],[`DIV`,`IN`],`octo-v10-wire`,`orange`,`开关 COM → 分压 IN`,t),u([`DIV`,`GND`],[`CHG`,`GND`],`octo-v10-wire`,`black`,`分压 GND`,t),u([`DIV`,`OUT`],[`QTPY`,`A3`],`octo-v10-wire`,`purple`,`分压 OUT → A3（GPIO8）电池检测`,t),u([`BST1`,`OUT`],[`CAP1`,`+`],`octo-v10-wire`,`red`,`升压 1 OUT → 电容 +`,`${t} · 电容值估算`),u([`BST1`,`GND`],[`CAP1`,`-`],`octo-v10-wire`,`black`,`电容 −`,t)),e!==`nognd`&&i.push(u([`QTPY`,`BGND`],[`CHG`,`GND`],`octo-v10-wire`,`black`,`QT Py BAT 旁的 GND 焊盘 → 电池地（共地）`,t)),a||i.push(u([`CHG`,`BAT`],[`BST2`,`IN`],`octo-v10-power`,`red`,`充电板 BAT 焊盘 → 升压 2 IN`,t),u([`CHG`,`GND`],[`BST2`,`GND`],`octo-v10-power`,`black`,`GND → 升压 2 GND`,t),u([`SW`,`COM`],[`BST2`,`EN`],`octo-v10-wire`,`orange`,`开关 COM → 升压 2 EN`,t),u([`BST2`,`OUT`],[`CAP2`,`+`],`octo-v10-wire`,`red`,`升压 2 OUT → 电容 +`,t),u([`BST2`,`GND`],[`CAP2`,`-`],`octo-v10-wire`,`black`,`电容 −`,t));let o=[];for(let e=0;e<8;e++){let r=`S${e}`,c=a||e<4?`BST1`:`BST2`,l=n[e];o.push({role:r,arm:e,slot:0,ch:`CH${e}`,type:`sg51r`,pad:l.pad,gpio:l.gpio,rail:c}),i.push({a:[r,`LEAD`],b:[`QTPY`,l.pad],kind:`octo-v10-servo`,rail:c,color:s.brown,why:`${r}：橙 PWM → QT Py ${l.pad}（GPIO${l.gpio}，LEDC 通道 ${e}）；红 V+ / 棕 GND → ${c}`,md:t})}return{plan:`A`,phase:3,fault:e,variant:`v10`,ph:l[3],roles:r,wires:i,servos:o,usb:!1,defs:{BAT:`ada-258`,DIV:`p-octo-vdiv-1s`,QTPY:`ada-5426`,CHG:`ada-4410`,BST1:`ada-4654`,BST2:`ada-4654`,SW:`ada-805`,CAP1:`kc-cp_radial_d6.3mm_p2.50mm`,CAP2:`kc-cp_radial_d6.3mm_p2.50mm`},plusHw:{casters:!0,pads:!0,tipShare:.3},vbat:e===`lowbat`?3.55:3.85,swOn:e!==`swoff`,caps:2,u1Unset:!1,robot:!0,board:`v10`}}var g={ESP:`p-octo-devkitc1`,PCA:`ada-815`,MIC:`p-octo-inmp441`,AMP:`ada-3006`,SPK:`ada-3923`,BAT:`p-octo-2s-lipo`,U1:`p-octo-xl4015-6v`,U2:`p-octo-xl4015-5v`,OLED:`p-octo-oled096`,DIV:`p-octo-vdiv`},_=Object.fromEntries(t.map(e=>[e.id,e])),v=(t,n)=>{let r=n?.defs?.[t]||g[t];return _[r]?.octo||e[r]||{pins:{},ties:[]}},y=class{constructor(){this.p=new Map}f(e){this.p.has(e)||this.p.set(e,e);let t=e;for(;this.p.get(t)!==t;)t=this.p.get(t);return this.p.set(e,t),t}u(e,t){this.p.set(this.f(e),this.f(t))}},b=e=>{if(e.kind===`octo-servo`){let[t]=e.a,n=e.b[1];return[[`${t}:GND`,`PCA:${n}.GND`],[`${t}:V+`,`PCA:${n}.V+`],[`${t}:PWM`,`PCA:${n}.PWM`]]}if(e.kind===`octo-v10-servo`){let[t]=e.a,n=e.b[1],r=e.rail;return[[`${t}:GND`,`${r}:GND`],[`${t}:V+`,`${r}:OUT`],[`${t}:PWM`,`QTPY:${n}`]]}return[[`${e.a[0]}:${e.a[1]}`,`${e.b[0]}:${e.b[1]}`]]};function x(e){if(e._uf)return e._uf;let t=new y;Object.defineProperty(e,"_uf",{value:t,enumerable:!1});let n=e.board===`v10`?e.roles:Object.keys(g);e.board===`v10`&&t.u(`SW:COM`,e.swOn?`SW:1`:`SW:3`);for(let r of n)for(let n of v(r,e).ties)for(let e=1;e<n.length;e++)t.u(`${r}:${n[0]}`,`${r}:${n[e]}`);for(let n of e.wires)for(let[e,r]of b(n))t.u(e,r);return e.usb&&t.u(`USB:GND`,`USB:GND`),t}var S=.12,C=.02,w=.0014,T=.003;function E(e,t={}){if(e.board===`v10`)return O(e,t);let n=x(e),r=(e,t)=>n.f(e)===n.f(t),i=t.servoI||0,a={checks:[],rails:{},warn:[]},o=e.vbat??7.4,s=r(`U1:IN+`,`BAT:BAT+`)&&r(`U1:IN-`,`BAT:BAT-`),c=r(`U2:IN+`,`BAT:BAT+`)&&r(`U2:IN-`,`BAT:BAT-`),l=t=>e.roles.includes(t),u=!!e.usb,d=l(`U2`)&&c&&r(`ESP:J1.21`,`U2:OUT+`);r(`ESP:J1.22`,`U2:OUT-`);let f=l(`U1`)&&s&&r(`PCA:T.V+`,`U1:OUT+`),p=l(`PCA`)&&r(`PCA:T.V+`,`ESP:J1.21`),m=e.variant===`plus`,h=m?o<9.8?.45:.15:e.vbat<6.6?.5:.12,g=e.u1Unset?null:6,_=0,v=0,y=0,b=(S+(l(`OLED`)?C:0)+(l(`MIC`)?w:0))*5+(l(`AMP`)?T*5:0);f&&(y+=i*6/.9),d&&(y+=b/.88),y/=Math.max(5.5,o);let E=o-y*h,D=.8;f&&(v=Math.min(g??E-D,E-D-i*.05)),d&&(_=Math.min(5,E-D)),u&&(_=Math.max(_,5-(p?i*1.4:0)-.05)),p&&(v=_-.3);let k=_>=4.3,A=r(`ESP:J3.1`,`PCA:L.GND`)||r(`ESP:J1.22`,`BAT:BAT-`)&&r(`PCA:T.GND`,`BAT:BAT-`),j=r(`PCA:L.VCC`,`ESP:J1.1`),M=k&&j&&(A||p&&u),N={sda:r(`PCA:L.SDA`,`ESP:J1.12`),scl:r(`PCA:L.SCL`,`ESP:J1.15`)},P=l(`DIV`)&&r(`DIV:IN`,`BAT:BAT+`)&&r(`DIV:GND`,`BAT:BAT-`)&&r(`DIV:OUT`,`ESP:J1.16`)&&r(`BAT:BAT-`,`ESP:J1.22`);a.rails={battSense:P,vbat:l(`BAT`)?+E.toFixed(2):null,vservo:+v.toFixed(2),espIn:+_.toFixed(2),v33:k?3.3:0,iBat:+y.toFixed(2),servoI:+i.toFixed(2),espOn:k,pcaLogic:M,gndCommon:A,i2cWired:N.sda&&N.scl,vpFromEsp:p,vpFromU1:f};let F=(e,t,n,r=`err`)=>a.checks.push({ok:!!e,zh:t,md:n,level:e?`ok`:r});return l(`PCA`)&&(F(A,`共地：ESP32 的 GND 和 PCA9685 / 电池 GND 连在一起`,`README §4 三条铁律 · 共地`),F(!p,`舵机 V+ 不从 ESP32 取电（走 PCA9685 的 V+ 螺丝端子）`,`README §4 三条铁律 · V+ 绝不从 ESP32 取`),F(j,`PCA9685 VCC 接 ESP32 3V3（逻辑电源）`,`README §4 接线表 · 3V3/GND → PCA VCC`),F(N.sda&&N.scl,`I2C：GPIO8 → SDA，GPIO9 → SCL`,`README §4 接线表 / body_firmware_A.ino #define I2C_SDA 8`),F(f,`V+ 端子 ← XL4015 调到 6 V`,`README §4 供电 · 7.4V → XL4015 → 6V`)),l(`MIC`)&&(F(r(`MIC:SCK`,`ESP:J1.5`)&&r(`MIC:WS`,`ESP:J1.4`)&&r(`MIC:SD`,`ESP:J1.6`),`麦克风 INMP441：SCK=GPIO5，WS=GPIO4，SD=GPIO6`,`README §4 接线表`),F(r(`MIC:L/R`,`ESP:J3.1`),`INMP441 L/R 接 GND（选左声道）`,`文档未写（按 INMP441 数据手册补）`,`warn`),F(r(`MIC:VDD`,`ESP:J1.1`),`INMP441 VDD 接 3V3`,`文档未写（数据手册 1.62–3.63 V）`,`warn`)),l(`AMP`)&&(F(r(`AMP:BCLK`,`ESP:J1.8`)&&r(`AMP:LRC`,`ESP:J1.9`)&&r(`AMP:DIN`,`ESP:J1.7`),`功放 MAX98357A：BCLK=GPIO15，LRC=GPIO16，DIN=GPIO7`,`README §4 接线表`),F(r(`AMP:SPK+`,`SPK:+`)&&r(`AMP:SPK-`,`SPK:-`),`喇叭接功放输出`,`README §3 物料（8Ω 2W 喇叭）`)),l(`SPK`)&&l(`MIC`)&&t.micSpkCm!=null&&F(t.micSpkCm>=5,`麦克风离喇叭 ${t.micSpkCm.toFixed(1)} cm（≥ 5 cm）`,`README §8 · 麦克风和喇叭至少隔 5 cm`),l(`OLED`)&&F(r(`OLED:SDA`,`PCA:L.SDA`)&&r(`OLED:SCL`,`PCA:L.SCL`),`OLED 和 PCA9685 共用 I2C（0x3C / 0x40 不冲突）`,`README §4 · 屏幕同一条 I2C`),l(`BAT`)&&(m?F(o>=8,`XL4015 输入 ${o.toFixed(1)} V（3S，截止 9.6 V 也高于数据手册下限 8 V）`,`我的补充 · XLSEMI XL4015 数据手册 8–36 V`,`warn`):F(o>=8,`XL4015 输入 ${o.toFixed(1)} V：数据手册下限 8 V，2S 电池大部分时间低于它`,`md 没提；XLSEMI XL4015 数据手册`,`warn`),m&&F(P,`电池检测：分压板 IN ← 电池 +、OUT → GPIO10（ADC1_CH9），12.6 V 时 2.27 V < 2.9 V 量程`,`我的补充 · 乐鑫 ESP32‑S3 ADC 文档（11 dB 校准量程 0–2900 mV）`,`warn`),F(!e.u1Unset,`6 V 那块降压先空载调好再接舵机`,`补充（md 没写调压步骤）`,`warn`),e.u1Unset&&a.warn.push(`U1 没调：输出接近输入（约 ${(E-D).toFixed(1)} V），超过 MG90S 标称 6.0 V`)),(e.servos||[]).forEach((t,n)=>{let r=t.ch;if(r==null)return;let i=e.plan===`B`?null:n;i!=null&&r!==`CH${i}`&&F(!1,`触手 ${n} 的舵机插在 ${r}，md 约定 ${i} 号触手 = 通道 ${i}`,`octopus_body.h · ChannelOf(kSingle8)`,`warn`)}),e.caps!=null&&l(`PCA`)&&F(e.caps>=(e.servos?.length||0),`每个舵机旁一颗 220µF（${e.caps} / ${e.servos?.length||0}）`,`README §4 三条铁律 · 每个舵机旁 220µF`,`warn`),i>5&&a.warn.push(`舵机电流 ${i.toFixed(1)} A 超过 XL4015 标称 5 A`),v>0&&v<4.6&&i>.3&&a.warn.push(`舵机电压掉到 ${v.toFixed(2)} V`),a.errCount=a.checks.filter(e=>e.level===`err`).length,a.warnCount=a.checks.filter(e=>e.level===`warn`).length+a.warn.length,a.same=r,a}var D=.08;function O(e,t={}){let s=x(e),c=(e,t)=>s.f(e)===s.f(t),l={checks:[],rails:{},warn:[]},u=(e,t,n,r=`err`)=>l.checks.push({ok:!!e,zh:t,md:n,level:e?`ok`:r}),d=t.servoI||0,f=t.railI||null,p=e.vbat,m=p<3.6?.3:.15,h=c(`CHG:JST+`,`BAT:BAT+`)&&c(`CHG:JST-`,`BAT:BAT-`),g=e=>h&&c(`${e}:IN`,`BAT:BAT+`)&&c(`${e}:GND`,`BAT:BAT-`),_=c(`SW:COM`,`BAT:BAT+`),v=e=>c(`${e}:EN`,`BAT:BAT+`),y=[`BST1`,`BST2`].filter(t=>e.roles.includes(t)&&g(t)),b={};for(let t of e.servos)b[t.role]=[`BST1`,`BST2`].find(e=>c(`${t.role}:V+`,`${e}:OUT`)&&c(`${t.role}:GND`,`BAT:BAT-`))||null;let S={BST1:0,BST2:0};if(f)for(let t of e.servos){let e=b[t.role];e&&(S[e]+=f[t.role]||0)}else{let t=e.servos.length;for(let n of e.servos){let e=b[n.role];e&&(S[e]+=d/t)}}let C=_&&h&&c(`QTPY:BAT`,`BAT:BAT+`),w=p,T=0,E={};for(let e=0;e<3;e++){T=C?D:0;for(let e of[`BST1`,`BST2`]){let t=y.includes(e)&&v(e),n=a(w),o=t?S[e]:0,s=t?o<=n?i.vout:i.vout*Math.max(0,n/o):0,c=o<=n?o:n;E[e]={on:t,v:s,I:o,lim:n,sat:t&&o>n},t&&(T+=s*c/r(c)/Math.max(2.5,w)+2e-4)}w=p-T*m}let O=C?w-.3:0,k=O>=3.1,A=c(`QTPY:BGND`,`BAT:BAT-`),j=c(`DIV:IN`,`SW:COM`)&&c(`DIV:GND`,`BAT:BAT-`)&&c(`DIV:OUT`,`QTPY:${o.pad}`),M={};for(let t of e.servos){let e=n.find(e=>c(`${t.role}:PWM`,`QTPY:${e.pad}`));M[t.role]=e&&A?e.gpio:null}let N=Object.fromEntries(e.servos.map(e=>[e.role,b[e.role]?E[b[e.role]].v:0])),P=Object.values(N),F=P.length?Math.min(...P):0;l.rails={battSense:j,vbat:+w.toFixed(3),vbatSw:_?+w.toFixed(3):0,vservo:+F.toFixed(2),vservoOf:N,espIn:+O.toFixed(2),v33:k?3.3:0,iBat:+T.toFixed(3),servoI:+d.toFixed(3),espOn:k,pcaLogic:k,gndCommon:A,i2cWired:!0,vpFromEsp:!1,vpFromU1:!1,boost:E,pwmGpio:M,swOn:_,usb:!1,pBat:+(T*w).toFixed(3)},u(h,`LiPo JST 插进充电板电池座`,`Adafruit 4410 / 258`),u(_,`电源开关拨到 ON（COM 接电池 +，两个升压 EN 拉高、QT Py 上电）`,`Adafruit 4654：EN 拉低 = 真断开`,`warn`),u(A,`共地：QT Py BAT 旁的 GND 焊盘接电池地（PWM 才有参考）`,`舵机 PWM 是相对 GND 的信号`),u(e.servos.every(e=>b[e.role]),`每个舵机红线 / 棕线接在升压 OUT / GND 上（不从 QT Py 取电）`,`我的补充 · QT Py 3.3 V 稳压 600 mA 峰值，带不动舵机`),u(e.servos.every(e=>M[e.role]!=null),`8 根橙线接 QT Py 的 8 个焊盘（A0 A1 A2 SDA SCL TX RX SCK）`,`ESP32‑S3 LEDC 8 个通道（乐鑫文档）`),u(j,`电池检测：开关后的电池 + → 100k/100k → A3（GPIO8）；4.2 V → 2.1 V < 2.9 V 量程`,o.src,`warn`);let I=e.servos.filter(e=>b[e.role]===`BST1`).length,L=e.servos.filter(e=>b[e.role]===`BST2`).length;u(I<=4&&L<=4,`两个升压各带 ≤ 4 个舵机（现在 ${I} + ${L}）`,`我的补充 · MiniBoost 3.7 V 输入时最大输出约 1.2 A（页面：1.1 A@3.5 V、1.4 A@4 V，插值）`,`warn`),u(!0,`工作时不插 USB：USB‑C 只用来充电（充电板 100 mA 默认 / 500 mA 跳线）`,`Adafruit 4410`),u(!1,`舵机电压 5.2 V 高于 SG51R 页面写的 4.8 V（页面没写最高电压；我没找到 5 V 以下的 1S 升压现成小板）`,`Adafruit 2201 / 4654 · 我的补充`,`warn`),u(!1,`拨动开关页面没写额定电流：这里只让它过 QT Py + EN 的小电流（< 0.2 A，估算），舵机电流不经过它`,`Adafruit 805`,`warn`);for(let e of[`BST1`,`BST2`])E[e]?.sat&&l.warn.push(`${e===`BST1`?`升压 1`:`升压 2`} 要 ${E[e].I.toFixed(2)} A，超过 ${w.toFixed(2)} V 输入时的上限 ${E[e].lim.toFixed(2)} A → 输出掉到 ${E[e].v.toFixed(2)} V`);return T>2&&l.warn.push(`电池电流 ${T.toFixed(2)} A 超过 LiPo 线材额定 2 A（Adafruit 258 页面）`),p<o.cut&&l.warn.push(`电池 ${p.toFixed(2)} V 低于 ${o.cut} V（估算阈值）：固件会停运动，请充电`),l.errCount=l.checks.filter(e=>e.level===`err`).length,l.warnCount=l.checks.filter(e=>e.level===`warn`).length+l.warn.length,l.same=c,l}var k=`#pragma once
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
// v13 我的补充：台面步态编辑器导出的自定义步态表（有这个文件就用它，没有就是默认步态）
#if defined(__has_include)
#if __has_include("octopus_gait_custom.h")
#include "octopus_gait_custom.h"
#endif
// v14 我的补充：台面闭环面板导出的增益（有这个文件 → 打开 IMU + 闭环倾斜 / 航向 PD）
#if __has_include("octopus_ctrl_custom.h")
#include "octopus_ctrl_custom.h"
#endif
#endif
#ifdef OCTO_CTRL_CUSTOM
#include "octopus_ctrl.h"
#endif
// v16 我的补充：台面「实物连接 · 校准」导出的每路中位 / 限位（有这个文件就用它）
#if defined(__has_include)
#if __has_include("octopus_trim_custom.h")
#include "octopus_trim_custom.h"
#endif
#endif

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
#ifdef OCTO_CTRL_CUSTOM
    // v14：IMU 读数回调（在运动任务里、每 20 ms 调一次）；读不到返回 false → 这一拍开环
    using ImuReadFn = bool (*)(void* ctx, ImuSample& out);
    void SetImu(ImuReadFn fn, void* ctx) { imu_fn_ = fn; imu_ctx_ = ctx; }
#endif
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
#ifdef OCTO_SERVO_RATE_DPS
        bank_.SetMaxRate(OCTO_SERVO_RATE_DPS);  // v15：步态头文件里给的上限（例如 240 °/s = 80%）
#else
        bank_.SetMaxRate(300.0f);
#endif
        // 我的补充：每路软件限位 90°±55°（md §8 提到 SetLimit 但代码没调用）
        for (int i = 0; i < channels_; i++) bank_.SetLimit(i, kHome - 55.0f, kHome + 55.0f);
#ifdef OCTO_TRIM_CUSTOM
        // v16 我的补充：校准表（中位偏移 ±20°，限位相对校准中位、最多 ±55°）
        for (int i = 0; i < channels_ && i < trim_custom::kChannels; i++) ApplyTrim(i, trim_custom::kCenter[i], trim_custom::kMin[i], trim_custom::kMax[i]);
#endif

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
    void SetVelocity(float throttle, float steer, int cycles = 0) { Post({CmdType::kGait, throttle, steer, cycles, {}, {}}); }
    void Rest()                 { Post({CmdType::kRest, 0, 0, 0, {}, {}}); }
    // 我的补充 · v10 低电：不回中位，立刻停 PWM（舵机放松、不再耗电）。回中位时 8 个舵机一起动的电流会把快没电的单节电池拉到 QT Py 欠压复位（仿真估算）
    void RelaxNow()             { Post({CmdType::kRelax, 0, 0, 0, {}, {}}); }
    void Home()                 { Post({CmdType::kHome, 0, 0, 0, {}, {}}); }
    void WaveOnce(int arm)      { Post({CmdType::kWave, 0, 0, arm, {}, {}}); }
    void Pulse(int times)       { Post({CmdType::kPulse, 0, 0, times, {}, {}}); }
    void SetGaitParams(const GaitParams& p) { Post({CmdType::kParams, 0, 0, 0, p, {}}); }

    // ---------- v16 我的补充：实物连接（OCTL/1）用 ----------
    static constexpr int kPoseMax = 16;
    // 每路相对中位的角度（°）；超出 ±55 会再被限位夹住
    void SetPose(const float* deg, int n) {
        Cmd c{CmdType::kPose, 0, 0, n, {}, {}};
        for (int i = 0; i < kPoseMax; i++) c.v[i] = (i < n) ? deg[i] : 0.0f;
        Post(c);
    }
    void SetRate(float dps) { Cmd c{CmdType::kRate, dps, 0, 0, {}, {}}; Post(c); }
    void SetTrimLimit(int ch, float center, float lo, float hi) {
        Cmd c{CmdType::kTrim, 0, 0, ch, {}, {}};
        c.v[0] = center; c.v[1] = lo; c.v[2] = hi;
        Post(c);
    }
    // 遥测（别的任务只读 float / int，ESP32 上读写是原子的）
    float Angle(int ch) const { return bank_.Present(ch) - kHome - bank_.Trim(ch); }   // 指令角（限速后），不是实测角：普通舵机没有位置反馈
    int ModeCode() const { return static_cast<int>(mode_); }   // 0 停 1 走 2 挥手 3 收缩 4 回中位 5 摆姿势
    float RateNow() const { return bank_.MaxRate(); }
    bool Tilt(float& roll, float& pitch) const {
#ifdef OCTO_CTRL_CUSTOM
        if (!imu_ok_) return false;
        roll = tilt_roll_; pitch = tilt_pitch_;
        return true;
#else
        (void)roll; (void)pitch;
        return false;
#endif
    }

    // 读快照只读 Params()，不写（float 读写在 ESP32 上是原子的）
    GaitParams GaitParamsSnapshot() const { return gait_.Params(); }

    RigType Rig() const { return rig_; }
    int Channels() const { return channels_; }
    bool Relaxed() const { return bank_.Relaxed(); }

private:
    enum class Mode { kIdle, kGait, kWave, kPulse, kHoming, kPose };
    enum class CmdType { kGait, kRest, kHome, kWave, kPulse, kParams, kRelax, kPose, kRate, kTrim };
    struct Cmd {
        CmdType type;
        float throttle;
        float steer;
        int n;            // gait：周期数（0 = 不限）；wave：触手号；pulse：次数；pose：路数；trim：通道
        GaitParams params;
        float v[kPoseMax]; // v16：pose 每路角度；trim：中位 / 下限 / 上限
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
                if (mode_ != Mode::kGait) {
                    custom_t_ = 0.0f;  // v13：自定义步态从 t = 0 开始
#ifdef OCTO_CTRL_CUSTOM
                    ctrl_.Reset();     // v14：航向目标 = 起步时的朝向
#endif
                }
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
            case CmdType::kPose:   // v16
                for (int i = 0; i < kPoseMax; i++) pose_[i] = (i < c.n) ? c.v[i] : 0.0f;
                gait_.Reset();
                Enter(Mode::kPose);
                break;
            case CmdType::kRate: {  // v16：上限 = OCTO_LINK_RATE_MAX（默认 240 °/s ≈ 舵机标称速度的 80%）
                float r = c.throttle;
                if (r > kLinkRateMax) r = kLinkRateMax;
                if (r < 30.0f) r = 30.0f;
                bank_.SetMaxRate(r);
                break;
            }
            case CmdType::kTrim:
                ApplyTrim(c.n, c.v[0], c.v[1], c.v[2]);
                break;
        }
    }

#ifndef OCTO_LINK_RATE_MAX
#define OCTO_LINK_RATE_MAX 240.0f
#endif
    static constexpr float kLinkRateMax = OCTO_LINK_RATE_MAX;

    // v16：中位偏移夹到 ±20°，限位相对校准中位、夹到 [−55, 0] / [0, 55]
    void ApplyTrim(int ch, float center, float lo, float hi) {
        if (ch < 0 || ch >= channels_) return;
        if (center > 20.0f) center = 20.0f;
        if (center < -20.0f) center = -20.0f;
        if (lo < -55.0f) lo = -55.0f;
        if (lo > 0.0f) lo = 0.0f;
        if (hi > 55.0f) hi = 55.0f;
        if (hi < 0.0f) hi = 0.0f;
        bank_.SetTrim(ch, center);
        bank_.SetLimit(ch, kHome + center + lo, kHome + center + hi);
    }

    void Enter(Mode m) {
        mode_ = m;
        if (m != Mode::kIdle) { want_relax_ = false; idle_t_ = 0.0f; bank_.Wake(); }
    }

    void Step(float dt) {
#ifdef OCTO_CTRL_CUSTOM
        // v16：每拍都读 IMU（不只是走路时），遥测才有倾角；StepGait 复用这一拍的读数
        imu_ok_ = imu_fn_ && imu_fn_(imu_ctx_, imu_s_);
        if (imu_ok_) {
            const float k = 180.0f / static_cast<float>(M_PI);
            const float r = std::atan2(imu_s_.acc[1], imu_s_.acc[2]) * k;
            const float p = std::atan2(-imu_s_.acc[0], std::sqrt(imu_s_.acc[1] * imu_s_.acc[1] + imu_s_.acc[2] * imu_s_.acc[2])) * k;
            tilt_roll_ += 0.2f * (r - tilt_roll_);
            tilt_pitch_ += 0.2f * (p - tilt_pitch_);
        }
#endif
        switch (mode_) {
            case Mode::kPose:   StepPose();     break;
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
            Apply({CmdType::kRest, 0, 0, 0, {}, {}});
            return;
        }
        float yaw[kArmCount];
        float sc[kArmCount], off[kArmCount];
        for (int a = 0; a < kArmCount; a++) { sc[a] = 1.0f; off[a] = 0.0f; }
#ifdef OCTO_CTRL_CUSTOM
        {   // v14：闭环（和台面 JS 孪生同式）
            if (imu_ok_) {
                const TiltController::Out o = ctrl_.Step(imu_s_, dt);
                for (int a = 0; a < kArmCount; a++) { sc[a] = o.sc[a]; off[a] = o.off[a]; }
            }
        }
#endif
#ifdef OCTO_GAIT_CUSTOM
        custom_t_ += dt;
        for (int a = 0; a < kArmCount; a++) yaw[a] = custom_gait::Yaw(a, custom_t_, gait_.CustomScale(a) * sc[a]) + off[a];
#else
        for (int a = 0; a < kArmCount; a++) yaw[a] = gait_.Yaw(a) * sc[a] + off[a];
#endif
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

    // v16：摆姿势（每路相对中位的角度，限速由 bank_ 负责）
    void StepPose() {
        gait_.Reset();
        for (int i = 0; i < channels_ && i < kPoseMax; i++) bank_.SetTarget(i, kHome + pose_[i]);
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
    float custom_t_ = 0.0f;  // v13：自定义步态的时间（秒）
#ifdef OCTO_CTRL_CUSTOM
    TiltController ctrl_;           // v14
    ImuReadFn imu_fn_ = nullptr;
    void* imu_ctx_ = nullptr;
    ImuSample imu_s_{};             // v16
    bool imu_ok_ = false;
    float tilt_roll_ = 0.0f, tilt_pitch_ = 0.0f;
#endif
    float pose_[kPoseMax] = {};     // v16
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
`,A=`#pragma once
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
`;export{v as a,l as c,O as i,d as l,k as n,c as o,E as r,m as s,A as t,p as u};