const barConfigs = [
  { duration: '0.8s', delay: '0s' },
  { duration: '1.1s', delay: '0.15s' },
  { duration: '0.7s', delay: '0.3s' },
  { duration: '1.3s', delay: '0.1s' },
  { duration: '0.9s', delay: '0.4s' }
]

export function PlaylistLoader(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-end gap-[5px] h-14">
        {barConfigs.map((cfg, i) => (
          <div
            key={i}
            className="w-[6px] h-14 rounded-full bg-accent"
            style={{
              transformOrigin: 'bottom',
              animation: `equalizerPulse ${cfg.duration} ${cfg.delay} ease-in-out infinite`,
              boxShadow: '0 0 8px var(--accent-glow)'
            }}
          />
        ))}
      </div>
      <span
        className="text-base text-text-secondary"
        style={{ animation: 'textPulse 2s ease-in-out infinite' }}
      >
        Fetching playlist...
      </span>
    </div>
  )
}
