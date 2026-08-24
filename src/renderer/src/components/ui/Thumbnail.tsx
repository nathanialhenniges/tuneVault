import { useState } from 'react'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'

interface Props {
  src?: string
  size?: number
  className?: string
}

/**
 * Album art with a graceful empty state. Remote art is loaded lazily and
 * decoded off the main thread — a 500-track playlist would otherwise fetch 500
 * images the moment it resolves.
 */
export function Thumbnail({ src, size = 40, className = '' }: Props): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const box = `${size}px`

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        style={{ width: box, height: box }}
        className={`flex shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted/50 ${className}`}
      >
        <MusicalNoteIcon style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: box, height: box }}
      className={`shrink-0 rounded-md bg-surface-2 object-cover ${className}`}
    />
  )
}
