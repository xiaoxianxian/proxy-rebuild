---
name: proxy-rebuild-code-review
description: proxy-rebuild 项目已完成四角色代码评审，产出整改方案、开发任务拆解、测试追踪文档
type: project
---

## 项目背景

proxy-rebuild 是一个多代理管理系统，统一管理三个 AI 代理服务（Codex、Hermes、Cursor），提供 Web 管理界面。

## 已完成工作

2026-06-26 完成了四角色代码评审，产出以下文档：

1. **四角色评审报告** — 22 个问题项（P0-P3 四个等级），覆盖安全、架构、测试、用户体验
2. **IMPROVEMENT-PLAN.md** — 产品经理专项整改方案，分 4 个 Phase，13.4 人天，约 3 周
3. **DEV-TASKS.md** — 架构师开发任务拆解，20 个具体任务（T1.1-T4.7），含依赖关系和并行图
4. **TEST-TRACKING.md** — 测试工程师追踪文档，含测试策略、回归风险矩阵、验收清单、质量门禁

## 关键发现摘要

### P0 紧急安全（Phase 1）
- 加密密钥硬编码默认值 `default-secret-key-change-in-production`
- 反向代理 `app.all('/api/:proxy/*')` 无白名单保护
- SQL 注入风险（列名字符串拼接）
- 管理后台无鉴权

### P1 核心功能（Phase 2）
- 零自动化测试
- 进程崩溃后无自动恢复
- HealthMonitor 空实现
- 流式传输无错误处理

### P2 体验优化（Phase 3）
- server.js 代码重复度高
- routing-mode.json 竞态条件
- Cursor lsof 相对路径
- Hermes 余额查询占位实现

### P3 完善（Phase 4）
- 根目录缺 README
- .env 配置提示不醒目
- TS 编译错误静默丢弃
- 启动失败无排障指引
- 开机自启 PATH 不完整
- 缺版本管理

## 下一步

用户已确认方案，将在新对话中启动实施。按 Phase 1→2→3→4 顺序推进，每个 Phase 完成后进行对应验收。
