import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { audioEngine } from '../lib/audioEngine'

export function usePlayer(): void {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const setSeek = usePlayerStore((s) => s.setSeek)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying)
  const next = usePlayerStore((s) => s.next)

  const prevTrackId = useRef<string | null>(null)

  // Load new track
  useEffect(() => {
    if (!currentTrack?.filePath) return
    if (currentTrack.id === prevTrackId.current) return
    prevTrackId.current = currentTrack.id

    const loadTrack = async (): Promise<void> => {
      const url = await window.api.getFileUrl(currentTrack.filePath!)

      // Pass all callbacks BEFORE loading to avoid race conditions
      audioEngine.load(url, {
        onLoad: (duration) => {
          setDuration(duration)
          audioEngine.play()
          setIsPlaying(true)
        },
        onEnd: () => {
          next()
        },
        onSeek: (seek) => {
          setSeek(seek)
        },
        onError: (error) => {
          console.error('Audio playback error:', error)
          setIsPlaying(false)
        }
      })
    }

    loadTrack()
  }, [currentTrack?.id])

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
}
