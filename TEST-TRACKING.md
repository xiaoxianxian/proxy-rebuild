# Proxy Rebuild - 测试策略与进度追踪

> 编制日期: 2026-06-26
> 基于: 四角色评审报告 + IMPROVEMENT-PLAN.md + DEV-TASKS.md
> 角色: 测试工程师视角

---

## 一、项目现状基线

在评估整改方案之前，先明确项目当前质量基线：

| 维度 | 当前状态 | 风险等级 |
|------|---------|---------|
| 自动化测试 | **零存在** — 无任何 test 文件、测试框架、覆盖率配置 | P0 |
| CI/CD | **零存在** — 无 GitHub Actions、无 Makefile、无 lint 配置 | P1 |
| 依赖锁定 | **零 lock 文件** — 4 个模块均无 package-lock.json | P2 |
| TypeScript 类型检查 | 仅 cursor 模块有 tsconfig，但排除 *.test.ts，无 CI 强制 | P2 |
| 手动测试 | 完全依赖人工逐功能验证，无测试用例文档 | P1 |

这意味着 Phase 2.1（建立自动化测试框架）不仅是任务之一，而且是整个整改方案的**前提条件**——它产出的测试套件会被后续所有 Phase 复用回归。

---

## 二、测试策略建议（按 Phase 展开）

### Phase 1 — 安全修复

#### T1.1 修复加密密钥硬编码

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 单元测试 | 覆盖 `crypto.ts` 的 `encrypt`/`decrypt` 往返一致性 | 输入任意字符串，加密后再解密等于原始值 |
| 单元测试 | 密钥长度 < 32 字节时的 SHA-256 扩展逻辑 | 用 10 字节密钥加密，确认可用同密钥解密 |
| 单元测试 | 密钥长度 >= 32 字节时的截断逻辑 | 输入 64 字节密钥，确认截取前 32 字节 |
| 手动验证 | 源码扫描 | `grep -rn "default-secret-key-change-in-production"` 返回空 |
| 手动验证 | 文件权限 | 启动后 `.encryption-key` 权限为 `0600`（`stat -c '%a' .encryption-key`） |
| E2E | 旧数据迁移 | 用硬编码密钥创建的 SQLite 数据，通过迁移脚本重加密后，原有 Provider 仍可正常通信 |

#### T1.2 修复通用反向代理漏洞

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 单元测试 | 白名单匹配逻辑 | 构造 `FORWARD_ENDPOINTS` 输入，验证合法路径返回 true、非法路径返回 false |
| 集成测试 | 白名单放行 | 用 `supertest` 调用 `/api/codex/v1/models` (GET)，预期 200 |
| 集成测试 | 白名单拦截 | 用 `supertest` 调用 `/api/codex/admin/delete-provider` (DELETE)，预期 404 |
| 集成测试 | 方法拦截 | 调用 POST `/api/codex/v1/models`，预期 404 |
| 手动验证 | 全量功能回归 | 逐个点击前端所有按钮，确认无新增 404 |
| 安全测试 | 探测攻击向量 | 尝试 `/api/codex/.env`、`/api/codex/v1/internal/debug`，均应返回 404 |

#### T1.3 添加基础鉴权

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 单元测试 | JWT 签发逻辑 | 用 `MANAGER_PASSWORD` 正确值登录，验证返回 JWT token |
| 单元测试 | JWT 过期逻辑 | 创建过期 token，验证 `/api/status` 返回 401 |
| 集成测试 | 未登录管理端点 | 不带 token 调用 POST `/api/start/codex`，预期 401 |
| 集成测试 | 未登录只读端点 | 不带 token 调用 GET `/api/status`，预期 200（可选鉴权） |
| 集成测试 | 正确鉴权 | 带有效 token 调用启停端点，预期 200 |
| 手动验证 | 首次使用引导 | `MANAGER_PASSWORD` 未设置时，前端显示设置密码界面 |
| 手动验证 | Token 过期 | 登录后等待 8 小时（或 mock 时间），验证需重新登录 |
| 手动验证 | 空密码跳过 | `MANAGER_PASSWORD=""` 时，跳过鉴权所有功能正常 |
| 安全测试 | Token 注入 | 使用伪造/篡改 JWT（签名错误），预期 401 |

