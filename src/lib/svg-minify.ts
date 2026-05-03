/**
 * SVG 压缩器 — 基于 SVGO（浏览器端）
 * 保留所有可能改变视觉的插件关闭，只做安全压缩
 */

import { optimize } from 'svgo/browser'
import type { Config } from 'svgo'

const svgoConfig: Config = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // 视觉安全：保留 viewBox、不强制合并 path、不移除画布外元素
          removeViewBox: false,
          mergePaths: false,
          removeOffCanvasPaths: false,
          // 其他保持默认优化
          cleanupIds: { minify: true, removeUnknownsAndDefaults: true },
          removeUselessStrokeAndFill: { removeNone: true },
          removeHiddenElems: { opacity: true },
        },
      },
    } as any,
    'collapseGroups' as any,
    'convertShapeToPath' as any,
    'convertEllipseToCircle' as any,
    'moveElemsAttrsToGroup' as any,
    'moveGroupAttrsToElems' as any,
    'sortAttrs' as any,
    'reusePaths' as any,
    'removeRasterImages' as any,
    'removeScripts' as any,
    'removeStyleElement' as any,
  ],
  multipass: true,
}

export function minifySvg(svg: string): string {
  try {
    // 先移除所有 HTML/XML 注释（避免 <!-- -- --> 这类非法双连字符注释导致浏览器报错）
    const noComments = svg.replace(/<!--[\s\S]*?-->/g, '')
    const result = optimize(noComments, svgoConfig)
    return result.data
  } catch {
    return svg.replace(/<!--[\s\S]*?-->/g, '')
  }
}

/** 计算压缩率 */
export function compressionRatio(original: string, minified: string): string {
  const before = new Blob([original]).size
  const after = new Blob([minified]).size
  if (before === 0) return '0B → 0B'
  const ratio = ((1 - after / before) * 100).toFixed(1)
  return `${before}B → ${after}B (-${ratio}%)`
}
