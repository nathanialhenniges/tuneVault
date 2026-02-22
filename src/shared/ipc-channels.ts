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

  // Library
  LIBRARY_GET: 'library:get',
  LIBRARY_GET_RESULT: 'library:get-result',
  LIBRARY_SAVE: 'library:save',
  LIBRARY_GET_TRACK_PATH: 'library:get-track-path',
  LIBRARY_DELETE_TRACKS: 'library:delete-tracks',
  LIBRARY_DELETE_ALL: 'library:delete-all',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',
  LIBRARY_GET_PLAYLIST_INFO_PATH: 'library:get-playlist-info-path',
  LIBRARY_READ_PLAYLIST_INFO: 'library:read-playlist-info',
  LIBRARY_VERIFY: 'library:verify',

  // Player
  PLAYER_GET_FILE_URL: 'player:get-file-url',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SELECT_DIRECTORY: 'settings:select-directory'
} as const
