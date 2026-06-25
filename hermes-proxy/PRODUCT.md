# Hermes Proxy — 产品方案

## 概述

Hermes Proxy 是一个面向 NousResearch Hermes Agent 的多模型代理服务器，提供模型切换、协议转换和聊天请求转发功能。

## 核心功能

### 1. 配置文件解析
- 自动检测 Hermes 配置文件位置（config.yaml）
- 支持 YAML 格式的 providers 配置
- 实时监控配置文件变更

### 2. 模型切换
- 通过 API 修改配置文件中的默认模型
- 切换后立即生效
- 记录切换历史（最近 50 条）

### 3. 聊天请求转发
- 接收 OpenAI Chat Completions API 格式请求
- 根据模型名在 providers 配置中查找对应 Provider
- 转发请求到对应 Provider API
- 支持流式和非流式响应

### 4. Provider 发现机制
- 从 config.yaml 的 `providers` 节点动态发现所有已配置的 Provider
- 每个 Provider 可配置多个模型（models 字典）
- Provider 的 API 地址从 `api` 字段获取

### 5. 路由模式
- `codex`：由代理自动路由（根据模型名匹配 Provider）
- `config`：读取配置文件中的 model.default 决定
- `both`：两者结合

### 6. API 端点
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /v1/models | 列出所有可用模型（从 config.yaml 动态发现） |
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
- Python 3 + Flask
- PyYAML 解析配置文件
- Requests 库转发请求
- 环境变量配置

## 端口
- 默认端口：18793

## 配置文件路径
- 优先：~/.hermes/config.yaml
- 备选：~/Library/Containers/app.nousresearch.hermes/Data/.hermes/config.yaml
