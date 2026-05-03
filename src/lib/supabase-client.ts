/**
 * Supabase 客户端封装
 * - SVG 上传到 Storage Bucket（logos），不走数据库表
 * - 优先从环境变量读取，否则尝试 localStorage
 * - 未配置时所有操作静默回退
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LogoResult } from '../types/scraper'
import { minifySvg } from './svg-minify'

const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const BUCKET_NAME = 'logos'

/** 清理 Supabase URL，去除多余的路径部分（SDK 会自动添加 /rest/v1/ 等） */
function cleanSupabaseUrl(rawUrl: string): string {
  let url = rawUrl.trim()
  // 去除尾部斜杠
  if (url.endsWith('/')) url = url.slice(0, -1)
  // 去除多余的 /rest/v1、/storage/v1、/auth/v1 路径（SDK 会自动添加）
  url = url.replace(/\/(rest|storage|auth)\/v1$/i, '')
  if (url.endsWith('/')) url = url.slice(0, -1)
  return url
}

function getCredentials(): { url: string | null; key: string | null } {
  const rawUrl = ENV_URL || (typeof window !== 'undefined' ? localStorage.getItem('ls_supabase_url') : null)
  const key = ENV_KEY || (typeof window !== 'undefined' ? localStorage.getItem('ls_supabase_key') : null)
  const url = rawUrl ? cleanSupabaseUrl(rawUrl) : null
  return { url, key: key || null }
}

export { getCredentials }

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (_client) return _client
  const { url, key } = getCredentials()
  if (!url || !key) return null
  _client = createClient(url, key.trim())
  return _client
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getCredentials()
  return !!url && !!key
}

export function setSupabaseCredentials(url: string, key: string): void {
  const cleanUrl = cleanSupabaseUrl(url)
  const cleanKey = key.trim()
  localStorage.setItem('ls_supabase_url', cleanUrl)
  localStorage.setItem('ls_supabase_key', cleanKey)
  _client = createClient(cleanUrl, cleanKey)
}

export function clearSupabaseCredentials(): void {
  localStorage.removeItem('ls_supabase_url')
  localStorage.removeItem('ls_supabase_key')
  _client = null
}

/** 把查询词转成安全的 Storage 文件名 */
function queryToPath(query: string): string {
  let name = query.toLowerCase().trim()

  // 如果是 URL，提取 hostname
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
  const safe = name.replace(/[^a-z0-9_-]/g, '_')
  return `${safe}.svg`
}

/** 从云端缓存查询 Logo（从 Storage 下载） */
export async function fetchCloudLogo(query: string): Promise<LogoResult | null> {
  const sb = getClient()
  if (!sb) return null
  try {
    const path = queryToPath(query)
    const { data, error } = await sb.storage.from(BUCKET_NAME).download(path)
    if (error || !data) return null

    const blob = data
    const text = await blob.text()
    if (!text) return null

    return {
      id: `cloud-${query}`,
      source: `Supabase Storage (云端缓存)`,
      sourceType: 'cloud',
      format: 'svg',
      url: '',
      dataUrl: `data:image/svg+xml;base64,${btoa(text)}`,
      width: 512,
      height: 512,
      title: query,
    }
  } catch {
    return null
  }
}

/** 保存 Logo 到云端（上传 SVG 到 Storage bucket） */
export async function saveCloudLogo(
  query: string,
  _domains: string[],
  result: LogoResult
): Promise<void> {
  const sb = getClient()
  if (!sb) {
    throw new Error('Supabase 客户端未初始化，请检查配置')
  }

  // 获取 SVG 字符串
  let svgText: string | null = null
  if (result.format === 'svg' && result.dataUrl) {
    const base64 = result.dataUrl.split(',')[1]
    svgText = atob(base64)
  } else if (result.convertedSvg) {
    svgText = result.convertedSvg
  }
  if (!svgText) {
    console.warn('[Supabase] saveCloudLogo: 无 SVG 内容可上传')
    return
  }

  // 压缩 SVG
  const minified = minifySvg(svgText)
  const blob = new Blob([minified], { type: 'image/svg+xml' })
  const path = queryToPath(query)

  console.log('[Supabase] 准备上传:', {
    bucket: BUCKET_NAME,
    path,
    size: blob.size,
    credentials: getCredentials(),
  })

  const { data, error } = await sb.storage.from(BUCKET_NAME).upload(path, blob, {
    upsert: true,
    contentType: 'image/svg+xml',
  })

  console.log('[Supabase] 上传响应:', { data, error })

  if (error) {
    console.error('[Supabase] 上传失败:', error.message, error)
    throw new Error(`上传失败: ${error.message}`)
  }

  // 验证上传结果 - 尘尝试下载确认文件存在
  try {
    const { data: checkData, error: checkError } = await sb.storage.from(BUCKET_NAME).download(path)
    if (checkError) {
      console.warn('[Supabase] 验证下载失败:', checkError.message)
    } else if (checkData) {
      console.log('[Supabase] 验证成功: 文件已存在于 Storage')
    }
  } catch (e) {
    console.warn('[Supabase] 验证异常:', e)
  }
}

/** 获取云端缓存统计 */
export async function getCloudStats(): Promise<{ logoCount: number; softwareCount: number }> {
  const sb = getClient()
  if (!sb) return { logoCount: 0, softwareCount: 0 }
  try {
    const { data, error } = await sb.storage.from(BUCKET_NAME).list('', { limit: 1000 })
    if (error || !data) return { logoCount: 0, softwareCount: 0 }
    const count = data.filter((item) => item.name.endsWith('.svg')).length
    return { logoCount: count, softwareCount: count }
  } catch {
    return { logoCount: 0, softwareCount: 0 }
  }
}
