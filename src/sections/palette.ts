import { clear, h, tag } from '../lib/dom';
import { setSound, soundEnabled } from '../lib/audio';
import { toggleTheme } from '../lib/theme';
import { projects } from '../content/projects';
import { email } from '../content/profile';
import { fr } from '../lib/typo';
import { scrollToId } from '../lib/scroll';

// Palette de commandes : touche « / » ou Ctrl+K, comme dans un éditeur.

interface Command {
  label: string;
  hint: string;
  run: () => void;
}

const go = (id: string) => () => {
  history.pushState(null, '', `#${id}`);
  scrollToId(id);
};

function commands(): Command[] {
  return [
    { label: 'Accueil', hint: 'section', run: go('top') },
    { label: 'Parcours', hint: 'section 01', run: go('parcours') },
    { label: 'Projets', hint: 'section 02', run: go('projets') },
    ...projects.map((p) => ({ label: fr(p.title), hint: 'projet', run: go(`projet-${p.id}`) })),
    { label: 'Autres projets', hint: 'projets', run: go('autres') },
    { label: 'Compétences et preuves', hint: 'section 03', run: go('competences') },
    { label: 'Hors code', hint: 'section 04', run: go('hors-code') },
    { label: 'Contact', hint: 'section 05', run: go('contact') },
    { label: soundEnabled() ? 'Couper le son' : 'Activer le son', hint: 'réglage', run: () => setSound(!soundEnabled()) },
    { label: 'Changer de thème', hint: 'réglage', run: toggleTheme },
    { label: 'Copier mon adresse email', hint: 'contact', run: () => void navigator.clipboard?.writeText(email()) },
  ];
}

let dialog: HTMLDialogElement | null = null;

export function openPalette() {
  if (!dialog) dialog = build();
  if (!dialog.open) dialog.showModal();
}

function build() {
  const input = h('input', {
    class: 'palette__input',
    type: 'text',
    placeholder: 'Aller à…',
    'aria-label': 'Rechercher une section ou un projet',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const list = h('ul', { class: 'palette__list', role: 'listbox', 'aria-label': 'Résultats' });
  const d = h(
    'dialog',
    { class: 'palette', 'aria-label': 'Palette de commandes' },
    h('div', { class: 'palette__head' }, tag('Palette'), h('span', { class: 'spacer' }), tag('Échap pour fermer')),
    input,
    list,
  );
  let active = 0;
  let current: Command[] = [];

  const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function render() {
    const q = normalize(input.value.trim());
    current = commands().filter((c) => !q || normalize(`${c.label} ${c.hint}`).includes(q));
    active = Math.min(active, Math.max(0, current.length - 1));
    clear(list);
    current.forEach((c, i) => {
      const li = h(
        'li',
        { role: 'option', 'aria-selected': String(i === active), class: 'palette__item' },
        h('span', null, c.label),
        tag(c.hint),
      );
      li.addEventListener('click', () => run(i));
      li.addEventListener('pointermove', () => {
        if (active !== i) {
          active = i;
          render();
        }
      });
      list.appendChild(li);
    });
    if (!current.length) list.appendChild(h('li', { class: 'palette__empty' }, 'Rien ici. Essayez « projets » ou « contact ».'));
  }

  function run(i: number) {
    const c = current[i];
    if (!c) return;
    d.close();
    c.run();
  }

  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') active = Math.min(current.length - 1, active + 1);
    else if (e.key === 'ArrowUp') active = Math.max(0, active - 1);
    else if (e.key === 'Enter') return run(active);
    else return;
    e.preventDefault();
    render();
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  });
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener('close', () => {
    input.value = '';
    active = 0;
  });
  const origShow = d.showModal.bind(d);
  d.showModal = () => {
    render();
    origShow();
    input.focus();
  };
  document.body.appendChild(d);
  return d;
}

export function paletteShortcut() {
  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    const typing = target.closest('input, textarea, [contenteditable="true"]');
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      openPalette();
    }
  });
}
