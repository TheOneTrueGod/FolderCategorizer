import { app } from 'electron'
import fs from 'fs'
import { dirname, join } from 'path'

export function getAppDir(): string {
  if (app.isPackaged) {
    return dirname(app.getPath('exe'))
  }

  return join(__dirname, '../..')
}

export function getDataDir(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'data')
  }

  return join(getAppDir(), 'data')
}

export function getLegacyPackagedDataDir(): string {
  return join(getAppDir(), 'data')
}

export function migrateLegacyPackagedData(): void {
  if (!app.isPackaged) return

  const dest = getDataDir()
  const src = getLegacyPackagedDataDir()
  if (src === dest) return
  if (!fs.existsSync(src)) return

  const destSqlite = join(dest, 'index.sqlite')
  const destFolders = join(dest, 'folders')
  const destHasData =
    fs.existsSync(destSqlite) ||
    (fs.existsSync(destFolders) && fs.readdirSync(destFolders).length > 0)
  if (destHasData) return

  fs.mkdirSync(dest, { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
}

export function getSqlitePath(): string {
  return join(getDataDir(), 'index.sqlite')
}

export function getFoldersDir(): string {
  return join(getDataDir(), 'folders')
}

export function getFolderDir(id: string): string {
  return join(getFoldersDir(), id)
}

export function getMetaPath(id: string): string {
  return join(getFolderDir(id), 'meta.json')
}

export function getImagesDir(id: string): string {
  return join(getFoldersDir(), id, 'images')
}

export function getImagePath(folderId: string, filename: string): string {
  return join(getImagesDir(folderId), filename)
}
