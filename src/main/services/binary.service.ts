import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'

function getPlatformDir(): string {
  switch (process.platform) {
    case 'darwin':
      return 'mac'
    case 'win32':
      return 'win'
    default:
      return 'linux'
  }
}

function getExtension(): string {
  return process.platform === 'win32' ? '.exe' : ''
}

function getResourcesPath(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'resources', 'bin', getPlatformDir())
  }
  return join(process.resourcesPath, 'bin')
}

export class BinaryService {
  private basePath: string

  constructor() {
    this.basePath = getResourcesPath()
  }

  getYtdlpPath(): string {
    const p = join(this.basePath, `yt-dlp${getExtension()}`)
    if (!existsSync(p)) {
      throw new Error(
        `yt-dlp binary not found at ${p}. Run "npm run download-binaries" first.`
      )
    }
    return p
  }

  getFfmpegPath(): string {
    const p = join(this.basePath, `ffmpeg${getExtension()}`)
    if (!existsSync(p)) {
      throw new Error(
        `ffmpeg binary not found at ${p}. Run "npm run download-binaries" first.`
      )
    }
    return p
  }

  getFfprobePath(): string {
    const p = join(this.basePath, `ffprobe${getExtension()}`)
    if (!existsSync(p)) {
      throw new Error(
        `ffprobe binary not found at ${p}. Run "npm run download-binaries" first.`
      )
    }
    return p
  }
}
