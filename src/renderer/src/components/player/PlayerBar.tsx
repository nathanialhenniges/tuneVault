import { useState } from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { audioEngine } from '../../lib/audioEngine'
import { NowPlaying } from './NowPlaying'
import { VolumeControl } from './VolumeControl'
import { QueueView } from './QueueView'
import type { RepeatMode } from '../../store/playerStore'
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  QueueListIcon
} from '@heroicons/react/24/solid'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function RepeatIcon({ mode }: { mode: RepeatMode }): JSX.Element {
  return (
    <span className="relative">
      <ArrowPathIcon className="w-4 h-4" />
      {mode === 'one' && (
        <span className="absolute -top-1 -right-1.5 text-[8px] font-bold">1</span>
      )}
    </span>
  )
}

export function PlayerBar(): JSX.Element {
  const [showQueue, setShowQueue] = useState(false)

  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const seek = usePlayerStore((s) => s.seek)
  const duration = usePlayerStore((s) => s.duration)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const repeat = usePlayerStore((s) => s.repeat)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const setRepeat = usePlayerStore((s) => s.setRepeat)
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const time = parseFloat(e.target.value)
    audioEngine.seek(time)
    usePlayerStore.getState().setSeek(time)
  }

  const cycleRepeat = (): void => {
    const modes: RepeatMode[] = ['off', 'all', 'one']
    const idx = modes.indexOf(repeat)
    setRepeat(modes[(idx + 1) % modes.length])
  }

  return (
    <div className="h-24 bg-bg-surface border-t border-border-default flex items-center px-4 gap-4 relative transition-colors duration-200">
      <NowPlaying />

      <div className="flex-1 flex flex-col items-center gap-1">
        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={`transition ${shuffle ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
            title="Shuffle"
          >
            <ArrowsRightLeftIcon className="w-4 h-4" />
          </button>

          <button onClick={prev} className="text-text-secondary hover:text-text-primary transition">
            <BackwardIcon className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-9 h-9 flex items-center justify-center bg-accent text-text-inverted rounded-full hover:bg-accent-hover hover:scale-105 disabled:opacity-50 transition"
          >
            {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>

          <button onClick={next} className="text-text-secondary hover:text-text-primary transition">
            <ForwardIcon className="w-5 h-5" />
          </button>

          <button
            onClick={cycleRepeat}
            className={`transition ${repeat !== 'off' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
            title={`Repeat: ${repeat}`}
          >
            <RepeatIcon mode={repeat} />
          </button>
        </div>

        {/* Seek bar */}
        <div className="flex items-center gap-2 w-full max-w-lg">
          <span className="text-xs text-text-muted w-10 text-right">{formatTime(seek)}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={seek}
            onChange={handleSeek}
            className="flex-1 h-1 appearance-none bg-bg-inset rounded-full cursor-pointer"
          />
          <span className="text-xs text-text-muted w-10">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 w-64 justify-end relative">
        <VolumeControl />
        <button
          onClick={() => setShowQueue(!showQueue)}
          className="text-text-secondary hover:text-text-primary transition"
          title="Queue"
        >
          <QueueListIcon className="w-5 h-5" />
        </button>
        <QueueView open={showQueue} onClose={() => setShowQueue(false)} />
      </div>
    </div>
  )
}
