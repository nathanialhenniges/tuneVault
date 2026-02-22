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
npm test                   # Run Vitest unit tests
npm run typecheck          # TypeScript type-check without emitting
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

- **Routing**: `MemoryRouter` with 4 lazy-loaded routes — Playlists (`/`), Downloads, Library, Settings
- **State**: One Zustand store per domain — `playerStore`, `playlistStore`, `downloadStore`, `libraryStore`, `settingsStore`, `visualizerStore`, `syncStore`
- **Zustand selectors**: Use `useShallow` from `zustand/react/shallow` when selecting multiple values from a store to avoid unnecessary re-renders. Prefer individual selectors for single primitives and `useShallow` for multi-value objects.
- **Audio**: `AudioEngine` class wraps Howler.js. Callbacks must be passed in `load()` call (before Howl creation) to avoid race conditions.
- **Theming**: CSS custom properties toggled by `.dark` class on `<html>`. Light default, obsidian dark with orange accent (`#f97316`). Theme applied in `settingsStore.ts`.
- **Typography**: DM Sans (`@fontsource-variable/dm-sans`) used as a display font for section headings via `.font-display` class. Body text uses system fonts.
- **Icons**: `@heroicons/react` (24px solid/outline variants)
- **Reusable UI**: Custom `Checkbox` and `DisclaimerModal` in `components/ui/`
- **Lazy loading**: Heavy dependencies like `react-markdown` are lazy-loaded via `React.lazy`/`Suspense` wrappers (see `MarkdownViewer.tsx`). All thumbnail `<img>` tags use `loading="lazy"` and `decoding="async"`.

### Performance Patterns

- **SeekBar isolation**: The seek bar (250ms tick updates) is extracted into its own `React.memo` sub-component within `PlayerBar.tsx` to prevent re-rendering the entire player bar on every tick.
- **Module-scope constants**: Arrays like `SPEED_OPTIONS`, `CROSSFADE_OPTIONS`, `VISUALIZER_STYLES` are defined outside component functions to avoid re-creation on every render.
- **Derived selectors**: Zustand selectors that return primitives (e.g., download count in Sidebar) prevent re-renders when the underlying data changes but the derived value doesn't. Avoid selecting entire Maps or objects when only a count is needed.
- **React.memo**: Applied to components that receive stable props but live under frequently-updating parents (`NowPlaying`, `DownloadItem` with custom comparator, `LibraryTrackRow`).
- **Virtual scrolling**: `@tanstack/react-virtual` with `overscan: 5` for Library and Playlist track lists.
- **Canvas optimization**: Visualizer caches gradients (invalidated on resize) and batches draw calls by alpha bucket.

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
- CSS custom properties for theming; `.font-display` utility for display font; `.btn-press` for press feedback; `.download-shimmer` for progress bar animation
- Version bumps go in `package.json`; changelog in `CHANGELOG.md`
