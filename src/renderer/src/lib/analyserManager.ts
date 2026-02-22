import { Howler } from 'howler'

class AnalyserManager {
  private analyser: AnalyserNode | null = null
  private connected = false

  getAnalyser(): AnalyserNode | null {
    const ctx = Howler.ctx
    if (!ctx) return null

    if (!this.analyser) {
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8
    }

    if (!this.connected) {
      const masterGain = (Howler as unknown as { masterGain: GainNode }).masterGain
      if (masterGain) {
        masterGain.connect(this.analyser)
        this.connected = true
      }
    }

    return this.analyser
  }
}

export const analyserManager = new AnalyserManager()
