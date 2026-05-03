import type { VercelRequest, VercelResponse } from '@vercel/node'

// LogoScraper Pro — 聚合抓取 API
// 服务端优势：无 CORS 限制、可高并发、直接获取图像数据

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
  githubPaths?: string[]
  wikipedia?: string
  simpleIconsSlug?: string
}

const KNOWN_SOFTWARE: Record<string, KnownInfo> = {
  vscode: { domains: ['code.visualstudio.com', 'visualstudio.com'], github: 'microsoft/vscode', githubPaths: ['main/resources/linux/code.png', 'master/resources/linux/code.png'], wikipedia: 'Visual_Studio_Code', simpleIconsSlug: 'visualstudiocode' },
  'visual studio code': { domains: ['code.visualstudio.com', 'visualstudio.com'], github: 'microsoft/vscode', githubPaths: ['main/resources/linux/code.png', 'master/resources/linux/code.png'], wikipedia: 'Visual_Studio_Code', simpleIconsSlug: 'visualstudiocode' },
  github: { domains: ['github.com'], github: 'github', wikipedia: 'GitHub', simpleIconsSlug: 'github' },
  gitlab: { domains: ['gitlab.com'], github: 'gitlabhq/gitlabhq', wikipedia: 'GitLab', simpleIconsSlug: 'gitlab' },
  slack: { domains: ['slack.com'], github: 'slackapi', wikipedia: 'Slack_(software)', simpleIconsSlug: 'slack' },
  discord: { domains: ['discord.com'], github: 'discord', wikipedia: 'Discord', simpleIconsSlug: 'discord' },
  figma: { domains: ['figma.com'], github: 'figma', wikipedia: 'Figma', simpleIconsSlug: 'figma' },
  notion: { domains: ['notion.so'], github: 'makenotion', wikipedia: 'Notion_(productivity_software)', simpleIconsSlug: 'notion' },
  chrome: { domains: ['google.com/chrome'], wikipedia: 'Google_Chrome', simpleIconsSlug: 'googlechrome' },
  firefox: { domains: ['mozilla.org/firefox'], github: 'mozilla/gecko-dev', wikipedia: 'Firefox', simpleIconsSlug: 'firefox' },
  docker: { domains: ['docker.com'], github: 'moby/moby', wikipedia: 'Docker_(software)', simpleIconsSlug: 'docker' },
  kubernetes: { domains: ['kubernetes.io'], github: 'kubernetes/kubernetes', wikipedia: 'Kubernetes', simpleIconsSlug: 'kubernetes' },
  terraform: { domains: ['terraform.io', 'hashicorp.com'], github: 'hashicorp/terraform', wikipedia: 'Terraform_(software)', simpleIconsSlug: 'terraform' },
  ansible: { domains: ['ansible.com', 'redhat.com'], github: 'ansible/ansible', wikipedia: 'Ansible_(software)', simpleIconsSlug: 'ansible' },
  postman: { domains: ['postman.com'], github: 'postmanlabs', wikipedia: 'Postman_(software)', simpleIconsSlug: 'postman' },
  obsidian: { domains: ['obsidian.md'], github: 'obsidianmd', wikipedia: 'Obsidian_(software)', simpleIconsSlug: 'obsidian' },
  blender: { domains: ['blender.org'], github: 'blender/blender', wikipedia: 'Blender_(software)', simpleIconsSlug: 'blender' },
  webstorm: { domains: ['jetbrains.com/webstorm'], github: 'JetBrains', wikipedia: 'WebStorm' },
  intellij: { domains: ['jetbrains.com/idea'], github: 'JetBrains', wikipedia: 'IntelliJ_IDEA' },
  pycharm: { domains: ['jetbrains.com/pycharm'], github: 'JetBrains', wikipedia: 'PyCharm' },
  goland: { domains: ['jetbrains.com/go'], github: 'JetBrains', wikipedia: 'GoLand' },
  rust: { domains: ['rust-lang.org'], github: 'rust-lang/rust', wikipedia: 'Rust_(programming_language)', simpleIconsSlug: 'rust' },
  go: { domains: ['go.dev'], github: 'golang/go', wikipedia: 'Go_(programming_language)', simpleIconsSlug: 'go' },
  python: { domains: ['python.org'], github: 'python/cpython', wikipedia: 'Python_(programming_language)', simpleIconsSlug: 'python' },
  nodejs: { domains: ['nodejs.org'], github: 'nodejs/node', wikipedia: 'Node.js', simpleIconsSlug: 'nodedotjs' },
  react: { domains: ['react.dev'], github: 'facebook/react', wikipedia: 'React_(software)', simpleIconsSlug: 'react' },
  nextjs: { domains: ['nextjs.org'], github: 'vercel/next.js', wikipedia: 'Next.js', simpleIconsSlug: 'nextdotjs' },
  vue: { domains: ['vuejs.org'], github: 'vuejs/core', wikipedia: 'Vue.js', simpleIconsSlug: 'vuedotjs' },
  angular: { domains: ['angular.io'], github: 'angular/angular', wikipedia: 'Angular_(web_framework)', simpleIconsSlug: 'angular' },
  svelte: { domains: ['svelte.dev'], github: 'sveltejs/svelte', wikipedia: 'Svelte', simpleIconsSlug: 'svelte' },
  tailwind: { domains: ['tailwindcss.com'], github: 'tailwindlabs/tailwindcss', wikipedia: 'Tailwind_CSS', simpleIconsSlug: 'tailwindcss' },
  bootstrap: { domains: ['getbootstrap.com'], github: 'twbs/bootstrap', wikipedia: 'Bootstrap_(front-end_framework)', simpleIconsSlug: 'bootstrap' },
  jquery: { domains: ['jquery.com'], github: 'jquery/jquery', wikipedia: 'JQuery', simpleIconsSlug: 'jquery' },
  webpack: { domains: ['webpack.js.org'], github: 'webpack/webpack', wikipedia: 'Webpack', simpleIconsSlug: 'webpack' },
  vite: { domains: ['vitejs.dev'], github: 'vitejs/vite', wikipedia: 'Vite_(software)', simpleIconsSlug: 'vite' },
  npm: { domains: ['npmjs.com'], github: 'npm/cli', wikipedia: 'Npm_(software)', simpleIconsSlug: 'npm' },
  typescript: { domains: ['typescriptlang.org'], github: 'microsoft/TypeScript', wikipedia: 'TypeScript', simpleIconsSlug: 'typescript' },
  eslint: { domains: ['eslint.org'], github: 'eslint/eslint', wikipedia: 'ESLint', simpleIconsSlug: 'eslint' },
  prettier: { domains: ['prettier.io'], github: 'prettier/prettier', simpleIconsSlug: 'prettier' },
  jest: { domains: ['jestjs.io'], github: 'jestjs/jest', wikipedia: 'Jest_(JavaScript_framework)', simpleIconsSlug: 'jest' },
  vitest: { domains: ['vitest.dev'], github: 'vitest-dev/vitest', simpleIconsSlug: 'vitest' },
  cypress: { domains: ['cypress.io'], github: 'cypress-io/cypress', simpleIconsSlug: 'cypress' },
  playwright: { domains: ['playwright.dev'], github: 'microsoft/playwright', simpleIconsSlug: 'playwright' },
  storybook: { domains: ['storybook.js.org'], github: 'storybookjs/storybook', simpleIconsSlug: 'storybook' },
  astro: { domains: ['astro.build'], github: 'withastro/astro', simpleIconsSlug: 'astro' },
  solid: { domains: ['solidjs.com'], github: 'solidjs/solid', simpleIconsSlug: 'solid' },
  remix: { domains: ['remix.run'], github: 'remix-run/remix', simpleIconsSlug: 'remix' },
  gatsby: { domains: ['gatsbyjs.com'], github: 'gatsbyjs/gatsby', wikipedia: 'Gatsby_(software)', simpleIconsSlug: 'gatsby' },
  hugo: { domains: ['gohugo.io'], github: 'gohugoio/hugo', wikipedia: 'Hugo_(software)', simpleIconsSlug: 'hugo' },
  jekyll: { domains: ['jekyllrb.com'], github: 'jekyll/jekyll', wikipedia: 'Jekyll_(software)', simpleIconsSlug: 'jekyll' },
  nuxt: { domains: ['nuxt.com'], github: 'nuxt/nuxt', wikipedia: 'Nuxt.js', simpleIconsSlug: 'nuxt' },
  express: { domains: ['expressjs.com'], github: 'expressjs/express', wikipedia: 'Express.js', simpleIconsSlug: 'express' },
  fastify: { domains: ['fastify.dev'], github: 'fastify/fastify', simpleIconsSlug: 'fastify' },
  nestjs: { domains: ['nestjs.com'], github: 'nestjs/nest', wikipedia: 'NestJS', simpleIconsSlug: 'nestjs' },
  django: { domains: ['djangoproject.com'], github: 'django/django', wikipedia: 'Django_(web_framework)', simpleIconsSlug: 'django' },
  flask: { domains: ['flask.palletsprojects.com'], github: 'pallets/flask', wikipedia: 'Flask_(web_framework)', simpleIconsSlug: 'flask' },
  fastapi: { domains: ['fastapi.tiangolo.com'], github: 'tiangolo/fastapi', wikipedia: 'FastAPI', simpleIconsSlug: 'fastapi' },
  rails: { domains: ['rubyonrails.org'], github: 'rails/rails', wikipedia: 'Ruby_on_Rails', simpleIconsSlug: 'rubyonrails' },
  laravel: { domains: ['laravel.com'], github: 'laravel/framework', wikipedia: 'Laravel', simpleIconsSlug: 'laravel' },
  spring: { domains: ['spring.io'], github: 'spring-projects/spring-framework', wikipedia: 'Spring_Framework', simpleIconsSlug: 'spring' },
  gin: { domains: ['gin-gonic.com'], github: 'gin-gonic/gin', simpleIconsSlug: 'gin' },
  electron: { domains: ['electronjs.org'], github: 'electron/electron', wikipedia: 'Electron_(software_framework)', simpleIconsSlug: 'electron' },
  flutter: { domains: ['flutter.dev'], github: 'flutter/flutter', wikipedia: 'Flutter_(software)', simpleIconsSlug: 'flutter' },
  reactnative: { domains: ['reactnative.dev'], github: 'facebook/react-native', wikipedia: 'React_Native', simpleIconsSlug: 'react' },
  unity: { domains: ['unity.com'], wikipedia: 'Unity_(game_engine)', simpleIconsSlug: 'unity' },
  unreal: { domains: ['unrealengine.com'], github: 'EpicGames', wikipedia: 'Unreal_Engine', simpleIconsSlug: 'unrealengine' },
  godot: { domains: ['godotengine.org'], github: 'godotengine/godot', wikipedia: 'Godot_(game_engine)', simpleIconsSlug: 'godotengine' },
  postgres: { domains: ['postgresql.org'], github: 'postgres/postgres', wikipedia: 'PostgreSQL', simpleIconsSlug: 'postgresql' },
  mysql: { domains: ['mysql.com'], github: 'mysql/mysql-server', wikipedia: 'MySQL', simpleIconsSlug: 'mysql' },
  mongodb: { domains: ['mongodb.com'], github: 'mongodb/mongo', wikipedia: 'MongoDB', simpleIconsSlug: 'mongodb' },
  redis: { domains: ['redis.io'], github: 'redis/redis', wikipedia: 'Redis', simpleIconsSlug: 'redis' },
  elasticsearch: { domains: ['elastic.co'], github: 'elastic/elasticsearch', wikipedia: 'Elasticsearch', simpleIconsSlug: 'elastic' },
  kafka: { domains: ['kafka.apache.org'], github: 'apache/kafka', wikipedia: 'Apache_Kafka', simpleIconsSlug: 'apachekafka' },
  nginx: { domains: ['nginx.org'], github: 'nginx/nginx', wikipedia: 'Nginx', simpleIconsSlug: 'nginx' },
  caddy: { domains: ['caddyserver.com'], github: 'caddyserver/caddy', simpleIconsSlug: 'caddy' },
  traefik: { domains: ['traefik.io'], github: 'traefik/traefik', simpleIconsSlug: 'traefik' },
  istio: { domains: ['istio.io'], github: 'istio/istio', wikipedia: 'Istio', simpleIconsSlug: 'istio' },
  linkerd: { domains: ['linkerd.io'], github: 'linkerd2/linkerd2', wikipedia: 'Linkerd', simpleIconsSlug: 'linkerd' },
  cilium: { domains: ['cilium.io'], github: 'cilium/cilium', simpleIconsSlug: 'cilium' },
  prometheus: { domains: ['prometheus.io'], github: 'prometheus/prometheus', wikipedia: 'Prometheus_(software)', simpleIconsSlug: 'prometheus' },
  grafana: { domains: ['grafana.com'], github: 'grafana/grafana', wikipedia: 'Grafana', simpleIconsSlug: 'grafana' },
  jaeger: { domains: ['jaegertracing.io'], github: 'jaegertracing/jaeger', wikipedia: 'Jaeger_(software)', simpleIconsSlug: 'jaeger' },
  sentry: { domains: ['sentry.io'], github: 'getsentry/sentry', wikipedia: 'Sentry_(software)', simpleIconsSlug: 'sentry' },
  aws: { domains: ['aws.amazon.com'], github: 'aws', simpleIconsSlug: 'amazonaws' },
  azure: { domains: ['azure.microsoft.com'], github: 'Azure', simpleIconsSlug: 'microsoftazure' },
  gcp: { domains: ['cloud.google.com'], github: 'GoogleCloudPlatform', simpleIconsSlug: 'googlecloud' },
  vercel: { domains: ['vercel.com'], github: 'vercel', simpleIconsSlug: 'vercel' },
  netlify: { domains: ['netlify.com'], github: 'netlify', simpleIconsSlug: 'netlify' },
  cloudflare: { domains: ['cloudflare.com'], github: 'cloudflare', wikipedia: 'Cloudflare', simpleIconsSlug: 'cloudflare' },
  supabase: { domains: ['supabase.com'], github: 'supabase/supabase', simpleIconsSlug: 'supabase' },
  firebase: { domains: ['firebase.google.com'], github: 'firebase', simpleIconsSlug: 'firebase' },
  stripe: { domains: ['stripe.com'], github: 'stripe', wikipedia: 'Stripe,_Inc.', simpleIconsSlug: 'stripe' },
  twilio: { domains: ['twilio.com'], github: 'twilio', simpleIconsSlug: 'twilio' },
  sendgrid: { domains: ['sendgrid.com'], github: 'sendgrid', simpleIconsSlug: 'sendgrid' },
  algolia: { domains: ['algolia.com'], github: 'algolia', simpleIconsSlug: 'algolia' },
  datadog: { domains: ['datadoghq.com'], github: 'DataDog', simpleIconsSlug: 'datadog' },
  dockerhub: { domains: ['hub.docker.com'], github: 'docker', simpleIconsSlug: 'docker' },
  githubactions: { domains: ['github.com/features/actions'], github: 'github', simpleIconsSlug: 'githubactions' },
  gitlabci: { domains: ['gitlab.com'], github: 'gitlabhq/gitlab-ci', simpleIconsSlug: 'gitlab' },
  circleci: { domains: ['circleci.com'], github: 'circleci', simpleIconsSlug: 'circleci' },
  travisci: { domains: ['travis-ci.com'], github: 'travis-ci', simpleIconsSlug: 'travisci' },
  jenkins: { domains: ['jenkins.io'], github: 'jenkinsci/jenkins', wikipedia: 'Jenkins_(software)', simpleIconsSlug: 'jenkins' },
  sonarqube: { domains: ['sonarqube.org'], github: 'SonarSource/sonarqube', simpleIconsSlug: 'sonarqube' },
  hashicorp: { domains: ['hashicorp.com'], github: 'hashicorp', simpleIconsSlug: 'hashicorp' },
  openai: { domains: ['openai.com'], github: 'openai', simpleIconsSlug: 'openai' },
  anthropic: { domains: ['anthropic.com'], github: 'anthropics', simpleIconsSlug: 'anthropic' },
  midjourney: { domains: ['midjourney.com'], github: 'midjourney', simpleIconsSlug: 'midjourney' },
  stabilityai: { domains: ['stability.ai'], github: 'Stability-AI', simpleIconsSlug: 'stability' },
  huggingface: { domains: ['huggingface.co'], github: 'huggingface', simpleIconsSlug: 'huggingface' },
  gradio: { domains: ['gradio.app'], github: 'gradio-app/gradio', simpleIconsSlug: 'gradio' },
  streamlit: { domains: ['streamlit.io'], github: 'streamlit/streamlit', simpleIconsSlug: 'streamlit' },
  jupyter: { domains: ['jupyter.org'], github: 'jupyter', wikipedia: 'Project_Jupyter', simpleIconsSlug: 'jupyter' },
  anaconda: { domains: ['anaconda.com'], github: 'ContinuumIO/anaconda-issues', simpleIconsSlug: 'anaconda' },
  conda: { domains: ['conda.io'], github: 'conda/conda', simpleIconsSlug: 'conda' },
  homebrew: { domains: ['brew.sh'], github: 'Homebrew/brew', wikipedia: 'Homebrew_(package_manager)', simpleIconsSlug: 'homebrew' },
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

/** 1. 官网 favicon（ico 里常打包多尺寸大图标） */
async function fetchOfficialFavicon(query: string, domains: string[], _known: KnownInfo | null): Promise<LogoResult[]> {
  const results: LogoResult[] = []
  for (const domain of domains.slice(0, 2)) {
    // 1.1 /favicon.ico
    try {
      const url = `https://${domain}/favicon.ico`
      const resp = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || ''
        if (ct.includes('image') || ct.includes('icon') || ct.includes('octet')) {
          results.push({
            id: generateId(),
            source: `Favicon (${domain})`,
            sourceType: 'favicon',
            format: 'png',
            url,
            title: query,
          })
        }
      }
    } catch { /* ignore */ }

    // 1.2 解析 HTML 中的 favicon 链接
    try {
      const htmlResp = await fetch(`https://${domain}/`, { signal: AbortSignal.timeout(3000) })
      if (htmlResp.ok) {
        const html = await htmlResp.text()
        const match =
          html.match(/<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
          html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/i)
        if (match) {
          let href = match[1]
          if (href.startsWith('//')) href = 'https:' + href
          else if (href.startsWith('/')) href = `https://${domain}${href}`
          else if (!href.startsWith('http')) href = `https://${domain}/${href}`

          const favResp = await fetch(href, { signal: AbortSignal.timeout(3000) })
          if (favResp.ok) {
            const ct = favResp.headers.get('content-type') || ''
            if (ct.includes('image') || ct.includes('icon')) {
              results.push({
                id: generateId(),
                source: `Favicon HTML (${domain})`,
                sourceType: 'favicon',
                format: 'png',
                url: href,
                title: query,
              })
            }
          }
        }
      }
    } catch { /* ignore */ }

    // 1.3 /apple-touch-icon.png
    try {
      const url = `https://${domain}/apple-touch-icon.png`
      const resp = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (resp.ok) {
        results.push({
          id: generateId(),
          source: `Apple Touch (${domain})`,
          sourceType: 'favicon',
          format: 'png',
          url,
          title: query,
        })
      }
    } catch { /* ignore */ }

    if (results.length > 0) break
  }
  return results
}

