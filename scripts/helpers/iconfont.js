// 图标以内联 SVG mask 呈现，不再加载字体文件。
//
// 原来两套图标字体（at.alicdn.com 的 iconfont / iconfont2）内联成 base64：
// 字体要等文档下载完再解码，偶尔还能看到图标闪一下；而且 base64 不可压缩，
// 18 KB 体积一分不少地进每一页。
//
// 现在改成把用到的字形（25 + 8 个）从 woff2 提取成 SVG path，写成 mask 规则：
// 图标随 DOM 一起画出来，零解码；路径数据可 gzip 压缩，首页实际传输从 31 KB 降到 ~25 KB。
//
// assets/icons.css 由 fonttools 从 assets/iconfont*/iconfont*.woff2 生成（脚本见
// 仓库外的 mkicons.py，提取逻辑很简单：解析 CSS 拿码位 → SVGPathPen 取轮廓）。
// 加图标：改字体源文件后重新生成 icons.css，不要手写 path。
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'assets', 'icons.css');
let cached = null;

hexo.extend.helper.register('icon_style', () => {
  if (!cached) cached = fs.readFileSync(FILE, 'utf8');
  return cached;
});
