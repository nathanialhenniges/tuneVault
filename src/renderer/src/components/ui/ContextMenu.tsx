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
    zIndex: 200
  }

  return (
    <div ref={menuRef} style={style} className="min-w-[180px] py-1 bg-bg-raised border border-border-default rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary'
          }`}
        >
          {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