/** 2. Simple Icons CDN — 最高质量的品牌 SVG 图标库 */
async function fetchSimpleIcons(query: string, _domains: string[], known: KnownInfo | null): Promise<LogoResult[]> {
  const slugs: string[] = []
  if (known?.simpleIconsSlug) {
    slugs.push(known.simpleIconsSlug)
  }
  const inferred = query.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  if (inferred && !slugs.includes(inferred)) {
    slugs.push(inferred)
  }
  const alt = query.toLowerCase().trim().replace(/\s+/g, '')
  if (alt && !slugs.includes(alt)) {
    slugs.push(alt)
  }

  const cdnBases = [
    'https://cdn.simpleicons.org',
    'https://cdn.jsdelivr.net/npm/simple-icons/icons',
  ]

  for (const slug of slugs) {
    for (const base of cdnBases) {
      const url = `${base}/${slug}.svg`
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(4000) })
        if (!resp.ok) continue
        const svgText = await resp.text()
        if (!svgText.trim().startsWith('<svg') || !svgText.includes('</svg>')) continue
        return [{
          id: generateId(),
          source: `Simple Icons (${slug})`,
          sourceType: 'direct',
          format: 'svg',
          url,
          title: query,
        }]
      } catch { /* ignore */ }
    }
  }
  return []
}

