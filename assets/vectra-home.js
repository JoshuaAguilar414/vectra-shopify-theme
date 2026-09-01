(() => {
  if (window.__vectraHomeInit) return;
  window.__vectraHomeInit = true;

  const root = document.querySelector('[data-vectra-home]') || document;

  const qs = (sel, el = root) => el.querySelector(sel);
  const qsa = (sel, el = root) => [...el.querySelectorAll(sel)];

  const navToggle = qs('[data-vh-nav-toggle]');
  const navPanel = qs('[data-vh-nav-panel]');
  if (navToggle && navPanel) {
    navToggle.addEventListener('click', () => {
      const open = navPanel.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('vh-nav-open', open);
    });
    qsa('a, [data-vh-contact-open]', navPanel).forEach((link) => {
      link.addEventListener('click', () => {
        navPanel.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('vh-nav-open');
      });
    });
    qsa('[data-vh-mobile-sub]', navPanel).forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.vh-nav-panel__item');
        if (!item) return;
        const open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }

  const megaItems = qsa('[data-vh-mega-item]');
  const alignMega = (item) => {
    const trigger = item.querySelector('.vh-menu__anchor > a') || item.querySelector('a');
    const mega = item.querySelector('.vh-mega');
    if (!trigger || !mega) return;
    mega.style.left = '0px';
    mega.style.right = 'auto';
    mega.style.transform = 'none';
    const triggerBox = trigger.getBoundingClientRect();
    const megaBox = mega.getBoundingClientRect();
    const shift = triggerBox.left + triggerBox.width / 2 - (megaBox.left + megaBox.width / 2);
    mega.style.left = `${shift}px`;
  };
  megaItems.forEach((item) => {
    const trigger = item.querySelector('.vh-menu__anchor > a') || item.querySelector('a');
    const close = () => {
      item.classList.remove('is-open');
      trigger?.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      megaItems.forEach((other) => {
        if (other !== item) {
          other.classList.remove('is-open');
          const otherTrigger = other.querySelector('.vh-menu__anchor > a') || other.querySelector('a');
          otherTrigger?.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.add('is-open');
      trigger?.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => alignMega(item));
    };
    item.addEventListener('mouseenter', open);
    item.addEventListener('mouseleave', close);
    item.addEventListener('focusin', open);
    trigger?.addEventListener('click', (event) => {
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      event.preventDefault();
      const isOpen = item.classList.contains('is-open');
      if (isOpen) close();
      else open();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    megaItems.forEach((item) => {
      item.classList.remove('is-open');
      const trigger = item.querySelector('.vh-menu__anchor > a') || item.querySelector('a');
      trigger?.setAttribute('aria-expanded', 'false');
    });
  });

  document.querySelectorAll('[data-vh-account]').forEach((account) => {
    const toggle = account.querySelector('[data-vh-account-toggle]');
    const menu = account.querySelector('[data-vh-account-menu]');
    if (!toggle || !menu) return;
    const close = () => {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!account.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  });

  document.querySelectorAll('.vh-locale__native').forEach((locale) => {
    const button = locale.querySelector('.vh-locale__summary');
    const panel = locale.querySelector('.vh-locale__panel');
    if (!button || !panel) return;

    button.addEventListener('click', (event) => {
      if (customElements.get('dropdown-localization-component')) return;
      event.preventDefault();
      const willOpen = panel.hasAttribute('hidden');
      panel.toggleAttribute('hidden', !willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
    });

    panel.addEventListener('click', (event) => {
      if (customElements.get('localization-form-component')) return;
      const item = event.target.closest('.localization-form__list-item[data-value]');
      if (!item) return;
      const form = item.closest('form');
      const input = form && form.querySelector('input[name="country_code"]');
      if (!form || !input) return;
      input.value = item.getAttribute('data-value');
      form.submit();
    });
  });

  const initCarousel = (carousel) => {
    const slides = qsa('[data-vh-slide]', carousel);
    if (slides.length < 2) return;
    let index = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    const go = (next) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
      qsa('[data-vh-dot]', carousel).forEach((dot, i) => {
        dot.classList.toggle('is-active', i === index);
      });
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const start = () => {
      if (reduceMotion) return;
      stop();
      timer = window.setInterval(() => go(index + 1), 5000);
    };
    qs('[data-vh-prev]', carousel)?.addEventListener('click', () => {
      go(index - 1);
      start();
    });
    qs('[data-vh-next]', carousel)?.addEventListener('click', () => {
      go(index + 1);
      start();
    });
    qsa('[data-vh-dot]', carousel).forEach((dot, i) => {
      dot.addEventListener('click', () => {
        go(i);
        start();
      });
    });
    start();
  };

  qsa('[data-vh-carousel]').forEach(initCarousel);

  const solutions = qs('[data-vh-solutions]');
  if (solutions) {
    const gallery = qs('.vh-solutions__gallery', solutions);
    const title = qs('[data-vh-sol-title]', solutions);
    const text = qs('[data-vh-sol-text]', solutions);
    const cta = qs('[data-vh-sol-cta]', solutions);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setCopy = (item) => {
      const fade = (el, value) => {
        if (!el || !value) return;
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.textContent = value;
        requestAnimationFrame(() => {
          el.style.transition = reduceMotion
            ? 'none'
            : 'opacity 0.35s ease, transform 0.35s ease';
          el.style.opacity = '1';
          el.style.transform = 'none';
        });
      };
      fade(title, item.dataset.title);
      fade(text, item.dataset.text);
      fade(cta, item.dataset.cta);
    };

    const activate = (item) => {
      const shots = qsa('[data-vh-sol-item]', gallery || solutions);
      if (!item || shots[0] === item) return;

      const firstRects = shots.map((el) => el.getBoundingClientRect());
      if (gallery) {
        while (gallery.firstElementChild && gallery.firstElementChild !== item) {
          gallery.appendChild(gallery.firstElementChild);
        }
      }
      const nextShots = qsa('[data-vh-sol-item]', gallery || solutions);
      nextShots.forEach((el) => {
        const on = el === item;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-pressed', String(on));
      });

      if (!reduceMotion && gallery) {
        nextShots.forEach((el) => {
          const prev = firstRects[shots.indexOf(el)];
          if (!prev) return;
          const now = el.getBoundingClientRect();
          const dx = prev.left - now.left;
          const dy = prev.top - now.top;
          const sx = prev.width / Math.max(now.width, 1);
          const sy = prev.height / Math.max(now.height, 1);
          el.style.zIndex = el === item ? '2' : '1';
          el.style.transition = 'none';
          el.style.transformOrigin = 'top left';
          el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
        });
        gallery.getBoundingClientRect();
        nextShots.forEach((el) => {
          el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'none';
        });
        const clear = (event) => {
          if (event.propertyName !== 'transform') return;
          const el = event.currentTarget;
          el.style.transition = '';
          el.style.transform = '';
          el.style.transformOrigin = '';
          el.style.zIndex = '';
          el.removeEventListener('transitionend', clear);
        };
        nextShots.forEach((el) => el.addEventListener('transitionend', clear));
      }

      setCopy(item);
    };

    const shotsInit = qsa('[data-vh-sol-item]', solutions);
    shotsInit.forEach((item, i) => item.setAttribute('aria-pressed', String(i === 0)));
    solutions.dataset.vhSolReady = String(shotsInit.length);
    solutions.addEventListener('click', (event) => {
      const item = event.target.closest('[data-vh-sol-item]');
      if (!item) return;
      activate(item);
      startSol();
    });

    let solTimer = 0;
    const startSol = () => {
      window.clearInterval(solTimer);
      if (reduceMotion || shotsInit.length < 2) return;
      solTimer = window.setInterval(() => {
        const shots = qsa('[data-vh-sol-item]', gallery || solutions);
        if (shots[1]) activate(shots[1]);
      }, 5000);
    };
    startSol();
  }

  qsa('[data-vh-faq-item]').forEach((item) => {
    const btn = qs('[data-vh-faq-btn]', item);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const open = item.classList.contains('is-open');
      qsa('[data-vh-faq-item]').forEach((other) => other.classList.remove('is-open'));
      if (!open) item.classList.add('is-open');
    });
  });

  qsa('.vh-case').forEach((card) => {
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => {
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const open = card.classList.contains('is-open');
      qsa('.vh-case').forEach((other) => other.classList.remove('is-open'));
      if (!open) card.classList.add('is-open');
    });
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      card.click();
    });
  });

  qsa('[data-vh-marquee]').forEach((track) => {
    const source = [...track.children];
    if (!source.length) return;
    const parent = track.parentElement;
    let passes = 0;
    while (parent && track.scrollWidth < parent.clientWidth * 2 && passes < 6) {
      source.forEach((node) => {
        const clone = node.cloneNode(true);
        if (clone.alt) clone.alt = '';
        track.appendChild(clone);
      });
      passes += 1;
    }
  });

  const reveals = qsa('[data-vh-reveal]').filter((el) => !el.closest('.vh-esg'));
  const runReveal = (el) => el.classList.add('is-in');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runReveal(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach(runReveal);
  }

  const esgStage = qs('.vh-esg__stage');
  const esgReveals = esgStage ? qsa('[data-vh-reveal]', esgStage) : [];
  if (esgStage && esgReveals.length && 'IntersectionObserver' in window) {
    const esgIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          esgReveals.forEach(runReveal);
          esgIo.unobserve(entry.target);
        });
      },
      { threshold: 0.28, rootMargin: '0px 0px -8% 0px' }
    );
    esgIo.observe(esgStage);
  } else {
    esgReveals.forEach(runReveal);
  }

  const careersGrid = qs('[data-vh-careers-grid]');
  if (careersGrid) {
    const ctx = careersGrid.getContext('2d');
    if (ctx) {
      const seededRandom = (seed) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };

      const generateCells = (width, height) => {
        const cells = [];
        for (let i = 0; i < 150; i += 1) {
          cells.push({
            x: seededRandom(i * 123.456) * width,
            y: seededRandom(i * 789.012) * height,
            size: 20 + seededRandom(i * 345.678) * 60,
            colorMix: seededRandom(i * 567.89),
            opacityBase: 0.2 + seededRandom(i * 901.234) * 0.4,
            speedFactor: 0.3 + seededRandom(i * 111.222) * 0.7,
          });
        }
        return cells;
      };

      let cells = [];
      let offset = 0;
      let raf = 0;
      let running = false;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const resize = () => {
        const rect = careersGrid.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        careersGrid.width = Math.round(rect.width * dpr);
        careersGrid.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cells = generateCells(rect.width, rect.height);
      };

      const draw = (tick) => {
        const rect = careersGrid.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        ctx.clearRect(0, 0, width, height);

        cells.forEach((cell, index) => {
          const animatedY = (cell.y + tick * cell.speedFactor) % (height + cell.size);
          const animatedX = cell.x + Math.sin(tick * 0.01 + index) * 10;
          const edgeFadeX = Math.min(animatedX / 120, (width - animatedX) / 120, 1);
          const edgeFadeY = Math.min(animatedY / 120, (height - animatedY) / 120, 1);
          const edgeFade = Math.min(edgeFadeX, edgeFadeY);
          const pulse = 0.7 + Math.sin(tick * 0.02 + index * 0.5) * 0.3;
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
        draw(offset);
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
      requestAnimationFrame(resize);

      if (reduceMotion) {
        draw(0);
      } else if ('IntersectionObserver' in window) {
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
        io.observe(careersGrid);
      } else {
        start();
      }

      if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(careersGrid);
      } else {
        window.addEventListener('resize', resize);
      }
    }
  }

  const casesGrid = qs('[data-vh-cases-grid]');
  if (casesGrid) {
    const ctx = casesGrid.getContext('2d', { alpha: false });
    if (ctx) {
      const animationSpeed = 2;
      const gridSize = 50;
      let width = 0;
      let height = 0;
      let offset = 0;
      let raf = 0;
      let running = false;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const resize = () => {
        const rect = casesGrid.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        casesGrid.width = Math.round(width * dpr);
        casesGrid.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      const draw = () => {
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
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
      requestAnimationFrame(resize);

      if (reduceMotion) {
        draw();
      } else if ('IntersectionObserver' in window) {
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
        io.observe(casesGrid);
      } else {
        start();
      }

      if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(casesGrid);
      } else {
        window.addEventListener('resize', resize);
      }
    }
  }
})();
