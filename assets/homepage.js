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

class HomepageReveal extends HTMLElement {
  connectedCallback() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.classList.add('is-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          this.animateCounters(entry.target);
          this.observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );

    this.observer.observe(this);
  }

  animateCounters(root) {
    root.querySelectorAll('[data-hp-count]').forEach((el) => {
      const raw = el.dataset.hpCount || el.textContent || '';
      const match = raw.match(/([\d.]+)/);
      if (!match) return;
      const target = parseFloat(match[1]);
      const suffix = raw.replace(match[1], '');
      const start = performance.now();
      const duration = 1100;

      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.round(target * eased);
        el.textContent = `${value}${suffix}`;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }
}

class HomepageSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-hp-slider-track]');
    this.slides = Array.from(this.querySelectorAll('[data-hp-slide]'));
    this.index = 0;
    this.autoplayMs = Number(this.dataset.autoplay || 0);

    this.querySelector('[data-hp-prev]')?.addEventListener('click', () => this.go(-1));
    this.querySelector('[data-hp-next]')?.addEventListener('click', () => this.go(1));

    this.update();
    if (this.autoplayMs > 0 && this.slides.length > 1) {
      this.timer = setInterval(() => this.go(1), this.autoplayMs);
    }
  }

  go(step) {
    if (!this.slides.length) return;
    this.index = (this.index + step + this.slides.length) % this.slides.length;
    this.update();
  }

  update() {
    this.slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === this.index);
      slide.setAttribute('aria-hidden', i === this.index ? 'false' : 'true');
    });
    if (this.track) {
      this.track.style.transform = `translateX(-${this.index * 100}%)`;
    }
  }

  disconnectedCallback() {
    if (this.timer) clearInterval(this.timer);
  }
}

if (!customElements.get('homepage-carousel')) customElements.define('homepage-carousel', HomepageCarousel);
if (!customElements.get('homepage-filters')) customElements.define('homepage-filters', HomepageFilters);
if (!customElements.get('homepage-tabs')) customElements.define('homepage-tabs', HomepageTabs);
if (!customElements.get('homepage-reveal')) customElements.define('homepage-reveal', HomepageReveal);
if (!customElements.get('homepage-slider')) customElements.define('homepage-slider', HomepageSlider);
