import { describe, expect, it } from 'vitest'
import { validateVideoFile } from './validateVideoFile'

function isoVideo(name = 'recording.mp4', type = 'video/mp4') {
  return new File([
    new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
  ], name, { type })
}

describe('validateVideoFile', () => {
  it('accepts an MP4 with an ISO media header', async () => {
    await expect(validateVideoFile(isoVideo())).resolves.toEqual({ valid: true })
  })

  it('rejects video MIME types outside the supported extension allowlist', async () => {
    const file = new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], 'recording.mkv', {
      type: 'video/x-matroska',
    })

    await expect(validateVideoFile(file)).resolves.toMatchObject({ valid: false })
  })

  it('rejects a renamed non-video file', async () => {
    const file = new File(['plain text'], 'notes.mp4', { type: 'video/mp4' })

    await expect(validateVideoFile(file)).resolves.toMatchObject({
      valid: false,
      message: expect.stringContaining('valid MP4 video header'),
    })
  })
})