/** 3. Google Favicon API */
async function fetchGoogleFavicon(query: string, domains: string[], _known: KnownInfo | null): Promise<LogoResult[]> {
  for (const domain of domains.slice(0, 3)) {
    try {
      const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      const resp = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (!resp.ok) continue
      const blob = await resp.blob()
      if (blob.size < 100) continue
      return [{
        id: generateId(),
        source: `Google Favicon (${domain})`,
        sourceType: 'favicon',
        format: 'png',
        url,
        width: 128,
        height: 128,
        title: query,
      }]
    } catch { /* ignore */ }
  }
  return []
}

/** 4. GitHub Raw */
async function fetchGitHubRaw(query: string, _domains: string[], known: KnownInfo | null): Promise<LogoResult[]> {
  if (!known?.github) return []
  const repo = known.github

  // 4.1 配置了已知图片路径，优先尝试
  if (known.githubPaths && known.githubPaths.length > 0) {
    for (const path of known.githubPaths) {
      const url = `https://raw.githubusercontent.com/${repo}/${path}`
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(4000) })
        if (!resp.ok) continue
        const isPng = path.endsWith('.png')
        return [{
          id: generateId(),
          source: `GitHub Raw (${repo})`,
          sourceType: 'github',
          format: isPng ? 'png' : 'svg',
          url,
          title: query,
        }]
      } catch { /* ignore */ }
    }
  }

  // 4.2 回退：探测 logo.svg / icon.svg
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
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
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
    } catch { /* ignore */ }
  }
  return []
}