#### T1.4 修复 SQL 注入风险

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 单元测试 | 白名单列校验 | 传入 `req.body = { "normal_field": "val" }`，预期更新成功 |
| 安全测试 | 经典 SQL 注入 | 传入 `req.body = { "1=1; DROP TABLE providers;--": "test" }`，预期 400 且不执行 SQL |
| 安全测试 | UNION 注入 | 传入 `req.body = { "name": "'; UNION SELECT * FROM providers;--" }`，验证仅 `name` 字段被更新 |
| 安全测试 | 列名混淆 | 传入 `{"created_at": "123"}`, `{"updated_by": "admin"}`，均返回 400 |

#### T1.5 修复 codex-proxy 流式传输

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 集成测试 | 客户端断开 | 发起流式请求后，客户端主动取消连接，验证进程不退出不抛未处理异常 |
| 集成测试 | 上游超时 | mock 上游延迟 121 秒，验证返回 504 |
| 集成测试 | 正常流式 | 正常 SSE 请求，验证 chunk 数据正确传输 |
| 集成测试 | 非流式模式 | 确认 `stream=false` 时行为不受影响，正常返回完整 JSON |

---

### Phase 2 — 核心功能

#### T2.1 建立自动化测试框架

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 构建验证 | `npm test` 在根目录运行 | 全部通过，无错误 |
| 构建验证 | `jest --coverage` 输出 | 显示覆盖率报告，Phase 2 结束时整体覆盖率 >= 40% |
| 覆盖率断言 | CI 门禁（预留） | 覆盖率不低于 40% 时构建通过 |

测试用例规划：
- Manager API ~20 个用例：status/start/stop/restart/logs/autostart 端点
- Provider 适配器 ~15 个用例：OpenAI/Anthropic/Gemini 请求转换、响应翻译
- SecretsManager ~8 个用例：加解密往返、密钥长度边界

#### T2.2 实现进程崩溃自动恢复

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 集成测试 | 手动 kill | `kill -9` 代理进程后，验证 manager 在 1-16 秒内自动重启 |
| 集成测试 | 指数退避计时 | 第 1 次重启 <= 1s，第 5 次重启 <= 16s |
| 集成测试 | 连续崩溃上限 | 让代理连续崩溃 5 次，验证第 5 次后停止自动重启，status 中显示 `fault` |
| 集成测试 | 手动恢复 | 在 `fault` 状态下点击"启动"，验证计数器重置并恢复自动重启监控 |
| 集成测试 | 正常停止 | 通过 `/api/stop` 正常停止后再启动，不触发崩溃恢复逻辑 |
| 集成测试 | 退出码 0 | 进程正常退出（exit code 0），重启计数器应重置 |

#### T2.3 实现 HealthMonitor 真实健康检查

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 集成测试 | 正常上游 | mock 上游返回 200，验证状态为 `healthy` |
| 集成测试 | 关闭上游 | 关闭某个 provider 的上游服务，验证 30 秒内状态变为 `unhealthy` |
| 集成测试 | CircuitBreaker 联动 | `unhealthy` provider 被 CircuitBreaker 标记，新请求不转发到该 provider |
| 集成测试 | 自动恢复 | 上游重启后，验证状态回到 `healthy`（经过 HALF_OPEN -> CLOSED） |
| 集成测试 | 超时要测 | mock 上游响应缓慢（> 5 秒），验证不阻塞下一轮轮询 |
| 集成测试 | 部分失败 | mock 上游返回 2xx 但有 error 字段，验证状态为 `degraded` |

#### T2.4 修复 Cursor 流式传输错误处理

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 集成测试 | 客户端 Ctrl-C | 流式请求进行中按 Ctrl-C，验证进程不崩溃 |
| 集成测试 | 关闭浏览器标签 | 流式请求进行中关闭标签，验证 `cancelled=true` 正确退出循环 |
| 集成测试 | 上游突然断开 | mock 上游在流传输中途关闭连接，验证返回已缓冲的部分数据并正常 end |
| 集成测试 | 非流式模式 | 确认非流式模式下行为不受影响 |

---

### Phase 3 — 体验优化

