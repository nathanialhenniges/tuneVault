import { useEffect, useState } from 'react'
import type { Device } from '../../../../shared/models'
import { GB } from '../../../../shared/utils'
import { api } from '../../lib/api'
import { useDeviceStore } from '../../store/deviceStore'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  open: boolean
  /** Omit to create a new device. */
  device?: Device
  onClose: () => void
}

const PRESETS = [8, 16, 32, 64, 128, 160]

export function DeviceFormModal({ open, device, onClose }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [capacityGB, setCapacityGB] = useState('32')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reload = useDeviceStore((s) => s.load)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(device?.name ?? '')
    setCapacityGB(device ? String(+(device.capacityBytes / GB).toFixed(2)) : '32')
  }, [open, device])

  const gb = Number(capacityGB)
  const valid = name.trim().length > 0 && Number.isFinite(gb) && gb > 0

  const submit = async (): Promise<void> => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const capacityBytes = Math.round(gb * GB)
      if (device) {
        await api.devices.update(device.id, { name: name.trim(), capacityBytes })
      } else {
        await api.devices.create(name.trim(), capacityBytes)
      }
      await reload()
      onClose()
    } catch (err) {
      // Reported in the form, next to the field that caused it — a toast in the
      // corner would be reporting a failure away from where it happened.
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={device ? 'Edit device' : 'Add a device'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || busy} onClick={() => void submit()}>
            {device ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="space-y-2">
          <label htmlFor="device-name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="device-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nathanial's iPod"
            className="min-h-11 w-full rounded-lg border border-hairline bg-surface-2 px-3 text-sm"
          />
          <p className="text-xs text-text-muted">
            This becomes the folder name inside your music folder.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="device-cap" className="block text-sm font-medium">
            Storage limit
          </label>
          <div className="flex items-center gap-2">
            <input
              id="device-cap"
              type="number"
              min={1}
              step="any"
              value={capacityGB}
              onChange={(e) => setCapacityGB(e.target.value)}
              className="min-h-11 w-32 rounded-lg border border-hairline bg-surface-2 px-3 text-sm"
            />
            <span className="text-sm text-text-muted">GB</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                onClick={() => setCapacityGB(String(preset))}
              >
                {preset} GB
              </Button>
            ))}
          </div>
          <p className="text-xs text-text-muted">
            Downloads that would push this folder past the limit are refused. Nothing is ever
            deleted automatically.
          </p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  )
}
