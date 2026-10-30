#!/bin/sh
# 无浏览器的物理引擎 + 电路测试（Node + Rapier WASM）
set -e
cd "$(dirname "$0")/.."
npx esbuild src/assembly/engine.js --bundle --format=esm --platform=node --outfile=.tmp/eng-bundle.mjs --log-level=warning --external:three --external:@dimforge/rapier3d-compat
npx esbuild src/assembly/catalog.js --bundle --format=esm --platform=node --outfile=.tmp/cat-bundle.mjs --log-level=warning
printf 'export * from "../src/assembly/netlist.js";\nexport * from "../src/assembly/builder.js";\nexport * from "../src/assembly/electrics.js";\nexport * from "../src/assembly/guide.js";\n' > .tmp/elec-entry.js
npx esbuild .tmp/elec-entry.js --bundle --format=esm --platform=node --outfile=.tmp/elec-bundle.mjs --log-level=warning --external:three
npx esbuild src/assembly/procedural.js --bundle --format=esm --platform=node --outfile=.tmp/proc-bundle.mjs --log-level=warning
[ "$1" = "elec" ] || node e2e/engine-node.mjs
[ "$1" = "elec" ] || node e2e/engine-v5.mjs
node e2e/elec-node.mjs
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
