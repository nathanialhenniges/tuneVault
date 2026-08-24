# TuneVault - Playlist Downloader for Offline Players

TuneVault is a desktop app that turns a Spotify, YouTube or Apple Music
playlist link into a folder of properly tagged audio files, sized to fit a
specific device. Each device you add is a named folder with a hard storage
limit, so a playlist that would overflow your iPod is refused before a single
file is written.

Paste a link. Press download. Drag the folder across.

> **Disclaimer**
>
> This is a personal case-study project, built and maintained for private use
> and as a portfolio exercise. It is not a product, it is not supported, and it
> is not distributed. It is not affiliated with, endorsed by, or connected to
> Spotify, Apple, YouTube, Google or SoundCloud.
>
> Downloading content you do not own or have no licence to copy may breach
> those services' terms of use and your local copyright law. Use TuneVault only
> for material you own or are licensed to keep. You are solely responsible for
> what you download and what you do with it.

## Features

- **Three sources, no API keys** - Spotify, YouTube and Apple Music playlist
  and album links, read straight from their public pages.
- **Devices with enforced storage limits** - Name a device, give it a size, and
  TuneVault refuses any download that would push its folder past the cap. It
  never deletes anything to make room.
- **Size preview before you commit** - See what a playlist will cost and what
  the device has free, before the first byte is downloaded.
- **Proper metadata** - Genre, album, year and cover art looked up from
  MusicBrainz, the Cover Art Archive and the iTunes Search API, then written as
  ID3v2 tags in a single pass. No re-encoding.
- **The library reads its own tags** - The track list shows the artwork, title,
  artist, album and genre embedded in each file, grouped by playlist, not a
  guess made from the filename.
- **No duplicate downloads** - A song already on a device is skipped when a
  second playlist wants it. Turn that off in Settings if you would rather each
  playlist folder held a complete copy.
- **Imports from the Music app** (macOS) - Reads your real library and
  playlists, including personal playlists whose public web page only exposes a
  handful of tracks. Tracks you own as files are copied across directly.
- **Paced for rate limits** - Searches are throttled, work runs in batches with
  a cooldown, and every match is cached permanently so a song is never looked
  up twice.
- **Drag files in, drag tracks out** - Drop your own audio files onto a device
  from Finder (or add them from the File menu), and drag any downloaded track
  straight out of the list onto the device in Finder.
- **Open Folder button** - One click to the folder in Finder, ready to drag
  onto the device.
- **Built like a Mac app** - Native title bar and menu bar, native confirmation
  sheets, deletions go to the Trash so they can be undone, a notification when
  a long download finishes in the background, and it follows the system light
  and dark appearance.
- **Per-playlist M3U** - Each playlist folder gets an extended `.m3u8` with
  real durations.
- **Selective downloads** - Untick anything you do not want before starting.
- **Resumable by design** - Files that already exist are skipped, so rerunning
  a playlist only fetches what is missing.

## Getting Started

1. Clone the repository and install dependencies with `npm install`.
2. Fetch the bundled `yt-dlp` and `ffmpeg` binaries with
   `npm run download-binaries`.
3. Start the app with `npm run dev`.
4. Accept the disclaimer, then add a device - give it a name and a storage
   limit in GB.
5. Open the device, paste a playlist link, and press **Load**.
6. Check the size preview, then press **Download**.
7. Press **Open folder** and drag the files onto your player - or drag tracks
   out of the list directly.

To add music you already own, drag the files onto the device page from Finder,
or use **File > Add Audio Files**.

## Usage

### Supported links

| Service      | Example link                                    | How it works                                                         |
| ------------ | ----------------------------------------------- | -------------------------------------------------------------------- |
| YouTube      | `youtube.com/playlist?list=...`                 | Read directly by `yt-dlp`.                                            |
| YouTube      | `music.youtube.com/playlist?list=...`           | Read directly by `yt-dlp`.                                            |
| Spotify      | `open.spotify.com/playlist/...` or `/album/...` | Track list read from the public embed page, then each song is found and downloaded from YouTube. |
| Apple Music  | `music.apple.com/us/playlist/...`               | Track list read from the public page, then each song is found and downloaded from YouTube. |

Spotify and Apple Music expose no free audio of their own. TuneVault reads the
track list from their public pages and resolves each song through YouTube
(falling back to SoundCloud), which is the only keyless path that exists.
Private playlists cannot be read.

### Where files land

```
<music folder>/
  Nathanial's iPod/                  # one folder per device
    Road Trip/                       # one folder per playlist
      01 - Artist - Title.mp3
      Road Trip.m3u8
      .art/                          # cached cover art
    Imported/                        # files you dragged in yourself
```

### Duplicates

By default a device holds one copy of any given song. If two playlists share a
track, the second one is skipped rather than downloaded and stored again -
matching is on artist and title, ignoring track number, case and punctuation.
Importing your own files obeys the same rule. **Settings > Allow the same song
more than once** turns it off.

### Importing from the Music app

On macOS, **Browse library** on a device page lists every playlist in the Music
app plus the entire library. This sees a personal playlist in full, unlike its
public web page - Apple's own page reports only a handful of tracks for one.

Tracks backed by a real file (purchased or uploaded) are copied straight across.
Apple Music streaming tracks have no file to copy, so they are matched and
downloaded from YouTube. Matching happens when you press Download, not while
browsing, so opening a library of several thousand tracks is instant.

The first time TuneVault controls the Music app, macOS asks for permission. If
it was refused, allow it under System Settings > Privacy & Security >
Automation.

