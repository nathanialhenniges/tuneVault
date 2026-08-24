import { Button } from './Button'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onAccept: () => void
}

/**
 * Shown once, before anything can be downloaded. Unlike the 2.x version this
 * names every service the app can pull from, not just YouTube.
 */
export function DisclaimerModal({ open, onAccept }: Props): React.JSX.Element {
  return (
    <Modal
      open={open}
      title="Before you start"
      onClose={() => undefined}
      footer={
        <Button variant="primary" onClick={onAccept}>
          I understand
        </Button>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-text-muted">
        <p>
          TuneVault is a personal case-study project. It is not a commercial product and is not
          affiliated with, endorsed by, or connected to Spotify, Apple, YouTube, Google or
          SoundCloud.
        </p>
        <p>
          Downloading content you do not own or have no right to copy may breach those services&apos;
          terms and your local copyright law. You are solely responsible for what you download and
          what you do with it.
        </p>
        <p>Use it for content you own or are licensed to keep. Everything else is on you.</p>
      </div>
    </Modal>
  )
}
