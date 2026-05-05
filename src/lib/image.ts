export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load an extracted frame for processing.'))
    image.src = src
  })
}

export async function imageUrlToBlob(
  imageUrl: string,
  mimeType = 'image/png',
  quality?: number,
): Promise<Blob> {
  const image = await loadImageElement(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D context is unavailable in this browser.')
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality)
  })

  if (!blob) {
    throw new Error('Failed to convert a frame into an image file.')
  }

  return blob
}

export async function imageUrlToImageData(
  imageUrl: string,
  width: number,
  height: number,
): Promise<ImageData> {
  const image = await loadImageElement(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D context is unavailable in this browser.')
  }

  context.drawImage(image, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}
