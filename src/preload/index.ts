import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import type { AppSettings, DownloadRequest, DownloadProgress, LibraryData, Playlist } from '../shared/models'

const appVersion: string = (() => {
  try {
    return require('../../package.json').version
  } catch {
    return 'unknown'
  }
})()

const api = {
  getVersion: (): string => appVersion,

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

  // Library
  getLibrary: (): Promise<LibraryData> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET),
  getTrackPath: (trackId: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET_TRACK_PATH, trackId),
  verifyLibrary: (): Promise<LibraryData> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_VERIFY),
  deleteTracks: (trackIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DELETE_TRACKS, trackIds),
  deleteAllLibrary: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DELETE_ALL),
  openFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_OPEN_FOLDER, filePath),
  getPlaylistInfoPath: (playlistId: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET_PLAYLIST_INFO_PATH, playlistId),
  readPlaylistInfo: (playlistId: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_READ_PLAYLIST_INFO, playlistId),

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
