/* global hexo */

'use strict';

hexo.extend.generator.register('_hexo_generator_search', function(locals) {
  const config = this.theme.config;
  if (!config.search.enable) {
    return;
  }

  const nunjucks = require('nunjucks');
  const env = new nunjucks.Environment();
  const pathFn = require('path');
  const fs = require('fs');

  env.addFilter('uriencode', function(str) {
    return encodeURI(str);
  });

  env.addFilter('noControlChars', function(str) {
    // eslint-disable-next-line no-control-regex
    return str && str.replace(/[\x00-\x1F\x7F]/g, '');
  });

  env.addFilter('stableItems', function(collection) {
    const items = collection && typeof collection.toArray === 'function'
      ? collection.toArray()
      : Array.from(collection || []);
    return items.sort((a, b) => String(a.name || a.path || '').localeCompare(String(b.name || b.path || ''), 'en'));
  });

  env.addFilter('urlJoin', function(str) {
    const base = str[0];
    const relative = str[1];
    return relative
      ? base.replace(/\/+$/, '') + '/' + relative.replace(/^\/+/, '')
      : base;
  });

  const searchTmplSrc = pathFn.join(hexo.theme_dir, './source/xml/local-search.xml');
  const searchTmpl = nunjucks.compile(fs.readFileSync(searchTmplSrc, 'utf8'), env);

  const searchConfig = config.search;
  let searchField = searchConfig.field;
  const content = searchConfig.content && true;

  let posts, pages;
  const compareByDateAndPath = (a, b) => b.date.valueOf() - a.date.valueOf()
    || String(a.path).localeCompare(String(b.path), 'en');
  const compareByPath = (a, b) => String(a.path).localeCompare(String(b.path), 'en');

  if (searchField.trim() !== '') {
    searchField = searchField.trim();
    if (searchField === 'post') {
      posts = locals.posts.toArray().sort(compareByDateAndPath);
    } else if (searchField === 'page') {
      pages = locals.pages.toArray().sort(compareByPath);
    } else {
      posts = locals.posts.toArray().sort(compareByDateAndPath);
      pages = locals.pages.toArray().sort(compareByPath);
    }
  } else {
    posts = locals.posts.toArray().sort(compareByDateAndPath);
  }

  const xml = searchTmpl.render({
    config : config,
    posts  : posts,
    pages  : pages,
    content: content,
    url    : hexo.config.root
  });

  return {
    path: searchConfig.generate_path || '/local-search.xml',
    data: xml
  };
});
