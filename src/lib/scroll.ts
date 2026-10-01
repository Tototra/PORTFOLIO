import { reducedMotion } from './motion';

// Les démos se chargent pendant qu'on défile vers une section : elles agrandissent
// la page et la cible se déplace. On corrige donc la position à l'arrivée, tant que
// l'utilisateur ne reprend pas la main.

let cancel: (() => void) | null = null;

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  cancel?.();
  const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });

  const timers: number[] = [];
  const stop = () => {
    timers.forEach(clearTimeout);
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.removeEventListener(t, stop));
    cancel = null;
  };
  // enregistré au tour suivant : l'événement qui a lancé le défilement ne doit pas l'annuler
  timers.push(window.setTimeout(() => ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.addEventListener(t, stop, { passive: true }))));
  cancel = stop;

  const settle = () => {
    if (Math.abs(el.getBoundingClientRect().top - offset) > 6) el.scrollIntoView({ behavior: 'auto' });
  };
  for (const ms of [900, 1400, 2200]) timers.push(window.setTimeout(settle, ms));
  timers.push(window.setTimeout(stop, 2300));
}

/** Tous les liens internes (#section) passent par scrollToId. */
export function smartAnchors() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    history.pushState(null, '', `#${id}`);
    scrollToId(id);
  });
}
