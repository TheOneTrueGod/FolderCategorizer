import { useEffect, useState, type FormEvent, type JSX } from 'react'

interface NameDialogProps {
  open: boolean
  title: string
  label?: string
  confirmLabel?: string
  initialValue?: string
  onCancel: () => void
  onConfirm: (name: string) => void
}

export default function NameDialog({
  open,
  title,
  label = 'Name',
  confirmLabel = 'Create',
  initialValue = '',
  onCancel,
  onConfirm
}: NameDialogProps): JSX.Element | null {
  const [name, setName] = useState(initialValue)

  useEffect(() => {
    if (open) setName(initialValue)
  }, [open, initialValue])

  if (!open) return null

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
        <label className="mt-4 block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
