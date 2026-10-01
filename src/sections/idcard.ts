import { h, tag } from '../lib/dom';
import { color, onThemeChange } from '../lib/theme';
import { profile } from '../content/profile';

// Badge d'accès : la photo est tramée en 1 bit (algorithme d'Atkinson, celui
// du premier Macintosh) dans les couleurs du thème. Survol ou focus : la vraie photo.

const DITHER_W = 132;

export function idCard() {
  const canvas = h('canvas', { class: 'id__dither', 'aria-hidden': 'true' });
  const photo = h('img', {
    class: 'id__photo',
    src: '/thomas.jpg',
    alt: `Portrait de ${profile.firstName} ${profile.lastName}`,
    width: 296,
    height: 360,
    decoding: 'async',
    loading: 'lazy',
  });

  let gray: Float32Array | null = null;
  let gw = 0;
  let gh = 0;

  function render() {
    if (!gray) return;
    const buf = gray.slice();
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(gw, gh);
    // Les pixels clairs prennent toujours la plus claire des deux couleurs,
    // sinon le thème sombre donnerait un négatif.
    const a = hexToRgb(color('--ink'));
    const b = hexToRgb(color('--paper-2'));
    const lum = (c: number[]) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    const [paper, ink] = lum(a) > lum(b) ? [a, b] : [b, a];
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const old = buf[i];
        const on = old > 0.5;
        const err = (old - (on ? 1 : 0)) / 8;
        for (const [dx, dy] of [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < gw && ny < gh) buf[ny * gw + nx] += err;
        }
        const c = on ? paper : ink;
        img.data[i * 4] = c[0];
        img.data[i * 4 + 1] = c[1];
        img.data[i * 4 + 2] = c[2];
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const source = new Image();
  source.decoding = 'async';
  source.src = '/thomas.jpg';
  source.onload = () => {
    gw = DITHER_W;
    gh = Math.round((source.naturalHeight / source.naturalWidth) * gw);
    canvas.width = gw;
    canvas.height = gh;
    const off = document.createElement('canvas');
    off.width = gw;
    off.height = gh;
    const o = off.getContext('2d', { willReadFrequently: true })!;
    o.drawImage(source, 0, 0, gw, gh);
    const d = o.getImageData(0, 0, gw, gh).data;
    gray = new Float32Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) {
      const l = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      // niveaux : le fond clair devient blanc, le visage garde ses ombres
      gray[i] = Math.min(1, Math.max(0, (l - 0.18) / (0.78 - 0.18)));
    }
    render();
  };
  onThemeChange(render);

  const row = (k: string, v: string) => h('div', { class: 'id__row' }, tag(k), h('span', { class: 'id__val' }, v));

  return h(
    'figure',
    { class: 'id', tabindex: 0, 'aria-label': 'Badge : survolez pour voir la photo' },
    h('div', { class: 'id__head' }, tag('Badge d’accès'), h('span', { class: 'id__code', 'aria-hidden': 'true' })),
    h('div', { class: 'id__pic' }, canvas, photo),
    h('figcaption', { class: 'id__name' }, profile.firstName, h('br'), profile.lastName),
    h(
      'div',
      { class: 'id__rows' },
      row('Profil', 'IA · Data · Infra'),
      row('Base', `${profile.city}, France`),
      row('Langues', 'FR · EN'),
      row('Dispo', '02.2027'),
    ),
  );
}

function hexToRgb(value: string): [number, number, number] {
  const m = value.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
