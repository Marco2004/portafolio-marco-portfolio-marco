(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!els.length) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    function reveal(el) {
      var parent = el.parentElement;
      var sibs = parent ? Array.prototype.slice.call(parent.querySelectorAll(':scope > [data-reveal]')) : [el];
      var idx = Math.max(0, sibs.indexOf(el));
      el.style.transitionDelay = (idx * 90) + 'ms';
      el.classList.add('is-revealed');
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(function (el) { io.observe(el); });
  });
})();
