import fs from 'fs'
import Database from 'better-sqlite3'
import { getDataDir, getFoldersDir, getSqlitePath } from '../library/paths'
import { migrate } from './schema'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database has not been initialized')
  }
  return db
}

export function initDatabase(): Database.Database {
  fs.mkdirSync(getDataDir(), { recursive: true })
  fs.mkdirSync(getFoldersDir(), { recursive: true })

  db = new Database(getSqlitePath())
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}
