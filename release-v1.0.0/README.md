# Proxy Rebuild v1.0.0 Release

## 模块列表

| 模块 | 说明 | 端口 | 技术栈 |
|------|------|------|--------|
| `multi-proxy-manager/` | Web 管理后台 | 18792 | Node.js + Express |
| `codex-proxy/` | Codex CLI 代理 | 18790 | Node.js + Express |
| `hermes-proxy/` | Hermes Agent 代理 | 18793 | Python + Flask |
| `cursor-multi-model-proxy/` | Cursor IDE 代理 | 18794 | TypeScript + Express + SQLite |

## 快速安装

```bash
# 解压后进入目录
tar -xzf proxy-rebuild-v1.0.0.tar.gz
cd proxy-rebuild-v1.0.0

# 安装依赖
bash install.sh --all

# 编辑 .env 配置 API Key
nano codex-proxy/.env
nano hermes-proxy/.env
nano cursor-multi-model-proxy/.env

# 启动所有服务
bash manage.sh start

# 打开管理面板
# http://localhost:18792
```

## 常用命令

```bash
bash manage.sh start      # 启动所有服务
bash manage.sh stop       # 停止所有服务
bash manage.sh status     # 查看状态
bash manage.sh logs all   # 查看日志
```

## 测试

```bash
# Manager
cd multi-proxy-manager && NODE_ENV=test npx jest --verbose --forceExit

# Codex
cd codex-proxy && NODE_ENV=test npx jest --verbose --forceExit

# Hermes
cd hermes-proxy && PYTHONPATH=. python3 -m pytest tests/ -v

# Cursor
cd cursor-multi-model-proxy && NODE_OPTIONS='--experimental-vm-modules' npx jest --verbose
```

## GitHub 仓库

- [管理面板](https://github.com/xiaoxianxian/multi-proxy-manager-shell)
- [Codex 代理](https://github.com/xiaoxianxian/codex-multi-model-proxy)
- [Hermes 代理](https://github.com/xiaoxianxian/hermes-multi-model-config)
- [Cursor 代理](https://github.com/xiaoxianxian/cursor-multi-model-proxy)
