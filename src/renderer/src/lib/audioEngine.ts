import { Howl } from 'howler'

type AudioEventCallback = () => void
type SeekCallback = (seek: number) => void

export class AudioEngine {
  private howl: Howl | null = null
  private seekInterval: ReturnType<typeof setInterval> | null = null
  private onEndCallback: AudioEventCallback | null = null
  private onSeekUpdate: SeekCallback | null = null
  private onLoadCallback: ((duration: number) => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null

  load(
    src: string,
    callbacks?: {
      onLoad?: (duration: number) => void
      onEnd?: () => void
      onSeek?: (seek: number) => void
      onError?: (error: string) => void
    }
  ): void {
    this.unload()

    // Register callbacks BEFORE creating Howl to avoid race conditions
    if (callbacks?.onLoad) this.onLoadCallback = callbacks.onLoad
    if (callbacks?.onEnd) this.onEndCallback = callbacks.onEnd
    if (callbacks?.onSeek) this.onSeekUpdate = callbacks.onSeek
    if (callbacks?.onError) this.onErrorCallback = callbacks.onError

    this.howl = new Howl({
      src: [src],
      html5: true, // Use HTML5 Audio for local file:// URLs in Electron
      volume: 1,
      onend: () => {
        this.stopSeekUpdates()
        this.onEndCallback?.()
      },
      onload: () => {
        const duration = this.howl?.duration() ?? 0
        this.onLoadCallback?.(duration)
      },
      onloaderror: (_id, error) => {
        console.error('Howler load error:', error)
        this.onErrorCallback?.(String(error))
      },
      onplayerror: (_id, error) => {
        console.error('Howler play error:', error)
        // Attempt to unlock audio context and retry
        if (this.howl) {
          this.howl.once('unlock', () => {
            this.howl?.play()
          })
        }
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

  unload(): void {
    this.stopSeekUpdates()
    if (this.howl) {
      this.howl.unload()
      this.howl = null
    }
    this.onEndCallback = null
    this.onSeekUpdate = null
    this.onLoadCallback = null
    this.onErrorCallback = null
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
