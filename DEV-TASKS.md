# Proxy Rebuild — 开发任务拆解

> 编制日期: 2026-06-26
> 依据: 四角色代码评审报告（22 项问题）+ IMPROVEMENT-PLAN.md
> 目标: 将整改方案落地为可执行、可追踪、可并行的开发任务

---

## 一、总体里程碑

| 阶段 | 优先级 | 内容 | 预估工时 | 建议人数 | 时间窗口 |
|------|--------|------|---------|---------|---------|
| Phase 1 | P0/P1 | 安全修复（密钥/反向代理/鉴权/SQL 注入/流式传输） | 3.75 人天 | 2（后端 + 全栈） | 第 1 周 |
| Phase 2 | P1 | 核心功能（测试框架/崩溃恢复/健康检查/流式错误处理） | 4.75 人天 | 1-2 | 第 2 周 |
| Phase 3 | P2 | 体验优化（代码重构/竞态修复/lsof 路径/余额查询） | 2.1 人天 | 1 | 第 3 周上半 |
| Phase 4 | P3 | 完善（README/提示/版本管理/自启 PATH） | 2.8 人天 | 1 | 第 3 周下半 |
| **合计** | | | **13.4 人天** | 2-3 人 | **约 3 周** |

---

## 二、Phase 1 — 安全修复（P0/P1，第 1 周）

### T1.1 修复加密密钥硬编码问题（原 #1）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `cursor-multi-model-proxy/src/utils/crypto.ts`、`cursor-multi-model-proxy/src/server/routes/adminRoutes.ts`（L6）、`cursor-multi-model-proxy/src/server/handlers/chatHandler.ts`（L8）、`cursor-multi-model-proxy/.env.example` |
| **改动量级** | 中 |
| **具体内容** | 1) 修改 `crypto.ts`：新增 `loadEncryptionKey()` 函数，优先读 `ENCRYPTION_KEY` 环境变量，不存在则从 `.encryption-key` 文件读取，两者皆无时自动生成 32 字节随机密钥写入文件（权限 0600）；2) 删除 `adminRoutes.ts` L6 和 `chatHandler.ts` L8 的硬编码默认值，改为调用 `loadEncryptionKey()`；3) 在 `start.ts` 入口确保密钥在启动时可用；4) 更新 `.env.example`，添加 `ENCRYPTION_KEY` 字段及说明；5) 提供迁移脚本 `migrate-encryption-key.ts`，用旧密钥解密所有 Provider 后用新密钥重新加密。 |
| **验收标准** | - 源码中无 `'default-secret-key-change-in-production'` 字面量<br>- `node cursor-multi-model-proxy start` 在无 `ENCRYPTION_KEY` 时自动创建 `.encryption-key` 且权限为 `0600`<br>- `.env.example` 中包含 `ENCRYPTION_KEY=your-secure-key-here` 及注释<br>- 已有 SQLite 数据库中存储的加密 API Key 可通过迁移脚本解密并重加密<br>- 迁移后功能不受影响 |
| **前置依赖** | 无 |
| **负责人** | 后端开发 |

### T1.2 修复通用反向代理漏洞（原 #2）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `multi-proxy-manager/server.js`（L431-483，`forwardProxy` 函数及 `app.all('/api/:proxy/*')`） |
| **改动量级** | 中 |
| **具体内容** | 1) 定义 `FORWARD_ENDPOINTS` 白名单对象，列出每个代理允许的方法-路径组合；2) 创建 `routeWhitelist` 中间件函数，取代现有的 `app.all` 通配；3) 对 POST `/v1/chat/completions` 等需要透传请求体的端点，保留原始 body 解析；4) 对只读端点（`/v1/models`、`/health` 等）使用 GET-only；5) 未在白名单中的请求直接返回 404；6) 新增 `/admin-api/*` 端点（providers/models/routes 管理）在此阶段仍保持现有权限，与 T1.3 的鉴权联动。 |

