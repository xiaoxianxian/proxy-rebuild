# Multi-Proxy Manager — 产品方案

## 概述

Multi-Proxy Manager 是一个共享的 Web 管理后台，用于统一管理所有已安装的代理模块（Codex Proxy、Hermes Proxy、Cursor Multi-Model Proxy）。安装时强制安装，但只显示已安装代理的配置功能。

## 核心功能

### 1. 全局概览
- 显示所有已安装代理的运行状态（运行中/未运行）
- 各代理端口号
- 一键启停所有代理
- 可用模型总数统计

### 2. 代理独立配置页

每个代理拥有独立配置页，功能根据已安装的代理动态生成：

**Codex Proxy 配置页**：
- 当前配置模型显示
- 路由模式选择（codex / config / both）
- 模型切换下拉框（从 UPSTREAM_MODELS 动态加载）
- Provider 状态列表（DeepSeek / Kimi / Agnes）
- 账户余额查询
- 切换历史记录
- 连接测试

**Hermes Proxy 配置页**：
- 当前配置模型显示
- 路由模式选择
- 模型切换（从 config.yaml 动态发现）
- Provider 状态列表
- 配置文件路径显示
- 切换历史记录

**Cursor Proxy 配置页**：
- Provider 管理（增删改查、启用/禁用）
- 模型管理（增删改查、启用/禁用、别名设置）
- 路由策略配置（优先级/轮询/故障转移链）
- 全局设置（端口、超时时间）
- 请求日志实时查看

### 3. 日志中心
- 所有代理的统一日志视图
- 按代理筛选
- 按级别筛选（INFO/WARN/ERROR）
- 自动刷新（5秒间隔）
- 手动刷新按钮

### 4. 安装时行为
- 强制安装，但只显示已安装代理的配置面板
- 后续安装新代理时，管理后台自动检测并添加对应配置页
- 无需重新部署管理后台

## UI 设计风格

**macOS 系统偏好设置风**：
- 左侧导航栏，图标 + 文字
- 右侧卡片分组布局
- 简洁的表单控件
- 暗色主题（slate 色系）
- 无花哨动画，注重实用性
- 状态指示用圆点 + 颜色（绿/红/黄）

## 技术栈
- Node.js + Express（后端）
- React + Vite（前端，可选 — 也可纯 HTML/JS）
- SQLite（本地存储，仅 Cursor 代理需要）

## 端口
- 默认端口：18792

## API 端点

### 代理管理
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/status | 获取所有代理状态 |
| POST | /api/start/:name | 启动指定代理 |
| POST | /api/stop/:name | 停止指定代理 |

### 代理 API 转发
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/:proxy/* | 转发 GET 请求到代理 |
| POST | /api/:proxy/* | 转发 POST 请求到代理 |
| PUT | /api/:proxy/* | 转发 PUT 请求到代理 |
| DELETE | /api/:proxy/* | 转发 DELETE 请求到代理 |

### 全局
| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /health | 管理后台健康检查 |
| GET | /installed | 获取已安装代理列表 |
| POST | /api/install | 注册新安装的代理 |
