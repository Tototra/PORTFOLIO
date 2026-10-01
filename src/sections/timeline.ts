import { clear, h, led, setVars, tag } from '../lib/dom';
import { blip, SCALE } from '../lib/audio';
import { fr } from '../lib/typo';
import { TRACKS, timeline } from '../content/timeline';
import { profile } from '../content/profile';
import type { Month, TimelineItem } from '../content/types';

// La frise est une « vue arrangement » de séquenceur : une piste par type
// d'expérience, des clips datés, et une tête de lecture qu'on déplace.

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const toIdx = (m: Month | string) => {
  const [y, mo] = m.split('-').map(Number);
  return y * 12 + (mo - 1);
};
const label = (i: number) => `${MONTHS[i % 12]} ${Math.floor(i / 12)}`;

const T0 = toIdx('2020-06');
const T1 = toIdx('2027-10');
const TODAY = toIdx(profile.today);

// Zoom façon séquenceur : les années récentes, très denses, sont dilatées.
const WARP_FROM = toIdx('2025-01');
const PX_OLD = 15;
const PX_NEW = 56;
let zoomed = true;

/** Largeur (en unités) entre le début de la frise et le mois m (fractionnaire). */
function units(m: number) {
  if (!zoomed) return m - T0;
  return Math.max(0, Math.min(m, WARP_FROM) - T0) * PX_OLD + Math.max(0, m - WARP_FROM) * PX_NEW;
}
const total = () => units(T1 + 1);
const pos = (m: number) => units(m) / total();
function monthAt(f: number) {
  const u = f * total();
  if (!zoomed) return T0 + u;
  const old = (WARP_FROM - T0) * PX_OLD;
  return u <= old ? T0 + u / PX_OLD : WARP_FROM + (u - old) / PX_NEW;
}
const TRACK_NOTE: Record<string, number> = { formation: 0, experience: 2, projet: 4, vie: 6 };

interface Placed {
  item: TimelineItem;
  s: number;
  e: number;
  lane: number;
  el: HTMLButtonElement;
}

function duration(s: number, e: number) {
  const m = e - s + 1;
  if (m < 12) return `${m} mois`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r ? `${y} an${y > 1 ? 's' : ''} et ${r} mois` : `${y} an${y > 1 ? 's' : ''}`;
}

