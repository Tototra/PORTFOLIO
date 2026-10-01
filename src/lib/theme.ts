import { load, save } from './store';

type Theme = 'light' | 'dark';
const listeners = new Set<() => void>();
const cache = new Map<string, string>();

export function currentTheme(): Theme {
  const forced = document.documentElement.dataset.theme as Theme | undefined;
  if (forced) return forced;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function initTheme() {
  const saved = load<Theme | null>('theme', null);
  if (saved) document.documentElement.dataset.theme = saved;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', notify);
}

export function toggleTheme() {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  save('theme', next);
  notify();
}

function notify() {
  cache.clear();
  listeners.forEach((fn) => fn());
}

/** Les canvas lisent leurs couleurs dans les variables CSS, pour suivre le thème. */
export function color(name: string): string {
  let v = cache.get(name);
  if (!v) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
    cache.set(name, v);
  }
  return v;
}

export function onThemeChange(fn: () => void) {
  listeners.add(fn);
}
