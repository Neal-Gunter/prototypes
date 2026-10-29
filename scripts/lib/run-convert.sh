#!/usr/bin/env bash
# 分块并行转换（最多 2 个进程，节省内存）
N=$(node -e 'console.log(require("../libsrc/manifest.json").length)')
seq 0 20 $((N-1)) | xargs -P 2 -I{} sh -c 'node --max-old-space-size=1400 scripts/convert-library.mjs {} 20 2>&1 | grep -v prune' 
echo ALL_DONE
