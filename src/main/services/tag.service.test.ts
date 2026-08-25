import { describe, it, expect } from 'vitest'
import { decodeSynchsafe } from './tag.service'

describe('decodeSynchsafe', () => {
  it('decodes seven bits per byte', () => {
    // 0x00 0x00 0x02 0x01 -> (2 << 7) | 1
    expect(decodeSynchsafe(Buffer.from([0x00, 0x00, 0x02, 0x01]))).toBe(257)
  })

  it('ignores the high bit of every byte', () => {
    const clean = decodeSynchsafe(Buffer.from([0x00, 0x00, 0x02, 0x01]))
    const withHighBits = decodeSynchsafe(Buffer.from([0x80, 0x80, 0x82, 0x81]))
    expect(withHighBits).toBe(clean)
  })

  it('decodes the maximum representable size', () => {
    expect(decodeSynchsafe(Buffer.from([0x7f, 0x7f, 0x7f, 0x7f]))).toBe(268435455)
  })

  it('decodes zero', () => {
    expect(decodeSynchsafe(Buffer.from([0, 0, 0, 0]))).toBe(0)
  })
})
