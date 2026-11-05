// 图标字体内联：把 woff2 转成 base64 写进页面的 <style>。
//
// 原来是外链 //at.alicdn.com/t/c/font_1749284_...css（2 KB）+ woff2（4.4 KB）。
// 字体是解析完 CSS 之后才被发现的第二个跨域请求，而 @font-face 没写
// font-display（默认 auto），字体到达前图标隐形——表现就是导航里"首页 / 时间线"
// 前面的图标比文字晚出来。
//
// 两个文件加起来才 6.5 KB，内联后零额外请求、图标与文字同帧出现，
// 顺带去掉第三方 CDN 的可用性和隐私依赖。源文件存在 scripts/assets/iconfont/，
// 换图标时替换那两个文件即可（不要改回外链）。
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'iconfont');
let cached = null;

hexo.extend.helper.register('iconfont_style', () => {
  if (cached) return cached;

  const css = fs.readFileSync(path.join(DIR, 'iconfont.css'), 'utf8');
  const font = fs.readFileSync(path.join(DIR, 'iconfont.woff2')).toString('base64');

  // 原 CSS 里 woff2/woff/ttf 三个来源，只保留 woff2（现代浏览器都支持）并内联。
  cached = css.replace(/src:[\s\S]*?;/, `src: url(data:font/woff2;base64,${font}) format('woff2');`);
  return cached;
});