#### T3.1 重构 server.js 代码重复

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 回归测试 | 已有 T2.1 全部测试通过 | 重构前后行为一致 |
| 手动对比 | start/stop/restart API | 分别调用三个端点，验证响应与重构前一致 |
| 回归测试 | crash recovery | 重启代理后 kill 进程，验证 T2.2 的崩溃恢复仍正常工作 |
| 代码度量 | LOC 减少 | 验证代码行数减少约 40 行 |

#### T3.2 修复竞态条件

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 压力测试 | Codex 并发写 | 100 次 `curl -X POST ... -d '{"mode":"chain"}'` 快速并发写入，验证最终文件内容是最后一次写入值 |
| 压力测试 | Hermes 并发写 | 同上，100 次并发写 routing-mode.json，验证最终一致性 |
| 压力测试 | 交叉操作 | 读写交替 100 次，验证读到的值永远是某次完整写入的结果，不会是截断文件 |
| 回归测试 | 正常路由切换 | 前端切换路由模式后，验证实际路由生效 |

#### T3.3 修复 Cursor lsof 相对路径

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 手动验证 | 受限 PATH 环境 | `PATH=/usr/bin:/bin npx ts-node src/index.ts status`，验证能正确检测进程 |
| 手动验证 | LaunchAgent 模拟 | 模拟 LaunchAgent 的窄 PATH 环境执行 `cursor status` |

#### T3.4 统一余额查询

| 测试类型 | 方法 | 验证内容 |
|----------|------|---------|
| 集成测试 | 可识别 provider | 配置 OpenAI provider（`api.openai.com`），验证尝试调用余额端点 |
| 集成测试 | 不可识别 provider | 配置未知 URL 的 provider，验证返回"不可查询"而非"未配置" |
| 回归测试 | 无 API URL | 配置中没有 api URL，验证返回"不可查询" |

---

### Phase 4 — 完善

#### T4.1-T4.7 测试策略

| 任务 | 测试类型 | 验证方法 |
|------|---------|---------|
| T4.1 README | 用户验收 | 新用户按 README 快速开始章节操作，确认可从零安装并启动所有服务 |
| T4.2 .env 提示 | 手动验证 | 运行 `install.sh`，确认 API Key 配置提示为黄色加粗醒目显示 |
| T4.3 TS 编译错误 | 构建验证 | 故意修改 `.ts` 文件引入编译错误，验证终端可见完整错误信息 |
| T4.4 排障指引 | 手动验证 | 关闭一个代理后执行 `./manage.sh start codex`，确认提示中包含日志查看命令 |
| T4.5 .env.example | 回归测试 | 对比 `start.ts` 中实际读取的 `.env` 变量，确认 `.env.example` 一致 |
| T4.6 自启 PATH | 手动验证 | 使用 nvm 环境的用户执行开机自启，验证能正确找到 Node.js |
| T4.7 版本管理 | 集成测试 | 调用 `GET /api/version`，验证返回 `{ version: "1.0.0", date, proxies }` |

---

## 三、回归风险预警

### Phase 1 安全风险矩阵

| 改动 | 引入风险 | 风险等级 | 缓解措施 |
|------|---------|---------|---------|
| T1.1 密钥迁移 | 旧数据短暂不可用，迁移脚本中断会导致所有 Provider 无法解密 | 高 | 迁移脚本幂等设计；提供回滚脚本保留旧密钥文件 |
| T1.1 密钥迁移 | 自动生成的密钥丢失（如 `.encryption-key` 被删除）后所有数据永久不可解密 | 高 | 启动时检查密钥存在性，给出明确错误提示而非静默失败 |
| T1.2 反向代理白名单 | 遗漏某个已有端点导致功能突然 404 | 中 | "宽容模式"：未白名单端点先 log warn 再放行，收集 1 周后严格拦截 |
| T1.3 鉴权机制 | 前端所有 AJAX 请求缺少 token 头导致 401 雪崩 | 高 | 开发阶段 `MANAGER_PASSWORD=""` 跳过鉴权；上线前才强制开启；登录页和 dashboard 的 token 注入逻辑要有回归测试 |
| T1.3 鉴权机制 | JWT 硬编码 secret 被泄露 | 中 | 使用随机生成的 JWT secret，存储在环境变量或文件中 |
| T1.4 SQL 注入 | 白名单过滤过于严格，导致某些合法字段无法更新 | 低 | 仔细核对 `ALLOWED_UPDATE_COLUMNS` 列表，覆盖所有前端调用的 PUT 请求 |
| T1.5 流式传输 | `pipeTo` 与原有 `pipe` 行为差异 | 低 | 非流式模式保持不动，只改流式分支 |

