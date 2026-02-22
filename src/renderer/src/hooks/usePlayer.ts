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
      audioEngine.load(url)
      audioEngine.onLoad((duration) => {
        setDuration(duration)
        audioEngine.play()
        setIsPlaying(true)
      })
      audioEngine.onEnd(() => {
        next()
      })
      audioEngine.onSeek((seek) => {
        setSeek(seek)
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
