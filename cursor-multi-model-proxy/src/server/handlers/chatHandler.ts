import { Request, Response } from 'express';
import { fetch } from 'undici';
import { ProviderRegistry } from '../../providers/registry.js';
import { ProviderAdapter, ProviderConfig } from '../../providers/base.js';
import { db } from '../../db/database.js';
import { SecretsManager } from '../../utils/crypto.js';

const secrets = new SecretsManager();

/**
 * 根据模型名从数据库中查找匹配的 Provider 配置
 */
export function findProviderConfig(modelName: string): ProviderConfig | null {
  // 1. 先查找启用的模型
  const modelRow = db.prepare(`
    SELECT m.provider_id, m.enabled
    FROM models m
    WHERE m.name = ? AND m.enabled = 1
  `).get(modelName) as any;

  if (!modelRow) {
    // 2. 如果模型不在数据库中，取第一个启用的 provider
    const providerRow = (db.prepare(`
      SELECT * FROM providers WHERE enabled = 1 ORDER BY created_at DESC LIMIT 1
    `).get() as any) || null;

    if (!providerRow) return null;

    return {
      id: providerRow.id,
      name: providerRow.name,
      providerId: providerRow.provider_id as any,
      apiKey: secrets.decrypt(providerRow.api_key),
      baseUrl: providerRow.base_url,
      enabled: providerRow.enabled === 1,
    };
  }

  // 3. 获取该模型对应的 Provider 配置
  const providerRow = db.prepare(`
    SELECT * FROM providers WHERE id = ? AND enabled = 1
  `).get(modelRow.provider_id) as any;

  if (!providerRow) return null;

  return {
    id: providerRow.id,
    name: providerRow.name,
    providerId: providerRow.provider_id as any,
    apiKey: secrets.decrypt(providerRow.api_key),
    baseUrl: providerRow.base_url,
    enabled: providerRow.enabled === 1,
  };
}

/**
 * 转发请求到上游 Provider
 */
export async function forwardToProvider(
  reqBody: any,
  providerConfig: ProviderConfig,
  res: Response,
  stream: boolean
): Promise<void> {
  const registry = ProviderRegistry.getInstance();
  const adapter = registry.get(providerConfig.providerId);
  if (!adapter) {
    res.status(500).json({ error: { message: `Unknown provider type: ${providerConfig.providerId}` } });
    return;
  }

  const upstreamRequest = await adapter.normalizeRequest(reqBody, providerConfig);
  const upstreamUrl = `${providerConfig.baseUrl}/chat/completions`;
  const upstreamHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

  if (providerConfig.providerId === 'anthropic') {
    upstreamHeaders['x-api-key'] = providerConfig.apiKey;
    upstreamHeaders['anthropic-version'] = '2023-06-01';
  } else {
    upstreamHeaders['Authorization'] = `Bearer ${providerConfig.apiKey}`;
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: 'POST',
    headers: upstreamHeaders,
    body: JSON.stringify(upstreamRequest),
    signal: AbortSignal.timeout(120000),
  });

  if (!upstreamResponse.ok) {
    const errText = await upstreamResponse.text();
    console.error(`[ChatHandler] Upstream error: ${errText}`);
    res.status(upstreamResponse.status).json({ error: { message: errText } });
    return;
  }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const reader = upstreamResponse.body!.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
  } else {
    const data = await upstreamResponse.json();
    res.json(data);
  }

  // 记录日志
  try {
    db.prepare('INSERT INTO logs (level, message) VALUES (?, ?)').run(
      'INFO', `Model: ${reqBody.model}, Provider: ${providerConfig.name}, Status: OK`
    );
  } catch {
    // non-critical
  }
}

/**
 * 聊天请求处理 — 核心转发逻辑
 */
export async function handleChatCompletion(req: Request, res: Response): Promise<void> {
  const { model, messages, stream } = req.body;

  if (!model || !messages || !Array.isArray(messages)) {
    res.status(400).json({ error: { message: 'Invalid request: model and messages are required' } });
    return;
  }

  const providerConfig = findProviderConfig(model);
  if (!providerConfig) {
    res.status(404).json({ error: { message: `No enabled provider found for model: ${model}` } });
    return;
  }

  console.log(`[ChatHandler] model=${model}, provider=${providerConfig.name}, stream=${stream}`);

  try {
    await forwardToProvider(req.body, providerConfig, res, stream);
  } catch (e: any) {
    console.error(`[ChatHandler] Error: ${e.message}`);
    try {
      db.prepare('INSERT INTO logs (level, message) VALUES (?, ?)').run(
        'ERROR', `Model: ${model}, Error: ${e.message}`
      );
    } catch {
      // non-critical
    }
    res.status(502).json({ error: { message: `Proxy error: ${e.message}` } });
  }
}
