# Multi-Proxy Manager — 实现方案

## 项目结构

```
multi-proxy-manager/
├── server.js             # Express 后端（进程管理 + API 转发）
├── public/
│   └── index.html        # 前端页面（React SPA 或纯 HTML）
├── package.json          # 依赖声明
├── PRODUCT.md            # 产品方案文档
└── IMPLEMENTATION.md     # 本文件
```

## 核心实现

### 1. 后端（server.js）

#### 代理配置
```javascript
const PROXY_CONFIGS = {
  codex: {
    name: 'Codex Proxy',
    port: 18790,
    scriptPath: path.join(__dirname, '..', 'codex-proxy', 'proxy.js'),
    startCommand: 'node',
    startArgs: ['proxy.js'],
    cwd: path.join(__dirname, '..', 'codex-proxy')
  },
  hermes: {
    name: 'Hermes Proxy',
    port: 18793,
    scriptPath: path.join(__dirname, '..', 'hermes-proxy', 'proxy.py'),
    startCommand: 'python3',
    startArgs: ['proxy.py'],
    cwd: path.join(__dirname, '..', 'hermes-proxy')
  },
  cursor: {
    name: 'Cursor Proxy',
    port: 18794,
    scriptPath: path.join(__dirname, '..', 'cursor-multi-model-proxy', 'dist', 'server', 'start.js'),
    startCommand: 'node',
    startArgs: ['dist/server/start.js'],
    cwd: path.join(__dirname, '..', 'cursor-multi-model-proxy')
  }
};
```

#### 进程管理
- `proxyProcesses` 对象存储运行中的进程实例
- `spawn()` 启动代理进程，绑定 stdout/stderr
- `isProcessRunning(name)` 检查进程状态
- 进程退出时自动清理

#### API 转发
- 使用 `axios` 将 `/api/:proxy/*` 请求转发到对应代理的 `http://127.0.0.1:{port}/*`
- 支持 GET/POST/PUT/DELETE 四种方法
- 超时时间 10 秒

#### 动态检测
- 启动时扫描 `PROXY_CONFIGS`，只检测已存在的代理目录
- 如果某代理目录不存在，对应的 API 端点返回 404
- 前端根据 `/api/status` 返回结果动态渲染配置页

### 2. 前端

#### 页面结构
```
Layout（侧边栏 + 主内容区）
├── Dashboard（概览）
│   ├── 代理状态卡片（运行中/未运行 + 启停按钮）
│   ├── 可用模型统计
│   └── 快速开始指引
├── CodexConfig（Codex 配置页）
│   ├── 配置模型显示
│   ├── 路由模式切换
│   ├── 模型切换下拉框
│   ├── Provider 状态列表
│   ├── 余额查询
│   └── 切换历史
├── HermesConfig（Hermes 配置页）
│   ├── 配置模型显示
│   ├── 路由模式切换
│   ├── 模型切换
│   └── 切换历史
├── CursorConfig（Cursor 配置页）
│   ├── Provider 管理（增删改查）
│   ├── 模型管理（增删改查）
│   ├── 路由策略配置
│   └── 全局设置
├── Logs（日志中心）
│   ├── 按代理筛选
│   ├── 按级别筛选
│   └── 自动刷新
└── Settings（系统设置）
    ├── 管理后台端口
    ├── 自动启动
    └── 日志级别
```

#### 动态渲染逻辑
```javascript
// 前端初始化时获取已安装代理列表
fetch('/api/status').then(res => res.json()).then(status => {
  // 根据 status 中 running 的代理动态生成导航菜单和配置页
  // 如果 codex 不存在或未运行，不显示 CodexConfig 标签
  // 如果 hermes 不存在或未运行，不显示 HermesConfig 标签
  // 以此类推
});
```

#### UI 组件规范
- 使用 Tailwind CSS 或原生 CSS（避免 UI 框架的"AI 味"）
- 暗色主题：背景 #0f172a，卡片 #1e293b，边框 #334155
- 状态颜色：绿色 #22c55e（运行中），红色 #ef4444（未运行），黄色 #eab308（警告）
- 字体：系统默认 sans-serif
- 按钮：圆角 6px，主色 #3b82f6
- 卡片：padding 20px，border-radius 8px，border 1px solid #334155

### 3. 安装脚本（install.sh）

```bash
#!/bin/bash
# 交互式安装脚本
# 1. 检测系统环境（Node.js/Python3）
# 2. 询问用户要安装哪些代理
#    - [ ] Codex Proxy
#    - [ ] Hermes Proxy
#    - [ ] Cursor Multi-Model Proxy
#    - [x] Multi-Proxy Manager（强制，不可取消）
# 3. 复制对应文件到 proxy-rebuild/ 根目录
# 4. 安装依赖（npm install / pip install）
# 5. 创建 .env 文件（引导输入 API Key）
# 6. 启动 Multi-Proxy Manager
```

### 4. 扩展机制

当用户后续安装新代理时：
1. 运行 `install.sh` 选择新代理
2. 在 `PROXY_CONFIGS` 中添加新代理配置
3. 在前端路由中添加新配置页
4. 管理后台自动检测并显示新代理的配置功能

**不需要重新部署管理后台**。

## 依赖
```json
{
  "express": "^4.18.0",
  "axios": "^1.6.0",
  "cors": "^2.8.0"
}
```

## 启动方式
```bash
# 方式 1：直接运行
node server.js

# 方式 2：通过管理脚本
./manage.sh manager start

# 方式 3：通过安装脚本
./install.sh
```

## 端口
- 默认端口：18792
- 访问地址：http://localhost:18792

## 注意事项
- 管理后台不直接操作代理的配置文件，所有配置操作通过代理的 API 完成
- 代理进程由管理后台 fork 管理，管理后台退出时不会自动杀死代理（需要 manage.sh 配合）
- 前端需要根据已安装代理动态渲染，避免显示不存在的配置项
- 日志轮转需要考虑磁盘空间