```javascript
const FORWARD_ENDPOINTS = {
  codex: {
    GET: ['/v1/models', '/health', '/api/config', '/api/routing-mode', '/api/providers/status', '/api/balances', '/api/history', '/api/test-connection'],
    POST: ['/v1/chat/completions', '/api/set-routing-mode', '/api/switch-model', '/api/clear-history'],
  },
  hermes: { ... },
  cursor: { ... },
};
```

| **验收标准** | - 未在白名单中的路径返回 404<br>- 未在白名单中的 HTTP 方法返回 404<br>- 所有现有前端功能（模型列表、聊天转发、状态查询）正常工作<br>- 可在 `FORWARD_ENDPOINTS` 中快速调整白名单（不修改核心逻辑） |
| **前置依赖** | 无 |
| **负责人** | 后端开发 |

### T1.3 添加基础鉴权（原 #4）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `multi-proxy-manager/server.js`、`multi-proxy-manager/public/index.html`、`multi-proxy-manager/package.json` |
| **改动量级** | 大 |
| **具体内容** | 1) 在 `server.js` 中新增鉴权中间件 `requireAuth(req, res, next)`：读取 `req.headers['x-auth-token']` 或 cookie，用 `jsonwebtoken` 验证；2) 新增路由：`POST /api/auth/login`（接受 `{ password }`，验证 `MANAGER_PASSWORD` 环境变量，返回 JWT）；`POST /api/auth/logout`（服务端不存 token，客户端清除 sessionStorage 即可）；3) 新增 `GET /api/auth/status` 返回是否有密码设置，首次使用返回 `{ needsSetup: true }`；4) 端点分级：管理端点（start/stop/restart/autostart/auth）必须鉴权；只读端点（status/logs/health）可选鉴权（未登录也可查看，但无操作权限）；5) 前端新增登录页：复制 dashboard 的暗色主题风格，新建 `/login` 视图，包含密码输入 + 登录按钮；6) 首次使用引导：无 `MANAGER_PASSWORD` 时登录页显示"设置管理员密码"输入框；7) Token 有效期 8 小时，存 sessionStorage；8) 在 `server.js` 启动时打印 `[i] 管理后台已启用鉴权` 或 `[i] 管理后台未启用鉴权（MANAGER_PASSWORD 为空）`。 |
| **验收标准** | - 未登录访问 `/` 重定向到登录页<br>- 输入正确密码后可正常操作所有功能<br>- Token 8 小时后自动失效，需重新登录<br>- 首次使用可设置密码<br>- `MANAGER_PASSWORD=""` 时跳过鉴权（开发模式）<br>- 启停代理、管理自启等操作必须鉴权后才能执行 |
| **前置依赖** | 无（可与 T1.2 并行） |
| **负责人** | 全栈开发 |

### T1.4 修复 SQL 注入风险（原 #3）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `cursor-multi-model-proxy/src/server/routes/adminRoutes.ts`（L40-58） |
| **改动量级** | 小 |
| **具体内容** | 1) 在文件顶部定义白名单：`const ALLOWED_UPDATE_COLUMNS = new Set(['name', 'provider_id', 'api_key', 'base_url', 'enabled']);`；2) 在 PUT `/providers/:id` 路由中，遍历 `req.body` 的每个键，仅当键在白名单中时才加入 `updates` 数组；3) 对不在白名单中的键返回 `400 Bad Request` 及错误信息 `Unknown column: xxx`。 |
| **验收标准** | - 传入 `req.body = { '1=1; DROP TABLE providers;--': 'test' }` 返回 400 且不执行 SQL<br>- 正常的 name/provider_id/api_key/base_url/enabled 字段更新不受影响 |
| **前置依赖** | 无 |
| **负责人** | 后端开发 |

### T1.5 修复 codex-proxy 流式传输问题（原 #22）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `codex-proxy/proxy.js`（L339-376，`/v1/chat/completions` 路由） |
| **改动量级** | 小 |
| **具体内容** | 1) 在 `fetch` 请求中添加 `signal: AbortSignal.timeout(120000)` 超时控制（120 秒）；2) 流式模式改用 `ReadableStream` + `pipeTo` 替代 `response.body.pipe(res)`，包裹 `try/finally`；3) 在 `finally` 中确保管道正确关闭。 |
| **验收标准** | - 客户端断开连接后进程不退出、不报错<br>- 上游 120 秒无响应返回 504<br>- 非流式模式行为不变 |
| **前置依赖** | 无 |
| **负责人** | 后端开发 |

