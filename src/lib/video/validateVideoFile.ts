const ALLOWED_EXTENSIONS = new Set(['mp4', 'mov', 'webm'])
const ALLOWED_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])

export type VideoValidationResult =
  | { valid: true }
  | { valid: false; message: string }

export async function validateVideoFile(file: File): Promise<VideoValidationResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      message: `Unsupported format: "${file.name}". Use .mp4, .webm, or .mov.`,
    }
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      valid: false,
      message: `"${file.name}" is not recognized as a supported video recording.`,
    }
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const isWebM =
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  const isIsoMedia =
    header.length >= 12 &&
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70

  if ((extension === 'webm' && !isWebM) || (extension !== 'webm' && !isIsoMedia)) {
    return {
      valid: false,
      message: `"${file.name}" does not contain a valid ${extension.toUpperCase()} video header.`,
    }
  }

  return { valid: true }
}
