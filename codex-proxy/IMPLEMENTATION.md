# Codex Proxy — 实现方案

## 项目结构

```
codex-proxy/
├── proxy.js          # 主入口，Express 应用
├── start-proxy.sh    # 启动脚本
├── .env.example      # 环境变量模板
├── package.json      # 依赖声明
└── PRODUCT.md        # 产品方案文档
```

## 核心实现

### proxy.js — 单文件实现

#### 1. 配置检测与解析
```javascript
// 按优先级扫描配置文件路径
const candidates = [
  path.join(HOME, '.hermes', 'config.toml'),
  path.join(HOME, 'Library', 'Containers', 'app.nousresearch.hermes', 'Data', '.hermes', 'config.yaml'),
  path.join(HOME, '.codex', 'config.toml'),
  path.join(HOME, 'Library', 'Containers', 'com.openai.codex', 'Data', '.codex', 'config.toml'),
  path.join(HOME, 'Library', 'Application Support', 'Codex', 'config.toml'),
  path.join(HOME, '.codex-plus-plus', 'config.toml')
];
```

- `parseConfigToml(filePath)`：解析 TOML/YAML 格式，提取 model、model_provider、wire_api 字段
- `getConfigModel()`：读取当前配置中的活跃模型
- `updateConfigToml(filePath, newModel)`：写入新模型值，保持文件格式兼容

#### 2. 上游 Provider 定义
```javascript
const UPSTREAM_MODELS = [
  { name: 'DeepSeek', baseUrl: '...', apiKey: process.env.DEEPSEEK_API_KEY, availableModels: [...] },
  { name: 'Kimi',     baseUrl: '...', apiKey: process.env.MOONSHOT_API_KEY, availableModels: [...] },
  { name: 'Agnes',    baseUrl: '...', apiKey: process.env.AGNES_API_KEY,    availableModels: [...] }
];
```

- `findProvider(modelName)`：精确匹配 → 关键词匹配 → 返回 Provider 对象
- 未配置 API Key 时 Provider 标记为 offline

#### 3. 路由模式管理
- 存储在 `~/.codex-proxy/routing-mode.json`
- 三种模式：`codex`（代理自动路由）、`config`（读配置文件）、`both`（两者结合）
- `loadRoutingMode()` 从文件加载，`updateRoutingMode(mode)` 写入并更新内存状态

#### 4. 聊天请求转发
```javascript
app.post('/v1/chat/completions', async (req, res) => {
  const provider = findProvider(req.body.model);
  // 1. 验证 Provider 存在
  // 2. 构建上游 URL: ${provider.baseUrl}/chat/completions
  // 3. 转发请求体，添加 Authorization: Bearer ${provider.apiKey}
  // 4. 流式响应：response.body.pipe(res)
  // 5. 非流式：await response.json() → res.json()
});
```

#### 5. 模型切换 API
```javascript
app.post('/api/switch-model', (req, res) => {
  // 1. 验证模型是否在 UPSTREAM_MODELS 中
  // 2. 读取当前配置，记录旧模型名
  // 3. updateConfigToml() 写入新模型
  // 4. updateRoutingMode('config') 自动切换到 config 模式
  // 5. 记录切换历史（switchHistory 数组，最多 50 条）
  // 6. 返回 { success, message, oldModel, newModel, needRestart }
});
```

#### 6. 余额查询
- DeepSeek：GET `${baseUrl}/user/info`
- Kimi：GET `${baseUrl}/user/info`
- Agnes：GET `${baseUrl}/user/balance`

#### 7. 切换历史
- 内存数组 `switchHistory[]`，每条记录包含：timestamp, action, from, to, mode, success
- 最多保留 50 条，超出 FIFO 淘汰
- GET `/api/history` 返回最近 20 条（逆序）

## 依赖
```json
{
  "express": "^4.18.0",
  "dotenv": "^16.0.0",
  "undici": "^6.0.0"
}
```

## 启动方式
```bash
# 方式 1：直接运行
node proxy.js

# 方式 2：通过管理脚本
./manage.sh codex start

# 方式 3：通过管理后台
curl -X POST http://localhost:18792/api/start/codex
```

## 注意事项
- API Key 通过环境变量注入，不写入代码或配置文件
- 配置文件路径依赖用户系统，首次启动可能找不到配置文件
- 模型切换需要 Codex 重新读取配置文件（通常下次请求自动生效）
