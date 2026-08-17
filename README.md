# CustomHexoFluid

基于 [Fluid](https://github.com/fluid-dev/hexo-theme-fluid) 的个人定制主题，保留上游主题结构，并补充渐进式图片加载、暗色模式和导航体验优化。

## 获取主题

可直接从 [GitHub Releases](https://github.com/huaxianyan/CustomHexoFluid/releases) 下载完整主题压缩包，也可以使用 [`deploy`](https://github.com/huaxianyan/CustomHexoFluid/tree/deploy) 分支。

`main` 只保存相对 Fluid 上游新增或修改的文件，不是完整主题，不能直接安装。

## 分支

- [`main`](https://github.com/huaxianyan/CustomHexoFluid/tree/main)：保存个人覆盖文件，便于审查和维护改动
- [`deploy`](https://github.com/huaxianyan/CustomHexoFluid/tree/deploy)：保存 Fluid 上游源码与个人覆盖合并后的完整主题

## 功能

### 渐进式图片加载

- Banner 原图保持预加载、`eager` 和高请求优先级，先显示构建期内联的低清占位图，再平滑过渡到清晰原图
- 首页 `index_img` 使用独立的固定尺寸渐进图片结构，不受正文图片尺寸规则影响
- 正文图片使用构建期内联的 `_proc` 缩略图作为模糊占位，并在原图完成加载和解码后渐变清晰
- About 头像保持 Fluid 原生结构并直接加载，不参与正文图片 Lazyload
- 最终双层图片结构由 Hexo 在构建期生成，避免客户端替换 DOM 引起布局变化和重绘闪烁

### 配置与兼容

- `lazyload.post`、`lazyload.banner` 和 `lazyload.index` 可分别控制正文、Banner 与首页封面
- 兼容仅配置 `lazyload.enable` 和 `lazyload.onlypost` 的旧版配置
- 本地缺少 `_proc`、AVIF 或 WebP 时仍可正常写作和构建
- 面向现代 Chrome、Edge、Firefox、Safari、iOS Safari 和 Android 浏览器

### 其他调整

- 优化暗色模式配色
- 将正文按钮的个人样式整合进主题，并补全明暗模式过渡
- 统一 Fold 标题与箭头的悬停和明暗切换动画
- 优化移动端导航
- 修复非顶部刷新时恢复滚动位置造成的导航栏动画卡顿

## 配置

在站点的 Fluid 覆盖配置中按需设置：

```yaml
lazyload:
  enable: true
  post: true
  banner: true
  index: true
  onlypost: false
```

`enable` 是总开关。`post`、`banner` 和 `index` 缺失时默认启用；`onlypost` 只限制普通正文图片的处理范围。

## 图片约定

正文图片建议使用站点路径：

```markdown
![](/images/example/image.jpg)
```

主题在 Hexo 构建时优先读取 `source/images` 中的本地原图和占位图。占位图按以下顺序选择：

1. `image_proc.webp`
2. `image_proc.jpg`
3. 远程 `image_proc.jpg`

不超过 `4 KiB` 的本地占位图会直接内联到 HTML。原图地址保持不变，可由图片服务器根据客户端的 `Accept` 请求头协商 AVIF、WebP 或原始 JPG/PNG。

格式协商属于图片服务器能力，需正确返回：

```http
Vary: Accept
```

## 自动同步

GitHub Actions 会在以下情况重建 `deploy`：

- `main` 分支更新
- 手动触发工作流
- 每周一自动检查 Fluid 最新 Release

工作流会下载 Fluid 最新 Release、覆盖 `main` 中的个人文件、更新 `deploy`，并重新生成对应版本的 GitHub Release 和完整主题压缩包。Release Tag 始终指向 `deploy` 的完整主题提交。
