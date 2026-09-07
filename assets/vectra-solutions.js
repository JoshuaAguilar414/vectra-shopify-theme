(() => {
  window.vsolToggleCard = (hit) => {
    const card = hit && hit.closest('[data-vsol-card]');
    if (!card) return;
    const scope = card.closest('.vsol-eco__col') || card.parentElement;
    scope.querySelectorAll('[data-vsol-card]').forEach((other) => {
      if (other === card) return;
      other.classList.remove('is-open');
      other.querySelector('.vsol-card__hit')?.setAttribute('aria-expanded', 'false');
    });
    const open = !card.classList.contains('is-open');
    card.classList.toggle('is-open', open);
    hit.setAttribute('aria-expanded', String(open));
  };

  const bindCellGrid = (cellCanvas) => {
    const ctx = cellCanvas.getContext('2d');
    if (!ctx) return;

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
  };

  const bind = () => {
    const root = document.querySelector('[data-vectra-sol]');
    if (!root || root.dataset.vsolBound === 'true') return;
    root.dataset.vsolBound = 'true';
    root.querySelectorAll('[data-vsol-cell-grid]').forEach(bindCellGrid);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
