# AGENTS.md — LogoScraper Pro

> 本文档供 AI Coding Agent 阅读。项目主要开发语言为 TypeScript/React，UI 与业务注释以中文为主。

---

## 项目概述

**LogoScraper Pro** 是一个纯前端软件 Logo 智能爬取工具。用户在搜索框输入软件名称后，系统会模拟完整的爬取流程（DNS 解析 → TCP 连接 → HTTP 请求 → HTML 解析 → 资源扫描 → 下载 → 格式转换），并通过第三方公开 API 获取 Logo 资源，最终支持 SVG/PNG 一键下载。

本项目基于 **Vite + React 19 + TypeScript** 构建，UI 采用深色科技风格，首屏使用自定义 WebGL Shader 作为动态背景。

**注意**：项目仓库中同时保留了早期模板（展览档案模板 "5 Gird Sun Frontend Template"）的部分文件和文档（`README.md`、`info.md`、`src/config.ts` 中的展览相关类型等），但实际运行的应用已完全替换为 LogoScraper Pro。Agent 在修改代码时应以 `src/App.tsx` 及其引用链为准，避免被遗留的展览模板代码误导。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 19 (Function Components + Hooks) |
| 语言 | TypeScript 5.9 (严格模式) |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS v3 + 大量自定义 CSS 变量 + Inline Styles |
| UI 组件库 | shadcn/ui（基于 Radix UI Primitives） |
| 动画 | WebGL 自定义 Shader (VoidShader)、CSS Animations、GSAP（依赖已安装，当前主流程使用 CSS Animation） |
| 矢量转换 | ImageTracerJS（通过 `public/imagetracer.js` 全局脚本注入） |
| 字体 | Google Fonts — Inter, JetBrains Mono, Space Grotesk |

---

## 项目结构

```
├── public/
│   ├── imagetracer.js          # ImageTracerJS 库，用于 PNG→SVG 矢量化（全局 window.ImageTracer）
│   ├── images/                 # 静态图片资源
│   └── videos/                 # 静态视频资源
├── src/
│   ├── App.tsx                 # 根组件，组装 LogoScraper 主流程
│   ├── main.tsx                # 入口，createRoot 渲染 App
│   ├── index.css               # 全局样式、CSS 变量、Tailwind directives
│   ├── App.css                 # 空文件（保留但无内容）
│   ├── config.ts               # ⚠️ 遗留文件：包含展览模板的配置类型与空对象，当前 App.tsx 未引用
│   ├── sections/               # 页面级大模块
│   │   ├── VoidShader.tsx      # WebGL 全屏 Shader 背景（太阳/网格/山脉/道路）
│   │   ├── LogoSearchHero.tsx  # 首屏搜索区域（标题、输入框、快捷标签）
│   │   ├── TerminalPanel.tsx   # 终端面板（进度条 + 滚动日志）
│   │   ├── LogoResults.tsx     # 结果卡片网格（预览、下载按钮）
│   │   ├── ExhibitionDetail.tsx# ⚠️ 遗留文件（未使用）
│   │   ├── ExhibitionIndex.tsx # ⚠️ 遗留文件（未使用）
│   │   ├── Manifesto.tsx       # ⚠️ 遗留文件（未使用）
│   │   ├── Footer.tsx          # ⚠️ 遗留文件（未使用）
│   │   ├── Hero.tsx            # ⚠️ 遗留文件（未使用）
│   │   ├── CinematicPavilions.tsx # ⚠️ 遗留文件（未使用）
│   │   └── ...
│   ├── hooks/
│   │   ├── useScraper.ts       # 核心逻辑 Hook：状态管理、API 调用、进度模拟、格式转换
│   │   └── use-mobile.ts       # 响应式 Hook（判断视口宽度 < 768px）
│   ├── types/
│   │   └── scraper.ts          # LogoScraper 相关的 TypeScript 类型定义
│   ├── lib/
│   │   ├── utils.ts            # cn() 工具函数（clsx + tailwind-merge）
│   │   └── exhibitions.ts      # ⚠️ 遗留文件（未使用）
│   └── components/
│       ├── CustomCursor.tsx    # 自定义光标组件（当前未在 App.tsx 中使用）
│       └── ui/                 # shadcn/ui 原子组件（~50 个，基于 Radix）
├── index.html                  # HTML 模板，引入 Google Fonts 与 imagetracer.js
├── vite.config.ts              # Vite 配置（base: './', alias: @ -> ./src）
├── tsconfig.app.json           # TS 应用编译配置（严格模式、ES2022、noEmit）
├── tailwind.config.js          # Tailwind 配置（暗色主题、自定义颜色/动画）
├── postcss.config.js           # PostCSS（tailwindcss + autoprefixer）
├── eslint.config.js            # ESLint（TS + React Hooks + React Refresh）
└── package.json
```

---

## 构建与开发命令

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev

# 生产构建（类型检查 + Vite 打包）
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

- 构建产物输出到 `dist/` 目录。
- `base: './'` 配置使得产物支持相对路径部署。
- **无测试命令**：项目中未配置 Jest/Vitest/Playwright 等测试框架。

---

## 代码风格与约定

### TypeScript
- **严格模式全开**：`strict: true`、`noUnusedLocals: true`、`noUnusedParameters: true`
- 使用 `verbatimModuleSyntax: true`，导入类型时必须使用 `import type { ... }`
- 模块系统为 ESNext，`type: "module"`
- JSX 转换使用 `react-jsx`（无需显式引入 React）

