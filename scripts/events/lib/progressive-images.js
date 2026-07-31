'use strict';

const { createLocalImageAssets, getProcessedUrl } = require('./image-assets');

/**
 * 为首屏 Banner 和首页文章封面增加独立的渐进式图片效果。
 *
 * - Banner：低清图和原图都立即请求，原图保持高优先级。
 * - index_img：低清图与原图均使用浏览器原生 lazy loading，不参与正文图片包装。
 * - 不依赖 Fluid 的客户端 lazyload 脚本；图片自己的 load 事件即可触发过渡。
 */
module.exports = (hexo, options = {}) => {
  const imageAssets = createLocalImageAssets(hexo);
  const bannerEnabled = options.banner !== false;
  const indexEnabled = options.index !== false;

  hexo.extend.filter.register('after_render:html', (html) => {
    if (typeof html !== 'string') {
      return html;
    }

    if (bannerEnabled) {
      html = transformBanner(html, imageAssets);
    }
    if (indexEnabled) {
      html = transformIndexImages(html, imageAssets);
    }
    return html;
  });
};

const transformBanner = (html, imageAssets) => {
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
  const remotePlaceholderUrl = getProcessedUrl(bannerUrl);
  const placeholderUrl = imageAssets.getPlaceholder(bannerUrl) || remotePlaceholderUrl;
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
  <img class="progressive-banner-image progressive-image-placeholder" src="${escapeAttribute(placeholderUrl)}" alt="" aria-hidden="true" loading="eager" fetchpriority="high" decoding="sync">
  <img class="progressive-banner-image progressive-image-full" src="${escapeAttribute(bannerUrl)}" alt="" loading="eager" fetchpriority="high" decoding="async" onload="window.__progressiveImageLoaded(this)">`;

  html = html.replace(originalTag, `${cleanedTag}${imageLayers}`);
  return injectBannerHead(html, bannerUrl, placeholderUrl, remotePlaceholderUrl);
};

const transformIndexImages = (html, imageAssets) => {
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
    const placeholderUrl = imageAssets.getPlaceholder(sourceUrl) || getProcessedUrl(sourceUrl);
    const altMatch = originalImage.match(/\balt=(["'])(.*?)\1/i);
    const alt = altMatch ? altMatch[2] : '';

    let updatedContent = content.replace(/<a\b([^>]*)>/i, (anchor, attributes) => {
      return `<a${addClass(attributes, 'progressive-index-image')}>`;
    });

    const layers = `<img class="progressive-index-placeholder" src="${escapeAttribute(placeholderUrl)}" alt="" aria-hidden="true" loading="eager" fetchpriority="low" decoding="sync">
          <img class="progressive-index-full progressive-image-full" src="${escapeAttribute(sourceUrl)}" alt="${escapeAttribute(alt)}" loading="lazy" fetchpriority="low" decoding="async" onload="window.__progressiveImageLoaded(this)">`;

    updatedContent = updatedContent.replace(originalImage, layers);
    return `${opening}${updatedContent}${closing}`;
  });
};

const injectBannerHead = (html, bannerUrl, placeholderUrl, remotePlaceholderUrl) => {
  if (!/<\/head>/i.test(html)) {
    return html;
  }

  const links = [];
  const origin = getRemoteOrigin(bannerUrl);
  if (origin && !html.includes(`rel="preconnect" href="${origin}"`)) {
    links.push(`<link rel="preconnect" href="${escapeAttribute(origin)}">`);
  }

  // 本地 _proc 已经内联时不再为 Data URI 生成无意义的 preload。
  if (placeholderUrl === remotePlaceholderUrl) {
    links.push(`<link rel="preload" as="image" href="${escapeAttribute(placeholderUrl)}" fetchpriority="high">`);
  }
  links.push(`<link rel="preload" as="image" href="${escapeAttribute(bannerUrl)}" fetchpriority="high">`);

  if (!/document\.documentElement\.classList\.add\(['"]progressive-images-js/i.test(html)) {
    links.push(`<script>(function(){
  document.documentElement.classList.add('progressive-images-js');
  var nextFrame = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function(callback) { return window.setTimeout(callback, 16); };
  window.__progressiveImageLoaded = function(image) {
    if (!image || image.__progressiveRevealPending) return;
    image.__progressiveRevealPending = true;
    var reveal = function() {
      var afterDecode = function() {
        // Banner 可能在首屏绘制完成前就已由 preload 命中缓存。
        // 短暂保留占位图，让页面先稳定呈现，再开始与正文一致的 .7s 过渡。
        window.setTimeout(function() {
          nextFrame(function() {
            nextFrame(function() { image.classList.add('is-loaded'); });
          });
        }, 180);
      };
      if (typeof image.decode === 'function') {
        image.decode().then(afterDecode, afterDecode);
      } else {
        afterDecode();
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', reveal, { once: true });
    } else {
      reveal();
    }
  };
})();</script>`);
  }

  return html.replace(/<\/head>/i, `  ${links.join('\n  ')}\n</head>`);
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
