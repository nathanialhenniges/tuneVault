import type { TuneVaultApi } from '../../../preload'

declare global {
  interface Window {
    api: TuneVaultApi
  }
}

export const api = window.api
