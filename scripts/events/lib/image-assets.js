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

      const candidates = [
        { path: localPath.replace(/\.[^./\\]+$/, '_proc.webp'), mime: 'image/webp' },
        { path: localPath.replace(/\.[^./\\]+$/, '_proc.jpg'), mime: 'image/jpeg' }
      ];

      for (const candidate of candidates) {
        try {
          const stat = fs.statSync(candidate.path);
          if (stat.isFile() && stat.size <= MAX_INLINE_PLACEHOLDER_BYTES) {
            const data = fs.readFileSync(candidate.path).toString('base64');
            const result = `data:${candidate.mime};base64,${data}`;
            placeholderCache.set(localPath, result);
            return result;
          }
        } catch (_) {
          // 尝试下一个本地格式。
        }
      }

      placeholderCache.set(localPath, '');
      return '';
    }
  };
};

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
  return `${pathname.replace(/\.[^./\\]+$/, '_proc.jpg')}${suffix}`;
};

module.exports = {
  createLocalImageAssets,
  getProcessedUrl
};