### Rate limits

Matching songs on YouTube is the part that gets throttled, so TuneVault does
less of it:

- **Every match is cached permanently.** A song matched once is never searched
  again, on any device, across restarts.
- **Searches are paced** to roughly one per 1.2 seconds, through a single gate,
  regardless of how many downloads run in parallel.
- **Work runs in batches of 25** with a cooldown between them. A run shorter
  than one batch never pauses.
- **Local files and duplicates cost nothing** - neither is ever searched for.
- Rate-limit responses back off exponentially with jitter.

A YouTube Data API key does not help here and is not supported: `search.list`
costs 100 of the 10,000 daily quota units, which is 100 searches per day, and
the API returns no audio.

**Settings > Sign-in for downloads** can pass your own cookies to yt-dlp, which
clears most of YouTube's bot checks. Cookies come either from a browser profile
on this Mac or from an exported cookies.txt. The browser profile is what selects
between accounts.

> Cookies are login credentials. TuneVault passes them to yt-dlp on this machine
> and nothing else - they are never logged, copied or transmitted. Bulk
> downloading while signed in carries some risk to the account used, so prefer a
> secondary account.

### Storage limits

The limit is checked twice: once as an estimate when you load a playlist, and
again against real on-disk usage before every individual track. A wrong
estimate can therefore never cause a device to exceed its cap. Removing a
device asks, in a native sheet, whether to keep the files or move them to the
Trash. Nothing is ever erased outright - deletions go to the Trash, so they can
be put back.

Importing obeys the same limit: files that would not fit are left alone and
reported, rather than being copied and pushing the folder over.

## Tech Stack

| Layer            | Technology                          |
| ---------------- | ----------------------------------- |
| Shell            | Electron 33                         |
| Build            | electron-vite 3, Vite 6             |
| UI               | React 19, React Router 7            |
| State            | Zustand 5                           |
| Styling          | Tailwind CSS v4                     |
| Language         | TypeScript 5                        |
| Audio download   | yt-dlp, ffmpeg (bundled binaries)   |
| Tagging          | node-id3                            |
| Fonts            | Bricolage Grotesque, Hanken Grotesk |
| Metadata sources | MusicBrainz, Cover Art Archive, iTunes Search API |
| Tests            | Vitest                              |
| Packaging        | electron-builder 25                 |

## Development

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- macOS on Apple Silicon, Windows x64, or Linux x64 (the bundled ffmpeg build
  for macOS is arm64 only)

### Setup

1. Install dependencies.

   ```bash
   npm install
   ```

2. Download the `yt-dlp` and `ffmpeg` binaries into `resources/bin/`.

   ```bash
   npm run download-binaries
   ```

3. Run the app in development mode.

   ```bash
   npm run dev
   ```

### Development Scripts

- `npm run dev` - Start Electron with hot reload.
- `npm run build` - Type-check and build main, preload and renderer.
- `npm run preview` - Preview a production build.
- `npm test` - Run the Vitest suite once.
- `npm run test:watch` - Run Vitest in watch mode.
- `npm run typecheck` - Type-check every project without emitting.
- `npm run download-binaries` - Fetch the pinned `yt-dlp` and `ffmpeg` binaries.
- `npm run pack` - Build an unpacked app directory.
- `npm run dist` - Build a distributable for the current platform.
- `npm run dist:mac` / `dist:win` / `dist:linux` - Platform-specific builds.

### Code Quality

- TypeScript in strict mode across all three processes.
- Context isolation on, node integration off; the renderer reaches the
  filesystem only through the preload bridge.
- Every IPC channel name is declared once in `src/shared/ipc-channels.ts`.
- All page-scraping parsers are pure functions over an HTML string, covered by
  unit tests with checked-in fixtures, so a site markup change surfaces as a
  failing test rather than a silent empty playlist.
- Colour pairs in the UI are measured against WCAG AA in both the light and
  dark appearance; the measured ratios are recorded in
  `src/renderer/src/styles/index.css`.
- Native platform behaviour over reimplementation: system dialogs, the system
  menu bar, system scrollbars, `shell.trashItem` for deletions, and
  `webUtils.getPathForFile` for dropped files.

## Project Structure

```
src/
  shared/                 # Types, IPC channel names, pure helpers (shared by all processes)
  main/
    index.ts              # App lifecycle and window creation
    ipc/register.ts       # Thin IPC handlers
    services/
      binary.service.ts   # Locates the bundled yt-dlp and ffmpeg
      device.service.ts   # Device CRUD, folder walking, storage limits
      download.service.ts # Download pool, retries, cancellation, cap enforcement
      metadata.service.ts # MusicBrainz, Cover Art Archive, iTunes lookups
      settings.service.ts # Atomic JSON settings
      tag.service.ts      # ID3v2 tag writing
      notify.service.ts   # Native notifications for background completion
      window-state.service.ts # Remembers window size and position
      resolve/            # One parser per source, plus URL dispatch
    menu.ts               # Application menu
  preload/index.ts        # The contextBridge API surface
  renderer/src/           # React UI
scripts/                  # Binary download script
resources/bin/            # Bundled yt-dlp and ffmpeg (gitignored)
```

## License

![GitHub license](https://img.shields.io/github/license/nathanialhenniges/tunevault.svg?style=for-the-badge&logo=github)

## Contact

Questions or feedback:

- Discord: [Join my server](https://mrdwolf.net/discord)

---

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
