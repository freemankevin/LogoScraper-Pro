/**
 * LogoScraper 本地缓存层（IndexedDB）
 * - 成功获取的 Logo 结果自动缓存
 * - 再次搜索时优先命中缓存，零网络请求
 * - 支持数据导出为 JSON
 */

import type { LogoResult } from '../types/scraper'

const DB_NAME = 'LogoScraperDB'
const DB_VERSION = 1

interface CachedResult {
  query: string
  results: LogoResult[]
  timestamp: number
}

interface CachedSoftware {
  name: string
  domains: string[]
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results', { keyPath: 'query' })
      }
      if (!db.objectStoreNames.contains('software')) {
        db.createObjectStore('software', { keyPath: 'name' })
      }
    }
  })
}

/** 从缓存读取搜索结果 */
export async function getCachedResults(query: string): Promise<LogoResult[] | null> {
  try {
    const db = await openDB()
    const tx = db.transaction('results', 'readonly')
    const store = tx.objectStore('results')
    const key = query.toLowerCase().trim()
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => {
        const data: CachedResult | undefined = req.result
        if (!data) { resolve(null); return }
        // 缓存有效期：7 天
        const maxAge = 7 * 24 * 60 * 60 * 1000
        if (Date.now() - data.timestamp > maxAge) {
          resolve(null)
          return
        }
        resolve(data.results)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/** 保存搜索结果到缓存 */
export async function saveCachedResults(query: string, results: LogoResult[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction('results', 'readwrite')
    const store = tx.objectStore('results')
    const key = query.toLowerCase().trim()
    const data: CachedResult = { query: key, results, timestamp: Date.now() }
    store.put(data)
  } catch {
    // 静默失败，不影响主流程
  }
}

/** 读取自动积累的软件映射 */
export async function getCachedSoftware(name: string): Promise<CachedSoftware | null> {
  try {
    const db = await openDB()
    const tx = db.transaction('software', 'readonly')
    const store = tx.objectStore('software')
    const key = name.toLowerCase().trim()
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/** 保存软件映射到缓存 */
export async function saveCachedSoftware(name: string, domains: string[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction('software', 'readwrite')
    const store = tx.objectStore('software')
    const key = name.toLowerCase().trim()
    const data: CachedSoftware = { name: key, domains, timestamp: Date.now() }
    store.put(data)
  } catch {
    // 静默失败
  }
}

/** 导出所有缓存数据为 JSON 对象 */
export async function exportCacheData(): Promise<{
  results: CachedResult[]
  software: CachedSoftware[]
  exportedAt: string
}> {
  const db = await openDB()
  const results = await new Promise<CachedResult[]>((resolve, reject) => {
    const tx = db.transaction('results', 'readonly')
    const store = tx.objectStore('results')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const software = await new Promise<CachedSoftware[]>((resolve, reject) => {
    const tx = db.transaction('software', 'readonly')
    const store = tx.objectStore('software')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return { results, software, exportedAt: new Date().toISOString() }
}

/** 下载缓存数据为 JSON 文件 */
export async function downloadCacheAsJson(): Promise<void> {
  const data = await exportCacheData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logoscraper-cache-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 清除所有缓存 */
export async function clearCache(): Promise<void> {
  const db = await openDB()
  const tx1 = db.transaction('results', 'readwrite')
  tx1.objectStore('results').clear()
  const tx2 = db.transaction('software', 'readwrite')
  tx2.objectStore('software').clear()
}

/** 获取缓存统计 */
export async function getCacheStats(): Promise<{ resultsCount: number; softwareCount: number }> {
  const db = await openDB()
  const resultsCount = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction('results', 'readonly')
    const req = tx.objectStore('results').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const softwareCount = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction('software', 'readonly')
    const req = tx.objectStore('software').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return { resultsCount, softwareCount }
}