### Phase 2 风险矩阵

| 改动 | 引入风险 | 风险等级 | 缓解措施 |
|------|---------|---------|---------|
| T2.2 崩溃恢复 | 与 `install.sh` 的 `kill -9` 冲突 | 中 | `install.sh` 改为 SIGTERM->SIGKILL 两阶段机制 |
| T2.2 崩溃恢复 | 指数退避重启占用过多 CPU 或端口 | 低 | 重启间隔上限 16 秒，5 次后彻底停止 |
| T2.3 健康检查 | 健康检查增加 API 延迟 | 中 | 健康检查超时 5 秒，不阻塞下一轮轮询 |
| T2.3 健康检查 | CircuitBreaker 频繁 OPEN/CLOSED 抖动 | 中 | HALF_OPEN 状态需至少 2 次成功请求才切换为 CLOSED |
| T2.4 流式错误处理 | `res.on('close')` 在 Node.js 版本间语义变化 | 低 | 测试覆盖 Node 18+ 各版本 |

### Phase 3 风险矩阵

| 改动 | 引入风险 | 风险等级 | 缓解措施 |
|------|---------|---------|---------|
| T3.1 代码重构 | 提取函数过程中遗漏 `proc.on('close')` 逻辑，导致崩溃恢复失效 | 高 | 必须在 T2.2 完成后、且 T2.1 测试全通过后才能开始重构 |
| T3.1 代码重构 | 重构引入的行为差异难以追踪 | 中 | 重构前后各跑一轮 `npm test`，diff 对比结果一致 |
| T3.2 竞态修复 | `fs.rename` 跨设备移动失败（罕见但可能） | 低 | `rename` 失败时 fallback 到 `writeFileSync` |
| T3.4 余额查询 | 修改返回值格式导致前端解析异常 | 低 | 检查前端余额页面的渲染逻辑，确认能处理新返回值 |

### Phase 4 风险矩阵

| 改动 | 引入风险 | 风险等级 | 缓解措施 |
|------|---------|---------|---------|
| T4.3 TS 编译 | 移除 `2>/dev/null` 后错误信息暴露敏感路径 | 低 | 审查编译错误输出，过滤掉个人路径信息 |
| T4.6 自启 PATH | nvm 路径匹配正则过于宽泛，匹配到错误版本 | 中 | 精确匹配 `$HOME/.nvm/versions/node/v*/bin`，并验证 `node -v` 符合预期 |

---

## 四、验收检查清单

### Phase 1 验收清单

- [ ] 源码中无 `'default-secret-key-change-in-production'` 字面量
- [ ] 启动时若无 `ENCRYPTION_KEY` 则自动创建 `.encryption-key` 且权限 `0600`
- [ ] `.env.example` 中包含 `ENCRYPTION_KEY` 字段及注释说明
- [ ] 已有 SQLite 数据库中的 Provider 数据可通过迁移脚本解密并重加密
- [ ] 迁移后功能不受影响：所有 Provider 仍能正常通信
- [ ] 未在白名单中的路径（如 `/api/codex/.env`）返回 404
- [ ] 未在白名单中的 HTTP 方法（如 DELETE `/api/codex/v1/models`）返回 404
- [ ] 所有现有前端功能（模型列表、聊天转发、状态查询）正常工作
- [ ] 未登录访问 `/` 重定向到登录页
- [ ] 输入正确密码后可正常操作所有功能
- [ ] Token 8 小时后自动失效，需重新登录
- [ ] 首次使用可设置密码
- [ ] `MANAGER_PASSWORD=""` 时跳过鉴权（开发模式验证）
- [ ] 启停代理、管理自启等操作必须鉴权后才能执行
- [ ] 传入恶意列名的 PUT 请求返回 400 且不执行 SQL
- [ ] 正常 Provider 字段更新（name/api_key/base_url/enabled）不受影响
- [ ] 客户端断开连接后 codex-proxy 进程不退出不报错
- [ ] 上游 120 秒无响应返回 504
- [ ] 非流式模式行为不变

