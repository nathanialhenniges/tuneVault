import { useEffect, useState } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { api } from '../../lib/api'
import { toastError } from '../../store/toastStore'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'

interface Props {
  deviceId: string
  onDone: () => void | Promise<void>
}

interface Progress {
  done: number
  total: number
  name: string
  filled: number
}

/**
 * Fills in tags the files on a device are missing.
 *
 * Imported files are copied byte-for-byte, so they arrive with whatever gaps
 * the original had — often no genre, year or cover art. This backfills them
 * without touching anything a file already says about itself.
 */
export function EnrichPanel({ deviceId, onDone }: Props): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => api.devices.onEnrichProgress(setProgress), [])

  const run = async (): Promise<void> => {
    setRunning(true)
    setResult(null)
    setProgress(null)
    try {
      const summary = await api.devices.enrich(deviceId)
      setResult(
        summary.scanned === 0
          ? 'Every track already has full metadata.'
          : `${summary.filled} of ${summary.scanned} updated${summary.cancelled ? ' before stopping' : ''}.`
      )
      await onDone()
    } catch (err) {
      toastError(err)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-5">
      <div className="min-w-0">
        <h2 className="font-medium">Fill in missing metadata</h2>
        <p className="mt-1 text-sm text-text-muted">
          Looks up genre, album, year and cover art for tracks that are missing them, and leaves
          everything else untouched. Files you drag in keep whatever tags they came with, so this
          is what gives them artwork.
        </p>
        {running && progress && (
          <div className="mt-3 max-w-md space-y-1.5">
            <ProgressBar
              percent={progress.total > 0 ? (progress.done / progress.total) * 100 : undefined}
              label="Filling in metadata"
            />
            <p className="tabular truncate text-xs text-text-muted">
              {progress.done} of {progress.total} · {progress.filled} updated
              {progress.name && ` · ${progress.name}`}
            </p>
          </div>
        )}
        {!running && result && <p className="mt-2 text-sm text-text-muted">{result}</p>}
      </div>

      {running ? (
        <Button variant="danger" onClick={() => void api.devices.cancelEnrich(deviceId)}>
          Stop
        </Button>
      ) : (
        <Button onClick={() => void run()}>
          <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          Fill in metadata
        </Button>
      )}
    </section>
  )
}
