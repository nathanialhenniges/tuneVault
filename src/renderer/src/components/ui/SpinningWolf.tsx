import wolfIcon from '../../assets/wolf-icon.png'

export function SpinningWolf({ size = 80 }: { size?: number }): JSX.Element {
  return (
    <img
      src={wolfIcon}
      alt="Wolf"
      width={size}
      height={size}
      style={{
        animation: 'wolfOiia 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        transformOrigin: 'center center'
      }}
    />
  )
}
