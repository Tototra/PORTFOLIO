import { h, tag } from '../lib/dom';
import { fitCanvas, visibleLoop } from '../lib/motion';
import { blip } from '../lib/audio';
import { load, save } from '../lib/store';
import { num, readout, screen, segmented, toggle } from '../lib/ui';
import { fr } from '../lib/typo';
import { CAR, Mpc, Track, step, steerLimit, type CarState, type Control } from './race-sim';

// Course contre le contrôleur prédictif. Toute la physique et le MPC sont
// dans race-sim.ts ; ce fichier ne fait que l'affichage et les commandes.

type Mode = 'exact' | 'faux' | 'appris';
type Phase = 'demo' | 'countdown' | 'race' | 'done';

const LAPS = 3;
const WRONG_MU = CAR.mu * 2.1;

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

export function mount(host: HTMLElement) {
  const track = new Track();
  const ui = screen('P.01 · Course contre le MPC', tag('clavier ← → ↑ ↓', 'race__kbd'));
  const canvas = h('canvas', {
    tabindex: 0,
    'aria-label': 'Circuit de course vu de dessus. Pendant une course, les flèches ou ZQSD pilotent votre voiture.',
  });
  const overlay = h('div', { class: 'race__overlay', 'aria-live': 'polite' });
  ui.view.classList.add('race__view');
  ui.view.append(canvas, overlay);

  // ------------------------------------------------------------ état
  let mode: Mode = 'exact';
  let phase: Phase = 'demo';
  let showPlan = true;
  const mpc = new Mpc(CAR.mu);
  let ai: CarState = track.gridSlot(8, 0);
  let me: CarState = track.gridSlot(8, -3);
  let raceT = 0;
  let countdown = 0;
  let aiFinish = 0;
  let meFinish = 0;
  let best = load<number>('race-best', 0);
  const keys = { left: false, right: false, up: false, down: false };
  let meSteer = 0;
  const trailAi: number[] = [];
  const trailMe: number[] = [];

  // ------------------------------------------------------------ interface
  const rMeLap = readout('Vous · tour', '·');
  const rMeTime = readout('Chrono', '0:00.00', 'volt');
  const rBest = readout('Record', best ? fmtTime(best) : '·');
  const rAiLap = readout('MPC · tour', '·');
  const rAiSpeed = readout('MPC km/h', '0', 'signal');
  const rMu = readout('Adhérence supposée', '');

  const startBtn = h('button', { type: 'button', class: 'btn btn--signal btn--sm' }, 'Course · 3 tours');
  startBtn.addEventListener('click', () => (phase === 'demo' || phase === 'done' ? startRace() : abort()));

  const modeSeg = segmented<Mode>(
    'Modèle du MPC',
    [
      { value: 'exact', label: 'Exact' },
      { value: 'faux', label: 'Faux' },
      { value: 'appris', label: 'Faux + apprentissage' },
    ],
    mode,
    (m) => {
      mode = m;
      configureMpc();
      if (phase === 'demo') resetDemo();
    },
  );
  const planToggle = toggle('Voir ce que pense le MPC', true, (on) => (showPlan = on));

  // commandes tactiles
  const pad = (label: string, key: keyof typeof keys) => {
    const b = h('button', { type: 'button', class: 'btn race__pad', 'aria-label': label }, label);
    const set = (v: boolean) => (e: Event) => {
      e.preventDefault();
      keys[key] = v;
    };
    b.addEventListener('pointerdown', set(true));
    b.addEventListener('pointerup', set(false));
    b.addEventListener('pointerleave', set(false));
    b.addEventListener('pointercancel', set(false));
    return b;
  };
  const pads = h('div', { class: 'race__pads' }, pad('←', 'left'), pad('→', 'right'), h('span', { class: 'spacer' }), pad('Frein', 'down'), pad('Gaz', 'up'));

  ui.controls.append(
    h('div', { class: 'readouts' }, rMeLap.el, rMeTime.el, rBest.el, rAiLap.el, rAiSpeed.el, rMu.el),
    pads,
    h('div', { class: 'race__row' }, startBtn, modeSeg.el, planToggle.el),
  );
  ui.caption.append(
    h('strong', null, fr('Ce que vous voyez : ')),
    fr('à chaque image, le MPC simule 48 trajectoires possibles sur 1,5 seconde avec son modèle physique, puis moyenne les meilleures (MPPI, avec warm start). En mode « Faux », il croit la piste deux fois plus adhérente : il rate ses virages. En mode apprentissage, il corrige son modèle par descente de gradient sur l\'erreur de prédiction du lacet. Dans le projet, le MPC optimisait directement par gradient à travers mon moteur d\'autodiff, et c\'est un réseau de neurones qui apprenait l\'écart. Astuce : en mode « Faux », il est battable.'),
  );
  host.append(ui.root);

  function configureMpc() {
    mpc.reset(mode === 'exact' ? CAR.mu : WRONG_MU);
    mpc.learning = mode === 'appris';
  }

  function resetDemo() {
    phase = 'demo';
    ai = track.gridSlot(8, 0);
    trailAi.length = 0;
    trailMe.length = 0;
    configureMpc();
    startBtn.textContent = 'Course · 3 tours';
    showOverlay('');
  }

  function startRace() {
    configureMpc();
    ai = track.gridSlot(10, 2.6);
    me = track.gridSlot(10, -2.6);
    meSteer = 0;
    trailAi.length = 0;
    trailMe.length = 0;
    raceT = 0;
    aiFinish = 0;
    meFinish = 0;
    countdown = 3.999;
    phase = 'countdown';
    startBtn.textContent = 'Abandonner';
    canvas.focus({ preventScroll: true });
  }

  function abort() {
    resetDemo();
  }

  function showOverlay(text: string, sub = '') {
    overlay.replaceChildren();
    if (!text) return overlay.classList.remove('is-on');
    overlay.classList.add('is-on');
    overlay.append(h('span', { class: 'race__big' }, text), sub ? h('span', { class: 'race__sub' }, sub) : '');
  }

  // ------------------------------------------------------------ clavier
  const keyMap: Record<string, keyof typeof keys> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyA: 'left', KeyQ: 'left', KeyD: 'right', KeyW: 'up', KeyZ: 'up', KeyS: 'down',
  };
  const racing = () => phase === 'race' || phase === 'countdown';
  window.addEventListener('keydown', (e) => {
    const k = keyMap[e.code];
    if (!k || !racing()) return;
    const inside = ui.root.contains(document.activeElement) || document.activeElement === document.body;
    if (!inside) return;
    keys[k] = true;
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k as keyof typeof keys] = false)));

  // ------------------------------------------------------------ simulation
  function playerControl(dt: number): Control {
    const lim = steerLimit(CAR, me.v);
    const target = (keys.left ? -lim : 0) + (keys.right ? lim : 0);
    meSteer += Math.max(-3 * dt, Math.min(3 * dt, target - meSteer));
    return { steer: meSteer, throttle: keys.up ? 1 : keys.down ? -1 : -0.05 };
  }

  function stepAi(dt: number) {
    const u = mpc.act(track, CAR, ai, showPlan);
    const before = ai;
    ai = step(track, CAR, CAR.mu, ai, u, dt / 2);
    ai = step(track, CAR, CAR.mu, ai, u, dt / 2);
    mpc.observe(CAR, before, ai, u, dt);
  }

  function update(dt: number) {
    if (phase === 'countdown') {
      const before = Math.ceil(countdown);
      countdown -= dt;
      const now = Math.ceil(countdown);
      if (now !== before && now > 0) blip(440, 0.18, 0.15);
      if (countdown <= 0) {
        phase = 'race';
        blip(880, 0.22, 0.3);
        showOverlay('GO');
        window.setTimeout(() => phase === 'race' && showOverlay(''), 600);
      } else showOverlay(String(now));
      return;
    }
    if (phase === 'demo') {
      stepAi(dt);
      if (ai.s > track.length * 50) ai.s -= track.length * 50;
      return;
    }
    if (phase !== 'race') return;

    raceT += dt;
    if (!aiFinish) stepAi(dt);
    if (!meFinish) {
      const u = playerControl(dt);
      const prevLap = Math.floor(me.s / track.length);
      me = step(track, CAR, CAR.mu, me, u, dt / 2);
      me = step(track, CAR, CAR.mu, me, u, dt / 2);
      const lap = Math.floor(me.s / track.length);
      if (lap > prevLap && lap >= 1) blip(660, 0.15, 0.2);
    }
    if (!aiFinish && ai.s >= LAPS * track.length) aiFinish = raceT;
    if (!meFinish && me.s >= LAPS * track.length) {
      meFinish = raceT;
      blip(990, 0.2, 0.4);
    }
    if (meFinish && (aiFinish || raceT - meFinish > 4)) finish();
  }

  function finish() {
    phase = 'done';
    startBtn.textContent = 'Revanche';
    const won = meFinish && (!aiFinish || meFinish < aiFinish);
    if (meFinish && (!best || meFinish < best)) {
      best = meFinish;
      save('race-best', best);
      rBest.set(fmtTime(best));
    }
    showOverlay(
      won ? 'Vous gagnez' : 'Le MPC gagne',
      `Vous ${fmtTime(meFinish)} · MPC ${aiFinish ? fmtTime(aiFinish) : 'pas fini'}`,
    );
  }

  // ------------------------------------------------------------ rendu
  const ctx = canvas.getContext('2d')!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let trackLayer: HTMLCanvasElement | null = null;

  const minX = Math.min(...track.cx) - 16;
  const maxX = Math.max(...track.cx) + 16;
  const minY = Math.min(...track.cy) - 16;
  const maxY = Math.max(...track.cy) + 16;

  function layout(w: number, hh: number, d: number) {
    W = w;
    H = hh;
    dpr = d;
    scale = Math.min(W / (maxX - minX), H / (maxY - minY));
    ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
    oy = (H - (maxY - minY) * scale) / 2 - minY * scale;
    trackLayer = renderTrack();
  }

  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy + y * scale;

  function edge(side: number, extra = 0) {
    const pts: [number, number][] = [];
    const r = track.halfWidth + extra;
    for (let i = 0; i <= track.n; i++) {
      const k = i % track.n;
      pts.push([X(track.cx[k] - track.ty[k] * r * side), Y(track.cy[k] + track.tx[k] * r * side)]);
    }
    return pts;
  }

  function renderTrack() {
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#171a14';
    g.fillRect(0, 0, W, H);
    // grille discrète
    g.strokeStyle = 'rgba(235,232,222,0.04)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 24) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += 24) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(W, y + 0.5);
      g.stroke();
    }
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= track.n; i++) {
        const k = i % track.n;
        i ? g.lineTo(X(track.cx[k]), Y(track.cy[k])) : g.moveTo(X(track.cx[k]), Y(track.cy[k]));
      }
    };
    g.lineJoin = 'round';
    path();
    g.strokeStyle = '#20241c';
    g.lineWidth = (track.halfWidth + 5) * 2 * scale;
    g.stroke();
    path();
    g.strokeStyle = '#2f2f2b';
    g.lineWidth = track.halfWidth * 2 * scale;
    g.stroke();
    // vibreurs
    for (const side of [-1, 1]) {
      const pts = edge(side, -0.4);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.lineWidth = Math.max(1.5, 0.8 * scale);
      g.setLineDash([Math.max(3, 2.5 * scale), Math.max(3, 2.5 * scale)]);
      g.strokeStyle = '#ff5a14';
      g.stroke();
      g.lineDashOffset = Math.max(3, 2.5 * scale);
      g.strokeStyle = '#ebe8de';
      g.stroke();
      g.setLineDash([]);
      g.lineDashOffset = 0;
    }
    // ligne d'arrivée en damier
    const k = 0;
    const nx = -track.ty[k];
    const ny = track.tx[k];
    const cells = 8;
    const cw = (track.halfWidth * 2) / cells;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < 2; j++) {
        const l = -track.halfWidth + i * cw;
        const a = j * 1.2;
        g.fillStyle = (i + j) % 2 ? '#ebe8de' : '#151513';
        g.beginPath();
        const p = (lat: number, al: number) => [X(track.cx[k] + nx * lat + track.tx[k] * al), Y(track.cy[k] + ny * lat + track.ty[k] * al)] as const;
        const [x1, y1] = p(l, a);
        const [x2, y2] = p(l + cw, a);
        const [x3, y3] = p(l + cw, a + 1.2);
        const [x4, y4] = p(l, a + 1.2);
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.lineTo(x3, y3);
        g.lineTo(x4, y4);
        g.fill();
      }
    }
    return c;
  }

  function drawCar(c: CarState, body: string) {
    ctx.save();
    ctx.translate(X(c.x), Y(c.y));
    ctx.rotate(c.psi);
    const l = Math.max(9, 4.4 * scale);
    const w = Math.max(5, 2 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-l / 2 + 1.5, -w / 2 + 1.5, l, w);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-l / 2, -w / 2, l, w, w * 0.3);
    ctx.fill();
    ctx.fillStyle = '#151513';
    ctx.fillRect(l * 0.05, -w * 0.32, l * 0.18, w * 0.64);
    ctx.restore();
  }

  function drawTrail(trail: number[], col: string) {
    if (trail.length < 4) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i += 2) {
      i ? ctx.lineTo(X(trail[i]), Y(trail[i + 1])) : ctx.moveTo(X(trail[i]), Y(trail[i + 1]));
    }
    ctx.stroke();
  }

  function pushTrail(trail: number[], c: CarState) {
    trail.push(c.x, c.y);
    if (trail.length > 180) trail.splice(0, 2);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (trackLayer) ctx.drawImage(trackLayer, 0, 0, W, H);

    if (showPlan && phase !== 'countdown') {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(200,240,60,0.13)';
      for (const r of mpc.rollouts) {
        ctx.beginPath();
        ctx.moveTo(X(ai.x), Y(ai.y));
        for (let t = 0; t < r.length; t += 2) ctx.lineTo(X(r[t]), Y(r[t + 1]));
        ctx.stroke();
      }
      ctx.strokeStyle = '#c8f03c';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(X(ai.x), Y(ai.y));
      for (let t = 0; t < mpc.best.length; t += 2) ctx.lineTo(X(mpc.best[t]), Y(mpc.best[t + 1]));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    pushTrail(trailAi, ai);
    drawTrail(trailAi, 'rgba(255,106,43,0.35)');
    if (phase !== 'demo') {
      pushTrail(trailMe, me);
      drawTrail(trailMe, 'rgba(235,232,222,0.3)');
      drawCar(me, '#ebe8de');
    }
    drawCar(ai, '#ff6a2b');
  }

  function hud() {
    const lapOf = (c: CarState) => Math.min(LAPS, Math.max(1, Math.floor(c.s / track.length) + 1));
    if (phase === 'demo') {
      rMeLap.set('·');
      rMeTime.set('0:00.00');
      rAiLap.set('démo');
    } else {
      rMeLap.set(meFinish ? 'fini' : `${lapOf(me)}/${LAPS}`);
      rMeTime.set(fmtTime(meFinish || raceT));
      rAiLap.set(aiFinish ? 'fini' : `${lapOf(ai)}/${LAPS}`);
    }
    rAiSpeed.set(num(ai.v * 3.6));
    rMu.set(`μ ${num(mpc.muModel, 2)} · réel ${num(CAR.mu, 2)}`);
  }

  fitCanvas(canvas, layout);
  resetDemo();
  visibleLoop(ui.view, (dt) => {
    if (!W) return;
    update(dt);
    draw();
    hud();
  });
}
