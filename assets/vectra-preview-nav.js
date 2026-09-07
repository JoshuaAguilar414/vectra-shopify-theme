(() => {
  if (window.__vectraPreviewNav) return;
  window.__vectraPreviewNav = true;

  const params = new URLSearchParams(window.location.search);
  if (!params.get('preview_theme_id') && !params.get('key')) return;

  const keep = ['_ab', '_fd', '_sc', 'key', 'preview_theme_id'];
  const viewByPath = {
    '/pages/our-story': 'our-story',
    '/pages/solutions': 'solutions',
    '/pages/resources': 'resources',
  };
  const viewByTitle = {
    'our story': '/pages/our-story',
    'our dna': '/pages/our-story',
    'about vectra': '/pages/our-story',
    solutions: '/pages/solutions',
    'how we help': '/pages/solutions',
    resources: '/pages/resources',
  };

  const withPreview = (raw) => {
    let url;
    try {
      url = new URL(raw, window.location.origin);
    } catch {
      return raw;
    }
    if (url.origin !== window.location.origin) return raw;

    keep.forEach((name) => {
      const value = params.get(name);
      if (value) url.searchParams.set(name, value);
    });

    const path = url.pathname.replace(/\/$/, '') || '/';
    const view = viewByPath[path];
    if (view) url.searchParams.set('view', view);

    return `${url.pathname}${url.search}${url.hash}`;
  };

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let next = href;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const path = url.pathname.replace(/\/$/, '') || '/';
        const title = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const mapped = viewByTitle[title];
        if (mapped && (path === '/' || path === '')) {
          url.pathname = mapped;
          next = `${url.pathname}${url.search}${url.hash}`;
        }
      } catch {
        return;
      }

      link.setAttribute('href', withPreview(next));
    },
    true
  );
})();
