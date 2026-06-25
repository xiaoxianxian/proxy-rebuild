#!/bin/bash

# Codex 代理启动脚本
# 使用方法: ./start-proxy.sh

# 设置代理目录
PROXY_DIR="$(dirname "$0")"

# 检查代理是否已经在运行
if lsof -i :18790 >/dev/null 2>&1; then
  echo "代理服务器已在运行 (端口 18790)"
  echo "PID: $(lsof -ti :18790)"
  exit 0
fi

# 启动代理服务器
echo "正在启动 Codex 多模型代理..."
node "$PROXY_DIR/proxy.js" &
PROXY_PID=$!

# 等待服务器启动
echo "等待服务器启动..."
sleep 3

# 检查服务器是否成功启动
if lsof -i :18790 >/dev/null 2>&1; then
  echo "✓ Codex 多模型代理已成功启动"
  echo "  端口: 18790"
  echo "  PID: $PROXY_PID"
  echo ""
  echo "可用模型:"
  echo "  - DeepSeek V4 Pro (deepseek-v4-pro)"
  echo "  - DeepSeek V4 Flash (deepseek-v4-flash)"
  echo "  - Kimi K2.5/K2.6 (kimi-k2.5, kimi-k2.6)"
  echo "  - Agnes 2.0 Flash (agnes-2.0-flash)"
else
  echo "✗ 代理服务器启动失败"
  exit 1
fi