### Phase 2 验收清单

- [ ] `npm test` 在根目录可运行，全部通过
- [ ] Manager API 测试覆盖所有端点（status/start/stop/restart/logs/autostart）
- [ ] Provider 转换逻辑有单元测试（OpenAI/Anthropic/Gemini）
- [ ] `jest --coverage` 显示整体覆盖率 >= 40%
- [ ] 手动 `kill` 代理进程后，manager 在 1-16 秒内自动重启
- [ ] 反复崩溃 5 次后停止自动重启，status 中显示 `fault` 状态
- [ ] 用户手动点击"启动"可重置计数器并恢复自动重启
- [ ] 正常 stop 后再 start 不触发崩溃恢复逻辑
- [ ] 关闭上游 provider 后，对应状态在 30 秒内变为 `unhealthy`
- [ ] `unhealthy` provider 被 CircuitBreaker 标记，流量不再转发
- [ ] 上游恢复后状态自动回到 `healthy`
- [ ] 健康检查接口超时不阻塞轮询定时器
- [ ] 客户端 Ctrl-C 或关闭标签页后 cursor-proxy 进程不崩溃
- [ ] 上游断开时返回已缓冲的部分流数据并正常结束
- [ ] 非流式模式行为不受影响

### Phase 3 验收清单

- [ ] `startProxy()`/`stopProxy()` 提取后，start/stop/restart 三个端点行为不变
- [ ] 已有 T2.1 测试全部通过
- [ ] 100 次并发写 `routing-mode.json` 最终内容与最后一次写入值一致
- [ ] Codex 和 Hermes 各自独立维护自己的 routing-mode 文件
- [ ] 通过 LaunchAgent 启动后 `cursor status` 命令正常工作
- [ ] 余额页面不再返回 `'未配置'` 占位文本
- [ ] 可识别 provider 尝试查询余额
- [ ] 不可识别 provider 返回 `"不可查询"` 友好提示

### Phase 4 验收清单

- [ ] 新用户按 README "快速开始" 一节可从零安装并启动所有服务
- [ ] 安装完成后 API Key 配置提示醒目（黄色 + 加粗）
- [ ] `npm run build` 出错时可在终端和日志中看到完整错误信息
- [ ] ARM Mac 上 `better-sqlite3` 编译失败时有明确提示
- [ ] 代理启动失败时在终端和管理后台都能看到日志查看命令
- [ ] `.env.example` 中的变量与代码实际使用情况一致
- [ ] 使用 nvm 的用户，LaunchAgent 启动后能找到正确版本的 Node.js
- [ ] 使用 pyenv 的用户，LaunchAgent 启动后能找到 Python3
- [ ] 前端首页显示版本号
- [ ] `GET /api/version` 返回 `{ version: "1.0.0", date, proxies: {...} }`

---

## 五、测试进度追踪表

### 20 任务追踪矩阵

> 状态说明：待执行 | 进行中 | 已通过 | 阻塞 (注明阻塞原因)

