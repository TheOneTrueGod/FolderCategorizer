import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import type {
  AddFolderInput,
  DirectoryChild,
  DirectoryTreeNode,
  ExplorerQuery,
  FilterMode,
  FolderListQuery,
  FolderMeta,
  FolderRecord,
  FolderType,
  ImageRecord,
  SetTypeInput,
  TargetKind,
  UpdateFolderInput
} from '@shared/types'
import { isVirtualPath } from '@shared/types'
import { getDb } from '../db/database'
import { getFolderDir, getFoldersDir, getImagePath, getImagesDir, getMetaPath } from './paths'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])

export class LibraryError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'LibraryError'
    this.code = code
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function resolveOwnerId(ownerId: string | null | undefined): string | null {
  if (!ownerId) return null
  const owner = getFolder(ownerId)
  if (!owner || owner.type !== 'directory') {
    throw new LibraryError('Owner must be a directory', 'NOT_A_DIRECTORY')
  }
  return owner.id
}

function writeRecord(record: FolderRecord): void {
  writeMeta(recordToMeta(record))
  upsertFolderFromMeta(recordToMeta(record), record.existsOnDisk)
}

function reparentOwnedDirectories(fromId: string, toOwnerId: string | null): void {
  const owned = getDb()
    .prepare('SELECT id FROM folders WHERE directory_owner = ? AND type = ?')
    .all(fromId, 'directory') as { id: string }[]
  for (const row of owned) {
    const record = getFolder(row.id)
    if (!record) continue
    writeRecord({ ...record, directoryOwner: toOwnerId, updatedAt: nowIso() })
  }
}

