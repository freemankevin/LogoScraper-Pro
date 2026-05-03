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
