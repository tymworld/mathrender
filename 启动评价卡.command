#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  NODE_BINARY="$(command -v node)"
elif [[ -x /Users/ymtang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ]]; then
  NODE_BINARY=/Users/ymtang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
else
  print '未找到 Node.js。请安装 Node.js 22 或更新版本。'
  read '?按回车退出'
  exit 1
fi
"$NODE_BINARY" server/inequality-review.mjs