function normalizePath(filePath: string): string {
  const normalized = path.normalize(filePath)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

function statTargetKind(filePath: string): TargetKind {
  const stat = fs.statSync(filePath)
  return stat.isDirectory() ? 'folder' : 'file'
}

function writeMeta(meta: FolderMeta): void {
  const folderDir = getFolderDir(meta.id)
  fs.mkdirSync(getImagesDir(meta.id), { recursive: true })
  fs.writeFileSync(getMetaPath(meta.id), JSON.stringify(meta, null, 2), 'utf8')
  void folderDir
}

function readMeta(id: string): FolderMeta | null {
  const metaPath = getMetaPath(id)
  if (!fs.existsSync(metaPath)) {
    return null
  }

  const raw = fs.readFileSync(metaPath, 'utf8')
  return JSON.parse(raw) as FolderMeta
}

interface FolderRow {
  id: string
  type: FolderType
  target_kind: TargetKind
  name: string
  description: string
  path: string
  exists_on_disk: number
  filter_mode: FilterMode | null
  directory_owner: string | null
  created_at: string
  updated_at: string
}

function upsertTagIds(tagNames: string[]): string[] {
  const db = getDb()
  const find = db.prepare('SELECT id FROM tags WHERE name_lc = ?')
  const insert = db.prepare('INSERT INTO tags (id, name, name_lc) VALUES (?, ?, ?)')
  const ids: string[] = []

  for (const rawName of tagNames) {
    const name = rawName.trim()
    if (!name) continue
    const nameLc = name.toLowerCase()
    const existing = find.get(nameLc) as { id: string } | undefined
    if (existing) {
      ids.push(existing.id)
      continue
    }
    const id = randomUUID()
    insert.run(id, name, nameLc)
    ids.push(id)
  }

  return ids
}

function replaceFolderTags(folderId: string, tagNames: string[]): void {
  const db = getDb()
  db.prepare('DELETE FROM folder_tags WHERE folder_id = ?').run(folderId)
  const insert = db.prepare('INSERT INTO folder_tags (folder_id, tag_id) VALUES (?, ?)')
  for (const tagId of upsertTagIds(tagNames)) {
    insert.run(folderId, tagId)
  }
}

function replaceImages(folderId: string, images: ImageRecord[]): void {
  const db = getDb()
  db.prepare('DELETE FROM images WHERE folder_id = ?').run(folderId)
  const insert = db.prepare(
    'INSERT INTO images (id, folder_id, filename, sort_order) VALUES (?, ?, ?, ?)'
  )
  for (const image of images) {
    insert.run(image.id, folderId, image.filename, image.sortOrder)
  }
}

function replaceFilters(folderId: string, entries: string[]): void {
  const db = getDb()
  db.prepare('DELETE FROM directory_filters WHERE folder_id = ?').run(folderId)
  const insert = db.prepare(
    'INSERT INTO directory_filters (folder_id, entry_name) VALUES (?, ?)'
  )
  for (const entry of entries) {
    insert.run(folderId, entry)
  }
}

function upsertFolderFromMeta(meta: FolderMeta, existsOnDisk: boolean): void {
  const db = getDb()
  db.prepare(
    `
    INSERT INTO folders (
      id, type, target_kind, name, description, path, exists_on_disk, filter_mode, directory_owner, created_at, updated_at
    ) VALUES (
      @id, @type, @target_kind, @name, @description, @path, @exists_on_disk, @filter_mode, @directory_owner, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      target_kind = excluded.target_kind,
      name = excluded.name,
      description = excluded.description,
      path = excluded.path,
      exists_on_disk = excluded.exists_on_disk,
      filter_mode = excluded.filter_mode,
      directory_owner = excluded.directory_owner,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `
  ).run({
    id: meta.id,
    type: meta.type,
    target_kind: meta.targetKind,
    name: meta.name,
    description: meta.description,
    path: meta.path,
    exists_on_disk: existsOnDisk ? 1 : 0,
    filter_mode: meta.filterMode,
    directory_owner: meta.directoryOwner ?? null,
    created_at: meta.createdAt,
    updated_at: meta.updatedAt
  })

  replaceFolderTags(meta.id, meta.tags)
  replaceImages(meta.id, meta.images)
  replaceFilters(meta.id, meta.filterEntries)
}

function loadTags(folderId: string): string[] {
  const rows = getDb()
    .prepare(
      `
      SELECT t.name
      FROM folder_tags ft
      JOIN tags t ON t.id = ft.tag_id
      WHERE ft.folder_id = ?
      ORDER BY t.name COLLATE NOCASE
    `
    )
    .all(folderId) as { name: string }[]
  return rows.map((row) => row.name)
}

function loadImages(folderId: string): ImageRecord[] {
  return getDb()
    .prepare(
      `
      SELECT id, filename, sort_order as sortOrder
      FROM images
      WHERE folder_id = ?
      ORDER BY sort_order ASC
    `
    )
    .all(folderId) as ImageRecord[]
}

function loadFilterEntries(folderId: string): string[] {
  const rows = getDb()
    .prepare(
      `
      SELECT entry_name
      FROM directory_filters
      WHERE folder_id = ?
      ORDER BY entry_name COLLATE NOCASE
    `
    )
    .all(folderId) as { entry_name: string }[]
  return rows.map((row) => row.entry_name)
}

function rowToRecord(row: FolderRow): FolderRecord {
  return {
    id: row.id,
    type: row.type,
    targetKind: row.target_kind,
    name: row.name,
    description: row.description,
    path: row.path,
    virtual: isVirtualPath(row.path),
    existsOnDisk: isVirtualPath(row.path) ? true : Boolean(row.exists_on_disk),
    filterMode: row.filter_mode,
    filterEntries: loadFilterEntries(row.id),
    tags: loadTags(row.id),
    images: loadImages(row.id),
    directoryOwner: row.directory_owner ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function recordToMeta(record: FolderRecord): FolderMeta {
  return {
    id: record.id,
    type: record.type,
    targetKind: record.targetKind,
    name: record.name,
    description: record.description,
    path: record.path,
    filterMode: record.filterMode,
    filterEntries: record.filterEntries,
    tags: record.tags,
    images: record.images,
    directoryOwner: record.directoryOwner,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

function getRowById(id: string): FolderRow | undefined {
  return getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as FolderRow | undefined
}

function findByNormalizedPath(filePath: string): FolderRow | undefined {
  if (isVirtualPath(filePath)) return undefined
  const rows = getDb().prepare('SELECT * FROM folders').all() as FolderRow[]
  const target = normalizePath(filePath)
  return rows.find((row) => !isVirtualPath(row.path) && normalizePath(row.path) === target)
}

export function getFolder(id: string, refreshExists = false): FolderRecord | null {
  const row = getRowById(id)
  if (!row) return null

  if (refreshExists && !isVirtualPath(row.path)) {
    const exists = pathExists(row.path)
    if (exists !== Boolean(row.exists_on_disk)) {
      getDb().prepare('UPDATE folders SET exists_on_disk = ? WHERE id = ?').run(exists ? 1 : 0, id)
      row.exists_on_disk = exists ? 1 : 0
    }
  }

  return rowToRecord(row)
}

export function listFolders(query: FolderListQuery): FolderRecord[] {
  const db = getDb()
  const params: Array<string | number> = [query.type]
  let sql = `SELECT * FROM folders WHERE type = ?`

  const search = query.search?.trim()
  if (search) {
    sql += ` AND name LIKE ?`
    params.push(`%${search}%`)
  }

  const tags = (query.tags ?? []).map((tag) => tag.trim()).filter(Boolean)
  if (tags.length > 0) {
    const placeholders = tags.map(() => '?').join(', ')
    sql += `
      AND (
        SELECT COUNT(DISTINCT t.name_lc)
        FROM folder_tags ft
        JOIN tags t ON t.id = ft.tag_id
        WHERE ft.folder_id = folders.id
          AND t.name_lc IN (${placeholders})
      ) = ?
    `
    params.push(...tags.map((tag) => tag.toLowerCase()), tags.length)
  }

  sql += ` ORDER BY name COLLATE NOCASE`
  const rows = db.prepare(sql).all(...params) as FolderRow[]
  return rows.map(rowToRecord)
}

export function listTags(query?: string): string[] {
  const search = query?.trim()
  if (search) {
    const rows = getDb()
      .prepare(
        `
        SELECT name
        FROM tags
        WHERE name_lc LIKE ?
        ORDER BY name COLLATE NOCASE
        LIMIT 50
      `
      )
      .all(`%${search.toLowerCase()}%`) as { name: string }[]
    return rows.map((row) => row.name)
  }

  const rows = getDb()
    .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE LIMIT 200')
    .all() as { name: string }[]
  return rows.map((row) => row.name)
}

export function listDirectoryChildren(dirPath: string): DirectoryChild[] {
  if (!pathExists(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new LibraryError('Directory does not exist or is not a folder', 'NOT_A_DIRECTORY')
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() || entry.isDirectory())
    .map((entry): DirectoryChild => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      kind: entry.isDirectory() ? 'folder' : 'file'
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
}

export function addFolder(input: AddFolderInput): FolderRecord {
  const timestamp = nowIso()
  const id = randomUUID()
  const virtualDirectory = input.type === 'directory' && (input.virtual || !input.path)

  if (virtualDirectory) {
    const meta: FolderMeta = {
      id,
      type: 'directory',
      targetKind: 'folder',
      name: input.name?.trim() || 'New directory',
      description: '',
      path: `virtual:${id}`,
      filterMode: input.filterMode ?? 'allowlist',
      filterEntries: input.filterEntries ?? [],
      tags: [],
      images: [],
      directoryOwner: resolveOwnerId(input.directoryOwner),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    writeMeta(meta)
    upsertFolderFromMeta(meta, true)
    return getFolder(meta.id) as FolderRecord
  }

  if (!input.path || !pathExists(input.path)) {
    throw new LibraryError('The selected path does not exist', 'PATH_MISSING')
  }

  const targetKind = input.targetKind ?? statTargetKind(input.path)
  if (input.type === 'directory' && targetKind !== 'folder') {
    throw new LibraryError('Directory folders must point at a folder', 'NOT_A_DIRECTORY')
  }

  const existing = findByNormalizedPath(input.path)
  if (existing) {
    throw new LibraryError(
      `This path is already tracked as a ${existing.type}`,
      'PATH_ALREADY_TRACKED'
    )
  }

  const filterMode = input.type === 'directory' ? (input.filterMode ?? 'allowlist') : null
  const filterEntries = input.type === 'directory' ? (input.filterEntries ?? []) : []
  const meta: FolderMeta = {
    id,
    type: input.type,
    targetKind,
    name: input.name?.trim() || path.basename(input.path),
    description: '',
    path: input.path,
    filterMode,
    filterEntries,
    tags: [],
    images: [],
    directoryOwner: resolveOwnerId(input.directoryOwner),
    createdAt: timestamp,
    updatedAt: timestamp
  }

  writeMeta(meta)
  upsertFolderFromMeta(meta, true)

  if (meta.type === 'directory') {
    syncDirectoryTracking(meta.id)
  }

  return getFolder(meta.id) as FolderRecord
}

export function linkDirectoryPath(
  id: string,
  diskPath: string,
  filterMode?: FilterMode,
  filterEntries?: string[]
): FolderRecord {
  const current = getFolder(id)
  if (!current || current.type !== 'directory') {
    throw new LibraryError('Only directories can be linked to a folder', 'NOT_A_DIRECTORY')
  }
  if (!pathExists(diskPath) || !fs.statSync(diskPath).isDirectory()) {
    throw new LibraryError('The selected path does not exist or is not a folder', 'PATH_MISSING')
  }

  const existing = findByNormalizedPath(diskPath)
  if (existing && existing.id !== id) {
    throw new LibraryError(
      `This path is already tracked as a ${existing.type}`,
      'PATH_ALREADY_TRACKED'
    )
  }

  const next: FolderRecord = {
    ...current,
    path: diskPath,
    virtual: false,
    existsOnDisk: true,
    filterMode: filterMode ?? current.filterMode ?? 'allowlist',
    filterEntries: filterEntries ?? current.filterEntries,
    updatedAt: nowIso()
  }

  writeMeta(recordToMeta(next))
  upsertFolderFromMeta(recordToMeta(next), true)
  syncDirectoryTracking(id)
  return getFolder(id) as FolderRecord
}

export function unlinkDirectoryPath(id: string): FolderRecord {
  const current = getFolder(id)
  if (!current || current.type !== 'directory') {
    throw new LibraryError('Only directories can be unlinked', 'NOT_A_DIRECTORY')
  }

  const next: FolderRecord = {
    ...current,
    path: `virtual:${id}`,
    virtual: true,
    existsOnDisk: true,
    updatedAt: nowIso()
  }

  writeMeta(recordToMeta(next))
  upsertFolderFromMeta(recordToMeta(next), true)
  return getFolder(id) as FolderRecord
}

export function updateFolder(id: string, input: UpdateFolderInput): FolderRecord {
  const current = getFolder(id)
  if (!current) {
    throw new LibraryError('Folder not found', 'NOT_FOUND')
  }

  const next: FolderRecord = {
    ...current,
    name: input.name?.trim() ? input.name.trim() : current.name,
    description: input.description !== undefined ? input.description : current.description,
    tags: input.tags ?? current.tags,
    filterMode:
      current.type === 'directory'
        ? (input.filterMode ?? current.filterMode ?? 'allowlist')
        : current.filterMode,
    filterEntries:
      current.type === 'directory' ? (input.filterEntries ?? current.filterEntries) : current.filterEntries,
    updatedAt: nowIso()
  }

  const filtersChanged =
    current.type === 'directory' &&
    (input.filterMode !== undefined || input.filterEntries !== undefined)

  writeMeta(recordToMeta(next))
  upsertFolderFromMeta(recordToMeta(next), current.existsOnDisk)

  if (filtersChanged) {
    syncDirectoryTracking(id)
  }

  return getFolder(id) as FolderRecord
}

export function setFolderType(id: string, input: SetTypeInput): FolderRecord {
  const current = getFolder(id)
  if (!current) {
    throw new LibraryError('Folder not found', 'NOT_FOUND')
  }

  if (current.targetKind !== 'folder' || current.virtual) {
    throw new LibraryError('Only on-disk folder paths can be swapped between types', 'NOT_A_DIRECTORY')
  }

  if (current.type === input.type) {
    return current
  }

  const next: FolderRecord = {
    ...current,
    type: input.type,
    filterMode: input.type === 'directory' ? (input.filterMode ?? 'allowlist') : current.filterMode,
    filterEntries: input.type === 'directory' ? (input.filterEntries ?? []) : current.filterEntries,
    directoryOwner: current.directoryOwner,
    updatedAt: nowIso()
  }

  writeMeta(recordToMeta(next))
  upsertFolderFromMeta(recordToMeta(next), current.existsOnDisk)

  if (input.type === 'application') {
    reparentOwnedDirectories(id, current.directoryOwner)
    clearDirectoryOwnership(id)
  } else {
    syncDirectoryTracking(id)
  }

  return getFolder(id) as FolderRecord
}

export function addImages(id: string, filePaths: string[]): FolderRecord {
  const current = getFolder(id)
  if (!current) {
    throw new LibraryError('Folder not found', 'NOT_FOUND')
  }

  const imagesDir = getImagesDir(id)
  fs.mkdirSync(imagesDir, { recursive: true })

  const images = [...current.images]
  let sortOrder = images.reduce((max, image) => Math.max(max, image.sortOrder), -1)

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(ext) || !pathExists(filePath)) {
      continue
    }

    sortOrder += 1
    const filename = `${String(sortOrder + 1).padStart(3, '0')}-${randomUUID()}${ext}`
    fs.copyFileSync(filePath, path.join(imagesDir, filename))
    images.push({
      id: randomUUID(),
      filename,
      sortOrder
    })
  }

  const next: FolderRecord = {
    ...current,
    images,
    updatedAt: nowIso()
  }

  writeMeta(recordToMeta(next))
  upsertFolderFromMeta(recordToMeta(next), current.existsOnDisk)
  return getFolder(id) as FolderRecord
}

export function removeImage(id: string, imageId: string): FolderRecord {
  const current = getFolder(id)
  if (!current) {
    throw new LibraryError('Folder not found', 'NOT_FOUND')
  }

  const image = current.images.find((item) => item.id === imageId)
  if (!image) {
    return current
  }

  const imagePath = getImagePath(id, image.filename)
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath)
  }

  const next: FolderRecord = {
    ...current,
    images: current.images.filter((item) => item.id !== imageId),
    updatedAt: nowIso()
  }

  writeMeta(recordToMeta(next))
  upsertFolderFromMeta(recordToMeta(next), current.existsOnDisk)
  return getFolder(id) as FolderRecord
}

function excludeFromOwningDirectory(record: FolderRecord): void {
  const owner = record.directoryOwner ? getFolder(record.directoryOwner) : getParentDirectory(record.id)
  if (!owner || owner.type !== 'directory' || owner.virtual || record.virtual) return
  if (isVirtualPath(record.path) || isVirtualPath(owner.path)) return
  if (normalizePath(path.dirname(record.path)) !== normalizePath(owner.path)) return

  const name = path.basename(record.path)
  const filterEntries =
    owner.filterMode === 'allowlist'
      ? owner.filterEntries.filter((entry) => entry !== name)
      : Array.from(new Set([...owner.filterEntries, name]))

  const next = { ...owner, filterEntries, updatedAt: nowIso() }
  writeMeta(recordToMeta(next))
  upsertFolderFromMeta(recordToMeta(next), owner.existsOnDisk)
}

export function deleteFolder(id: string): void {
  const current = getFolder(id)
  if (!current) {
    throw new LibraryError('Folder not found', 'NOT_FOUND')
  }

  excludeFromOwningDirectory(current)

  if (current.type === 'directory') {
    reparentOwnedDirectories(id, current.directoryOwner)
    const owned = getDb()
      .prepare('SELECT id FROM folders WHERE directory_owner = ? AND type = ?')
      .all(id, 'application') as { id: string }[]
    for (const row of owned) {
      deleteFolder(row.id)
    }
  }

  const folderDir = getFolderDir(id)
  fs.rmSync(folderDir, { recursive: true, force: true })
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
}

function clearDirectoryOwnership(directoryId: string): void {
  const owned = getDb()
    .prepare('SELECT id FROM folders WHERE directory_owner = ?')
    .all(directoryId) as { id: string }[]

  for (const row of owned) {
    const record = getFolder(row.id)
    if (!record) continue
    const next = { ...record, directoryOwner: null, updatedAt: nowIso() }
    writeMeta(recordToMeta(next))
    upsertFolderFromMeta(recordToMeta(next), record.existsOnDisk)
  }
}

export function syncDirectoryTracking(directoryId: string): boolean {
  const directory = getFolder(directoryId)
  if (!directory || directory.type !== 'directory') return false

  if (directory.virtual) return false

  if (!pathExists(directory.path) || !fs.statSync(directory.path).isDirectory()) {
    return setExistsOnDisk(directory.id, false)
  }

  let changed = setExistsOnDisk(directory.id, true)
  const diskChildren = listDirectoryChildren(directory.path)

  for (const child of diskChildren) {
    const existing = findByNormalizedPath(child.path)
    if (existing?.type !== 'application' || existing.directory_owner) continue
    const record = getFolder(existing.id)
    if (!record) continue
    const adopted = { ...record, directoryOwner: directoryId, updatedAt: nowIso() }
    writeMeta(recordToMeta(adopted))
    upsertFolderFromMeta(recordToMeta(adopted), record.existsOnDisk)
    changed = true
  }

  const owned = getDb()
    .prepare('SELECT id, path FROM folders WHERE directory_owner = ? AND type = ?')
    .all(directoryId, 'application') as { id: string; path: string }[]

  const trackable = diskChildren.filter((child) =>
    shouldTrackChild(child.name, directory.filterMode, directory.filterEntries)
  )
  const trackablePaths = new Set(trackable.map((child) => normalizePath(child.path)))

  for (const row of owned) {
    const isImmediateChild = diskChildren.some(
      (child) => normalizePath(child.path) === normalizePath(row.path)
    )
    if (!isImmediateChild) continue
    if (!trackablePaths.has(normalizePath(row.path))) {
      deleteFolder(row.id)
      changed = true
    }
  }

  for (const child of trackable) {
    if (pathIsTracked(child.path)) continue
    addFolder({
      type: 'application',
      path: child.path,
      targetKind: child.kind,
      directoryOwner: directoryId
    })
    changed = true
  }

  return changed
}

function wouldCreateOwnerCycle(folderId: string, ownerId: string): boolean {
  let cursor: string | null = ownerId
  const seen = new Set<string>([folderId])
  while (cursor) {
    if (seen.has(cursor)) return true
    seen.add(cursor)
    cursor = getFolder(cursor)?.directoryOwner ?? null
  }
  return false
}

export function setFolderOwners(folderIds: string[], directoryId: string | null): void {
  const directory = directoryId ? getFolder(directoryId) : null
  if (directoryId && (!directory || directory.type !== 'directory')) {
    throw new LibraryError('Target must be a directory', 'NOT_A_DIRECTORY')
  }

  for (const id of folderIds) {
    const record = getFolder(id)
    if (!record || record.type !== 'directory' || !directory) continue
    if (record.id === directory.id) continue
    if (wouldCreateOwnerCycle(record.id, directory.id)) {
      throw new LibraryError(
        'A directory cannot be moved into itself or one of its children',
        'OWNER_CYCLE'
      )
    }
  }

  const applicationNames: string[] = []
  for (const id of folderIds) {
    const record = getFolder(id)
    if (!record) continue
    if (directory && record.id === directory.id) continue
    if (record.directoryOwner === (directory?.id ?? null)) continue

    excludeFromOwningDirectory(record)
    writeRecord({ ...record, directoryOwner: directory?.id ?? null, updatedAt: nowIso() })
    if (record.type === 'application' && directory && !isVirtualPath(record.path)) {
      applicationNames.push(path.basename(record.path))
    }
  }

  if (!directory || applicationNames.length === 0) return

  const nextEntries =
    directory.filterMode === 'allowlist'
      ? Array.from(new Set([...directory.filterEntries, ...applicationNames]))
      : directory.filterEntries.filter((entry) => !applicationNames.includes(entry))

  writeRecord({
    ...directory,
    filterEntries: nextEntries,
    updatedAt: nowIso()
  })
}

export function setApplicationOwners(applicationIds: string[], directoryId: string): void {
  setFolderOwners(applicationIds, directoryId)
}

export function setExistsOnDisk(id: string, exists: boolean): boolean {
  const row = getRowById(id)
  if (!row) return false
  const current = Boolean(row.exists_on_disk)
  if (current === exists) return false
  getDb().prepare('UPDATE folders SET exists_on_disk = ? WHERE id = ?').run(exists ? 1 : 0, id)
  return true
}

function isPathInside(childPath: string, parentPath: string): boolean {
  if (isVirtualPath(childPath) || isVirtualPath(parentPath)) return false
  const child = normalizePath(childPath)
  const parent = normalizePath(parentPath)
  if (child === parent) return false
  const prefix = parent.endsWith(path.sep) ? parent : parent + path.sep
  return child.startsWith(prefix)
}

function findNearestDirectory(filePath: string, directories: FolderRecord[]): FolderRecord | null {
  let best: FolderRecord | null = null
  for (const directory of directories) {
    if (!isPathInside(filePath, directory.path)) continue
    if (!best || normalizePath(directory.path).length > normalizePath(best.path).length) {
      best = directory
    }
  }
  return best
}

function listAllRecords(): FolderRecord[] {
  const rows = getDb().prepare('SELECT * FROM folders').all() as FolderRow[]
  return rows.map(rowToRecord)
}

function applyExplorerFilters(records: FolderRecord[], query: ExplorerQuery): FolderRecord[] {
  const needle = query.search?.trim().toLowerCase()
  const tags = (query.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)

  return records
    .filter((record) => {
      if (needle && !record.name.toLowerCase().includes(needle)) return false
      if (tags.length > 0 && !tags.every((tag) => record.tags.some((item) => item.toLowerCase() === tag))) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
}

export function listExplorerContents(query: ExplorerQuery): FolderRecord[] {
  const all = listAllRecords()
  const parent = query.parentId ? all.find((record) => record.id === query.parentId) : null

  const items = all.filter((record) => {
    if (parent && record.id === parent.id) return false
    return parent ? record.directoryOwner === parent.id : record.directoryOwner === null
  })

  return applyExplorerFilters(items, query)
}

function ownerCycle(
  folderId: string,
  ownerId: string,
  byId: Map<string, FolderRecord>
): boolean {
  let cursor: string | undefined = ownerId
  const seen = new Set<string>([folderId])
  while (cursor) {
    if (seen.has(cursor)) return true
    seen.add(cursor)
    cursor = byId.get(cursor)?.directoryOwner ?? undefined
  }
  return false
}

export function listDirectoryTree(): DirectoryTreeNode[] {
  const directories = listAllRecords().filter((record) => record.type === 'directory')
  const byId = new Map(directories.map((folder) => [folder.id, folder]))
  const nodes = new Map<string, DirectoryTreeNode>()
  for (const folder of directories) {
    nodes.set(folder.id, { folder, children: [] })
  }

  const roots: DirectoryTreeNode[] = []
  for (const folder of directories) {
    const node = nodes.get(folder.id)
    if (!node) continue
    const owner = folder.directoryOwner ? byId.get(folder.directoryOwner) : undefined
    if (owner && owner.id !== folder.id && !ownerCycle(folder.id, owner.id, byId)) {
      nodes.get(owner.id)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (list: DirectoryTreeNode[]): void => {
    list.sort((a, b) => a.folder.name.localeCompare(b.folder.name, undefined, { sensitivity: 'base' }))
    for (const node of list) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}

export function listBreadcrumb(directoryId: string): FolderRecord[] {
  const directories = listAllRecords().filter((record) => record.type === 'directory')
  const byId = new Map(directories.map((folder) => [folder.id, folder]))
  const current = byId.get(directoryId)
  if (!current) return []

  const chain: FolderRecord[] = [current]
  const seen = new Set<string>([current.id])
  let cursor = current
  while (cursor.directoryOwner) {
    const parent = byId.get(cursor.directoryOwner)
    if (!parent || seen.has(parent.id)) break
    chain.unshift(parent)
    seen.add(parent.id)
    cursor = parent
  }
  return chain
}

export function getParentDirectory(id: string): FolderRecord | null {
  const record = getFolder(id)
  if (!record?.directoryOwner) return null
  const owner = getFolder(record.directoryOwner)
  return owner?.type === 'directory' ? owner : null
}

export function listDirectoryRecords(): FolderRecord[] {
  return listFolders({ type: 'directory' })
}

export function listAllFolderRows(): Array<{ id: string; path: string; type: FolderType }> {
  return getDb()
    .prepare('SELECT id, path, type FROM folders')
    .all() as Array<{ id: string; path: string; type: FolderType }>
}

export function pathIsTracked(filePath: string): boolean {
  return Boolean(findByNormalizedPath(filePath))
}

export function shouldTrackChild(
  childName: string,
  filterMode: FilterMode | null,
  filterEntries: string[]
): boolean {
  const selected = new Set(filterEntries)
  if (filterMode === 'allowlist') {
    return selected.has(childName)
  }
  return !selected.has(childName)
}

export function reconcileLibrary(): void {
  const foldersDir = getFoldersDir()
  fs.mkdirSync(foldersDir, { recursive: true })

  const jsonIds = new Set<string>()
  const entries = fs.readdirSync(foldersDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = readMeta(entry.name)
    if (!meta?.id) continue
    jsonIds.add(meta.id)
    upsertFolderFromMeta(meta, isVirtualPath(meta.path) || pathExists(meta.path))
  }

  const rows = getDb().prepare('SELECT id FROM folders').all() as { id: string }[]
  const remove = getDb().prepare('DELETE FROM folders WHERE id = ?')
  for (const row of rows) {
    if (!jsonIds.has(row.id)) {
      remove.run(row.id)
    }
  }

  const version = Number(getDb().pragma('user_version', { simple: true }))
  if (version < 2) {
    backfillDirectoryOwnersFromPath()
    getDb().pragma('user_version = 2')
  }
}

function backfillDirectoryOwnersFromPath(): void {
  const directories = listAllRecords().filter((record) => record.type === 'directory')
  for (const folder of directories) {
    if (folder.directoryOwner) continue
    const ancestor = findNearestDirectory(
      folder.path,
      directories.filter((item) => item.id !== folder.id)
    )
    if (!ancestor) continue
    writeRecord({ ...folder, directoryOwner: ancestor.id, updatedAt: nowIso() })
  }
}
