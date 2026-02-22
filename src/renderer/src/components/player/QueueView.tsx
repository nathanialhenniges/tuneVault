import { usePlayerStore } from '../../store/playerStore'

interface QueueViewProps {
  open: boolean
  onClose: () => void
}

export function QueueView({ open, onClose }: QueueViewProps): JSX.Element | null {
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const play = usePlayerStore((s) => s.play)

  if (!open) return null

  const upcoming = queue.slice(queueIndex + 1)

  return (
    <div className="absolute bottom-full right-0 mb-2 w-80 max-h-96 bg-bg-raised border border-border-default rounded-xl shadow-2xl overflow-hidden transition-colors duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <h3 className="text-sm font-semibold">Up Next</h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xs">
          Close
        </button>
      </div>

      <div className="overflow-y-auto max-h-80">
        {upcoming.length === 0 ? (
          <p className="text-sm text-text-muted p-4 text-center">Queue is empty</p>
        ) : (
          upcoming.map((track, i) => (
            <button
              key={`${track.id}-${i}`}
              onClick={() => {
                setQueue(queue, queueIndex + 1 + i)
                play()
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-bg-surface-hover transition text-left"
            >
              <span className="text-xs text-text-muted w-5">{i + 1}</span>
              <img
                src={track.thumbnailUrl}
                alt=""
                className="w-8 h-8 rounded object-cover bg-bg-surface"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{track.title}</p>
                <p className="text-xs text-text-muted truncate">{track.artist}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
