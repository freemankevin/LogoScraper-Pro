/**
 * Supabase 客户端封装
 * - SVG 上传到 Storage Bucket（logos），不走数据库表
 * - 配置仅从环境变量读取（内置），不再支持前端手动输入
 * - URL/Key 支持 Base64 编码存储，运行时自动解码
 * - 未配置时所有操作静默回退
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LogoResult } from '../types/scraper'
import { sanitizeDownloadName, svgToDataUrl, dataUrlToText, isValidSvg } from './utils'

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

/** 把查询词转成安全的 Storage 文件名 */
function queryToPath(query: string): string {
  return `${sanitizeDownloadName(query)}.svg`
}

/** 从云端缓存查询 Logo（从 Storage 下载） */
export async function fetchCloudLogo(query: string): Promise<LogoResult | null> {
  const sb = getClient()
  if (!sb) return null
  try {
    const path = queryToPath(query)

    // 防线1: 先检查文件是否还在 bucket 列表中（避免 CDN 缓存导致误命中已删除文件）
    const { data: listData, error: listError } = await sb.storage
      .from(BUCKET_NAME)
      .list('', { search: path.replace('.svg', ''), limit: 10 })
    if (listError || !listData) return null
    const exists = listData.some((item) => item.name === path)
    if (!exists) return null

    // 防线2: 使用 signed URL + no-store 获取内容，绕过浏览器/CDN 缓存
    const { data: signedData, error: signedError } = await sb.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 60)
    if (signedError || !signedData?.signedUrl) return null

    const resp = await fetch(signedData.signedUrl, { cache: 'no-store' })
    if (!resp.ok) return null

    const text = await resp.text()
    if (!text) return null
    // 校验下载内容是否为有效 SVG（Supabase 可能返回错误页面/JSON 而非文件内容）
    if (!text.trim().startsWith('<svg') && !text.trim().startsWith('<?xml')) {
      console.warn('[Supabase] 云端缓存内容不是有效 SVG，忽略:', text.substring(0, 100))
      return null
    }

    return {
      id: `cloud-${query}`,
      source: `Supabase Storage (云端缓存)`,
      sourceType: 'cloud',
      format: 'svg',
      url: '',
      dataUrl: svgToDataUrl(text),
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
    throw new Error('Supabase 客户端未初始化，请检查环境变量配置')
  }

  try {
    // 获取 SVG 字符串
    let svgText: string | null = null
    if (result.format === 'svg' && result.dataUrl) {
      try {
        svgText = dataUrlToText(result.dataUrl)
      } catch {
        svgText = null
      }
    } else if (isValidSvg(result.convertedSvg)) {
      svgText = result.convertedSvg
    }
    if (!svgText) return

    // 直接上传原始 SVG（不再压缩）
    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const path = queryToPath(query)

    // 诊断：打印请求头信息
    const { data: sessionData } = await sb.auth.getSession()
    console.log('[Supabase] Upload debug:', {
      hasSession: !!sessionData.session,
      sessionTokenPrefix: sessionData.session?.access_token?.substring(0, 20),
      path,
      blobSize: blob.size,
    })

    const { error } = await sb.storage.from(BUCKET_NAME).upload(path, blob, {
      upsert: true,
      contentType: 'image/svg+xml',
      cacheControl: 'no-store',
    })
    if (error) {
      console.error('[Supabase] Storage upload error details:', error)
      // 如果是签名验证失败，给出更明确的提示
      if (error.message?.includes('signature verification failed')) {
        throw new Error(
          `Supabase Storage 签名验证失败。可能原因：\n` +
          `1. 项目启用了新版 API Key (sb_publishable) 但 Storage 服务不兼容\n` +
          `2. 需要在 Supabase Dashboard > Storage > Policies 中为 'logos' bucket 添加 anon 角色的 INSERT/SELECT/UPDATE 权限\n` +
          `3. 尝试在 Dashboard 中重新启用旧版 anon JWT key\n` +
          `原始错误: ${error.message}`
        )
      }
      throw error
    }
  } catch (err) {
    console.error('[Supabase] saveCloudLogo error:', err)
    throw err
  }
}

/** 删除云端缓存（用于清理错误上传的文件） */
export async function deleteCloudLogo(query: string): Promise<void> {
  const sb = getClient()
  if (!sb) return
  try {
    const path = queryToPath(query)
    const { error } = await sb.storage.from(BUCKET_NAME).remove([path])
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
    const count = data.filter((item) => item.name.endsWith('.svg')).length
    return { logoCount: count, softwareCount: count }
  } catch {
    return { logoCount: 0, softwareCount: 0 }
  }
}
