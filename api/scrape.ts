import type { VercelRequest, VercelResponse } from '@vercel/node'

// LogoScraper Pro — 聚合抓取 API
// 并发控制 + 多源请求 + 服务端图像获取（绕过CORS）

interface ScrapeBody {
  query: string
  formats?: ('svg' | 'png')[]
  apiKey?: string
}

interface LogoSource {
  name: string
  type: string
  fn: (query: string, domains: string[], known: KnownInfo | null) => Promise<LogoResult[]>
}

interface LogoResult {
  id: string
  source: string
  sourceType: string
  format: 'svg' | 'png' | 'jpg' | 'webp'
  url: string
  dataUrl?: string
  width?: number
  height?: number
  title: string
  convertedSvg?: string
}

interface KnownInfo {
  domains: string[]
  github?: string
  wikipedia?: string
}

const KNOWN_SOFTWARE: Record<string, KnownInfo> = {
  vscode: { domains: ['code.visualstudio.com', 'visualstudio.com'], github: 'microsoft/vscode', wikipedia: 'Visual_Studio_Code' },
  'visual studio code': { domains: ['code.visualstudio.com', 'visualstudio.com'], github: 'microsoft/vscode', wikipedia: 'Visual_Studio_Code' },
  github: { domains: ['github.com'], github: 'github', wikipedia: 'GitHub' },
  gitlab: { domains: ['gitlab.com'], github: 'gitlabhq/gitlabhq', wikipedia: 'GitLab' },
  slack: { domains: ['slack.com'], github: 'slackapi', wikipedia: 'Slack_(software)' },
  discord: { domains: ['discord.com'], github: 'discord', wikipedia: 'Discord' },
  figma: { domains: ['figma.com'], github: 'figma', wikipedia: 'Figma' },
  notion: { domains: ['notion.so'], github: 'makenotion', wikipedia: 'Notion_(productivity_software)' },
  chrome: { domains: ['google.com/chrome'], wikipedia: 'Google_Chrome' },
  firefox: { domains: ['mozilla.org/firefox'], github: 'mozilla/gecko-dev', wikipedia: 'Firefox' },
  docker: { domains: ['docker.com'], github: 'moby/moby', wikipedia: 'Docker_(software)' },
  kubernetes: { domains: ['kubernetes.io'], github: 'kubernetes/kubernetes', wikipedia: 'Kubernetes' },
  terraform: { domains: ['terraform.io', 'hashicorp.com'], github: 'hashicorp/terraform', wikipedia: 'Terraform_(software)' },
  ansible: { domains: ['ansible.com', 'redhat.com'], github: 'ansible/ansible', wikipedia: 'Ansible_(software)' },
  postman: { domains: ['postman.com'], github: 'postmanlabs', wikipedia: 'Postman_(software)' },
  obsidian: { domains: ['obsidian.md'], github: 'obsidianmd', wikipedia: 'Obsidian_(software)' },
  blender: { domains: ['blender.org'], github: 'blender/blender', wikipedia: 'Blender_(software)' },
  webstorm: { domains: ['jetbrains.com/webstorm'], github: 'JetBrains', wikipedia: 'WebStorm' },
  intellij: { domains: ['jetbrains.com/idea'], github: 'JetBrains', wikipedia: 'IntelliJ_IDEA' },
  pycharm: { domains: ['jetbrains.com/pycharm'], github: 'JetBrains', wikipedia: 'PyCharm' },
  goland: { domains: ['jetbrains.com/go'], github: 'JetBrains', wikipedia: 'GoLand' },
  rust: { domains: ['rust-lang.org'], github: 'rust-lang/rust', wikipedia: 'Rust_(programming_language)' },
  go: { domains: ['go.dev'], github: 'golang/go', wikipedia: 'Go_(programming_language)' },
  python: { domains: ['python.org'], github: 'python/cpython', wikipedia: 'Python_(programming_language)' },
  nodejs: { domains: ['nodejs.org'], github: 'nodejs/node', wikipedia: 'Node.js' },
  react: { domains: ['react.dev'], github: 'facebook/react', wikipedia: 'React_(software)' },
  nextjs: { domains: ['nextjs.org'], github: 'vercel/next.js', wikipedia: 'Next.js' },
  vue: { domains: ['vuejs.org'], github: 'vuejs/core', wikipedia: 'Vue.js' },
  angular: { domains: ['angular.io'], github: 'angular/angular', wikipedia: 'Angular_(web_framework)' },
  svelte: { domains: ['svelte.dev'], github: 'sveltejs/svelte', wikipedia: 'Svelte' },
  tailwind: { domains: ['tailwindcss.com'], github: 'tailwindlabs/tailwindcss', wikipedia: 'Tailwind_CSS' },
  bootstrap: { domains: ['getbootstrap.com'], github: 'twbs/bootstrap', wikipedia: 'Bootstrap_(front-end_framework)' },
  jquery: { domains: ['jquery.com'], github: 'jquery/jquery', wikipedia: 'JQuery' },
  webpack: { domains: ['webpack.js.org'], github: 'webpack/webpack', wikipedia: 'Webpack' },
  vite: { domains: ['vitejs.dev'], github: 'vitejs/vite', wikipedia: 'Vite_(software)' },
  npm: { domains: ['npmjs.com'], github: 'npm/cli', wikipedia: 'Npm_(software)' },
  typescript: { domains: ['typescriptlang.org'], github: 'microsoft/TypeScript', wikipedia: 'TypeScript' },
  eslint: { domains: ['eslint.org'], github: 'eslint/eslint', wikipedia: 'ESLint' },
  prettier: { domains: ['prettier.io'], github: 'prettier/prettier' },
  jest: { domains: ['jestjs.io'], github: 'jestjs/jest', wikipedia: 'Jest_(JavaScript_framework)' },
  vitest: { domains: ['vitest.dev'], github: 'vitest-dev/vitest' },
  cypress: { domains: ['cypress.io'], github: 'cypress-io/cypress' },
  playwright: { domains: ['playwright.dev'], github: 'microsoft/playwright' },
  storybook: { domains: ['storybook.js.org'], github: 'storybookjs/storybook' },
  astro: { domains: ['astro.build'], github: 'withastro/astro' },
  solid: { domains: ['solidjs.com'], github: 'solidjs/solid' },
  remix: { domains: ['remix.run'], github: 'remix-run/remix' },
  gatsby: { domains: ['gatsbyjs.com'], github: 'gatsbyjs/gatsby', wikipedia: 'Gatsby_(software)' },
  hugo: { domains: ['gohugo.io'], github: 'gohugoio/hugo', wikipedia: 'Hugo_(software)' },
  jekyll: { domains: ['jekyllrb.com'], github: 'jekyll/jekyll', wikipedia: 'Jekyll_(software)' },
  nuxt: { domains: ['nuxt.com'], github: 'nuxt/nuxt', wikipedia: 'Nuxt.js' },
  express: { domains: ['expressjs.com'], github: 'expressjs/express', wikipedia: 'Express.js' },
  fastify: { domains: ['fastify.dev'], github: 'fastify/fastify' },
  nestjs: { domains: ['nestjs.com'], github: 'nestjs/nest', wikipedia: 'NestJS' },
  django: { domains: ['djangoproject.com'], github: 'django/django', wikipedia: 'Django_(web_framework)' },
  flask: { domains: ['flask.palletsprojects.com'], github: 'pallets/flask', wikipedia: 'Flask_(web_framework)' },
  fastapi: { domains: ['fastapi.tiangolo.com'], github: 'tiangolo/fastapi', wikipedia: 'FastAPI' },
  rails: { domains: ['rubyonrails.org'], github: 'rails/rails', wikipedia: 'Ruby_on_Rails' },
  laravel: { domains: ['laravel.com'], github: 'laravel/framework', wikipedia: 'Laravel' },
  spring: { domains: ['spring.io'], github: 'spring-projects/spring-framework', wikipedia: 'Spring_Framework' },
  gin: { domains: ['gin-gonic.com'], github: 'gin-gonic/gin' },
  electron: { domains: ['electronjs.org'], github: 'electron/electron', wikipedia: 'Electron_(software_framework)' },
  flutter: { domains: ['flutter.dev'], github: 'flutter/flutter', wikipedia: 'Flutter_(software)' },
  reactnative: { domains: ['reactnative.dev'], github: 'facebook/react-native', wikipedia: 'React_Native' },
  unity: { domains: ['unity.com'], wikipedia: 'Unity_(game_engine)' },
  unreal: { domains: ['unrealengine.com'], github: 'EpicGames', wikipedia: 'Unreal_Engine' },
  godot: { domains: ['godotengine.org'], github: 'godotengine/godot', wikipedia: 'Godot_(game_engine)' },
  postgres: { domains: ['postgresql.org'], github: 'postgres/postgres', wikipedia: 'PostgreSQL' },
  mysql: { domains: ['mysql.com'], github: 'mysql/mysql-server', wikipedia: 'MySQL' },
  mongodb: { domains: ['mongodb.com'], github: 'mongodb/mongo', wikipedia: 'MongoDB' },
  redis: { domains: ['redis.io'], github: 'redis/redis', wikipedia: 'Redis' },
  elasticsearch: { domains: ['elastic.co'], github: 'elastic/elasticsearch', wikipedia: 'Elasticsearch' },
  kafka: { domains: ['kafka.apache.org'], github: 'apache/kafka', wikipedia: 'Apache_Kafka' },
  nginx: { domains: ['nginx.org'], github: 'nginx/nginx', wikipedia: 'Nginx' },
  caddy: { domains: ['caddyserver.com'], github: 'caddyserver/caddy' },
  traefik: { domains: ['traefik.io'], github: 'traefik/traefik' },
  istio: { domains: ['istio.io'], github: 'istio/istio', wikipedia: 'Istio' },
  linkerd: { domains: ['linkerd.io'], github: 'linkerd2/linkerd2', wikipedia: 'Linkerd' },
  cilium: { domains: ['cilium.io'], github: 'cilium/cilium' },
  prometheus: { domains: ['prometheus.io'], github: 'prometheus/prometheus', wikipedia: 'Prometheus_(software)' },
  grafana: { domains: ['grafana.com'], github: 'grafana/grafana', wikipedia: 'Grafana' },
  jaeger: { domains: ['jaegertracing.io'], github: 'jaegertracing/jaeger', wikipedia: 'Jaeger_(software)' },
  sentry: { domains: ['sentry.io'], github: 'getsentry/sentry', wikipedia: 'Sentry_(software)' },
  aws: { domains: ['aws.amazon.com'], github: 'aws' },
  azure: { domains: ['azure.microsoft.com'], github: 'Azure' },
  gcp: { domains: ['cloud.google.com'], github: 'GoogleCloudPlatform' },
  vercel: { domains: ['vercel.com'], github: 'vercel' },
  netlify: { domains: ['netlify.com'], github: 'netlify' },
  cloudflare: { domains: ['cloudflare.com'], github: 'cloudflare', wikipedia: 'Cloudflare' },
  supabase: { domains: ['supabase.com'], github: 'supabase/supabase' },
  firebase: { domains: ['firebase.google.com'], github: 'firebase' },
  stripe: { domains: ['stripe.com'], github: 'stripe', wikipedia: 'Stripe,_Inc.' },
  twilio: { domains: ['twilio.com'], github: 'twilio' },
  sendgrid: { domains: ['sendgrid.com'], github: 'sendgrid' },
  algolia: { domains: ['algolia.com'], github: 'algolia' },
  datadog: { domains: ['datadoghq.com'], github: 'DataDog' },
  dockerhub: { domains: ['hub.docker.com'], github: 'docker' },
  githubactions: { domains: ['github.com/features/actions'], github: 'github' },
  gitlabci: { domains: ['gitlab.com'], github: 'gitlabhq/gitlab-ci' },
  circleci: { domains: ['circleci.com'], github: 'circleci' },
  travisci: { domains: ['travis-ci.com'], github: 'travis-ci' },
  jenkins: { domains: ['jenkins.io'], github: 'jenkinsci/jenkins', wikipedia: 'Jenkins_(software)' },
  sonarqube: { domains: ['sonarqube.org'], github: 'SonarSource/sonarqube' },
  hashicorp: { domains: ['hashicorp.com'], github: 'hashicorp' },
  openai: { domains: ['openai.com'], github: 'openai' },
  anthropic: { domains: ['anthropic.com'], github: 'anthropics' },
  midjourney: { domains: ['midjourney.com'], github: 'midjourney' },
  stabilityai: { domains: ['stability.ai'], github: 'Stability-AI' },
  huggingface: { domains: ['huggingface.co'], github: 'huggingface' },
  gradio: { domains: ['gradio.app'], github: 'gradio-app/gradio' },
  streamlit: { domains: ['streamlit.io'], github: 'streamlit/streamlit' },
  jupyter: { domains: ['jupyter.org'], github: 'jupyter', wikipedia: 'Project_Jupyter' },
  anaconda: { domains: ['anaconda.com'], github: 'ContinuumIO/anaconda-issues' },
  conda: { domains: ['conda.io'], github: 'conda/conda' },
  homebrew: { domains: ['brew.sh'], github: 'Homebrew/brew', wikipedia: 'Homebrew_(package_manager)' },
}

