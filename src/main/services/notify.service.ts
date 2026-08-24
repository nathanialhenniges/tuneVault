import { app, Notification, type BrowserWindow } from 'electron'
import type { RunSummary } from './download.service'

/**
 * A native notification is right only when the user is not looking at the
 * window — a long download finishing while they are in another app. When the
 * window is focused the in-app result is already visible, and a banner on top
 * of it is noise. One notification per batch, never per track.
 */
export function notifyRunFinished(
  window: BrowserWindow | null,
  playlistTitle: string,
  summary: RunSummary
): void {
  if (!window || window.isDestroyed()) return
  const focused = window.isFocused() && window.isVisible() && !window.isMinimized()
  if (focused || summary.cancelled || !Notification.isSupported()) return

  const failed = summary.failed > 0
  const notification = new Notification({
    title: failed ? 'Download finished with errors' : 'Download complete',
    subtitle: playlistTitle,
    body: failed
      ? `${summary.completed} added, ${summary.failed} failed.`
      : `${summary.completed} ${summary.completed === 1 ? 'track' : 'tracks'} ready to copy across.`,
    silent: false
  })
  // A notification that does nothing when clicked is broken.
  notification.on('click', () => {
    window.show()
    window.focus()
  })
  notification.show()

  if (summary.completed > 0) app.badgeCount = summary.completed
}

/** Clear the dock badge once the user has actually looked at the window. */
export function clearBadgeOnFocus(window: BrowserWindow): void {
  window.on('focus', () => {
    app.badgeCount = 0
  })
}