/** 5. 官网 SVG 图标 */
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
        const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
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
      } catch { /* ignore */ }
    }
  }
  return []
}

/** 6. Clearbit Logo API */
async function fetchClearbit(query: string, domains: string[], _known: KnownInfo | null): Promise<LogoResult[]> {
  const results: LogoResult[] = []
  for (const domain of domains.slice(0, 3)) {
    const url = `https://logo.clearbit.com/${domain}?size=512`
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
      if (resp.ok) {
        results.push({
          id: generateId(),
          source: `Clearbit (${domain})`,
          sourceType: 'clearbit',
          format: 'png',
          url,
          width: 512,
          height: 512,
          title: query,
        })
        break
      }
    } catch { /* ignore */ }
  }
  return results
}

/** 7. IconHorse Favicon API */
async function fetchIconHorse(query: string, domains: string[], _known: KnownInfo | null): Promise<LogoResult[]> {
  const results: LogoResult[] = []
  for (const domain of domains.slice(0, 3)) {
    const url = `https://icon.horse/icon/${domain}`
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
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
    } catch { /* ignore */ }
  }
  return results
}

/** 8. Wikipedia（兜底） */
async function fetchWikipedia(query: string, _domains: string[], known: KnownInfo | null): Promise<LogoResult[]> {
  if (!known?.wikipedia) return []
  try {
    let wikiImageUrl: string | null = null

    // 8.1 page/media API
    const mediaResp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/media/${encodeURIComponent(known.wikipedia)}`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (mediaResp.ok) {
      const mediaData = await mediaResp.json() as {
        items?: Array<{
          type: string
          title?: string
          original?: { source: string }
          thumbnail?: { source: string }
        }>
      }
      const items = mediaData.items || []
      const logoItem = items.find(
        (item) => item.type === 'image' && item.title && /logo/i.test(item.title)
      )
      if (logoItem) {
        wikiImageUrl = logoItem.original?.source || logoItem.thumbnail?.source || null
      }
    }

    // 8.2 page/summary thumbnail 回退
    if (!wikiImageUrl) {
      const summaryResp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(known.wikipedia)}`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (summaryResp.ok) {
        const summaryData = await summaryResp.json() as {
          thumbnail?: { source: string; width: number; height: number }
        }
        wikiImageUrl = summaryData.thumbnail?.source || null
      }
    }

    if (wikiImageUrl) {
      if (wikiImageUrl.toLowerCase().endsWith('.svg')) {
        const svgResp = await fetch(wikiImageUrl, { signal: AbortSignal.timeout(4000) })
        const svgText = await svgResp.text()
        if (svgText.trim().startsWith('<svg') && svgText.includes('</svg>')) {
          return [{
            id: generateId(),
            source: 'Wikipedia',
            sourceType: 'wikipedia',
            format: 'svg',
            url: wikiImageUrl,
            title: query,
          }]
        }
      }
      return [{
        id: generateId(),
        source: 'Wikipedia',
        sourceType: 'wikipedia',
        format: 'png',
        url: wikiImageUrl,
        title: query,
      }]
    }
  } catch { /* ignore */ }
  return []
}

