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
  LIBRARY_DELETE_TRACKS: 'library:delete-tracks',
  LIBRARY_DELETE_ALL: 'library:delete-all',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',
  LIBRARY_OPEN_FILE: 'library:open-file',
  LIBRARY_GET_TRACK_ORDER_PATH: 'library:get-track-order-path',
  LIBRARY_READ_TRACK_ORDER: 'library:read-track-order',
  LIBRARY_VERIFY: 'library:verify',

  // Player
  PLAYER_GET_FILE_URL: 'player:get-file-url',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SELECT_DIRECTORY: 'settings:select-directory'
} as const
