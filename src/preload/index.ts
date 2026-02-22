import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import type { AppSettings, DownloadRequest, DownloadProgress, LibraryData, Playlist } from '../shared/models'

const api = {
  // Playlist
  fetchPlaylist: (url: string): Promise<Playlist> =>
    ipcRenderer.invoke(IpcChannels.PLAYLIST_FETCH, url),

  // Download
  startDownload: (request: DownloadRequest): Promise<{ started: number }> =>
    ipcRenderer.invoke(IpcChannels.DOWNLOAD_START, request),
  cancelDownload: (trackId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.DOWNLOAD_CANCEL, trackId),
  cancelAllDownloads: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.DOWNLOAD_CANCEL_ALL),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress): void => callback(progress)
    ipcRenderer.on(IpcChannels.DOWNLOAD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.DOWNLOAD_PROGRESS, handler)
  },
  onDownloadComplete: (callback: (data: { trackId: string; filePath: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { trackId: string; filePath: string }): void => callback(data)
    ipcRenderer.on(IpcChannels.DOWNLOAD_COMPLETE, handler)
    return () => ipcRenderer.removeListener(IpcChannels.DOWNLOAD_COMPLETE, handler)
  },
  onDownloadError: (callback: (data: { trackId: string; error: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { trackId: string; error: string }): void => callback(data)
    ipcRenderer.on(IpcChannels.DOWNLOAD_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.DOWNLOAD_ERROR, handler)
  },

  // Metadata
  writeMetadata: (playlist: Playlist, outputDir: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IpcChannels.METADATA_WRITE, playlist, outputDir),

  // Library
  getLibrary: (): Promise<LibraryData> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET),
  getTrackPath: (trackId: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET_TRACK_PATH, trackId),

  // Player
  getFileUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.PLAYER_GET_FILE_URL, filePath),

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, settings),
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SELECT_DIRECTORY),

  // Updater
  checkForUpdate: (): Promise<unknown> =>
    ipcRenderer.invoke(IpcChannels.UPDATER_CHECK),
  downloadUpdate: (): Promise<unknown> =>
    ipcRenderer.invoke(IpcChannels.UPDATER_DOWNLOAD),
  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.UPDATER_INSTALL),
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown): void => callback(info)
    ipcRenderer.on(IpcChannels.UPDATER_AVAILABLE, handler)
    return () => ipcRenderer.removeListener(IpcChannels.UPDATER_AVAILABLE, handler)
  },
  onUpdateProgress: (callback: (progress: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown): void => callback(progress)
    ipcRenderer.on(IpcChannels.UPDATER_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.UPDATER_PROGRESS, handler)
  },
  onUpdateDownloaded: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IpcChannels.UPDATER_DOWNLOADED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.UPDATER_DOWNLOADED, handler)
  },

  // Tray / media key events
  onTrayTogglePlay: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('tray:toggle-play', handler)
    return () => ipcRenderer.removeListener('tray:toggle-play', handler)
  },
  onTrayNext: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('tray:next', handler)
    return () => ipcRenderer.removeListener('tray:next', handler)
  },
  onTrayPrev: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('tray:prev', handler)
    return () => ipcRenderer.removeListener('tray:prev', handler)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
