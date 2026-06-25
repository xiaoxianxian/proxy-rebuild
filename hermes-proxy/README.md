# Hermes Multi-Model Proxy

Python 代理服务，为 Hermes Agent 提供多模型切换支持。

## 📋 项目信息

- **版本**: 2.0.0
- **最后更新**: 2026-06-22
- **作者**: xiaoxianxian
- **许可证**: MIT
- **端口**: 18793

## ✨ 优点

- **多模型支持**: 支持 DeepSeek、Agnes 等提供商的模型切换
- **配置驱动**: 通过 config.yaml 配置文件管理模型，易于维护和备份
- **路由模式**: 支持多种路由策略，灵活应对不同场景
- **提供商状态监控**: 实时监控各提供商状态，及时发现故障
- **余额查询**: 查询各提供商账户余额，控制使用成本
- **统一管理**: 可通过 Manager Shell 统一管理，无需单独操作
- **Python 实现**: 易于理解和二次开发

## ⚠️ 局限性

- **仅支持 Hermes**: 专为 Hermes Agent 设计，不直接支持其他 AI Agent
- **配置依赖**: 需要修改 `~/.hermes/config.yaml` 才能接入代理
- **API Key 管理**: API Key 存储在 config.yaml 中，需自行保证安全
- **无 Web 管理面板**: 管理功能集成在 Manager Shell 中，无独立面板
- **依赖 Python**: 需要 Python 3.8+ 环境运行

## 🎯 适用场景

- **Hermes 用户**: 使用 Hermes Agent 并希望自由切换多个 AI 模型
- **多模型需求**: 需要在 DeepSeek、Agnes 等不同提供商间切换
- **成本控制**: 通过模型切换优化 API 使用成本
- **配置管理**: 希望通过配置文件集中管理模型和提供商

## ❓ 常见问题

### Q: 如何配置 API Keys？

A: 复制 `.env.example` 为 `.env`，然后编辑填入你的 API Keys：
```bash
cp .env.example .env
# 编辑 .env 文件，填入 DEEPSEEK_API_KEY、MOONSHOT_API_KEY、AGNES_API_KEY
```

### Q: 如何切换模型？

A: 有两种方式：
1. **管理面板**: 通过 Manager Shell 的 Hermes Tab 切换
2. **配置文件**: 直接编辑 `~/.hermes/config.yaml`

### Q: 路由模式有什么区别？

A:
- **Codex 模式**: 跟随请求中的 model 字段（默认）
- **Config 模式**: 强制按配置文件路由
- **Both 模式**: 配置文件 + 指令，两者都启用

### Q: 如何查看切换历史？

A: 通过 Manager Shell 的 Hermes Tab 查看，或调用 API：
```bash
curl http://127.0.0.1:18793/api/history
```

## 📥 安装

```bash
# 进入项目目录
cd hermes-proxy

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Keys

# 配置模型
cp config.yaml.example ~/.hermes/config.yaml
# 编辑 ~/.hermes/config.yaml，配置你的模型和提供商
```

## 🏃 启动

```bash
# 启动代理服务
python3 proxy.py

# 或使用启动脚本
chmod +x start-proxy.sh
./start-proxy.sh
```

代理服务将在 `http://127.0.0.1:18793` 启动。

## 🚫 卸载

```bash
# 停止服务
kill $(lsof -ti :18793) 2>/dev/null

# 移除配置文件（可选）
rm -f ~/.hermes/config.yaml.backup

# 清理环境变量
rm -f .env
```

## 💰 充值/获取 API Key

### DeepSeek
- **官网**: https://platform.deepseek.com
- **充值**: 登录官网，在账户中心充值
- **获取 Key**: 设置 → API Keys → 创建新 Key

### Agnes AI
- **官网**: https://agnes-ai.com
- **充值**: 登录官网，在账户中心充值
- **获取 Key**: 设置 → API Keys → 创建新 Key

## 📖 使用指南

### 1. 配置 Hermes

编辑 `~/.hermes/config.yaml`：
```yaml
model:
  base_url: https://apihub.agnes-ai.com/v1
  default: agnes-2.0-flash
  provider: custom

providers:
  deepseek:
    api: https://api.deepseek.com
    name: deepseek
    models:
      deepseek-v4-flash:
        context_length: 1000000
        name: deepseek-v4-flash
      deepseek-v4-pro:
        context_length: 1000000
        name: deepseek-v4-pro
    default_model: deepseek-v4-flash
    transport: chat_completions
  agnes:
    api: https://apihub.agnes-ai.com/v1
    name: agnes
    transport: chat_completions
```

### 2. 启动代理

```bash
cd hermes-proxy
python3 proxy.py
```

### 3. 验证连接

```bash
curl http://127.0.0.1:18793/health
```

### 4. 通过 Manager Shell 管理

访问 http://localhost:18792，在 Hermes Tab 中：
- 切换模型
- 查看提供商状态
- 查询余额

## 🔌 API 端点

### 代理端点
- `GET /health` - 健康检查
- `GET /v1/models` - 获取可用模型列表

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
hermes-proxy/
├── proxy.py              # 代理服务主文件
├── requirements.txt      # Python 依赖
├── config.yaml.example   # 配置文件模板
├── .env.example          # 环境变量模板
├── .gitignore            # Git 忽略规则
├── start-proxy.sh        # 启动脚本
└── README.md             # 本文件
```

## 🔄 版本历史

### v2.0.0 (2026-06-22)
- 集成到 Multi-Proxy Manager 统一管理平台
- 修复 dict_keys JSON 序列化问题
- 优化 find_provider 函数，支持更多模型匹配策略
- 移除管理面板代码，专注于代理服务

### v1.0.0 (2026-06-20)
- 初始版本
- 支持 DeepSeek、Agnes 多模型
- 实现配置驱动模型管理
- 添加提供商状态监控和余额查询

## 📄 许可证

MIT
