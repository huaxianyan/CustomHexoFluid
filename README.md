# custom_hexo_fluid

基于 [Fluid](https://github.com/fluid-dev/hexo-theme-fluid) 的个人定制版本，用于给自己的 Hexo 博客构建主题包。项目不会向 Fluid 上游提交 PR。

## 分支

- `custom`：只保存相对上游新增或修改的文件，便于查看和维护个人改动。
- `main`：保存当前 Fluid 上游源码与 `custom` 分支内容合并后的完整可用主题。

## 主要定制

- 正文图片使用 `_proc` 缩略图作为模糊占位，原图加载完成后渐变清晰。
- Banner 原图保持 eager/high priority，并预加载 Banner 与缩略图。
- 首页 `index_img` 使用独立的固定尺寸渐进图片结构，不受正文图片尺寸规则影响。
- 优化暗色模式下的图片和折叠区域显示。

图片服务器会按客户端 `Accept` 自动协商 AVIF/WebP；HTML 中仍使用原始 JPG/PNG 地址。对应的 `_proc.jpg` 及现代格式文件需要由外部图片处理工具提前生成。