**Phase 1 并行关系图：**
```
T1.1 (密钥硬编码) ─┐
T1.2 (反向代理)    ├─ 可并行
T1.3 (鉴权)        ├─ 可并行
T1.4 (SQL 注入)    ┤
T1.5 (流式传输) ───┘
```
所有 5 个子任务相互无依赖，可由 2 人同时开工：
- 后端开发：T1.1、T1.4、T1.5
- 全栈开发：T1.2、T1.3

---

## 三、Phase 2 — 核心功能（第 2 周）

### T2.1 建立自动化测试框架（原 #5）

| 字段 | 内容 |
|------|------|
| **涉及文件** | 根目录 `package.json`、根目录 `jest.config.js`、`multi-proxy-manager/tests/`、`cursor-multi-model-proxy/tests/` |
| **改动量级** | 中 |
| **具体内容** | 1) 根目录新增 `package.json`（如不存在），添加 `"test": "jest --passWithNoTests"` 脚本；2) 安装 `jest`、`supertest`、`@types/jest`；3) 创建 `jest.config.js` 覆盖 `multi-proxy-manager/` 和 `cursor-multi-model-proxy/`；4) Manager API 测试：用 `supertest` mock Express app，测试 `/api/status`、`/api/start/:name`、`/api/stop/:name`、`/api/restart/:name`、`/api/logs`、`/api/autostart` 端点（约 20 个用例），mock 下游代理的端口检测结果；5) Provider 适配器测试：mock HTTP 上游，测试 OpenAI-Compatible / Anthropic / Google Gemini 的请求转换和响应翻译（约 15 个用例）；6) `SecretsManager` 测试：加密-解密往返一致性，密钥长度不足时 SHA-256 扩展（约 8 个用例）。 |
| **验收标准** | - `npm test` 在根目录可运行，全部通过<br>- 测试覆盖 manager API 所有端点<br>- Provider 转换逻辑有单元测试<br>- `jest --coverage` 显示 Phase 2 结束时整体覆盖率 >= 40% |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

### T2.2 实现进程崩溃自动恢复（原 #6）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `multi-proxy-manager/server.js`（L245-249，`proc.on('close')` 回调） |
| **改动量级** | 小 |
| **具体内容** | 1) 新增 `crashRecovery` 状态跟踪：为每个代理维护 `{ restartCount: number, lastRestartTime: number, consecutiveFailures: number }` 对象；2) 在 `proc.on('close')` 回调中：检查 exit code，若非 0 则触发指数退避重启（间隔 1s/2s/4s/8s/16s）；3) 连续重启 5 次后标记代理为 `"fault"` 状态，UI 中显示红色警告；4) 前端 `/api/status` 返回中新增 `fault` 字段，UI 相应展示；5) 用户点击"启动"按钮时，重置该代理的重启计数器并恢复到自动重启监控状态。 |

```javascript
// 新增状态
const proxyCrashRecovery = {}; // name -> { restartCount, lastRestartTime, consecutiveFailures }

// 在 proc.on('close') 中
proc.on('close', (code) => {
  const config = PROXY_CONFIGS[name];
  if (!config) return;

  // 记录退出码
  if (!proxyCrashRecovery[name]) {
    proxyCrashRecovery[name] = { restartCount: 0, lastRestartTime: 0, consecutiveFailures: 0 };
  }

  const recovery = proxyCrashRecovery[name];
  recovery.consecutiveFailures++;

  if (code !== 0 && recovery.restartCount < 5) {
    const delay = Math.min(1000 * Math.pow(2, recovery.restartCount), 16000);
    appendLog('warn', name, `Process crashed (code ${code}), restarting in ${delay}ms`);
    setTimeout(() => {
      // restart logic (reuse startProxy internals)
      recovery.restartCount++;
    }, delay);
  } else if (code !== 0) {
    appendLog('error', name, 'Max restart attempts reached, marking as fault');
    // Signal to UI via status endpoint
  } else {
    // Graceful exit, reset counter
    recovery.consecutiveFailures = 0;
    recovery.restartCount = 0;
  }

  delete proxyProcesses[name];
});
```

