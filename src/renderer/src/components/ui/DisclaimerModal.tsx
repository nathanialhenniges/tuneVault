import { useState, useEffect } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Modal } from './Modal'

const DISCLAIMER_KEY = 'tunevault:disclaimer-accepted'

export function DisclaimerModal(): JSX.Element | null {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem(DISCLAIMER_KEY)
    if (!accepted) setShow(true)
  }, [])

  const handleAccept = (): void => {
    localStorage.setItem(DISCLAIMER_KEY, 'true')
    setShow(false)
  }

  return (
    <Modal open={show} className="p-8 max-w-lg mx-4">
      <div className="flex items-center gap-3 mb-4">
        <ExclamationTriangleIcon className="w-8 h-8 text-accent shrink-0" />
        <h2 id="disclaimer-title" className="text-xl font-bold">Disclaimer</h2>
      </div>

      <div className="space-y-3 text-sm text-text-secondary mb-6">
        <p>
          <strong className="text-text-primary">TuneVault</strong> is provided strictly for
          <strong className="text-text-primary"> educational and personal use only</strong>.
        </p>
        <p>
          Downloading copyrighted content without the permission of the copyright holder may
          violate applicable laws in your jurisdiction. You are solely responsible for ensuring
          that your use of this software complies with all applicable local, state, national,
          and international laws and regulations.
        </p>
        <p>
          The developers of TuneVault do not endorse, encourage, or condone the illegal
          downloading or distribution of copyrighted material. By using this software, you
          acknowledge that you do so <strong className="text-text-primary">at your own risk</strong>.
        </p>
        <p className="text-text-muted text-xs">
          This software is not affiliated with or endorsed by YouTube or Google.
        </p>
      </div>

      <button
        onClick={handleAccept}
        className="w-full py-3 bg-accent hover:bg-accent-hover text-text-inverted rounded-lg text-sm font-medium transition"
      >
        I Understand & Accept
      </button>
    </Modal>
  )
}
