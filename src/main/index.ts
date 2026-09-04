import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { initDatabase } from './db/database'
import { registerIpc } from './ipc'
import { getImagePath } from './library/paths'
import { reconcileLibrary } from './library/store'
import { startScanner, stopScanner } from './scanner/scanner'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'catalog',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Folder Catalog',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.foldercatalog.app')

  protocol.handle('catalog', (request) => {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const folderId = parts[0]
    const filename = decodeURIComponent(parts.slice(1).join('/'))
    if (!folderId || !filename) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(getImagePath(folderId, filename)).href)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  reconcileLibrary()
  registerIpc()
  startScanner()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopScanner()
})
