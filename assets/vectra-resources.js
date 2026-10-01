(() => {
  if (window.__vectraResourcesInit) return;
  window.__vectraResourcesInit = true;

  const root = document.querySelector('.vectra-res') || document;
  const search = root.querySelector('[data-vres-search]');
  const items = [...root.querySelectorAll('[data-vres-item]')];
  const empty = root.querySelector('[data-vres-empty]');
  const clear = root.querySelector('[data-vres-clear]');

  // Each group is a row of toggle buttons; clicking an active button clears it.
  const groups = [
    { name: 'tag', buttonAttr: 'data-vres-tag', itemKey: 'vresTags', active: '', loose: true },
    { name: 'topic', buttonAttr: 'data-vres-topic', itemKey: 'vresTopics', active: '' },
    { name: 'type', buttonAttr: 'data-vres-type', itemKey: 'vresTypes', active: '' },
    { name: 'year', buttonAttr: 'data-vres-year', itemKey: 'vresYear', active: '' },
  ];

  groups.forEach((group) => {
    group.buttons = [...root.querySelectorAll(`button[${group.buttonAttr}], a[${group.buttonAttr}]`)];
  });

  const matchesGroup = (item, group) => {
    if (!group.active) return true;
    const wanted = group.active.toLowerCase().trim();
    const haystack = (item.dataset[group.itemKey] || '').toLowerCase();
    if (group.loose) return haystack.includes(wanted);
    // Space-separated handleized tokens (e.g. "operational-resilience esg-compliance")
    return haystack.split(/\s+/).filter(Boolean).includes(wanted);
  };

  const applyFilter = () => {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;

    items.forEach((item) => {
      const hay = `${item.textContent || ''} ${item.dataset.vresTags || ''}`.toLowerCase();
      const matchesQuery = !query || hay.includes(query);
      const matchesAll = groups.every((group) => matchesGroup(item, group));
      const show = matchesQuery && matchesAll;
      item.hidden = !show;
      if (show) visible += 1;
    });

    if (empty) empty.hidden = visible > 0 || items.length === 0;
    if (clear) {
      const hasFilter = Boolean(query) || groups.some((group) => group.active);
      clear.hidden = !hasFilter;
    }
  };

  search?.addEventListener('input', applyFilter);

  groups.forEach((group) => {
    group.buttons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        if (btn.tagName === 'A') event.preventDefault();
        const value = btn.getAttribute(group.buttonAttr) || '';
        group.active = group.active === value ? '' : value;
        group.buttons.forEach((other) => {
          const on = Boolean(group.active) && other.getAttribute(group.buttonAttr) === group.active;
          other.classList.toggle('is-active', on);
          other.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyFilter();
      });
    });
  });

  clear?.addEventListener('click', () => {
    if (search) search.value = '';
    groups.forEach((group) => {
      group.active = '';
      group.buttons.forEach((other) => {
        other.classList.remove('is-active');
        other.setAttribute('aria-pressed', 'false');
      });
    });
    applyFilter();
  });

  if (clear) clear.hidden = true;
})();
