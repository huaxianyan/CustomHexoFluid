# CustomHexoFluid

基于 [Fluid](https://github.com/fluid-dev/hexo-theme-fluid) 的个人定制主题，保留上游主题结构，并补充渐进式图片加载、暗色模式和导航体验优化。

## 获取主题

[`main`](https://github.com/huaxianyan/CustomHexoFluid/tree/main) 是已经合入个人修改的完整主题，可直接安装。GitHub Releases 保留各次发布的完整主题快照。

只需要审查个人修改时，可以查看 [`custom`](https://github.com/huaxianyan/CustomHexoFluid/tree/custom) 分支。

## 分支

- [`main`](https://github.com/huaxianyan/CustomHexoFluid/tree/main)：完整可安装主题，包含 Fluid 上游源码和已经确认的个人修改
- [`custom`](https://github.com/huaxianyan/CustomHexoFluid/tree/custom)：只保存相对 Fluid 上游新增或修改的文件，便于审查和维护

## 发布版本

自定义主题的 Release Tag 使用以下格式：

```text
v<Fluid 上游版本>-custom.<YYYYMMDD>
```

例如，基于 Fluid `1.9.9` 并在 2026 年 9 月 3 日发布的版本为：

```text
v1.9.9-custom.20260903
```

每个 Tag 都是不可覆盖的完整主题快照。旧 Release 不移动、不替换；同一天的修改合并验证后统一发布一次。

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
- 为本地搜索增加独立的「清除」按钮，清空后恢复输入焦点

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

## 上游更新

仓库不会自动合并 Fluid 上游版本。自动替换完整主题容易覆盖或绕过已经形成依赖关系的个人改动，因此新版本发布后应先检查 Release Notes 和实际差异，再决定需要引入的功能与文件。

建议按以下顺序更新：

1. 比较当前 `main` 与 Fluid 新版本的差异。
2. 确认上游变更是否影响 `custom` 中的个人覆盖文件。
3. 在 `custom` 中维护个人修改，并按功能逐项合入完整主题。
4. 完成本地 Hexo 构建验证后，人工更新 `main`、Release Tag 和主题压缩包。
