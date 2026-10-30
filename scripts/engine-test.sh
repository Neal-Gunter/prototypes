#!/bin/sh
# 无浏览器的物理引擎 + 电路测试（Node + Rapier WASM）
set -e
cd "$(dirname "$0")/.."
npx esbuild src/assembly/engine.js --bundle --format=esm --platform=node --outfile=.tmp/eng-bundle.mjs --log-level=warning --external:three --external:@dimforge/rapier3d-compat
npx esbuild src/assembly/catalog.js --bundle --format=esm --platform=node --outfile=.tmp/cat-bundle.mjs --log-level=warning
printf 'export * from "../src/assembly/netlist.js";\nexport * from "../src/assembly/builder.js";\nexport * from "../src/assembly/electrics.js";\nexport * from "../src/assembly/guide.js";\n' > .tmp/elec-entry.js
npx esbuild .tmp/elec-entry.js --bundle --format=esm --platform=node --outfile=.tmp/elec-bundle.mjs --log-level=warning --external:three
npx esbuild src/assembly/procedural.js --bundle --format=esm --platform=node --outfile=.tmp/proc-bundle.mjs --log-level=warning
[ "$1" = "elec-bundle-only" ] && exit 0
[ "$1" = "elec" ] || node e2e/engine-node.mjs
[ "$1" = "elec" ] || node e2e/engine-v5.mjs
node e2e/elec-node.mjs
# v21：引脚表 + 引脚冲突 / 3V3-5V 电平
NOBUNDLE=1 node scripts/pinout-test.mjs || exit 1
node scripts/octo-test.mjs || exit 1
# v11：模型 + 功能图（解析、拆分、工程 ZIP、上传零件进引擎碰撞）
node scripts/modellab-test.mjs || exit 1
node e2e/modellab-engine.mjs || exit 1
# v12：关节 / 舵机 / 关节带动碰撞 / 工程往返
node scripts/artic-test.mjs || exit 1
node e2e/artic-bench.mjs || exit 1
# v13：闭环连杆（四连杆 / 曲柄滑块 / 平行四边形 / 锁死）
node scripts/loop-test.mjs || exit 1
node scripts/gait-test.mjs || exit 1
# v14：自动步态搜索（CMA-ES / Worker 任务）+ 闭环倾斜 / 航向 + MPU-6050
node scripts/search-test.mjs || exit 1
node scripts/v14-test.mjs || exit 1
node scripts/ctrl-test.mjs || exit 1
# v15：多工况鲁棒搜索 + 横坡侧滑补偿（定向小轮 / 路径保持）+ 评估池 + 240 °/s 限速
node scripts/v15-test.mjs || exit 1
# v16：实物连接 OCTL/1（协议 / C 对拍 / 安全层 / 模拟设备 / 会话 / 校准）
node scripts/link-test.mjs || exit 1
# v17：维修关卡（12 关：故障读数 / 预期修法 / 打乱顺序 / 错误修法 / 有序关卡 / 编辑器）
node scripts/repair-test.mjs || exit 1
# v19：台面网表 → 时域仿真（八爪鱼 + 通用台面）+ 自适应步长
node scripts/netlist-test.mjs >/dev/null || exit 1
node e2e/bench-netlist-node.mjs >/dev/null || exit 1
node scripts/adaptive-test.mjs >/dev/null || exit 1
# v20：零件库数据校验 + 全部 GLB 读取 + 升压平均值模型对开关级参考
node scripts/parts-validate.mjs >/dev/null || exit 1
OUT=${OUT:-/tmp/v20eng} node scripts/glb-load-test.mjs >/dev/null || exit 1
node scripts/boost-avg-test.mjs >/dev/null || exit 1
# v21：凸分解碰撞体（网格全覆盖 / 盒子互不重叠 / 外扩 ≤ 容差）+ 引擎里不穿模
OUT=${OUT:-/tmp/v21coll} node scripts/collider-test.mjs >/dev/null || exit 1
node e2e/collider-engine.mjs >/dev/null || exit 1
