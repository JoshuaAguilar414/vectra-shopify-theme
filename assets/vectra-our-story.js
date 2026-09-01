(() => {
  if (window.__vectraStoryInit) return;
  window.__vectraStoryInit = true;

  const root = document.querySelector('[data-vectra-story]');
  if (!root) return;

  const qs = (sel, el = root) => el.querySelector(sel);
  const qsa = (sel, el = root) => [...el.querySelectorAll(sel)];

  qsa('video').forEach((video) => {
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
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
      leaderTimer = window.setInterval(() => go(index + 1), 5000);
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
            opacityBase: 0.2 + seededRandom(i * 901.234) * 0.4,
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

  const gridCanvas = qs('[data-vs-join-grid]');
  if (gridCanvas) {
    const ctx = gridCanvas.getContext('2d', { alpha: false });
    if (ctx) {
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
    }
  }
})();
