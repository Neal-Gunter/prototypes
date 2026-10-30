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
