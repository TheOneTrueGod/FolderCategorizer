import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type {
  AddFolderInput,
  ExplorerQuery,
  FilterMode,
  FolderListQuery,
  SetTypeInput,
  UpdateFolderInput
} from '@shared/types'
import {
  addFolder,
  addImages,
  deleteFolder,
  getFolder,
  LibraryError,
  getParentDirectory,
  linkDirectoryPath,
  listBreadcrumb,
  listDirectoryChildren,
  listDirectoryTree,
  listExplorerContents,
  listFolders,
  listTags,
  removeImage,
  setFolderOwners,
  setFolderType,
  unlinkDirectoryPath,
  updateFolder
} from './library/store'

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function revealPathInExplorer(targetPath: string): void {
  const resolved = path.normalize(path.resolve(targetPath))
  if (!fs.existsSync(resolved)) {
    throw new LibraryError('This item is not on disk.', 'NOT_ON_DISK')
  }

  if (process.platform === 'win32') {
    const explorer = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'explorer.exe')
    const quoted = resolved.replace(/"/g, '')
    exec(`"${explorer}" /select,"${quoted}"`, { windowsHide: true }, () => undefined)
    return
  }

  shell.showItemInFolder(resolved)
}

export function registerIpc(): void {
  ipcMain.handle('folders:list', (_event, query: FolderListQuery) => listFolders(query))
  ipcMain.handle('folders:get', (_event, id: string) => getFolder(id, true))
  ipcMain.handle('folders:add', (_event, input: AddFolderInput) => addFolder(input))
  ipcMain.handle('folders:update', (_event, id: string, input: UpdateFolderInput) =>
    updateFolder(id, input)
  )
  ipcMain.handle('folders:setType', (_event, id: string, input: SetTypeInput) =>
    setFolderType(id, input)
  )
  ipcMain.handle('folders:addImages', (_event, id: string, filePaths: string[]) =>
    addImages(id, filePaths)
  )
  ipcMain.handle('folders:removeImage', (_event, id: string, imageId: string) =>
    removeImage(id, imageId)
  )
  ipcMain.handle('folders:remove', (_event, id: string) => deleteFolder(id))
  ipcMain.handle('folders:listDirectoryChildren', (_event, dirPath: string) =>
    listDirectoryChildren(dirPath)
  )
  ipcMain.handle('folders:listExplorer', (_event, query: ExplorerQuery) => listExplorerContents(query))
  ipcMain.handle('folders:listDirectoryTree', () => listDirectoryTree())
  ipcMain.handle('folders:listBreadcrumb', (_event, directoryId: string) => listBreadcrumb(directoryId))
  ipcMain.handle('folders:getParent', (_event, id: string) => getParentDirectory(id))
  ipcMain.handle('folders:setOwner', (_event, folderIds: string[], directoryId: string | null) =>
    setFolderOwners(folderIds, directoryId)
  )
  ipcMain.handle('folders:revealInExplorer', (_event, id: string) => {
    const folder = getFolder(id)
    if (!folder) {
      throw new LibraryError('Folder not found', 'NOT_FOUND')
    }
    if (folder.virtual) {
      throw new LibraryError('In-app directories are not on disk.', 'VIRTUAL')
    }
    revealPathInExplorer(folder.path)
  })
  ipcMain.handle(
    'folders:linkPath',
    (_event, id: string, diskPath: string, filterMode?: FilterMode, filterEntries?: string[]) =>
      linkDirectoryPath(id, diskPath, filterMode, filterEntries)
  )
  ipcMain.handle('folders:unlinkPath', (_event, id: string) => unlinkDirectoryPath(id))
  ipcMain.handle('tags:list', (_event, query?: string) => listTags(query))

  ipcMain.handle('dialog:selectFolder', async () => {
    const window = focusedWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('dialog:selectFile', async () => {
    const window = focusedWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('dialog:selectImages', async () => {
    const window = focusedWindow()
    if (!window) return []
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
    })
    return result.canceled ? [] : result.filePaths
  })
}
