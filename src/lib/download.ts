/** Triggers a browser file download with the given text content. */
export function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const downloadMarkdown = (content: string) =>
  downloadText(content, 'bug-report.md', 'text/markdown')

export const downloadJson = (content: string) =>
  downloadText(content, 'metadata.json', 'application/json')
