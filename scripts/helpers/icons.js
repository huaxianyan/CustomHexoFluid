// 图标内联：把生成好的 SVG mask 样式表写进页面的 <style>。
//
// 历史：这两套图标原本来自 at.alicdn.com 的外链 CSS + 字体文件。字体是解析完 CSS
// 才发现的第二个跨域请求，@font-face 默认 font-display:auto，字体到达前图标隐形，
// 表现成"文字先出来、图标闪一下"。
//
// 先前的做法是把 woff2 转 base64 塞进 <style>：请求确实没了，但 base64 不可压缩，
// 每个页面固定多 18.5 KB，而且浏览器还要解码字体。
//
// 现在改用 SVG mask：图标路径本身就是矢量数据，参与 gzip 压缩，实测 gzip 后比
// base64 字体小约 5 KB/页，且没有字体下载与解码，图标跟 DOM 同一帧画出来。
//
// icons.css 由 tools/gen-icons-svg.py 从 assets/iconfont*/ 生成，只包含站点实际
// 用到的图标。加图标或换字库后重跑那个脚本，不要手改 icons.css。
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const ICONS = path.join(ASSETS, 'icons.css');

let cached = null;

hexo.extend.helper.register('icon_style', () => {
  if (cached === null) {
    cached = fs.readFileSync(ICONS, 'utf8');
  }
  return cached;
});
