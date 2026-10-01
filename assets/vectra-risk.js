(() => {
  const root = document.querySelector('.vrisk-hero, .vrisk-screen, .vrisk-faq');
  if (!root) return;

  // Smooth-scroll in-page CTAs
  document.querySelectorAll('a[href^="#pre-assessment"], a[href^="#assessment-form"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      const target = id ? document.querySelector(id) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
