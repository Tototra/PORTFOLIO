import { h, setVars, tag } from '../lib/dom';
import { fitCanvas } from '../lib/motion';
import { blip } from '../lib/audio';
import { num, readout, screen, segmented } from '../lib/ui';
import { fr } from '../lib/typo';
import data from '../data/lre-graph.json';

// Le vrai graphe de co-publications du LRE, extrait de DBLP pendant le projet MLG.
// Anonymisé à l'export (scripts/export-lre-graph.py) : aucun nom n'est publié,
// seulement le type d'auteur, l'équipe, la communauté Louvain et les années.
// La disposition des nœuds est précalculée (ForceAtlas2) pour s'afficher instantanément.

type Node = { x: number; y: number; lre: boolean; team: number; comm: number; arrival: number };
const nodes: Node[] = data.nodes.map(([x, y, lre, team, comm, arrival]) => ({ x, y, lre: lre === 1, team, comm, arrival }));
const edges = data.edges as [number, number, number][];
const MIN_YEAR = Math.min(...edges.map((e) => e[2]));
const MAX_YEAR = Math.max(...edges.map((e) => e[2]));

// Voisins, avec l'année de première collaboration
const adj: [number, number][][] = nodes.map(() => []);
for (const [a, b, y] of edges) {
  adj[a].push([b, y]);
  adj[b].push([a, y]);
}

// Les 7 plus grandes communautés ont une couleur, les autres restent neutres
const commSize = new Map<number, number>();
nodes.forEach((n) => commSize.set(n.comm, (commSize.get(n.comm) ?? 0) + 1));
const topComms = [...commSize.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([c]) => c);

const PALETTE = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7'];
const QUERY = `SELECT DISTINCT ?name1 ?name2
WHERE {
  ?r1  a lre:Researcher ;
       lre:coAuthorOf ?mid .
  ?mid lre:coAuthorOf ?r2 .
  ?r2  a lre:Researcher .
  FILTER(?r1 != ?r2)
  FILTER NOT EXISTS { ?r1 lre:coAuthorOf ?r2 }
}`;

