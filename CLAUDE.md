# Proxy Rebuild - Multi-Proxy Manager

## 项目概述

这是一个多代理管理系统，用于统一管理三个 AI 代理服务（Codex、Hermes、Cursor），并提供统一的 Web 管理界面。

## 架构

| 模块 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| `multi-proxy-manager/` | Node.js + Express | 18792 | Web 管理界面（前端+后端） |
| `codex-proxy/` | Node.js + Express | 18790 | Codex CLI 代理 |
| `hermes-proxy/` | Python + Flask | 18793 | Hermes Agent 代理 |
| `cursor-multi-model-proxy/` | Node.js + TypeScript + SQLite | 18794 | Cursor IDE 代理 |

## 快速开始

```bash
# 安装依赖
bash install.sh --all

# 启动所有服务
bash manage.sh start

# 查看状态
bash manage.sh status

# 查看日志
bash manage.sh logs all

# 停止所有服务
bash manage.sh stop
```

## 启动方式

- **一键脚本**: `manage.sh start`（启动所有服务）
- **单独启动管理器**: `node multi-proxy-manager/server.js`
- **预览面板**: 使用 Launch preview 启动 `multi-proxy-manager` 配置

## 关键文件

- `manage.sh` - 日常服务管理（启停、日志、状态）
- `install.sh` - 安装/卸载/开机自启
- `multi-proxy-manager/public/index.html` - Web 管理界面（单文件 SPA）
- `multi-proxy-manager/server.js` - 管理器后端（进程管理 + API 转发）

## 已知限制与注意事项

### 关键约束
- **`lsof` 必须使用完整路径 `/usr/sbin/lsof`**：Node.js 子进程的 PATH 不包含 `/usr/sbin`，所有 `execSync` 调用中的 `lsof` 必须使用绝对路径。违反此规则会导致代理状态检测失败（`isProcessRunning` 返回 false），表现为所有代理显示"未运行"。
- **代理进程由外部管理**：管理器通过 `lsof` 端口检测回退判断代理是否运行。如果代理不是通过管理器启动的（如直接 `node proxy.js`），`proxyProcesses` 中不会有追踪记录，但端口检测仍能工作。
- **Cursor 代理的 CRUD 功能**：仅 Cursor 支持供应商/模型的管理（增删改查），Codex 和 Hermes 的供应商页面仅展示只读状态。

### 启停优化
- 启停操作使用**乐观更新**：API 成功后立即更新 UI，无需等待全局状态刷新。
- 停止代理时，`killPort` 使用 SIGTERM → 500ms → SIGKILL 的两阶段机制。
- 启动代理时，使用轮询等待端口绑定（最多 5 秒），而非固定延迟。

## 开发注意

- Web 界面是单文件 SPA，所有 CSS/JS 都在 `index.html` 中
- 后端通过 `express.static()` 提供静态文件，通过 API 路由转发请求到各代理
- 代理进程由管理器自动检测和启动/停止
- 开机自启使用 macOS LaunchAgent（`~/Library/LaunchAgents/com.multi-proxy-manager.plist`）
