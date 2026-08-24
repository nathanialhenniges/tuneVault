# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-08-24

Complete rewrite. TuneVault is now a device-first downloader; it is no longer a
music player.

### Added

- **Devices with enforced storage limits.** Name a device, set a size in GB, and
  downloads that would exceed it are refused. The limit is checked as an
  estimate before a run and again against real on-disk usage before every track,
  so an optimistic estimate can never overflow a device. Nothing is ever deleted
  automatically.
- **Spotify support.** Public playlist and album links are read from the embed
  page's `__NEXT_DATA__` blob, then each track is resolved through YouTube. No
  API key.
- **Size preview.** Before downloading, see what a playlist will cost against
  what the device has free, with the exact shortfall when it does not fit.
- **Open Folder button** on every device, and **Show in Finder** on every track.
- **Drag and drop.** Drop audio files onto a device from Finder to copy them in
  (they land in an `Imported` folder and obey the storage limit), and drag any
  downloaded track out of the list into Finder as a real file.
- **Native macOS behaviour.** Hidden-inset title bar with a proper drag region,
  a full application menu built from system roles (with Settings on Cmd+,, and
  developer items only in unpackaged builds), native alert sheets for
  destructive actions, a native notification when a download finishes while the
  app is in the background, and remembered window size and position.
- **Light and dark appearance**, following the system setting through
  `prefers-color-scheme` with no JavaScript involved.
- **Selective downloads.** Untick tracks before starting, with shift-click range
  selection.
- **Duplicate protection, on by default.** A song already on a device is skipped
  when another playlist wants it, and when importing your own files. Matching is
  on artist and title, ignoring track number, case and punctuation. A Settings
  toggle restores the old behaviour.
- **Track lists read the files' own ID3 tags** — artwork, title, artist, album
  and genre — instead of parsing the filename. Only the tag header is read (the
  header declares its own length), so listing a device costs kilobytes per file
  rather than megabytes, and embedded cover art is served lazily over a
  dedicated `tvart://` protocol instead of being pushed through IPC.
- **Grouped library view.** Files are grouped by the playlist folder they came
  from, each group collapsible and showing its own track count and size, with a
  filter box that searches titles, artists, albums and genres.
- **Per-playlist `.m3u8`** with real durations.
- **Pinned, checksum-verified `yt-dlp`.** The binary script now pins a release
  and verifies its SHA-256 against the checksum file published with it.

### Changed

- **Downloads land directly in the device folder.** The central library,
  `library.json`, the device mirror step and the `.moved` archive are gone. The
  folder on disk is the only state.
- **Tagging uses `node-id3` instead of ffmpeg.** Tags and cover art are written
  in a single pass with no re-mux, replacing up to three full ffmpeg re-encodes
  per file.
- **Genre is looked up during the download**, not hardcoded to `Music` and
  repaired later by a separate bulk job.
- **Cover art tries several sources in order** — Cover Art Archive, then iTunes,
  then the source thumbnail. Previously a Cover Art Archive URL for a release
  with no artwork produced a 404 and no art at all, because the iTunes fallback
  was skipped whenever a URL existed.
- **Download progress comes from `--progress-template`**, replacing regex
  scraping of yt-dlp's human-readable output.
- **Rate-limit retries use exponential backoff with jitter** (3 attempts),
  replacing a flat 60-second sleep.
- **Cancellation no longer races.** The abort handler checks whether the promise
  has already settled before rejecting.
- **Unknown settings keys are dropped on save.** A settings.json inherited from
  2.x carried `musicDir`, `sync`, `theme`, `accent` and `youtubeApiKey` forward
  on every write; the schema is now enforced.
- **Settings merge is simplified.** No nested objects remain, so the one
  hand-written deep-merge special case is gone.
- **Deletions go to the Trash** (`shell.trashItem`) instead of being unlinked,
  which makes them undoable from Finder — and is why deleting a single track no
  longer asks for confirmation.
- **Confirmations are native sheets**, not in-app modals, with the safe option
  bound to Return and Escape explicitly mapped to Cancel.
- **Far fewer toasts.** Failures are reported where they happened — in the form,
  on the row, under the panel — rather than in a corner of the window. A toast
  is now reserved for a failure with nowhere else to appear.
- **A new visual identity.** The palette is taken from the wolf mark's own cyan
  over a navy-black chassis, set in Bricolage Grotesque and Hanken Grotesk, and
  the storage limit is shown as a segmented capacity gauge that previews what a
  pending playlist would fill before you commit to it.
- **UI colours now meet WCAG AA.** The muted text colour (was 4.42:1) and the
  primary button (was 2.8:1) both failed before. There is one `<Button>`
  component, one global `:focus-visible` treatment, and 44px minimum hit
  targets.

### Removed

- The entire playback stack: player bar, now playing, queue, visualizer,
  crossfade, volume control, the `howler` dependency, the `tunevault://`
  protocol and tray media keys.
- The library browser, metadata editor, track inspector and import flow.
- Playlist auto-sync (the interval timer that re-checked playlists for new
  tracks).
- Easter eggs: the Konami code handler, wolf mode and the spinning wolf.
- The in-app theme picker and accent colour setting. The app follows the system
  appearance instead.
- Custom scrollbar styling, so macOS overlay scrollbars behave as the user
  configured them.
- `ffprobe` from the bundled binaries — nothing read audio metadata any more.
