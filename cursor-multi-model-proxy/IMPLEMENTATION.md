# Cursor Multi-Model Proxy — 实现方案

## 项目结构

```
cursor-multi-model-proxy/
├── src/
│   ├── index.ts              # CLI 入口（start/stop/status/guide 命令）
│   ├── providers/            # Provider 适配器
│   │   ├── index.ts          # 导出 + registerDefaultProviders
│   │   ├── base.ts           # ProviderAdapter 接口定义
│   │   ├── registry.ts       # ProviderRegistry 单例
│   │   ├── openai-compatible.ts
│   │   ├── anthropic.ts
│   │   ├── google-gemini.ts
│   │   ├── ollama.ts
│   │   └── generic.ts
│   ├── server/               # HTTP 服务
│   │   ├── app.ts            # Express 应用初始化（中间件 + 路由挂载）
│   │   ├── start.ts          # 启动入口
│   │   ├── routes.ts         # 路由模块导出
│   │   ├── routes/
│   │   │   ├── chatRoutes.ts     # /v1/chat/completions
│   │   │   ├── modelRoutes.ts    # /v1/models
│   │   │   ├── adminRoutes.ts    # /admin-api/*
│   │   │   └── index.ts
│   │   ├── handlers/
│   │   │   ├── chatHandler.ts    # 聊天请求处理（核心转发逻辑）
│   │   │   ├── streamHandler.ts  # 流式响应处理
│   │   │   └── modelsHandler.ts  # 模型列表处理
│   │   ├── middleware/         # 中间件
│   │   │   ├── middleware.ts       # requestLogger, errorHandler
│   │   │   └── validation.ts     # 请求体验证
│   │   └── admin/              # 管理员相关
│   ├── db/
│   │   └── database.ts         # SQLite 初始化 + 建表
│   ├── routing/
│   │   └── routeEngine.ts      # 路由引擎（优先级/轮询/故障转移）
│   ├── monitoring/
│   │   ├── healthMonitor.ts    # 健康监控
│   │   ├── circuitBreaker.ts   # 熔断器
│   │   └── rateLimiter.ts      # 限流器
│   ├── translate/
│   │   ├── requestConverter.ts # 请求格式转换
│   │   └── streamTranslators.ts # 流式响应转换
│   └── utils/
│       ├── crypto.ts           # API Key 加密/解密
│       └── helpers.ts          # 工具函数
├── data/                       # SQLite 数据库文件
├── dist/                       # 编译产物
├── tsconfig.json
├── package.json
└── PRODUCT.md
```

## 核心实现

### 1. Provider 适配器模式

#### 接口定义（base.ts）
```typescript
interface ProviderAdapter {
  id: ProviderId;                    // 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'generic'
  name: string;
  defaultBaseUrl: string;
  wireApi: 'openai' | 'anthropic' | 'gemini' | 'ollama';

  normalizeRequest(chatRequest, config): Promise<UpstreamRequest>;  // OpenAI → Provider 格式
  denormalizeResponse(upstreamResponse, stream): Promise<any>;       // Provider → OpenAI 格式
  healthCheck(config): Promise<boolean>;
  fetchModels(apiKey, baseUrl): Promise<ModelInfo[]>;
  supportsTools(): boolean;
  supportsVision(): boolean;
}
```

#### 各适配器实现要点

**OpenAI Compatible**：直通模式，不做协议转换
- normalizeRequest：原样透传 model、messages、stream
- healthCheck：GET /models 验证连通性

**Anthropic**：Messages API 转换
- normalizeRequest：添加 system message、max_tokens、anthropic-version header
- denormalizeResponse：将 content[0].text 映射为 assistant message
- healthCheck：GET /v1/messages with x-api-key

**Google Gemini**：Contents 格式转换
- normalizeRequest：messages → contents，system → systemInstruction
- denormalizeResponse：candidates[0].content.parts[0].text → assistant message
- healthCheck：GET /models?key=API_KEY

**Ollama**：本地模型
- normalizeRequest：直传 messages
- denormalizeResponse：message.content → assistant message
- healthCheck：GET /api/tags

**Generic**：通用 OpenAI 兼容
- 直通模式，适用于任何 OpenAI 兼容 API

