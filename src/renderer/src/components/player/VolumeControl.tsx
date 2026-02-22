import { usePlayerStore } from '../../store/playerStore'

export function VolumeControl(): JSX.Element {
  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)

  const icon = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
        className="text-sm text-text-secondary hover:text-text-primary transition"
      >
        {icon}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="w-24 h-1 appearance-none bg-bg-inset rounded-full cursor-pointer"
      />
    </div>
  )
}