### 路径别名
- `@/` 映射到 `./src/`，例如 `import { useScraper } from '@/hooks/useScraper'`

### 样式策略
- **核心页面模块**（`sections/` 下的 LogoSearchHero、TerminalPanel、LogoResults 等）主要使用 **Inline Styles** + **CSS 变量**，而非 Tailwind 工具类。
- **shadcn/ui 组件**（`components/ui/`）使用 Tailwind CSS 工具类 + `cn()` 工具函数。
- 全局颜色与字体通过 `:root` CSS 变量定义（见 `src/index.css`）。
- 暗色主题为唯一主题，无亮色模式切换。

### 命名与文件组织
- 组件文件使用 PascalCase，默认导出（`export default function ComponentName`）
- Hooks 文件使用 camelCase，命名必须以 `use` 开头
- 类型文件使用 PascalCase 接口名，集中放在 `src/types/`

### 语言
- 源代码中的 UI 文本、用户提示、日志输出均为**简体中文**。
- 代码标识符（变量、函数、组件名）使用英文。
- 修改时**保持中文用户界面**，不要擅自将面向用户的文本改为英文。

---

## 核心架构说明

### 状态管理
- 无 Redux/Zustand，全部状态通过 React `useState` + 自定义 Hook `useScraper` 管理。
- `useScraper.ts` 是业务核心，包含：
  - `ScraperState`：查询词、运行状态、日志数组、进度数组、结果数组、错误信息
  - `runScraper(query)`：按阶段推进的异步模拟流程
  - `downloadAsSvg(result)`：触发浏览器下载
  - `reset()`：中止并清空状态

### Logo 获取流程
1. **DNS 阶段**：通过内置的 `KNOWN_SOFTWARE` 映射表匹配已知软件，否则按规则生成候选域名。
2. **Fetch 阶段**：依次尝试以下公开 API：
   - `https://logo.clearbit.com/{domain}?size=512`
   - `https://icon.horse/icon/{domain}`
   - Wikipedia REST API (`https://en.wikipedia.org/api/rest_v1/page/summary/...`)
3. **Convert 阶段**：对非 SVG 结果调用 `window.ImageTracer.imageToSVG()` 进行客户端矢量化转换。

### WebGL 背景
- `VoidShader.tsx` 使用原生 WebGL API（非 Three.js），绘制包含太阳、星空、山脉、透视网格道路的复古科幻场景。
- 支持鼠标视差偏移（`u_mouse` uniform）。
- 组件卸载时会正确清理 `requestAnimationFrame`、事件监听、WebGL 资源。

---

## 遗留 / 未使用代码

以下文件属于早期展览模板，**当前 App.tsx 未引用**，修改时请勿与主业务逻辑混淆：

- `src/config.ts`（空的展览配置对象）
- `src/lib/exhibitions.ts`
- `src/sections/ExhibitionDetail.tsx`
- `src/sections/ExhibitionIndex.tsx`
- `src/sections/Manifesto.tsx`
- `src/sections/Footer.tsx`
- `src/sections/Hero.tsx`
- `src/sections/CinematicPavilions.tsx`
- `src/components/CustomCursor.tsx`

如需清理，应在确认无其他入口引用后再删除。

---

## 测试策略

- **当前无测试框架**。项目未配置单元测试、集成测试或 E2E 测试。
- 若需添加测试，建议方案：
  - 单元测试：Vitest（与 Vite 生态一致）
  - E2E 测试：Playwright

---

## 部署说明

- 输出为纯静态文件（SPA），适合部署到任意静态托管服务（Vercel、Netlify、GitHub Pages、Nginx 等）。
- 由于使用 `base: './'`，产物支持子目录部署。
- 无需服务端渲染（SSR）或后端 API。
- 若展览模板的路由被重新启用（`ExhibitionDetail` 等），需确保服务器对未知路径回退到 `index.html`。

---

## 安全注意事项

1. **外部 API 调用**：直接从前端向 Clearbit、IconHorse、Wikipedia 发起跨域请求，依赖对方 CORS 策略。若对方策略变更可能导致功能失效。
2. **外部脚本**：`index.html` 通过 `<script src="/imagetracer.js">` 加载本地 ImageTracerJS。该文件为第三方库，升级或替换时需校验来源。
3. **Google Fonts**：从 `fonts.googleapis.com` 和 `fonts.gstatic.com` 加载字体，存在外部依赖。
4. **无 CSP**：当前未配置 Content-Security-Policy，若部署到生产环境建议补充。
5. **跨域图片加载**：`loadImageAsync` 使用 `crossOrigin = 'anonymous'` 获取第三方图片，以便绘制到 Canvas 生成 DataURL。部分来源可能因缺少 CORS 头导致 Canvas 污染错误。

---

## 修改建议（供 Agent 参考）

- **优先阅读 `src/App.tsx` → `src/hooks/useScraper.ts` → `src/types/scraper.ts`**，这是当前活跃的业务主线。
- 修改 UI 文本时保持简体中文。
- 新增第三方 API 源时，在 `useScraper.ts` 的 Fetch 阶段按现有模式追加，注意错误捕获和日志输出。
- 不要修改 `VoidShader.tsx` 的 Shader 逻辑，除非修复渲染 Bug——它是项目的视觉识别核心。
- 使用 `cn()` 工具函数处理 Tailwind 类名条件合并，但主流程 Section 组件以内联样式为主，风格保持一致即可。
