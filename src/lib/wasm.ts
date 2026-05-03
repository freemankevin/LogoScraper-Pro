/// Rust WASM 懒加载封装
/// 提供图像压缩、格式转换、矢量化能力

export interface WasmModule {
  compress_image(data: Uint8Array, max_width: number, quality: number): Uint8Array
  image_to_svg(data: Uint8Array, target_size: number): string
  convert_format(data: Uint8Array, target_format: string): Uint8Array
}

let wasmModule: WasmModule | null = null
let wasmLoading: Promise<WasmModule> | null = null

async function loadWasmInternal(): Promise<WasmModule> {
  try {
    // 动态导入 wasm-pack 构建产物
    // @ts-ignore — WASM 模块在 build:wasm 后生成
    const mod = await import('../wasm/logo_scraper.js')
    await mod.default()
    return mod as unknown as WasmModule
  } catch (e) {
    console.warn('[WASM] Load failed, falling back to JS:', e)
    throw e
  }
}

export async function loadWasm(): Promise<WasmModule> {
  if (wasmModule) return wasmModule
  if (!wasmLoading) {
    wasmLoading = loadWasmInternal().then((m) => {
      wasmModule = m
      return m
    })
  }
  return wasmLoading
}

export async function compressImageWithWasm(
  dataUrl: string,
  maxWidth = 512,
  quality = 85
): Promise<string> {
  try {
    const wasm = await loadWasm()
    const binary = dataUrlToBytes(dataUrl)
    const compressed = wasm.compress_image(binary, maxWidth, quality)
    return bytesToDataUrl(compressed, 'image/png')
  } catch {
    // fallback: 返回原图
    return dataUrl
  }
}

export async function convertToSvgWithWasm(
  dataUrl: string,
  targetSize = 256
): Promise<string | null> {
  try {
    const wasm = await loadWasm()
    const binary = dataUrlToBytes(dataUrl)
    const svg = wasm.image_to_svg(binary, targetSize)
    return svg
  } catch (e) {
    console.warn('[WASM] SVG conversion failed:', e)
    return null
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('')
  const base64 = btoa(binary)
  return `data:${mime};base64,${base64}`
}
