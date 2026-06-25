# Codex Proxy — 产品方案

## 概述

Codex Proxy 是一个面向 OpenAI Codex CLI 的多模型代理服务器，提供模型切换、协议转换和聊天请求转发功能。

## 核心功能

### 1. 配置文件解析
- 自动检测 Codex 配置文件位置（config.toml / config.yaml）
- 支持 TOML 和 YAML 两种格式
- 实时监控配置文件变更，通知管理后台

### 2. 模型切换
- 通过 API 修改配置文件中的 model 字段
- 切换后立即生效，Codex CLI 下次请求使用新模型
- 记录切换历史（最近 50 条）

### 3. 聊天请求转发
- 接收 OpenAI Chat Completions API 格式请求
- 根据模型名自动匹配上游 Provider
- 转发请求到对应 Provider API（DeepSeek / Kimi / Agnes）
- 支持流式和非流式响应

### 4. 上游 Provider 支持
| Provider | Base URL | 模型列表 |
|----------|----------|----------|
| DeepSeek | https://api.deepseek.com/v1 | deepseek-v4-pro, deepseek-v4-flash |
| Kimi | https://api.moonshot.cn/v1 | moonshot-v1-*, kimi-k2.5, kimi-k2.6, kimi-k2.7-code, kimi-k2.7-code-highspeed, vision 系列 |
| Agnes | https://apihub.agnes-ai.com/v1 | agnes-2.0-flash, agnes-1.5-flash, agnes-image-2.0-flash, agnes-image-2.1-flash, agnes-video-v2.0 |

### 5. 路由模式
- `codex`：由代理自动路由（根据模型名匹配 Provider）
- `config`：读取配置文件中的 model 字段决定
- `both`：两者结合

### 6. API 端点
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /v1/models | 列出所有可用模型 |
| POST | /v1/chat/completions | 聊天请求转发 |
| GET | /health | 健康检查 |
| GET | /api/config | 获取当前配置 |
| GET | /api/routing-mode | 获取路由模式 |
| POST | /api/set-routing-mode | 设置路由模式 |
| GET | /api/providers/status | 获取 Provider 状态 |
| GET | /api/balances | 查询账户余额 |
| GET | /api/history | 获取切换历史 |
| POST | /api/switch-model | 切换模型 |
| POST | /api/test-connection | 测试连接 |
| POST | /api/clear-history | 清空历史记录 |

## 技术栈
- Node.js + Express
- 环境变量配置 API Key（DEEPSEEK_API_KEY, MOONSHOT_API_KEY, AGNES_API_KEY）
- 文件系统读写配置文件
- undici fetch 转发请求

## 端口
- 默认端口：18790

## 配置文件路径
- 优先：~/.hermes/config.toml
- 备选：~/.codex/config.toml、~/Library/Application Support/Codex/config.toml
