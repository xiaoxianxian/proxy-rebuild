# Proxy Rebuild 专项整改方案

> 制定日期: 2026-06-26
> 版本: v1.0
> 基于: 四角色代码评审报告（22 个问题项）

---

## 一、整改原则

1. **安全第一** — P0 问题涉及密钥泄露和 SQL 注入，必须在 1 个迭代内完成
2. **合并同类项** — 多个问题指向同一文件的，尽量在一次 PR 中统一修复，减少 PR 数量
3. **最小侵入** — 不改 API 协议、不破坏现有用户使用习惯的前提下修复
4. **可验证** — 每个 Phase 必须有明确的验收标准，不接受"我觉得修好了"

---

## 二、问题热力图

```
P0 (紧急安全)        P1 (核心功能)       P2 (体验优化)        P3 (完善)
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ #1 加密密钥硬编码 │ │ #4 管理后台无鉴权 │ │ #9  Hermes 余额  │ │ #14 缺 README   │
│ #2 反向代理漏洞   │ │ #5 无自动化测试   │ │ #10 前端/API不对等│ │ #15 API提示不醒目│
│ #3  SQL注入风险   │ │ #6 崩溃无自动恢复 │ │ #11 竞态条件     │ │ #16 TS编译静默  │
│                 │ │ │ #7  HealthMonitor │ │ #12 代码重复度高 │ │ #17 启动失败无指引│
│                 │ │ │ #8  流式传输无错误│ │ #13 Cursor lsof  │ │ #18 .env不一致  │
│                 │ │ │                 │ │                │ │ #19 自启PATH不全│
│                 │ │ │                 │ │                │ │ #20  Codex/Hermes│
│                 │ │ │                 │ │                │ │          同质化  │
│                 │ │ │                 │ │                │ │ #21 无版本管理   │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 三、分阶段整改计划

---

### Phase 1: P0 紧急安全（建议 3-4 人天，第 1 周）

**目标**：消除可被利用的安全漏洞，保护用户的 API 密钥和管理工作站安全

#### 1.1 修复加密密钥硬编码问题 (#1)

| 项目 | 内容 |
|------|------|
| **问题** | `cursor-multi-model-proxy` 中 `SECRET_KEY` 使用默认值 `'default-secret-key-change-in-production'`，明文存在于 `adminRoutes.ts` 和 `chatHandler.ts`。攻击者拿到代码即可解密数据库中存储的所有 API Key |
| **涉及文件** | `cursor-multi-model-proxy/src/server/routes/adminRoutes.ts`(L6)、`cursor-multi-model-proxy/src/server/handlers/chatHandler.ts`(L8)、`cursor-multi-model-proxy/src/utils/crypto.ts` |
| **解决方案** | 1) 启动时检查 `ENCRYPTION_KEY` 环境变量是否存在；2) 若不存在，自动生成一个 32 字节随机密钥写入 `.encryption-key` 文件（权限 0600），并在 `.env` 示例中引导用户配置；3) 两个模块共用同一个密钥源（环境变量优先，fallback 到文件）；4) 提供密钥迁移流程（旧密钥 → 新密钥的解密重写） |
| **验收标准** | - 源码中不出现硬编码默认密钥<br>- 启动时若无密钥自动生成并安全存储<br>- 密钥文件权限 0600<br>- `.env.example` 中有 `ENCRYPTION_KEY` 说明<br>- 已有 Provider 数据可通过迁移流程访问 |
| **工作量** | 0.5 人天 |

#### 1.2 修复通用反向代理漏洞 (#2)

| 项目 | 内容 |
|------|------|
| **问题** | `server.js` 中 `app.all('/api/:proxy/*')` 接受任意 HTTP 方法和路径，无条件转发。可被用于：删除 Provider、消耗用户 Token、探测上游内部端点 |
| **涉及文件** | `multi-proxy-manager/server.js`(L432-483) |
| **解决方案** | 1) 创建白名单路由模块，列出每个代理允许的端点和 HTTP 方法；2) 用具体的 `app.get`/`app.post` 替换 `app.all`；3) 管理端点 (`/admin-api/*`) 增加额外鉴权（与 1.3 联动） |
| **具体实现** | ```javascript const FORWARD_ENDPOINTS = { codex: { GET: ['/v1/models', '/health', ...], POST: ['/v1/chat/completions', ...] }, hermes: { ... }, cursor: { ... } }; ``` |
| **验收标准** | - 未列入白名单的端点返回 404<br>- `/admin-api/*` 在 manager 层受鉴权保护<br>- 所有现有功能正常工作 |
| **工作量** | 1 人天 |

#### 1.3 添加基础鉴权 (#4 — P1 问题提前至 P0 合并解决)

| 项目 | 内容 |
|------|------|
| **问题** | 管理后台无任何认证，任意访问者可操控代理和修改配置 |
| **涉及文件** | `multi-proxy-manager/server.js`、`multi-proxy-manager/public/index.html` |
| **解决方案** | 单密码 + JWT 方案：`MANAGER_PASSWORD` 环境变量，登录时验证签发短期 JWT；前端新增登录页覆盖 dashboard；端点分级管理（管理端点必须鉴权，只读端点可选）；Token 存 sessionStorage（关闭标签即失效） |
| **验收标准** | - 未登录重定向到登录页<br>- 首次使用引导设置密码<br>- 启停/日志/自启 API 必须鉴权<br>- 密码不存储在代码或 Git 中<br>- Token 8 小时过期自动登出 |
| **工作量** | 1.5 人天 |

#### 1.4 修复 SQL 注入风险 (#3)

| 项目 | 内容 |
|------|------|
| **问题** | `adminRoutes.ts` L55: `UPDATE providers SET ${updates.join(', ')}` 列名字符串拼接 |
| **涉及文件** | `cursor-multi-model-proxy/src/server/routes/adminRoutes.ts`(L40-58) |
| **解决方案** | 1) 定义 `ALLOWED_COLUMNS = new Set(['name','provider_id','api_key','base_url','enabled','updated_at'])`，拼接前逐列校验；2) 回归验证所有 INSERT 语句都是参数化的 |
| **验收标准** | - 恶意列名返回 400 而非执行 SQL<br>- 所有 CRUD 功能正常 |
| **工作量** | 0.25 人天 |

#### 1.5 修复 codex-proxy 流式传输问题 (#22)

| 项目 | 内容 |
|------|------|
| **问题** | `codex-proxy/proxy.js`: fetch 无超时、`response.body.pipe(res)` 无错误保护 |
| **涉及文件** | `codex-proxy/proxy.js`(L339-376) |
| **解决方案** | 1) 加上 `AbortSignal.timeout(120000)`；2) 流式模式改用 `ReadableStream` + `pipeTo` + `try/finally` |
| **验收标准** | - 客户端断开后进程不退<br>- 上游超时返回 504 |
| **工作量** | 0.5 人天 |

**Phase 1 合计：3.75 人天**。建议：后端开发负责 1.1/1.4/1.5，全栈开发负责 1.2/1.3。两分支独立开发后合并。

---

### Phase 2: P1 核心功能（建议 4-5 人天，第 2 周）

**目标**：补全核心功能缺失，消除功能可用性风险

#### 2.1 建立自动化测试框架 (#5)

| 项目 | 内容 |
|------|------|
| **问题** | 全项目零测试，回归风险极高 |
| **解决方案** | 1) 初始化 Jest 到根目录（monorepo 结构）；2) Manager API 测试（Supertest，mock 下游代理）；3) Cursor Provider 适配器测试（mock 上游 HTTP）；4) CI 前置：PR 必须通过测试 |
| **具体范围** | - Manager API: `status`/`start`/`stop`/`restart`/`logs`/`autostart` (~20 用例)<br>- Provider 适配器: OpenAI-Compatible/Anthropic/Google Gemini 转换 (~15 用例)<br>- 核心工具: `SecretsManager` 加解密 (~8 用例) |
| **验收标准** | - `npm test` 在根目录可运行<br>- 测试覆盖 manager API 所有端点<br>- Provider 转换逻辑有单元测试<br>- 测试覆盖率 Phase 2 达到 40% |
| **工作量** | 1.5 人天 |

#### 2.2 实现进程崩溃自动恢复 (#6)

| 项目 | 内容 |
|------|------|
| **问题** | `server.js` 中 `proc.on('close')` 只删除进程引用不打日志也不重启。进程崩溃后用户必须手动重新启动 |
| **涉及文件** | `multi-proxy-manager/server.js`(L245-249) |
| **解决方案** | 1) 在 `proc.on('close')` 回调中加入指数退避重启逻辑（间隔 1s/2s/4s/8s/16s，最大 16 秒）；2) 重启次数上限 5 次（避免无限重启循环）；3) 重启超过上限后标记为"故障"状态并在 UI 中显示红色警告；4) 用户手动点击"启动"重置计数器 |
| **验收标准** | - 手动 `kill` 代理进程后，manager 自动在 1-16 秒内重启<br>- 反复崩溃 5 次后停止自动重启<br>- 启动按钮可重置计数器并恢复自动重启 |
| **工作量** | 0.75 人天 |

#### 2.3 实现 HealthMonitor 真实健康检查 (#7)

| 项目 | 内容 |
|------|------|
| **问题** | `healthMonitor.ts` 中 `updateStatuses` 硬编码返回 `'healthy'`，永远不会调用真正的 `healthCheck`。熔断器和限流器形同虚设 |
| **涉及文件** | `cursor-multi-model-proxy/src/monitoring/healthMonitor.ts`、`cursor-multi-model-proxy/src/monitoring/circuitBreaker.ts` |
| **解决方案** | 1) `updateStatuses` 中为每个 provider 发送 HTTP 请求到其 `base_url/models` 或 `/health`；2) 解析上游返回的 `status` 字段映射到 `healthy/unhealthy/degraded`；3) 失败时将对应 provider 的状态设为 `unhealthy`，并通知 CircuitBreaker 记录失败；4) 将 `ProviderConfig[]` 改为引用传递，避免闭包持有旧数组 |
| **验收标准** | - 关闭某个上游 provider 后，对应 provider 状态变为 unhealthy<br>- unhealthy 的 provider 被 CircuitBreaker 标记，流量不再转发<br>- 恢复后状态自动回到 healthy |
| **工作量** | 1 人天 |

#### 2.4 修复 Cursor 流式传输错误处理 (#8)

| 项目 | 内容 |
|------|------|
| **问题** | `chatHandler.ts` 中 `res.write` 无 try-catch，上游断开或客户端提前关闭会导致未处理异常 |
| **涉及文件** | `cursor-multi-model-proxy/src/server/handlers/chatHandler.ts`(L98-113) |
| **解决方案** | 1) 在 `while(true)` 循环外包裹 try-catch，捕获 `ERR_STREAM_WRITE_AFTER_END` 等异常；2) 监听 `res.on('close', ...)` 提前退出循环；3) `finally` 中确保 `reader.releaseLock()` 被调用 |
| **验收标准** | - 客户端断开后进程不崩溃<br>- 上游断开时返回部分流数据并正常结束<br>- 非流式模式不受影响 |
| **工作量** | 0.5 人天 |

#### 2.5 补齐测试基础设施 (#9 与 2.1 合并)

Hermes 余额查询半成品（#9）工作量不大但依赖于测试框架建立，在 Phase 2 的 2.1 中一并完成。

**Phase 2 合计：4.75 人天**。建议：1 名全栈开发可独立完成，测试框架 + 健康监控 + 流式错误处理可并行。

---

### Phase 3: P2 体验优化（建议 3-4 人天，第 3 周）

**目标**：提升用户体验和代码质量，消除重复代码

#### 3.1 补齐 Cursor 前端 Provider 管理 UI (#10)

| 项目 | 内容 |
|------|------|
| **问题** | Cursor 后端有完整的 Provider CRUD API (`/admin-api/providers` GET/POST/PUT/DELETE)，前端已有 Add/Edit/Delete 对话框代码（`index.html` L1126-1327），但只在 Cursor 代理时渲染。Codex 和 Hermes 的供应商页面仅展示只读状态。前端与后端 API 能力不对等 |
| **涉及文件** | `multi-proxy-manager/public/index.html`(L1076-1327) |
| **解决方案** | 实际上前端已经实现了 Cursor 的 CRUD 对话框，问题在于评审报告的表述偏误 —— 前端确实支持 CRUD（因为检测到了 `cursorProviders !== null`）。真正的问题是：**Codex/Hermes 的供应商页面没有 CRUD 入口**。修复方向：1) 如果决定只给 Cursor 做 CRUD（合理，因为 Codex/Hermes 不持久化配置），则无需改动；2) 如果打算统一供应商管理模式，则给 Codex/Hermes 也加 CRUD 能力，但这涉及架构层面重构 |
| **验收标准** | - Cursor 供应商管理 UI 可用且与后端同步<br>- Codex/Hermes 供应商页面显示有意义的信息（不误导用户） |
| **工作量** | 0.5 人天（如只做 UI 微调） |

#### 3.2 重构 server.js 代码重复 (#12)

| 项目 | 内容 |
|------|------|
| **问题** | start/stop/restart 三个路由包含约 70% 重复代码。restart 包含 ~70 行本可复用的逻辑 |
| **涉及文件** | `multi-proxy-manager/server.js`(L213-391) |
| **解决方案** | 提取公共函数：
```javascript
async function startProxy(name) { ... }   // 从 /start/:name 提取
async function stopProxy(name) { ... }    // 从 /stop/:name 提取
async function restartProxy(name) { ... } // 调用 stopProxy + startProxy
```
将路由处理器改为直接调用这三个函数。删除 `proc.on('close')` 中重复的 `delete proxyProcesses[name]`（统一在 stopProxy 中清理）。 |
| **验收标准** | - 代码行数减少 ~40 行<br>- 三个 API 端点行为不变<br>- 已有测试全部通过 |
| **工作量** | 0.5 人天 |

#### 3.3 修复竞态条件 (#11)

| 项目 | 内容 |
|------|------|
| **问题** | Codex 和 Hermes 分别读写不同的 routing-mode.json 文件（Codex 在 `~/.codex-proxy/`，Hermes 在 `~/.hermes-proxy/`），且 `readFileSync` + `writeFileSync` 非原子操作 |
| **涉及文件** | `codex-proxy/proxy.js`(L19,L116-138)、`hermes-proxy/proxy.py`(L37,L47-73) |
| **解决方案** | 1) 写入时先用临时文件 + `fs.rename` 实现原子写入（POSIX 语义保证原子性）；2) 或改用锁文件机制（`flock`）保护并发读写；3) 两个代理可以各自保持独立的 routing-mode 文件（设计上就是独立的），不需要合并 |
| **验收标准** | - 高频并发读写 `routing-mode.json` 不丢失更新（stress test: 100 次快速切换取最后一个值正确） |
| **工作量** | 0.5 人天 |

#### 3.4 修复 Cursor lsof 相对路径 (#13)

| 项目 | 内容 |
|------|------|
| **问题** | `cursor-multi-model-proxy/src/index.ts` L50 中 `lsof` 使用相对路径，在 LaunchAgent 等受限 PATH 环境中找不到 |
| **涉及文件** | `cursor-multi-model-proxy/src/index.ts`(L50, L68) |
| **解决方案** | 替换为绝对路径 `/usr/sbin/lsof`，与 CLAUDE.md 中的已知限制保持一致 |
| **验收标准** | - 通过 LaunchAgent 启动后 `cursor status` 命令正常工作 |
| **工作量** | 0.1 人天 |

#### 3.5 统一 Codex 和 Hermes 的余额查询 (#9)

| 项目 | 内容 |
|------|------|
| **问题** | Hermes 余额查询返回硬编码 `'未配置'`，Codex 会实际调用上游 API |
| **涉及文件** | `hermes-proxy/proxy.py`(L336-349) |
| **解决方案** | Hermes 的余额查询依赖于 `config.yaml` 中 provider 的 `api` URL。由于 Hermes 是配置文件驱动的代理（不像 Codex 有明确的上游 API Key），余额查询策略应为：1) 如果 provider 配置中有 `api` URL 且以知名 API 开头（如 `api.openai.com`、`api.anthropic.com`），则尝试调用对应的余额端点；2) 否则返回 `"不可查询"` 而非 `"未配置"`，语义更准确 |
| **验收标准** | - 余额页面不再返回 `'未配置'` 占位文本<br>- 可识别的 provider 尝试查询余额<br>- 不可识别的返回友好提示 |
| **工作量** | 0.5 人天 |

#### 3.6 补齐 codex-proxy 错误处理（同 Phase 1 #22 剩余部分）

已在 Phase 1 的 1.5 中覆盖。

**Phase 3 合计：2.1 人天**。建议：可安排在 Phase 2 完成后立即并行执行 3.4 + 3.5，其他重构按顺序进行。

---

### Phase 4: P3 完善（建议 2-3 人天，第 4 周）

**目标**：提升项目成熟度、可维护性和用户引导体验

#### 4.1 添加根目录 README.md (#14)

| 项目 | 内容 |
|------|------|
| **问题** | 用户第一眼看不到项目说明和快速开始指引 |
| **解决方案** | 添加标准的 README.md，包含：项目简介、架构图（表格形式）、一键启动命令、端口列表、各代理说明链接、常见问题 |
| **工作量** | 0.25 人天 |

#### 4.2 优化 API Key 配置提示 (#15)

| 项目 | 内容 |
|------|------|
| **问题** | `install.sh` 用 `print_info` (蓝色 `[i]`) 打印编辑 `.env` 提示，在满屏绿色 `[v]` 中容易被忽略 |
| **解决方案** | 1) 将 `.env` 编辑提示改用 `print_bold` + 红色边框效果；2) 在安装脚本末尾添加"下一步"确认步骤，强制用户看到提示后才能进入完成界面；3) 或在 `.env.example` 文件中添加明显的注释引导 |
| **工作量** | 0.25 人天 |

#### 4.3 修复 TypeScript 编译错误静默丢弃 (#16)

| 项目 | 内容 |
|------|------|
| **问题** | `manage.sh` 和 `install.sh` 中 Cursor 编译时 `2>/dev/null` 丢弃了错误输出 |
| **解决方案** | 去掉 `2>/dev/null`，改为 `2>&1` 并将 stderr 重定向到日志文件。如果编译失败，打印明确的错误信息和建议 |
| **工作量** | 0.1 人天 |

#### 4.4 添加启动失败排障指引 (#17)

| 项目 | 内容 |
|------|------|
| **问题** | "启动失败"后只输出一行红色文字，用户不知道如何排查 |
| **解决方案** | 在 `manage.sh` 和 `start_*` 函数中，启动失败时追加提示：`print_info "查看日志: ./manage.sh logs <service>"`。同时在前端管理器的启动失败 Toast 中也显示相同的日志查看命令 |
| **工作量** | 0.25 人天 |

#### 4.5 修复 `.env.example` 与实际不一致 (#18)

| 项目 | 内容 |
|------|------|
| **问题** | Cursor 的 `.env.example` 定义了四个变量但 `start.ts` 只用了一个 `PORT` |
| **解决方案** | 审查 `cursor-multi-model-proxy` 实际使用的 `.env` 变量，删除多余的示例变量。同时在 `start.ts` 中添加 `dotenv` 加载和变量读取的注释说明 |
| **工作量** | 0.25 人天 |

#### 4.6 修复开机自启 PATH 问题 (#19)

| 项目 | 内容 |
|------|------|
| **问题** | LaunchAgent plist 中 PATH 只有 `/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin`，如果用户用 nvm/pyenv 则找不到 Node.js/Python |
| **解决方案** | 1) 在 `install.sh` 的检测环境中自动检测 nvm (`$HOME/.nvm/nvm.sh`) 和 pyenv 路径；2) 在 PATH 中加入这些路径；3) 同时为各代理的启动脚本添加 SHEBANG 行的绝对路径声明 |
| **工作量** | 0.5 人天 |

#### 4.7 版本管理与更新检测 (#21)

| 项目 | 内容 |
|------|------|
| **问题** | 没有统一版本号、CHANGELOG、自动更新检测 |
| **解决方案** | 1) 在根目录 `package.json` 中定义 `"version": "1.0.0"`，各子模块也有自己的 `package.json`；2) 添加 `CHANGELOG.md`（基于 Conventional Commits 自动生成）；3) 管理器首页添加版本卡片，显示当前版本号和更新日期；4) 暂不实现自动更新（需要 GitHub Release 配合，超出本项目范围），但预留 API 接口 |
| **工作量** | 0.5 人天 |

#### 4.8 评估 Codex/Hermes 同质化问题 (#20)

| 项目 | 内容 |
|------|------|
| **问题** | Codex 和 Hermes 产品定位高度同质化，维护成本双倍 |
| **分析** | 这两个代理的服务对象不同：Codex 面向 Codex CLI 用户（修改 `config.toml`），Hermes 面向 Hermes Agent 用户（修改 `config.yaml`）。它们的差异化在于配置文件格式和目标应用，而非代理本身的架构。合并为"通用代理内核"的提议在当前阶段收益不高，因为：(a) 配置文件解析逻辑完全不同（TOML vs YAML）；(b) 上游模型来源不同；(c) 用户群体不重叠。建议**暂不合并**，但在 Phase 4 中添加一个"代码相似度扫描"任务，量化维护成本 |
| **工作量** | 0.25 人天（仅调研，不动代码） |

**Phase 4 合计：2.8 人天**。大部分是文档和脚本类改动，单人可快速完成。

---

## 四、工作量汇总

| Phase | 优先级 | 内容概述 | 预估工作量 | 建议人数 | 建议周期 |
|-------|--------|---------|-----------|---------|---------|
| Phase 1 | P0 | 安全修复（密钥/代理漏洞/鉴权/SQL注入/流式） | 3.75 人天 | 2 | 1 周 |
| Phase 2 | P1 | 核心功能（测试框架/自动恢复/健康检查/错误处理） | 4.75 人天 | 1-2 | 1 周 |
| Phase 3 | P2 | 体验优化（代码重构/竞态/lsof路径/余额查询） | 2.1 人天 | 1 | 0.5 周 |
| Phase 4 | P3 | 完善（README/提示/版本管理/PATH） | 2.8 人天 | 1 | 0.5 周 |
| **合计** | | | **13.4 人天** | | **约 3 周** |

---

## 五、风险与注意事项

### 5.1 兼容性风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 鉴权机制 (#1.3) 改变 API 调用方式 | 现有前端 JavaScript 需全部加入 token 头 | 开发阶段保持 `MANAGER_PASSWORD=""` 跳过鉴权，上线前才强制开启 |
| 密钥迁移 (#1.1) 中断已有 Provider | 旧数据短暂不可用 | 提供 `migrate-encryption-key` 脚本，一键解密-重加密 |
| 反向代理白名单 (#1.2) 遗漏端点 | 某些功能突然 404 | 上线后开启"宽容模式"：未在白名单的端点先 log warn 再放行，收集一周后再严格放行 |

### 5.2 优先级调整建议

1. **Codex/Hermes 同质化 (#20) 不建议现在合并**。差异化在于配置文件解析和目标应用，合并的收益远低于重构成本
2. **前端重构 (1642 行单文件 SPA)** 是长期的债，但不影响功能可用性。建议在 Phase 4 之后作为一个独立的大型技术债务偿还计划推进
3. **CI/CD 集成** 超出本项目范围，但可以预留 `npm test` 作为 PR 门禁

### 5.3 验收节奏

| 阶段 | 验收内容 | 负责人 |
|------|---------|--------|
| Phase 1 完成后 | 安全扫描：尝试绕过鉴权、注入 SQL、访问非白名单端点 | 测试工程师 |
| Phase 2 完成后 | 功能回归：每个代理页面的每个功能逐项验证 | 全员 |
| Phase 3 完成后 | 压力测试：并发读写 routing-mode 文件、崩溃恢复 | 测试工程师 |
| Phase 4 完成后 | 用户验收：按 README 从零安装并验证 | 普通用户角色 |

---

## 六、后续长期规划（Phase 4 之后）

| 方向 | 优先级 | 说明 |
|------|--------|------|
| 前端组件化 | 高 | 将 1642 行 `index.html` 拆分为 Vue/React 组件，引入 TypeScript、ESLint、Vite 构建 |
| 日志增强 | 中 | 添加日志聚合（ELK/Loki），支持按日期归档，避免 `/tmp` 日志丢失 |
| 多语言支持 | 低 | 前端 i18n（zh/en），便于国际化 |
| Docker 化 | 中 | 封装 Docker Compose，支持一键部署到远程服务器 |
| 远程访问 | 高 | 当前管理后台仅限 localhost，远程访问需 TLS + 鉴权（已在 Phase 1 覆盖鉴权） |
