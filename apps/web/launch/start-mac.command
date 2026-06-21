#!/bin/bash
# One-click local launcher for macOS — double-click to start the Live2D app.
# No manual setup: it finds (or downloads a portable) Node.js, installs deps the
# first time, prepares a local file-based database + storage, then opens the app
# in your browser. Closing this Terminal window stops the app.
set -e

# --- Locate the app directory -------------------------------------------------
# APP_DIR is baked when this file is copied to ~/Downloads; otherwise it resolves
# relative to this script's location inside the project (apps/web/launch/..).
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"
echo "================================================"
echo "  Live2D 本地启动"
echo "  目录: $APP_DIR"
echo "================================================"

# --- 1. Node.js: system install, or a portable copy downloaded locally --------
if command -v node >/dev/null 2>&1; then
  NPM="npm"
  echo "✓ 已检测到 Node.js: $(node -v)"
else
  NODE_DIR="$APP_DIR/.local-node"
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    echo "未检测到 Node.js，正在下载便携版（无需安装、无需管理员权限）…"
    NODE_VER="v20.18.1"
    case "$(uname -m)" in arm64) NA="arm64" ;; *) NA="x64" ;; esac
    URL="https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-darwin-${NA}.tar.gz"
    mkdir -p "$NODE_DIR"
    curl -fsSL "$URL" | tar xz -C "$NODE_DIR" --strip-components=1
    echo "✓ 便携版 Node.js 已就绪"
  fi
  export PATH="$NODE_DIR/bin:$PATH"
  NPM="$NODE_DIR/bin/npm"
fi

# --- 2. Local environment file ------------------------------------------------
[ -f .env ] || touch .env
add_env() { grep -q "^$1=" .env || echo "$1=$2" >> .env; }
add_env PGLITE_DATA_DIR '"./.pglite"'
add_env STORAGE_DRIVER '"local"'
add_env AUTH_URL '"http://localhost:3000"'
grep -q "^AUTH_SECRET=" .env || echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env

# --- 3. First-run setup (deps + database + demo characters) -------------------
[ -d node_modules ] || { echo "首次运行：安装依赖（约 1-2 分钟）…"; "$NPM" install; }
if [ ! -f .pglite/.initialized ]; then
  echo "首次运行：初始化本地数据库与演示角色…"
  "$NPM" run db:push
  "$NPM" run db:seed || true
  "$NPM" run setup:creator-models || true
  mkdir -p .pglite && touch .pglite/.initialized
fi

# --- 4. Start the server, open the browser when it's ready --------------------
echo ""
echo "正在启动服务… 启动后会自动打开浏览器。"
echo "登录账号：creator / ChangeMe123!（创作者）  admin / ChangeMe123!（管理员）"
echo "保持本窗口打开 = 服务运行中；关闭窗口或按 Ctrl+C = 停止。"
echo ""
(
  for _ in $(seq 1 90); do
    if curl -s -o /dev/null http://localhost:3000; then open "http://localhost:3000"; break; fi
    sleep 1
  done
) &
exec "$NPM" run dev
