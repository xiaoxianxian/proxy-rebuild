# Cursor Multi-Model Proxy — 产品方案

## 概述

Cursor Multi-Model Proxy 是一个面向 Cursor IDE 的多模型代理服务器，提供多 Provider 统一管理、模型维度切换、协议转换和智能路由功能。它是整个系统中功能最复杂的模块，采用 Provider 适配器模式支持多种上游 API。

## 核心功能

### 1. Provider 管理
- 支持多种上游 Provider：OpenAI 兼容、Anthropic Claude、Google Gemini、Ollama、Generic
- 每个 Provider 独立配置：名称、API Key（加密存储）、Base URL、启用/禁用状态
- Provider 间互不影响，可独立启用/禁用
- SQLite 持久化存储 Provider 配置

### 2. 模型管理
- 模型与 Provider 是多对多关系
- 每个模型属于一个 Provider，可设置别名
- 模型维度切换：切换后同一对话继续使用新模型，上下文完整传递
- 支持 Agnes 模型（作为 OpenAI 兼容 Provider 接入）

### 3. 智能路由
- 优先级路由：按 fallback_chain 顺序尝试
- 轮询路由：round-robin 负载均衡
- 成本优化路由：预留接口
- 故障转移：自动重试、熔断器保护

### 4. 协议转换
- 输入转换：将 OpenAI Chat Completions 格式转换为目标 Provider 格式
  - Anthropic：添加 `x-api-key` 和 `anthropic-version` header，转换 system message
  - Gemini：转换 messages 为 contents 格式
  - Ollama：直接透传
- 输出转换：将上游响应统一转换为 OpenAI Chat Completions 格式
  - 支持流式（SSE）和非流式响应
  - 工具调用支持

### 5. 健康监控
- 定期检测各 Provider 健康状态
- 熔断器：连续失败 N 次后自动断开，避免雪崩
- 限流器：每个 Provider 每分钟最多 N 次请求

### 6. 管理 API
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /v1/models | 列出所有可用模型（OpenAI 兼容格式） |
| POST | /v1/chat/completions | 聊天请求转发（核心） |
| GET | /health | 健康检查 |
| GET | /admin-api/providers | 获取 Provider 列表 |
| POST | /admin-api/providers | 创建 Provider |
| PUT | /admin-api/providers/:id | 更新 Provider |
| DELETE | /admin-api/providers/:id | 删除 Provider |
| GET | /admin-api/models | 获取模型列表 |
| POST | /admin-api/models | 创建模型 |
| DELETE | /admin-api/models/:id | 删除模型 |
| GET | /admin-api/routes | 获取路由配置 |
| POST | /admin-api/routes | 创建路由配置 |
| GET | /admin-api/logs | 获取请求日志 |
| GET | /admin-api/settings | 获取全局设置 |
| PUT | /admin-api/settings | 更新全局设置 |

## 技术栈
- Node.js + Express
- TypeScript
- better-sqlite3（本地数据库）
- undici（HTTP 客户端）
- helmet + compression + cors（安全与性能）

## 端口
- 默认端口：18794

## 配置方式
1. 打开 Cursor → Settings → Models
2. 在 OpenAI API Key 处填入占位符：`dummy`
3. 开启 "Override OpenAI Base URL"，填入：`http://127.0.0.1:18794/v1`
4. 点击 "Add Custom Model"，输入要使用的模型名称
5. 通过管理后台添加 Provider 和 API Key