function extractDomainFromUrl(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      return url.hostname
    } catch {
      return null
    }
  }
  if (trimmed.includes('.') && !trimmed.includes(' ') && trimmed.length > 3) {
    return trimmed.replace(/^www\./, '')
  }
  return null
}

function guessDomains(name: string): string[] {
  const key = name.toLowerCase().trim()

  const urlDomain = extractDomainFromUrl(key)
  if (urlDomain) {
    return [urlDomain]
  }

  const known = KNOWN_SOFTWARE[key]
  if (known) return known.domains
  const clean = key.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  return [`${clean}.com`, `www.${clean}.com`, `${clean}.io`, `www.${clean}.io`, `${clean}.dev`, `${clean}.org`, `app.${clean}.com`]
}

function getKnownInfo(name: string): KnownInfo | null {
  const key = name.toLowerCase().trim()
  return KNOWN_SOFTWARE[key] ?? null
}

function generateId(): string {
  return `res-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

// ---------- Source Implementations ----------

async function fetchClearbit(query: string, domains: string[], _known: KnownInfo | null): Promise<LogoResult[]> {
  const results: LogoResult[] = []
  for (const domain of domains.slice(0, 3)) {
    const url = `https://logo.clearbit.com/${domain}?size=512`
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        results.push({
          id: generateId(),
          source: `Clearbit (${domain})`,
          sourceType: 'clearbit',
          format: 'png',
          url,
          title: query,
        })
        break
      }
    } catch {
      // ignore
    }
  }
  return results
}

