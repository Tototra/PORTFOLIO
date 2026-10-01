import { h, led, tag } from '../lib/dom';
import { blip, SCALE } from '../lib/audio';
import { fr } from '../lib/typo';
import { skillGroups } from '../content/skills';
import { projects, sideProjects } from '../content/projects';
import { timeline } from '../content/timeline';

// Pas de barres de niveau : chaque compétence s'allume sur les projets
// et expériences où elle a réellement servi.

interface Proof {
  id: string;
  label: string;
  kind: string;
  href: string;
}

function allProofs(): Proof[] {
  const used = new Set(skillGroups.flatMap((g) => g.skills.flatMap((s) => s.proofs)));
  const list: Proof[] = [
    ...projects.map((p) => ({ id: p.id, label: p.title, kind: 'Projet', href: `#projet-${p.id}` })),
    ...timeline
      .filter((t) => t.track !== 'projet' && !t.placeholder)
      .map((t) => ({ id: t.id, label: `${t.title} · ${t.org}`, kind: t.track === 'formation' ? 'Formation' : 'Expérience', href: '#parcours' })),
    ...sideProjects.map((s) => ({ id: s.id, label: s.title, kind: 'Projet court', href: `#autre-${s.id}` })),
  ];
  return list.filter((p) => used.has(p.id));
}

export function skillsSection() {
  const proofs = allProofs();
  const rows = new Map<string, { el: HTMLElement; led: HTMLElement }>();
  const count = h('span', { class: 'sk__count' });
  const current = h('span', { class: 'sk__current' });

  const bench = h(
    'ol',
    { class: 'sk__bench' },
    proofs.map((p) => {
      const l = led('off');
      const el = h('li', { class: 'sk__proof' }, h('a', { href: p.href }, l, h('span', { class: 'sk__proof-label' }, fr(p.label)), tag(p.kind)));
      rows.set(p.id, { el, led: l });
      return el;
    }),
  );

  const buttons: HTMLButtonElement[] = [];
  function select(name: string, ids: string[], btn: HTMLButtonElement, i: number) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    current.textContent = name;
    count.textContent = `${ids.length} projet${ids.length > 1 ? 's' : ''}`;
    rows.forEach((r, id) => {
      const on = ids.includes(id);
      r.el.classList.toggle('is-on', on);
      r.led.className = `led led--${on ? 'on' : 'off'}`;
    });
    blip(SCALE[i % SCALE.length], 0.1, 0.12);
  }

  let k = 0;
  const groups = skillGroups.map((g) =>
    h(
      'div',
      { class: 'sk__group' },
      h('h3', { class: 'sk__group-title' }, tag(g.name)),
      h(
        'div',
        { class: 'sk__skills' },
        g.skills.map((s) => {
          const i = k++;
          const b = h('button', { type: 'button', class: 'sk__skill', 'aria-pressed': 'false' }, s.name, h('span', { class: 'sk__n' }, String(s.proofs.length)));
          b.addEventListener('click', () => select(s.name, s.proofs, b, i));
          b.addEventListener('mouseenter', () => select(s.name, s.proofs, b, i));
          b.addEventListener('focus', () => select(s.name, s.proofs, b, i));
          buttons.push(b);
          return b;
        }),
      ),
    ),
  );

  const section = h(
    'section',
    { id: 'competences', class: 'section', 'aria-labelledby': 'competences-title' },
    h(
      'div',
      { class: 'wrap' },
      h(
        'p',
        { class: 'sec-lead' },
        fr('Survolez une compétence : les projets et expériences où elle a vraiment servi s\'allument. Un clic sur une preuve vous y emmène.'),
      ),
      h(
        'div',
        { class: 'sk' },
        h('div', { class: 'sk__groups' }, groups),
        h(
          'div',
          { class: 'sk__panel' },
          h('div', { class: 'sk__panel-head' }, tag('Banc de preuves'), h('span', { class: 'spacer' }), current, count),
          bench,
        ),
      ),
    ),
  );

  const first = skillGroups[0].skills[0];
  select(first.name, first.proofs, buttons[0], 0);
  return section;
}
