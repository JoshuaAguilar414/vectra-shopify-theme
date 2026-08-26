class HomepageCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-hp-track]');
    this.querySelector('[data-hp-prev]')?.addEventListener('click', () => this.scrollBy(-1));
    this.querySelector('[data-hp-next]')?.addEventListener('click', () => this.scrollBy(1));
  }

  scrollBy(direction) {
    if (!this.track) return;
    const amount = Math.max(this.track.clientWidth * 0.7, 280) * direction;
    this.track.scrollBy({ left: amount, behavior: 'smooth' });
  }
}

class HomepageFilters extends HTMLElement {
  connectedCallback() {
    this.cards = Array.from(this.querySelectorAll('[data-hp-card]'));
    this.search = this.querySelector('[data-hp-search]');
    this.selects = Array.from(this.querySelectorAll('[data-hp-filter]'));
    this.search?.addEventListener('input', () => this.apply());
    this.selects.forEach((select) => select.addEventListener('change', () => this.apply()));
  }

  apply() {
    const query = (this.search?.value || '').trim().toLowerCase();
    const filters = this.selects.reduce((acc, select) => {
      if (select.value) acc[select.dataset.hpFilter] = select.value.toLowerCase();
      return acc;
    }, {});

    this.cards.forEach((card) => {
      const haystack = (card.dataset.search || card.textContent || '').toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesFilters = Object.entries(filters).every(([key, value]) => {
        return (card.dataset[key] || '').toLowerCase() === value;
      });
      card.hidden = !(matchesQuery && matchesFilters);
    });
  }
}

class HomepageTabs extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('[data-hp-tab]'));
    this.items = Array.from(this.querySelectorAll('[data-hp-tab-item]'));
    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => this.activate(tab.dataset.hpTab));
    });
    const initial = this.tabs.find((tab) => tab.classList.contains('is-active')) || this.tabs[0];
    if (initial) this.activate(initial.dataset.hpTab);
  }

  activate(id) {
    this.tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.hpTab === id));
    this.items.forEach((item) => {
      item.hidden = id !== 'all' && item.dataset.hpTabItem !== id;
    });
  }
}

if (!customElements.get('homepage-carousel')) customElements.define('homepage-carousel', HomepageCarousel);
if (!customElements.get('homepage-filters')) customElements.define('homepage-filters', HomepageFilters);
if (!customElements.get('homepage-tabs')) customElements.define('homepage-tabs', HomepageTabs);