/** 获取图像数据并生成 dataUrl */
async function fetchImageData(results: LogoResult[]): Promise<void> {
  await Promise.all(
    results.map(async (r) => {
      try {
        const resp = await fetch(r.url, { signal: AbortSignal.timeout(3000) })
        if (!resp.ok) return

        if (r.format === 'svg') {
          const text = await resp.text()
          if (text.trim().startsWith('<svg') && text.includes('</svg>')) {
            r.dataUrl = `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`
          }
        } else {
          const buffer = await resp.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          const ct = resp.headers.get('content-type') || 'image/png'
          r.dataUrl = `data:${ct};base64,${base64}`
        }
      } catch {
        // 获取失败，不设置 dataUrl
      }
    })
  )
}

const SOURCES: LogoSource[] = [
  { name: 'Official Favicon', type: 'favicon', fn: fetchOfficialFavicon },
  { name: 'Simple Icons', type: 'direct', fn: fetchSimpleIcons },
  { name: 'Google Favicon', type: 'favicon', fn: fetchGoogleFavicon },
  { name: 'GitHub Raw', type: 'github', fn: fetchGitHubRaw },
  { name: 'Favicon SVG', type: 'direct', fn: fetchFaviconSvg },
  { name: 'Clearbit', type: 'clearbit', fn: fetchClearbit },
  { name: 'IconHorse', type: 'favicon', fn: fetchIconHorse },
  { name: 'Wikipedia', type: 'wikipedia', fn: fetchWikipedia },
]

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
    // 并行执行所有源（Promise.allSettled 确保单个源失败不影响其他源）
    const tasks = SOURCES.map((src) => () => src.fn(query, domains, known))
    const sourceResults = await Promise.allSettled(tasks.map((t) => t()))

    // 展平并按 URL 去重
    const seenUrls = new Set<string>()
    const results: LogoResult[] = []
    for (const result of sourceResults) {
      if (result.status === 'fulfilled') {
        for (const r of result.value) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url)
            results.push(r)
          }
        }
      }
    }

    // 并行获取图像数据（短超时，失败不影响返回；若整体已接近 Vercel 10s 上限则跳过）
    const elapsedAfterSources = Date.now() - startTime
    if (elapsedAfterSources < 7000) {
      await fetchImageData(results)
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
