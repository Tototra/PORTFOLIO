import { clear, h, led, tag } from '../lib/dom';
import { num, screen, segmented, toggle } from '../lib/ui';
import { fr } from '../lib/typo';

// Les garde-fous du correcteur T5, portés depuis grammar_corrector.py.
// Le découpage, les bornes de longueur et le blocage des répétitions s'exécutent
// vraiment ici. Seules les sorties brutes du modèle sont écrites à l'avance :
// 220 millions de paramètres ne tiennent pas dans une page web.

const ABBREV = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|approx|dept|est|no|vol)\.$/i;

/** Même algorithme que _sentence_split : on coupe après . ! ? sauf derrière une abréviation. */
export function sentenceSplit(text: string): string[] {
  const parts = text.split(/(?<=[.!?…]) +/);
  const out: string[] = [];
  let buf = '';
  for (const part of parts) {
    if (buf) {
      if (ABBREV.test(buf.trimEnd())) {
        buf = `${buf} ${part}`;
        continue;
      }
      out.push(buf);
      buf = part;
    } else buf = part;
  }
  if (buf) out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

interface Sample {
  label: string;
  input: string;
  /** La correction attendue, pour savoir si quelque chose a été inventé. */
  clean: string;
  /** Ce que T5 génère sans contrainte pour chaque morceau possible. */
  raw: Record<string, string>;
}

const SAMPLES: Record<'email' | 'phrase', Sample> = {
  email: {
    label: 'Un email',
    input:
      'Dear Dr. Martin, many thanks for you quick answer. I has read the document yesterday and their is a few points to discuss. Could we meets on thursday? Best regards, Thomas',
    clean:
      'Dear Dr. Martin, many thanks for your quick answer. I read the document yesterday and there are a few points to discuss. Could we meet on Thursday? Best regards, Thomas',
    raw: {
      'Dear Dr. Martin, many thanks for you quick answer. I has read the document yesterday and their is a few points to discuss. Could we meets on thursday? Best regards, Thomas':
        'Dear Dr. Martin, many thanks for your quick answer. I read the document yesterday and there are a few points to discuss. Could we meet on Thursday? Best regards, Thomas. I want to thank you for your kind words and I look forward to hearing from you. I look forward to hearing from you.',
      'Dear Dr. Martin, many thanks for you quick answer.': 'Dear Dr. Martin, many thanks for your quick answer.',
      'I has read the document yesterday and their is a few points to discuss.':
        'I read the document yesterday and there are a few points to discuss.',
      'Could we meets on thursday?': 'Could we meet on Thursday? Could we meet on Thursday?',
      'Best regards, Thomas': 'Best regards, Thomas. I want to thank you for your kind words.',
    },
  },
  phrase: {
    label: 'Une phrase du dataset',
    input: 'She have completed her homework.',
    clean: 'She has completed her homework.',
    raw: { 'She have completed her homework.': 'She has completed her homework.' },
  },
};

const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** no_repeat_ngram_size=3 : un trigramme déjà produit ne peut pas réapparaître ; ici, la génération s'arrête là où la répétition commencerait. */
function blockRepeats(text: string) {
  const w = words(text);
  const seen = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) {
    const tri = w.slice(i, i + 3).join(' ').toLowerCase();
    if (seen.has(tri)) return { text: w.slice(0, i).join(' '), blocked: true };
    seen.add(tri);
  }
  return { text, blocked: false };
}

interface ChunkResult {
  input: string;
  raw: string;
  output: string;
  notes: { kind: 'ok' | 'warn' | 'cut'; text: string }[];
}

function correctChunk(sample: Sample, chunk: string, g: Guards): ChunkResult {
  const raw = sample.raw[chunk] ?? chunk;
  let out = raw;
  const notes: ChunkResult['notes'] = [];
  if (g.noRepeat) {
    const r = blockRepeats(out);
    if (r.blocked) notes.push({ kind: 'cut', text: 'répétition bloquée (trigramme déjà produit)' });
    out = r.text;
  }
  const nIn = words(chunk).length;
  if (g.cap) {
    const maxOut = Math.max(nIn + 8, Math.floor(nIn * 1.3));
    const w = words(out);
    if (w.length > maxOut) {
      out = w.slice(0, maxOut).join(' ');
      notes.push({ kind: 'cut', text: `génération bornée à ${maxOut} mots` });
    }
  }
  if (g.reject) {
    const ratio = words(out).length / nIn;
    if (ratio > 1.4) {
      notes.push({ kind: 'warn', text: `sortie ${num(ratio, 1)}× plus longue : rejetée, texte original conservé` });
      out = chunk;
    }
  }
  if (!notes.length) notes.push({ kind: 'ok', text: 'accepté' });
  return { input: chunk, raw, output: out, notes };
}

interface Guards {
  split: boolean;
  cap: boolean;
  reject: boolean;
  noRepeat: boolean;
}

