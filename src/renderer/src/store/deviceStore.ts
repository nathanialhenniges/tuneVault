import { create } from 'zustand'
import type { Device, DeviceUsage } from '../../../shared/models'
import { api } from '../lib/api'

interface DeviceState {
  devices: Device[]
  /** Keyed by device id. Absent until the first usage fetch resolves. */
  usage: Record<string, DeviceUsage>
  loading: boolean
  load: () => Promise<void>
  refreshUsage: (id: string) => Promise<void>
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  usage: {},
  loading: true,
  load: async () => {
    const devices = await api.devices.list()
    set({ devices, loading: false })
    // Walking each folder is I/O — fire them off together, update as they land.
    await Promise.all(devices.map((d) => get().refreshUsage(d.id)))
  },
  refreshUsage: async (id) => {
    try {
      const usage = await api.devices.usage(id)
      set((s) => ({ usage: { ...s.usage, [id]: usage } }))
    } catch {
      // Device was deleted mid-flight; the next load() will drop it.
    }
  }
}))
