/* global Fluid, CONFIG */

// (function(window, document) {
//   for (const each of document.querySelectorAll('img[lazyload]')) {
//     Fluid.utils.waitElementVisible(each, function() {
//       each.removeAttribute('srcset');
//       each.removeAttribute('lazyload');
//     }, CONFIG.lazyload.offset_factor);
//   }
// })(window, document);

(function(){
  const className = `img-box-${Math.floor(Math.random() * 100)}`

  jQuery('head').append(`<style>
  .${className} {
    position: relative;
    margin: 1.5rem auto;
    overflow: hidden;
    box-shadow: 0 5px 11px 0 rgb(0 0 0 / 18%), 0 4px 15px 0 rgb(0 0 0 / 15%);
  }
  .${className} .img-blur {
    filter: blur(32px);
    transition: filter 0.7s;
    opacity: 0;
  }
  .${className} .img-loaded {
    filter: none;
    opacity: 1;
  }
  .${className} img {
    border-radius: 4px;
  }
  .${className} .blur-loading {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    filter: blur(32px);
    object-fit: cover !important;
  }
  </style>`)
  jQuery('img[lazyload]').each(function() {
    const elem = $(this)
    const src = elem.attr('src')
    const mini = src.replace(/\.[^.]+$/, '_proc.jpg')
    const style = elem.attr('style')
    elem.replaceWith(`<div class="${className}" style="${style}">
      <img class="img-blur" data-src="${src}" loading="lazy">
      <img class="blur-loading" src="${mini}">
    </div>`)
  })
  jQuery('.img-blur').on('load', function() {
    const elem = $(this)
    elem.addClass('img-loaded')
    elem.closest(`.${className}`).find('.blur-loading').remove()
  })
  jQuery('.blur-loading').on('load', function() {
    const elem = $(this)
    const img = elem.closest(`.${className}`).find('.img-blur')
    img.attr('src', img.data('src'))
  })
})()
