import type { CatalogAPI } from '@shared/types'

declare global {
  interface Window {
    api: CatalogAPI
  }
}

export {}
