(() => {
  // Keep FAQ clicks working on About even if home.js init order changes
  if (!window.__vectraFaqBound) {
    window.__vectraFaqBound = true;
    const setFaqOpen = (item, open) => {
      item.classList.toggle('is-open', open);
      const btn = item.querySelector('[data-vh-faq-btn]');
      const body = item.querySelector('.vh-acc__body');
      if (btn) btn.setAttribute('aria-expanded', String(open));
      if (body) {
        if (open) body.removeAttribute('hidden');
        else body.setAttribute('hidden', '');
      }
    };
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-vh-faq-btn]');
      if (!btn) return;
      const item = btn.closest('[data-vh-faq-item]');
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      const group = item.closest('[data-vh-faq-accordion], .vh-accordion') || item.parentElement || document;
      const wasOpen = item.classList.contains('is-open');
      group.querySelectorAll('[data-vh-faq-item]').forEach((other) => setFaqOpen(other, false));
      if (!wasOpen) setFaqOpen(item, true);
    });
  }

  if (window.__vectraStoryInit) return;
  window.__vectraStoryInit = true;

  const root = document.querySelector('[data-vectra-story]');
  if (!root) return;

  const qs = (sel, el = root) => el.querySelector(sel);
  const qsa = (sel, el = root) => [...el.querySelectorAll(sel)];

  qsa('[data-vh-video], video:not([data-vs-map-video])').forEach((video) => {
    video.muted = true;
    video.playsInline = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }
    video.play().catch(() => {});
  });

  const shuffle = (items) => {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const escapeHtml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  qsa('[data-vs-associates-listing]').forEach((grid) => {
    const cards = qsa('.vs-expert', grid);
    if (cards.length < 2) return;
    cards
      .sort((a, b) => {
        const nameA = (a.dataset.name || a.querySelector('h3')?.textContent || '').trim();
        const nameB = (b.dataset.name || b.querySelector('h3')?.textContent || '').trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      })
      .forEach((card) => grid.appendChild(card));
  });

  qsa('[data-vs-featured-associates]').forEach((section) => {
    const grid = qs('[data-vs-featured-grid]', section);
    const poolEl = qs('[data-vs-associate-pool]', section);
    if (!grid || !poolEl) return;
    let pool = [];
    try {
      pool = JSON.parse(poolEl.textContent || '[]');
    } catch (_err) {
      pool = [];
    }
    if (!Array.isArray(pool) || !pool.length) return;
    const count = Math.min(Number(section.dataset.featuredCount) || 5, pool.length);
    const featured = shuffle(pool).slice(0, count);
    const associatesHref = qs('.vs-experts__more .vs-cta-btn', section)?.getAttribute('href') || '/pages/associates';
    grid.innerHTML = featured
      .map((person) => {
        const name = escapeHtml(person.name);
        const role = escapeHtml(person.role);
        const img = escapeHtml(person.img);
        const slug = escapeHtml(person.slug || '');
        const href = slug ? `${associatesHref}#${slug}` : associatesHref;
        return `<article class="vs-expert" data-vs-associate>
          <a class="vs-expert__photo-link" href="${href}">
            <img src="${img}" alt="${name}, ${role}, VECTRA International Associate." width="480" height="480" loading="lazy">
          </a>
          <h3><a href="${href}">${name}</a></h3>
          <p class="vs-expert__role">${role}</p>
        </article>`;
      })
      .join('');
  });

  const renderMapPins = (list, pinUrl, locations) => {
    if (!list || !Array.isArray(locations)) return;
    list.innerHTML = locations
      .map((loc) => {
        const label = escapeHtml(loc.label);
        const x = Number(loc.x);
        const y = Number(loc.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
        return `<li class="vs-people__pin" style="left:${x}%;top:${y}%;" title="${label}">
          <img src="${escapeHtml(pinUrl)}" alt="" width="18" height="18" decoding="async">
          <span>${label}</span>
        </li>`;
      })
      .join('');
  };

  qsa('[data-vs-map]').forEach((map) => {
    const video = qs('[data-vs-map-video]', map);
    const pins = qs('[data-vs-map-pins]', map);
    const src = map.dataset.mapSrc;
    const pinUrl = map.dataset.mapPin || '';
    const locationsUrl = map.dataset.mapLocations || '';
    let loaded = false;

    const loadLocations = () => {
      if (!locationsUrl || !pins) return;
      fetch(locationsUrl)
        .then((res) => (res.ok ? res.json() : []))
        .then((locations) => renderMapPins(pins, pinUrl, locations))
        .catch(() => {});
    };

    const activateVideo = () => {
      if (loaded || !video || !src) return;
      loaded = true;
      video.hidden = false;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      if (!video.querySelector('source')) {
        const source = document.createElement('source');
        source.src = src;
        source.type = 'video/mp4';
        video.appendChild(source);
      }
      video.load();
      video.addEventListener(
        'loadeddata',
        () => {
          video.dataset.vsMapReady = 'true';
          map.classList.add('is-video-ready');
        },
        { once: true }
      );
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        video.play().catch(() => {});
      }
    };

    loadLocations();

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            activateVideo();
            io.disconnect();
          });
        },
        { rootMargin: '200px 0px', threshold: 0.01 }
      );
      io.observe(map);
    } else {
      activateVideo();
    }
  });

  const track = qs('[data-vs-leaders-track]');
  const cards = qsa('[data-vs-leader]', track || root);
  if (track && cards.length) {
    let index = 0;
    const count = cards.length;
    const go = (next) => {
      index = ((next % count) + count) % count;
      const card = cards[index];
      const shift = card.offsetLeft - (track.parentElement.clientWidth - card.offsetWidth) / 2;
      track.style.transform = `translateX(${-Math.max(0, shift)}px)`;
    };
    qs('[data-vs-prev]')?.addEventListener('click', () => {
      go(index - 1);
      startLeaders();
    });
    qs('[data-vs-next]')?.addEventListener('click', () => {
      go(index + 1);
      startLeaders();
    });
    window.addEventListener('resize', () => go(index));
    go(0);

    let leaderTimer = 0;
    const startLeaders = () => {
      window.clearInterval(leaderTimer);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || count < 2) return;
      leaderTimer = window.setInterval(() => go(index + 1), 7000);
    };
    startLeaders();
  }

  const runReveal = (el) => el.classList.add('is-in');
  qsa('[data-vs-reveal-group]').forEach((group) => {
    const items = qsa('[data-vh-reveal]', group);
    if (!items.length) return;
    const revealGroup = () => items.forEach(runReveal);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealGroup();
          io.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      io.observe(group);
    } else {
      revealGroup();
    }
  });

  const cellCanvas = qs('[data-vs-cell-grid]');
  if (cellCanvas) {
    const ctx = cellCanvas.getContext('2d');
    if (ctx) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let cells = [];
      let offset = 0;
      let raf = 0;
      let running = false;

      const seededRandom = (seed) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };

      const generateCells = (width, height) => {
        const next = [];
        for (let i = 0; i < 150; i += 1) {
          next.push({
            x: seededRandom(i * 123.456) * width,
            y: seededRandom(i * 789.012) * height,
            size: 20 + seededRandom(i * 345.678) * 60,
            colorMix: seededRandom(i * 567.89),
            opacityBase: 0.08 + seededRandom(i * 901.234) * 0.16,
            speedFactor: 0.3 + seededRandom(i * 111.222) * 0.7,
          });
        }
        return next;
      };

      const resize = () => {
        const rect = cellCanvas.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cellCanvas.width = Math.round(rect.width * dpr);
        cellCanvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cells = generateCells(rect.width, rect.height);
      };

      const draw = () => {
        const rect = cellCanvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        ctx.clearRect(0, 0, width, height);

        cells.forEach((cell, index) => {
          const animatedY = (cell.y + offset * cell.speedFactor) % (height + cell.size);
          const animatedX = cell.x + Math.sin(offset * 0.01 + index) * 10;
          const edgeFadeX = Math.min(animatedX / 120, (width - animatedX) / 120, 1);
          const edgeFadeY = Math.min(animatedY / 120, (height - animatedY) / 120, 1);
          const edgeFade = Math.min(edgeFadeX, edgeFadeY);
          const pulse = 0.7 + Math.sin(offset * 0.02 + index * 0.5) * 0.3;
          const opacity = cell.opacityBase * Math.max(0, edgeFade) * pulse;
          if (opacity <= 0.05) return;

          const r = Math.round(34 * cell.colorMix + 30 * (1 - cell.colorMix));
          const g = Math.round(197 * cell.colorMix + 58 * (1 - cell.colorMix));
          const b = Math.round(94 * cell.colorMix + 138 * (1 - cell.colorMix));

          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(animatedX, animatedY, cell.size, cell.size);

          if (seededRandom(index * 333.444) <= 0.6) return;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(animatedX + cell.size / 2, animatedY);
          ctx.lineTo(animatedX + cell.size / 2, animatedY + cell.size);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(animatedX, animatedY + cell.size / 2);
          ctx.lineTo(animatedX + cell.size, animatedY + cell.size / 2);
          ctx.stroke();
        });
      };

      const loop = () => {
        if (!running) return;
        draw();
        offset += 1;
        raf = requestAnimationFrame(loop);
      };

      const start = () => {
        if (running || reduceMotion) return;
        running = true;
        raf = requestAnimationFrame(loop);
      };

      const stop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      resize();
      draw();

      if (!reduceMotion && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              resize();
              start();
            } else {
              stop();
            }
          });
        }, { threshold: 0.05 });
        io.observe(cellCanvas);
      } else if (!reduceMotion) {
        start();
      }

      if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(cellCanvas);
      } else {
        window.addEventListener('resize', resize);
      }
    }
  }

  qsa('[data-vs-join-grid]').forEach((gridCanvas) => {
    if (gridCanvas.dataset.vhGlowBound === 'true') return;
    const ctx = gridCanvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    gridCanvas.dataset.vhGlowBound = 'true';

    const animationSpeed = 2;
    const gridSize = 50;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let offset = 0;
    let raf = 0;
    let running = false;

    const resize = () => {
      const rect = gridCanvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      gridCanvas.width = Math.round(width * dpr);
      gridCanvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.fillStyle = '#092543';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#54bd01';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#54bd01';

      let index = 0;
      for (let x = offset % gridSize; x < width + gridSize; x += gridSize) {
        const opacity =
          0.15 +
          Math.sin(index * 0.5 + offset * 0.02) * 0.2 +
          Math.cos(index * 0.3) * 0.15;
        ctx.globalAlpha = Math.max(0.05, Math.min(0.5, opacity));
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        index += 1;
      }

      index = 0;
      for (let y = offset % gridSize; y < height + gridSize; y += gridSize) {
        const opacity =
          0.15 +
          Math.sin(index * 0.7 + offset * 0.02) * 0.2 +
          Math.cos(index * 0.4) * 0.15;
        ctx.globalAlpha = Math.max(0.05, Math.min(0.5, opacity));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        index += 1;
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (!running) return;
      draw();
      offset += animationSpeed * 0.5;
      if (offset > gridSize) offset = 0;
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    draw();

    if (!reduceMotion && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            resize();
            start();
          } else {
            stop();
          }
        });
      }, { threshold: 0.05 });
      io.observe(gridCanvas);
    } else if (!reduceMotion) {
      start();
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(resize).observe(gridCanvas);
    } else {
      window.addEventListener('resize', resize);
    }
  });
})();
