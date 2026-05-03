# LogoScraper Pro

> 纯前端软件 Logo 智能爬取工具，支持 SVG/PNG 多格式输出，内置 Rust 高性能矢量化引擎。

## 功能特性

- 🔍 **智能搜索** — 输入软件名称，自动匹配 150+ 已知软件映射表
- 🌐 **多源爬取** — Clearbit、IconHorse、Wikipedia、GitHub Raw、官网 favicon.svg
- ⚡ **双模式支持** — Direct（浏览器直连）/ API（服务端聚合）
- 🦀 **Rust 工具链** — 高性能图像压缩、格式转换、矢量化（CLI + WASM）
- 📊 **终端可视化** — 7 阶段进度条 + 实时滚动日志
- 🔌 **开放 API** — 对外提供 HTTP API，支持第三方调用（含速率限制）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vite + React 19 + TypeScript |
| 样式 | Tailwind CSS + Inline Styles |
| 动画 | WebGL 自定义 Shader + CSS Animations |
| 工具链 | Rust (reqwest + tokio + image) |
| WASM | wasm-bindgen (浏览器端图像处理) |
| API | Vercel Serverless Functions |

## 快速开始

```bash
# 安装依赖
npm install

# 开发
npm run dev

# 构建（含 Rust WASM）
npm run build:wasm
npm run build

# Rust CLI 工具
cd tools/logo-scraper
cargo run -- "vscode"
```

## API 使用

```bash
curl -X POST https://your-app.vercel.app/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"query": "vscode", "formats": ["svg","png"]}'
```

响应示例：

```json
{
  "success": true,
  "query": "vscode",
  "results": [
    {
      "id": "res-xxx",
      "source": "Clearbit (code.visualstudio.com)",
      "format": "png",
      "url": "https://logo.clearbit.com/..."
    }
  ],
  "meta": {
    "sourcesChecked": 5,
    "resultsFound": 1,
    "elapsedMs": 1200
  }
}
```

## 部署

### Vercel（推荐）

```bash
vercel
```

自动部署前端 SPA + Serverless Functions。

### 纯静态（无 API）

```bash
npm run build
# 将 dist/ 部署到任意静态托管
```

## 速率限制

| 类型 | 限制 |
|------|------|
| 免费用户（无 API Key） | 10 次/分钟 |
| 已认证用户 | 60 次/分钟 |
| 函数超时 | 10 秒 |
| 并发源数 | 最多 3 个 |

## 项目结构

```
├── api/                    # Vercel Serverless Functions
├── src/                    # 前端 React
├── tools/logo-scraper/     # Rust 爬虫工具链
│   ├── src/
│   │   ├── lib.rs          # 核心库
│   │   ├── bin/cli.rs      # CLI 入口
│   │   └── wasm.rs         # WASM 绑定
│   └── Cargo.toml
├── vercel.json             # Vercel 配置
└── ...
```

## License

MIT
