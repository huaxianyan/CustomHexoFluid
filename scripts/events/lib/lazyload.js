'use strict';

const path = require('path')
const urlJoin = require('../../utils/url-join');
const sizeOf = require('image-size');

module.exports = (hexo) => {
  const config = hexo.theme.config;
  const loadingImage = urlJoin(hexo.config.root, config.lazyload.loading_img
    || urlJoin(config.static_prefix.internal_img, 'loading.gif'));
  if (!config.lazyload || !config.lazyload.enable || !loadingImage) {
    return;
  }
  if (config.lazyload.onlypost) {
    hexo.extend.filter.register('after_post_render', (page) => {
      if (page.layout !== 'post' && !page.lazyload) {
        return;
      }
      if (page.lazyload !== false) {
        collectImages(page.content)
        getImageSize()
        page.content = lazyImages(page.content, loadingImage);
        page.content = lazyComments(page.content);
      }
      return page;
    });
  } else {
    hexo.extend.filter.register('after_render:html', (html, data) => {
      if (!data.page || data.page.lazyload !== false) {
        collectImages(html)
        getImageSize()
        html = lazyImages(html, loadingImage);
        html = lazyComments(html);
        return html;
      }
    });
  }
};

const imageSet = new Set();
const imageMap = new Map();

const lazyImages = (htmlContent, loadingImage) => {
  return htmlContent.replace(/<img[^>]+?src=(".*?")[^>]*?>/gims, (str, p1) => {
    if (/loading=/i.test(str)) {
      return str;
    }
    let widthExist
    if (/width="[^"]+"/.test(str)) {
      widthExist = str.match(/width="([^"]+)"/)[1]
    }
    const info = imageMap.get(p1.replace(/"/g, ''))
    const thumb = p1.replace(/"/g, '').replace(/\.[^.]+$/, '_proc.jpg')
    if (info) {
      let style = `aspect-ratio: ${info.width} / ${info.height}`
      if (widthExist) {
        style += `;width:${widthExist}`
      } else {
        style += `;width:90%`
      }
      style += `;max-width:${info.width}px`
      return str.replace(p1, `${p1} style="${style}" srcset="${thumb}" lazyload loading="lazy"`);
    }
    return str.replace(p1, `${p1} srcset="${thumb}" lazyload loading="lazy"`);
  });
};

const lazyComments = (htmlContent) => {
  return htmlContent.replace(/<[^>]+?id="comments"[^>]*?>/gims, (str) => {
    if (/lazyload/i.test(str)) {
      return str;
    }
    return str.replace('id="comments"', 'id="comments" lazyload');
  });
};

const collectImages = (htmlContent) => {
  const images = htmlContent.match(/(?<=<img[^>]+?src=").*?(?="[^>]*?>)/gims)
  if (images) {
    images.forEach(image => imageSet.add(image))
  }
}

const getImageSize = () => {
  for (let imagePath of imageSet) {
    if (!imageMap.has(imagePath)) {
      const info = sizeOf(path.resolve(process.cwd(), 'source/', imagePath.replace(/^[\\\/]/, '')))
      imageMap.set(imagePath, info)
    }
  }
}
