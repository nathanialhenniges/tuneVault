export function TitleBar(): JSX.Element {
  return (
    <div
      className="drag-region h-12 flex items-center justify-end px-4 border-b border-[var(--glass-border-edge)] transition-colors duration-200"
      style={{
        background: 'var(--glass-titlebar-bg)',
        backdropFilter: 'blur(var(--glass-blur-chrome))',
        WebkitBackdropFilter: 'blur(var(--glass-blur-chrome))'
      }}
    >
      {/* macOS traffic lights are in the sidebar; this is just a drag region */}
    </div>
  )
}
