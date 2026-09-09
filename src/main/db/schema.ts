import type Database from 'better-sqlite3'

export function migrate(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('application', 'directory')),
      target_kind TEXT NOT NULL CHECK (target_kind IN ('file', 'folder')),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      path TEXT NOT NULL UNIQUE,
      exists_on_disk INTEGER NOT NULL DEFAULT 1,
      filter_mode TEXT CHECK (filter_mode IS NULL OR filter_mode IN ('allowlist', 'denylist')),
      directory_owner TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_lc TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS folder_tags (
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (folder_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS directory_filters (
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      entry_name TEXT NOT NULL,
      PRIMARY KEY (folder_id, entry_name)
    );

    CREATE TABLE IF NOT EXISTS directory_ignored (
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      entry_name TEXT NOT NULL,
      PRIMARY KEY (folder_id, entry_name)
    );

    CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(type);
    CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);
    CREATE INDEX IF NOT EXISTS idx_folder_tags_tag ON folder_tags(tag_id);
  `)

  const columns = db.prepare('PRAGMA table_info(folders)').all() as { name: string }[]
  if (!columns.some((column) => column.name === 'directory_owner')) {
    db.exec(`
      ALTER TABLE folders ADD COLUMN directory_owner TEXT REFERENCES folders(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_folders_directory_owner ON folders(directory_owner);
    `)
  }
}
