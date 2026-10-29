#!/usr/bin/env bash
# 自动提交并推送当前分支到 GitHub。
# 用法：scripts/autopush.sh "提交说明"
# 安全约定：不打印也不保存令牌；从不强推；拒绝推送 main/master；不开/不合并 PR；不提交 node_modules 与密钥文件。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
case "$BRANCH" in
  main|master|HEAD) echo "拒绝：当前分支是 $BRANCH，autopush 只推送功能分支。" >&2; exit 1 ;;
esac
if [ -z "${GITHUB_TOKEN:-}" ]; then echo "缺少 GITHUB_TOKEN 环境变量，未推送。" >&2; exit 1; fi
MSG="${1:-}"
git add -A
# 防止误提交：暂存区里出现 node_modules 或疑似密钥文件就中止
if git diff --cached --name-only | grep -E '(^|/)node_modules/|(^|/)\.env|\.pem$|\.key$|id_rsa' >/dev/null; then
  echo "暂存区里有 node_modules 或疑似密钥文件，已中止。" >&2; git reset -q; exit 1
fi
if ! git diff --cached --quiet; then
  if [ -z "$MSG" ]; then
    MSG="更新：$(git diff --cached --name-only | sed 's|/.*||' | sort -u | head -5 | tr '\n' ' ')（$(git diff --cached --name-only | wc -l) 个文件）"
  fi
  git commit -q -m "$MSG"
fi
# 推送（普通 push，不带 --force）；令牌只出现在本条命令的 git 配置里，输出里的令牌会被抹掉
set +e
OUT=$(git -c http.extraheader="Authorization: Basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)" push origin HEAD 2>&1)
RC=$?
set -e
OUT=${OUT//"$GITHUB_TOKEN"/***}
printf '%s\n' "$OUT" | sed -e 's/Basic [A-Za-z0-9+\/=]*/Basic ***/g'
if [ $RC -ne 0 ]; then echo "推送失败（退出码 $RC）。" >&2; exit $RC; fi
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | cut -f1 || true)
if [ -z "$REMOTE" ]; then
  REMOTE=$(git -c http.extraheader="Authorization: Basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)" ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | cut -f1 || true)
fi
if [ "$LOCAL" = "$REMOTE" ]; then echo "已推送 $BRANCH @ $LOCAL"; else echo "推送后核对不一致：本地 $LOCAL，远端 ${REMOTE:-未知}" >&2; exit 2; fi
