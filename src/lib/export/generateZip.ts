import JSZip from 'jszip'
import type { BugReport } from '@/types/report'
import { imageUrlToBlob } from '@/lib/image'
import { getFrameFileName, getIncludedFrames } from '@/lib/report/reportData'
import { generateJson } from '@/lib/report/generateJson'
import { generateMarkdown } from '@/lib/report/generateMarkdown'

export async function generateZipReport(report: BugReport): Promise<Blob> {
  const zip = new JSZip()
  const framesFolder = zip.folder('frames')

  if (!framesFolder) {
    throw new Error('Could not create the frames folder for ZIP export.')
  }

  zip.file('bug-report.md', generateMarkdown(report, { imageBasePath: 'frames' }))
  zip.file('metadata.json', generateJson(report))

  for (const frame of getIncludedFrames(report)) {
    const pngBlob = await imageUrlToBlob(frame.imageUrl, 'image/png')
    framesFolder.file(getFrameFileName(frame.timestampMs), pngBlob)
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
