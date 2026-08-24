import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import type { Playlist } from '../../../../shared/models'
import type { Preflight } from '../../../../preload'
import { formatBytes, formatDuration } from '../../../../shared/utils'
import { api } from '../../lib/api'
import { useDownloadStore } from '../../store/downloadStore'
import { toastError } from '../../store/toastStore'
import { Button } from '../ui/Button'
import { CapacityGauge } from '../ui/CapacityGauge'
import { Thumbnail } from '../ui/Thumbnail'
import { TrackRow } from './TrackRow'

const PROVIDER_LABEL = { youtube: 'YouTube', apple: 'Apple Music', spotify: 'Spotify' }

export function AddMusicPanel({ deviceId }: { deviceId: string }): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [resolving, setResolving] = useState(false)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  /** Anchor for shift-click range selection. */
  const lastToggled = useRef<number | null>(null)

  const { running, progress, lastSummary, start, cancel } = useDownloadStore()

  const resolve = async (): Promise<void> => {
    if (!url.trim() || resolving) return
    setResolving(true)
    setPlaylist(null)
    setPreflight(null)
    try {
      const result = await api.resolvePlaylist(url.trim())
      setPlaylist(result)
      setSelected(new Set(result.tracks.map((t) => t.id)))
      lastToggled.current = null
    } catch (err) {
      toastError(err)
    } finally {
      setResolving(false)
    }
  }

  const tracks = playlist?.tracks ?? []
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
        const turningOn = !next.has(tracks[index].id)
        for (let i = from; i <= to; i++) {
          if (turningOn) next.add(tracks[i].id)
          else next.delete(tracks[i].id)
        }
      } else {
        const id = tracks[index].id
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      return next
    })
    lastToggled.current = index
  }

  const allSelected = tracks.length > 0 && selected.size === tracks.length

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
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void resolve()}
            placeholder="Paste a Spotify, YouTube or Apple Music playlist or album link"
            className="min-h-11 flex-1 rounded-[10px] border border-control/50 bg-surface-2 px-3 text-sm"
          />
          <Button
            variant="primary"
            disabled={!url.trim() || resolving}
            onClick={() => void resolve()}
          >
            {resolving ? 'Reading…' : 'Load'}
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          Spotify and Apple Music links are read for their track list, then each song is found and
          downloaded from YouTube — those services have no free audio of their own.
        </p>
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
                <p className="mt-2.5 text-sm font-medium text-danger">
                  Needs {formatBytes(preflight.shortfallBytes)} more room. Deselect some tracks,
                  free space on the device, or raise its storage limit.
                </p>
              )}
            </div>
          )}

          {/* Sticky so the select-all control and the column meaning stay
              available however far down a long playlist you scroll. */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-surface/95 px-4 py-2 backdrop-blur">
            <label className="flex cursor-pointer items-center gap-3 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  // Partial selection is neither on nor off.
                  if (el) el.indeterminate = selected.size > 0 && !allSelected
                }}
                disabled={running}
                onChange={() =>
                  setSelected(allSelected ? new Set() : new Set(tracks.map((t) => t.id)))
                }
                className="h-4 w-4"
              />
              {allSelected ? 'Select none' : 'Select all'}
            </label>
            <span className="ml-auto w-36 text-right text-xs text-text-muted">
              {running ? 'Status' : 'Length'}
            </span>
          </div>

          <ul className="max-h-[26rem] divide-y divide-hairline/60 overflow-y-auto">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                selected={selected.has(track.id)}
                disabled={running}
                state={progress[track.id]}
                onToggle={toggle}
              />
            ))}
          </ul>

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
                : 'Shift-click to select a range.'}
              {lastSummary?.errors[0] && (
                <span className="block text-danger">{lastSummary.errors[0].message}</span>
              )}
            </p>
            <div className="flex gap-2">
              {running ? (
                <Button variant="danger" onClick={cancel}>
                  Stop
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={selected.size === 0 || !preflight?.fits}
                  onClick={() =>
                    playlist && void start({ deviceId, playlist, trackIds: [...selected] })
                  }
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
