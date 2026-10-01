import { h, led } from '../lib/dom';
import { onSoundChange, setSound, soundEnabled } from '../lib/audio';
import { currentTheme, onThemeChange, toggleTheme } from '../lib/theme';
import { openPalette } from './palette';

export const SECTIONS = [
  { id: 'parcours', num: '01', label: 'Parcours' },
  { id: 'projets', num: '02', label: 'Projets' },
  { id: 'competences', num: '03', label: 'Preuves' },
  { id: 'hors-code', num: '04', label: 'Hors code' },
  { id: 'contact', num: '05', label: 'Contact' },
];

export function nav() {
  const links = SECTIONS.map((s) =>
    h('li', null, h('a', { href: `#${s.id}`, 'data-section': s.id }, h('span', { class: 'nav__num' }, s.num), s.label)),
  );

  // Position de lecture façon séquenceur : mesure.temps selon le défilement
  const pos = h('span', { class: 'nav__pos', 'aria-hidden': 'true' }, '001.1');

  const soundLed = led(soundEnabled() ? 'on' : 'off');
  const soundBtn = h(
    'button',
    { type: 'button', class: 'nav__tool', 'aria-pressed': String(soundEnabled()), title: 'Activer ou couper le son' },
    soundLed,
    h('span', null, 'Son'),
  );
  soundBtn.addEventListener('click', () => setSound(!soundEnabled()));
  onSoundChange((on) => {
    soundBtn.setAttribute('aria-pressed', String(on));
    soundLed.className = `led led--${on ? 'on' : 'off'}`;
  });

  const themeLabel = h('span', null, currentTheme() === 'dark' ? 'Nuit' : 'Jour');
  const themeBtn = h('button', { type: 'button', class: 'nav__tool', title: 'Changer de thème' }, themeLabel);
  themeBtn.addEventListener('click', toggleTheme);
  onThemeChange(() => (themeLabel.textContent = currentTheme() === 'dark' ? 'Nuit' : 'Jour'));

  const paletteBtn = h(
    'button',
    { type: 'button', class: 'nav__tool nav__palette', title: 'Aller directement quelque part (touche /)', onclick: () => openPalette() },
    h('kbd', null, '/'),
    h('span', { class: 'nav__palette-label' }, 'Aller à'),
  );

  const header = h(
    'header',
    { class: 'nav' },
    h(
      'div',
      { class: 'wrap nav__inner' },
      h('a', { class: 'nav__brand', href: '#top', 'aria-label': 'Haut de page' }, h('span', null, 'T.TRAHANT'), h('span', { class: 'nav__brand-sub' }, 'IA · DATA · INFRA')),
      h('nav', { class: 'nav__links', 'aria-label': 'Sections' }, h('ol', null, links)),
      h('div', { class: 'nav__tools' }, pos, soundBtn, themeBtn, paletteBtn),
    ),
  );

  // Section active
  const anchors = new Map(links.map((li) => {
    const a = li.firstElementChild as HTMLAnchorElement;
    return [a.dataset.section!, a];
  }));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        anchors.forEach((a, id) => (id === e.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  requestAnimationFrame(() => SECTIONS.forEach((s) => {
    const el = document.getElementById(s.id);
    if (el) io.observe(el);
  }));

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const beats = Math.round((window.scrollY / Math.max(1, max)) * 64 * 4);
      pos.textContent = `${String(Math.floor(beats / 4) + 1).padStart(3, '0')}.${(beats % 4) + 1}`;
      header.classList.toggle('nav--scrolled', window.scrollY > 8);
    });
  }, { passive: true });

  return header;
}
