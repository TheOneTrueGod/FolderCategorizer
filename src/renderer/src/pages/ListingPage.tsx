import { useCallback, useEffect, useRef, useState, type JSX, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { DirectoryChild, DirectoryTreeNode, FilterMode, FolderRecord } from '@shared/types'
import BulkTagDialog from '../components/BulkTagDialog'
import ContextMenu from '../components/ContextMenu'
import EditTagsDialog from '../components/EditTagsDialog'
import DirectoryFilterDialog from '../components/DirectoryFilterDialog'
import DirectoryTree from '../components/DirectoryTree'
import FolderGrid from '../components/FolderGrid'
import FolderTable from '../components/FolderTable'
import NameDialog from '../components/NameDialog'
import TagInput from '../components/TagInput'
import { errorMessage } from '../lib/images'

type ViewMode = 'table' | 'grid'

interface PendingDirectory {
  mode: 'create' | 'swap' | 'link'
  path: string
  folderId?: string
  children: DirectoryChild[]
  filterMode: FilterMode
  filterEntries: string[]
}

export default function ListingPage(): JSX.Element {
  const navigate = useNavigate()
  const { directoryId = null } = useParams()
  const [view, setView] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [tree, setTree] = useState<DirectoryTreeNode[]>([])
  const [breadcrumb, setBreadcrumb] = useState<FolderRecord[]>([])
  const [currentDirectory, setCurrentDirectory] = useState<FolderRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addDirOpen, setAddDirOpen] = useState(false)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [pendingDirectory, setPendingDirectory] = useState<PendingDirectory | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folder: FolderRecord } | null>(
    null
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])
  const [bulkTagsBusy, setBulkTagsBusy] = useState(false)
  const [editTagsFolder, setEditTagsFolder] = useState<FolderRecord | null>(null)
  const [editTagsBusy, setEditTagsBusy] = useState(false)
  const lastSelectedId = useRef<string | null>(null)
  const selectedIdsRef = useRef<string[]>([])
  const addMenuRef = useRef<HTMLDivElement>(null)
  const addDirMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    setSelectedIds([])
    lastSelectedId.current = null
  }, [directoryId])

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), 180)
    return () => window.clearTimeout(handle)
  }, [search])

  const load = useCallback(async () => {
    try {
      const [rows, directoryTree] = await Promise.all([
        window.api.folders.listExplorer({
          parentId: directoryId,
          search: debouncedSearch,
          tags
        }),
        window.api.folders.listDirectoryTree()
      ])
      setFolders(rows)
      setTree(directoryTree)

      if (directoryId) {
        const [crumbs, current] = await Promise.all([
          window.api.folders.listBreadcrumb(directoryId),
          window.api.folders.get(directoryId)
        ])
        setBreadcrumb(crumbs)
        setCurrentDirectory(current)
      } else {
        setBreadcrumb([])
        setCurrentDirectory(null)
      }
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [directoryId, debouncedSearch, tags])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return window.api.scanner.onUpdated(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!addMenuRef.current?.contains(target)) setAddOpen(false)
      if (!addDirMenuRef.current?.contains(target)) setAddDirOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const selectItems = (folder: FolderRecord, event: MouseEvent): void => {
    if (event.shiftKey && lastSelectedId.current) {
      const start = folders.findIndex((item) => item.id === lastSelectedId.current)
      const end = folders.findIndex((item) => item.id === folder.id)
      if (start === -1 || end === -1) {
        setSelectedIds([folder.id])
        lastSelectedId.current = folder.id
        return
      }
      const [from, to] = start < end ? [start, end] : [end, start]
      setSelectedIds(folders.slice(from, to + 1).map((item) => item.id))
      return
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedIds((current) =>
        current.includes(folder.id) ? current.filter((id) => id !== folder.id) : [...current, folder.id]
      )
      lastSelectedId.current = folder.id
      return
    }

    if (folder.type === 'directory') {
      navigate(`/dir/${folder.id}`)
      return
    }

    setSelectedIds([folder.id])
    lastSelectedId.current = folder.id
  }

  const dragItemIds = (folder: FolderRecord): string[] => {
    if (selectedIdsRef.current.includes(folder.id)) {
      return selectedIdsRef.current
    }
    setSelectedIds([folder.id])
    lastSelectedId.current = folder.id
    selectedIdsRef.current = [folder.id]
    return [folder.id]
  }

  const moveSelectedToDirectory = async (targetDirectoryId: string | null): Promise<void> => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    try {
      await window.api.folders.setOwner(ids, targetDirectoryId)
      setSelectedIds([])
      lastSelectedId.current = null
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const addApplication = async (kind: 'file' | 'folder'): Promise<void> => {
    setAddOpen(false)
    try {
      const selected = kind === 'file' ? await window.api.dialog.selectFile() : await window.api.dialog.selectFolder()
      if (!selected) return
      await window.api.folders.add({
        type: 'application',
        path: selected,
        targetKind: kind
      })
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const startAddOnDiskDirectory = async (): Promise<void> => {
    setAddDirOpen(false)
    try {
      const selected = await window.api.dialog.selectFolder()
      if (!selected) return
      const children = await window.api.folders.listDirectoryChildren(selected)
      setPendingDirectory({
        mode: 'create',
        path: selected,
        children,
        filterMode: 'allowlist',
        filterEntries: []
      })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const createVirtualDirectory = async (name: string): Promise<void> => {
    setNameDialogOpen(false)
    try {
      const created = await window.api.folders.add({
        type: 'directory',
        virtual: true,
        name,
        directoryOwner: directoryId
      })
      navigate(`/dir/${created.id}`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const startLinkDirectory = async (folder: FolderRecord): Promise<void> => {
    try {
      const selected = await window.api.dialog.selectFolder()
      if (!selected) return
      const children = await window.api.folders.listDirectoryChildren(selected)
      setPendingDirectory({
        mode: 'link',
        path: selected,
        folderId: folder.id,
        children,
        filterMode: 'allowlist',
        filterEntries: []
      })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const unlinkDirectory = async (folder: FolderRecord): Promise<void> => {
    const confirmed = window.confirm(
      `Unlink “${folder.name}” from the folder on disk? Owned applications stay in this directory.`
    )
    if (!confirmed) return
    try {
      await window.api.folders.unlinkPath(folder.id)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const swapFolder = async (folder: FolderRecord): Promise<void> => {
    if (folder.targetKind !== 'folder' || folder.virtual) return
    try {
      if (folder.type === 'directory') {
        await window.api.folders.setType(folder.id, { type: 'application' })
        if (directoryId === folder.id) {
          const parent = await window.api.folders.getParent(folder.id)
          navigate(parent ? `/dir/${parent.id}` : '/')
        }
        await load()
        return
      }

      const children = await window.api.folders.listDirectoryChildren(folder.path)
      setPendingDirectory({
        mode: 'swap',
        path: folder.path,
        folderId: folder.id,
        children,
        filterMode: 'allowlist',
        filterEntries: []
      })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const openContextMenu = (event: MouseEvent, folder: FolderRecord): void => {
    event.preventDefault()
    if (!selectedIdsRef.current.includes(folder.id)) {
      setSelectedIds([folder.id])
      lastSelectedId.current = folder.id
      selectedIdsRef.current = [folder.id]
    }
    setContextMenu({ x: event.clientX, y: event.clientY, folder })
  }

  const openBulkTagEditor = (): void => {
    setBulkTagIds([...selectedIdsRef.current])
  }

  const openEditTags = (folder: FolderRecord): void => {
    setEditTagsFolder(folder)
  }

  const saveEditTags = async (tags: string[]): Promise<void> => {
    if (!editTagsFolder) return
    setEditTagsBusy(true)
    try {
      await window.api.folders.update(editTagsFolder.id, { tags })
      setEditTagsFolder(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setEditTagsBusy(false)
    }
  }

  const closeBulkTagEditor = (): void => {
    setBulkTagIds([])
    setBulkTagsBusy(false)
  }

  const selectedForBulk = folders.filter((folder) => bulkTagIds.includes(folder.id))

  const addTagsToSelected = async (tags: string[]): Promise<void> => {
    const nextTags = tags.map((tag) => tag.trim()).filter(Boolean)
    if (nextTags.length === 0 || bulkTagIds.length === 0) return
    setBulkTagsBusy(true)
    try {
      for (const id of bulkTagIds) {
        const current = folders.find((folder) => folder.id === id) ?? (await window.api.folders.get(id))
        if (!current) continue
        const merged = [...current.tags]
        for (const tag of nextTags) {
          if (!merged.some((item) => item.toLowerCase() === tag.toLowerCase())) {
            merged.push(tag)
          }
        }
        await window.api.folders.update(id, { tags: merged })
      }
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBulkTagsBusy(false)
    }
  }

  const removeTagsFromSelected = async (tags: string[]): Promise<void> => {
    const remove = new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
    if (remove.size === 0 || bulkTagIds.length === 0) return
    setBulkTagsBusy(true)
    try {
      for (const id of bulkTagIds) {
        const current = folders.find((folder) => folder.id === id) ?? (await window.api.folders.get(id))
        if (!current) continue
        await window.api.folders.update(id, {
          tags: current.tags.filter((tag) => !remove.has(tag.toLowerCase()))
        })
      }
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBulkTagsBusy(false)
    }
  }

  const revealInExplorer = async (folder: FolderRecord): Promise<void> => {
    try {
      await window.api.folders.revealInExplorer(folder.id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const openApplicationInExplorer = (folder: FolderRecord): void => {
    if (folder.type !== 'application') return
    void revealInExplorer(folder)
  }

  const deleteCatalogItem = async (folder: FolderRecord): Promise<void> => {
    const confirmed = window.confirm(
      folder.type === 'directory'
        ? `Remove “${folder.name}” from the catalog? The folder on disk will not be deleted.`
        : `Remove “${folder.name}” from the catalog? The file or folder on disk will not be deleted.`
    )
    if (!confirmed) return
    try {
      const parent = folder.type === 'directory' ? await window.api.folders.getParent(folder.id) : null
      await window.api.folders.remove(folder.id)
      setSelectedIds((current) => current.filter((id) => id !== folder.id))
      if (directoryId === folder.id) {
        navigate(parent ? `/dir/${parent.id}` : '/')
      }
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const deleteSelectedApplications = async (): Promise<void> => {
    const ids = selectedIdsRef.current.filter((id) =>
      folders.some((folder) => folder.id === id && folder.type === 'application')
    )
    if (ids.length === 0) return
    const confirmed = window.confirm(
      ids.length === 1
        ? 'Remove this application from the catalog? The file or folder on disk will not be deleted.'
        : `Remove ${ids.length} applications from the catalog? Files and folders on disk will not be deleted.`
    )
    if (!confirmed) return
    try {
      for (const id of ids) {
        await window.api.folders.remove(id)
      }
      setSelectedIds([])
      lastSelectedId.current = null
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const confirmDirectory = async (mode: FilterMode, entries: string[]): Promise<void> => {
    if (!pendingDirectory) return
    try {
      if (pendingDirectory.mode === 'create') {
        const created = await window.api.folders.add({
          type: 'directory',
          path: pendingDirectory.path,
          targetKind: 'folder',
          filterMode: mode,
          filterEntries: entries,
          directoryOwner: directoryId
        })
        navigate(`/dir/${created.id}`)
      } else if (pendingDirectory.mode === 'link' && pendingDirectory.folderId) {
        await window.api.folders.linkPath(
          pendingDirectory.folderId,
          pendingDirectory.path,
          mode,
          entries
        )
        navigate(`/dir/${pendingDirectory.folderId}`)
      } else if (pendingDirectory.folderId) {
        await window.api.folders.setType(pendingDirectory.folderId, {
          type: 'directory',
          filterMode: mode,
          filterEntries: entries
        })
        navigate(`/dir/${pendingDirectory.folderId}`)
      }
      setPendingDirectory(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const multiSelected =
    selectedIds.length > 1 && selectedIds.includes(contextMenu?.folder.id ?? '')
  const tagMenuItem = multiSelected
    ? [{ label: 'Bulk Edit Tags', onSelect: openBulkTagEditor }]
    : contextMenu
      ? [{ label: 'Edit Tags', onSelect: () => openEditTags(contextMenu.folder) }]
      : []

  const contextItems = contextMenu
    ? contextMenu.folder.type === 'directory'
      ? [
          { label: 'Open', onSelect: () => navigate(`/dir/${contextMenu.folder.id}`) },
          { label: 'Edit details', onSelect: () => navigate(`/folder/${contextMenu.folder.id}`) },
          ...tagMenuItem,
          ...(contextMenu.folder.virtual
            ? []
            : [
                {
                  label: 'Open in Explorer',
                  onSelect: () => void revealInExplorer(contextMenu.folder)
                }
              ]),
          contextMenu.folder.virtual
            ? { label: 'Link to folder', onSelect: () => void startLinkDirectory(contextMenu.folder) }
            : { label: 'Unlink from disk', onSelect: () => void unlinkDirectory(contextMenu.folder) },
          {
            label: 'Delete',
            danger: true,
            onSelect: () => void deleteCatalogItem(contextMenu.folder)
          }
        ]
      : [
          { label: 'Edit', onSelect: () => navigate(`/folder/${contextMenu.folder.id}`) },
          ...tagMenuItem,
          {
            label: 'Open in Explorer',
            onSelect: () => void revealInExplorer(contextMenu.folder)
          },
          {
            label: 'Delete',
            danger: true,
            onSelect: () => void deleteSelectedApplications()
          }
        ]
    : []

  return (
    <div className="flex h-full">
      <DirectoryTree
        nodes={tree}
        selectedId={directoryId}
        onDragItems={dragItemIds}
        onDropOnDirectory={(id) => void moveSelectedToDirectory(id)}
        onContextMenu={openContextMenu}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-zinc-50">
                {currentDirectory ? currentDirectory.name : 'Directories'}
              </h1>
              <nav className="mt-1 flex flex-wrap items-center gap-1 text-sm text-zinc-500">
                <Link to="/" className="hover:text-amber-300">
                  Home
                </Link>
                {breadcrumb.map((crumb) => (
                  <span key={crumb.id} className="flex items-center gap-1">
                    <span className="text-zinc-600">/</span>
                    <Link to={`/dir/${crumb.id}`} className="hover:text-amber-300">
                      {crumb.name}
                    </Link>
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {currentDirectory ? (
                <button
                  type="button"
                  onClick={() => navigate(`/folder/${currentDirectory.id}`)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  Edit directory
                </button>
              ) : null}
              <div ref={addMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAddOpen((open) => !open)}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
                >
                  Add application
                </button>
                {addOpen ? (
                  <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800"
                      onClick={() => void addApplication('file')}
                    >
                      File
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800"
                      onClick={() => void addApplication('folder')}
                    >
                      Folder
                    </button>
                  </div>
                ) : null}
              </div>
              <div ref={addDirMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAddDirOpen((open) => !open)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  Add directory
                </button>
                {addDirOpen ? (
                  <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800"
                      onClick={() => void startAddOnDiskDirectory()}
                    >
                      On-disk folder
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800"
                      onClick={() => {
                        setAddDirOpen(false)
                        setNameDialogOpen(true)
                      }}
                    >
                      In-app directory
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-6 py-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          <TagInput value={tags} onChange={setTags} placeholder="Filter by tag" />
          <div className="ml-auto inline-flex rounded-lg border border-zinc-700 p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${
                view === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
              }`}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${
                view === 'table' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
              }`}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {view === 'table' ? (
            <FolderTable
              folders={folders}
              selectedIds={selectedIds}
              onItemClick={selectItems}
              onItemDoubleClick={openApplicationInExplorer}
              onDetails={(id) => navigate(`/folder/${id}`)}
              onSwap={(folder) => void swapFolder(folder)}
              onContextMenu={openContextMenu}
              onDragItems={dragItemIds}
              onDropOnDirectory={(id) => void moveSelectedToDirectory(id)}
            />
          ) : (
            <FolderGrid
              folders={folders}
              selectedIds={selectedIds}
              onItemClick={selectItems}
              onItemDoubleClick={openApplicationInExplorer}
              onContextMenu={openContextMenu}
              onDragItems={dragItemIds}
              onDropOnDirectory={(id) => void moveSelectedToDirectory(id)}
            />
          )}
        </main>
      </div>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={contextItems}
        />
      ) : null}

      <DirectoryFilterDialog
        open={Boolean(pendingDirectory)}
        path={pendingDirectory?.path ?? ''}
        entries={pendingDirectory?.children ?? []}
        initialMode={pendingDirectory?.filterMode}
        initialSelected={pendingDirectory?.filterEntries}
        title={
          pendingDirectory?.mode === 'link'
            ? 'Link to on-disk folder'
            : pendingDirectory?.mode === 'swap'
              ? 'Convert to watched directory'
              : 'Customize directory tracking'
        }
        confirmLabel={
          pendingDirectory?.mode === 'link'
            ? 'Link folder'
            : pendingDirectory?.mode === 'swap'
              ? 'Convert'
              : 'Save directory'
        }
        onCancel={() => setPendingDirectory(null)}
        onConfirm={(mode, entries) => void confirmDirectory(mode, entries)}
      />

      <NameDialog
        open={nameDialogOpen}
        title="New in-app directory"
        confirmLabel="Create"
        initialValue="New directory"
        onCancel={() => setNameDialogOpen(false)}
        onConfirm={(name) => void createVirtualDirectory(name)}
      />

      <EditTagsDialog
        open={Boolean(editTagsFolder)}
        name={editTagsFolder?.name ?? ''}
        tags={editTagsFolder?.tags ?? []}
        busy={editTagsBusy}
        onClose={() => {
          setEditTagsFolder(null)
          setEditTagsBusy(false)
        }}
        onSave={saveEditTags}
      />

      <BulkTagDialog
        open={bulkTagIds.length > 1}
        items={selectedForBulk}
        busy={bulkTagsBusy}
        onClose={closeBulkTagEditor}
        onAddToAll={addTagsToSelected}
        onRemoveFromAll={removeTagsFromSelected}
      />
    </div>
  )
}
