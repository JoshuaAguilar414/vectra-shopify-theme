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

    // Only hide for animation after JS is ready — prevents blank/invisible sections
    this.classList.add('hp-reveal-ready');

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          this.animateCounters(entry.target);
          this.observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
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
    this.paused = false;

    this.querySelector('[data-hp-prev]')?.addEventListener('click', () => this.go(-1));
    this.querySelector('[data-hp-next]')?.addEventListener('click', () => this.go(1));
    this.addEventListener('mouseenter', () => this.pause());
    this.addEventListener('mouseleave', () => this.resume());
    this.addEventListener('focusin', () => this.pause());
    this.addEventListener('focusout', () => this.resume());

    this.querySelectorAll('[data-hp-dot]').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        this.index = i;
        this.update();
      });
    });

    this.update();
    this.start();
  }

  start() {
    this.stop();
    if (this.paused || this.autoplayMs <= 0 || this.slides.length < 2) return;
    this.timer = setInterval(() => this.go(1), this.autoplayMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  pause() {
    this.paused = true;
    this.stop();
  }

  resume() {
    this.paused = false;
    this.start();
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
    this.querySelectorAll('[data-hp-dot]').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.index);
    });
    const progress = this.querySelector('[data-hp-progress]');
    if (progress && this.slides.length) {
      progress.style.width = `${((this.index + 1) / this.slides.length) * 100}%`;
    }
    if (this.track) {
      this.track.style.transform = `translateX(-${this.index * 100}%)`;
    }
  }

  disconnectedCallback() {
    this.stop();
  }
}

class HomepageParticles extends HTMLElement {
  connectedCallback() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.className = 'hp-particles__canvas';
    this.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.mode = this.dataset.mode || 'dark';
    this.particles = [];
    this.raf = 0;

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  resize() {
    const rect = this.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(36, Math.floor((this.width * this.height) / 18000));
    this.particles = Array.from({ length: count }, () => this.makeParticle());
  }

  makeParticle() {
    const green = this.mode === 'light';
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      r: green ? 1 + Math.random() * 2.2 : 0.8 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      a: green ? 0.15 + Math.random() * 0.45 : 0.2 + Math.random() * 0.55,
    };
  }

  tick() {
    const { ctx, width, height, particles, mode } = this;
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = mode === 'light'
        ? `rgba(84, 189, 1, ${p.a})`
        : `rgba(180, 220, 255, ${p.a})`;
      ctx.fill();
    }

    this.raf = requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.resize);
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

class HomepageSquares extends HTMLElement {
  connectedCallback() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.className = 'hp-particles__canvas';
    this.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.shapes = [];
    this.raf = 0;

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  resize() {
    const rect = this.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(18, Math.floor((this.width * this.height) / 42000));
    this.shapes = Array.from({ length: count }, () => this.makeShape());
  }

  makeShape() {
    const grid = Math.random() > 0.55;
    const size = grid ? 36 + Math.random() * 70 : 22 + Math.random() * 90;
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size,
      grid,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.0024,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      green: Math.random() > 0.45,
      a: 0.12 + Math.random() * 0.22,
    };
  }

  drawSquare(ctx, x, y, size, grid) {
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    if (!grid) return;
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x, y + size / 2);
    ctx.moveTo(x - size / 2, y);
    ctx.lineTo(x + size / 2, y);
    ctx.stroke();
  }

  tick() {
    const { ctx, width, height, shapes } = this;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1.2;

    for (const s of shapes) {
      s.x += s.vx;
      s.y += s.vy;
      s.rot += s.vr;
      if (s.x < -80) s.x = width + 80;
      if (s.x > width + 80) s.x = -80;
      if (s.y < -80) s.y = height + 80;
      if (s.y > height + 80) s.y = -80;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.strokeStyle = s.green
        ? `rgba(84, 189, 1, ${s.a})`
        : `rgba(90, 130, 160, ${s.a})`;
      this.drawSquare(ctx, 0, 0, s.size, s.grid);
      ctx.restore();
    }

    this.raf = requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.resize);
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

class HomepageSolutions extends HTMLElement {
  connectedCallback() {
    this.panels = Array.from(this.querySelectorAll('[data-hp-sol-panel]'));
    this.thumbs = Array.from(this.querySelectorAll('[data-hp-sol-thumb]'));
    this.index = 0;
    this.thumbs.forEach((thumb, i) => {
      thumb.addEventListener('click', () => this.activate(i));
    });
    this.activate(0);
  }

  activate(index) {
    this.index = index;
    this.panels.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
    this.thumbs.forEach((thumb, i) => thumb.classList.toggle('is-active', i === index));
  }
}

if (!customElements.get('homepage-carousel')) customElements.define('homepage-carousel', HomepageCarousel);
if (!customElements.get('homepage-filters')) customElements.define('homepage-filters', HomepageFilters);
if (!customElements.get('homepage-tabs')) customElements.define('homepage-tabs', HomepageTabs);
if (!customElements.get('homepage-reveal')) customElements.define('homepage-reveal', HomepageReveal);
if (!customElements.get('homepage-slider')) customElements.define('homepage-slider', HomepageSlider);
if (!customElements.get('homepage-particles')) customElements.define('homepage-particles', HomepageParticles);
if (!customElements.get('homepage-squares')) customElements.define('homepage-squares', HomepageSquares);
if (!customElements.get('homepage-solutions')) customElements.define('homepage-solutions', HomepageSolutions);
