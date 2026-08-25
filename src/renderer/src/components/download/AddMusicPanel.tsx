import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import type { Playlist, ResolveProgress } from '../../../../shared/models'
import type { Preflight } from '../../../../preload'
import {
  EMPTY_TRACK_INDEX,
  formatBytes,
  formatDuration,
  isAlreadyPresent,
  PROVIDER_LABEL,
  toTrackIndexSets
} from '../../../../shared/utils'
import { api } from '../../lib/api'
import { useDownloadStore } from '../../store/downloadStore'
import { useSettingsStore } from '../../store/settingsStore'
import { toastError } from '../../store/toastStore'
import { Button } from '../ui/Button'
import { CapacityGauge } from '../ui/CapacityGauge'
import { ProgressBar } from '../ui/ProgressBar'
import { Thumbnail } from '../ui/Thumbnail'
import { RunStatusBar } from './RunStatusBar'
import { TrackRow } from './TrackRow'

/**
 * Rough wall-clock estimate for a bulk import: one paced search per track, the
 * download itself spread across the worker pool, plus a cooldown every batch.
 * Deliberately coarse — it exists to set expectations, not to be accurate.
 */
function estimateMinutes(trackCount: number): string {
  const searchSeconds = trackCount * 1.2
  const downloadSeconds = (trackCount / 3) * 8
  const pauseSeconds = Math.floor(trackCount / 25) * 20
  const minutes = Math.round((searchSeconds + downloadSeconds + pauseSeconds) / 60)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `about ${minutes} minutes`
  const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '')
  return `about ${hours} hours`
}

export interface LoadRequest {
  url: string
  /** Bumped on every request so repeat clicks re-trigger the effect. */
  nonce: number
}

interface Props {
  deviceId: string
  /** Set by "Check for new tracks" on a saved playlist. */
  loadRequest?: LoadRequest
}

