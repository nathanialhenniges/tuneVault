# TuneVault - Working Notes

Personal case-study project. Electron desktop app that downloads playlists into
per-device folders with an enforced storage cap.

## What this app is (and is not)

It is a downloader plus a device/folder manager. It is **not** a music player.
Version 2.x carried a full playback stack (player bar, queue, visualizer,
crossfade, tray media keys, `tunevault://` protocol, a library browser and a
playlist auto-sync timer). All of it was deleted in 3.0. Do not reintroduce
playback — the files are played on the device, not on the desktop.

## Architecture

Three processes, strict boundaries:

- `src/main/` - all Node and `child_process` work. Services hold the logic; IPC
  handlers in `src/main/ipc/register.ts` stay thin.
- `src/preload/index.ts` - the only bridge. `contextIsolation: true`,
  `nodeIntegration: false`.
- `src/renderer/` - React. Reaches the filesystem only through `window.api`.
- `src/shared/` - types, pure helpers, and **every IPC channel name**
  (`ipc-channels.ts`). Never write a channel string anywhere else.

## Hard rules

1. **The folder on disk is the source of truth.** There is no `library.json`,
   no central library, no mirror step. Downloads land directly in the device
   folder and `DeviceService` reads it back with a `readdir` walk. 2.x kept two
   storage layers and a full recopy on every sync; do not bring that back.
2. **Every filesystem path goes through the escape guard.** `assertInside()` in
   `device.service.ts` rejects anything outside the music root. A hand-edited
   `settings.json` must not be able to make the app delete `/`.
3. **The storage cap is checked twice, and only one of them counts.**
   `DownloadService.preflight` produces an estimate for the UI; it is advisory
   and users can override it with `ignoreEstimate`. The real check reads on-disk
   usage **before writing each track** in `DownloadService.start`, and is never
   overridable. It has to stay *before* the write: an earlier version only fired
   once the folder was already over capacity, which let the last track breach
   the limit.
4. **Never auto-delete to make room.** A full device fails the download. The
   only deletions are ones the user explicitly asks for.
5. **Keep `yt-dlp` current.** `YTDLP_VERSION` in
   `scripts/download-binaries.mjs` is pinned and checksum-verified. YouTube
   changes its player often; a pin more than a few months old stops extracting
   audio entirely. A stale pin breaks the app as surely as no pin does.
6. **Scrapers are pure functions with fixtures.** `apple-parse.ts` and
   `spotify-parse.ts` take an HTML string and return data — no fetch, no Node
   imports. Every change needs its unit test updated. They must throw a
   readable error, never return an empty list silently.
7. **Bad metadata must never fail a download.** Everything in
   `metadata.service.ts` degrades to `null`.

## Download pipeline

`resolvePlaylist(url)` -> provider dispatch -> tracks with a `sourceUrl`
-> `DownloadService.start`:

1. Skip if the file already exists (unless `forceRedownload`).
2. Re-check the device cap against real usage.
3. `yt-dlp -f bestaudio/best --extract-audio --audio-format <fmt>`, progress
   read from `--progress-template` (not by regex-scraping stdout, which is what
   2.x did).
4. `MetadataService.lookup` - MusicBrainz, then the Cover Art Archive, then the
   iTunes Search API. Throttled to one request per second **inside the
   service**, so no caller can forget.
5. `TagService.write` - one `node-id3` pass, tags plus embedded cover art. No
   re-mux. MP3 only; flac/opus get yt-dlp's own `--embed-metadata`.
6. Rewrite the playlist's `.m3u8`.

Retries: HTTP 429 only, 3 attempts, exponential backoff **with jitter** so
parallel workers do not retry in lockstep.

Cover art is a list of candidates, tried in order (Cover Art Archive, iTunes,
then the source thumbnail). The Archive returns a URL for releases that have no
artwork, and it 404s — a single-URL design silently ships untagged art.

## Sources

| Provider    | How the track list is obtained                                   |
| ----------- | ---------------------------------------------------------------- |
| YouTube     | `yt-dlp --flat-playlist --dump-json` (NDJSON, one object per line) |
| Apple Music | `<script id="serialized-server-data">` on the public page          |
| Spotify     | `<script id="__NEXT_DATA__">` on `open.spotify.com/embed/...`      |

Apple and Spotify yield names only. Each track is then resolved through
`ytsearch1:` (SoundCloud via `scsearch1:` as fallback) at concurrency 4. Both
scrapers need a desktop User-Agent or the sites serve a stripped page.

## Reading tags

`TagService.read` parses **only the ID3v2 header**, not the file. node-id3 reads
an entire file when handed a path, so listing a 500-track device that way would
pull gigabytes through memory to look at a few kilobytes. The header states its
own length (synchsafe: seven bits per byte), so we read 10 bytes, decode the
size, and read exactly that much. Measured: 125 files in ~80ms.

Cover art is **never** sent over IPC with a listing. It is served on demand by
the `tvart://` protocol (`src/main/artwork-protocol.ts`), which the `<img>` tags
fetch lazily. That handler takes a renderer-controlled path — it must keep
checking the path resolves inside `musicRoot` before reading anything.

## Duplicates

Default is one copy of a song per device, across all its playlist folders.
`trackKey(artist, title)` is the identity: track number is excluded on purpose,
because the same song sits at a different position in every playlist.

`DeviceService.existingTrackIndex` reads the files' **ID3 tags**, falling back
to the filename. It returns two sets:

- `full` — artist + title, the reliable comparison.
- `titleOnly` — for files whose artist cannot be determined. Those are matched
  on title alone, which is looser but far better than the alternative.

