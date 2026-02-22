import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  add: (message: string, type: ToastType) => void
  dismiss: (id: string) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, type) => {
    const id = String(++nextId)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

export const toast = {
  success: (message: string): void => useToastStore.getState().add(message, 'success'),
  error: (message: string): void => useToastStore.getState().add(message, 'error'),
  info: (message: string): void => useToastStore.getState().add(message, 'info')
}
