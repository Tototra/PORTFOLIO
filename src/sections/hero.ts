import { h, led, tag } from '../lib/dom';
import { fitCanvas, reducedMotion, visibleLoop } from '../lib/motion';
import { color, onThemeChange } from '../lib/theme';
import { knob, segmented } from '../lib/ui';
import { fr } from '../lib/typo';
import { profile } from '../content/profile';
import { idCard } from './idcard';
import { blip } from '../lib/audio';

// Chaque point du nom est un paramètre qu'un optimiseur fait descendre vers sa
// cible. La perte d'un point est 0,5·‖p − cible‖², plus une « bosse » gaussienne
// autour du curseur. Les trois optimiseurs sont écrits comme dans les articles.

type Opt = 'sgd' | 'momentum' | 'adam';

const LR: Record<Opt, { min: number; max: number; def: number }> = {
  sgd: { min: 0.01, max: 2.3, def: 0.07 },
  momentum: { min: 0.002, max: 0.25, def: 0.02 },
  adam: { min: 0.2, max: 20, def: 2.4 },
};

export function hero() {
  const canvas = h('canvas', {
    class: 'hero__canvas',
    role: 'img',
    'aria-label': 'Le nom Thomas Trahant, formé de points qui convergent vers les lettres par descente de gradient.',
  });
  const spark = h('canvas', { class: 'hero__spark', 'aria-hidden': 'true' });
  const stepEl = h('span', { class: 'hero__num' }, '0');
  const lossEl = h('span', { class: 'hero__num' }, '0');
  const stateLed = led('live');
  const stateTxt = tag('en descente');

  let opt: Opt = 'momentum';
  let lr = LR[opt].def;

  const optSeg = segmented<Opt>(
    'Optimiseur',
    [
      { value: 'sgd', label: 'SGD' },
      { value: 'momentum', label: 'Momentum' },
      { value: 'adam', label: 'Adam' },
    ],
    opt,
    (v) => {
      opt = v;
      lr = LR[v].def;
      lrKnob.set(lr);
      rebuildKnobRange();
      resetState();
      scatter();
    },
  );

  let lrKnob = makeKnob();
  const knobSlot = h('div', { class: 'hero__knob' }, lrKnob.el);
  function makeKnob() {
    return knob({
      label: 'Learning rate',
      min: LR[opt].min,
      max: LR[opt].max,
      value: lr,
      log: true,
      format: (v) => (v < 0.1 ? v.toFixed(3) : v < 1 ? v.toFixed(2) : v.toFixed(1)),
      onInput: (v) => (lr = v),
    });
  }
  function rebuildKnobRange() {
    const next = makeKnob();
    knobSlot.replaceChild(next.el, lrKnob.el);
    lrKnob = next;
  }

  const shakeBtn = h('button', { type: 'button', class: 'btn btn--sm', onclick: () => shake() }, 'Secouer');
  const resetBtn = h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { resetState(); scatter(); } }, 'Disperser');

  const stage = h(
    'div',
    { class: 'hero__stage' },
    h(
      'div',
      { class: 'hero__top' },
      h(
        'div',
        { class: 'hero__meters' },
        h('span', { class: 'hero__meter' }, tag('Pas'), stepEl),
        h('span', { class: 'hero__meter' }, spark),
        h('span', { class: 'hero__meter' }, stateLed, stateTxt),
      ),
    ),
    canvas,
    h('div', { class: 'hero__controls' }, optSeg.el, knobSlot, h('div', { class: 'hero__btns' }, shakeBtn, resetBtn)),
    h(
      'p',
      { class: 'hero__hint tag' },
      fr('Passez la souris sur le nom : elle ajoute une bosse dans la fonction de perte. Montez le learning rate de SGD au-delà de 2 pour le voir diverger.'),
    ),
  );

  const section = h(
    'section',
    { id: 'top', class: 'hero', 'aria-labelledby': 'hero-title' },
    h(
      'div',
      { class: 'wrap' },
      h('h1', { id: 'hero-title', class: 'sr-only' }, `${profile.firstName} ${profile.lastName}, ${profile.headline.toLowerCase()}`),
      stage,
      h(
        'div',
        { class: 'hero__grid' },
        h(
          'div',
          { class: 'hero__intro' },
          tag(profile.school),
          h('p', { class: 'hero__motto serif' }, fr(profile.motto)),
          h('p', { class: 'hero__text' }, fr(profile.intro)),
        ),
        h(
          'div',
          { class: 'hero__status' },
          h('div', { class: 'hero__status-head' }, led('live'), tag('En recherche')),
          h('p', { class: 'hero__status-main' }, fr(profile.search.what)),
          h('p', { class: 'hero__status-sub' }, fr(`${profile.search.field}, à partir de ${profile.search.from}.`)),
          h(
            'div',
            { class: 'hero__cta' },
            h('a', { class: 'btn btn--signal', href: '#projets' }, 'Voir les projets'),
            h('a', { class: 'btn', href: '#contact' }, 'Me contacter'),
          ),
        ),
        idCard(),
      ),
    ),
  );

  // ---------------------------------------------------------------- simulation
  let W = 0;
  let H = 0;
  let dpr = 1;
  let n = 0;
  let cell = 6;
  let px = new Float32Array(0);
  let py = new Float32Array(0);
  let tx = new Float32Array(0);
  let ty = new Float32Array(0);
  let m1x = new Float32Array(0);
  let m1y = new Float32Array(0);
  let m2x = new Float32Array(0);
  let m2y = new Float32Array(0);
  let step = 0;
  let adamT = 0;
  const history: number[] = [];
  const mouse = { x: 0, y: 0, active: false };
  const ctx = canvas.getContext('2d')!;
  const sctx = spark.getContext('2d')!;
  let fontReady = false;

  function targets(): [number[], number[]] {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true })!;
    const lines = W / H > 3.2 ? [`${profile.firstName} ${profile.lastName}`.toUpperCase()] : [profile.firstName.toUpperCase(), profile.lastName.toUpperCase()];
    const family = "'Archivo Variable', 'Archivo', 'Helvetica Neue', Arial, sans-serif";
    const setFont = (size: number) => {
      o.font = `850 ${size}px ${family}`;
      if ('fontStretch' in o) (o as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = 'expanded';
    };
    setFont(100);
    const widest = Math.max(...lines.map((l) => o.measureText(l).width));
    const lineGap = 0.9;
    const size = Math.min((W * 0.985 * 100) / widest, (H * 0.9) / (lines.length * lineGap));
    setFont(size);
    o.textBaseline = 'alphabetic';
    o.fillStyle = '#000';
    const blockH = size * lineGap * lines.length;
    const top = (H - blockH) / 2;
    lines.forEach((l, i) => o.fillText(l, 0, top + size * lineGap * (i + 1) - size * 0.13));

    const data = o.getImageData(0, 0, W, H).data;
    let covered = 0;
    for (let i = 3; i < data.length; i += 4 * 9) if (data[i] > 128) covered++;
    const area = covered * 9;
    const budget = W < 640 ? 1700 : 3300;
    cell = Math.max(3, Math.round(Math.sqrt(area / budget)));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let y = Math.floor(cell / 2); y < H; y += cell) {
      for (let x = Math.floor(cell / 2); x < W; x += cell) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          xs.push(x);
          ys.push(y);
        }
      }
    }
    return [xs, ys];
  }

  function build() {
    if (!W || !fontReady) return;
    const [xs, ys] = targets();
    const old = { px, py, n };
    n = xs.length;
    tx = Float32Array.from(xs);
    ty = Float32Array.from(ys);
    px = new Float32Array(n);
    py = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (old.n) {
        const j = i % old.n;
        px[i] = old.px[j];
        py[i] = old.py[j];
      } else if (reducedMotion()) {
        px[i] = tx[i];
        py[i] = ty[i];
      } else {
        px[i] = Math.random() * W;
        py[i] = Math.random() * H;
      }
    }
    resetState();
  }

  function resetState() {
    m1x = new Float32Array(n);
    m1y = new Float32Array(n);
    m2x = new Float32Array(n);
    m2y = new Float32Array(n);
    adamT = 0;
    step = 0;
    history.length = 0;
  }

  function scatter() {
    for (let i = 0; i < n; i++) {
      px[i] = Math.random() * W;
      py[i] = Math.random() * H;
    }
    blip(330, 0.1, 0.2);
  }

  function shake() {
    for (let i = 0; i < n; i++) {
      px[i] += (Math.random() - 0.5) * 120;
      py[i] += (Math.random() - 0.5) * 120;
    }
    blip(520, 0.1, 0.12);
  }

  function update() {
    const sigma = Math.max(38, W * 0.045);
    const s2 = 2 * sigma * sigma;
    const amp = 2.4 * sigma;
    const reach = 9 * sigma * sigma;
    const b1 = 0.9;
    const b2 = 0.99;
    adamT++;
    const c1 = 1 - Math.pow(b1, adamT);
    const c2 = 1 - Math.pow(b2, adamT);
    const bound = Math.max(W, H) * 4;
    let loss = 0;

    for (let i = 0; i < n; i++) {
      let gx = px[i] - tx[i];
      let gy = py[i] - ty[i];
      loss += 0.5 * (gx * gx + gy * gy);
      if (mouse.active) {
        const dx = px[i] - mouse.x;
        const dy = py[i] - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach) {
          const e = Math.exp(-d2 / s2);
          // dérivée de amp·σ·exp(−d²/2σ²) : pousse le point hors de la bosse
          gx -= (amp * e * dx) / sigma;
          gy -= (amp * e * dy) / sigma;
        }
      }
      if (opt === 'sgd') {
        px[i] -= lr * gx;
        py[i] -= lr * gy;
      } else if (opt === 'momentum') {
        m1x[i] = 0.9 * m1x[i] + gx;
        m1y[i] = 0.9 * m1y[i] + gy;
        px[i] -= lr * m1x[i];
        py[i] -= lr * m1y[i];
      } else {
        m1x[i] = b1 * m1x[i] + (1 - b1) * gx;
        m1y[i] = b1 * m1y[i] + (1 - b1) * gy;
        m2x[i] = b2 * m2x[i] + (1 - b2) * gx * gx;
        m2y[i] = b2 * m2y[i] + (1 - b2) * gy * gy;
        px[i] -= (lr * (m1x[i] / c1)) / (Math.sqrt(m2x[i] / c2) + 1e-8);
        py[i] -= (lr * (m1y[i] / c1)) / (Math.sqrt(m2y[i] / c2) + 1e-8);
      }
      // Garde-fou numérique : un SGD qui diverge ne doit pas produire de NaN.
      if (!(Math.abs(px[i]) < bound)) px[i] = Math.sign(px[i] || 1) * bound;
      if (!(Math.abs(py[i]) < bound)) py[i] = Math.sign(py[i] || 1) * bound;
    }
    step++;
    return n ? loss / n : 0;
  }

  function draw(loss: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const size = Math.max(2, cell * 0.66);
    const half = size / 2;
    const ink = color('--ink');
    const hot = color('--signal');
    ctx.fillStyle = ink;
    for (let i = 0; i < n; i++) {
      const dx = px[i] - tx[i];
      const dy = py[i] - ty[i];
      if (dx * dx + dy * dy <= 16) ctx.fillRect(px[i] - half, py[i] - half, size, size);
    }
    ctx.fillStyle = hot;
    for (let i = 0; i < n; i++) {
      const dx = px[i] - tx[i];
      const dy = py[i] - ty[i];
      if (dx * dx + dy * dy > 16) ctx.fillRect(px[i] - half, py[i] - half, size, size);
    }

    // Courbe de loss, en échelle log
    history.push(Math.log10(loss + 1e-3));
    if (history.length > 160) history.shift();
    const sw = spark.width;
    const sh = spark.height;
    sctx.clearRect(0, 0, sw, sh);
    sctx.strokeStyle = hot;
    sctx.lineWidth = 1.5 * dpr;
    sctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / 159) * sw;
      const y = sh - ((v + 3) / 9) * sh;
      i ? sctx.lineTo(x, Math.max(1, Math.min(sh - 1, y))) : sctx.moveTo(x, y);
    });
    sctx.stroke();

    stepEl.textContent = String(step).padStart(5, '0');
    lossEl.textContent = loss < 1e6 ? loss.toExponential(1).replace('e+', 'e') : '∞';
    const diverging = loss > 1e5;
    const converged = loss < 0.6;
    stateLed.className = `led led--${diverging ? 'warn' : converged ? 'on' : 'live'}`;
    stateTxt.textContent = diverging ? 'diverge' : converged ? 'convergé' : 'en descente';
  }

  fitCanvas(canvas, (w, hh, d) => {
    W = w;
    H = hh;
    dpr = d;
    build();
  });
  fitCanvas(spark, () => {});

  document.fonts.load("850 100px 'Archivo Variable'").finally(() => {
    fontReady = true;
    build();
  });

  const pointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
  };
  canvas.addEventListener('pointermove', pointer);
  canvas.addEventListener('pointerdown', pointer);
  canvas.addEventListener('pointerleave', () => (mouse.active = false));
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') mouse.active = false;
  });

  visibleLoop(canvas, () => {
    if (!n) return;
    draw(update());
  });
  onThemeChange(() => n && draw(0));

  return section;
}
