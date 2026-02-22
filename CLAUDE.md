# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev                # Start Electron + Vite dev server with hot reload
npm run build              # Build main/preload/renderer to out/
npm run pack               # Build + electron-builder --dir (unpacked)
npm run dist               # Build + electron-builder (all platform installers)
npm run dist:mac           # macOS only (dmg, zip)
npm run dist:win           # Windows only (nsis, portable)
npm run dist:linux         # Linux only (AppImage, deb)
npm run download-binaries  # Fetch yt-dlp + ffmpeg + ffprobe for current platform
```

Binaries (yt-dlp, ffmpeg, ffprobe) must exist in `resources/bin/<mac|win|linux>/` before the app runs. Use `npm run download-binaries` or symlink from brew installs for dev.

## Architecture

**Three-process Electron app** built with electron-vite:

- **Main process** (`src/main/`): Node.js — window management, IPC handlers, child process spawning (yt-dlp/ffmpeg), file I/O, custom `tunevault://` protocol for serving local audio files
- **Preload** (`src/preload/index.ts`): Secure bridge exposing `window.api` to renderer via `contextBridge`. All IPC channels are typed here.
- **Renderer** (`src/renderer/`): React 19 + Zustand + Tailwind CSS v4 + Howler.js

**Shared types** live in `src/shared/` — `models.ts` (Track, Playlist, AppSettings, etc.) and `ipc-channels.ts` (channel name constants). Both main and renderer import from here.

### Main Process Patterns

- **Service layer**: Business logic in `src/main/services/` (no IPC awareness). IPC handlers in `src/main/ipc/` are thin — validate input, delegate to services, send responses.
- **IPC registration**: All handlers registered in `src/main/ipc/register.ts` via `registerAllIpc(mainWindow)`.
- **Binary resolution**: `BinaryService` resolves yt-dlp/ffmpeg paths differently in dev (`resources/bin/<platform>/`) vs production (`process.resourcesPath/bin/`).
- **Custom protocol**: `tunevault://audio/<encoded-path>` serves local files to bypass CSP/cross-origin restrictions. Registered in `main/index.ts` before app ready.

### Renderer Patterns

- **Routing**: `MemoryRouter` with 4 routes — Playlists (`/`), Downloads, Library, Settings
- **State**: One Zustand store per domain — `playerStore`, `playlistStore`, `downloadStore`, `libraryStore`, `settingsStore`
- **Audio**: `AudioEngine` class wraps Howler.js. Callbacks must be passed in `load()` call (before Howl creation) to avoid race conditions.
- **Theming**: CSS custom properties toggled by `.dark` class on `<html>`. Light default, obsidian dark with orange accent (`#f97316`). Theme applied in `settingsStore.ts`.
- **Icons**: `@heroicons/react` (24px solid/outline variants)
- **Reusable UI**: Custom `Checkbox` and `DisclaimerModal` in `components/ui/`

### Download Pipeline

1. `download.ipc.ts` manages concurrent queue with `AbortController` per track
2. `YtdlpService.download()` spawns yt-dlp, parses `--newline` progress output
3. On completion, `FfmpegService.tagFile()` embeds iTunes-compatible metadata + album art
4. `LibraryService.upsertTrack()` persists to `library.json` in app data dir
5. Temp files (`.webm`, `.m4a`, `.part`, thumbnails) cleaned up after conversion

### Data Persistence

- `library.json` — all downloaded tracks/playlists (in `app.getPath('userData')`)
- `settings.json` — user preferences
- `localStorage` — recent playlists, disclaimer acceptance
- Audio files — `~/Music/TuneVault/<PlaylistName>/NN - Artist - Title.ext` (configurable)

## TypeScript Configuration

Two configs via project references in `tsconfig.json`:
- `tsconfig.node.json`: Main + preload (Node.js target, CommonJS)
- `tsconfig.web.json`: Renderer (DOM + React JSX, ESNext)

## CI/CD

`.github/workflows/build.yml` — matrix build on macOS/Ubuntu/Windows. PRs build with `--publish never`; version tags (`v*.*.*`) publish to GitHub Releases. Code signing disabled (`CSC_IDENTITY_AUTO_DISCOVERY=false`).

## Key Conventions

- IPC channels defined once in `src/shared/ipc-channels.ts`, referenced everywhere
- Preload API typed as `Api` type exported from `preload/index.ts`, declared on `window` in `renderer/src/lib/api.ts`
- All file paths handled via `tunevault://` protocol for playback (never raw `file://`)
- No YouTube API key needed — yt-dlp `--flat-playlist --dump-json` used for metadata
- Electron-builder bundles platform binaries via `extraResources` from `resources/bin/`