| **验收标准** | - 手动 `kill` 代理进程后，manager 在 1-16 秒内自动重启<br>- 反复崩溃 5 次后停止自动重启，status 中显示 `fault` 状态<br>- 用户手动点击"启动"可重置计数器并恢复自动重启<br>- 正常 stop 后再 start 不触发崩溃恢复逻辑 |
| **前置依赖** | 无（可与 T2.3、T2.4 并行） |
| **负责人** | 全栈开发 |

### T2.3 实现 HealthMonitor 真实健康检查（原 #7）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `cursor-multi-model-proxy/src/monitoring/healthMonitor.ts`、`cursor-multi-model-proxy/src/monitoring/circuitBreaker.ts` |
| **改动量级** | 中 |
| **具体内容** | 1) 重写 `updateStatuses` 方法：对每个 `ProviderConfig` 发起 HTTP 请求到 `${base_url}/models`（或自定义 `/health` 端点）；2) 解析上游响应：成功则状态 `healthy`，失败则 `unhealthy`，部分成功（如超时但返回 2xx）则 `degraded`；3) 将状态结果通知 `CircuitBreaker`（`recordSuccess()` / `recordFailure()`）；4) 修复闭包持有旧 `ProviderConfig[]` 引用：`HealthMonitor.start()` 接收 `configsRef: { current: ProviderConfig[] }` 而非数组本身；5) `getAllStatuses()` 返回中包含 `error` 字段说明失败原因。 |
| **验收标准** | - 关闭某个上游 provider 后，对应 provider 状态在 30 秒内变为 `unhealthy`<br>- `unhealthy` 的 provider 被 `CircuitBreaker` 标记，流量不再转发到新请求<br>- 上游恢复后状态自动回到 `healthy`（`HALF_OPEN` -> `CLOSED`）<br>- 健康检查接口超时不阻塞轮询定时器 |
| **前置依赖** | 无（可与 T2.2、T2.4 并行） |
| **负责人** | 后端开发 |

### T2.4 修复 Cursor 流式传输错误处理（原 #8）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `cursor-multi-model-proxy/src/server/handlers/chatHandler.ts`（L98-113） |
| **改动量级** | 小 |
| **具体内容** | 1) 在 `forwardToProvider` 的流式分支中，为 `while(true)` 循环外层包裹 `try-catch-finally`；2) 在 `try` 中捕获 `ERR_STREAM_WRITE_AFTER_END`、`EPIPE` 等常见流错误；3) 添加 `res.on('close', () => { cancelled = true; })` 监听，检测到客户端断开后立即 `break`；4) `finally` 中确保 `reader.releaseLock()` 一定被执行；5) 在非流式模式中，增加 `fetch` 异常的降级处理。 |

```typescript
let cancelled = false;
res.on('close', () => { cancelled = true; });

try {
  while (true) {
    const { done, value } = await reader.read();
    if (done || cancelled) break;
    if (!res.writableEnded) {
      res.write(decoder.decode(value, { stream: true }));
    }
  }
} catch (e: any) {
  if (cancelled) {
    // Client disconnected — log but don't error
    console.log('[ChatHandler] Client disconnected during streaming');
  } else {
    console.error(`[ChatHandler] Stream error: ${e.message}`);
  }
} finally {
  reader.releaseLock();
  if (!res.writableEnded) res.end();
}
```

| **验收标准** | - 客户端 Ctrl-C 或关闭标签页后进程不崩溃<br>- 上游断开时返回已缓冲的部分流数据并正常结束<br>- 非流式模式行为不受影响 |
| **前置依赖** | 无（可与 T2.2、T2.3 并行） |
| **负责人** | 后端开发 |

