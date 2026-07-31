# custom_hexo_fluid

基于 [Fluid](https://github.com/fluid-dev/hexo-theme-fluid) 的个人定制主题。

## 分支

- `main`：只保存相对上游新增或修改的文件，便于查看和维护个人改动。
- `deploy`：保存 Fluid 上游源码与 `main` 分支内容合并后的完整可用主题。

GitHub Actions 每周检查一次 Fluid 最新 Release，并使用 `main` 中的文件重建 `deploy`、打包完整主题及更新对应的 GitHub Release；也可以手动触发，或在 `main` 更新时自动执行。

## 主要定制

- Banner 原图保持 eager/high priority 并预加载，低清占位图在构建期内联。
- 首页 `index_img` 使用独立的固定尺寸渐进图片结构，不受正文图片尺寸规则影响。
- 正文图片使用构建期内联的 `_proc` 缩略图作为模糊占位，原图加载完成后渐变清晰。
- `lazyload.post`、`lazyload.banner`、`lazyload.index` 可分别控制三类图片。
- 优化暗色模式、移动端导航及刷新恢复滚动位置时的顶栏状态。

图片服务器可按客户端 `Accept` 自动协商 AVIF/WebP；HTML 中仍使用原始 JPG/PNG 地址。本地 `_proc.webp` 或 `_proc.jpg` 会在 Hexo Build 时优先内联，缺失时回退到远程 `_proc.jpg`。
