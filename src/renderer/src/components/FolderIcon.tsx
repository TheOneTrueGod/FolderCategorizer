import type { JSX } from 'react'

export default function FolderIcon({ className = 'size-4' }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.5 6.75A2.25 2.25 0 0 1 5.75 4.5h4.13c.4 0 .78.16 1.06.44l1.12 1.12c.28.28.66.44 1.06.44h5.13A2.25 2.25 0 0 1 20.5 8.75v8.5A2.25 2.25 0 0 1 18.25 19.5H5.75A2.25 2.25 0 0 1 3.5 17.25v-10.5Z" />
    </svg>
  )
}
