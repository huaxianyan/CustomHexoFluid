'use strict';

/**
 * 为首屏 Banner 和首页文章封面增加独立的渐进式图片效果。
 *
 * - Banner：低清图和原图都立即请求，原图保持高优先级。
 * - index_img：低清图与原图均使用浏览器原生 lazy loading，不参与正文图片包装。
 * - 不依赖 Fluid 的客户端 lazyload 脚本；图片自己的 load 事件即可触发过渡。
 */
module.exports = (hexo) => {
  hexo.extend.filter.register('after_render:html', (html) => {
    if (typeof html !== 'string') {
      return html;
    }

    html = transformBanner(html);
    html = transformIndexImages(html);
    return html;
  });
};

const transformBanner = (html) => {
  // 随机 Banner 会在客户端替换 backgroundImage，无法在构建阶段确定要预加载的图片。
  if (/\bid=["']banner["'][^>]*\bdata-random-banner=/i.test(html)) {
    return html;
  }

  let bannerUrl = '';
  const bannerPattern = /<div\b([^>]*\bid=["']banner["'][^>]*)>/i;
  const bannerMatch = html.match(bannerPattern);
  if (!bannerMatch || /\bdata-progressive-banner(?:=|\s|>)/i.test(bannerMatch[0])) {
    return html;
  }

  const styleMatch = bannerMatch[1].match(/\bstyle=(["'])([\s\S]*?)\1/i);
  if (!styleMatch) {
    return html;
  }

  const backgroundMatch = styleMatch[2].match(/background(?:-image)?\s*:\s*url\(\s*(["']?)(.*?)\1\s*\)/i);
  if (!backgroundMatch || !backgroundMatch[2]) {
    return html;
  }

  bannerUrl = backgroundMatch[2];
  const placeholderUrl = getProcessedUrl(bannerUrl);
  const originalTag = bannerMatch[0];
  const cleanedTag = originalTag
    .replace(/\s*style=(["'])([\s\S]*?)\1/i, (styleAttribute, quote, style) => {
      const cleanedStyle = style
        .replace(/background\s*:[^;]*url\(\s*(["']?)(.*?)\1\s*\)[^;]*;?/i, '')
        .replace(/background-image\s*:\s*url\(\s*(["']?)(.*?)\1\s*\)\s*;?/i, '')
        .replace(/background-size\s*:\s*cover\s*;?/i, '')
        .trim();
      return cleanedStyle ? ` style=${quote}${cleanedStyle}${quote}` : '';
    })
    .replace(/>$/, ' data-progressive-banner>');

  const imageLayers = `
  <img class="progressive-banner-image progressive-image-placeholder" src="${escapeAttribute(placeholderUrl)}" alt="" aria-hidden="true" loading="eager" fetchpriority="high" decoding="async">
  <img class="progressive-banner-image progressive-image-full" src="${escapeAttribute(bannerUrl)}" alt="" loading="eager" fetchpriority="high" decoding="async" onload="this.classList.add('is-loaded')">`;

  html = html.replace(originalTag, `${cleanedTag}${imageLayers}`);
  return injectBannerHead(html, bannerUrl, placeholderUrl);
};

const transformIndexImages = (html) => {
  const indexContainerPattern = /(<div\b[^>]*\bclass=(["'])[^"']*\bindex-img\b[^"']*\2[^>]*>)([\s\S]*?)(<\/div>)/gi;

  return html.replace(indexContainerPattern, (whole, opening, quote, content, closing) => {
    if (/\bprogressive-index-image\b/i.test(content)) {
      return whole;
    }

    const imageMatch = content.match(/<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/i);
    if (!imageMatch) {
      return whole;
    }

    const originalImage = imageMatch[0];
    const sourceUrl = imageMatch[2];
    const placeholderUrl = getProcessedUrl(sourceUrl);
    const altMatch = originalImage.match(/\balt=(["'])(.*?)\1/i);
    const alt = altMatch ? altMatch[2] : '';

    let updatedContent = content.replace(/<a\b([^>]*)>/i, (anchor, attributes) => {
      return `<a${addClass(attributes, 'progressive-index-image')}>`;
    });

    const layers = `<img class="progressive-index-placeholder" src="${escapeAttribute(placeholderUrl)}" alt="" aria-hidden="true" loading="lazy" fetchpriority="low" decoding="async">
          <img class="progressive-index-full progressive-image-full" src="${escapeAttribute(sourceUrl)}" alt="${escapeAttribute(alt)}" loading="lazy" fetchpriority="low" decoding="async" onload="this.classList.add('is-loaded')">`;

    updatedContent = updatedContent.replace(originalImage, layers);
    return `${opening}${updatedContent}${closing}`;
  });
};

const injectBannerHead = (html, bannerUrl, placeholderUrl) => {
  if (!/<\/head>/i.test(html)) {
    return html;
  }

  const links = [];
  const origin = getRemoteOrigin(bannerUrl);
  if (origin && !html.includes(`rel="preconnect" href="${origin}"`)) {
    links.push(`<link rel="preconnect" href="${escapeAttribute(origin)}">`);
  }

  links.push(`<link rel="preload" as="image" href="${escapeAttribute(placeholderUrl)}" fetchpriority="high">`);
  links.push(`<link rel="preload" as="image" href="${escapeAttribute(bannerUrl)}" fetchpriority="high">`);

  if (!/document\.documentElement\.classList\.add\(['"]progressive-images-js/i.test(html)) {
    links.push('<script>document.documentElement.classList.add(\'progressive-images-js\')</script>');
  }

  return html.replace(/<\/head>/i, `  ${links.join('\n  ')}\n</head>`);
};

const getProcessedUrl = (url) => {
  const match = url.match(/^([^?#]*)([?#].*)?$/);
  const path = match ? match[1] : url;
  const suffix = match && match[2] ? match[2] : '';
  return `${path.replace(/\.[^./\\]+$/, '_proc.jpg')}${suffix}`;
};

const getRemoteOrigin = (url) => {
  try {
    if (/^\/\//.test(url)) {
      return new URL(`https:${url}`).origin;
    }
    if (/^https?:\/\//i.test(url)) {
      return new URL(url).origin;
    }
  } catch (_) {
    return '';
  }
  return '';
};

const addClass = (attributes, className) => {
  if (/\bclass=(["'])/i.test(attributes)) {
    return attributes.replace(/\bclass=(["'])(.*?)\1/i, (whole, quote, value) => {
      return `class=${quote}${value} ${className}${quote}`;
    });
  }
  return `${attributes} class="${className}"`;
};

const escapeAttribute = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
