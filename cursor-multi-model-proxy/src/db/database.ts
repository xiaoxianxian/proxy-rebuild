import Database from 'better-sqlite3';
import path from 'path';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

const DB_PATH = path.join(__dirname, '../../data/proxy.db');

export const db: BetterSqlite3Database = new Database(DB_PATH);

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

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
    FOREIGN KEY (provider_id) REFERENCES providers(id)
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    level TEXT NOT NULL,
    message TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