async function fetchIconHorse(query: string, domains: string[], _known: KnownInfo | null): Promise<LogoResult[]> {
  const results: LogoResult[] = []
  for (const domain of domains.slice(0, 3)) {
    const url = `https://icon.horse/icon/${domain}`
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        results.push({
          id: generateId(),
          source: `IconHorse (${domain})`,
          sourceType: 'favicon',
          format: 'png',
          url,
          title: query,
        })
        break
      }
    } catch {
      // ignore
    }
  }
  return results
}

async function fetchWikipedia(query: string, _domains: string[], known: KnownInfo | null): Promise<LogoResult[]> {
  if (!known?.wikipedia) return []
  try {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(known.wikipedia)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!resp.ok) return []
    const data = (await resp.json()) as { thumbnail?: { source: string; width: number; height: number } }
    if (data.thumbnail?.source) {
      return [{
        id: generateId(),
        source: 'Wikipedia',
        sourceType: 'wikipedia',
        format: 'png',
        url: data.thumbnail.source,
        width: data.thumbnail.width,
        height: data.thumbnail.height,
        title: query,
      }]
    }
  } catch {
    // ignore
  }
  return []
}

async function fetchGitHubRaw(query: string, _domains: string[], known: KnownInfo | null): Promise<LogoResult[]> {
  if (!known?.github) return []
  const repo = known.github
  const candidates = [
    `https://raw.githubusercontent.com/${repo}/main/logo.svg`,
    `https://raw.githubusercontent.com/${repo}/master/logo.svg`,
    `https://raw.githubusercontent.com/${repo}/main/icon.svg`,
    `https://raw.githubusercontent.com/${repo}/master/icon.svg`,
    `https://raw.githubusercontent.com/${repo}/main/assets/logo.svg`,
    `https://raw.githubusercontent.com/${repo}/main/docs/logo.svg`,
  ]
  for (const url of candidates) {
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(6000) })
      if (resp.ok && resp.headers.get('content-type')?.includes('svg')) {
        return [{
          id: generateId(),
          source: `GitHub Raw (${repo})`,
          sourceType: 'github',
          format: 'svg',
          url,
          title: query,
        }]
      }
    } catch {
      // ignore
    }
  }
  return []
}

