import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { PlaylistSource } from '../../../../shared/models'
import { PROVIDER_LABEL } from '../../../../shared/utils'
import { api } from '../../lib/api'
import { useDeviceStore } from '../../store/deviceStore'
import { toastError } from '../../store/toastStore'
import { Button } from '../ui/Button'

interface Props {
  deviceId: string
  sources: PlaylistSource[]
  busy: boolean
  onCheck: (url: string) => void
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * Playlists this device has already been filled from.
 *
 * A playlist you keep adding to is the normal case, so re-checking one is a
 * button rather than a re-paste. The check bypasses the resolve cache and
 * preselects only the tracks that are not on the device yet.
 */
export function SavedPlaylists({ deviceId, sources, busy, onCheck }: Props): React.JSX.Element | null {
  const reload = useDeviceStore((s) => s.load)
  if (sources.length === 0) return null

  const forget = async (url: string): Promise<void> => {
    try {
      await api.devices.forgetSource(deviceId, url)
      await reload()
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg">Playlists you've added</h2>
      <ul className="divide-y divide-hairline/60 overflow-hidden rounded-2xl border border-hairline bg-surface">
        {sources.map((source) => (
          <li key={source.url} className="flex items-center gap-3 px-5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-tight">{source.title}</span>
              <span className="tabular block truncate text-xs leading-tight text-text-muted">
                {PROVIDER_LABEL[source.provider]} · {source.trackCount} tracks · checked{' '}
                {ago(source.lastCheckedAt)}
              </span>
            </span>
            <Button size="sm" disabled={busy} onClick={() => onCheck(source.url)}>
              <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
              Check for new
            </Button>
            <button
              onClick={() => void forget(source.url)}
              aria-label={`Forget ${source.title}`}
              title="Forget this playlist (files stay)"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-text-muted/50 transition-colors hover:bg-surface-2 hover:text-text"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