**Phase 2 并行关系图：**
```
T2.1 (测试框架)     ─┐
T2.2 (崩溃恢复)      ├─ 可并行
T2.3 (健康检查)      ├─ 可并行
T2.4 (流式错误处理) ─┘
```
4 个子任务完全无依赖，单人即可完成（1 周），2 人则更快。

---

## 四、Phase 3 — 体验优化（第 3 周上半）

### T3.1 重构 server.js 代码重复（原 #12）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `multi-proxy-manager/server.js`（L213-391） |
| **改动量级** | 小 |
| **具体内容** | 1) 提取 `async startProxy(name)` 函数：从 `/api/start/:name` 路由中提取核心启动逻辑（含 `proc.on('close')` 绑定）；2) 提取 `async stopProxy(name)` 函数：从 `/api/stop/:name` 路由中提取停止逻辑（SIGTERM -> 等待 -> SIGKILL）；3) 修改 `/api/restart/:name` 为直接 `await stopProxy(name); await startProxy(name)`；4) 将 `proc.on('close')` 中的 `delete proxyProcesses[name]` 统一收归到 `stopProxy` 中处理；5) 确保 `crashRecovery` 状态（T2.2 新增）也集成到此重构后的代码中。 |
| **验收标准** | - 代码行数减少约 40 行<br>- start/stop/restart 三个端点行为与重构前完全一致<br>- 已有 T2.1 测试全部通过 |
| **前置依赖** | T2.2（崩溃恢复需要先做完，否则重构时会丢失已有的 close 逻辑） |
| **负责人** | 全栈开发 |

### T3.2 修复竞态条件（原 #11）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `codex-proxy/proxy.js`（L116-138，`loadRoutingMode` / `updateRoutingMode`）、`hermes-proxy/proxy.py`（L47-73，同名函数） |
| **改动量级** | 小 |
| **具体内容** | 1) Codex：`updateRoutingMode` 改用 `fs.writeFileSync` 先写 `.tmp` 文件再用 `fs.rename()` 原子替换；2) Hermes：`update_routing_mode` 改用 Python 的 `tempfile` 模块写临时文件后 `os.replace()`（POSIX 语义原子性）；3) 两端 `loadRoutingMode` 不变（读操作无竞态，只有写入时有问题）。 |
| **验收标准** | - 100 次快速并发写 `routing-mode.json`（`node proxy.js` 和 `python3 proxy.py` 交替写入），最终文件内容与最后一次写入值一致<br>- Codex 和 Hermes 各自独立维护自己的 routing-mode 文件（不改设计，只修竞态） |
| **前置依赖** | 无（可与 T3.3、T3.4 并行） |
| **负责人** | 后端开发 |

### T3.3 修复 Cursor lsof 相对路径（原 #13）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `cursor-multi-model-proxy/src/index.ts`（L50、L68） |
| **改动量级** | 小 |
| **具体内容** | 1) L50: `execSync('lsof -ti :18794 ...')` 改为 `execSync('/usr/sbin/lsof -ti :18794 ...')`；2) L68（如有类似调用）同样替换；3) 对照 CLAUDE.md 已知限制保持一致。 |
| **验收标准** | - 通过 LaunchAgent 启动后 `cursor status` 命令正常工作 |
| **前置依赖** | 无（可与 T3.2、T3.4 并行） |
| **负责人** | 后端开发 |

### T3.4 统一 Codex 和 Hermes 的余额查询（原 #9）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `hermes-proxy/proxy.py`（L336-349，`get_balances` 函数） |
| **改动量级** | 小 |
| **具体内容** | 1) 修改 `get_balances`：遍历 `config_data['providers']`，对每个 provider 检测 `api` URL；2) 如 URL 以 `api.openai.com`、`api.anthropic.com`、`api.deepseek.com` 等知名 API 开头，尝试调用对应余额端点（OpenAI: `/dashboard/billing/credit_grants`，Anthropic: 无公开余额 API 则标记 `unknown`）；3) 无法识别的 provider URL 返回 `"不可查询"` 而非 `"未配置"`，语义更准确。 |
| **验收标准** | - 余额页面不再返回 `'未配置'` 占位文本<br>- 可识别的 provider 尝试查询余额<br>- 不可识别的返回 `"不可查询"` 友好提示 |
| **前置依赖** | 无（可与 T3.2、T3.3 并行） |
| **负责人** | 全栈开发 |

