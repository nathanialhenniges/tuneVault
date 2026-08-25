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
- **Import from the macOS Music app.** Browse every playlist plus the entire
  library, addressed internally as a `musicapp://playlist/<id>` pseudo-URL so it
  reuses the same preview, size preflight, duplicate check and "check for new
  tracks" machinery as a pasted link. Tracks backed by a real file are copied
  rather than downloaded, and album and genre come from the library instead of a
  lookup. Reads properties in bulk (one Apple Event per property, not per
  track): 156 tracks in ~300ms.
- **Deferred matching.** Music app tracks are matched on YouTube when a download
  starts, not while browsing, so opening a 3,800-track library is instant and no
  search is spent on a track that is never selected.
- **Rate-limit handling.** A permanent on-disk cache of every match, a single
  paced gate for all searches, batches of 25 with a cooldown between them, and a
  warning with a time estimate before a large import.
- **Optional sign-in for downloads.** yt-dlp can use cookies from a browser
  profile or an exported cookies.txt; the profile selects between accounts.
  Cookies are passed to the local yt-dlp process only and never logged or
  stored by TuneVault.
- **Resolve progress.** Pasting a link now reports what it is doing — reading
  the page, then matching track *n* of *m* — instead of blocking silently, and
  the input is locked while it works.
- **Filters** on both the imported track list and the device's own file list.
- **Genre filter** on the imported track list, as chips with counts, for sources
  that report a genre.
- **Duplicate checking now reads ID3 tags**, falling back to the filename, and
  matches on title alone when a file has no readable artist. The previous
  filename-only index covered 41 of 143 files on a real device, so the other 102
  were re-downloaded every run. Filenames are also sanitised, so a file tagged
  `A*S*Y*S` is stored as `ASYS` and only the tag matches the source.
- **Collaborations are filed under each contributor**, so a credit of
  `Avicii, DevBowser` matches a file tagged just `DevBowser`. Splits on `,`,
  `&`, `+`, `feat.`, `ft.`, `x`, `vs` and `with`; the title must still match
  exactly, so two different songs can never merge.
- **Tracks already on the device are hidden from import lists by default**, with
  a Show/Hide toggle on the list and a setting for the default. They could not
  be downloaded again anyway, so listing them was noise and an invitation to
  tick one by mistake.
- **The size estimate can be overridden.** It is derived from track lengths and
  a nominal bitrate, so it can block a download that would actually fit;
  "Download anyway" skips it for that run. The device's real storage limit still
  applies and is not overridable.
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
- **The storage limit is now checked before each write**, not after. It
  previously only fired once the folder was already at or over capacity, so the
  last track could push it past the limit before anything noticed. A track that
  would exceed the limit is skipped and the run continues, since a shorter track
  later on may still fit; only genuinely running out stops the run.
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

### Added (unreleased)

- **Fill in missing metadata.** Imported files were copied byte-for-byte and
  never tagged, so 22 of 125 imports on a real device had no genre and 5 had no
  artwork, against 1 of 162 for downloads. Imports are now enriched
  automatically, and a device-wide backfill with progress is available on the
  device page. Only missing fields are written.

- **Mark files as copied onto the device.** Select files, or a whole playlist
  from its group header, and mark them; marked rows get a badge, group headers
  show a moved/total count, and an All / Not moved yet / On iPod filter narrows
  the list. Marks are stored by path relative to the device folder, pruned when
  a file disappears, and never affect what gets downloaded.
- Renamed the device card's **Add music** action to **Manage device**, which is
  what the page it opens actually does.
- **Select all is always available** in the device file list. It previously
  disappeared as soon as one file was selected, leaving no way to then select
  everything.

### Fixed (unreleased)

- **Year and cover art were being skipped on downloads.** The metadata lookup
  short-circuited whenever the source had already supplied a genre and album,
  which also skipped year and artwork — 185 of 287 files on a real device had no
  year. The lookup now always runs when enrichment is on; a genre the source
  provided is still trusted over the looked-up one.

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
