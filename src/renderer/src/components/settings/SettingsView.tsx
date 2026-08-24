import { useState } from 'react'
import type { AudioFormat } from '../../../../shared/models'
import { api } from '../../lib/api'
import { useSettingsStore } from '../../store/settingsStore'
import { toastError } from '../../store/toastStore'
import { Button } from '../ui/Button'

const BROWSERS = ['chrome', 'brave', 'chromium', 'edge', 'firefox', 'opera', 'safari', 'vivaldi', 'whale']

const FORMATS: { value: AudioFormat; label: string; hint: string }[] = [
  { value: 'mp3', label: 'MP3 320kbps', hint: 'Plays on every iPod. Full tags and cover art.' },
  { value: 'flac', label: 'FLAC', hint: 'Lossless and large. Tagged by yt-dlp, not TuneVault.' },
  { value: 'opus', label: 'Opus', hint: 'Smallest files. Not all players support it.' }
]

export function SettingsView(): React.JSX.Element {
  const { settings, update } = useSettingsStore()
  const [movedNote, setMovedNote] = useState(false)

  if (!settings) return <div className="p-8 text-sm text-text-muted">Loading…</div>

  const pickFolder = async (): Promise<void> => {
    try {
      const dir = await api.settings.pickFolder()
      if (!dir) return
      await update({ musicRoot: dir })
      setMovedNote(true)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-9 pt-4 pb-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-6">
        <h2 className="font-medium">Music folder</h2>
        <p className="text-sm text-text-muted">Every device gets a subfolder here.</p>
        <div className="flex items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
            {settings.musicRoot}
          </code>
          <Button onClick={() => void pickFolder()}>Change…</Button>
        </div>
        {movedNote && (
          <p className="text-sm text-warn">
            Existing device folders stayed where they were. Move them here by hand if you want them
            together.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-6">
        <h2 className="font-medium">Audio format</h2>
        <div className="space-y-2">
          {FORMATS.map((format) => (
            <label
              key={format.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-surface-2"
            >
              <input
                type="radio"
                name="audioFormat"
                checked={settings.audioFormat === format.value}
                onChange={() => void update({ audioFormat: format.value })}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium">{format.label}</span>
                <span className="block text-xs text-text-muted">{format.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-6">
        <div>
          <h2 className="font-medium">Sign-in for downloads</h2>
          <p className="mt-1 text-sm text-text-muted">
            YouTube challenges anonymous traffic far more often than a signed-in session, so using
            your own cookies is the biggest single thing that reduces rate limiting.
          </p>
          <p className="mt-2 text-sm text-warn">
            Cookies are login credentials. They are passed to yt-dlp on this machine only — never
            logged, stored or sent anywhere by TuneVault. Bulk downloading while signed in does
            carry some risk to the account you use, so prefer a secondary account.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="cookieMode" className="block text-sm font-medium">
            Cookie source
          </label>
          <select
            id="cookieMode"
            value={settings.cookieMode}
            onChange={(e) =>
              void update({ cookieMode: e.target.value as 'off' | 'browser' | 'file' })
            }
            className="min-h-11 w-full rounded-[10px] border border-control/50 bg-surface-2 px-3 text-sm"
          >
            <option value="off">Don't use cookies (anonymous)</option>
            <option value="browser">From a browser on this Mac</option>
            <option value="file">From an exported cookies.txt</option>
          </select>
        </div>

        {settings.cookieMode === 'browser' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="cookieBrowser" className="block text-sm font-medium">
                Browser
              </label>
              <select
                id="cookieBrowser"
                value={settings.cookieBrowser}
                onChange={(e) => void update({ cookieBrowser: e.target.value })}
                className="min-h-11 w-full rounded-[10px] border border-control/50 bg-surface-2 px-3 text-sm"
              >
                {BROWSERS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="cookieProfile" className="block text-sm font-medium">
                Profile (optional)
              </label>
              <input
                id="cookieProfile"
                value={settings.cookieProfile}
                onChange={(e) => void update({ cookieProfile: e.target.value })}
                placeholder="Default"
                className="min-h-11 w-full rounded-[10px] border border-control/50 bg-surface-2 px-3 text-sm"
              />
            </div>
            <p className="text-xs text-text-muted sm:col-span-2">
              The profile is how you pick between accounts — each browser profile is signed into a
              different one. Chrome names them <span className="font-mono">Default</span>,{' '}
              <span className="font-mono">Profile 1</span>, <span className="font-mono">Profile 2</span>;
              Firefox uses names like <span className="font-mono">default-release</span>. Leave it
              blank for the default profile. Reading Chrome cookies asks for Keychain access, and
              Safari needs Full Disk Access.
            </p>
          </div>
        )}

        {settings.cookieMode === 'file' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Cookie file</label>
            <div className="flex items-center gap-3">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
                {settings.cookieFile || 'No file chosen'}
              </code>
              <Button
                onClick={() =>
                  void api.settings
                    .pickCookieFile()
                    .then(async (file) => {
                      if (file) await update({ cookieFile: file })
                    })
                    .catch(toastError)
                }
              >
                Choose…
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              A Netscape-format cookies.txt exported from a browser extension. Use this for an
              account that is not signed into a browser on this Mac.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-6">
        <div className="space-y-2">
          <label htmlFor="concurrency" className="block font-medium">
            Simultaneous downloads
          </label>
          <input
            id="concurrency"
            type="range"
            min={1}
            max={8}
            value={settings.concurrency}
            onChange={(e) => void update({ concurrency: Number(e.target.value) })}
            className="w-full"
          />
          <p className="text-sm text-text-muted">
            {settings.concurrency} at a time. Higher is faster but more likely to get rate limited.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 border-t border-hairline pt-4">
          <input
            type="checkbox"
            checked={settings.metadataEnrichment}
            onChange={(e) => void update({ metadataEnrichment: e.target.checked })}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium">Look up metadata while downloading</span>
            <span className="block text-xs text-text-muted">
              Fetches genre, album, year and cover art from MusicBrainz and iTunes. Slower —
              MusicBrainz allows one request per second — but the files arrive properly tagged.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 border-t border-hairline pt-4">
          <input
            type="checkbox"
            checked={settings.allowDuplicates}
            onChange={(e) => void update({ allowDuplicates: e.target.checked })}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium">Allow the same song more than once</span>
            <span className="block text-xs text-text-muted">
              Off by default: a song already on a device is skipped when another playlist wants it,
              instead of being downloaded and stored twice. Turn this on if you want each playlist
              folder to hold its own complete copy.
            </span>
          </span>
        </label>
      </section>
    </div>
  )
}
