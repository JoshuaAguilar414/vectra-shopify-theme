(() => {
  const root = document.querySelector('[data-vectra-home]');
  if (!root) return;

  const qs = (sel, el = root) => el.querySelector(sel);
  const qsa = (sel, el = root) => [...el.querySelectorAll(sel)];

  const header = qs('[data-vh-header]');
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const navToggle = qs('[data-vh-nav-toggle]');
  const navPanel = qs('[data-vh-nav-panel]');
  if (navToggle && navPanel) {
    navToggle.addEventListener('click', () => {
      const open = navPanel.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('vh-nav-open', open);
    });
    qsa('a', navPanel).forEach((link) => {
      link.addEventListener('click', () => {
        navPanel.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('vh-nav-open');
      });
    });
  }

  const initCarousel = (carousel) => {
    const track = qs('[data-vh-track]', carousel);
    const slides = qsa('[data-vh-slide]', carousel);
    if (!track || slides.length < 2) return;
    let index = 0;
    const go = (next) => {
      index = (next + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      qsa('[data-vh-dot]', carousel).forEach((dot, i) => {
        dot.classList.toggle('is-active', i === index);
      });
    };
    qs('[data-vh-prev]', carousel)?.addEventListener('click', () => go(index - 1));
    qs('[data-vh-next]', carousel)?.addEventListener('click', () => go(index + 1));
    qsa('[data-vh-dot]', carousel).forEach((dot, i) => {
      dot.addEventListener('click', () => go(i));
    });
  };

  qsa('[data-vh-carousel]').forEach(initCarousel);

  qsa('[data-vh-faq-item]').forEach((item) => {
    const btn = qs('[data-vh-faq-btn]', item);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const open = item.classList.contains('is-open');
      qsa('[data-vh-faq-item]').forEach((other) => other.classList.remove('is-open'));
      if (!open) item.classList.add('is-open');
    });
  });
})();