**Phase 3 并行关系图：**
```
T3.2 (竞态修复)     ─┐
T3.3 (lsof 路径)     ├─ 可并行
T3.4 (余额查询)     ─┘
T3.1 (代码重构)     —→ 依赖 T2.2 完成后可启动
```

---

## 五、Phase 4 — 完善（第 3 周下半）

### T4.1 添加根目录 README.md（原 #14）

| 字段 | 内容 |
|------|------|
| **涉及文件** | 新建 `README.md`（项目根目录） |
| **改动量级** | 小 |
| **具体内容** | 创建标准 README，包含：项目简介（一句话说明）、架构图（表格版）、一键启动命令、端口列表、各代理模块说明（带链接到子模块 README）、常见问题（FAQ）、贡献指南。 |
| **验收标准** | - 新用户按 README "快速开始" 一节可从零安装并启动所有服务 |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

### T4.2 优化 API Key 配置提示（原 #15）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `install.sh`（L90、L135，`.env` 创建后的提示信息） |
| **改动量级** | 小 |
| **具体内容** | 1) 将 `.env` 编辑提示从 `print_info`（蓝色 `[i]`）改为 `print_warn` + 加粗效果；2) 在安装完成界面前增加一行红色分隔框提醒用户编辑 `.env`。 |

```bash
print_bold ""
print_warn "⚠️  重要：编辑 .env 文件配置 API Key 后才能使用代理！"
print_bold "   codex-proxy/.env     -> nano codex-proxy/.env"
print_bold "   cursor-multi-model-proxy/.env -> nano cursor-multi-model-proxy/.env"
print_bold ""
```

| **验收标准** | - 安装完成后 API Key 配置提示醒目（黄色 + 加粗） |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

### T4.3 修复 TypeScript 编译错误静默丢弃（原 #16）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `manage.sh`（L106）、`install.sh`（L129）、`cursor-multi-model-proxy/src/index.ts` |
| **改动量级** | 小 |
| **具体内容** | 1) `manage.sh` L106: `(cd "$CURSOR_PROXY_DIR" && npm run build) 2>/dev/null` 改为 `(cd "$CURSOR_PROXY_DIR" && npm run build 2>&1) >> /tmp/cursor-build.log`；2) `install.sh` L129 同样处理；3) 编译失败时在控制台输出 `[!] Cursor Proxy 编译失败，详情: /tmp/cursor-build.log`；4) 去掉 `cursor-multi-model-proxy/src/index.ts` 中 `2>/dev/null` 重定向（如存在）。 |
| **验收标准** | - `npm run build` 出错时可在终端和日志中看到完整错误信息<br>- ARM Mac 上 `better-sqlite3` 编译失败时有明确提示 |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

### T4.4 添加启动失败排障指引（原 #17）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `manage.sh`（`start_codex`、`start_hermes`、`start_cursor` 函数）、`install.sh`（`start_*` 函数） |
| **改动量级** | 小 |
| **具体内容** | 1) `manage.sh` 中，所有 `print_error "xxx 启动失败"` 后追加一行 `print_info "查看日志: ./manage.sh logs <service>"`；2) `install.sh` 中，`print_err "xxx 启动失败"` 后同样追加日志查看提示；3) 前端 `index.html` 中启动失败的 Toast 也追加相同的文字提示。 |
| **验收标准** | - 代理启动失败时在终端和管理后台都能看到日志查看命令 |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

