/**
 * Every IPC channel name lives here and nowhere else. Main registers these,
 * preload exposes them, the renderer never sees a raw string.
 */
export const IPC = {
  // Playlist resolution
  PLAYLIST_RESOLVE: 'playlist:resolve',
  PLAYLIST_RESOLVE_PROGRESS: 'playlist:resolve-progress',
  MUSIC_APP_PLAYLISTS: 'music-app:playlists',

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
  DEVICE_TRACK_KEYS: 'device:track-keys',
  DEVICE_FORGET_SOURCE: 'device:forget-source',
  DRAG_OUT: 'device:drag-out',

  // Downloads
  DOWNLOAD_PREFLIGHT: 'download:preflight',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_DONE: 'download:done',
  DOWNLOAD_RUN_STATUS: 'download:run-status',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_PICK_FOLDER: 'settings:pick-folder',
  SETTINGS_PICK_COOKIES: 'settings:pick-cookies'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
