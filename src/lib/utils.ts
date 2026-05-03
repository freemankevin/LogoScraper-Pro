import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}

/** 从搜索词/URL 中提取干净的文件名主体 */
export function sanitizeDownloadName(input: string): string {
  let name = input.toLowerCase().trim()

  // 识别 URL/域名，提取 hostname
  if (name.includes('://') || (name.includes('.') && !name.includes(' '))) {
    try {
      const url = name.includes('://') ? new URL(name) : new URL('https://' + name)
      name = url.hostname
    } catch {
      // 不是合法 URL，保持原样
    }
  }

  // 去掉 www. 前缀
  name = name.replace(/^www\./, '')

  // 取主域名部分（去掉 TLD）
  const parts = name.split('.')
  if (parts.length >= 2) {
    name = parts[parts.length - 2]
  }

  // 只允许字母、数字、下划线、中划线
  return name.replace(/[^a-z0-9_-]/g, '_')
}

/** 安全的 Unicode 文本 → base64（替代 btoa，支持中文等非 ASCII） */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const bin = Array.from(bytes).map((b) => String.fromCharCode(b)).join('')
  return btoa(bin)
}

/** 安全的 base64 → Unicode 文本（替代 atob，支持中文等非 ASCII） */
export function base64ToText(base64: string): string {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/** 将 SVG 文本转为 data URL（自动选择最优编码方式） */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 从 data URL 中提取文本内容（支持 base64 和 URL-encoded） */
export function dataUrlToText(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return dataUrl
  const header = dataUrl.slice(0, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  if (header.includes('base64')) {
    return base64ToText(payload)
  }
  return decodeURIComponent(payload)
}

/** 严格校验 SVG 字符串的完整性和合法性 */
export function isValidSvg(s: string | null | undefined): s is string {
  if (typeof s !== 'string') return false
  const t = s.trim()
  // 必须包含 <svg 开头和 </svg> 结尾
  if (!t.startsWith('<svg') || !t.includes('</svg>')) return false
  // 过滤空壳 SVG（WASM 对小图标转换可能产出 <svg></svg> 这种无实质内容的文件）
  // 阈值设为 50：Simple Icons 等优化后的品牌 SVG 可能只有 100~200 字节
  if (t.length < 50) return false
  return true
}
