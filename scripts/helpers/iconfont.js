// 图标字体内联：把 woff2 转成 base64 写进页面的 <style>。
//
// 两套字体都来自 at.alicdn.com，原来都是外链 CSS：
//   iconfont  (font_1749284) 主题自带，导航里"首页 / 时间线 / 归档"那些图标
//   iconfont2 (font_1736178) 站主自己的图集，奖杯页那个 PlayStation 图标等，目前用到 4 个
//
// 为什么必须内联：CSS 是阻塞的没问题，但字体是解析完 CSS 之后才发现的第二个跨域
// 请求，而 @font-face 没写 font-display（默认 auto），字体到达前图标隐形 3 秒内。
// 表现就是"文字先出来、图标闪一下"。
//
// 两个字号都只有几 KB，内联后零额外请求、图标与文字同帧出现，顺带去掉第三方依赖。
// 换图标时替换 scripts/assets/iconfont*/ 下的两个文件即可，不要改回外链。
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', '..', 'assets');

const build = (dir, name) => {
  const css = fs.readFileSync(path.join(ASSETS, dir, `${name}.css`), 'utf8');
  const font = fs.readFileSync(path.join(ASSETS, dir, `${name}.woff2`)).toString('base64');

  // 原 CSS 里 woff2/woff/ttf 三个来源，只保留 woff2（现代浏览器都支持）并内联。
  return css.replace(/src:[\s\S]*?;/, `src: url(data:font/woff2;base64,${font}) format('woff2');`);
};

const cache = {};
const inline = (dir, name) => {
  cache[dir] = cache[dir] || build(dir, name);
  return cache[dir];
};

hexo.extend.helper.register('iconfont_style', () => inline('iconfont', 'iconfont'));
hexo.extend.helper.register('iconfont2_style', () => inline('iconfont2', 'iconfont2'));
