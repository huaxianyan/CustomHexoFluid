'use strict';

const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

const MAX_INLINE_PLACEHOLDER_BYTES = 4096;

const createLocalImageAssets = (hexo) => {
  const sourceDir = path.resolve(hexo.source_dir || path.join(hexo.base_dir, 'source'));
  const imageInfoCache = new Map();
  const placeholderCache = new Map();

  return {
    getInfo(imageUrl) {
      const localPath = resolveLocalImage(sourceDir, imageUrl);
      if (!localPath) return null;
      if (imageInfoCache.has(localPath)) return imageInfoCache.get(localPath);

      try {
        if (fs.statSync(localPath).isFile()) {
          const info = sizeOf(localPath);
          imageInfoCache.set(localPath, info);
          return info;
        }
      } catch (_) {
        // 外链图片没有本地副本时不读取网络。
      }

      imageInfoCache.set(localPath, null);
      return null;
    },

    getPlaceholder(imageUrl) {
      const localPath = resolveLocalImage(sourceDir, imageUrl);
      if (!localPath) return '';
      if (placeholderCache.has(localPath)) return placeholderCache.get(localPath);

      // 占位图由站点构建期生成，格式只有一种：原图同目录 proc/ 下的 17px WebP。
      try {
        const placeholderPath = variantPath(localPath, 'proc', 'webp');
        const stat = fs.statSync(placeholderPath);
        if (stat.isFile() && stat.size <= MAX_INLINE_PLACEHOLDER_BYTES) {
          const data = fs.readFileSync(placeholderPath).toString('base64');
          const result = `data:image/webp;base64,${data}`;
          placeholderCache.set(localPath, result);
          return result;
        }
      } catch (_) {
        // 没生成变体时返回空串，由调用方拼出远端占位图地址。
      }

      placeholderCache.set(localPath, '');
      return '';
    }
  };
};

// 变体目录约定与站点构建脚本（Hexo 仓库的 generate-image-variants.mjs）一致：
// 原图 <目录>/<名字>.<ext> 的变体在 <目录>/<变体>/<名字>.<变体扩展名>。
const variantPath = (localPath, variant, extension) => path.join(
  path.dirname(localPath),
  variant,
  `${path.basename(localPath, path.extname(localPath))}.${extension}`
);

const resolveLocalImage = (sourceDir, imageUrl) => {
  let pathname = String(imageUrl).split(/[?#]/, 1)[0];
  let remote = false;

  try {
    if (/^\/\//.test(imageUrl)) {
      pathname = new URL(`https:${imageUrl}`).pathname;
      remote = true;
    } else if (/^https?:\/\//i.test(imageUrl)) {
      pathname = new URL(imageUrl).pathname;
      remote = true;
    }
    pathname = decodeURIComponent(pathname);
  } catch (_) {
    return '';
  }

  pathname = pathname.replace(/\\/g, '/');
  if (remote && !pathname.startsWith('/images/')) {
    pathname = `/images${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  }
  pathname = pathname.replace(/^\/+/, '');

  const localPath = path.resolve(sourceDir, pathname);
  const sourcePrefix = `${sourceDir}${path.sep}`.toLowerCase();
  if (localPath.toLowerCase() !== sourceDir.toLowerCase()
      && !localPath.toLowerCase().startsWith(sourcePrefix)) {
    return '';
  }
  return localPath;
};

const getProcessedUrl = (url) => {
  const match = String(url).match(/^([^?#]*)([?#].*)?$/);
  const pathname = match ? match[1] : String(url);
  const suffix = match && match[2] ? match[2] : '';
  // a/b/1.jpg → a/b/proc/1.webp，与本地变体目录约定一致。
  return `${pathname.replace(/(^|\/)([^/]*)\.[^./\\]+$/, '$1proc/$2.webp')}${suffix}`;
};

module.exports = {
  createLocalImageAssets,
  getProcessedUrl
};
