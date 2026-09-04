import { BrowserWindow } from 'electron'
import fs from 'fs'
import {
  listAllFolderRows,
  listDirectoryRecords,
  setExistsOnDisk,
  syncDirectoryTracking
} from '../library/store'

const TICK_MS = 750
const EXISTENCE_BATCH = 8

let timer: NodeJS.Timeout | null = null
let directoryIndex = 0
let existenceIndex = 0
let running = false

function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

function notifyWindows(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('scanner:updated')
  }
}

function scanOneDirectory(): boolean {
  const directories = listDirectoryRecords()
  if (directories.length === 0) return false

  const directory = directories[directoryIndex % directories.length]
  directoryIndex += 1

  if (directory.virtual) return false

  if (!pathExists(directory.path) || !fs.statSync(directory.path).isDirectory()) {
    return setExistsOnDisk(directory.id, false)
  }

  return syncDirectoryTracking(directory.id)
}

function refreshExistenceBatch(): boolean {
  const rows = listAllFolderRows()
  if (rows.length === 0) return false

  let changed = false
  for (let i = 0; i < EXISTENCE_BATCH && i < rows.length; i += 1) {
    const row = rows[existenceIndex % rows.length]
    existenceIndex += 1
    if (!row.path || row.path.startsWith('virtual:')) continue
    const exists = pathExists(row.path)
    if (setExistsOnDisk(row.id, exists)) {
      changed = true
    }
  }
  return changed
}

function tick(): void {
  if (running) return
  running = true

  try {
    const directoryChanged = scanOneDirectory()
    const existenceChanged = refreshExistenceBatch()
    if (directoryChanged || existenceChanged) {
      notifyWindows()
    }
  } catch (error) {
    console.error('Scanner tick failed', error)
  } finally {
    running = false
    timer = setTimeout(tick, TICK_MS)
  }
}

export function startScanner(): void {
  if (timer) return
  timer = setTimeout(tick, TICK_MS)
}

export function stopScanner(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