/** Diff mot à mot par plus longue sous-séquence commune. */
function diff(a: string[], b: string[]) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: { t: 'same' | 'del' | 'add'; w: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: 'same', w: a[i++] });
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ t: 'del', w: a[i++] });
    else ops.push({ t: 'add', w: b[j++] });
  }
  while (i < n) ops.push({ t: 'del', w: a[i++] });
  while (j < m) ops.push({ t: 'add', w: b[j++] });
  return ops;
}

export function mount(host: HTMLElement) {
  const ui = screen('P.03 · Garde-fous de décodage', tag('T5-Base · BLEU 86,79'));
  let sampleId: keyof typeof SAMPLES = 'email';
  const guards: Guards = { split: true, cap: true, reject: true, noRepeat: true };

  const pipeline = h('ol', { class: 'gm__pipe', 'aria-label': 'Étapes du traitement' });
  const chunksEl = h('div', { class: 'gm__chunks' });
  const outEl = h('p', { class: 'gm__out', 'aria-live': 'polite' });
  const statusEl = h('p', { class: 'gm__status' });

  const sampleSeg = segmented(
    'Entrée',
    (Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((k) => ({ value: k, label: SAMPLES[k].label })),
    sampleId,
    (v) => {
      sampleId = v;
      run();
    },
  );
  const tg = (label: string, key: keyof Guards) => toggle(label, guards[key], (on) => {
    guards[key] = on;
    run();
  }).el;

  function run() {
    const s = SAMPLES[sampleId];
    const chunks = guards.split ? sentenceSplit(s.input) : [s.input];
    const results = chunks.map((c) => correctChunk(s, c, guards));
    const final = results.map((r) => r.output).join(' ');

    clear(pipeline);
    const stage = (label: string, value: string, state: 'on' | 'warn' | 'off' = 'on') =>
      h('li', { class: 'gm__stage' }, led(state), h('span', null, tag(label), h('b', null, value)));
    const rejected = results.filter((r) => r.notes.some((n) => n.kind === 'warn')).length;
    const cut = results.filter((r) => r.notes.some((n) => n.kind === 'cut')).length;
    pipeline.append(
      stage('Découpage', guards.split ? `${chunks.length} morceau${chunks.length > 1 ? 'x' : ''}` : 'désactivé', guards.split ? 'on' : 'off'),
      stage('T5', `${chunks.length} appel${chunks.length > 1 ? 's' : ''}`),
      stage('Bornes', `${cut} coupé${cut > 1 ? 's' : ''}`, guards.cap || guards.noRepeat ? 'on' : 'off'),
      stage('Rejet +40 %', `${rejected} rejeté${rejected > 1 ? 's' : ''}`, guards.reject ? (rejected ? 'warn' : 'on') : 'off'),
    );

    clear(chunksEl);
    results.forEach((r, i) => {
      chunksEl.append(
        h(
          'div',
          { class: 'gm__chunk' },
          h('div', { class: 'gm__chunk-head' }, tag(`Morceau ${i + 1}`), ...r.notes.map((n) => h('span', { class: `gm__note gm__note--${n.kind}` }, fr(n.text)))),
          h('p', { class: 'gm__line' }, tag('entrée'), h('span', null, r.input)),
          h('p', { class: 'gm__line gm__line--raw' }, tag('T5 brut'), h('span', null, r.raw)),
        ),
      );
    });

    clear(outEl);
    for (const op of diff(words(s.input), words(final))) {
      outEl.append(h('span', { class: `gm__w gm__w--${op.t}` }, op.w), ' ');
    }
    const invented = words(final).length > words(s.clean).length;
    const perfect = final === s.clean;
    statusEl.className = `gm__status ${invented ? 'is-bad' : perfect ? 'is-good' : 'is-meh'}`;
    statusEl.textContent = invented
      ? fr('Hallucination : le modèle a ajouté des mots qui n\'étaient pas dans le texte.')
      : perfect
        ? fr('Sortie propre : les fautes sont corrigées, et rien n\'a été inventé.')
        : fr('Rien d\'inventé, mais un morceau rejeté par prudence est resté sans correction.');
  }

  ui.view.classList.add('gm__view');
  ui.view.append(pipeline, chunksEl, h('div', { class: 'gm__result' }, tag('Sortie finale, comparée à l’entrée'), outEl, statusEl));
  ui.controls.append(
    sampleSeg.el,
    h('div', { class: 'seg' }, tag('Garde-fous', 'seg-label'), tg('Phrase par phrase', 'split'), tg('Borne 1,3×', 'cap'), tg('Rejet +40 %', 'reject'), tg('Anti-répétition', 'noRepeat')),
  );
  ui.caption.append(
    h('strong', null, fr('Coupez les garde-fous un par un. ')),
    fr('Sans découpage, les bornes ne suffisent plus : l\'hallucination passe sous le seuil de 40 %. Le découpage (qui ne coupe pas après « Dr. »), les bornes et l\'anti-répétition s\'exécutent réellement ici, avec la logique du projet. Les sorties brutes de T5, elles, sont écrites pour reproduire le comportement observé pendant le projet.'),
  );
  host.append(ui.root);
  run();
}
