import { h, tag } from '../lib/dom';
import { audio, brass, hat, kick, snare } from '../lib/audio';
import { knob, screen } from '../lib/ui';
import { fr } from '../lib/typo';
import { load, save } from '../lib/store';

// Hors code : une boîte à rythmes 16 pas, entièrement synthétisée en Web Audio.
// La quatrième piste est un trombone, approximatif mais sincère.

const STEPS = 16;
const ROWS = [
  { id: 'kick', label: 'Kick' },
  { id: 'snare', label: 'Snare' },
  { id: 'hat', label: 'Hat' },
  { id: 'tromb', label: 'Tromb.' },
] as const;

// Notes du trombone par pas (en Hz), sur une gamme de la mineur
const RIFF = [110, 0, 0, 130.81, 0, 0, 146.83, 0, 164.81, 0, 146.83, 0, 130.81, 0, 98, 0];

const GROOVE: boolean[][] = [
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
].map((r) => r.map(Boolean));

const PASSIONS = [
  { k: 'Studio', t: 'Production de musique électronique', d: 'Du sound design à l\'arrangement. C\'est aussi pour ça que la frise du parcours ressemble à un séquenceur.' },
  { k: 'Pupitre', t: 'Trombone', d: 'Brevet d\'études musicales. La quatrième piste de la boîte à rythmes lui rend un hommage approximatif.' },
  { k: 'Scène', t: 'La Tête Qui Bouge', d: 'Près de deux ans à organiser des concerts locaux : programmation, communication, son, lumière et plateau.' },
  { k: 'Pistes', t: 'Ski et tennis en compétition', d: 'Deux sports où l\'on apprend vite que la régularité bat le coup d\'éclat.' },
  { k: 'Voies', t: 'Escalade', d: 'Lire une voie avant de partir, c\'est un peu lire un problème avant de coder.' },
];

export function offstageSection() {
  const ui = screen('TT-16 · Boîte à rythmes', tag('Web Audio · aucun sample'));
  let pattern: boolean[][] = load<boolean[][]>('drums', GROOVE.map((r) => [...r]));
  if (!Array.isArray(pattern) || pattern.length !== ROWS.length) pattern = GROOVE.map((r) => [...r]);
  let bpm = 118;
  let playing = false;
  let current = -1;

  const cells: HTMLButtonElement[][] = [];
  const grid = h('div', { class: 'dm__grid', role: 'grid', 'aria-label': 'Séquenceur 16 pas' });
  ROWS.forEach((row, r) => {
    grid.append(h('span', { class: 'dm__label tag' }, row.label));
    cells[r] = [];
    for (let s = 0; s < STEPS; s++) {
      const b = h('button', {
        type: 'button',
        class: `dm__cell${s % 4 === 0 ? ' dm__cell--beat' : ''}`,
        'aria-pressed': String(pattern[r][s]),
        'aria-label': `${row.label}, pas ${s + 1}`,
      });
      b.addEventListener('click', () => {
        pattern[r][s] = !pattern[r][s];
        b.setAttribute('aria-pressed', String(pattern[r][s]));
        save('drums', pattern);
        if (pattern[r][s]) trigger(r, s, audio().currentTime);
      });
      cells[r][s] = b;
      grid.append(b);
    }
  });

  function refresh() {
    pattern.forEach((row, r) => row.forEach((on, s) => cells[r][s].setAttribute('aria-pressed', String(on))));
  }

  function trigger(r: number, s: number, t: number) {
    if (r === 0) kick(t);
    else if (r === 1) snare(t);
    else if (r === 2) hat(t, 0.14, s === 14);
    else brass(RIFF[s] || 110, t, (60 / bpm / 4) * 1.6);
  }

  // Ordonnanceur classique : on planifie un peu en avance sur l'horloge audio
  let nextTime = 0;
  let step = 0;
  let timer = 0;
  const queue: { s: number; t: number }[] = [];
  function schedule() {
    const c = audio();
    while (nextTime < c.currentTime + 0.12) {
      pattern.forEach((row, r) => row[step] && trigger(r, step, nextTime));
      queue.push({ s: step, t: nextTime });
      nextTime += 60 / bpm / 4;
      step = (step + 1) % STEPS;
    }
  }
  function drawStep() {
    if (!playing) return;
    const c = audio();
    while (queue.length && queue[0].t <= c.currentTime) {
      current = queue.shift()!.s;
      cells.forEach((row) => row.forEach((b, s) => b.classList.toggle('is-now', s === current)));
    }
    requestAnimationFrame(drawStep);
  }

  const playBtn = h('button', { type: 'button', class: 'btn btn--signal', 'aria-pressed': 'false' }, 'Lecture');
  playBtn.addEventListener('click', () => {
    if (playing) {
      playing = false;
      window.clearInterval(timer);
      queue.length = 0;
      cells.forEach((row) => row.forEach((b) => b.classList.remove('is-now')));
      playBtn.textContent = 'Lecture';
      playBtn.setAttribute('aria-pressed', 'false');
      return;
    }
    const c = audio();
    playing = true;
    step = 0;
    nextTime = c.currentTime + 0.05;
    schedule();
    timer = window.setInterval(schedule, 25);
    requestAnimationFrame(drawStep);
    playBtn.textContent = 'Stop';
    playBtn.setAttribute('aria-pressed', 'true');
  });
  const resetBtn = h('button', { type: 'button', class: 'btn btn--sm' }, 'Groove d’origine');
  resetBtn.addEventListener('click', () => {
    pattern = GROOVE.map((r) => [...r]);
    save('drums', pattern);
    refresh();
  });
  const clearBtn = h('button', { type: 'button', class: 'btn btn--sm' }, 'Effacer');
  clearBtn.addEventListener('click', () => {
    pattern = pattern.map((r) => r.map(() => false));
    save('drums', pattern);
    refresh();
  });
  const tempo = knob({ label: 'Tempo', min: 80, max: 160, value: bpm, format: (v) => `${Math.round(v)} bpm`, onInput: (v) => (bpm = v) });

  ui.view.classList.add('dm__view');
  ui.view.append(grid);
  ui.controls.append(playBtn, tempo.el, resetBtn, clearBtn);
  ui.caption.append(fr('Le son démarre quand vous appuyez sur Lecture. Cliquez sur les cases pour modifier le motif, il est gardé dans votre navigateur.'));

  return h(
    'section',
    { id: 'hors-code', class: 'section', 'aria-labelledby': 'hors-code-title' },
    h(
      'div',
      { class: 'wrap' },
      h(
        'div',
        { class: 'off' },
        h('div', { class: 'off__machine' }, ui.root),
        h(
          'ul',
          { class: 'off__list' },
          PASSIONS.map((p) => h('li', { class: 'off__item' }, tag(p.k), h('h3', { class: 'off__title' }, fr(p.t)), h('p', null, fr(p.d)))),
        ),
      ),
    ),
  );
}
