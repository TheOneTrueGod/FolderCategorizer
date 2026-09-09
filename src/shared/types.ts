export type FolderType = 'application' | 'directory'
export type TargetKind = 'file' | 'folder'
export type FilterMode = 'allowlist' | 'denylist'

export interface ImageRecord {
  id: string
  filename: string
  sortOrder: number
}

export interface FolderRecord {
  id: string
  type: FolderType
  targetKind: TargetKind
  name: string
  description: string
  path: string
  virtual: boolean
  existsOnDisk: boolean
  filterMode: FilterMode | null
  filterEntries: string[]
  ignoredEntries: string[]
  tags: string[]
  images: ImageRecord[]
  directoryOwner: string | null
  createdAt: string
  updatedAt: string
}

export interface DirectoryChild {
  name: string
  path: string
  kind: TargetKind
}

export interface FolderListQuery {
  type: FolderType
  search?: string
  tags?: string[]
}

export interface ExplorerQuery {
  parentId: string | null
  scope?: 'all' | 'home' | 'directory'
  search?: string
  tags?: string[]
}

export interface DirectoryTreeNode {
  folder: FolderRecord
  children: DirectoryTreeNode[]
}

export function isVirtualPath(filePath: string): boolean {
  return !filePath || filePath.startsWith('virtual:')
}

export interface AddFolderInput {
  type: FolderType
  path?: string
  name?: string
  virtual?: boolean
  targetKind?: TargetKind
  filterMode?: FilterMode
  filterEntries?: string[]
  directoryOwner?: string | null
}

export interface UpdateFolderInput {
  name?: string
  description?: string
  tags?: string[]
  filterMode?: FilterMode
  filterEntries?: string[]
}

export interface SetTypeInput {
  type: FolderType
  filterMode?: FilterMode
  filterEntries?: string[]
}

export interface FolderMeta {
  id: string
  type: FolderType
  targetKind: TargetKind
  name: string
  description: string
  path: string
  filterMode: FilterMode | null
  filterEntries: string[]
  ignoredEntries: string[]
  tags: string[]
  images: ImageRecord[]
  directoryOwner: string | null
  createdAt: string
  updatedAt: string
}

export interface CatalogAPI {
  folders: {
    list: (query: FolderListQuery) => Promise<FolderRecord[]>
    get: (id: string) => Promise<FolderRecord | null>
    add: (input: AddFolderInput) => Promise<FolderRecord>
    update: (id: string, input: UpdateFolderInput) => Promise<FolderRecord>
    setType: (id: string, input: SetTypeInput) => Promise<FolderRecord>
    addImages: (id: string, filePaths: string[]) => Promise<FolderRecord>
    removeImage: (id: string, imageId: string) => Promise<FolderRecord>
    remove: (id: string) => Promise<void>
    listDirectoryChildren: (dirPath: string) => Promise<DirectoryChild[]>
    listExplorer: (query: ExplorerQuery) => Promise<FolderRecord[]>
    listDirectoryTree: () => Promise<DirectoryTreeNode[]>
    listBreadcrumb: (directoryId: string) => Promise<FolderRecord[]>
    getParent: (id: string) => Promise<FolderRecord | null>
    setOwner: (folderIds: string[], directoryId: string | null) => Promise<void>
    revealInExplorer: (id: string) => Promise<void>
    linkPath: (id: string, diskPath: string, filterMode?: FilterMode, filterEntries?: string[]) => Promise<FolderRecord>
    unlinkPath: (id: string) => Promise<FolderRecord>
  }
  tags: {
    list: (query?: string) => Promise<string[]>
  }
  dialog: {
    selectFolder: () => Promise<string | null>
    selectFile: () => Promise<string | null>
    selectImages: () => Promise<string[]>
  }
  scanner: {
    onUpdated: (callback: () => void) => () => void
  }
  files: {
    pathForDroppedFile: (file: File) => string
  }
}