An earlier version indexed filenames only and dropped any file without a
parseable `NN - Artist - Title` name. Measured against a real device: it covered
**41 of 143 files**, so the other 102 were re-downloaded on every run. Tags cover
all 143. Filenames are also sanitised, so `A*S*Y*S` is stored as `ASYS` and only
the tag matches the source.

Use `isAlreadyPresent(sets, artist, title)` rather than testing the sets by
hand — it handles the artist/title fallback and the "Unknown Artist" family of
placeholders. Both downloading and importing honour it;
`settings.allowDuplicates` turns it off.

## Rate limits

Searching YouTube is the throttled operation; downloading is far less so. The
defences, in order of how much they matter:

1. `SearchCache` — a permanent on-disk map from `trackKey` to the resolved
   video. A song matched once is never searched again. This is the big one.
2. `throttleSearch` in `resolve/youtube.ts` — one gate, minimum 1.2s between
   searches, no matter how many workers are running.
3. Batches of 25 with a 20s cooldown in `DownloadService.start`.
4. Local files and duplicate-skipped tracks are never searched at all.

**Do not add a YouTube Data API key.** `search.list` costs 100 of 10,000 daily
quota units — 100 searches per day — and returns no audio. It is strictly worse
than what is here. Do not add IP rotation or proxy cycling either; that is
evasion, not pacing.

Cookies (`cookies.service.ts`) are the legitimate remaining lever. They are
credentials: they go to the local yt-dlp process and nowhere else. Never log
them, never read their contents, never include them in an error message.

## Music app (macOS)

`resolve/music-app.ts` drives the Music app through JXA. Two rules:

- **Read properties in bulk** (`tracks.name()`, `tracks.artist()`, …). Each is
  one Apple Event; per-track access on a 3,800-track library is thousands.
  `location` is the exception — it throws for Apple Music streaming tracks, so
  it is only requested where `class` is `fileTrack`.
- **Never match at resolve time.** The library can be thousands of tracks;
  tracks carry `needsMatch` and are searched at download time, for the selection
  only.

Position is the **playlist index**, not the album track number the Music app
reports — that repeats across albums and scrambles the `NN - ` ordering.

Note Apple's public web page for a personal playlist is not a substitute: it
exposes only a handful of tracks and its own `trackCount` field agrees.

## Metadata gaps

Two paths create files with missing tags, and both have bitten:

1. **Imports are a byte-for-byte copy.** Nothing tags them, so they inherit the
   source's gaps. `EnrichService` now runs after an import and can be run over a
   whole device on demand.
2. **The download lookup used to short-circuit** when the source already gave a
   genre and album — which silently skipped year and cover art too. Do not
   reintroduce that optimisation: the Music app supplies genre and album but
   never year or artwork.

`TagService.fillMissing` writes **only absent fields**. Never overwrite what a
file already says about itself; the user's own tags outrank a lookup.

## Transfer marks

`transfer.service.ts` records which files have been dragged onto the physical
device. This is **not** deduplication — duplicate protection already works off
what is on disk, and the user keeps the files in the folder after copying them.
It answers a different question: what have I actually moved across yet.

Keyed by path relative to the device folder, so moving or renaming the whole
folder keeps the marks; renaming one file loses its mark, which is the accepted
trade for not keeping a database. Marks are pruned whenever the file list is
read, and dropped with the device.

## Persistence

`app.getPath('userData')/settings.json`, written atomically (tmp + rename).
Every value is flat or a whole-array replacement, so the shallow merge in
`SettingsService.save` is correct — revisit it before adding a nested object.
2.x had a shallow merge with one hand-written deep-merge special case, which was
a bug waiting for the second nested key.

## Native behaviour

Researched against the Electron 33 docs and Apple's HIG; do not regress these.

- `titleBarStyle: 'hiddenInset'`. The renderer supplies the drag strip
  (`.drag-region`). Drag regions swallow **all** pointer events, so any control
  inside one needs `.no-drag`, and regions are rectangular regardless of border
  radius.
- **No vibrancy.** Electron exposes one window-level material, which bleeds at
  the title bar and the sidebar seam and hurts legibility behind dense lists.
  Note `vibrancy: 'dark' | 'ultra-dark' | 'appearance-based'` were removed in
  Electron 27 and silently do nothing.
- **Destructive confirmations are `dialog.showMessageBox` sheets**, parented to
  the window, with `cancelId` set explicitly — Electron otherwise infers it from
  the button labels and can map Escape onto the destructive button. Buttons are
  verbs, never "OK".
- **Deletions use `shell.trashItem`.** Because they are undoable, a single-track
  deletion needs no confirmation at all.
- **`shell.showItemInFolder` for a file, `shell.openPath` for a folder.**
  `openPath` on an `.mp3` launches Music, which is not what "reveal" means.
- **Notifications only when the window is unfocused**, one per batch, never per
  track. They will not appear from `electron-vite dev` under a bare Electron
  bundle id — test them in a packaged build.
- **`webUtils.getPathForFile`**, bridged through preload. `File.path` was
  removed in Electron 32 and is `undefined`.
- Do not restyle scrollbars and never write `outline: none`.

## UI

Light and dark, driven purely by `prefers-color-scheme` — no theme state, no
IPC. `--color-ink` is the text on a filled control and flips between the two
appearances; that is what keeps buttons legible in both. Every colour pair in
`styles/index.css` is measured against WCAG AA and the ratios are written in the
comment there.

Toasts are a last resort. Report a failure where it happened: in the form, on
the row, under the panel. A toast is only for a failure with nowhere else to
appear. 2.x shipped a muted grey at
4.42:1 and a primary button at 2.8:1. One `<Button>` component, one focus
treatment (`:focus-visible` globally), 44px minimum hit targets.

## Reference

The pre-3.0 codebase can be restored for reference and is gitignored:

```bash
mkdir -p old && git archive <pre-3.0-commit> | tar -x -C old
```
