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
// icons.css 由 tools/gen-icons-svg.py 从 assets/iconfont*/ 生成。为了控制体积，它只
// 收录「主题配置 + 本站源码」里实际用到的图标；换图标或换字库后要重跑生成器，不要手改。
// 用了生成表里没有的图标不会报错，只会渲染成空白，所以这里在构建末尾做一次检查。
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const ICONS = path.join(ASSETS, 'icons.css');
const REGENERATE = 'python tools/gen-icons-svg.py --scan . --scan <你的站点目录>';

let cached = null;
const usedIcons = new Set();

function styleText() {
  if (cached === null) {
    cached = fs.readFileSync(ICONS, 'utf8');
  }
  return cached;
}

// 从 icons.css 里取出已定义的图标名
function definedIcons(css) {
  const names = new Set();
  for (const m of css.matchAll(/\.icon-([a-z0-9-]+):before/g)) names.add(m[1]);
  return names;
}

// 从渲染好的 HTML 里取出 class 中用到的图标名。只认同时带 iconfont/iconfont2 的 class
// 属性（主题的所有用法都是 `class="iconfont icon-xxx"`），这样不会把 .icon-xxx 这类
// 非字体类名误报成缺图标。
function collectIconNames(html, into) {
  for (const attr of html.matchAll(/class="[^"]*\biconfont2?\b[^"]*"/g)) {
    for (const m of attr[0].matchAll(/\bicon-([a-z0-9-]+)/g)) into.add(m[1]);
  }
  return into;
}

hexo.extend.helper.register('icon_style', () => styleText());

hexo.extend.filter.register('after_render:html', (str) => {
  collectIconNames(str, usedIcons);
  return str;
});

// 生成结束后比对一次：缺哪个图标、怎么补，直接说清楚，别让人对着空白猜
hexo.extend.filter.register('after_generate', () => {
  const known = definedIcons(styleText());
  const missing = [...usedIcons].filter(n => !known.has(n)).sort();
  if (!missing.length) return;
  hexo.log.warn(`图标样式表里没有这些图标（会渲染成空白）：${missing.join(' ')}`);
  hexo.log.warn(`补法：${REGENERATE}`);
  hexo.log.warn('生成器需要 Python 3 与 fonttools（pip install fonttools），字库在 assets/iconfont*/。');
});

module.exports = { definedIcons, collectIconNames };
