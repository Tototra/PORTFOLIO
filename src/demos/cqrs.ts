import { clear, h, led, svg, tag } from '../lib/dom';
import { blip } from '../lib/audio';
import { screen, segmented } from '../lib/ui';
import { fr } from '../lib/typo';

// L'architecture d'EpiTweet en mouvement : les commandes vont aux services
// d'écriture, qui publient des événements sur Redis ; les services de lecture
// consomment ces événements et maintiennent des vues prêtes à servir.

type Pt = [number, number];
interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  db?: string;
}

const W_SIDE = [
  { id: 'user', y: 34, title: 'User Profile', db: 'MongoDB' },
  { id: 'post', y: 110, title: 'Post', db: 'MongoDB + GridFS' },
  { id: 'social', y: 186, title: 'Social', db: 'Neo4j' },
  { id: 'like', y: 262, title: 'Like', db: 'Neo4j' },
];
const R_SIDE = [
  { id: 'retrieval', y: 72, title: 'Retrieval', db: 'MongoDB lecture' },
  { id: 'search', y: 224, title: 'Search', db: 'Elasticsearch' },
];

const BOXES: Box[] = [
  { id: 'client', x: 8, y: 150, w: 84, h: 50, title: 'Client' },
  { id: 'ingress', x: 118, y: 150, w: 84, h: 50, title: 'Ingress' },
  ...W_SIDE.map((s) => ({ ...s, x: 246, w: 128, h: 54 })),
  ...R_SIDE.map((s) => ({ ...s, x: 528, w: 146, h: 54 })),
];
const box = (id: string) => BOXES.find((b) => b.id === id)!;
const midY = (id: string) => box(id).y + box(id).h / 2;
const BUS_X = 426;

const toWrite = (id: string): Pt[] => [[202, 175], [222, 175], [222, midY(id)], [246, midY(id)]];
const toBus = (id: string): Pt[] => [[374, midY(id)], [BUS_X, midY(id)]];
const busTo = (id: string): Pt[] => [[BUS_X + 26, midY(id)], [528, midY(id)]];
const toRead = (id: string): Pt[] => [[160, 150], [160, 8], [506, 8], [506, midY(id)], [528, midY(id)]];
const CLIENT: Pt[] = [[92, 175], [118, 175]];

interface Packet {
  path: Pt[];
  lengths: number[];
  total: number;
  start: number;
  dur: number;
  el: SVGGElement;
  done: () => void;
}