export function mount(host: HTMLElement) {
  const ui = screen('P.04 · Le vrai graphe du LRE', tag('DBLP · anonymisé'));
  const canvas = h('canvas', {
    role: 'img',
    'aria-label': 'Réseau de co-publications du laboratoire LRE : 1 289 auteurs et 4 219 collaborations. Cliquez sur un membre pour voir ses collaborations possibles à deux sauts.',
  });
  const tip = h('div', { class: 'gr__tip', role: 'status' });
  ui.view.classList.add('gr__view');
  ui.view.append(canvas, tip);

  let year = MAX_YEAR;
  let colorBy: 'team' | 'comm' = 'comm';
  let hover = -1;
  let selected = -1;
  let twoHop = new Set<number>();
  let playing = false;

  const rYear = readout('Année', String(year), 'volt');
  const rNodes = readout('Auteurs', '');
  const rEdges = readout('Collaborations', '');
  const rHop = readout('Q7 · pistes', '·', 'signal');

  const yearRange = h('input', {
    type: 'range',
    min: MIN_YEAR,
    max: MAX_YEAR,
    value: year,
    step: 1,
    class: 'gr__range',
    'aria-label': 'Année affichée',
  });
  yearRange.addEventListener('input', () => {
    stopPlay();
    setYear(Number(yearRange.value));
  });
  const playBtn = h('button', { type: 'button', class: 'btn btn--sm btn--signal' }, 'Rejouer 1987 → 2026');
  playBtn.addEventListener('click', () => (playing ? stopPlay() : play()));

  const colorSeg = segmented(
    'Couleurs',
    [
      { value: 'comm', label: 'Communautés Louvain' },
      { value: 'team', label: 'Équipes officielles' },
    ],
    colorBy,
    (v) => {
      colorBy = v;
      legend();
      invalidate();
    },
  );
  const legendEl = h('div', { class: 'gr__legend' });
  const queryEl = h('details', { class: 'gr__query' }, h('summary', null, tag('La requête SPARQL Q7 (projet MGD)')), h('pre', null, h('code', null, QUERY)));

  ui.controls.append(
    h('div', { class: 'gr__row' }, playBtn, yearRange),
    h('div', { class: 'readouts' }, rYear.el, rNodes.el, rEdges.el, rHop.el),
    colorSeg.el,
    legendEl,
    queryEl,
  );
  ui.caption.append(
    h('strong', null, fr('Données réelles, noms retirés. ')),
    fr('Survolez un nœud, cliquez sur un membre du labo (gros points) : les pointillés relient les membres à deux sauts avec qui il n\'a jamais publié, ce que calcule la requête Q7. Comparez les équipes officielles aux communautés trouvées par Louvain (modularité 0,847) : seule l\'équipe TIRF coïncide vraiment.'),
  );
  host.append(ui.root);

  // ------------------------------------------------------------ calcul
  const visibleNode = new Uint8Array(nodes.length);
  const degree = new Uint16Array(nodes.length);
  let nVisible = 0;
  let eVisible = 0;

  function computeVisibility() {
    visibleNode.fill(0);
    degree.fill(0);
    eVisible = 0;
    for (const [a, b, y] of edges) {
      if (y > year) continue;
      eVisible++;
      degree[a]++;
      degree[b]++;
      visibleNode[a] = 1;
      visibleNode[b] = 1;
    }
    nodes.forEach((n, i) => {
      if (n.lre && n.arrival && n.arrival <= year) visibleNode[i] = 1;
    });
    nVisible = visibleNode.reduce((a, b) => a + b, 0);
  }

  function computeTwoHop() {
    twoHop = new Set();
    if (selected < 0 || !visibleNode[selected]) return;
    const first = new Set(adj[selected].filter(([, y]) => y <= year).map(([n]) => n));
    for (const mid of first) {
      for (const [n, y] of adj[mid]) {
        if (y <= year && n !== selected && nodes[n].lre && !first.has(n)) twoHop.add(n);
      }
    }
  }

  function setYear(y: number) {
    year = y;
    yearRange.value = String(y);
    computeVisibility();
    computeTwoHop();
    invalidate();
  }

  let timer = 0;
  function play() {
    playing = true;
    playBtn.textContent = 'Pause';
    if (year >= MAX_YEAR) setYear(MIN_YEAR);
    timer = window.setInterval(() => {
      if (year >= MAX_YEAR) return stopPlay();
      setYear(year + 1);
      if (year % 5 === 0) blip(330 + (year - MIN_YEAR) * 8, 0.08, 0.1);
    }, 220);
  }
  function stopPlay() {
    if (!playing) return;
    playing = false;
    window.clearInterval(timer);
    playBtn.textContent = 'Rejouer 1987 → 2026';
  }

  // ------------------------------------------------------------ rendu
  const ctx = canvas.getContext('2d')!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let sc = 1;
  const X = (x: number) => W / 2 + x * sc;
  const Y = (y: number) => H / 2 + y * sc;
  const css = getComputedStyle(document.documentElement);
  const col = (v: string) => css.getPropertyValue(v).trim();

  function nodeColor(n: Node) {
    if (colorBy === 'team') return n.lre ? col(PALETTE[n.team % PALETTE.length]) : '#4a4944';
    const k = topComms.indexOf(n.comm);
    return k >= 0 ? col(PALETTE[k]) : '#4a4944';
  }

  function legend() {
    legendEl.replaceChildren();
    const items =
      colorBy === 'team'
        ? data.teams.map((t, i) => [t, PALETTE[i]] as const)
        : topComms.map((c, i) => [`Comm. ${i + 1} · ${commSize.get(c)} auteurs`, PALETTE[i]] as const);
    for (const [label, v] of items) {
      const sw = h('span', { class: 'gr__swatch' });
      setVars(sw, { '--sw': `var(${v})` });
      legendEl.append(h('span', { class: 'gr__key' }, sw, tag(label)));
    }
    legendEl.append(h('span', { class: 'gr__key' }, h('span', { class: 'gr__swatch gr__swatch--ext' }), tag(colorBy === 'team' ? 'Co-auteurs externes' : 'Autres communautés')));
  }

  let queued = false;
  function invalidate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const focus = selected >= 0 ? selected : hover;

    // arêtes, groupées par couleur pour ne tracer que quelques chemins
    const buckets = new Map<string, number[]>();
    for (const [a, b, y] of edges) {
      if (y > year) continue;
      let key = 'rgba(235,232,222,0.10)';
      if (colorBy === 'comm' && nodes[a].comm === nodes[b].comm && topComms.includes(nodes[a].comm)) key = nodeColor(nodes[a]);
      if (focus >= 0 && (a === focus || b === focus)) key = '#ebe8de';
      let arr = buckets.get(key);
      if (!arr) buckets.set(key, (arr = []));
      arr.push(a, b);
    }
    for (const [key, arr] of buckets) {
      ctx.strokeStyle = key;
      ctx.globalAlpha = key.startsWith('rgba') ? 1 : key === '#ebe8de' ? 0.9 : 0.28;
      ctx.lineWidth = key === '#ebe8de' ? 1.2 : 0.7;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i += 2) {
        ctx.moveTo(X(nodes[arr[i]].x), Y(nodes[arr[i]].y));
        ctx.lineTo(X(nodes[arr[i + 1]].x), Y(nodes[arr[i + 1]].y));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // pistes de collaboration à deux sauts
    if (selected >= 0 && twoHop.size) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = '#c8f03c';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const n of twoHop) {
        ctx.moveTo(X(nodes[selected].x), Y(nodes[selected].y));
        ctx.lineTo(X(nodes[n].x), Y(nodes[n].y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // nœuds : externes d'abord, membres du labo par-dessus
    for (const pass of [false, true]) {
      nodes.forEach((n, i) => {
        if (n.lre !== pass || !visibleNode[i]) return;
        const r = n.lre ? Math.min(7, 2.4 + Math.sqrt(degree[i]) * 0.55) : 1.5;
        ctx.fillStyle = nodeColor(n);
        ctx.beginPath();
        ctx.arc(X(n.x), Y(n.y), r, 0, Math.PI * 2);
        ctx.fill();
        if (n.lre) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#151513';
          ctx.stroke();
        }
        if (i === focus || twoHop.has(i)) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = i === focus ? '#ebe8de' : '#c8f03c';
          ctx.beginPath();
          ctx.arc(X(n.x), Y(n.y), r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    rYear.set(String(year));
    rNodes.set(num(nVisible));
    rEdges.set(num(eVisible));
    rHop.set(selected >= 0 ? `${twoHop.size}` : '·');
  }

  /** Les membres du labo sont prioritaires dans un rayon large : ce sont eux qu'on veut attraper. */
  function pick(e: MouseEvent) {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let bestLre = -1;
    let bestLreD = 26 * 26;
    let best = -1;
    let bestD = 10 * 10;
    nodes.forEach((n, i) => {
      if (!visibleNode[i]) return;
      const d = (X(n.x) - mx) ** 2 + (Y(n.y) - my) ** 2;
      if (n.lre && d < bestLreD) {
        bestLreD = d;
        bestLre = i;
      } else if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return { best: bestLre >= 0 ? bestLre : best, mx, my };
  }

  function showTip(i: number, mx: number, my: number) {
    if (i < 0) {
      tip.classList.remove('is-on');
      return;
    }
    const n = nodes[i];
    const lreNeighbours = adj[i].filter(([m, y]) => y <= year && nodes[m].lre).length;
    tip.replaceChildren(
      tag(n.lre ? `Membre du LRE · équipe ${data.teams[n.team] ?? '?'}` : 'Co-auteur externe'),
      h('span', null, fr(`${degree[i]} co-auteur${degree[i] > 1 ? 's' : ''} en ${year}, dont ${lreNeighbours} au labo`)),
      n.lre && i === selected ? h('span', { class: 'gr__tip-hop' }, fr(`${twoHop.size} membres à deux sauts sans publication commune`)) : '',
    );
    setVars(tip, { '--tx': `${Math.min(mx + 14, W - 230)}px`, '--ty': `${Math.max(8, my - 12)}px` });
    tip.classList.add('is-on');
  }

  canvas.addEventListener('pointermove', (e) => {
    const { best, mx, my } = pick(e);
    if (best !== hover) {
      hover = best;
      invalidate();
    }
    showTip(best, mx, my);
  });
  canvas.addEventListener('pointerleave', () => {
    hover = -1;
    tip.classList.remove('is-on');
    invalidate();
  });
  canvas.addEventListener('click', (e) => {
    const { best, mx, my } = pick(e);
    selected = best >= 0 && nodes[best].lre && best !== selected ? best : -1;
    computeTwoHop();
    if (selected >= 0) blip(520, 0.12, 0.15);
    showTip(selected >= 0 ? selected : -1, mx, my);
    invalidate();
  });

  fitCanvas(canvas, (w, hh, d) => {
    W = w;
    H = hh;
    dpr = d;
    let maxX = 0;
    let maxY = 0;
    for (const n of nodes) {
      maxX = Math.max(maxX, Math.abs(n.x));
      maxY = Math.max(maxY, Math.abs(n.y));
    }
    sc = Math.min((W / 2 - 14) / maxX, (H / 2 - 14) / maxY);
    invalidate();
  });

  legend();
  setYear(year);
}
