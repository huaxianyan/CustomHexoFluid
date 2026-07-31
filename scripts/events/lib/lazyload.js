'use strict';

const { createLocalImageAssets, getProcessedUrl } = require('./image-assets');

module.exports = (hexo) => {
  const config = hexo.theme.config;
  const lazyload = config.lazyload || {};
  if (!lazyload.enable) {
    return;
  }

  // 三类图片可独立关闭；未配置新选项时默认开启，兼容旧版配置。
  const postEnabled = lazyload.post !== false;
  const bannerEnabled = lazyload.banner !== false;
  const indexEnabled = lazyload.index !== false;

  // Banner 与首页 index_img 使用独立的渐进式策略，避免正文包装改变卡片尺寸。
  if (bannerEnabled || indexEnabled) {
    require('./progressive-images')(hexo, {
      banner: bannerEnabled,
      index: indexEnabled
    });
  }

  if (!postEnabled) {
    return;
  }

  const transformImages = createImageTransformer(createLocalImageAssets(hexo));

  if (lazyload.onlypost) {
    hexo.extend.filter.register('after_post_render', (page) => {
      if (page.layout !== 'post' && !page.lazyload) {
        return;
      }
      if (page.lazyload !== false) {
        page.content = transformImages(page.content);
        page.content = lazyComments(page.content);
      }
      return page;
    });
  } else {
    hexo.extend.filter.register('after_render:html', (html, data) => {
      if (!data.page || data.page.lazyload !== false) {
        html = transformImages(html);
        html = lazyComments(html);
        return html;
      }
    });
  }
};

const createImageTransformer = (imageAssets) => {
  return (htmlContent) => {
    // index_img 始终交给独立的 index 开关；避免 onlypost=false 时被正文包装器接管。
    const protectedBlocks = [];
    const maskedContent = htmlContent.replace(
      /<div\b[^>]*\bclass=(["'])[^"']*\bindex-img\b[^"']*\1[^>]*>[\s\S]*?<\/div>/gi,
      (block) => {
        const token = `<!-- fluid-index-image-${protectedBlocks.length} -->`;
        protectedBlocks.push(block);
        return token;
      }
    );

    const transformed = maskedContent.replace(
    /<img\b[^>]*?\bsrc=(["'])(.*?)\1[^>]*?>/gims,
    (tag, quote, encodedSource) => {
      // Banner、首页渐进图和已经处理过的图片都带有 loading，必须保持原结构。
      if (/\bloading\s*=/i.test(tag) || /\bdata-original-src\s*=/i.test(tag)) {
        return tag;
      }

      const original = decodeAttribute(encodedSource);
      if (!original || /^data:/i.test(original)) {
        return tag;
      }

      const info = imageAssets.getInfo(original);
      // 没有本地原图就无法在构建期确定容器尺寸，保留原标签比运行时猜测更安全。
      if (!info) {
        return tag;
      }

      const remotePlaceholder = getProcessedUrl(original);
      const placeholder = imageAssets.getPlaceholder(original) || remotePlaceholder;
      const widthMatch = tag.match(/\bwidth=(["'])(.*?)\1/i);
      const width = widthMatch ? widthMatch[2] : '';
      const styleMatch = tag.match(/\bstyle=(["'])(.*?)\1/i);
      const currentStyle = styleMatch ? styleMatch[2].trim().replace(/;?$/, ';') : '';
      const wrapperStyle = `${currentStyle}${[
        `aspect-ratio: ${info.width} / ${info.height}`,
        width ? `width:${width}` : 'width:90%',
        `max-width:${info.width}px`
      ].join(';')}`;
      const altMatch = tag.match(/\balt=(["'])(.*?)\1/i);
      const titleMatch = tag.match(/\btitle=(["'])(.*?)\1/i);
      const classMatch = tag.match(/\bclass=(["'])(.*?)\1/i);
      const alt = altMatch ? altMatch[2] : '';
      const title = titleMatch ? ` title="${escapeAttribute(titleMatch[2])}"` : '';
      const originalClass = classMatch ? ` ${classMatch[2]}` : '';

      // 最终双层结构直接在 Build 阶段生成，避免页尾 JS 替换 img 导致外框重绘闪烁。
      return `<span class="fluid-lazy-image" style="${escapeAttribute(wrapperStyle)}">
  <img class="img-blur${escapeAttribute(originalClass)}" data-src="${escapeAttribute(original)}" alt="${escapeAttribute(alt)}"${title} loading="lazy" fetchpriority="low" decoding="async">
  <img class="blur-loading" src="${escapeAttribute(placeholder)}" alt="" aria-hidden="true" loading="lazy" fetchpriority="low" decoding="sync">
</span>`;
    }
    );

    return transformed.replace(/<!-- fluid-index-image-(\d+) -->/g, (token, index) => {
      return protectedBlocks[Number(index)] || token;
    });
  };
};

const lazyComments = (htmlContent) => htmlContent.replace(
  /<[^>]+?id=(["'])comments\1[^>]*?>/gims,
  (tag) => (/\blazyload\b/i.test(tag)
    ? tag
    : tag.replace(/id=(["'])comments\1/i, 'id="comments" lazyload'))
);

const decodeAttribute = (value) => String(value)
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const escapeAttribute = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');