#### ProviderRegistry（registry.ts）
- 单例模式
- `register(adapter)`：注册适配器
- `get(id)`：按 ID 获取
- `getAll()`：获取所有适配器

### 2. 数据库层（database.ts）

SQLite 数据库，WAL 模式提升并发性能。

**表结构**：
- `providers`：id, name, provider_id, api_key(加密), base_url, enabled, created_at, updated_at
- `models`：id, provider_id, name, enabled, alias, created_at
- `routes`：id, default_model, fallback_chain(JSON), rules(JSON), max_retries, created_at
- `logs`：id, timestamp, level, message
- `settings`：key, value

### 3. 聊天请求处理（chatHandler.ts）— 核心逻辑

```typescript
async function handleChatCompletion(req, res) {
  // 1. 解析请求：model, messages, stream
  // 2. 从数据库查询匹配的 Provider 配置
  // 3. 路由引擎选择具体 Provider（优先级/轮询/故障转移）
  // 4. ProviderAdapter.normalizeRequest() 转换请求格式
  // 5. 转发到上游 API（带 Authorization header）
  // 6. ProviderAdapter.denormalizeResponse() 转换响应格式
  // 7. 记录日志到 logs 表
  // 8. 返回 OpenAI Chat Completions 格式响应
}
```

**需要实现的关键步骤**：
- 当前是占位实现，只返回模拟文本
- 需要真正连接 ProviderRegistry，从数据库加载 Provider 配置
- 根据 model 名找到对应的 Provider，使用其适配器进行协议转换
- 支持流式响应（SSE）

### 4. 路由引擎（routeEngine.ts）

```typescript
interface RouteConfig {
  defaultModel: string;
  fallbackChain: string[];      // 故障转移链
  rules: RoutingRule[];         // 条件路由规则
  maxRetries: number;
  strategy: 'priority' | 'round-robin' | 'cost-optimization';
}
```

- `getNextRoute(modelName, config)`：根据策略选择下一个 Provider
- 轮询模式维护内部计数器
- 优先级模式直接取 fallback_chain[0]

### 5. 熔断器（circuitBreaker.ts）

三态机：CLOSED → OPEN → HALF_OPEN → CLOSED
- 连续失败 N 次 → OPEN（拒绝请求）
- 等待 resetTimeout → HALF_OPEN（允许试探请求）
- 成功 → CLOSED，失败 → OPEN

### 6. 限流器（rateLimiter.ts）

令牌桶算法：
- 每个 Provider 独立桶
- 默认容量 60 个令牌，每秒补充 1 个
- 请求前扣减令牌，不足则拒绝

### 7. 健康监控（healthMonitor.ts）

- 定时（30s）检测所有 Provider 健康状态
- 存储状态：state, lastChecked, error
- 为路由引擎提供故障信息

### 8. 加密工具（crypto.ts）

- AES 加密存储 API Key
- 使用时解密
- 密钥从 ENCRYPTION_KEY 环境变量获取

### 9. CLI 入口（index.ts）

```bash
npx cursor-proxy start   # 启动代理服务
npx cursor-proxy stop    # 停止代理服务
npx cursor-proxy status  # 查看状态
npx cursor-proxy guide   # 显示接入引导
```

## 依赖
```json
{
  "express": "^4.18.0",
  "better-sqlite3": "^9.0.0",
  "undici": "^6.0.0",
  "helmet": "^7.0.0",
  "compression": "^1.7.0",
  "cors": "^2.8.0",
  "typescript": "^5.0.0",
  "@types/express": "^4.17.0",
  "@types/better-sqlite3": "^7.0.0",
  "@types/cors": "^2.8.0",
  "@types/compression": "^1.7.0"
}
```

## 启动方式
```bash
# 开发模式
npm run build && npm start

# 通过 CLI
npx cursor-proxy start

# 通过管理脚本
./manage.sh cursor start

# 通过管理后台
curl -X POST http://localhost:18792/api/start/cursor
```

## 环境变量
- `ENCRYPTION_KEY`：API Key 加密密钥（默认：'default-secret-key-change-in-production'）
- `PORT`：服务端口（默认：18794）

## 注意事项
- 数据库文件位于 `data/proxy.db`
- API Key 加密存储，解密后用于上游请求
- 路由引擎和熔断器需要与 chatHandler 深度集成
- 当前 chatHandler 是占位实现，需要重点补全
