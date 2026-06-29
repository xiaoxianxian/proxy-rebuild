import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/proxy.db');

export const db: BetterSqlite3Database = new Database(DB_PATH);

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

// 启用外键约束以确保引用完整性
db.pragma('foreign_keys = ON');

// 创建数据库表
db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    api_key TEXT NOT NULL,
    base_url TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    alias TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    default_model TEXT NOT NULL,
    fallback_chain TEXT NOT NULL,
    rules TEXT DEFAULT '[]',
    max_retries INTEGER DEFAULT 2,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY,
    proxy TEXT DEFAULT 'system',
    timestamp TEXT DEFAULT (datetime('now')),
    level TEXT NOT NULL,
    message TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ==================== Migrations ====================

// D1: Ensure providers has UNIQUE(provider_id).
// SQLite cannot add a UNIQUE constraint via ALTER TABLE, so we check whether the
// index already exists and recreate the table only when needed.
(function ensureProviderUniqueIndex() {
  const indexes = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
  ).all() as Array<{ name: string }>;

  // If a non-auto index covers provider_id, the constraint already exists.
  if ((indexes as any[]).some(i => i.name === 'unique_provider_id')) {
    return; // already migrated
  }

  // Check whether provider_id values are unique before adding constraint.
  const duplicateCount = db.prepare(`
    SELECT COUNT(*) AS dup FROM (
      SELECT provider_id, COUNT(*) AS c
      FROM providers
      GROUP BY provider_id
      HAVING c > 1
    )
  `).get() as { dup: number };

  if (duplicateCount.dup! > 0) {
    console.warn('[DB] Duplicate provider_id values exist; skipping UNIQUE constraint.');
    return;
  }

  // Use CREATE INDEX — SQLite treats a UNIQUE index as the constraint enforcement.
  try {
    db.prepare('CREATE UNIQUE INDEX unique_provider_id ON providers(provider_id)').run();
    console.log('[DB] Added UNIQUE(provider_id) index to providers table.');
  } catch (e) {
    console.warn('[DB] Could not create UNIQUE index:', (e as Error).message);
  }
})();

// D3: Clean up logs older than 30 days at startup.
try {
  const result = db.prepare(
    "DELETE FROM logs WHERE timestamp < datetime('now', '-30 days')"
  ).run();
  if (result.changes > 0) {
    console.log(`[DB] Cleaned up ${result.changes} log(s) older than 30 days.`);
  }
} catch (e) {
  // Best-effort; non-critical.
  console.warn('[DB] Log cleanup skipped:', (e as Error).message);
}

// 清理孤儿记录（models 中外 provider_id 指向已删除的 providers）
try {
  const orphanResult = db.prepare(`
    DELETE FROM models WHERE provider_id NOT IN (SELECT id FROM providers)
  `).run();
  if (orphanResult.changes > 0) {
    console.log(`[DB] Cleaned up ${orphanResult.changes} orphaned model(s)`);
  }
} catch (e) {
  // Best-effort: non-critical migration
  console.warn('[DB] Orphan cleanup skipped:', (e as Error).message);
}