### T4.5 修复 `.env.example` 与实际不一致（原 #18）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `cursor-multi-model-proxy/.env.example`、`cursor-multi-model-proxy/src/server/start.ts` |
| **改动量级** | 小 |
| **具体内容** | 1) 审查 `start.ts` 和 `server/app.ts` 中实际读取的 `.env` 变量（`PORT`、`DB_PATH`、`ENCRYPTION_KEY` 等）；2) 更新 `.env.example` 只列出实际使用的变量，删除多余项（如当前只用了 `PORT` 和 `ENCRYPTION_KEY`，删除 `MANAGER_PORT` 和 `DB_PATH` 如果未使用）；3) 在 start.ts 中添加 dotenv 加载注释。 |
| **验收标准** | - `.env.example` 中的变量与代码实际使用情况一致 |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

### T4.6 修复开机自启 PATH 问题（原 #19）

| 字段 | 内容 |
|------|------|
| **涉及文件** | `install.sh`（L318，`setup_autostart` 中的 PATH 定义） |
| **改动量级** | 小 |
| **具体内容** | 1) 在 `setup_autostart` 函数中增加 nvm / pyenv 检测；2) 如果检测到 `$HOME/.nvm/nvm.sh` 存在，在 PATH 中加入 `$HOME/.nvm/versions/node/*/bin`；3) 如果检测到 `pyenv`，加入 `$HOME/.pyenv/shims`。 |
| **验收标准** | - 使用 nvm 的用户，LaunchAgent 启动后能找到正确版本的 Node.js<br>- 使用 pyenv 的用户，能找到 Python3 |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

### T4.7 版本管理与发布机制（原 #21）

| 字段 | 内容 |
|------|------|
| **涉及文件** | 根目录 `package.json`、各子模块 `package.json`、新建 `CHANGELOG.md` |
| **改动量级** | 小 |
| **具体内容** | 1) 根目录创建 `package.json`（如无）：`"name": "proxy-rebuild", "version": "1.0.0"`；2) 各子模块 `package.json` 也统一 `"version": "1.0.0"`；3) 基于 Conventional Commits 创建 `CHANGELOG.md` 模板（含生成脚本说明）；4) 管理器前端首页新增版本卡片（显示 `1.0.0` 和发布日期）；5) API `/api/version` 返回版本信息。 |
| **验收标准** | - 前端首页显示版本号<br>- `GET /api/version` 返回 `{ version: "1.0.0", date: "2026-06-26", proxies: { codex: "1.0.0", ... } }` |
| **前置依赖** | 无 |
| **负责人** | 全栈开发 |

**Phase 4 并行关系图：**
```
T4.1 (README)        ─┐
T4.2 (.env 提示)      ├─ 全部可并行
T4.3 (TS 编译错误)    ├─ 全部可并行
T4.4 (排障指引)       ├─ 全部可并行
T4.5 (.env.example)   ├─ 全部可并行
T4.6 (自启 PATH)      ├─ 全部可并行
T4.7 (版本管理)       ─┘
```

---

## 六、依赖总览与执行顺序

```
Phase 1 (安全修复)                     Phase 2 (核心功能)
├── T1.1 加密密钥 ──────────────┐
├── T1.2 反向代理白名单 ────────┤ 全部并行，共 3-4 人天
├── T1.3 基础鉴权 ──────────────┤
├── T1.4 SQL 注入 ──────────────┘
└── T1.5 codex 流式传输

Phase 3 (体验优化)                     Phase 4 (完善)
├── T3.1 代码重构 ──→ 依赖 T2.2 ──┐
├── T3.2 竞态修复 ────────────────┤ 全部并行(除T3.1)
├── T3.3 lsof 路径 ───────────────┤
├── T3.4 余额查询 ────────────────┘

├── T4.1-T4.7 全部并行，共 2-3 人天
```

### 完整任务列表（含依赖）

