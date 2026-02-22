import { Howl } from 'howler'

type AudioEventCallback = () => void
type SeekCallback = (seek: number) => void

export class AudioEngine {
  private howl: Howl | null = null
  private seekInterval: ReturnType<typeof setInterval> | null = null
  private onEndCallback: AudioEventCallback | null = null
  private onSeekUpdate: SeekCallback | null = null
  private onLoadCallback: ((duration: number) => void) | null = null

  load(src: string): void {
    this.unload()

    this.howl = new Howl({
      src: [src],
      html5: false, // Use Web Audio for Electron compatibility
      volume: 1,
      onend: () => {
        this.stopSeekUpdates()
        this.onEndCallback?.()
      },
      onload: () => {
        const duration = this.howl?.duration() ?? 0
        this.onLoadCallback?.(duration)
      }
    })
  }

  play(): void {
    this.howl?.play()
    this.startSeekUpdates()
  }

  pause(): void {
    this.howl?.pause()
    this.stopSeekUpdates()
  }

  stop(): void {
    this.howl?.stop()
    this.stopSeekUpdates()
  }

  seek(time: number): void {
    this.howl?.seek(time)
  }

  setVolume(volume: number): void {
    this.howl?.volume(volume)
  }

  getSeek(): number {
    return (this.howl?.seek() as number) ?? 0
  }

  getDuration(): number {
    return this.howl?.duration() ?? 0
  }

  isPlaying(): boolean {
    return this.howl?.playing() ?? false
  }

  onEnd(callback: AudioEventCallback): void {
    this.onEndCallback = callback
  }

  onLoad(callback: (duration: number) => void): void {
    this.onLoadCallback = callback
  }

  onSeek(callback: SeekCallback): void {
    this.onSeekUpdate = callback
  }

  unload(): void {
    this.stopSeekUpdates()
    if (this.howl) {
      this.howl.unload()
      this.howl = null
    }
  }

  private startSeekUpdates(): void {
    this.stopSeekUpdates()
    this.seekInterval = setInterval(() => {
      if (this.howl?.playing()) {
        const seek = this.howl.seek() as number
        this.onSeekUpdate?.(seek)
      }
    }, 250)
  }

  private stopSeekUpdates(): void {
    if (this.seekInterval) {
      clearInterval(this.seekInterval)
      this.seekInterval = null
    }
  }
}

export const audioEngine = new AudioEngine()
