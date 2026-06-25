# Hermes Proxy — 实现方案

## 项目结构

```
hermes-proxy/
├── proxy.py          # 主入口，Flask 应用
├── start-proxy.sh    # 启动脚本
├── requirements.txt  # Python 依赖
├── .env.example      # 环境变量模板
└── PRODUCT.md        # 产品方案文档
```

## 核心实现

### proxy.py — 单文件实现

#### 1. 配置检测与解析
```python
candidates = [
    os.path.join(HOME, '.hermes', 'config.yaml'),
    os.path.join(HOME, 'Library', 'Containers', 'app.nousresearch.hermes', 'Data', '.hermes', 'config.yaml'),
    os.path.join(HOME, '.hermes', 'config.yml'),
]
```

- `parse_config_yaml(file_path)`：使用 PyYAML 安全加载
- `get_current_model(config_data)`：从 `model.default` 或 `providers[*].default_model` 提取当前模型
- `update_config_yaml(file_path, new_model)`：更新 YAML 文件中的模型值，保持格式

#### 2. Provider 发现
```python
def find_provider(model_name, config_data):
    providers = config_data.get('providers', {})
    # 1. 检查顶层 model.default
    # 2. 检查 providers[*].models 字典
    # 3. 检查 providers[*].default_model
    # 4. 回退：按模型名前缀匹配 provider 名（如 agnes-* → agnes provider）
```

#### 3. 路由模式管理
- 存储在 `~/.hermes-proxy/routing-mode.json`
- 三种模式：`codex`、`config`、`both`
- `load_routing_mode()` / `update_routing_mode(mode)` 读写文件

#### 4. 聊天请求转发
```python
@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    # 1. 解析请求体 model 字段
    # 2. find_provider(model, config_data) 查找 Provider
    # 3. 构建上游 URL: ${provider['api']}/chat/completions
    # 4. 发送请求，携带 Authorization header
    # 5. 流式响应：return Response(stream_with_context(response.iter_content()), ...)
    # 6. 非流式：return jsonify(response.json())
```

#### 5. 模型切换 API
```python
@app.route('/api/switch-model', methods=['POST'])
def switch_model():
    # 1. 验证模型是否存在于配置中
    # 2. 记录旧模型名
    # 3. update_config_yaml() 写入新模型
    # 4. update_routing_mode('config') 自动切换到 config 模式
    # 5. 记录切换历史
    # 6. 返回 { success, message, oldModel, newModel, needRestart }
```

#### 6. 余额查询
- 简化实现：从 config.yaml 中发现的 Provider 标记为"未配置"
- 如需精确余额，需对接各 Provider 的余额 API

#### 7. 切换历史
- 内存列表 `switch_history`，每条记录：timestamp, action, from, to, mode, success
- 最多 50 条，FIFO 淘汰
- GET `/api/history` 返回最近 20 条

## 依赖
```txt
flask
pyyaml
requests
```

## 启动方式
```bash
# 方式 1：直接运行
python3 proxy.py

# 方式 2：通过管理脚本
./manage.sh hermes start

# 方式 3：通过管理后台
curl -X POST http://localhost:18792/api/start/hermes
```

## 注意事项
- 配置文件必须是合法的 YAML 格式
- Provider 的 API 地址格式必须支持 `/chat/completions` 端点
- 模型切换需要 Hermes Agent 重新读取配置文件