| 任务ID | 任务标题 | 模块 | 改动量级 | 前置依赖 | 可并行 |
|--------|---------|------|---------|---------|--------|
| T1.1 | 修复加密密钥硬编码 | cursor-multi-model-proxy | 中 | 无 | 是 |
| T1.2 | 修复反向代理白名单 | multi-proxy-manager | 中 | 无 | 是 |
| T1.3 | 添加基础鉴权 | multi-proxy-manager | 大 | 无 | 是 |
| T1.4 | 修复 SQL 注入 | cursor-multi-model-proxy | 小 | 无 | 是 |
| T1.5 | 修复 codex 流式传输 | codex-proxy | 小 | 无 | 是 |
| T2.1 | 建立自动化测试框架 | 全项目 | 中 | 无 | 是 |
| T2.2 | 进程崩溃自动恢复 | multi-proxy-manager | 小 | 无 | 是 |
| T2.3 | 实现 HealthMonitor | cursor-multi-model-proxy | 中 | 无 | 是 |
| T2.4 | 修复 Cursor 流式错误处理 | cursor-multi-model-proxy | 小 | 无 | 是 |
| T3.1 | 重构 server.js 代码重复 | multi-proxy-manager | 小 | T2.2 | 否 |
| T3.2 | 修复竞态条件 | codex/hermes | 小 | 无 | 是 |
| T3.3 | 修复 Cursor lsof 路径 | cursor-multi-model-proxy | 小 | 无 | 是 |
| T3.4 | 统一余额查询提示 | hermes-proxy | 小 | 无 | 是 |
| T4.1 | 添加根目录 README | 根目录 | 小 | 无 | 是 |
| T4.2 | 优化 .env 配置提示 | install.sh | 小 | 无 | 是 |
| T4.3 | 修复 TS 编译静默丢弃 | manage.sh | 小 | 无 | 是 |
| T4.4 | 添加启动失败排障指引 | manage.sh/install.sh | 小 | 无 | 是 |
| T4.5 | 修复 .env.example 不一致 | cursor-multi-model-proxy | 小 | 无 | 是 |
| T4.6 | 修复自启 PATH | install.sh | 小 | 无 | 是 |
| T4.7 | 版本管理 | 根目录+前端 | 小 | 无 | 是 |

---

## 七、验收节奏

| 阶段 | 验收内容 | 验收方式 | 负责人 |
|------|---------|---------|--------|
| Phase 1 完成后 | 安全扫描 | 尝试绕过鉴权、注入 SQL、访问非白名单端点、用默认密钥解密 | 测试工程师 |
| Phase 2 完成后 | 功能回归 | 每个代理页面的每个功能逐项验证；`npm test` 覆盖率 >= 40% | 全员 |
| Phase 3 完成后 | 压力测试 | 并发读写 routing-mode 文件 100 次、崩溃恢复计时、流式传输客户端断开 | 测试工程师 |
| Phase 4 完成后 | 用户验收 | 按 README 从零安装并验证所有服务、安装提示是否醒目 | 普通用户角色 |

---

## 八、风险提示

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 鉴权机制改变 API 调用方式 | 前端所有请求需加入 token 头 | 开发阶段 `MANAGER_PASSWORD=""` 跳过鉴权，上线前才强制开启 |
| 密钥迁移中断已有 Provider | 旧数据短暂不可用 | 提供 `migrate-encryption-key` 脚本，一键解密-重加密 |
| 反向代理白名单遗漏端点 | 某些功能突然 404 | 上线后先开"宽容模式"：未白名单端点 log warn 再放行，收集一周后严格放行 |
| HealthMonitor 健康检查增加延迟 | 轮询间隔内上游响应慢拖慢整体 | 健康检查超时设为 5 秒，不阻塞下一轮轮询（使用独立定时器） |
| 崩溃恢复与 install.sh 的 `kill -9` 冲突 | install.sh 的强制杀死可能导致 manager 认为 crash | install.sh 改为 SIGTERM->SIGKILL 两阶段（同 manage.sh），与 manager 行为一致 |

---

## 九、建议团队分工

| 角色 | 任务 |
|------|------|
| **后端开发** | T1.1、T1.4、T1.5、T2.3、T2.4、T3.2、T3.3 |
| **全栈开发** | T1.2、T1.3、T2.1、T2.2、T3.1、T3.4、T4.1-T4.7 |

Phase 1 两人并行最快（后端修 cursor/codex，全栈修 manager），Phase 2-4 可由全栈一人主导、后端配合。
