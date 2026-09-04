import type { JSX } from 'react'

export default function MissingBadge(): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">
      Missing on disk
    </span>
  )
}
