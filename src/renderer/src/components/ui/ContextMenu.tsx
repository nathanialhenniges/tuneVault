import { useEffect, useRef } from 'react'

interface ContextMenuItem {
  label: string
  icon?: JSX.Element
  onClick: () => void
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Keep menu in viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 200,
    borderRadius: 'var(--radius-card)'
  }

  return (
    <div ref={menuRef} style={style} className="min-w-[180px] py-1.5 px-1 glass-float glass-border-float glass-reveal">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition rounded-[8px] ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
          }`}
        >
          {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
