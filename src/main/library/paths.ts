import { app } from 'electron'
import { dirname, join } from 'path'

export function getAppDir(): string {
  if (app.isPackaged) {
    return dirname(app.getPath('exe'))
  }

  return join(__dirname, '../..')
}

export function getDataDir(): string {
  return join(getAppDir(), 'data')
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
  return join(getFolderDir(id), 'images')
}

export function getImagePath(folderId: string, filename: string): string {
  return join(getImagesDir(folderId), filename)
}
