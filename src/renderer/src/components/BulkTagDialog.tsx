import { useEffect, useMemo, useState, type JSX, type MouseEvent } from 'react'
import type { FolderRecord } from '@shared/types'
import TagInput from './TagInput'

interface BulkTagDialogProps {
  open: boolean
  items: FolderRecord[]
  busy?: boolean
  onClose: () => void
  onAddToAll: (tags: string[]) => Promise<void>
  onRemoveFromAll: (tags: string[]) => Promise<void>
}

function tagSummary(items: FolderRecord[]): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const item of items) {
    for (const tag of item.tags) {
      const key = tag.toLowerCase()
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { tag, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' })
  })
}

export default function BulkTagDialog({
  open,
  items,
  busy = false,
  onClose,
  onAddToAll,
  onRemoveFromAll
}: BulkTagDialogProps): JSX.Element | null {
  const [addTags, setAddTags] = useState<string[]>([])
  const [removeTags, setRemoveTags] = useState<string[]>([])
  const summary = useMemo(() => tagSummary(items), [items])

  useEffect(() => {
    if (open) {
      setAddTags([])
      setRemoveTags([])
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const onBackdrop = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]"
      onClick={onBackdrop}
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Bulk Edit Tags</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {items.length} selected {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Add to all</span>
            <div className="flex items-start gap-2">
              <TagInput value={addTags} onChange={setAddTags} allowCreate placeholder="Tags to add" />
              <button
                type="button"
                disabled={busy || addTags.length === 0}
                onClick={() => {
                  void onAddToAll(addTags).then(() => setAddTags([]))
                }}
                className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                Add to All
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Remove from all</span>
            <div className="flex items-start gap-2">
              <TagInput value={removeTags} onChange={setRemoveTags} allowCreate placeholder="Tags to remove" />
              <button
                type="button"
                disabled={busy || removeTags.length === 0}
                onClick={() => {
                  void onRemoveFromAll(removeTags).then(() => setRemoveTags([]))
                }}
                className="shrink-0 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
              >
                Remove from All
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-zinc-500">On selected items</span>
            {summary.length === 0 ? (
              <p className="text-sm text-zinc-500">None of the selected items have tags yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {summary.map((entry) => (
                  <span
                    key={entry.tag.toLowerCase()}
                    className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-200"
                  >
                    {entry.tag} ({entry.count})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
