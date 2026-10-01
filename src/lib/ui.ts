import { h, led, setVars, tag, type Child } from './dom';
import { blip } from './audio';

/** Le panneau sombre qui accueille une démo. */
export function screen(title: string, meta: Child = null) {
  const status = led('on');
  const bar = h('div', { class: 'screen__bar' }, status, tag(title, 'screen__title'), h('span', { class: 'spacer' }), meta);
  const view = h('div', { class: 'screen__view' });
  const controls = h('div', { class: 'screen__controls' });
  const caption = h('p', { class: 'screen__caption' });
  const root = h('div', { class: 'screen' }, bar, view, controls, caption);
  return { root, bar, view, controls, caption, status };
}

export function readout(label: string, value = '', variant: '' | 'signal' | 'volt' = '') {
  const v = h('span', { class: 'readout__value' }, value);
  const el = h('div', { class: `readout ${variant ? `readout--${variant}` : ''}`.trim() }, tag(label), v);
  let last = value;
  return {
    el,
    set(next: string) {
      if (next !== last) {
        v.textContent = next;
        last = next;
      }
    },
  };
}

/** Choix exclusif entre quelques options, en boutons « enfoncés ». */
export function segmented<T extends string>(
  label: string,
  options: { value: T; label: string }[],
  initial: T,
  onChange: (value: T) => void,
) {
  let current = initial;
  const buttons = options.map((opt) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--sm',
        'aria-pressed': String(opt.value === initial),
        onclick: () => select(opt.value, true),
      },
      opt.label,
    ),
  );
  function select(value: T, fromUser = false) {
    current = value;
    options.forEach((opt, i) => buttons[i].setAttribute('aria-pressed', String(opt.value === value)));
    if (fromUser) {
      blip(660, 0.08, 0.08);
      onChange(value);
    }
  }
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': label }, tag(label, 'seg-label'), buttons);
  return { el, select, get value() { return current; } };
}

export function toggle(label: string, initial: boolean, onChange: (on: boolean) => void) {
  let on = initial;
  const b = h('button', { type: 'button', class: 'btn btn--sm', 'aria-pressed': String(on) }, label);
  b.addEventListener('click', () => {
    on = !on;
    b.setAttribute('aria-pressed', String(on));
    blip(on ? 880 : 440, 0.08, 0.08);
    onChange(on);
  });
  return { el: b, get on() { return on; } };
}

interface KnobOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  /** Échelle logarithmique : utile pour un learning rate. */
  log?: boolean;
  format: (v: number) => string;
  onInput: (v: number) => void;
}

/** Bouton rotatif : glisser verticalement, ou flèches du clavier. */
export function knob(o: KnobOptions) {
  const toT = (v: number) => (o.log ? Math.log(v / o.min) / Math.log(o.max / o.min) : (v - o.min) / (o.max - o.min));
  const fromT = (t: number) => (o.log ? o.min * Math.pow(o.max / o.min, t) : o.min + t * (o.max - o.min));
  let t = toT(o.value);

  const dial = h('span', { class: 'knob__dial', 'aria-hidden': 'true' });
  const valueEl = h('span', { class: 'knob__value' });
  const el = h(
    'div',
    { class: 'knob', role: 'slider', tabindex: 0, 'aria-label': o.label },
    dial,
    h('span', { class: 'knob__text' }, tag(o.label), valueEl),
  );

  function set(nextT: number, emit = true) {
    t = Math.min(1, Math.max(0, nextT));
    const v = fromT(t);
    setVars(dial, { '--angle': `${-135 + t * 270}deg` });
    valueEl.textContent = o.format(v);
    el.setAttribute('aria-valuemin', String(o.min));
    el.setAttribute('aria-valuemax', String(o.max));
    el.setAttribute('aria-valuenow', v.toPrecision(3));
    el.setAttribute('aria-valuetext', o.format(v));
    if (emit) o.onInput(v);
  }

  let startY = 0;
  let startT = 0;
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startT = t;
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    set(startT + (startY - e.clientY) / 160);
  });
  el.addEventListener('keydown', (e) => {
    const steps: Record<string, number> = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05, PageUp: 0.2, PageDown: -0.2 };
    if (e.key in steps) set(t + steps[e.key]);
    else if (e.key === 'Home') set(0);
    else if (e.key === 'End') set(1);
    else return;
    e.preventDefault();
  });

  set(t, false);
  return { el, set: (v: number) => set(toT(v), false) };
}

/** Nombre au format français, avec virgule décimale. */
export function num(v: number, digits = 0) {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(v: number, digits = 0) {
  return `${num(v * 100, digits)} %`;
}
