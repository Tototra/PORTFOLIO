export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Boucle d'animation qui ne tourne que lorsque l'élément est visible
 * et que l'onglet est actif. Les démos ne consomment rien hors écran.
 */
export function visibleLoop(el: Element, frame: (dt: number, t: number) => void) {
  let raf = 0;
  let last = 0;
  let visible = false;
  let paused = false;

  const tick = (t: number) => {
    const dt = last ? Math.min((t - last) / 1000, 1 / 20) : 1 / 60;
    last = t;
    frame(dt, t / 1000);
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    const shouldRun = visible && !paused && !document.hidden;
    if (shouldRun && !raf) {
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { rootMargin: '80px' }).observe(el);
  document.addEventListener('visibilitychange', sync);

  return {
    pause() { paused = true; sync(); },
    resume() { paused = false; sync(); },
    get running() { return raf !== 0; },
  };
}

/** Lance `init` une seule fois, quand l'élément approche de l'écran. */
export function onFirstVisible(el: Element, init: () => void) {
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      io.disconnect();
      init();
    }
  }, { rootMargin: '300px' });
  io.observe(el);
}

/** Canvas net sur écrans haute densité ; rappelle `onResize` à chaque changement de taille. */
export function fitCanvas(canvas: HTMLCanvasElement, onResize: (w: number, h: number, dpr: number) => void) {
  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    onResize(w, h, dpr);
  });
  ro.observe(canvas);
}
