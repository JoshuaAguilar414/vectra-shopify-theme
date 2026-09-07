(() => {
  if (window.__vectraResourcesInit) return;
  window.__vectraResourcesInit = true;

  const root = document.querySelector('.vectra-res') || document;
  const search = root.querySelector('[data-vres-search]');
  const items = [...root.querySelectorAll('[data-vres-item]')];
  const tags = [...root.querySelectorAll('[data-vres-tag]')];
  let activeTag = '';

  const applyFilter = () => {
    const query = (search?.value || '').trim().toLowerCase();
    items.forEach((item) => {
      const hay = `${item.textContent || ''} ${item.dataset.vresTags || ''}`.toLowerCase();
      const matchesQuery = !query || hay.includes(query);
      const matchesTag = !activeTag || (item.dataset.vresTags || '').includes(activeTag);
      item.hidden = !(matchesQuery && matchesTag);
    });
  };

  search?.addEventListener('input', applyFilter);

  tags.forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-vres-tag') || '';
      activeTag = activeTag === value ? '' : value;
      tags.forEach((other) => {
        other.classList.toggle('is-active', other === btn && Boolean(activeTag));
      });
      applyFilter();
    });
  });
})();
