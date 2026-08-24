import { useCallback, useEffect, useState } from 'react'
import { DocumentPlusIcon } from '@heroicons/react/24/outline'
import type { ImportResult } from '../../../../preload'
import { api } from '../../lib/api'
import { useDeviceStore } from '../../store/deviceStore'
import { useFileDrop } from '../../hooks/useFileDrop'
import { Button } from '../ui/Button'

interface Props {
  deviceId: string
  onImported: () => void
}

function describe(result: ImportResult): string {
  const parts: string[] = []
  if (result.copied) parts.push(`${result.copied} added`)
  if (result.skipped) parts.push(`${result.skipped} already there`)
  if (result.refused) parts.push(`${result.refused} did not fit`)
  if (result.rejected) parts.push(`${result.rejected} not audio`)
  if (result.errors.length) parts.push(`${result.errors.length} failed`)
  return parts.length ? parts.join(' · ') : 'Nothing to add.'
}

/**
 * Drag files in from Finder, or pick them with the native file dialog. Results
 * are reported inline rather than as a toast — the panel you dropped onto is
 * where you are already looking.
 */
export function ImportPanel({ deviceId, onImported }: Props): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const refreshUsage = useDeviceStore((s) => s.refreshUsage)

  const importPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length || busy) return
      setBusy(true)
      setResult(null)
      try {
        const outcome = await api.devices.importFiles(deviceId, paths)
        setResult(outcome)
        await refreshUsage(deviceId)
        onImported()
      } catch (err) {
        setResult({
          copied: 0,
          skipped: 0,
          rejected: 0,
          refused: 0,
          errors: [{ name: '', message: err instanceof Error ? err.message : String(err) }]
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, deviceId, onImported, refreshUsage]
  )

  const { dragging } = useFileDrop(importPaths)

  const pick = useCallback(async (): Promise<void> => {
    const paths = await api.devices.pickAudioFiles()
    await importPaths(paths)
  }, [importPaths])

  useEffect(() => api.onMenu('menu:import', () => void pick()), [pick])

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        dragging ? 'border-accent bg-accent/10' : 'border-dashed border-hairline bg-surface'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Add your own files</h2>
          <p className="mt-1 text-sm text-text-muted">
            {dragging
              ? 'Drop to copy them onto this device.'
              : 'Drag audio files here from Finder, or choose them. Originals are copied, not moved.'}
          </p>
        </div>
        <Button disabled={busy} onClick={() => void pick()}>
          <DocumentPlusIcon className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Copying…' : 'Choose files…'}
        </Button>
      </div>

      {result && (
        <p
          className={`mt-4 text-sm ${
            result.errors.length || result.refused ? 'text-warn' : 'text-text-muted'
          }`}
        >
          {describe(result)}
          {result.refused > 0 &&
            ' — the device is at its storage limit. Free space or raise the limit.'}
          {result.errors[0]?.message && ` ${result.errors[0].message}`}
        </p>
      )}
    </section>
  )
}
