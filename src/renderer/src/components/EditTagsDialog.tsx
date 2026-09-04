import { useEffect, useState, type JSX, type MouseEvent } from 'react'
import TagInput from './TagInput'

interface EditTagsDialogProps {
  open: boolean
  name: string
  tags: string[]
  busy?: boolean
  onClose: () => void
  onSave: (tags: string[]) => Promise<void>
}

export default function EditTagsDialog({
  open,
  name,
  tags,
  busy = false,
  onClose,
  onSave
}: EditTagsDialogProps): JSX.Element | null {
  const [draft, setDraft] = useState<string[]>(tags)

  useEffect(() => {
    if (open) setDraft(tags)
  }, [open, tags])

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
            <h2 className="text-lg font-semibold text-zinc-50">Edit Tags</h2>
            <p className="mt-1 truncate text-sm text-zinc-500">{name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Tags</span>
          <TagInput value={draft} onChange={setDraft} allowCreate placeholder="Add a tag" />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void onSave(draft)
            }}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
