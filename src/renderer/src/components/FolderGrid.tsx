import { useEffect, useState, type DragEvent, type JSX, type MouseEvent } from 'react'
import type { FolderRecord } from '@shared/types'
import { canDropOnDirectory, clearCatalogDrag, isCatalogDrag, setCatalogDragData } from '../lib/dnd'
import { imageUrl } from '../lib/images'
import FolderIcon from './FolderIcon'
import MissingBadge from './MissingBadge'

interface FolderGridProps {
  folders: FolderRecord[]
  selectedIds: string[]
  onItemClick: (folder: FolderRecord, event: MouseEvent) => void
  onItemDoubleClick?: (folder: FolderRecord) => void
  onContextMenu?: (event: MouseEvent, folder: FolderRecord) => void
  onDragItems: (folder: FolderRecord) => string[]
  onDropOnDirectory: (directoryId: string) => void
}

function FolderCard({
  folder,
  selected,
  onItemClick,
  onItemDoubleClick,
  onContextMenu,
  onDragItems,
  onDropOnDirectory
}: {
  folder: FolderRecord
  selected: boolean
  onItemClick: (folder: FolderRecord, event: MouseEvent) => void
  onItemDoubleClick?: (folder: FolderRecord) => void
  onContextMenu?: (event: MouseEvent, folder: FolderRecord) => void
  onDragItems: (folder: FolderRecord) => string[]
  onDropOnDirectory: (directoryId: string) => void
}): JSX.Element {
  const [hovering, setHovering] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [index, setIndex] = useState(0)
  const images = folder.images

  useEffect(() => {
    if (!hovering || images.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [hovering, images.length])

  useEffect(() => {
    if (!hovering) setIndex(0)
  }, [hovering])

  const current = images[index]
  const isDirectory = folder.type === 'directory'

  const onDragOver = (event: DragEvent): void => {
    if (!isDirectory || !isCatalogDrag(event) || !canDropOnDirectory(folder.id)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropActive(true)
  }

  return (
    <button
      type="button"
      draggable
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
      onDragOver={onDragOver}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => {
        if (!isDirectory || !canDropOnDirectory(folder.id)) return
        event.preventDefault()
        setDropActive(false)
        onDropOnDirectory(folder.id)
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`overflow-hidden rounded-xl text-left transition hover:-translate-y-0.5 ${
        isDirectory ? 'border-2' : 'border'
      } ${dragging ? 'opacity-50' : ''} ${
        dropActive
          ? 'border-amber-400 bg-amber-500/10'
          : selected
            ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/70'
            : folder.existsOnDisk
              ? isDirectory
                ? 'border-zinc-500 bg-zinc-900 hover:border-amber-500/60'
                : 'border-zinc-800 bg-zinc-900 hover:border-amber-500/60'
              : 'border-red-900 bg-red-950/30'
      }`}
    >
      <div className="relative aspect-[16/10] bg-zinc-800">
        {current ? (
          <img
            src={imageUrl(folder.id, current.filename)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            {isDirectory ? (folder.virtual ? 'In-app' : 'Directory') : folder.targetKind === 'file' ? 'File' : 'Application'}
          </div>
        )}
        {isDirectory ? (
          <span className="absolute left-2 top-2 flex items-center gap-1">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/90 text-zinc-950 shadow-md">
              <FolderIcon className="size-4" />
            </span>
            {folder.virtual ? (
              <span className="rounded-md bg-zinc-950/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-200">
                In-app
              </span>
            ) : null}
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-200">
            {folder.targetKind}
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-medium text-zinc-100">{folder.name}</h3>
          {folder.virtual || folder.existsOnDisk ? null : <MissingBadge />}
        </div>
        <div className="flex flex-wrap gap-1">
          {folder.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}

export default function FolderGrid({
  folders,
  selectedIds,
  onItemClick,
  onItemDoubleClick,
  onContextMenu,
  onDragItems,
  onDropOnDirectory
}: FolderGridProps): JSX.Element {
  if (folders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-500">
        No matching items yet.
      </div>
    )
  }

  const selected = new Set(selectedIds)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          selected={selected.has(folder.id)}
          onItemClick={onItemClick}
          onItemDoubleClick={onItemDoubleClick}
          onContextMenu={onContextMenu}
          onDragItems={onDragItems}
          onDropOnDirectory={onDropOnDirectory}
        />
      ))}
    </div>
  )
}
