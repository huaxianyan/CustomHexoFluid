/* global jQuery */

(function() {
  const boxSelector = '.fluid-lazy-image';

  const revealFullImage = (image) => {
    if (image.__fluidRevealPending) return;
    image.__fluidRevealPending = true;

    const reveal = () => {
      const elem = jQuery(image);
      const box = elem.closest(boxSelector);
      const placeholder = box.find('.blur-loading');

      // 先让已解码原图以 blur(32px) 真正绘制一帧，缓存命中时也不会跳过 transition。
      elem.addClass('img-reveal-ready');
      void image.offsetWidth;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          let removed = false;
          const removePlaceholder = () => {
            if (removed) return;
            removed = true;
            placeholder.remove();
          };

          elem.one('transitionend', function(event) {
            if (!event.originalEvent || event.originalEvent.propertyName === 'filter') {
              removePlaceholder();
            }
          });
          elem.addClass('img-loaded');
          window.setTimeout(removePlaceholder, 850);
        });
      });
    };

    if (typeof image.decode === 'function') {
      image.decode().then(reveal, reveal);
    } else {
      reveal();
    }
  };

  jQuery(`${boxSelector} .img-blur`).one('load', function() {
    revealFullImage(this);
  });

  jQuery(`${boxSelector} .blur-loading`).each(function() {
    const placeholder = this;
    const startOriginal = () => {
      if (placeholder.__fluidOriginalStarted) return;
      placeholder.__fluidOriginalStarted = true;
      const image = jQuery(placeholder).closest(boxSelector).find('.img-blur');
      image.attr('src', image.data('src'));
    };

    jQuery(placeholder).one('load', startOriginal).one('error', startOriginal);

    if (placeholder.complete) {
      window.setTimeout(startOriginal, 0);
    }
  });
})();
