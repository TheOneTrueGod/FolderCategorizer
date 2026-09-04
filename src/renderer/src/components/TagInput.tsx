import { useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  allowCreate?: boolean
  placeholder?: string
}

export default function TagInput({
  value,
  onChange,
  allowCreate = false,
  placeholder = 'Filter by tag'
}: TagInputProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const handle = window.setTimeout(async () => {
      const tags = await window.api.tags.list(query)
      if (!cancelled) {
        setSuggestions(tags.filter((tag) => !value.some((selected) => selected.toLowerCase() === tag.toLowerCase())))
      }
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query, value])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const canCreate = useMemo(() => {
    const trimmed = query.trim()
    if (!allowCreate || !trimmed) return false
    const exists = value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())
    const known = suggestions.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())
    return !exists && !known
  }, [allowCreate, query, suggestions, value])

  const options = useMemo(() => {
    const items = [...suggestions]
    if (canCreate) items.unshift(query.trim())
    return items
  }, [canCreate, query, suggestions])

  const addTag = (tag: string): void => {
    const next = tag.trim()
    if (!next) return
    if (value.some((item) => item.toLowerCase() === next.toLowerCase())) return
    onChange([...value, next])
    setQuery('')
    setHighlight(0)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlight((index) => (options.length === 0 ? 0 : (index + 1) % options.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setHighlight((index) => (options.length === 0 ? 0 : (index - 1 + options.length) % options.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && options[highlight]) {
        addTag(options[highlight])
      } else if (allowCreate) {
        addTag(query)
      }
    } else if (event.key === 'Backspace' && !query && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-[16rem] flex-1">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 focus-within:border-amber-500">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200"
          >
            {tag}
            <button
              type="button"
              className="text-amber-200/70 hover:text-white"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="min-w-[8rem] flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        />
      </div>
      {open && options.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {options.map((option, index) => {
            const isCreate = canCreate && index === 0 && option.toLowerCase() === query.trim().toLowerCase()
            return (
              <li key={`${option}-${index}`}>
                <button
                  type="button"
                  className={`flex w-full px-3 py-1.5 text-left text-sm ${
                    index === highlight ? 'bg-zinc-800 text-white' : 'text-zinc-200'
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => addTag(option)}
                >
                  {isCreate ? `Create “${option}”` : option}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
