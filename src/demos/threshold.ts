import { h, led, svg, tag } from '../lib/dom';
import { blip } from '../lib/audio';
import { num, pct, readout, screen } from '../lib/ui';
import { fr } from '../lib/typo';
import hist from '../data/accident-hist.json';

// Le seuil de décision comme choix métier. 10 000 accidents simulés, dont les
// scores suivent des distributions calibrées (cf. scripts/calibrate-accidents.py)
// pour reproduire les métriques réelles du projet : AUC 0,76, rappel 6 % au
// seuil 0,5 et 60 % au seuil 0,3, précision 0,34, 16,6 % d'accidents graves.

const BINS = hist.pos.length; // 50 intervalles de 0,02
const POS = hist.pos.reduce((a, b) => a + b, 0);
const NEG = hist.neg.reduce((a, b) => a + b, 0);
const TOTAL = POS + NEG;

function metricsAt(k: number) {
  // seuil = k / BINS : tout score au-dessus est classé « grave »
  let tp = 0;
  let fp = 0;
  for (let i = k; i < BINS; i++) {
    tp += hist.pos[i];
    fp += hist.neg[i];
  }
  const fn = POS - tp;
  const tn = NEG - fp;
  return {
    tp,
    fp,
    fn,
    tn,
    recall: tp / POS,
    precision: tp + fp ? tp / (tp + fp) : 0,
    accuracy: (tp + tn) / TOTAL,
    fpr: fp / NEG,
  };
}

