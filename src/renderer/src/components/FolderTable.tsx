import { useState, type DragEvent, type JSX, type MouseEvent } from 'react'
import type { FolderRecord } from '@shared/types'
import { canDropOnDirectory, clearCatalogDrag, isCatalogDrag, setCatalogDragData } from '../lib/dnd'
import FolderIcon from './FolderIcon'
import MissingBadge from './MissingBadge'

interface FolderTableProps {
  folders: FolderRecord[]
  selectedIds: string[]
  onItemClick: (folder: FolderRecord, event: MouseEvent) => void
  onItemDoubleClick?: (folder: FolderRecord) => void
  onDetails: (id: string) => void
  onSwap: (folder: FolderRecord) => void
  onContextMenu?: (event: MouseEvent, folder: FolderRecord) => void
  onDragItems: (folder: FolderRecord) => string[]
  onDropOnDirectory: (directoryId: string) => void
}

export default function FolderTable({
  folders,
  selectedIds,
  onItemClick,
  onItemDoubleClick,
  onDetails,
  onSwap,
  onContextMenu,
  onDragItems,
  onDropOnDirectory
}: FolderTableProps): JSX.Element {
  const [dropId, setDropId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const selected = new Set(selectedIds)

  if (folders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-500">
        No matching items yet.
      </div>
    )
  }

  const onDragOverRow = (event: DragEvent, folder: FolderRecord): void => {
    if (folder.type !== 'directory' || !isCatalogDrag(event) || !canDropOnDirectory(folder.id)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropId(folder.id)
  }

  return (
    <div className="overflow-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Kind</th>
            <th className="px-4 py-3 font-medium">Path</th>
            <th className="px-4 py-3 font-medium">Tags</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {folders.map((folder) => (
            <tr
              key={folder.id}
              draggable
              className={`${folder.virtual || folder.existsOnDisk ? '' : 'bg-red-950/20'} ${
                folder.type === 'directory' ? 'border-l-4 border-l-amber-500' : ''
              } ${
                dropId === folder.id
                  ? 'bg-amber-500/15'
                  : selected.has(folder.id)
                    ? 'bg-amber-500/10'
                    : ''
              }`}
              onClick={(event) => {
                if (dragging) {
                  setDragging(false)
                  return
                }
                onItemClick(folder, event)
              }}
              onDoubleClick={() => onItemDoubleClick?.(folder)}
              onContextMenu={(event) => onContextMenu?.(event, folder)}
              onDragStart={(event) => {
                setDragging(true)
                setCatalogDragData(event, onDragItems(folder))
              }}
              onDragEnd={() => {
                clearCatalogDrag()
                window.setTimeout(() => setDragging(false), 0)
              }}
              onDragOver={(event) => onDragOverRow(event, folder)}
              onDragLeave={() => {
                if (dropId === folder.id) setDropId(null)
              }}
              onDrop={(event) => {
                if (folder.type !== 'directory' || !canDropOnDirectory(folder.id)) return
                event.preventDefault()
                setDropId(null)
                onDropOnDirectory(folder.id)
              }}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-medium text-zinc-100">
                  {folder.type === 'directory' ? (
                    <span className="flex size-7 items-center justify-center rounded-md bg-amber-500/20 text-amber-300">
                      <FolderIcon className="size-3.5" />
                    </span>
                  ) : null}
                  {folder.name}
                </div>
              </td>
              <td className="px-4 py-3 capitalize text-zinc-400">
                {folder.type === 'directory' ? 'directory' : folder.targetKind}
              </td>
              <td
                className="max-w-xs truncate px-4 py-3 text-zinc-400"
                title={folder.virtual ? 'In-app directory' : folder.path}
              >
                {folder.virtual ? 'In-app directory' : folder.path}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {folder.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {tag}
                    </span>
                  ))}
                  {folder.tags.length > 5 ? (
                    <span className="text-xs text-zinc-500">+{folder.tags.length - 5}</span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3">
                {folder.virtual ? (
                  <span className="text-xs text-zinc-500">In-app</span>
                ) : folder.existsOnDisk ? (
                  <span className="text-xs text-zinc-500">On disk</span>
                ) : (
                  <MissingBadge />
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDetails(folder.id)
                    }}
                    className="text-xs text-amber-300 hover:text-amber-200"
                  >
                    Details
                  </button>
                  {folder.targetKind === 'folder' && !folder.virtual ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSwap(folder)
                      }}
                      className="text-xs text-zinc-300 hover:text-white"
                    >
                      {folder.type === 'application' ? 'Make directory' : 'Make application'}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
