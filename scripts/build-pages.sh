#!/usr/bin/env bash
# 构建 GitHub Pages 版本：子路径 /prototypes/，SPA 回退（404.html），已知路由各放一份 index.html 让直接打开也是 200
set -euo pipefail
OUT="${1:-/tmp/ghroot/prototypes}"
cd "$(dirname "$0")/.."
npx vite build --base=/prototypes/ --outDir "$OUT" --emptyOutDir
cp "$OUT/index.html" "$OUT/404.html"
for r in example workbench assembly parts assembly/guide assembly/octopus-guide assembly/model electrics credits repair; do mkdir -p "$OUT/$r"; cp "$OUT/index.html" "$OUT/$r/index.html"; done
touch "$OUT/.nojekyll"
echo "pages build ok -> $OUT"