export function AddMusicPanel({ deviceId, loadRequest }: Props): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [resolving, setResolving] = useState(false)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [resolveProgress, setResolveProgress] = useState<ResolveProgress | null>(null)
  /** What is already on this device, for marking and preselection. */
  const [onDevice, setOnDevice] = useState(() => toTrackIndexSets(EMPTY_TRACK_INDEX))
  const [filter, setFilter] = useState('')
  /** Empty means "every genre"; otherwise only these are shown. */
  const [genres, setGenres] = useState<Set<string>>(new Set())
  /** Anchor for shift-click range selection. */
  const lastToggled = useRef<number | null>(null)

  const { running, progress, lastSummary, runStatus, startedAt, start, cancel } =
    useDownloadStore()
  /** Ids submitted to the run in flight, so the bar counts the right tracks. */
  const [runTrackIds, setRunTrackIds] = useState<string[]>([])
  const allowDuplicates = useSettingsStore((s) => s.settings?.allowDuplicates ?? false)
  const hideByDefault = useSettingsStore((s) => s.settings?.hideAlreadyOnDevice ?? true)
  /** Per-list override of the setting, reset each time a playlist is loaded. */
  const [showPresent, setShowPresent] = useState(false)
  /** Proceed despite the size estimate saying it will not fit. */
  const [ignoreEstimate, setIgnoreEstimate] = useState(false)

  useEffect(() => api.onResolveProgress(setResolveProgress), [])

  // Refreshed whenever a run finishes, so a second check sees what the first added.
  useEffect(() => {
    if (running) return
    void api.devices
      .trackKeys(deviceId)
      .then((index) => {
        const present = toTrackIndexSets(index)
        setOnDevice(present)
        // Untick whatever just landed on the device. Downloading it again would
        // be skipped anyway, but leaving it ticked reads as still-to-do and
        // makes the count in the button wrong.
        if (allowDuplicates) return
        setSelected((prev) => {
          const next = new Set<string>()
          for (const track of tracksRef.current) {
            if (prev.has(track.id) && !isAlreadyPresent(present, track.artist, track.title)) {
              next.add(track.id)
            }
          }
          return next
        })
      })
      .catch(() => setOnDevice(toTrackIndexSets(EMPTY_TRACK_INDEX)))
  }, [deviceId, running, allowDuplicates])

  const resolve = useCallback(
    async (target: string, refresh = false): Promise<void> => {
      if (!target.trim() || resolving) return
      setResolving(true)
      setPlaylist(null)
      setPreflight(null)
      setResolveProgress({ phase: 'fetching', done: 0, total: 0 })
      try {
        const result = await api.resolvePlaylist(target.trim(), refresh)
        setPlaylist(result)
        // Preselect only what is not already here, so re-checking a playlist
        // you have grown lands on exactly the new songs.
        const present = toTrackIndexSets(
          await api.devices.trackKeys(deviceId).catch(() => EMPTY_TRACK_INDEX)
        )
        setOnDevice(present)
        setSelected(
          new Set(
            result.tracks
              .filter((t) => allowDuplicates || !isAlreadyPresent(present, t.artist, t.title))
              .map((t) => t.id)
          )
        )
        lastToggled.current = null
      } catch (err) {
        toastError(err)
      } finally {
        setResolving(false)
        setResolveProgress(null)
      }
    },
    [allowDuplicates, deviceId, resolving]
  )

  // "Check for new tracks" on a saved playlist.
  useEffect(() => {
    if (!loadRequest) return
    setUrl(loadRequest.url)
    void resolve(loadRequest.url, true)
    // Only react to a new request, not to `resolve` changing identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRequest?.nonce])

  const tracks = playlist?.tracks ?? []
  // Read inside the post-run effect without making it depend on the list.
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  /*
   * The list is filtered for display only; selection is always keyed on track
   * id, so narrowing the view never silently drops what is already ticked.
   * "Select all" acts on what is visible, which is what makes the filter useful
   * on a 3,800-track library import.
   */
  // Hiding only applies while duplicates are actually being prevented.
  const hidingPresent = hideByDefault && !allowDuplicates && !showPresent

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return tracks.filter((t) => {
      if (hidingPresent && isAlreadyPresent(onDevice, t.artist, t.title)) return false
      if (genres.size > 0 && !(t.genre && genres.has(t.genre))) return false
      if (!q) return true
      return [t.title, t.artist, t.album, t.genre]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(q))
    })
  }, [tracks, filter, genres, hidingPresent, onDevice])

  /** Genres present in this playlist, commonest first. */
  const genreOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const track of tracks) {
      if (track.genre) counts.set(track.genre, (counts.get(track.genre) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [tracks])
  const chosen = tracks.filter((t) => selected.has(t.id))
  const totalDuration = chosen.reduce((sum, t) => sum + t.duration, 0)

  const runPreflight = useCallback(async () => {
    if (!playlist || chosen.length === 0) {
      setPreflight(null)
      return
    }
    try {
      setPreflight(await api.downloads.preflight(deviceId, chosen))
    } catch (err) {
      toastError(err)
    }
    // `chosen` is derived from playlist + selected, both of which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, playlist, selected])

  useEffect(() => {
    void runPreflight()
  }, [runPreflight])

  /** Click toggles one; shift-click extends from the last one you touched. */
  const toggle = (index: number, shiftKey: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      const anchor = lastToggled.current
      if (shiftKey && anchor !== null && anchor !== index) {
        const [from, to] = anchor < index ? [anchor, index] : [index, anchor]
        const turningOn = !next.has(visible[index].id)
        for (let i = from; i <= to; i++) {
          if (turningOn) next.add(visible[i].id)
          else next.delete(visible[i].id)
        }
      } else {
        const id = visible[index].id
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      return next
    })
    lastToggled.current = index
  }

  /** Select-all reflects the filtered view, not the whole playlist. */
  const visibleSelected = visible.filter((t) => selected.has(t.id)).length
  const allSelected = visible.length > 0 && visibleSelected === visible.length
  const alreadyHere = tracks.filter((t) => isAlreadyPresent(onDevice, t.artist, t.title)).length

  // Tracks that still need a YouTube match are the rate-limited part of a run;
  // local files and already-matched tracks cost nothing.
  const needMatching = chosen.filter((t) => t.needsMatch && !t.localPath).length
  const localCopies = chosen.filter((t) => t.localPath).length
  const bigImport = needMatching > 25

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="playlist-url" className="block text-sm font-medium">
          Playlist link
        </label>
        <div className="flex gap-2">
          <input
            id="playlist-url"
            value={url}
            // Locked while resolving: editing it would have no effect on the run
            // in flight, and pressing Enter again would queue a second one.
            disabled={resolving || running}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void resolve(url)}
            placeholder="Paste a Spotify, YouTube or Apple Music playlist or album link"
            className="min-h-11 flex-1 rounded-[10px] border border-control/50 bg-surface-2 px-3 text-sm disabled:opacity-50"
          />
          <Button
            variant="primary"
            disabled={!url.trim() || resolving || running}
            onClick={() => void resolve(url)}
          >
            {resolving ? 'Reading…' : 'Load'}
          </Button>
        </div>
        {resolveProgress && resolving ? (
          <div className="space-y-2 pt-1">
            <ProgressBar
              // Reading the page is one request with no meaningful total; the
              // per-track matching that follows does have one.
              percent={
                resolveProgress.phase === 'matching' && resolveProgress.total > 0
                  ? (resolveProgress.done / resolveProgress.total) * 100
                  : undefined
              }
              label="Reading playlist"
            />
            <p className="tabular text-xs text-text-muted">
              {resolveProgress.phase === 'matching' ? (
                <>
                  {resolveProgress.title && (
                    <span className="text-text">{resolveProgress.title} — </span>
                  )}
                  Finding {resolveProgress.done} of {resolveProgress.total} tracks on YouTube
                </>
              ) : (
                'Reading the playlist page…'
              )}
            </p>
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            Spotify and Apple Music links are read for their track list, then each song is found and
            downloaded from YouTube — those services have no free audio of their own.
          </p>
        )}
      </div>

      {playlist && (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          <header className="flex items-start gap-4 border-b border-hairline p-5">
            <Thumbnail src={playlist.thumbnail} size={64} className="rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                {PROVIDER_LABEL[playlist.provider]}
              </p>
              <h3 className="mt-1 truncate font-display text-lg leading-tight" title={playlist.title}>
                {playlist.title}
              </h3>
              <p className="tabular mt-1 text-sm text-text-muted">
                {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
                {alreadyHere > 0 && ` · ${alreadyHere} already here`}
                {selected.size !== tracks.length && ` · ${selected.size} selected`}
                {totalDuration > 0 && ` · ${formatDuration(totalDuration)} selected`}
              </p>
            </div>
          </header>

          {preflight && (
            <div className="border-b border-hairline px-5 py-4">
              <CapacityGauge
                usedBytes={preflight.usedBytes}
                capacityBytes={preflight.capacityBytes}
                incomingBytes={preflight.incomingBytes}
              />
              {!preflight.fits && (
                <div className="mt-2.5 space-y-2">
                  <p className="text-sm font-medium text-danger">
                    Estimated {formatBytes(preflight.shortfallBytes)} over the limit. Deselect some
                    tracks, free space on the device, or raise its storage limit.
                  </p>
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-text-muted">
                    <input
                      type="checkbox"
                      checked={ignoreEstimate}
                      onChange={(e) => setIgnoreEstimate(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5"
                    />
                    <span>
                      Download anyway — the estimate is worked out from track lengths, so it can be
                      wrong. The device&apos;s storage limit still applies: the run downloads what
                      genuinely fits and stops when the folder is actually full.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {running && (
            <RunStatusBar
              trackIds={runTrackIds}
              progress={progress}
              status={runStatus}
              startedAt={startedAt}
              onStop={cancel}
            />
          )}

          {/* Genres are only known for sources that report them — the Music
              app does, a scraped web page generally does not — so the row is
              simply absent when there is nothing to filter by. */}
          {genreOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-5 py-3">
              <span className="mr-1 text-xs text-text-muted">Genre</span>
              <button
                onClick={() => setGenres(new Set())}
                aria-pressed={genres.size === 0}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  genres.size === 0
                    ? 'bg-accent text-ink'
                    : 'bg-surface-2 text-text-muted hover:text-text'
                }`}
              >
                All
              </button>
              {genreOptions.map(([genre, count]) => {
                const on = genres.has(genre)
                return (
                  <button
                    key={genre}
                    aria-pressed={on}
                    onClick={() =>
                      setGenres((prev) => {
                        const next = new Set(prev)
                        if (next.has(genre)) next.delete(genre)
                        else next.add(genre)
                        return next
                      })
                    }
                    className={`tabular rounded-full px-2.5 py-1 text-xs transition-colors ${
                      on ? 'bg-accent text-ink' : 'bg-surface-2 text-text-muted hover:text-text'
                    }`}
                  >
                    {genre} <span className="opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Sticky so the select-all control and the column meaning stay
              available however far down a long playlist you scroll. */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-surface/95 px-4 py-2 backdrop-blur">
            <label className="flex shrink-0 cursor-pointer items-center gap-3 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  // Partial selection is neither on nor off.
                  if (el) el.indeterminate = visibleSelected > 0 && !allSelected
                }}
                disabled={running}
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    for (const track of visible) {
                      if (allSelected) next.delete(track.id)
                      else next.add(track.id)
                    }
                    return next
                  })
                }
                className="h-4 w-4"
              />
              {allSelected ? 'Select none' : 'Select all'}
              {(filter.trim() || genres.size > 0 || hidingPresent) &&
                ` (${visible.length} shown)`}
            </label>

            {alreadyHere > 0 && !allowDuplicates && (
              <button
                onClick={() => setShowPresent((v) => !v)}
                className="shrink-0 text-xs text-text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-text"
              >
                {hidingPresent
                  ? `${alreadyHere} already on this device — show`
                  : `${alreadyHere} already on this device — hide`}
              </button>
            )}

            <div className="relative ml-auto w-56">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by title, artist, album"
                aria-label="Filter tracks"
                className="min-h-8 w-full rounded-lg border border-control/40 bg-surface-2 pr-2 pl-7 text-xs"
              />
            </div>
          </div>

          <ul className="max-h-[26rem] divide-y divide-hairline/60 overflow-y-auto">
            {visible.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                selected={selected.has(track.id)}
                disabled={running}
                state={progress[track.id]}
                onDevice={isAlreadyPresent(onDevice, track.artist, track.title)}
                onToggle={toggle}
              />
            ))}
          </ul>

          {bigImport && (
            <div className="border-b border-hairline px-5 py-4">
              <p className="text-sm font-medium text-warn">
                Large import — this will take a while
              </p>
              <p className="mt-1.5 text-sm text-text-muted">
                {needMatching} tracks have to be found on YouTube first. TuneVault works through
                them in batches of 25 with a pause in between, and paces its searches, so Google
                does not rate-limit you. A song it has matched before is remembered, so running
                this again is much faster. Roughly {estimateMinutes(needMatching)} for this run.
                {localCopies > 0 && ` ${localCopies} tracks are files you already own and copy instantly.`}
              </p>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5">
            <p className="tabular text-sm text-text-muted">
              {lastSummary
                ? [
                    `${lastSummary.completed} downloaded`,
                    lastSummary.skipped ? `${lastSummary.skipped} already there` : '',
                    lastSummary.failed ? `${lastSummary.failed} failed` : '',
                    lastSummary.cancelled ? 'stopped early' : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : alreadyHere === tracks.length && tracks.length > 0
                  ? 'Nothing new — every track here is already on this device.'
                  : 'Shift-click to select a range.'}
              {lastSummary?.errors[0] && (
                <span className="block text-danger">{lastSummary.errors[0].message}</span>
              )}
            </p>
            <div className="flex gap-2">
              {!running && (
                <Button
                  variant="primary"
                  disabled={selected.size === 0 || !(preflight?.fits || ignoreEstimate)}
                  onClick={() => {
                    if (!playlist) return
                    const ids = [...selected]
                    setRunTrackIds(ids)
                    void start({ deviceId, playlist, trackIds: ids, ignoreEstimate })
                  }}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                  Download {selected.size} {selected.size === 1 ? 'track' : 'tracks'}
                </Button>
              )}
            </div>
          </footer>
        </div>
      )}
    </section>
  )
}
