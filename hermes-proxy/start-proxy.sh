#!/bin/bash

# Hermes 代理启动脚本
# 使用方法: ./start-proxy.sh

# 设置代理目录
PROXY_DIR="$(dirname "$0")"

# 检查代理是否已经在运行
if lsof -i :18793 >/dev/null 2>&1; then
  echo "代理服务器已在运行 (端口 18793)"
  echo "PID: $(lsof -ti :18793)"
  exit 0
fi

# 启动代理服务器
echo "正在启动 Hermes 多模型代理..."
python3 "$PROXY_DIR/proxy.py" &
PROXY_PID=$!

# 等待服务器启动
echo "等待服务器启动..."
sleep 3

# 检查服务器是否成功启动
if lsof -i :18793 >/dev/null 2>&1; then
  echo "✓ Hermes 多模型代理已成功启动"
  echo "  端口: 18793"
  echo "  PID: $PROXY_PID"
else
  echo "✗ 代理服务器启动失败"
  exit 1
fi
