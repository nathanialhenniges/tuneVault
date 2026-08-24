/**
 * Every IPC channel name lives here and nowhere else. Main registers these,
 * preload exposes them, the renderer never sees a raw string.
 */
export const IPC = {
  // Playlist resolution
  PLAYLIST_RESOLVE: 'playlist:resolve',

  // Devices
  DEVICE_LIST: 'device:list',
  DEVICE_CREATE: 'device:create',
  DEVICE_UPDATE: 'device:update',
  DEVICE_DELETE: 'device:delete',
  DEVICE_USAGE: 'device:usage',
  DEVICE_OPEN_FOLDER: 'device:open-folder',
  DEVICE_TRACKS: 'device:tracks',
  DEVICE_DELETE_TRACKS: 'device:delete-tracks',
  DEVICE_IMPORT: 'device:import',
  DEVICE_PICK_AUDIO: 'device:pick-audio',
  DEVICE_REVEAL_TRACK: 'device:reveal-track',
  DRAG_OUT: 'device:drag-out',

  // Downloads
  DOWNLOAD_PREFLIGHT: 'download:preflight',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_DONE: 'download:done',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_PICK_FOLDER: 'settings:pick-folder'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
