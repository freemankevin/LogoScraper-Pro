import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(204).end()
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    success: true,
    name: 'LogoScraper Pro API',
    version: '2.2.0',
    status: 'healthy',
    endpoints: {
      scrape: { method: 'POST', path: '/api/scrape', description: '爬取软件Logo' },
      health: { method: 'GET', path: '/api/health', description: '服务健康检查' },
    },
    limits: {
      freeTier: {
        requestsPerMinute: 10,
        maxDurationSeconds: 10,
        note: 'Vercel Hobby 计划限额，建议升级到 Pro 以获得更高额度',
      },
    },
  })
}
