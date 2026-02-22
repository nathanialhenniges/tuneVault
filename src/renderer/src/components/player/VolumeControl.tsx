import { usePlayerStore } from '../../store/playerStore'
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid'

export function VolumeControl(): JSX.Element {
  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)

  const percent = Math.round(volume * 100)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
        className="text-text-secondary hover:text-text-primary transition"
        title={volume === 0 ? 'Unmute' : 'Mute'}
      >
        {volume === 0 ? (
          <SpeakerXMarkIcon className="w-4 h-4" />
        ) : (
          <SpeakerWaveIcon className="w-4 h-4" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="w-20 h-1 appearance-none seek-track rounded-full cursor-pointer"
      />
      <span className="text-xs text-text-muted w-8 text-right">{percent}%</span>
    </div>
  )
}
