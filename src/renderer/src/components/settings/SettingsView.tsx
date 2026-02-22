import { useSettingsStore } from '../../store/settingsStore'
import type { AudioFormat } from '../../../../shared/models'

export function SettingsView(): JSX.Element {
  const { settings, update, selectMusicDir } = useSettingsStore()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* Music Directory */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Music Directory</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={settings.musicDir}
            readOnly
            className="flex-1 bg-bg-surface border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-secondary"
          />
          <button
            onClick={selectMusicDir}
            className="px-4 py-2.5 bg-bg-surface-hover hover:bg-bg-inset border border-border-default rounded-lg text-sm transition"
          >
            Browse
          </button>
        </div>
      </div>

      {/* Audio Format */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Audio Format</label>
        <div className="flex gap-3">
          {(['flac', 'opus', 'mp3'] as AudioFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => update({ audioFormat: fmt })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                settings.audioFormat === fmt
                  ? 'bg-accent text-text-inverted'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-hover'
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Concurrency */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Simultaneous Downloads
        </label>
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => update({ concurrency: n })}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                settings.concurrency === n
                  ? 'bg-accent text-text-inverted'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-hover'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Theme</label>
        <div className="flex gap-3">
          {(['dark', 'light', 'system'] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => update({ theme })}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                settings.theme === theme
                  ? 'bg-accent text-text-inverted'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-hover'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
