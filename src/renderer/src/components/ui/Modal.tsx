import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface ModalProps {
  open: boolean
  onClose?: () => void
  className?: string
  children: ReactNode
}

export function Modal({ open, onClose, className, children }: ModalProps): JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, onClose)

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={`glass-modal glass-reveal ${className ?? ''}`}
        style={{ borderRadius: 'var(--radius-panel)' }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
