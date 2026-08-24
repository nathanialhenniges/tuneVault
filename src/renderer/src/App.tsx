import { useEffect } from 'react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { DevicesView } from './components/device/DevicesView'
import { DeviceDetailView } from './components/device/DeviceDetailView'
import { SettingsView } from './components/settings/SettingsView'
import { DisclaimerModal } from './components/ui/DisclaimerModal'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { Toaster } from './components/ui/Toaster'
import { useDeviceStore } from './store/deviceStore'
import { useDownloadStore } from './store/downloadStore'
import { useSettingsStore } from './store/settingsStore'
import { api } from './lib/api'

export function App(): React.JSX.Element {
  const { settings, loading, load, update } = useSettingsStore()
  const loadDevices = useDeviceStore((s) => s.load)
  const applyProgress = useDownloadStore((s) => s.applyProgress)
  const applyRunStatus = useDownloadStore((s) => s.applyRunStatus)

  useEffect(() => {
    void load()
    void loadDevices()
  }, [load, loadDevices])

  // One subscription for the whole app; the store fans it out by track id.
  useEffect(() => api.downloads.onProgress(applyProgress), [applyProgress])
  useEffect(() => api.downloads.onRunStatus(applyRunStatus), [applyRunStatus])

  if (loading) {
    return <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>
  }

  return (
    <ErrorBoundary>
      <MemoryRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/devices" replace />} />
            <Route path="/devices" element={<DevicesView />} />
            <Route path="/devices/:id" element={<DeviceDetailView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/devices" replace />} />
          </Routes>
        </MainLayout>
      </MemoryRouter>
      <DisclaimerModal
        open={!settings?.disclaimerAccepted}
        onAccept={() => void update({ disclaimerAccepted: true })}
      />
      <Toaster />
    </ErrorBoundary>
  )
}
