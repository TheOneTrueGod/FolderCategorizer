import { useEffect, useMemo, useState, type JSX } from 'react'
import type { DirectoryChild, FilterMode } from '@shared/types'

interface DirectoryFilterDialogProps {
  open: boolean
  path: string
  entries: DirectoryChild[]
  initialMode?: FilterMode
  initialSelected?: string[]
  title?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: (mode: FilterMode, entries: string[]) => void
}

export default function DirectoryFilterDialog({
  open,
  path,
  entries,
  initialMode = 'allowlist',
  initialSelected = [],
  title = 'Customize directory tracking',
  confirmLabel = 'Save directory',
  onCancel,
  onConfirm
}: DirectoryFilterDialogProps): JSX.Element | null {
  const [mode, setMode] = useState<FilterMode>(initialMode)
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setSelected(initialSelected)
      setQuery('')
    }
  }, [open, initialMode, initialSelected])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((child) => child.name.toLowerCase().includes(needle))
  }, [entries, query])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  if (!open) return null

  const toggle = (name: string): void => {
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    )
  }

  const selectByKind = (kind?: DirectoryChild['kind']): void => {
    const names = entries.filter((child) => !kind || child.kind === kind).map((child) => child.name)
    setSelected((current) => Array.from(new Set([...current, ...names])))
  }

  const selectVisible = (): void => {
    setSelected((current) => Array.from(new Set([...current, ...visible.map((child) => child.name)])))
  }

  const clearVisible = (): void => {
    const visibleNames = new Set(visible.map((child) => child.name))
    setSelected((current) => current.filter((name) => !visibleNames.has(name)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
          <p className="mt-1 truncate text-sm text-zinc-400" title={path}>
            {path}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="inline-flex rounded-lg border border-zinc-700 p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${
                mode === 'denylist' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-300 hover:text-white'
              }`}
              onClick={() => setMode('denylist')}
            >
              Denylist
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${
                mode === 'allowlist' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-300 hover:text-white'
              }`}
              onClick={() => setMode('allowlist')}
            >
              Allowlist
            </button>
          </div>
          <p className="text-sm text-zinc-400">
            {mode === 'denylist'
              ? 'Everything is tracked except the items you select.'
              : 'Only the items you select are tracked.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 px-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files and folders"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-white"
              onClick={() => selectByKind()}
            >
              Select all
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-white"
              onClick={() => selectByKind('folder')}
            >
              Select all folders
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-white"
              onClick={() => selectByKind('file')}
            >
              Select all files
            </button>
            <button type="button" className="text-sm text-zinc-400 hover:text-white" onClick={selectVisible}>
              Select visible
            </button>
            <button type="button" className="text-sm text-zinc-400 hover:text-white" onClick={clearVisible}>
              Clear visible
            </button>
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-auto px-5">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No files or folders in this directory.</p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {visible.map((child) => (
                <li key={child.name}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-zinc-800/70">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(child.name)}
                      onChange={() => toggle(child.name)}
                      className="size-4 accent-amber-500"
                    />
                    <span className="w-16 text-xs uppercase tracking-wide text-zinc-500">
                      {child.kind}
                    </span>
                    <span className="truncate text-sm text-zinc-100">{child.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-5 py-4">
          <p className="text-xs text-zinc-500">{selected.length} selected</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(mode, selected)}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
