/**
 * Resize and compress a file to JPEG data URL for optional product storage in `image_url`.
 * Keeps largest dimension at most `maxDim` px to limit DB payload size.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDim = 420,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file"))
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        let { width, height } = img
        const scale = Math.min(1, maxDim / Math.max(width, height))
        width = Math.max(1, Math.round(width * scale))
        height = Math.max(1, Math.round(height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error("Could not process image"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/webp", quality)
        URL.revokeObjectURL(url)
        if (dataUrl.length > 450000) {
          reject(new Error("Image is still too large; try a smaller original file"))
          return
        }
        resolve(dataUrl)
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read image"))
    }
    img.src = url
  })
}
