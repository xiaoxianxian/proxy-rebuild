import { Router, Request, Response } from 'express';
import { db } from '../../db/database.js';
import { SecretsManager } from '../../utils/crypto.js';

const router = Router();
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';
const secrets = new SecretsManager(SECRET_KEY);

// ==================== Provider CRUD ====================

// GET /admin-api/providers
router.get('/providers', (_req: Request, res: Response) => {
  const providers = db.prepare('SELECT * FROM providers ORDER BY name ASC').all();
  // Mask API keys for display
  const safe = providers.map((p: any) => ({
    ...p,
    api_key: p.api_key ? p.api_key.slice(0, 4) + '****' : '(empty)',
  }));
  res.json({ providers: safe });
});

// POST /admin-api/providers
router.post('/providers', (req: Request, res: Response) => {
  const { id, name, provider_id, api_key, base_url, enabled } = req.body;
  if (!id || !name || !provider_id || !api_key || !base_url) {
    res.status(400).json({ error: 'Missing required fields: id, name, provider_id, api_key, base_url' });
    return;
  }
  try {
    const encKey = secrets.encrypt(api_key);
    const stmt = db.prepare(`INSERT INTO providers (id, name, provider_id, api_key, base_url, enabled) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run(id, name, provider_id, encKey, base_url, enabled ? 1 : 0);
    res.json({ success: true });
  } catch (e: any) {
    res.status(409).json({ error: e.message });
  }
});

// PUT /admin-api/providers/:id
router.put('/providers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, provider_id, api_key, base_url, enabled } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (provider_id) { updates.push('provider_id = ?'); values.push(provider_id); }
  if (api_key) { updates.push('api_key = ?'); values.push(secrets.encrypt(api_key)); }
  if (base_url) { updates.push('base_url = ?'); values.push(base_url); }
  if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE providers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json({ success: true });
});

// DELETE /admin-api/providers/:id
router.delete('/providers/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM providers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== Model CRUD ====================

// GET /admin-api/models
router.get('/models', (_req: Request, res: Response) => {
  const models = db.prepare(`
    SELECT m.*, p.name as provider_name
    FROM models m
    LEFT JOIN providers p ON m.provider_id = p.id
    ORDER BY p.name, m.name
  `).all();
  res.json({ models });
});

// POST /admin-api/models
router.post('/models', (req: Request, res: Response) => {
  const { id, provider_id, name, enabled, alias } = req.body;
  if (!id || !provider_id || !name) {
    res.status(400).json({ error: 'Missing required fields: id, provider_id, name' });
    return;
  }
  db.prepare('INSERT INTO models (id, provider_id, name, enabled, alias) VALUES (?, ?, ?, ?, ?)').run(
    id, provider_id, name, enabled ? 1 : 0, alias || null
  );
  res.json({ success: true });
});

// DELETE /admin-api/models/:id
router.delete('/models/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM models WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== Route CRUD ====================

// GET /admin-api/routes
router.get('/routes', (_req: Request, res: Response) => {
  const routes = db.prepare('SELECT * FROM routes ORDER BY created_at DESC').all();
  res.json({ routes });
});

// POST /admin-api/routes
router.post('/routes', (req: Request, res: Response) => {
  const { id, default_model, fallback_chain, rules, max_retries } = req.body;
  db.prepare('INSERT INTO routes (id, default_model, fallback_chain, rules, max_retries) VALUES (?, ?, ?, ?, ?)').run(
    id, default_model, JSON.stringify(fallback_chain || []), JSON.stringify(rules || []), max_retries || 2
  );
  res.json({ success: true });
});

// ==================== Logs ====================

// GET /admin-api/logs
router.get('/logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs = db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT ?').all(limit);
  const logsFormatted = (logs as any[]).map((l: any) => `[${l.timestamp}] ${l.level}: ${l.message}`).join('\n');
  res.json({ logs: logsFormatted });
});

// ==================== Health ====================

// GET /admin-api/health
router.get('/health', (_req: Request, res: Response) => {
  const providers = db.prepare('SELECT * FROM providers').all();
  const models = db.prepare('SELECT * FROM models WHERE enabled = 1').all();
  res.json({
    status: 'ok',
    providers: providers.length,
    models: models.length,
  });
});

// ==================== Settings ====================

// GET /admin-api/settings
router.get('/settings', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings: Record<string, string> = {};
  (rows as any[]).forEach(r => settings[r.key] = r.value);
  res.json({ settings });
});

// PUT /admin-api/settings
router.put('/settings', (req: Request, res: Response) => {
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

export { router };
