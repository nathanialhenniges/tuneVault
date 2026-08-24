import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, FolderOpenIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { DeviceFile } from '../../../../shared/models'
import { api } from '../../lib/api'
import { useDeviceStore } from '../../store/deviceStore'
import { useDownloadStore } from '../../store/downloadStore'
import { toastError } from '../../store/toastStore'
import { AddMusicPanel } from '../download/AddMusicPanel'
import { Button } from '../ui/Button'
import { PageHeader } from '../ui/PageHeader'
import { DeviceFormModal } from './DeviceFormModal'
import { DeviceFileList } from './DeviceFileList'
import { DeviceUsageBar } from './DeviceUsageBar'
import { ImportPanel } from './ImportPanel'

export function DeviceDetailView(): React.JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { devices, usage, refreshUsage, load } = useDeviceStore()
  const running = useDownloadStore((s) => s.running)

  const [files, setFiles] = useState<DeviceFile[]>([])
  const [editing, setEditing] = useState(false)

  const device = devices.find((d) => d.id === id)

  const loadFiles = useCallback(async () => {
    if (!id) return
    try {
      setFiles(await api.devices.tracks(id))
    } catch {
      setFiles([])
    }
  }, [id])

  // Refresh the file list and the gauge whenever a download run finishes.
  useEffect(() => {
    if (running) return
    void loadFiles()
    if (id) void refreshUsage(id)
  }, [running, loadFiles, id, refreshUsage])

  // Menu bar: File > Open Device Folder acts on whichever device is open.
  useEffect(() => {
    if (!id) return undefined
    return api.onMenu('menu:open-folder', () => void api.devices.openFolder(id).catch(toastError))
  }, [id])

  if (!device) {
    return (
      <div className="mx-auto max-w-4xl px-9 pt-4 pb-12">
        <p className="text-sm text-text-muted">That device no longer exists.</p>
        <Link to="/devices" className="mt-4 inline-block text-sm text-accent underline">
          Back to devices
        </Link>
      </div>
    )
  }

  const removeDevice = async (): Promise<void> => {
    try {
      if (await api.devices.remove(device.id)) {
        await load()
        navigate('/devices')
      }
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-9 pt-4 pb-12">
      <Link
        to="/devices"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        Devices
      </Link>

      <header className="rise rounded-2xl border border-hairline bg-surface p-6">
        <PageHeader
          eyebrow="Device"
          title={device.name}
          actions={
            <>
              <Button
                variant="primary"
                onClick={() => void api.devices.openFolder(device.id).catch(toastError)}
              >
                <FolderOpenIcon className="h-4 w-4" aria-hidden="true" />
                Open folder
              </Button>
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="ghost" onClick={() => void removeDevice()}>
                <TrashIcon className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </>
          }
        />
        <p className="-mt-5 mb-6 truncate text-xs text-text-muted" title={device.dir}>
          {device.dir}
        </p>
        <DeviceUsageBar usage={usage[device.id]} />
      </header>

      <AddMusicPanel deviceId={device.id} />

      <ImportPanel deviceId={device.id} onImported={() => void loadFiles()} />

      <section className="space-y-3">
        <h2 className="font-display text-lg">
          On this device{' '}
          <span className="tabular text-sm font-normal text-text-muted">
            ({files.length} {files.length === 1 ? 'file' : 'files'})
          </span>
        </h2>
        <DeviceFileList
          deviceId={device.id}
          files={files}
          onChanged={async () => {
            await loadFiles()
            await refreshUsage(device.id)
          }}
        />
      </section>

      <DeviceFormModal open={editing} device={device} onClose={() => setEditing(false)} />
    </div>
  )
}