| 任务ID | 任务名称 | 模块 | 建议负责人 | 测试方法 | 当前状态 | 阻塞原因 | 备注 |
|--------|---------|------|-----------|---------|---------|---------|------|
| T1.1 | 修复加密密钥硬编码 | cursor-multi-model-proxy | 后端开发 | 单元+E2E+手动 | 待执行 | 无 | 需准备旧数据测试集 |
| T1.2 | 修复反向代理白名单 | multi-proxy-manager | 后端开发 | 集成+E2E+手动 | 待执行 | 无 | 需维护白名单清单 |
| T1.3 | 添加基础鉴权 | multi-proxy-manager | 全栈开发 | 集成+手动+安全 | 待执行 | T1.2 | 需先确定端点分级策略 |
| T1.4 | 修复 SQL 注入 | cursor-multi-model-proxy | 后端开发 | 安全测试 | 待执行 | 无 | 重点测试 SQL 注入 payload |
| T1.5 | 修复 codex 流式传输 | codex-proxy | 后端开发 | 集成测试 | 待执行 | 无 | 需 mock 上游超时场景 |
| T2.1 | 建立自动化测试框架 | 全项目 | 全栈开发 | 构建验证 | 待执行 | 无 | **整个项目的前提** |
| T2.2 | 进程崩溃自动恢复 | multi-proxy-manager | 全栈开发 | 集成测试 | 待执行 | 无 | 需在 T2.1 完成后才有回归手段 |
| T2.3 | 实现 HealthMonitor | cursor-multi-model-proxy | 后端开发 | 集成测试 | 待执行 | 无 | 需 mock 上游各种响应 |
| T2.4 | 修复 Cursor 流式错误 | cursor-multi-model-proxy | 后端开发 | 集成测试 | 待执行 | 无 | 需 mock 客户端断开 |
| T3.1 | 重构 server.js 代码重复 | multi-proxy-manager | 全栈开发 | 回归测试 | 待执行 | T2.2 | 必须等崩溃恢复完成且测试通过 |
| T3.2 | 修复竞态条件 | codex/hermes | 后端开发 | 压力测试 | 待执行 | 无 | 100 次并发写验证脚本 |
| T3.3 | 修复 Cursor lsof 路径 | cursor-multi-model-proxy | 后端开发 | 手动验证 | 待执行 | 无 | 极低成本低风险改动 |
| T3.4 | 统一余额查询提示 | hermes-proxy | 全栈开发 | 集成测试 | 待执行 | 无 | 需检查前端渲染兼容 |
| T4.1 | 添加根目录 README | 根目录 | 全栈开发 | 用户验收 | 待执行 | 无 | 新用户角色扮演 |
| T4.2 | 优化 .env 配置提示 | install.sh | 全栈开发 | 手动验证 | 待执行 | 无 | 视觉醒目度主观检查 |
| T4.3 | 修复 TS 编译静默丢弃 | manage.sh | 全栈开发 | 构建验证 | 待执行 | 无 | 需故意引入编译错误验证 |
| T4.4 | 添加启动失败排障指引 | manage.sh/install.sh | 全栈开发 | 手动验证 | 待执行 | 无 | 触发启动失败场景 |
| T4.5 | 修复 .env.example 不一致 | cursor-multi-model-proxy | 全栈开发 | 回归测试 | 待执行 | 无 | 扫描 start.ts 实际读取的变量 |
| T4.6 | 修复自启 PATH | install.sh | 全栈开发 | 手动验证 | 待执行 | 无 | 需 nvm/pyenv 环境验证 |
| T4.7 | 版本管理 | 根目录+前端 | 全栈开发 | 集成测试 | 待执行 | 无 | 需前端版本卡片 UI |

### 依赖关系速查

```
Phase 1 (全部可并行)
  T1.1  --> 密钥硬编码
  T1.2  --> 反向代理白名单
  T1.3  -----> 需 T1.2 先确定端点分级
  T1.4  --> SQL 注入
  T1.5  --> 流式传输

Phase 2 (全部可并行, 但 T2.2 依赖 T2.1)
  T2.1  --> 测试框架（项目前提）
  T2.2  -----> 依赖 T2.1 作为回归手段
  T2.3  --> 健康检查
  T2.4  --> 流式错误处理

Phase 3 (T3.1 依赖 T2.2, 其余可并行)
  T3.1  -----> 依赖 T2.2（崩溃恢复）
  T3.2  --> 竞态修复
  T3.3  --> lsof 路径
  T3.4  --> 余额查询

Phase 4 (全部可并行)
  T4.1  --> README
  T4.2  --> .env 提示
  T4.3  --> TS 编译错误
  T4.4  --> 排障指引
  T4.5  --> .env.example
  T4.6  --> 自启 PATH
  T4.7  --> 版本管理
```

---

## 六、关键质量门禁（Quality Gates）

### Phase 1 -> Phase 2 门禁

| 门禁项 | 要求 | 验证方式 |
|--------|------|---------|
| **无 P0 安全漏洞** | 密钥硬编码、SQL 注入、反向代理漏洞均已修复 | 安全测试用例全部通过 |
| **鉴权机制可用** | 登录/登出/token 过期/首次设置密码均正常工作 | 手动 + 集成测试 |
| **无功能回退** | 所有现有前端功能（模型列表、聊天转发、状态查询）正常运行 | 手动回归 + 集成测试 |
| **无 P1 bug** | Phase 1 测试中发现的 bug 全部修复 | 无开放 P1 级 issue |
| **密钥文件权限** | `.encryption-key` 权限为 `0600` | `stat` 命令验证 |
| **向后兼容** | `MANAGER_PASSWORD=""` 开发模式跳过鉴权正常工作 | 手动验证 |