export function timelineSection() {
  const placed: Placed[] = [];
  let playhead = TODAY;
  let selected: Placed | null = null;
  let playing = false;
  let timer = 0;

  // ---------------------------------------------------------------- pistes
  const rows = TRACKS.map((track) => {
    const items = timeline
      .filter((i) => i.track === track.id)
      .map((item) => ({ item, s: toIdx(item.start), e: item.end ? toIdx(item.end) : TODAY }))
      .sort((a, b) => a.s - b.s);
    const laneEnds: number[] = [];
    const lanesEl = h('div', { class: 'arr__lanes' });
    for (const it of items) {
      let lane = laneEnds.findIndex((end) => end < it.s);
      if (lane === -1) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = it.e;
      const el = h(
        'button',
        {
          type: 'button',
          class: `clip clip--${track.id}${it.item.placeholder ? ' clip--ghost' : ''}${it.item.end ? '' : ' clip--ongoing'}`,
          'aria-label': fr(`${it.item.title}, ${it.item.org}, ${label(it.s)} à ${it.item.end ? label(it.e) : 'aujourd\'hui'}`),
        },
        h('span', { class: 'clip__title' }, fr(it.item.title)),
        h('span', { class: 'clip__org' }, fr(it.item.org)),
      );
      setVars(el, { '--lane': lane });
      const p: Placed = { ...it, lane, el };
      el.addEventListener('click', () => {
        stop();
        select(p);
        setPlayhead(p.s, false);
      });
      lanesEl.appendChild(el);
      placed.push(p);
    }
    setVars(lanesEl, { '--lanes': Math.max(1, laneEnds.length) });
    return h('div', { class: `arr__track arr__track--${track.id}` }, h('div', { class: 'arr__head' }, tag(track.label)), lanesEl);
  });

  // ---------------------------------------------------------------- règle
  const ruler = h('div', { class: 'arr__ruler-marks' });
  const marks: [HTMLElement, number][] = [];
  for (let y = Math.ceil(T0 / 12); y * 12 <= T1; y++) {
    const mark = h('span', { class: 'arr__year' }, String(y));
    marks.push([mark, y * 12]);
    ruler.appendChild(mark);
  }
  const nowMark = h('span', { class: 'arr__today' }, tag('aujourd’hui'));
  marks.push([nowMark, TODAY + 0.5]);
  ruler.appendChild(nowMark);

  const playheadEl = h('div', { class: 'arr__playhead', 'aria-hidden': 'true' }, h('span', { class: 'arr__playhead-cap' }));
  const gridlines: HTMLElement[] = [];
  for (let y = Math.ceil(T0 / 12); y * 12 <= T1; y++) {
    const line = h('span', { class: `arr__gridline${y * 12 === WARP_FROM ? ' arr__gridline--warp' : ''}`, 'aria-hidden': 'true' });
    marks.push([line, y * 12]);
    gridlines.push(line);
  }
  const warpNote = h('span', { class: 'arr__warp' }, tag('zoom ×3,7 →'));
  marks.push([warpNote, WARP_FROM]);
  ruler.appendChild(warpNote);
  const lanesArea = h('div', { class: 'arr__area' }, ...gridlines, ...rows, playheadEl);
  const board = h(
    'div',
    { class: 'arr__board' },
    h('div', { class: 'arr__ruler' }, h('div', { class: 'arr__head' }, tag('An')), ruler),
    lanesArea,
  );
  const scroller = h(
    'div',
    {
      class: 'arr__scroll',
      tabindex: 0,
      role: 'group',
      'aria-label': 'Frise du parcours. Flèches gauche et droite pour déplacer la tête de lecture, espace pour lancer la lecture.',
    },
    board,
  );

  // ---------------------------------------------------------------- transport
  const dateEl = h('span', { class: 'arr__date' });
  const playBtn = h('button', { type: 'button', class: 'btn btn--signal', 'aria-pressed': 'false' }, 'Lecture');
  const todayBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, 'Aujourd’hui');
  const zoomBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'aria-pressed': 'false' }, 'Tout voir');
  zoomBtn.addEventListener('click', () => {
    zoomed = !zoomed;
    zoomBtn.textContent = zoomed ? 'Tout voir' : 'Zoom récent';
    layout();
    setPlayhead(playhead, true);
  });
  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  todayBtn.addEventListener('click', () => {
    stop();
    setPlayhead(TODAY, true);
  });

  // ---------------------------------------------------------------- inspecteur
  const liveList = h('ul', { class: 'insp__live' });
  const detail = h('div', { class: 'insp__detail', 'aria-live': 'polite' });

  function renderLive() {
    clear(liveList);
    const live = placed.filter((p) => p.s <= playhead && playhead <= p.e);
    for (const p of live) {
      const li = h(
        'li',
        null,
        h(
          'button',
          { type: 'button', class: `insp__live-item${selected === p ? ' is-selected' : ''}`, onclick: () => select(p) },
          led(p.item.placeholder ? 'warn' : 'on'),
          h('span', null, fr(p.item.title)),
          tag(TRACKS.find((t) => t.id === p.item.track)!.label),
        ),
      );
      liveList.appendChild(li);
    }
    if (!live.length) liveList.appendChild(h('li', { class: 'insp__empty' }, 'Silence radio à cette date.'));
  }

  function renderDetail() {
    clear(detail);
    if (!selected) return;
    const it = selected.item;
    const when = `${label(selected.s)} → ${it.end ? label(selected.e) : 'aujourd’hui'} · ${duration(selected.s, selected.e)}`;
    const parts = [
      h('div', { class: 'insp__meta' }, tag(TRACKS.find((t) => t.id === it.track)!.label, 'insp__track'), tag(it.placeholder ? 'février 2027 → ?' : when)),
      h('h3', { class: 'insp__title' }, fr(it.title)),
      h('p', { class: 'insp__org' }, fr([it.org, it.place].filter(Boolean).join(' · '))),
      h('p', { class: 'insp__summary' }, fr(it.summary)),
      it.bullets ? h('ul', { class: 'insp__bullets' }, it.bullets.map((b) => h('li', null, fr(b)))) : null,
      it.stack ? h('ul', { class: 'chips' }, it.stack.map((s) => h('li', { class: 'chip' }, s))) : null,
      it.projectId ? h('a', { class: 'btn btn--sm', href: `#projet-${it.projectId}` }, 'Voir le projet et sa démo') : null,
      it.placeholder ? h('a', { class: 'btn btn--signal btn--sm', href: '#contact' }, 'Remplir cette case') : null,
    ];
    detail.append(...parts.filter((p) => p !== null));
  }

  function select(p: Placed) {
    if (selected) selected.el.classList.remove('is-selected');
    selected = p;
    p.el.classList.add('is-selected');
    renderDetail();
    renderLive();
  }

  function setPlayhead(i: number, scroll: boolean) {
    const prev = playhead;
    playhead = Math.max(T0, Math.min(T1, Math.round(i)));
    setVars(playheadEl, { '--p': pos(playhead + 0.5) });
    dateEl.textContent = label(playhead);
    for (const p of placed) p.el.classList.toggle('is-live', p.s <= playhead && playhead <= p.e);
    renderLive();
    if (scroll) {
      const x = (playheadEl.offsetLeft || 0) - scroller.clientWidth / 2;
      scroller.scrollTo({ left: x, behavior: playing ? 'auto' : 'smooth' });
    }
    return prev;
  }

  function play() {
    if (playhead >= T1) setPlayhead(T0, true);
    playing = true;
    playBtn.textContent = 'Pause';
    playBtn.setAttribute('aria-pressed', 'true');
    timer = window.setInterval(() => {
      if (playhead >= T1) return stop();
      setPlayhead(playhead + 1, true);
      const starting = placed.filter((p) => p.s === playhead);
      starting.forEach((p, k) => {
        window.setTimeout(() => blip(SCALE[TRACK_NOTE[p.item.track] + (k % 3)], 0.16, 0.35), k * 60);
      });
      if (starting.length) select(starting[starting.length - 1]);
      else if (playhead % 12 === 0) blip(SCALE[0] / 2, 0.06, 0.08);
    }, 150);
  }

  function stop() {
    if (!playing) return;
    playing = false;
    window.clearInterval(timer);
    playBtn.textContent = 'Lecture';
    playBtn.setAttribute('aria-pressed', 'false');
  }

  // Déplacer la tête de lecture en glissant sur la frise
  const fromPointer = (e: PointerEvent) => {
    const r = lanesArea.getBoundingClientRect();
    const head = (lanesArea.querySelector('.arr__head') as HTMLElement).offsetWidth;
    return monthAt((e.clientX - r.left - head) / (r.width - head)) - 0.5;
  };
  board.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.clip')) return;
    stop();
    board.setPointerCapture(e.pointerId);
    setPlayhead(fromPointer(e), false);
  });
  board.addEventListener('pointermove', (e) => {
    if (board.hasPointerCapture(e.pointerId)) setPlayhead(fromPointer(e), false);
  });
  scroller.addEventListener('keydown', (e) => {
    if (e.target !== scroller) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      stop();
      setPlayhead(playhead + (e.key === 'ArrowRight' ? 1 : -1), true);
    } else if (e.key === ' ') {
      playing ? stop() : play();
    } else return;
    e.preventDefault();
  });

  const section = h(
    'section',
    { id: 'parcours', class: 'section', 'aria-labelledby': 'parcours-title' },
    h(
      'div',
      { class: 'wrap' },
      h(
        'header',
        { class: 'sec-head' },
        h('span', { class: 'sec-num' }, '01'),
        h('h2', { id: 'parcours-title', class: 'sec-title' }, 'Parcours'),
        tag('2020 → 2027 · une piste par sujet', 'sec-meta'),
      ),
      h(
        'p',
        { class: 'sec-lead' },
        h('span', { class: 'serif' }, fr('Mon parcours, en vue arrangement. ')),
        fr('Faites glisser la tête de lecture, cliquez sur un clip, ou lancez la lecture : avec le son activé, chaque étape joue sa note.'),
      ),
      h(
        'div',
        { class: 'arr' },
        h('div', { class: 'arr__transport' }, playBtn, h('div', { class: 'arr__clock' }, tag('Position'), dateEl), todayBtn, zoomBtn),
        scroller,
        h(
          'div',
          { class: 'insp' },
          h('div', { class: 'insp__col' }, tag('En cours à cette date'), liveList),
          h('div', { class: 'insp__col insp__col--detail' }, detail),
        ),
      ),
    ),
  );

  function layout() {
    for (const p of placed) setVars(p.el, { '--x': pos(p.s), '--w': pos(p.e + 1) - pos(p.s) });
    for (const [el, m] of marks) setVars(el, { '--x': pos(m) });
    warpNote.hidden = !zoomed;
    setVars(board, { '--board-w': zoomed ? `${Math.round(total() + 104)}px` : '1000px' });
  }
  layout();

  const start = placed.find((p) => p.item.id === 'exakis') ?? placed[0];
  setPlayhead(TODAY, false);
  select(start);
  requestAnimationFrame(() => setPlayhead(TODAY, true));

  return section;
}