export function mount(host: HTMLElement) {
  const ui = screen('P.02 · Le seuil est une décision', tag('10 000 accidents simulés'));
  let k = 25;

  // ------------------------------------------------------------ histogramme
  const VW = 640;
  const VH = 260;
  const pad = { l: 12, r: 12, t: 18, b: 30 };
  const mid = pad.t + (VH - pad.t - pad.b) * 0.36;
  const maxNeg = Math.max(...hist.neg);
  const bw = (VW - pad.l - pad.r) / BINS;
  const upH = mid - pad.t - 4;
  const downH = VH - pad.b - mid - 4;
  const unit = Math.min(upH / Math.max(...hist.pos), downH / maxNeg);
  const posBars: SVGRectElement[] = [];
  const negBars: SVGRectElement[] = [];
  const xOf = (i: number) => pad.l + i * bw;

  const plot = svg(
    'svg',
    { viewBox: `0 0 ${VW} ${VH}`, class: 'thr__plot', role: 'img', 'aria-label': 'Distribution des scores du modèle : accidents graves au-dessus de l’axe, non graves en dessous.' },
  );
  for (let i = 0; i < BINS; i++) {
    const hp = hist.pos[i] * unit;
    const hn = hist.neg[i] * unit;
    const rp = svg('rect', { x: xOf(i) + 0.5, y: mid - 2 - hp, width: bw - 1, height: hp, class: 'thr__bar thr__bar--pos' });
    const rn = svg('rect', { x: xOf(i) + 0.5, y: mid + 2, width: bw - 1, height: hn, class: 'thr__bar thr__bar--neg' });
    posBars.push(rp);
    negBars.push(rn);
    plot.append(rp, rn);
  }
  plot.append(
    svg('line', { x1: pad.l, x2: VW - pad.r, y1: mid, y2: mid, class: 'thr__axis' }),
    svg('text', { x: pad.l + 2, y: pad.t - 4, class: 'thr__lbl thr__lbl--pos' }, 'GRAVES (16,6 %)'),
    svg('text', { x: pad.l + 2, y: VH - pad.b + 14, class: 'thr__lbl' }, 'NON GRAVES'),
  );
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    plot.append(svg('text', { x: pad.l + t * (VW - pad.l - pad.r), y: VH - 6, class: 'thr__tick', 'text-anchor': t === 0 ? 'start' : t === 1 ? 'end' : 'middle' }, num(t, 2)));
  }
  const zone = svg('rect', { y: pad.t, height: VH - pad.t - pad.b, class: 'thr__zone' });
  const line = svg('line', { y1: pad.t - 6, y2: VH - pad.b, class: 'thr__line' });
  const handle = svg('rect', { y: pad.t - 14, width: 44, height: 16, rx: 3, class: 'thr__handle' });
  const handleTxt = svg('text', { y: pad.t - 2.5, class: 'thr__handle-txt', 'text-anchor': 'middle' });
  plot.insertBefore(zone, plot.firstChild);
  plot.append(line, handle, handleTxt);

  // ------------------------------------------------------------ ROC
  const RS = 150;
  const roc = svg('svg', { viewBox: `0 0 ${RS} ${RS}`, class: 'thr__roc', role: 'img', 'aria-label': 'Courbe ROC du modèle, AUC 0,76' });
  const pts: string[] = [];
  for (let i = BINS; i >= 0; i--) {
    const m = metricsAt(i);
    pts.push(`${(m.fpr * (RS - 20) + 14).toFixed(1)},${((1 - m.recall) * (RS - 20) + 6).toFixed(1)}`);
  }
  const rocDot = svg('circle', { r: 4.5, class: 'thr__roc-dot' });
  roc.append(
    svg('rect', { x: 14, y: 6, width: RS - 20, height: RS - 20, class: 'thr__roc-frame' }),
    svg('line', { x1: 14, y1: RS - 14, x2: RS - 6, y2: 6, class: 'thr__roc-diag' }),
    svg('polyline', { points: pts.join(' '), class: 'thr__roc-curve' }),
    svg('text', { x: RS - 8, y: RS - 18, class: 'thr__tick', 'text-anchor': 'end' }, 'AUC 0,76'),
    svg('text', { x: 10, y: RS / 2, class: 'thr__tick', transform: `rotate(-90 10 ${RS / 2})`, 'text-anchor': 'middle' }, 'rappel'),
    svg('text', { x: RS / 2 + 4, y: RS - 2, class: 'thr__tick', 'text-anchor': 'middle' }, 'faux positifs'),
    rocDot,
  );

  // ------------------------------------------------------------ matrice et lecture
  const cell = (cls: string, label: string) => {
    const v = h('span', { class: 'thr__cell-v' });
    return { el: h('div', { class: `thr__cell ${cls}` }, tag(label), v), v };
  };
  const cTP = cell('thr__cell--tp', 'graves détectés');
  const cFN = cell('thr__cell--fn', 'graves manqués');
  const cFP = cell('thr__cell--fp', 'fausses alertes');
  const cTN = cell('thr__cell--tn', 'bien ignorés');
  const matrix = h('div', { class: 'thr__matrix', 'aria-label': 'Matrice de confusion' }, cTP.el, cFN.el, cFP.el, cTN.el);

  const rRecall = readout('Rappel graves', '', 'volt');
  const rPrec = readout('Précision', '');
  const rAcc = readout('Accuracy', '', 'signal');
  const missionLed = led('off');
  const missionTxt = h('span', { class: 'thr__mission-txt' });
  const verdict = h('p', { class: 'thr__verdict', 'aria-live': 'polite' });

  const range = h('input', {
    type: 'range',
    min: 0,
    max: BINS,
    step: 1,
    value: k,
    class: 'thr__range',
    'aria-label': 'Seuil de décision',
  });

  const preset = (label: string, kk: number) =>
    h('button', { type: 'button', class: 'btn btn--sm', onclick: () => set(kk, true) }, label);

  function set(next: number, sound = false) {
    const prev = k;
    k = Math.max(0, Math.min(BINS, Math.round(next)));
    range.value = String(k);
    const t = k / BINS;
    const m = metricsAt(k);
    const x = pad.l + t * (VW - pad.l - pad.r);
    line.setAttribute('x1', String(x));
    line.setAttribute('x2', String(x));
    zone.setAttribute('x', String(x));
    zone.setAttribute('width', String(Math.max(0, VW - pad.r - x)));
    const hx = Math.min(VW - pad.r - 22, Math.max(pad.l + 22, x));
    handle.setAttribute('x', String(hx - 22));
    handleTxt.setAttribute('x', String(hx));
    handleTxt.textContent = num(t, 2);
    posBars.forEach((b, i) => b.classList.toggle('is-flagged', i >= k));
    negBars.forEach((b, i) => b.classList.toggle('is-flagged', i >= k));
    rocDot.setAttribute('cx', String(m.fpr * (RS - 20) + 14));
    rocDot.setAttribute('cy', String((1 - m.recall) * (RS - 20) + 6));

    cTP.v.textContent = num(m.tp);
    cFN.v.textContent = num(m.fn);
    cFP.v.textContent = num(m.fp);
    cTN.v.textContent = num(m.tn);
    rRecall.set(pct(m.recall));
    rPrec.set(num(m.precision, 2));
    rAcc.set(pct(m.accuracy, 1));

    const ok = m.recall >= 0.595;
    missionLed.className = `led led--${ok ? 'on' : 'warn'}`;
    const perHit = m.tp ? m.fp / m.tp : 0;
    missionTxt.textContent = ok
      ? fr(`Objectif atteint : ${pct(m.recall)} des accidents graves ont une équipe en route, au prix de ${num(perHit, 1)} fausse(s) alerte(s) par accident grave détecté.`)
      : fr(`Objectif : détecter au moins 60 % des accidents graves. Pour l'instant, ${num(m.fn)} accidents graves sur ${num(POS)} ne reçoivent personne.`);

    verdict.textContent =
      k >= BINS
        ? fr('Le modèle paresseux : il répond « pas grave » à tout. 83,4 % d\'accuracy, zéro accident grave détecté. C\'est pour ça qu\'on a jeté l\'accuracy.')
        : k === 25
          ? fr('Le seuil par défaut, 0,5 : une accuracy flatteuse, mais seulement 6 % des accidents graves détectés.')
          : k === 15
            ? fr('Notre choix, 0,3 : 60 % de rappel pour une précision de 0,34. Pour des secours, rater un accident grave coûte plus cher qu\'envoyer une équipe de trop.')
            : k === 0
              ? fr('Tout est grave : 100 % de rappel, et une ambulance pour chaque accrochage.')
              : '';
    if (sound && prev !== k) blip(200 + k * 14, 0.1, 0.06);
  }

  range.addEventListener('input', () => set(Number(range.value), true));
  const dragTo = (e: PointerEvent) => {
    const r = plot.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width * VW - pad.l) / (VW - pad.l - pad.r);
    set(t * BINS, true);
  };
  plot.addEventListener('pointerdown', (e) => {
    plot.setPointerCapture(e.pointerId);
    dragTo(e);
  });
  plot.addEventListener('pointermove', (e) => plot.hasPointerCapture(e.pointerId) && dragTo(e));

  ui.view.classList.add('thr__view');
  ui.view.append(plot, range);
  ui.controls.append(
    h('div', { class: 'thr__grid' }, matrix, roc, h('div', { class: 'readouts thr__readouts' }, rRecall.el, rPrec.el, rAcc.el)),
    h('div', { class: 'thr__mission' }, missionLed, missionTxt),
    h('div', { class: 'seg' }, tag('Seuils', 'seg-label'), preset('0,5 · défaut', 25), preset('0,3 · notre choix', 15), preset('1,0 · paresseux', 50)),
    verdict,
  );
  ui.caption.append(
    h('strong', null, fr('Données simulées, métriques réelles. ')),
    fr('Glissez le seuil sur l\'histogramme. Les scores sont tirés de distributions calibrées pour reproduire exactement les résultats du Random Forest du projet : AUC 0,76, rappel de 6 % au seuil 0,5 et de 60 % au seuil 0,3, 16,6 % d\'accidents graves.'),
  );
  host.append(ui.root);
  set(k);
}
