/**
 * Supabase 客户端封装
 * - SVG 直接存在数据库 text 字段，不走 Storage
 * - 优先从环境变量读取，否则尝试 localStorage
 * - 未配置时所有操作静默回退
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LogoResult } from '../types/scraper'
import { minifySvg } from './svg-minify'

const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 清理 Supabase URL，去除多余的路径部分（SDK 会自动添加 /rest/v1/） */
function cleanSupabaseUrl(rawUrl: string): string {
  let url = rawUrl.trim()
  // 去除尾部斜杠
  if (url.endsWith('/')) url = url.slice(0, -1)
  // 去除多余的 /rest/v1 路径（SDK 会自动添加）
  if (url.endsWith('/rest/v1')) url = url.slice(0, -8)
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

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function getClient(): SupabaseClient | null {
  if (_client) return _client
  const { url, key } = getCredentials()
  if (!url || !key) return null
  _client = createClient(normalizeSupabaseUrl(url), key.trim())
  return _client
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getCredentials()
  return !!url && !!key
}

export function setSupabaseCredentials(url: string, key: string): void {
  const cleanUrl = normalizeSupabaseUrl(url)
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

// ---------- Database: software_logos table ----------

interface DbLogoRecord {
  query: string
  domains: string[]
  svg_content: string | null
  source: string
  source_type: string
  width: number | null
  height: number | null
  created_at: string
}

/** 从数据库查询缓存的 Logo */
export async function fetchCloudLogo(query: string): Promise<LogoResult | null> {
  const sb = getClient()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('software_logos')
      .select('*')
      .eq('query', query.toLowerCase().trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error || !data) return null

    const record = data as DbLogoRecord
    if (!record.svg_content) return null

    return {
      id: `cloud-${query}`,
      source: `${record.source} (云端缓存)`,
      sourceType: record.source_type as LogoResult['sourceType'],
      format: 'svg',
      url: '',
      dataUrl: `data:image/svg+xml;base64,${btoa(record.svg_content)}`,
      width: record.width ?? 512,
      height: record.height ?? 512,
      title: query,
    }
  } catch {
    return null
  }
}

/** 保存 Logo 到云端（只存 SVG，直接写数据库 text 字段） */
export async function saveCloudLogo(
  query: string,
  domains: string[],
  result: LogoResult
): Promise<void> {
  const sb = getClient()
  if (!sb) return

  try {
    // 获取 SVG 字符串
    let svgText: string | null = null
    if (result.format === 'svg' && result.dataUrl) {
      const base64 = result.dataUrl.split(',')[1]
      svgText = atob(base64)
    } else if (result.convertedSvg) {
      svgText = result.convertedSvg
    }
    if (!svgText) return

    // 压缩 SVG
    const minified = minifySvg(svgText)

    // 直接写入数据库
    const { error } = await sb.from('software_logos').upsert(
      {
        query: query.toLowerCase().trim(),
        domains,
        svg_content: minified,
        source: result.source,
        source_type: result.sourceType,
        width: result.width ?? 512,
        height: result.height ?? 512,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'query' }
    )
    if (error) throw error
  } catch (err) {
    console.error('[Supabase] saveCloudLogo error:', err)
    throw err
  }
}

/** 获取云端缓存统计 */
export async function getCloudStats(): Promise<{ logoCount: number; softwareCount: number }> {
  const sb = getClient()
  if (!sb) return { logoCount: 0, softwareCount: 0 }
  try {
    const { count: logoCount } = await sb
      .from('software_logos')
      .select('*', { count: 'exact', head: true })
    return { logoCount: logoCount ?? 0, softwareCount: logoCount ?? 0 }
  } catch {
    return { logoCount: 0, softwareCount: 0 }
  }
}
