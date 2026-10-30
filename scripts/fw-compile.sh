#!/usr/bin/env bash
# v8：用免费的 arduino-cli 把八爪鱼固件编译一遍（ESP32S3 Dev Module），打印体积和我们自己代码里的 warning。
# 需要：arduino-cli（默认 ~/arduino/arduino-cli）+ `arduino-cli core install esp32:esp32@3.3.12`
set -u
CLI=${ARDUINO_CLI:-$HOME/arduino/arduino-cli}; FQ=esp32:esp32:esp32s3
ROOT=$(cd "$(dirname "$0")/.." && pwd); O=$ROOT/src/assembly/octopus; W=${TMPDIR:-/tmp}/octo-fw; rm -rf "$W"; mkdir -p "$W"
XZ=addb1ed59bd71e09a6a5e0c52ad2f1c474aa8ca1   # xiaozhi-esp32 上游提交（只取 mcp_server.h / cjson_utils.h 做桩编译）
sum() { grep -E "Sketch uses|Global variables" "$1"; echo "  warnings in our files: $(grep -E 'warning' "$1" | grep -cE 'octopus_|mcp_stub|body_firmware')"; grep -E "error:" "$1" | head -${2:-8}; }
cp -r "$O/plus/octopus_plus" "$W/"
for rig in 8 16; do echo "== 完善版 octopus_plus  OCTO_RIG=$rig"; "$CLI" compile -b $FQ --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=$rig" "$W/octopus_plus" > "$W/plus$rig.log" 2>&1; echo "  exit $?"; sum "$W/plus$rig.log"; done
echo "== v10 紧凑无线版 octopus_plus  OCTO_V10=1（Adafruit QT Py ESP32-S3 No PSRAM）"; "$CLI" compile -b esp32:esp32:adafruit_qtpy_esp32s3_nopsram --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=8 -DOCTO_V10=1" "$W/octopus_plus" > "$W/v10.log" 2>&1; echo "  exit $?"; sum "$W/v10.log"
# v13：台面导出的自定义步态（默认导出“同步划桨”），放进 v10 固件一起编译
G="$W/gait/octopus_plus"; mkdir -p "$W/gait"; cp -r "$O/plus/octopus_plus" "$W/gait/"; node "$ROOT/scripts/gait-export.mjs" "${GAIT_SRC:-row}" "$G/octopus_gait_custom.h" > /dev/null
echo "== v10 + 自定义步态 octopus_gait_custom.h（${GAIT_SRC:-row}）"; "$CLI" compile -b esp32:esp32:adafruit_qtpy_esp32s3_nopsram --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=8 -DOCTO_V10=1" "$G" > "$W/v10gait.log" 2>&1; echo "  exit $?"; sum "$W/v10gait.log"
# v14：闭环倾斜 / 航向（octopus_ctrl_custom.h → MPU-6050 + PD），v10 + 自定义步态 + 闭环；完善版 8 路 + 闭环
C="$W/ctrl/octopus_plus"; mkdir -p "$W/ctrl"; cp -r "$G" "$W/ctrl/"; node "$ROOT/scripts/gait-export.mjs" ctrl "$C/octopus_ctrl_custom.h" ${CTRL_CFG:-} > /dev/null
echo "== v10 + 自定义步态 + 闭环 octopus_ctrl_custom.h（MPU-6050 @ Wire1 41/40）"; "$CLI" compile -b esp32:esp32:adafruit_qtpy_esp32s3_nopsram --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=8 -DOCTO_V10=1" "$C" > "$W/v10ctrl.log" 2>&1; echo "  exit $?"; sum "$W/v10ctrl.log"
P="$W/ctrlplus/octopus_plus"; mkdir -p "$W/ctrlplus"; cp -r "$O/plus/octopus_plus" "$W/ctrlplus/"; cp "$C/octopus_ctrl_custom.h" "$P/"
echo "== 完善版 OCTO_RIG=8 + 闭环（MPU-6050 和 PCA9685 同一条 Wire）"; "$CLI" compile -b $FQ --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=8" "$P" > "$W/plusctrl.log" 2>&1; echo "  exit $?"; sum "$W/plusctrl.log"
# v16：OCTL/1 协议已在上面所有构建里；这里再加一份台面导出的校准表 octopus_trim_custom.h（v10 + 步态 + 闭环 + 校准；完善版 16 路 + 校准）
T="$W/trim/octopus_plus"; mkdir -p "$W/trim"; cp -r "$C" "$W/trim/"; node "$ROOT/scripts/gait-export.mjs" trim "$T/octopus_trim_custom.h" > /dev/null
echo "== v16 v10 + 步态 + 闭环 + 校准 octopus_trim_custom.h"; "$CLI" compile -b esp32:esp32:adafruit_qtpy_esp32s3_nopsram --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=8 -DOCTO_V10=1" "$T" > "$W/v10trim.log" 2>&1; echo "  exit $?"; sum "$W/v10trim.log"
T2="$W/trimplus/octopus_plus"; mkdir -p "$W/trimplus"; cp -r "$O/plus/octopus_plus" "$W/trimplus/"; cp "$T/octopus_trim_custom.h" "$T2/"
echo "== v16 完善版 OCTO_RIG=8 + 校准"; "$CLI" compile -b $FQ --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=8" "$T2" > "$W/plustrim.log" 2>&1; echo "  exit $?"; sum "$W/plustrim.log"
mkdir -p "$W/body_firmware_A"; cp "$O/md/"{body_firmware_A.ino,octopus_body.h,octopus_bus.h,octopus_gait.h} "$W/body_firmware_A/"
echo "== md 原样 body_firmware_A（ESP32-S3）"; "$CLI" compile -b $FQ --warnings all "$W/body_firmware_A" > "$W/md.log" 2>&1; echo "  exit $?"; sum "$W/md.log" 12
echo "== md 原样 body_firmware_A（经典 ESP32，对照）"; "$CLI" compile -b esp32:esp32:esp32 --warnings all "$W/body_firmware_A" > "$W/md32.log" 2>&1; echo "  exit $?"; sum "$W/md32.log"
S="$W/mcp_stub"; mkdir -p "$S"; cp "$O/plus/xiaozhi/octopus_mcp.cpp" "$O/plus/octopus_plus/"*.h "$O/plus/xiaozhi/stub_compile/"* "$S/"
if curl -sfL "https://raw.githubusercontent.com/78/xiaozhi-esp32/$XZ/main/mcp_server.h" -o "$S/mcp_server.h" && curl -sfL "https://raw.githubusercontent.com/78/xiaozhi-esp32/$XZ/main/cjson_utils.h" -o "$S/cjson_utils.h"; then
  echo "== 桩编译（STUB）octopus_mcp.cpp ← 上游 mcp_server.h @ ${XZ:0:7} + 空实现 McpServer（不能上实机）"; "$CLI" compile -b $FQ --warnings all --build-property "compiler.cpp.extra_flags=-DOCTO_RIG=16" "$S" > "$W/stub.log" 2>&1; echo "  exit $?"; sum "$W/stub.log"
else echo "== 桩编译跳过：取不到上游 mcp_server.h"; fi
echo "logs: $W"
