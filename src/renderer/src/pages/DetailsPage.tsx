import { useEffect, useState, type DragEvent, type JSX } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { DirectoryChild, FilterMode, FolderRecord } from '@shared/types'
import DirectoryFilterDialog from '../components/DirectoryFilterDialog'
import MissingBadge from '../components/MissingBadge'
import TagInput from '../components/TagInput'
import { errorMessage, imageUrl } from '../lib/images'

interface Draft {
  name: string
  description: string
  tags: string[]
  filterMode: FilterMode
  filterEntries: string[]
}

function toDraft(folder: FolderRecord): Draft {
  return {
    name: folder.name,
    description: folder.description,
    tags: folder.tags,
    filterMode: folder.filterMode ?? 'allowlist',
    filterEntries: folder.filterEntries
  }
}

export default function DetailsPage(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [folder, setFolder] = useState<FolderRecord | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [linkPath, setLinkPath] = useState<string | null>(null)
  const [children, setChildren] = useState<DirectoryChild[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [parentDirectory, setParentDirectory] = useState<FolderRecord | null>(null)

  const load = async (folderId: string): Promise<void> => {
    try {
      const record = await window.api.folders.get(folderId)
      if (!record) {
        setError('This item no longer exists in the catalog.')
        setFolder(null)
        return
      }
      setFolder(record)
      setDraft(toDraft(record))
      setParentDirectory(await window.api.folders.getParent(folderId))
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    if (id) void load(id)
  }, [id])

  useEffect(() => {
    return window.api.scanner.onUpdated(() => {
      if (id) void load(id)
    })
  }, [id])

  const save = async (): Promise<void> => {
    if (!folder || !draft) return
    try {
      const updated = await window.api.folders.update(folder.id, {
        name: draft.name,
        description: draft.description,
        tags: draft.tags,
        filterMode: folder.type === 'directory' ? draft.filterMode : undefined,
        filterEntries: folder.type === 'directory' ? draft.filterEntries : undefined
      })
      setFolder(updated)
      setDraft(toDraft(updated))
      setEditing(false)
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const addImages = async (paths: string[]): Promise<void> => {
    if (!folder || paths.length === 0) return
    try {
      const updated = await window.api.folders.addImages(folder.id, paths)
      setFolder(updated)
      setDraft(toDraft(updated))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const pickImages = async (): Promise<void> => {
    const paths = await window.api.dialog.selectImages()
    await addImages(paths)
  }

  const onDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault()
    setDragOver(false)
    const files = Array.from(event.dataTransfer.files)
    const paths = files.map((file) => window.api.files.pathForDroppedFile(file)).filter(Boolean)
    await addImages(paths)
  }

  const removeImage = async (imageId: string): Promise<void> => {
    if (!folder) return
    try {
      const updated = await window.api.folders.removeImage(folder.id, imageId)
      setFolder(updated)
      setDraft(toDraft(updated))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const openFilterEditor = async (): Promise<void> => {
    if (!folder || folder.virtual) return
    try {
      const listed = await window.api.folders.listDirectoryChildren(folder.path)
      setChildren(listed)
      setLinkPath(null)
      setFilterOpen(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const startLink = async (): Promise<void> => {
    if (!folder) return
    try {
      const selected = await window.api.dialog.selectFolder()
      if (!selected) return
      const listed = await window.api.folders.listDirectoryChildren(selected)
      setChildren(listed)
      setLinkPath(selected)
      setFilterOpen(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const unlink = async (): Promise<void> => {
    if (!folder) return
    const confirmed = window.confirm(
      `Unlink “${folder.name}” from the folder on disk? Owned applications stay in this directory.`
    )
    if (!confirmed) return
    try {
      const updated = await window.api.folders.unlinkPath(folder.id)
      setFolder(updated)
      setDraft(toDraft(updated))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const swapType = async (): Promise<void> => {
    if (!folder || folder.targetKind !== 'folder' || folder.virtual) return
    try {
      if (folder.type === 'directory') {
        const updated = await window.api.folders.setType(folder.id, { type: 'application' })
        setFolder(updated)
        setDraft(toDraft(updated))
        return
      }
      await openFilterEditor()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const confirmFilter = async (mode: FilterMode, entries: string[]): Promise<void> => {
    if (!folder) return
    try {
      if (linkPath) {
        const updated = await window.api.folders.linkPath(folder.id, linkPath, mode, entries)
        setFolder(updated)
        setDraft(toDraft(updated))
        setLinkPath(null)
        setFilterOpen(false)
        return
      }
      if (folder.type === 'application') {
        const updated = await window.api.folders.setType(folder.id, {
          type: 'directory',
          filterMode: mode,
          filterEntries: entries
        })
        setFolder(updated)
        setDraft(toDraft(updated))
      } else if (draft) {
        const nextDraft = { ...draft, filterMode: mode, filterEntries: entries }
        setDraft(nextDraft)
        if (!editing) {
          const updated = await window.api.folders.update(folder.id, {
            filterMode: mode,
            filterEntries: entries
          })
          setFolder(updated)
          setDraft(toDraft(updated))
        }
      }
      setFilterOpen(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!folder || !draft) {
    return (
      <div className="p-6">
        <Link
          to={parentDirectory ? `/dir/${parentDirectory.id}` : '/'}
          className="text-sm text-amber-300 hover:text-amber-200"
        >
          Back to listing
        </Link>
        <p className="mt-6 text-sm text-zinc-400">{error ?? 'Loading…'}</p>
      </div>
    )
  }

  const display = editing ? draft : { ...draft, name: folder.name, description: folder.description, tags: folder.tags }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-6 py-4">
        <div>
          <Link
            to={parentDirectory ? `/dir/${parentDirectory.id}` : '/'}
            className="text-sm text-amber-300 hover:text-amber-200"
          >
            Back to listing
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-50">{folder.name}</h1>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-300">
              {folder.type}
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-300">
              {folder.virtual ? 'in-app' : folder.targetKind}
            </span>
            {folder.virtual || folder.existsOnDisk ? null : <MissingBadge />}
          </div>
        </div>
        <div className="flex gap-2">
          {folder.type === 'directory' ? (
            <button
              type="button"
              onClick={() => navigate(`/dir/${folder.id}`)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
            >
              Browse contents
            </button>
          ) : null}
          {folder.targetKind === 'folder' && !folder.virtual ? (
            <button
              type="button"
              onClick={() => void swapType()}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
            >
              {folder.type === 'application' ? 'Convert to directory' : 'Convert to application'}
            </button>
          ) : null}
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(toDraft(folder))
                  setEditing(false)
                }}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
              >
                Save
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              Edit
            </button>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-6 py-5">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <div className="space-y-5">
            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Name</span>
              {editing ? (
                <input
                  value={display.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              ) : (
                <p className="text-zinc-100">{folder.name}</p>
              )}
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Description</span>
              {editing ? (
                <textarea
                  value={display.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  rows={5}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              ) : (
                <p className="whitespace-pre-wrap text-zinc-300">
                  {folder.description || 'No description yet.'}
                </p>
              )}
            </label>

            <div className="space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Tags</span>
              {editing ? (
                <TagInput
                  value={display.tags}
                  onChange={(next) => setDraft({ ...draft, tags: next })}
                  allowCreate
                  placeholder="Add a tag"
                />
              ) : folder.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {folder.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No tags yet.</p>
              )}
            </div>
          </div>

          <aside className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Path</p>
              <p className="mt-1 break-all text-sm text-zinc-200">
                {folder.virtual ? 'Not linked to a folder on disk' : folder.path}
              </p>
              {folder.type === 'directory' ? (
                <button
                  type="button"
                  onClick={() => void (folder.virtual ? startLink() : unlink())}
                  className="mt-2 text-sm text-amber-300 hover:text-amber-200"
                >
                  {folder.virtual ? 'Link to folder on disk' : 'Unlink from disk'}
                </button>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">On disk</p>
              <p className="mt-1 text-sm text-zinc-200">
                {folder.virtual ? 'In-app only' : folder.existsOnDisk ? 'Yes' : 'No'}
              </p>
            </div>
            {folder.type === 'directory' && !folder.virtual ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tracking rules</p>
                <p className="text-sm capitalize text-zinc-200">{draft.filterMode}</p>
                <p className="text-sm text-zinc-400">
                  {draft.filterEntries.length === 0
                    ? draft.filterMode === 'denylist'
                      ? 'Tracking every immediate child.'
                      : 'No children selected yet.'
                    : draft.filterEntries.join(', ')}
                </p>
                <button
                  type="button"
                  onClick={() => void openFilterEditor()}
                  className="text-sm text-amber-300 hover:text-amber-200"
                >
                  {editing ? 'Edit tracking list' : 'Review tracking list'}
                </button>
              </div>
            ) : null}
          </aside>
        </section>

        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-100">Images</h2>
            {editing ? (
              <button
                type="button"
                onClick={() => void pickImages()}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                Add images
              </button>
            ) : null}
          </div>

          <div
            onDragOver={(event) => {
              if (!editing) return
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              if (editing) void onDrop(event)
            }}
            className={`grid grid-cols-2 gap-3 rounded-xl border p-3 md:grid-cols-3 xl:grid-cols-4 ${
              dragOver ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800'
            }`}
          >
            {folder.images.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-zinc-500">
                {editing ? 'Drop images here or use Add images.' : 'No images attached.'}
              </p>
            ) : (
              folder.images.map((image) => (
                <div key={image.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                  <img
                    src={imageUrl(folder.id, image.filename)}
                    alt=""
                    className="aspect-[16/10] w-full object-cover"
                  />
                  {editing ? (
                    <button
                      type="button"
                      onClick={() => void removeImage(image.id)}
                      className="w-full px-2 py-1.5 text-xs text-red-300 hover:bg-red-950/40"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <DirectoryFilterDialog
        open={filterOpen}
        path={linkPath ?? folder.path}
        entries={children}
        initialMode={draft.filterMode}
        initialSelected={draft.filterEntries}
        title={
          linkPath
            ? 'Link to on-disk folder'
            : folder.type === 'application'
              ? 'Convert to watched directory'
              : 'Edit directory tracking'
        }
        confirmLabel={linkPath ? 'Link folder' : folder.type === 'application' ? 'Convert' : 'Update rules'}
        onCancel={() => {
          setFilterOpen(false)
          setLinkPath(null)
        }}
        onConfirm={(mode, entries) => void confirmFilter(mode, entries)}
      />
    </div>
  )
}
