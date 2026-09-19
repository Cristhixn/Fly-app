const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // SQLite integrado en Node.js (sin compilar nada)

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'astra.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    pinned INTEGER DEFAULT 0,
    messages_json TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memory_notes (
    id TEXT PRIMARY KEY,
    note TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

module.exports = db;
