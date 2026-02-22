import { Howl } from 'howler'

type AudioEventCallback = () => void
type SeekCallback = (seek: number) => void

export class AudioEngine {
  private howl: Howl | null = null
  private soundId: number | null = null
  private seekInterval: ReturnType<typeof setInterval> | null = null
  private onEndCallback: AudioEventCallback | null = null
  private onSeekUpdate: SeekCallback | null = null
  private onLoadCallback: ((duration: number) => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null
  private _playing = false

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
      html5: false, // Use Web Audio API — fully buffers the file so seeking always works
      volume: 1,
      onend: () => {
        this._playing = false
        this.stopSeekUpdates()
        this.onEndCallback?.()
      },
      onplay: (id) => {
        this.soundId = id
        this._playing = true
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
    if (!this.howl) return
    if (this.soundId != null) {
      this.howl.play(this.soundId)
    } else {
      this.soundId = this.howl.play()
    }
    this._playing = true
    this.startSeekUpdates()
  }

  pause(): void {
    if (this.howl && this.soundId != null) {
      this.howl.pause(this.soundId)
    } else {
      this.howl?.pause()
    }
    this._playing = false
    this.stopSeekUpdates()
  }

  stop(): void {
    this.howl?.stop()
    this._playing = false
    this.stopSeekUpdates()
  }

  seek(time: number): void {
    if (!this.howl) return
    if (this.soundId != null) {
      this.howl.seek(time, this.soundId)
    } else {
      this.howl.seek(time)
    }
    if (this._playing) {
      // Re-ensure playback continues after seeking with html5 audio
      if (this.soundId != null) {
        this.howl.play(this.soundId)
      } else {
        this.howl.play()
      }
      this.startSeekUpdates()
    }
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
    this.soundId = null
    this._playing = false
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
