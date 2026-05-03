/**
 * SVG → PNG 前端实时转换器
 * 用户下载 PNG 时，把 SVG 渲染到 Canvas 再导出
 */

export async function svgToPng(
  svgString: string,
  options: { width?: number; height?: number; scale?: number } = {}
): Promise<{ dataUrl: string; width: number; height: number; blob: Blob }> {
  const { scale = 2 } = options

  // 解析 SVG 尺寸
  let width = options.width ?? 512
  let height = options.height ?? 512

  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgEl = doc.querySelector('svg')

  if (svgEl) {
    const vw = parseFloat(svgEl.getAttribute('width') || '')
    const vh = parseFloat(svgEl.getAttribute('height') || '')
    const vb = svgEl.getAttribute('viewBox')
    if (vb) {
      const parts = vb.split(/\s+|,/).map(Number)
      if (parts.length >= 4) {
        width = parts[2] || width
        height = parts[3] || height
      }
    } else if (vw && vh) {
      width = vw
      height = vh
    }
  }

  const canvasWidth = Math.round(width * scale)
  const canvasHeight = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')!

  // 白色背景（大多数 Logo 需要）
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const img = new Image()
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
      URL.revokeObjectURL(url)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'))
            return
          }
          const reader = new FileReader()
          reader.onloadend = () => {
            resolve({
              dataUrl: reader.result as string,
              width: canvasWidth,
              height: canvasHeight,
              blob,
            })
          }
          reader.readAsDataURL(blob)
        },
        'image/png',
        1.0
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG image load failed'))
    }
    img.src = url
  })
}

/** 直接触发 PNG 下载 */
export async function downloadSvgAsPng(
  svgString: string,
  filename: string,
  options?: { width?: number; height?: number; scale?: number }
): Promise<void> {
  const { dataUrl } = await svgToPng(svgString, options)
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.click()
}
