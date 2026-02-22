import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { audioEngine } from '../lib/audioEngine'

export function usePlayer(): void {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const playbackRate = usePlayerStore((s) => s.playbackRate)
  const crossfadeDuration = usePlayerStore((s) => s.crossfadeDuration)
  const setSeek = usePlayerStore((s) => s.setSeek)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying)
  const next = usePlayerStore((s) => s.next)

  const prevTrackId = useRef<string | null>(null)
  const wasPlaying = useRef(false)

  // Load new track
  useEffect(() => {
    if (!currentTrack?.filePath) return
    if (currentTrack.id === prevTrackId.current) return

    const shouldCrossfade = crossfadeDuration > 0 && wasPlaying.current && prevTrackId.current !== null
    prevTrackId.current = currentTrack.id

    const loadTrack = async (): Promise<void> => {
      const url = await window.api.getFileUrl(currentTrack.filePath!)

      const callbacks = {
        onLoad: (duration: number) => {
          setDuration(duration)
          if (!shouldCrossfade) {
            audioEngine.play()
          }
          setIsPlaying(true)
        },
        onEnd: () => {
          wasPlaying.current = false
          next()
        },
        onSeek: (seek: number) => {
          setSeek(seek)
        },
        onError: (error: string) => {
          console.error('Audio playback error:', error)
          setIsPlaying(false)
        }
      }

      if (shouldCrossfade) {
        // Pass all callbacks BEFORE loading to avoid race conditions
        audioEngine.loadNext(url, callbacks)
        audioEngine.crossfadeTo(crossfadeDuration)
      } else {
        audioEngine.load(url, callbacks)
      }
    }

    loadTrack()
  }, [currentTrack?.id])

  // Track playing state for crossfade detection
  useEffect(() => {
    wasPlaying.current = isPlaying
  }, [isPlaying])

  // Play/Pause
  useEffect(() => {
    if (!currentTrack) return
    if (isPlaying) {
      audioEngine.play()
    } else {
      audioEngine.pause()
    }
  }, [isPlaying])

  // Volume
  useEffect(() => {
    audioEngine.setVolume(volume)
  }, [volume])

  // Playback rate
  useEffect(() => {
    audioEngine.setRate(playbackRate)
  }, [playbackRate])
}
