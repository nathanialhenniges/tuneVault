import { XMarkIcon } from '@heroicons/react/24/outline'
import { useToastStore } from '../../store/toastStore'

const TONES = {
  info: 'border-hairline bg-surface-2',
  success: 'border-ok/40 bg-surface-2',
  error: 'border-danger/50 bg-surface-2'
}

export function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useToastStore()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-96 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl ${TONES[toast.kind]}`}
        >
          <p className="flex-1 text-sm leading-snug break-words">{toast.message}</p>
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            className="rounded p-1 text-text-muted hover:text-text"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
