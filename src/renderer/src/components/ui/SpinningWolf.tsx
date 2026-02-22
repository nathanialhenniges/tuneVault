import wolfIcon from '../../assets/wolf-icon.png'

export function SpinningWolf({ size = 80 }: { size?: number }): JSX.Element {
  return (
    <img
      src={wolfIcon}
      alt="Wolf"
      width={size}
      height={size}
      style={{
        animation: 'wolfOiia 1.2s ease-in-out infinite',
        transformOrigin: 'center bottom'
      }}
    />
  )
}
