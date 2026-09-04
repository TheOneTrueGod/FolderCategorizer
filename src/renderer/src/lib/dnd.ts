import type { DragEvent } from 'react'

const DRAG_PREFIX = 'catalog-ids:'
let activeDragIds: string[] = []

export function setCatalogDragData(event: DragEvent, ids: string[]): void {
  activeDragIds = ids
  event.dataTransfer.setData('text/plain', `${DRAG_PREFIX}${JSON.stringify(ids)}`)
  event.dataTransfer.effectAllowed = 'move'
}

export function getCatalogDragIds(event: DragEvent): string[] {
  const raw = event.dataTransfer.getData('text/plain')
  if (!raw.startsWith(DRAG_PREFIX)) return []
  try {
    const parsed = JSON.parse(raw.slice(DRAG_PREFIX.length)) as unknown
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function getActiveDragIds(): string[] {
  return activeDragIds
}

export function clearCatalogDrag(): void {
  activeDragIds = []
}

export function isCatalogDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('text/plain')
}

export function canDropOnDirectory(directoryId: string | null): boolean {
  const ids = new Set(activeDragIds)
  if (directoryId === null) return ids.size > 0
  return ids.size > 0 && !ids.has(directoryId)
}
