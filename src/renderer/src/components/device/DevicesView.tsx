import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpenIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { Device } from '../../../../shared/models'
import { api } from '../../lib/api'
import { useDeviceStore } from '../../store/deviceStore'
import { toastError } from '../../store/toastStore'
import { Button } from '../ui/Button'
import { PageHeader } from '../ui/PageHeader'
import { DeviceFormModal } from './DeviceFormModal'
import { DeviceUsageBar } from './DeviceUsageBar'

export function DevicesView(): React.JSX.Element {
  const { devices, usage, loading, load } = useDeviceStore()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Device | undefined>()

  useEffect(() => api.onMenu('menu:new-device', () => setCreating(true)), [])

  const openFolder = async (id: string): Promise<void> => {
    try {
      await api.devices.openFolder(id)
    } catch (err) {
      toastError(err)
    }
  }

  // The confirmation is a native alert sheet raised by the main process, so
  // there is nothing to render here — just reload if it went ahead.
  const remove = async (id: string): Promise<void> => {
    try {
      if (await api.devices.remove(id)) await load()
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-9 pt-4 pb-12">
      <PageHeader
        eyebrow="Library"
        title="Devices"
        subtitle="Each device is a folder with a storage limit. Fill it here, then drag the files across."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add device
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-text-muted">Loading devices…</p>
      ) : devices.length === 0 ? (
        <div className="rise rounded-2xl border border-dashed border-hairline bg-surface/40 px-10 py-14 text-center">
          <p className="font-display text-lg">No devices yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
            Add one for each player you fill. Name it after the device and give it the size of the
            device, so nothing you download can overflow it.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => setCreating(true)}>
            Add your first device
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {devices.map((device, i) => (
            <li
              key={device.id}
              style={{ '--i': i } as React.CSSProperties}
              className="rise rounded-2xl border border-hairline bg-surface p-6 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]"
            >
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg" title={device.name}>
                    {device.name}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-text-muted" title={device.dir}>
                    {device.dir}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(device)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void remove(device.id)}>
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>

              <DeviceUsageBar usage={usage[device.id]} />

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  to={`/devices/${device.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-accent px-4 text-sm font-medium text-ink transition-colors hover:bg-accent-hover"
                >
                  Manage device
                </Link>
                <Button onClick={() => void openFolder(device.id)}>
                  <FolderOpenIcon className="h-4 w-4" aria-hidden="true" />
                  Open folder
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DeviceFormModal open={creating} onClose={() => setCreating(false)} />
      <DeviceFormModal open={!!editing} device={editing} onClose={() => setEditing(undefined)} />
    </div>
  )
}