### Phase 2 -> Phase 3 门禁

| 门禁项 | 要求 | 验证方式 |
|--------|------|---------|
| **自动化测试框架可用** | `npm test` 在根目录运行，全部通过 | 构建验证 |
| **测试覆盖率 >= 40%** | `jest --coverage` 报告显示整体覆盖率达标 | 覆盖率报告 |
| **崩溃恢复工作正常** | kill 进程后自动重启、5 次上限、fault 状态 | 集成测试 |
| **HealthMonitor 真实检测** | 关闭上游后状态变为 unhealthy | 集成测试 |
| **流式传输健壮** | 客户端断开不崩溃、上游断开优雅处理 | 集成测试 |
| **无 P1/P2 bug** | 所有测试发现的 bug 已修复 | 无开放 P1/P2 issue |

### Phase 3 -> Phase 4 门禁

| 门禁项 | 要求 | 验证方式 |
|--------|------|---------|
| **重构无回退** | start/stop/restart 端点行为与重构前一致 | 回归测试全通过 |
| **竞态修复通过** | 100 次并发写最终一致性验证通过 | 压力测试 |
| **lsof 路径修复** | LaunchAgent 环境下 `cursor status` 正常工作 | 手动验证 |
| **余额查询改进** | 不再返回"未配置"占位文本 | 集成测试 |
| **无 P0/P1 bug** | 所有高优先级 bug 已修复 | 无开放 P0/P1 issue |

### Phase 4 -> 上线 门禁

| 门禁项 | 要求 | 验证方式 |
|--------|------|---------|
| **README 可用性** | 新用户按 README 从零安装成功 | 用户验收测试 |
| **编译错误可见** | `npm run build` 失败时错误信息可见 | 构建验证 |
| **排障指引可用** | 启动失败时提示日志查看命令 | 手动验证 |
| **版本信息正确** | `/api/version` 返回正确的版本信息 | 集成测试 |
| **自启 PATH 正确** | nvm/pyenv 环境下自动启动正常 | 手动验证（如可用该环境） |
| **零 P0/P1 开放 bug** | 所有高优先级 bug 已修复 | 无开放 P0/P1 issue |
| **零 regression** | Phase 1-3 的全部测试依然通过 | `npm test` 全绿 |

---

## 七、测试环境与工具建议

### 建议的测试基础设施

| 工具 | 用途 | 安装位置 |
|------|------|---------|
| Jest | JavaScript/TypeScript 单元测试 + 集成测试 | 根目录 monorepo |
| supertest | Express API 集成测试 | multi-proxy-manager |
| undici/mock | Mock HTTP 上游请求 | cursor-multi-model-proxy |
| pytest | Python 模块测试 | hermes-proxy |
| nyc/c8 | 覆盖率报告 | 根目录 |
| autocannon | 压测工具（竞态条件验证） | 根目录 |

### 测试数据准备清单

1. **旧密钥数据** — 用 `'default-secret-key-change-in-production'` 加密的 Provider 数据，用于 T1.1 迁移测试
2. **Mock 上游服务** — 模拟 OpenAI/Anthropic API 的各种响应（200/500/timeout/closed connection）
3. **测试用 SQLite** — 独立 `.db` 文件，避免污染开发数据
4. **nvm/pyenv 测试环境** — 至少一个使用 nvm 的 Node 版本用于 T4.6 验证

### 建议的回归测试脚本

在根目录创建 `scripts/regression.sh`：

```bash
#!/bin/bash
# 一键回归脚本
set -e
echo "[regression] Running unit tests..."
npm test

echo "[regression] Checking security fixes..."
grep -rn "default-secret-key-change-in-production" src/ || echo "OK: no hardcoded key"

echo "[regression] Verifying .encryption-key permissions..."
stat -c '%a' .encryption-key | grep -q '600' && echo "OK: key permissions"

echo "[regression] All regression checks passed."
```

此脚本可在每个 Phase 完成后快速运行，无需启动完整前端。
