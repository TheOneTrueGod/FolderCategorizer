import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AddFolderInput,
  CatalogAPI,
  ExplorerQuery,
  FolderListQuery,
  SetTypeInput,
  UpdateFolderInput
} from '@shared/types'

const api: CatalogAPI = {
  folders: {
    list: (query: FolderListQuery) => ipcRenderer.invoke('folders:list', query),
    get: (id: string) => ipcRenderer.invoke('folders:get', id),
    add: (input: AddFolderInput) => ipcRenderer.invoke('folders:add', input),
    update: (id: string, input: UpdateFolderInput) => ipcRenderer.invoke('folders:update', id, input),
    setType: (id: string, input: SetTypeInput) => ipcRenderer.invoke('folders:setType', id, input),
    addImages: (id: string, filePaths: string[]) =>
      ipcRenderer.invoke('folders:addImages', id, filePaths),
    removeImage: (id: string, imageId: string) =>
      ipcRenderer.invoke('folders:removeImage', id, imageId),
    remove: (id: string) => ipcRenderer.invoke('folders:remove', id),
    listDirectoryChildren: (dirPath: string) =>
      ipcRenderer.invoke('folders:listDirectoryChildren', dirPath),
    listExplorer: (query: ExplorerQuery) => ipcRenderer.invoke('folders:listExplorer', query),
    listDirectoryTree: () => ipcRenderer.invoke('folders:listDirectoryTree'),
    listBreadcrumb: (directoryId: string) => ipcRenderer.invoke('folders:listBreadcrumb', directoryId),
    getParent: (id: string) => ipcRenderer.invoke('folders:getParent', id),
    setOwner: (folderIds: string[], directoryId: string | null) =>
      ipcRenderer.invoke('folders:setOwner', folderIds, directoryId),
    revealInExplorer: (id: string) => ipcRenderer.invoke('folders:revealInExplorer', id),
    linkPath: (id, diskPath, filterMode, filterEntries) =>
      ipcRenderer.invoke('folders:linkPath', id, diskPath, filterMode, filterEntries),
    unlinkPath: (id) => ipcRenderer.invoke('folders:unlinkPath', id)
  },
  tags: {
    list: (query?: string) => ipcRenderer.invoke('tags:list', query)
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    selectFile: () => ipcRenderer.invoke('dialog:selectFile'),
    selectImages: () => ipcRenderer.invoke('dialog:selectImages')
  },
  scanner: {
    onUpdated: (callback: () => void) => {
      const listener = (): void => {
        callback()
      }
      ipcRenderer.on('scanner:updated', listener)
      return () => {
        ipcRenderer.removeListener('scanner:updated', listener)
      }
    }
  },
  files: {
    pathForDroppedFile: (file: File) => webUtils.getPathForFile(file)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Renderer typings live in index.d.ts; this branch is only used if isolation is off.
  Object.assign(window, { api })
}
