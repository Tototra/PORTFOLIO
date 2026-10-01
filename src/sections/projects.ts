import { externalLink, h, tag } from '../lib/dom';
import { onFirstVisible } from '../lib/motion';
import { fr } from '../lib/typo';
import { DOMAINS, projects, sideProjects } from '../content/projects';
import type { DemoId, Project } from '../content/types';

// Chaque démo est un module séparé, téléchargé seulement quand on s'en approche.
type Demo = { mount(host: HTMLElement): void };
const DEMOS: Record<DemoId, () => Promise<Demo>> = {
  race: () => import('../demos/race'),
  threshold: () => import('../demos/threshold'),
  grammar: () => import('../demos/grammar'),
  graph: () => import('../demos/graph'),
  cqrs: () => import('../demos/cqrs'),
};

const code = (i: number) => `P.${String(i + 1).padStart(2, '0')}`;

function index() {
  return h(
    'ol',
    { class: 'pidx', 'aria-label': 'Index des projets' },
    projects.map((p, i) =>
      h(
        'li',
        null,
        h(
          'a',
          { class: 'pidx__row', href: `#projet-${p.id}` },
          h('span', { class: 'pidx__code' }, code(i)),
          h('span', { class: 'pidx__title' }, fr(p.title)),
          h('span', { class: 'pidx__kicker' }, fr(p.kicker)),
          h('span', { class: 'pidx__metric' }, h('b', null, fr(p.metrics[0].value)), ' ', fr(p.metrics[0].label)),
          h('span', { class: 'pidx__go', 'aria-hidden': 'true' }, '→'),
        ),
      ),
    ),
  );
}

function module(p: Project, i: number) {
  const demoHost = h('div', { class: 'proj__demo-host' }, h('div', { class: 'proj__loading tag' }, 'Chargement de la démo…'));
  onFirstVisible(demoHost, () => {
    DEMOS[p.demo]()
      .then((m) => {
        demoHost.replaceChildren();
        m.mount(demoHost);
      })
      .catch(() => {
        demoHost.replaceChildren(h('p', { class: 'proj__loading tag' }, 'La démo n’a pas pu se charger. Rechargez la page pour réessayer.'));
      });
  });

  const fact = (k: string, v: string) => h('div', { class: 'proj__fact' }, h('dt', null, tag(k)), h('dd', null, fr(v)));

  return h(
    'article',
    { id: `projet-${p.id}`, class: `proj${i % 2 ? ' proj--flip' : ''}`, 'aria-labelledby': `projet-${p.id}-title` },
    h(
      'header',
      { class: 'proj__head' },
      h('span', { class: 'proj__code' }, code(i)),
      h('h3', { id: `projet-${p.id}-title`, class: 'proj__title' }, fr(p.title)),
      h('p', { class: 'proj__kicker serif' }, fr(p.kicker)),
      h('ul', { class: 'proj__domains' }, p.domains.map((d) => h('li', null, tag(DOMAINS[d])))),
    ),
    h(
      'div',
      { class: 'proj__body' },
      h(
        'div',
        { class: 'proj__text' },
        h('dl', { class: 'proj__facts' }, fact('Période', p.period), fact('Équipe', p.team), fact('Mon rôle', p.role)),
        h('p', { class: 'proj__pitch' }, fr(p.pitch)),
        h('ul', { class: 'proj__points' }, p.points.map((pt) => h('li', null, fr(pt)))),
        h(
          'div',
          { class: 'proj__metrics' },
          p.metrics.map((m) => h('div', { class: 'metric' }, h('span', { class: 'metric__value' }, fr(m.value)), h('span', { class: 'metric__label' }, fr(m.label)))),
        ),
        h('blockquote', { class: 'proj__lesson' }, h('p', { class: 'serif' }, fr(p.lesson))),
        h('ul', { class: 'chips' }, p.stack.map((s) => h('li', { class: 'chip' }, s))),
        p.links.length
          ? h('div', { class: 'proj__links' }, p.links.map((l) => externalLink(l.href, [l.label, h('span', { 'aria-hidden': 'true' }, ' ↗')], { class: 'btn btn--sm' })))
          : null,
      ),
      h('div', { class: 'proj__demo' }, demoHost),
    ),
  );
}

function others() {
  return h(
    'div',
    { id: 'autres', class: 'others' },
    h('div', { class: 'others__head' }, h('h3', { class: 'others__title' }, 'Autres projets')),
    h(
      'ul',
      { class: 'others__grid' },
      sideProjects.map((s) =>
        h(
          'li',
          { id: `autre-${s.id}`, class: 'card' },
          h('div', { class: 'card__top' }, tag(s.context), tag(s.domains.map((d) => DOMAINS[d]).join(' · '))),
          h('h4', { class: 'card__title' }, fr(s.title)),
          h('p', { class: 'card__text' }, fr(s.text)),
          h('ul', { class: 'chips' }, s.stack.map((t) => h('li', { class: 'chip' }, t))),
        ),
      ),
    ),
  );
}

export function projectsSection() {
  return h(
    'section',
    { id: 'projets', class: 'section', 'aria-labelledby': 'projets-title' },
    h(
      'div',
      { class: 'wrap' },
      h(
        'header',
        { class: 'sec-head' },
        h('span', { class: 'sec-num' }, '02'),
        h('h2', { id: 'projets-title', class: 'sec-title' }, 'Projets'),
        tag(`${projects.length} démos`, 'sec-meta'),
      ),
      h(
        'p',
        { class: 'sec-lead' },
        h('span', { class: 'serif' }, fr('Des projets à manipuler, pas seulement à lire. ')),
        fr('Chaque démo reprend l\'idée centrale du projet, réécrite en TypeScript pour tourner dans votre navigateur. Les chiffres, eux, viennent des vrais rendus.'),
      ),
      index(),
      projects.map(module),
      others(),
    ),
  );
}