async function fetchFaviconSvg(query: string, domains: string[], _known: KnownInfo | null): Promise<LogoResult[]> {
  for (const domain of domains.slice(0, 2)) {
    const urls = [
      `https://${domain}/favicon.svg`,
      `https://${domain}/icon.svg`,
      `https://${domain}/logo.svg`,
      `https://${domain}/assets/logo.svg`,
    ]
    for (const url of urls) {
      try {
        const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (resp.ok) {
          const ct = resp.headers.get('content-type') || ''
          if (ct.includes('svg') || ct.includes('image')) {
            return [{
              id: generateId(),
              source: `Direct (${domain})`,
              sourceType: 'direct',
              format: 'svg',
              url,
              title: query,
            }]
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return []
}

const SOURCES: LogoSource[] = [
  { name: 'Clearbit', type: 'clearbit', fn: fetchClearbit },
  { name: 'GitHub Raw', type: 'github', fn: fetchGitHubRaw },
  { name: 'Favicon SVG', type: 'direct', fn: fetchFaviconSvg },
  { name: 'IconHorse', type: 'favicon', fn: fetchIconHorse },
  { name: 'Wikipedia', type: 'wikipedia', fn: fetchWikipedia },
]

// 并发控制器：最多同时跑3个源
async function concurrentLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []
  let index = 0

  for (const task of tasks) {
    const p = task().then((r) => { results.push(r) })
    executing.push(p)
    if (executing.length >= limit) {
      await Promise.race(executing)
      executing.splice(executing.findIndex((x) => x === p), 1)
    }
  }
  await Promise.all(executing)
  return results
}

// ---------- Handler ----------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
    return res.status(204).end()
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' })
  }

  const body = req.body as ScrapeBody
  const query = body?.query?.trim()

  if (!query || query.length < 1) {
    return res.status(400).json({ success: false, error: 'query is required' })
  }

  const startTime = Date.now()
  const known = getKnownInfo(query)
  const domains = guessDomains(query)

  try {
    // 并发请求所有数据源，但限制同时3个
    const tasks = SOURCES.map((src) => () => src.fn(query, domains, known))
    const sourceResults = await concurrentLimit(tasks, 3)

    // 展平并去重（按URL）
    const seen = new Set<string>()
    const results: LogoResult[] = []
    for (const arr of sourceResults) {
      for (const r of arr) {
        if (!seen.has(r.url)) {
          seen.add(r.url)
          results.push(r)
        }
      }
    }

    return res.status(200).json({
      success: true,
      query,
      results,
      meta: {
        sourcesChecked: SOURCES.length,
        resultsFound: results.length,
        elapsedMs: Date.now() - startTime,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: message })
  }
}
