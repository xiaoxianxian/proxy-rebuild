# Codex Multi-Model Proxy

Node.js 代理服务，支持 Codex 桌面端自由切换 DeepSeek、Kimi、Agnes 等多模型。

## 📋 项目信息

- **版本**: 2.0.0
- **最后更新**: 2026-06-22
- **作者**: xiaoxianxian
- **许可证**: MIT
- **端口**: 18790

## ✨ 优点

- **多模型支持**: 支持 DeepSeek V4 Pro/Flash, Kimi K2.5/K2.6, Agnes 2.0 Flash 等 18 个模型
- **智能路由**: 支持 Codex/Config/Both 三种路由模式，灵活应对不同场景
- **对话内切换**: 支持 `@model` 指令在对话中临时切换模型，无需重启
- **自动重试**: 上游错误自动重试（指数退避），提高成功率
- **协议转换**: 将 Codex Responses API 转换为 Chat Completions，兼容多种上游 API
- **上下文管理**: 自动截断超长对话，保留重要上下文，避免 token 超限
- **图像/视频生成**: 支持 Agnes 图像和视频生成模型
- **统一管理**: 可通过 Manager Shell 统一管理，无需单独操作

## ⚠️ 局限性

- **仅支持 Codex**: 专为 Codex CLI 设计，不直接支持其他 AI Agent
- **配置依赖**: 需要修改 Codex 的 config.toml 才能接入代理
- **API Key 管理**: API Key 存储在 .env 文件中，需自行保证安全
- **无 Web 管理面板**: 管理功能集成在 Manager Shell 中，无独立面板
- **依赖 Node.js**: 需要 Node.js 环境运行

## 🎯 适用场景

- **Codex 用户**: 使用 Codex CLI 并希望自由切换多个 AI 模型
- **多模型需求**: 需要在 DeepSeek、Kimi、Agnes 等不同提供商间切换
- **成本控制**: 通过模型切换优化 API 使用成本
- **容错需求**: 需要自动重试和故障转移机制

## ❓ 常见问题

### Q: 如何配置 API Keys？

A: 复制 `.env.example` 为 `.env`，然后编辑填入你的 API Keys：
```bash
cp .env.example .env
# 编辑 .env 文件，填入 DEEPSEEK_API_KEY、MOONSHOT_API_KEY、AGNES_API_KEY
```

### Q: 如何切换模型？

A: 有三种方式：
1. **管理面板**: 通过 Manager Shell 的 Codex Tab 切换
2. **对话内指令**: 在对话中输入 `@model agnes-2.0-flash`
3. **配置文件**: 直接编辑 `~/.codex/config.toml`

### Q: 路由模式有什么区别？

A:
- **Codex 模式**: 跟随请求中的 model 字段（默认）
- **Config 模式**: 强制按配置文件路由，解决 Codex 缓存问题
- **Both 模式**: 配置文件 + @model 指令，两者都启用

### Q: 如何查看切换历史？

A: 通过 Manager Shell 的 Codex Tab 查看，或调用 API：
```bash
curl http://127.0.0.1:18790/api/history
```

## 📥 安装

```bash
# 进入项目目录
cd codex-proxy

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Keys
```

## 🏃 启动

```bash
# 启动代理服务
npm start

# 或使用启动脚本
chmod +x start-proxy.sh
./start-proxy.sh
```

代理服务将在 `http://127.0.0.1:18790` 启动。

## 🚫 卸载

```bash
# 停止服务
kill $(lsof -ti :18790) 2>/dev/null

# 移除配置文件（可选）
rm -f ~/.codex/config.toml.backup

# 清理环境变量
rm -f .env
```

## 💰 充值/获取 API Key

### DeepSeek
- **官网**: https://platform.deepseek.com
- **充值**: 登录官网，在账户中心充值
- **获取 Key**: 设置 → API Keys → 创建新 Key

### Kimi/Moonshot
- **官网**: https://platform.moonshot.cn
- **充值**: 登录官网，在账户中心充值
- **获取 Key**: 设置 → API Keys → 创建新 Key

### Agnes AI
- **官网**: https://agnes-ai.com
- **充值**: 登录官网，在账户中心充值
- **获取 Key**: 设置 → API Keys → 创建新 Key

## 📖 使用指南

### 1. 配置 Codex

编辑 `~/.codex/config.toml`：
```toml
model_provider = "custom-proxy"
model = "agnes-2.0-flash"
wire_api = "responses"

[model_providers.custom-proxy]
name = "Custom Multi-Model Proxy"
wire_api = "responses"
base_url = "http://127.0.0.1:18790/v1"
requires_openai_auth = false
```

### 2. 启动代理

```bash
cd codex-proxy
npm start
```

### 3. 验证连接

```bash
curl http://127.0.0.1:18790/health
```

### 4. 通过 Manager Shell 管理

访问 http://localhost:18792，在 Codex Tab 中：
- 切换模型
- 管理路由模式
- 查看提供商状态
- 查询余额
- 查看切换历史

## 🔌 API 端点

### 代理端点
- `GET /health` - 健康检查
- `GET /v1/models` - 获取可用模型列表
- `POST /v1/chat/completions` - 聊天补全代理
- `POST /v1/responses` - Responses API 代理（核心）

### 管理端点（供 Manager Shell 调用）
- `GET /api/config` - 获取当前配置
- `GET /api/routing-mode` - 获取路由模式
- `POST /api/set-routing-mode` - 设置路由模式
- `GET /api/providers/status` - 获取提供商状态
- `GET /api/balances` - 获取余额
- `GET /api/history` - 获取切换历史
- `POST /api/switch-model` - 切换模型
- `POST /api/test-connection` - 测试连接
- `POST /api/clear-history` - 清空历史

## 📁 文件结构

```
codex-proxy/
├── proxy.js          # 代理服务主文件
├── package.json      # 项目配置
├── .env.example      # 环境变量模板
├── .gitignore        # Git 忽略规则
├── start-proxy.sh    # 启动脚本
└── README.md         # 本文件
```

## 🔄 版本历史

### v2.0.0 (2026-06-22)
- 集成到 Multi-Proxy Manager 统一管理平台
- 修复语法错误和重复声明问题
- 移除管理面板代码，专注于代理服务
- 优化路由模式和协议转换

### v1.0.0 (2026-06-20)
- 初始版本
- 支持 DeepSeek、Kimi、Agnes 多模型
- 实现 Responses API 到 Chat Completions 转换
- 添加自动重试和上下文管理

## 📄 许可证

MIT
