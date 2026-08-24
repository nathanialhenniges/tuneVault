import { BrowserWindow, dialog, ipcMain, nativeImage } from 'electron'
import { promises as fs } from 'fs'
import { IPC } from '../../shared/ipc-channels'
import type { AppSettings, DownloadRequest, Track } from '../../shared/models'
import { formatBytes } from '../../shared/utils'
import { DeviceService } from '../services/device.service'
import { DownloadService } from '../services/download.service'
import { notifyRunFinished } from '../services/notify.service'
import { resolvePlaylist } from '../services/resolve'
import { SettingsService } from '../services/settings.service'

type GetWindow = () => BrowserWindow | null

/**
 * Destructive confirmations are native alert sheets, not in-app modals: they
 * are parented to the window, they honour Return and Escape, and they look like
 * every other confirmation on the machine.
 *
 * `cancelId` is always set explicitly. Electron otherwise guesses it from the
 * button labels, and a wrong guess maps the Escape key onto the destructive
 * button.
 */
async function confirmDestructive(
  window: BrowserWindow | null,
  options: { message: string; detail: string; confirmLabel: string }
): Promise<boolean> {
  const config: Electron.MessageBoxOptions = {
    type: 'warning',
    message: options.message,
    detail: options.detail,
    buttons: [options.confirmLabel, 'Cancel'],
    defaultId: 1, // Return picks the safe option
    cancelId: 1
  }
  const { response } = window
    ? await dialog.showMessageBox(window, config)
    : await dialog.showMessageBox(config)
  return response === 0
}

/**
 * Thin IPC layer: every handler unwraps arguments, calls one service, and lets
 * errors propagate — Electron turns a thrown error into a rejected promise in
 * the renderer, which the UI surfaces where the action happened.
 */
export function registerIpc(getWindow: GetWindow): void {
  // --- Playlists ---
  ipcMain.handle(IPC.PLAYLIST_RESOLVE, (_e, url: string) => resolvePlaylist(url))

  // --- Devices ---
  ipcMain.handle(IPC.DEVICE_LIST, () => DeviceService.list())
  ipcMain.handle(IPC.DEVICE_CREATE, (_e, name: string, capacityBytes: number) =>
    DeviceService.create(name, capacityBytes)
  )
  ipcMain.handle(
    IPC.DEVICE_UPDATE,
    (_e, id: string, patch: { name?: string; capacityBytes?: number }) =>
      DeviceService.update(id, patch)
  )
  ipcMain.handle(IPC.DEVICE_DELETE, async (_e, id: string) => {
    const device = DeviceService.get(id)
    const usage = await DeviceService.usage(id).catch(() => null)
    const window = getWindow()

    const config: Electron.MessageBoxOptions = {
      type: 'warning',
      message: `Remove “${device.name}” from TuneVault?`,
      detail: usage?.trackCount
        ? `${usage.trackCount} ${usage.trackCount === 1 ? 'track' : 'tracks'} (${formatBytes(
            usage.usedBytes
          )}) are in this folder. Choose whether to keep them on disk.`
        : 'The folder is empty.',
      buttons: usage?.trackCount
        ? ['Remove and Move Files to Trash', 'Remove, Keep Files', 'Cancel']
        : ['Remove', 'Cancel'],
      defaultId: usage?.trackCount ? 1 : 0,
      cancelId: usage?.trackCount ? 2 : 1
    }
    const { response } = window
      ? await dialog.showMessageBox(window, config)
      : await dialog.showMessageBox(config)

    if (!usage?.trackCount) {
      if (response !== 0) return false
      await DeviceService.remove(id, { deleteFiles: false })
      return true
    }
    if (response === 2) return false
    await DeviceService.remove(id, { deleteFiles: response === 0 })
    return true
  })
  ipcMain.handle(IPC.DEVICE_USAGE, (_e, id: string) => DeviceService.usage(id))
  ipcMain.handle(IPC.DEVICE_OPEN_FOLDER, (_e, id: string) => DeviceService.openFolder(id))
  ipcMain.handle(IPC.DEVICE_TRACKS, (_e, id: string) => DeviceService.tracks(id))
  ipcMain.handle(IPC.DEVICE_REVEAL_TRACK, (_e, id: string, path: string) =>
    DeviceService.revealTrack(id, path)
  )
  ipcMain.handle(IPC.DEVICE_DELETE_TRACKS, async (_e, id: string, paths: string[]) => {
    if (paths.length === 0) return 0
    // Files go to the Trash, so a single track needs no ceremony. A bulk
    // deletion still deserves a look before it happens.
    if (paths.length > 1) {
      const ok = await confirmDestructive(getWindow(), {
        message: `Move ${paths.length} tracks to the Trash?`,
        detail: 'You can restore them from the Trash if you change your mind.',
        confirmLabel: 'Move to Trash'
      })
      if (!ok) return 0
    }
    return DeviceService.deleteTracks(id, paths)
  })
  ipcMain.handle(IPC.DEVICE_IMPORT, (_e, id: string, paths: string[]) =>
    DeviceService.importFiles(id, paths)
  )
  ipcMain.handle(IPC.DEVICE_PICK_AUDIO, async () => {
    const window = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Add Audio Files',
      buttonLabel: 'Add',
      message: 'Choose audio files to copy onto this device.',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio', extensions: ['mp3', 'flac', 'opus', 'm4a', 'ogg', 'wav', 'aac', 'aiff'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })

  // Dragging a downloaded track out to Finder — the whole point of the app is
  // getting these files onto a device, so it should drag like a real file.
  ipcMain.on(IPC.DRAG_OUT, (event, filePaths: string[]) => {
    if (!filePaths.length) return
    event.sender.startDrag({
      files: filePaths,
      file: filePaths[0],
      // startDrag requires an icon; an empty one makes macOS fall back to its
      // own file-type icon, which is what the user expects under the cursor.
      icon: nativeImage.createEmpty()
    })
  })

  // --- Downloads ---
  ipcMain.handle(IPC.DOWNLOAD_PREFLIGHT, (_e, deviceId: string, tracks: Track[]) =>
    DownloadService.preflight(deviceId, tracks)
  )
  ipcMain.handle(IPC.DOWNLOAD_START, async (_e, request: DownloadRequest) => {
    const summary = await DownloadService.start(request, (progress) => {
      getWindow()?.webContents.send(IPC.DOWNLOAD_PROGRESS, progress)
    })
    getWindow()?.webContents.send(IPC.DOWNLOAD_DONE, summary)
    notifyRunFinished(getWindow(), request.playlist.title, summary)
    return summary
  })
  ipcMain.handle(IPC.DOWNLOAD_CANCEL, (_e, runId?: string) =>
    runId ? DownloadService.cancel(runId) : DownloadService.cancelAll()
  )

  // --- Settings ---
  ipcMain.handle(IPC.SETTINGS_GET, () => SettingsService.load())
  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: Partial<AppSettings>) =>
    SettingsService.save(patch)
  )
  ipcMain.handle(IPC.SETTINGS_PICK_FOLDER, async () => {
    const window = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Choose Music Folder',
      buttonLabel: 'Choose',
      message: 'TuneVault creates one folder in here per device.',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const dir = result.canceled ? null : (result.filePaths[0] ?? null)
    if (dir) await fs.mkdir(dir, { recursive: true })
    return dir
  })
}

/** Called on quit so a half-finished yt-dlp child never outlives the app. */
export function shutdownIpc(): void {
  DownloadService.cancelAll()
}
