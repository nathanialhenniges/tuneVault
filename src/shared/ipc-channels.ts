export const IpcChannels = {
  // Playlist
  PLAYLIST_FETCH: 'playlist:fetch',
  PLAYLIST_FETCH_RESULT: 'playlist:fetch-result',

  // Download
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_CANCEL_ALL: 'download:cancel-all',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_ERROR: 'download:error',

  // Metadata
  METADATA_WRITE: 'metadata:write',

  // Library
  LIBRARY_GET: 'library:get',
  LIBRARY_GET_RESULT: 'library:get-result',
  LIBRARY_SAVE: 'library:save',
  LIBRARY_GET_TRACK_PATH: 'library:get-track-path',

  // Player
  PLAYER_GET_FILE_URL: 'player:get-file-url',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SELECT_DIRECTORY: 'settings:select-directory',

  // Updater
  UPDATER_CHECK: 'updater:check',
  UPDATER_AVAILABLE: 'updater:available',
  UPDATER_PROGRESS: 'updater:progress',
  UPDATER_DOWNLOADED: 'updater:downloaded',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install'
} as const
