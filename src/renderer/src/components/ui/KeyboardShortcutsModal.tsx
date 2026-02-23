import { useCallback } from 'react'
import { create } from 'zustand'
import { Modal } from './Modal'

export const useShortcutOverlayStore = create<{
  open: boolean
  toggle: () => void
  close: () => void
}>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false })
}))

const shortcuts = [
  { keys: 'Space', description: 'Play / Pause' },
  { keys: '\u2190 / \u2192', description: 'Seek \u00b15s' },
  { keys: '\u2318/Ctrl + \u2190 / \u2192', description: 'Prev / Next track' },
  { keys: '\u2191 / \u2193', description: 'Volume \u00b15%' },
  { keys: '?', description: 'Toggle this overlay' }
]

export function KeyboardShortcutsModal(): JSX.Element | null {
  const open = useShortcutOverlayStore((s) => s.open)
  const close = useShortcutOverlayStore((s) => s.close)
  const stableClose = useCallback(() => close(), [close])

  return (
    <Modal open={open} onClose={stableClose} className="p-8 max-w-md mx-4">
      <h2 id="shortcuts-title" className="text-xl font-bold mb-6">Keyboard Shortcuts</h2>

      <div className="space-y-3">
        {shortcuts.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-4">
            <span className="text-sm text-text-secondary">{s.description}</span>
            <kbd className="px-2.5 py-1 text-xs font-mono bg-glass-hover border border-[var(--glass-border-edge)] rounded-md text-text-primary whitespace-nowrap">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>

      <button
        onClick={close}
        className="mt-6 w-full py-2.5 bg-glass-hover hover:bg-glass-active border border-[var(--glass-border-edge)] rounded-lg text-sm font-medium transition"
      >
        Close
      </button>
    </Modal>
  )
}
