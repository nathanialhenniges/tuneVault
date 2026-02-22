# Changelog

All notable changes to TuneVault will be documented in this file.

## [1.3.0] - 2026-02-22

### Added
- OIIA OIIA wolf animation (full spin with squash-and-stretch wobble, inspired by the cat meme)
- Improved playlist UX: sticky header, inline per-track download progress, live download counter, empty state, column labels
- Download All button now visually selects all checkboxes in the UI

### Fixed
- Full release date written to audio metadata (ID3v2.4 TDRC/TDRL) instead of year-only
- Tracks always sorted by original playlist position (removed track-order.txt reordering)
- Download state and selection reset when fetching a new playlist
- Same songs allowed in different playlists (separate IDs, files, and library entries)

## [1.2.0] - 2026-02-22

### Added
- Background downloads: closing the window during active downloads hides it to the system tray instead of quitting
- App version number displayed in the sidebar footer
- Restore the window anytime via the tray icon; use Quit from tray or Cmd+Q to force exit

## [1.1.0] - 2026-02-22

### Added
- Track metadata enrichment: release date, bitrate, and URL fields on downloaded tracks
- Date Format setting with 4 options (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD Mon YYYY)
- Release Date Source setting (YouTube or MusicBrainz free API lookup)
- MusicBrainz service for release date lookups with fallback to yt-dlp metadata
- Bitrate display in playlist track rows and library track list
- Download completion summary banner showing done/skipped/failed counts
- Playlist caching (localStorage + main process, 30-minute TTL) for instant re-loads
- Refresh button to re-fetch a playlist bypassing the cache
- "Cached" badge on playlist header when loaded from cache
- Enriched `track-order.txt` with date, bitrate, and URL per track
- Konami code easter egg with spinning wolf loader

### Changed
- Default audio format changed from FLAC to MP3

### Fixed
- Cancel button now properly stops queued downloads and notifies the renderer
- Cancel All now halts the entire batch queue loop instead of only aborting active downloads
- Cancelling a queued (not yet started) track now works correctly

## [1.0.2] - 2026-02-21

### Fixed
- CI release permissions for GitHub Actions
- Linux `.deb` package author field
- Windows ffmpeg cleanup to prevent 900MB builds

## [1.0.1] - 2026-02-21

### Fixed
- Clean up extracted ffmpeg directory on Windows to prevent bloated builds

## [1.0.0] - 2026-02-20

### Added
- Download YouTube playlists as high-quality audio (FLAC, MP3, Opus)
- iTunes-compatible metadata tagging with album art via ffmpeg
- Built-in music player with queue, shuffle, and repeat
- Library management with track verification
- Customizable track ordering via drag-and-drop and `track-order.txt`
- Dark and light theme support with system theme detection
- Keyboard shortcuts for playback control
- System tray integration with playback controls
- Recent playlists dropdown for quick access
- Configurable music directory, audio format, and download concurrency
- Educational use disclaimer modal
- Custom `tunevault://` protocol for local audio playback
- Cross-platform support (macOS, Windows, Linux)
- CI/CD with GitHub Actions for automated builds and releases
