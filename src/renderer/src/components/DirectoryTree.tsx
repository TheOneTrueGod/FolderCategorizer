import { useState, type DragEvent, type JSX, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DirectoryTreeNode, FolderRecord } from '@shared/types'
import {
  canDropOnDirectory,
  clearCatalogDrag,
  getActiveDragIds,
  isCatalogDrag,
  setCatalogDragData
} from '../lib/dnd'
import FolderIcon from './FolderIcon'

interface DirectoryTreeProps {
  nodes: DirectoryTreeNode[]
  selectedKey: 'all' | 'home' | string
  onDragItems: (folder: FolderRecord) => string[]
  onDropOnDirectory: (directoryId: string | null) => void
  onContextMenu?: (event: MouseEvent, folder: FolderRecord) => void
}

function collectDescendantIds(node: DirectoryTreeNode): string[] {
  return [node.folder.id, ...node.children.flatMap(collectDescendantIds)]
}

function blockedDropIds(nodes: DirectoryTreeNode[], dragIds: string[]): Set<string> {
  const dragged = new Set(dragIds)
  const blocked = new Set<string>()
  const visit = (node: DirectoryTreeNode): void => {
    if (dragged.has(node.folder.id)) {
      for (const id of collectDescendantIds(node)) blocked.add(id)
      return
    }
    for (const child of node.children) visit(child)
  }
  for (const node of nodes) visit(node)
  return blocked
}

function TreeGuides({
  ancestors,
  isLast
}: {
  ancestors: boolean[]
  isLast: boolean
}): JSX.Element {
  return (
    <span className="flex shrink-0 self-stretch" aria-hidden>
      {ancestors.map((continues, index) => (
        <span key={index} className="relative w-6">
          {continues ? (
            <span className="absolute inset-y-0 left-1/2 border-l border-dotted border-zinc-600" />
          ) : null}
        </span>
      ))}
      <span className="relative w-6">
        <span
          className={`absolute left-1/2 border-l border-dotted border-zinc-600 ${
            isLast ? 'top-0 h-1/2' : 'inset-y-0'
          }`}
        />
        <span className="absolute top-1/2 left-1/2 w-1/2 border-t border-dotted border-zinc-600" />
      </span>
    </span>
  )
}

function TreeNodes({
  nodes,
  roots,
  selectedKey,
  ancestors,
  dropId,
  dragging,
  onDragItems,
  onDropOnDirectory,
  onContextMenu,
  setDropId,
  setDragging
}: {
  nodes: DirectoryTreeNode[]
  roots: DirectoryTreeNode[]
  selectedKey: 'all' | 'home' | string
  ancestors: boolean[]
  dropId: string | null
  dragging: boolean
  onDragItems: (folder: FolderRecord) => string[]
  onDropOnDirectory: (directoryId: string | null) => void
  onContextMenu?: (event: MouseEvent, folder: FolderRecord) => void
  setDropId: (id: string | null) => void
  setDragging: (dragging: boolean) => void
}): JSX.Element {
  const navigate = useNavigate()

  const onDragOver = (event: DragEvent, id: string): void => {
    if (!isCatalogDrag(event) || !canDropOnDirectory(id)) return
    if (blockedDropIds(roots, getActiveDragIds()).has(id)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropId(id)
  }

  return (
    <ul>
      {nodes.map((node, index) => {
        const selected = node.folder.id === selectedKey
        const isLast = index === nodes.length - 1
        return (
          <li key={node.folder.id}>
            <div className="flex items-stretch px-2">
              <TreeGuides ancestors={ancestors} isLast={isLast} />
              <button
                type="button"
                draggable
                onClick={() => {
                  if (dragging) return
                  navigate(`/dir/${node.folder.id}`)
                }}
                onContextMenu={(event) => onContextMenu?.(event, node.folder)}
                title={node.folder.virtual ? `${node.folder.name} (in-app)` : node.folder.path}
                onDragStart={(event) => {
                  setDragging(true)
                  setCatalogDragData(event, onDragItems(node.folder))
                }}
                onDragEnd={() => {
                  clearCatalogDrag()
                  window.setTimeout(() => setDragging(false), 0)
                }}
                onDragOver={(event) => onDragOver(event, node.folder.id)}
                onDragLeave={() => {
                  if (dropId === node.folder.id) setDropId(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDropId(null)
                  if (!canDropOnDirectory(node.folder.id)) return
                  if (blockedDropIds(roots, getActiveDragIds()).has(node.folder.id)) return
                  onDropOnDirectory(node.folder.id)
                }}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${
                  dropId === node.folder.id
                    ? 'bg-amber-500/25 text-amber-100'
                    : selected
                      ? 'bg-amber-500/15 text-amber-100'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-300">
                  <FolderIcon className="size-3.5" />
                </span>
                <span className="truncate">{node.folder.name}</span>
              </button>
            </div>
            {node.children.length > 0 ? (
              <TreeNodes
                nodes={node.children}
                roots={roots}
                selectedKey={selectedKey}
                ancestors={[...ancestors, !isLast]}
                dropId={dropId}
                dragging={dragging}
                onDragItems={onDragItems}
                onDropOnDirectory={onDropOnDirectory}
                onContextMenu={onContextMenu}
                setDropId={setDropId}
                setDragging={setDragging}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export default function DirectoryTree({
  nodes,
  selectedKey,
  onDragItems,
  onDropOnDirectory,
  onContextMenu
}: DirectoryTreeProps): JSX.Element {
  const navigate = useNavigate()
  const [dropId, setDropId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const onHomeDragOver = (event: DragEvent): void => {
    if (!isCatalogDrag(event) || !canDropOnDirectory(null)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropId('home')
  }

  const rowClass = (active: boolean, dropActive: boolean): string =>
    `relative flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${
      dropActive
        ? 'bg-amber-500/25 text-amber-100'
        : active
          ? 'bg-amber-500/15 text-amber-100'
          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
    }`

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/80">
      <div className="border-b border-zinc-800 px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Directories</p>
      </div>
      <nav className="min-h-0 flex-1 overflow-auto py-2">
        <div className="flex items-stretch px-2">
          <button
            type="button"
            onClick={() => {
              if (dragging) return
              navigate('/')
            }}
            className={rowClass(selectedKey === 'all', false)}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
              <FolderIcon className="size-3.5" />
            </span>
            All
          </button>
        </div>
        <div className="flex items-stretch px-2">
          <button
            type="button"
            onClick={() => {
              if (dragging) return
              navigate('/home')
            }}
            onDragOver={onHomeDragOver}
            onDragLeave={() => {
              if (dropId === 'home') setDropId(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDropId(null)
              if (!canDropOnDirectory(null)) return
              onDropOnDirectory(null)
            }}
            className={rowClass(selectedKey === 'home', dropId === 'home')}
          >
            <span className="relative flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
              <FolderIcon className="size-3.5" />
              {nodes.length > 0 ? (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 h-[calc(50%+0.5rem)] border-l border-dotted border-zinc-600"
                />
              ) : null}
            </span>
            Home
          </button>
        </div>
        {nodes.length === 0 ? (
          <p className="px-4 py-4 text-xs text-zinc-500">No watched directories yet.</p>
        ) : (
          <TreeNodes
            nodes={nodes}
            roots={nodes}
            selectedKey={selectedKey}
            ancestors={[]}
            dropId={dropId}
            dragging={dragging}
            onDragItems={onDragItems}
            onDropOnDirectory={onDropOnDirectory}
            onContextMenu={onContextMenu}
            setDropId={setDropId}
            setDragging={setDragging}
          />
        )}
      </nav>
    </aside>
  )
}
