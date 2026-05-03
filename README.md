# LogoScraper Pro

纯前端软件 Logo 智能爬取工具，支持 SVG/PNG 多格式输出，内置 Rust 高性能矢量化引擎。

[<img src="./public/home.png" alt="LogoScraper Pro 首页预览" width="100%">](https://logoscraper.freemankevin.uk)

## 功能特性

- 🔍 **智能搜索** — 输入软件名称，自动匹配 150+ 已知软件映射表
- 🌐 **多源爬取** — Clearbit、IconHorse、Wikipedia、GitHub Raw、官网 favicon.svg
- ⚡ **双模式支持** — Direct（浏览器直连）/ Cloud（云端聚合）
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
bash startup.sh
```

访问：http://localhost:5175/