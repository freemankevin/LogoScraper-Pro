/**
 * Supabase 客户端封装
 * - 支持 SVG / PNG / ICO 上传到 Storage Bucket（logos）
 * - 配置仅从环境变量读取（内置），不再支持前端手动输入
 * - URL/Key 支持 Base64 编码存储，运行时自动解码
 * - 未配置时所有操作静默回退
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LogoResult } from '../types/scraper'
import { sanitizeDownloadName, svgToDataUrl, dataUrlToText, isValidSvg, blobToDataUrl, dataUrlToBlob } from './utils'

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
  const rawUrl = ENV_URL || null
  const rawKey = ENV_KEY || null
  const url = rawUrl ? cleanSupabaseUrl(rawUrl.trim()) : null
  const key = rawKey ? rawKey.trim() : null
  return { url, key }
}

export { getCredentials }

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (_client) return _client
  const { url, key } = getCredentials()
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getCredentials()
  return !!url && !!key
}

export function clearSupabaseCredentials(): void {
  _client = null
}

/** 把查询词转成安全的 Storage 文件名主体 */
function queryToName(query: string): string {
  return sanitizeDownloadName(query)
}

/** 从云端缓存查询 Logo（支持 PNG / ICO / SVG） */
export async function fetchCloudLogo(query: string): Promise<LogoResult | null> {
  const sb = getClient()
  if (!sb) return null
  try {
    const name = queryToName(query)

    // 按优先级尝试：PNG -> ICO -> SVG（兼容旧缓存）
    const candidates = [
      { ext: '.png', format: 'png' as const, width: 128, height: 128 },
      { ext: '.ico', format: 'png' as const, width: 32, height: 32 },
      { ext: '.svg', format: 'svg' as const, width: 512, height: 512 },
    ]

    for (const { ext, format, width, height } of candidates) {
      const path = `${name}${ext}`

      // 防线1: 先检查文件是否还在 bucket 列表中
      const { data: listData, error: listError } = await sb.storage
        .from(BUCKET_NAME)
        .list('', { search: name, limit: 10 })
      if (listError || !listData) continue
      const exists = listData.some((item) => item.name === path)
      if (!exists) continue

      // 防线2: 使用 signed URL + no-store 获取内容
      const { data: signedData, error: signedError } = await sb.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, 60)
      if (signedError || !signedData?.signedUrl) continue

      const resp = await fetch(signedData.signedUrl, { cache: 'no-store' })
      if (!resp.ok) continue

      if (format === 'svg') {
        const text = await resp.text()
        if (!text.trim().startsWith('<svg') && !text.trim().startsWith('<?xml')) {
          console.warn('[Supabase] Cloud cache content is not valid SVG, ignoring:', text.substring(0, 100))
          continue
        }
        return {
          id: `cloud-${query}`,
          source: 'Supabase Storage (cloud cache)',
          sourceType: 'cloud',
          format: 'svg',
          url: '',
          dataUrl: svgToDataUrl(text),
          width,
          height,
          title: query,
        }
      } else {
        const blob = await resp.blob()
        const dataUrl = await blobToDataUrl(blob)
        return {
          id: `cloud-${query}-${ext}`,
          source: `Supabase Storage (cloud cache ${ext})`,
          sourceType: 'cloud',
          format: 'png',
          url: '',
          dataUrl,
          width,
          height,
          title: query,
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/** 保存 Logo 到云端（支持 PNG / ICO / SVG） */
export async function saveCloudLogo(
  query: string,
  result: LogoResult
): Promise<void> {
  const sb = getClient()
  if (!sb) {
    throw new Error('Supabase client not initialized, check environment variables')
  }

  try {
    const name = queryToName(query)
    let blob: Blob | null = null
    let path: string = ''
    let contentType: string = 'application/octet-stream'

    if (result.format === 'svg' && result.dataUrl) {
      const svgText = dataUrlToText(result.dataUrl)
      if (!isValidSvg(svgText)) return
      blob = new Blob([svgText], { type: 'image/svg+xml' })
      path = `${name}.svg`
      contentType = 'image/svg+xml'
    } else if (result.dataUrl) {
      // PNG / ICO / 其他格式，直接从 dataUrl 转 Blob
      blob = dataUrlToBlob(result.dataUrl)
      if (!blob || blob.size < 100) return
      const ext = result.format === 'png' ? '.png' : '.ico'
      path = `${name}${ext}`
      contentType = result.format === 'png' ? 'image/png' : 'image/x-icon'
    }

    if (!blob || !path) return

    const { error } = await sb.storage.from(BUCKET_NAME).upload(path, blob, {
      upsert: true,
      contentType,
      cacheControl: 'public, max-age=31536000',
    })
    if (error) {
      console.error('[Supabase] Storage upload error details:', error)
      if (error.message?.includes('signature verification failed')) {
        throw new Error(
          `Supabase Storage signature verification failed. Possible causes:\n` +
          `1. Project uses new API Key (sb_publishable) but Storage service incompatible\n` +
          `2. 需要在 Supabase Dashboard > Storage > Policies 中为 'logos' bucket 添加 anon 角色的 INSERT/SELECT/UPDATE 权限\n` +
          `3. Try re-enabling legacy anon JWT key in Dashboard\n` +
          `Original error: ${error.message}`
        )
      }
      throw error
    }
  } catch (err) {
    console.error('[Supabase] saveCloudLogo error:', err)
    throw err
  }
}

/** 删除云端缓存（支持多格式） */
export async function deleteCloudLogo(query: string): Promise<void> {
  const sb = getClient()
  if (!sb) return
  try {
    const name = queryToName(query)
    const paths = [`${name}.svg`, `${name}.png`, `${name}.ico`]
    const { error } = await sb.storage.from(BUCKET_NAME).remove(paths)
    if (error) throw error
  } catch (err) {
    console.error('[Supabase] deleteCloudLogo error:', err)
    throw err
  }
}

/** 获取云端缓存统计 */
export async function getCloudStats(): Promise<{ logoCount: number; softwareCount: number }> {
  const sb = getClient()
  if (!sb) return { logoCount: 0, softwareCount: 0 }
  try {
    const { data, error } = await sb.storage.from(BUCKET_NAME).list('', { limit: 1000 })
    if (error || !data) return { logoCount: 0, softwareCount: 0 }
    const count = data.filter((item) =>
      item.name.endsWith('.svg') || item.name.endsWith('.png') || item.name.endsWith('.ico')
    ).length
    return { logoCount: count, softwareCount: count }
  } catch {
    return { logoCount: 0, softwareCount: 0 }
  }
}