export function mount(host: HTMLElement) {
  const ui = screen('P.05 · CQRS et bus d’événements', tag('6 microservices · Quarkus'));

  // ------------------------------------------------------------ schéma
  const VW = 684;
  const VH = 330;
  const diagram = svg('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'cq__svg', role: 'img', 'aria-label': 'Architecture CQRS d’EpiTweet : services d’écriture, bus Redis, services de lecture.' });
  const wires = svg('g', { class: 'cq__wires' });
  const packetsLayer = svg('g');
  const boxEls = new Map<string, SVGGElement>();

  diagram.append(
    svg('text', { x: 246, y: 26, class: 'cq__zone' }, 'ÉCRITURE · commandes'),
    svg('text', { x: 528, y: 62, class: 'cq__zone' }, 'LECTURE · vues prêtes'),
    wires,
  );
  const line = (pts: Pt[], cls = '') => wires.append(svg('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: `cq__wire ${cls}` }));
  line(CLIENT);
  W_SIDE.forEach((s) => {
    line(toWrite(s.id));
    line(toBus(s.id));
  });
  R_SIDE.forEach((s) => {
    line(busTo(s.id));
    line(toRead(s.id), 'cq__wire--read');
  });

  const bus = svg('g', { class: 'cq__bus' }, svg('rect', { x: BUS_X, y: 34, width: 26, height: 282, rx: 6 }), svg('text', { x: BUS_X + 17, y: 175, transform: `rotate(-90 ${BUS_X + 17} 175)`, 'text-anchor': 'middle' }, 'REDIS PUB/SUB'));
  diagram.append(bus);

  for (const b of BOXES) {
    const g = svg(
      'g',
      { class: `cq__box cq__box--${b.id}` },
      svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8 }),
      svg('text', { x: b.x + 10, y: b.y + (b.db ? 22 : 30), class: 'cq__title' }, b.title),
      b.db ? svg('text', { x: b.x + 10, y: b.y + 40, class: 'cq__db' }, b.db) : null,
    );
    boxEls.set(b.id, g);
    diagram.append(g);
  }
  const viewCount = svg('text', { x: 528 + 146 - 10, y: 72 + 40, class: 'cq__count', 'text-anchor': 'end' });
  diagram.append(viewCount, packetsLayer);

  // ------------------------------------------------------------ état métier
  let posts = 2;
  let projected = 2;
  const log = h('ol', { class: 'cq__log', 'aria-live': 'polite' });
  const t0 = performance.now();
  function say(text: string, kind: 'cmd' | 'evt' | 'qry' | 'warn' = 'cmd') {
    const ms = Math.round(performance.now() - t0);
    log.prepend(h('li', { class: `cq__log-${kind}` }, h('span', { class: 'cq__ts' }, `${(ms / 1000).toFixed(2)}s`), fr(text)));
    while (log.children.length > 7) log.lastChild?.remove();
  }
  const updateCount = () => (viewCount.textContent = `${projected} post${projected > 1 ? 's' : ''}`);
  updateCount();

  // ------------------------------------------------------------ paquets
  const packets: Packet[] = [];
  let raf = 0;
  function send(path: Pt[], label: string, kind: 'cmd' | 'evt' | 'qry' | 'res', dur = 700) {
    return new Promise<void>((done) => {
      const lengths = [0];
      for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      const el = svg('g', { class: `cq__pkt cq__pkt--${kind}` }, svg('circle', { r: 5 }), svg('text', { x: 9, y: -8 }, label));
      packetsLayer.append(el);
      packets.push({ path, lengths, total: lengths[lengths.length - 1], start: performance.now(), dur, el, done });
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }
  function tick(now: number) {
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      const t = Math.min(1, (now - p.start) / p.dur);
      const d = t * p.total;
      let k = 1;
      while (k < p.lengths.length - 1 && p.lengths[k] < d) k++;
      const seg = p.lengths[k] - p.lengths[k - 1] || 1;
      const f = (d - p.lengths[k - 1]) / seg;
      const x = p.path[k - 1][0] + (p.path[k][0] - p.path[k - 1][0]) * f;
      const y = p.path[k - 1][1] + (p.path[k][1] - p.path[k - 1][1]) * f;
      p.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      if (t >= 1) {
        p.el.remove();
        packets.splice(i, 1);
        p.done();
      }
    }
    raf = packets.length ? requestAnimationFrame(tick) : 0;
  }
  const flash = (id: string) => {
    const g = id === 'bus' ? bus : boxEls.get(id)!;
    g.classList.remove('is-hit');
    void g.getBoundingClientRect();
    g.classList.add('is-hit');
  };
  const reverse = (p: Pt[]) => [...p].reverse();

  async function command(svc: string, verb: string, event: string, readers: string[], onWrite: () => void, onProject: (id: string) => void) {
    blip(520, 0.1, 0.1);
    say(`${verb} → ${box(svc).title}`, 'cmd');
    await send([...CLIENT, ...toWrite(svc)], verb, 'cmd', 900);
    flash(svc);
    onWrite();
    say(`${box(svc).title} écrit dans ${box(svc).db}, publie ${event}`, 'evt');
    await send(toBus(svc), event, 'evt', 380);
    flash('bus');
    blip(784, 0.08, 0.1);
    await Promise.all(
      readers.map(async (r, i) => {
        await send([[BUS_X + 13, midY(svc)], [BUS_X + 13, midY(r)], ...busTo(r)], event, 'evt', 900 + i * 250);
        flash(r);
        onProject(r);
      }),
    );
  }

  async function query(svc: string, verb: string, answer: () => string) {
    blip(440, 0.1, 0.1);
    say(`${verb} → ${box(svc).title}`, 'qry');
    await send([...CLIENT, ...toRead(svc)], verb, 'qry', 1000);
    flash(svc);
    const a = answer();
    await send(reverse([...CLIENT, ...toRead(svc)]), '200', 'res', 800);
    say(a, projected < posts && svc === 'retrieval' ? 'warn' : 'qry');
  }

  const actions = h(
    'div',
    { class: 'seg' },
    tag('Actions', 'seg-label'),
    h('button', {
      type: 'button',
      class: 'btn btn--sm btn--signal',
      onclick: () =>
        void command('post', 'POST /posts', 'PostCreated', ['retrieval', 'search'], () => posts++, (r) => {
          if (r === 'retrieval') {
            projected++;
            updateCount();
            say('Retrieval : timelines mises à jour', 'evt');
          } else say('Search : post indexé', 'evt');
        }),
    }, 'Publier un post'),
    h('button', {
      type: 'button',
      class: 'btn btn--sm',
      onclick: () => void command('social', 'POST /follow', 'UserFollowed', ['retrieval'], () => {}, () => say('Retrieval : timeline recalculée', 'evt')),
    }, 'Suivre quelqu’un'),
    h('button', {
      type: 'button',
      class: 'btn btn--sm',
      onclick: () => void command('user', 'POST /users', 'UserCreated', ['retrieval', 'search'], () => {}, (r) => say(r === 'search' ? 'Search : profil indexé' : 'Retrieval : profil dénormalisé', 'evt')),
    }, 'Créer un compte'),
    h('button', {
      type: 'button',
      class: 'btn btn--sm',
      onclick: () =>
        void query('retrieval', 'GET /timeline', () =>
          projected < posts
            ? `Timeline : ${projected} posts. Le dernier est encore en route sur le bus : c'est la cohérence à terme.`
            : `Timeline : ${projected} posts, servis depuis une vue déjà prête, sans jointure.`,
        ),
    }, 'Lire sa timeline'),
    h('button', {
      type: 'button',
      class: 'btn btn--sm',
      onclick: () => void query('search', 'GET /search', () => 'Search : résultats plein texte depuis Elasticsearch'),
    }, 'Rechercher'),
  );

  // ------------------------------------------------------------ CI/CD
  const SERVICES = ['user', 'post', 'social', 'like', 'retrieval', 'search'];
  type Change = 'post' | 'pom' | 'docs';
  let change: Change = 'post';
  const stagesEl = h('ol', { class: 'ci__stages' });
  const podsEl = h('div', { class: 'ci__pods' });
  const pods = new Map(SERVICES.map((s) => {
    const el = h('span', { class: 'ci__pod' }, led('on'), s);
    podsEl.append(el);
    return [s, el];
  }));
  const STAGES = ['lint', 'build amd64', 'build arm64', 'push registre', 'kubectl apply -k'];
  const stageEls = STAGES.map((s) => h('li', { class: 'ci__stage' }, h('span', { class: 'ci__bar' }), tag(s)));
  stagesEl.append(...stageEls);
  const ciNote = h('p', { class: 'ci__note' });
  let running = false;

  const changeSeg = segmented<Change>(
    'Commit',
    [
      { value: 'post', label: 'post-service/src' },
      { value: 'pom', label: 'pom.xml racine' },
      { value: 'docs', label: 'README.md' },
    ],
    change,
    (v) => (change = v),
  );
  const runBtn = h('button', { type: 'button', class: 'btn btn--sm btn--signal' }, 'git push');
  runBtn.addEventListener('click', async () => {
    if (running) return;
    running = true;
    stageEls.forEach((s) => s.classList.remove('is-done', 'is-run', 'is-skip'));
    const targets = change === 'post' ? ['post'] : change === 'pom' ? SERVICES : [];
    if (!targets.length) {
      stageEls.forEach((s) => s.classList.add('is-skip'));
      ciNote.textContent = fr('Aucun job déclenché : les règles « changes: » ne regardent que les sources Java et les pom.xml. Personne n\'attend une CI pour une faute de frappe.');
      blip(330, 0.1, 0.15);
      running = false;
      return;
    }
    ciNote.textContent = fr(change === 'post' ? 'Seul post-service a changé : une seule image est reconstruite, les 13 autres développeurs ne paient rien.' : 'Le pom.xml racine touche tout le monorepo : les 6 images sont reconstruites, en amd64 et arm64.');
    for (const s of stageEls) {
      s.classList.add('is-run');
      blip(392, 0.06, 0.06);
      await new Promise((r) => setTimeout(r, change === 'pom' ? 650 : 420));
      s.classList.remove('is-run');
      s.classList.add('is-done');
    }
    for (const t of targets) {
      const p = pods.get(t)!;
      p.classList.add('is-rolling');
      await new Promise((r) => setTimeout(r, 180));
    }
    blip(784, 0.12, 0.25);
    setTimeout(() => pods.forEach((p) => p.classList.remove('is-rolling')), 1400);
    running = false;
  });

  const ci = h(
    'div',
    { class: 'ci' },
    h('div', { class: 'ci__head' }, tag('GitLab CI · monorepo Maven · Jib multi-arch'), h('span', { class: 'spacer' }), changeSeg.el, runBtn),
    stagesEl,
    h('div', { class: 'ci__foot' }, tag('Pods Kubernetes'), podsEl),
    ciNote,
  );

  ui.view.classList.add('cq__view');
  ui.view.append(diagram);
  ui.controls.append(actions, log, ci);
  ui.caption.append(
    h('strong', null, fr('Essayez : « Publier un post » puis tout de suite « Lire sa timeline ». ')),
    fr('La vue de lecture a un temps de retard : c\'est le prix du CQRS, en échange de lectures rapides et indépendantes. En bas, le pipeline que j\'ai écrit : déclenchement ciblé selon les fichiers modifiés, images amd64 et arm64, déploiement Kustomize.'),
  );
  host.append(ui.root);
  clear(log);
  say('Cluster prêt : 6 services, 4 bases, 1 bus', 'evt');
}
