// Physique, circuit et contrôleur de la démo « course contre le MPC ».
// Module pur (aucun DOM) : il se teste en ligne de commande, cf. scripts/race-bench.ts.

export const G = 9.81;

export interface CarParams {
  wheelbase: number;
  accel: number;
  brake: number;
  vTop: number;
  mu: number;
  steerMax: number;
}

export const CAR: CarParams = {
  wheelbase: 2.6,
  accel: 11,
  brake: 18,
  vTop: 46,
  mu: 1.25,
  steerMax: 0.5,
};

export interface CarState {
  x: number;
  y: number;
  psi: number;
  v: number;
  idx: number;
  /** Abscisse curviligne cumulée (ne revient pas à 0 à chaque tour). */
  s: number;
  lat: number;
}

export interface Control {
  steer: number;
  throttle: number;
}

// ---------------------------------------------------------------------------
// Circuit : une boucle fermée déformée par quelques harmoniques
// ---------------------------------------------------------------------------

export class Track {
  readonly n: number;
  readonly cx: Float64Array;
  readonly cy: Float64Array;
  readonly tx: Float64Array;
  readonly ty: Float64Array;
  readonly cum: Float64Array;
  readonly length: number;
  readonly halfWidth = 7;

  constructor(n = 720) {
    this.n = n;
    this.cx = new Float64Array(n);
    this.cy = new Float64Array(n);
    this.tx = new Float64Array(n);
    this.ty = new Float64Array(n);
    this.cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const r = 1 + 0.17 * Math.sin(2 * t + 0.6) + 0.11 * Math.sin(3 * t + 1.9) + 0.05 * Math.sin(5 * t + 0.4);
      this.cx[i] = 104 * r * Math.cos(t);
      this.cy[i] = 60 * r * Math.sin(t);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = this.cx[j] - this.cx[i];
      const dy = this.cy[j] - this.cy[i];
      const d = Math.hypot(dx, dy);
      this.tx[i] = dx / d;
      this.ty[i] = dy / d;
      this.cum[i + 1] = this.cum[i] + d;
    }
    this.length = this.cum[n];
  }

  /** Point le plus proche, cherché autour d'un indice connu (le circuit est parcouru en continu). */
  project(x: number, y: number, hint: number, window = 14) {
    let best = hint;
    let bestD = Infinity;
    for (let k = -window; k <= window; k++) {
      const i = (((hint + k) % this.n) + this.n) % this.n;
      const dx = x - this.cx[i];
      const dy = y - this.cy[i];
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const dx = x - this.cx[best];
    const dy = y - this.cy[best];
    const along = dx * this.tx[best] + dy * this.ty[best];
    const lat = this.tx[best] * dy - this.ty[best] * dx;
    return { idx: best, along, lat };
  }

  /** Recherche globale, pour l'initialisation. */
  nearest(x: number, y: number) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.n; i++) {
      const d = (x - this.cx[i]) ** 2 + (y - this.cy[i]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Position sur la grille de départ : `back` mètres avant la ligne, décalée latéralement. */
  gridSlot(back: number, lat: number): CarState {
    let i = this.n - 1;
    while (i > 0 && this.length - this.cum[i] < back) i--;
    const x = this.cx[i] - this.ty[i] * lat;
    const y = this.cy[i] + this.tx[i] * lat;
    return { x, y, psi: Math.atan2(this.ty[i], this.tx[i]), v: 0, idx: i, s: this.cum[i] - this.length, lat };
  }
}

// ---------------------------------------------------------------------------
// Dynamique : modèle bicyclette cinématique + limite d'adhérence
// ---------------------------------------------------------------------------

export function steerLimit(p: CarParams, v: number) {
  return p.steerMax / (1 + v / 25);
}

/** Taux de lacet effectif : saturé en douceur par l'adhérence (tanh). */
export function yawRate(p: CarParams, mu: number, v: number, steer: number) {
  const cmd = (v * Math.tan(steer)) / p.wheelbase;
  const lim = (mu * G) / Math.max(v, 1);
  return lim * Math.tanh(cmd / lim);
}

export function step(track: Track, p: CarParams, mu: number, c: CarState, u: Control, dt: number, offTrackMu = true): CarState {
  const hw = track.halfWidth;
  const off = Math.abs(c.lat) > hw;
  const muEff = off && offTrackMu ? mu * 0.55 : mu;
  const lim = steerLimit(p, c.v);
  const steer = Math.max(-lim, Math.min(lim, u.steer));
  const th = Math.max(-1, Math.min(1, u.throttle));
  let a = th >= 0 ? th * p.accel * (1 - c.v / p.vTop) : th * p.brake;
  a -= 0.012 * c.v; // roulement et air
  if (off) a -= 0.9 * c.v; // herbe
  const w = yawRate(p, muEff, c.v, steer);
  const psi = c.psi + w * dt;
  let v = Math.max(0, c.v + a * dt);
  let x = c.x + c.v * Math.cos(c.psi) * dt;
  let y = c.y + c.v * Math.sin(c.psi) * dt;
  let pr = track.project(x, y, c.idx);
  // Mur au-delà de l'herbe : on ne coupe pas le circuit
  const wall = hw + 5;
  if (Math.abs(pr.lat) > wall) {
    const k = pr.idx;
    const lat = Math.sign(pr.lat) * wall;
    x = track.cx[k] + pr.along * track.tx[k] - track.ty[k] * lat;
    y = track.cy[k] + pr.along * track.ty[k] + track.tx[k] * lat;
    v *= 0.6;
    pr = track.project(x, y, k);
  }
  const ds = arcDelta(track, c.idx, pr.idx);
  return { x, y, psi, v, idx: pr.idx, s: c.s + ds, lat: pr.lat };
}

/** Progression le long du circuit entre deux indices, en gérant le passage de la ligne. */
function arcDelta(track: Track, from: number, to: number) {
  let d = track.cum[to] - track.cum[from];
  if (d < -track.length / 2) d += track.length;
  if (d > track.length / 2) d -= track.length;
  return d;
}

// ---------------------------------------------------------------------------
// Contrôleur prédictif par échantillonnage (MPPI)
// ---------------------------------------------------------------------------

export interface MpcConfig {
  horizon: number;
  dt: number;
  samples: number;
  lambda: number;
  sigmaSteer: number;
  sigmaThrottle: number;
}

export const MPC_DEFAULT: MpcConfig = {
  horizon: 22,
  dt: 0.07,
  samples: 48,
  lambda: 2.5,
  sigmaSteer: 0.12,
  sigmaThrottle: 0.6,
};

function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

export class Mpc {
  readonly cfg: MpcConfig;
  /** Séquence de commandes courante (warm start d'un pas à l'autre). */
  plan: Control[];
  /** Adhérence que le contrôleur croit avoir : c'est son modèle interne. */
  muModel: number;
  learning = false;
  /** Trajectoires simulées au dernier pas, pour l'affichage. */
  rollouts: Float32Array[] = [];
  best: Float32Array = new Float32Array(0);
  private lastSteer = 0;

  constructor(muModel: number, cfg: MpcConfig = MPC_DEFAULT) {
    this.cfg = cfg;
    this.muModel = muModel;
    this.plan = Array.from({ length: cfg.horizon }, () => ({ steer: 0, throttle: 0.6 }));
  }

  reset(muModel: number) {
    this.muModel = muModel;
    this.plan = Array.from({ length: this.cfg.horizon }, () => ({ steer: 0, throttle: 0.6 }));
  }

  private rollout(track: Track, p: CarParams, s0: CarState, seq: Control[], trace: Float32Array | null) {
    const hw = track.halfWidth;
    let c = s0;
    let cost = 0;
    let prev = this.lastSteer;
    for (let t = 0; t < seq.length; t++) {
      c = step(track, p, this.muModel, c, seq[t], this.cfg.dt);
      const a = Math.abs(c.lat);
      if (a > hw - 1.2) cost += 3 * (a - (hw - 1.2)) ** 2;
      if (a > hw) cost += 4;
      // rester aligné avec la piste : sans ce terme, il finit parfois face au bas-côté
      const heading = Math.atan2(track.ty[c.idx], track.tx[c.idx]);
      cost += 1.5 * (1 - Math.cos(c.psi - heading));
      // rester à l'arrêt ne doit jamais être la solution la moins chère
      if (c.v < 10) cost += 0.5 * (10 - c.v);
      cost += 3 * (seq[t].steer - prev) ** 2;
      prev = seq[t].steer;
      if (trace) {
        trace[t * 2] = c.x;
        trace[t * 2 + 1] = c.y;
      }
    }
    cost -= 2 * (c.s - s0.s);
    return cost;
  }

  /**
   * Un pas de contrôle : on perturbe le plan courant, on simule chaque variante
   * avec le modèle interne, puis on moyenne les variantes pondérées par exp(−coût/λ).
   */
  act(track: Track, p: CarParams, state: CarState, keepTraces = true): Control {
    const { horizon: H, samples: K, sigmaSteer, sigmaThrottle, lambda } = this.cfg;
    const seqs: Control[][] = [];
    const costs = new Float64Array(K);
    const lim = steerLimit(p, state.v);
    if (keepTraces && this.rollouts.length !== K) this.rollouts = Array.from({ length: K }, () => new Float32Array(H * 2));
    for (let k = 0; k < K; k++) {
      let es = 0;
      let et = 0;
      const seq: Control[] = new Array(H);
      for (let t = 0; t < H; t++) {
        // bruit corrélé dans le temps : des manœuvres plausibles plutôt que du grésillement
        if (k > 0) {
          es = 0.65 * es + 0.35 * gauss() * sigmaSteer * 2;
          et = 0.65 * et + 0.35 * gauss() * sigmaThrottle * 2;
        }
        const base = this.plan[t];
        seq[t] = {
          // projection sur les bornes physiques : hors butée, le bruit n'aurait plus d'effet
          steer: Math.max(-lim, Math.min(lim, base.steer + es)),
          throttle: Math.max(-1, Math.min(1, base.throttle + et)),
        };
      }
      // une variante « freinage » garde toujours une option prudente
      if (k === 1) for (let t = 0; t < H; t++) seq[t] = { steer: seq[t].steer, throttle: -0.6 };
      seqs.push(seq);
      costs[k] = this.rollout(track, p, state, seq, keepTraces ? this.rollouts[k] : null);
    }
    let min = Infinity;
    for (let k = 0; k < K; k++) min = Math.min(min, costs[k]);
    let wsum = 0;
    const next: Control[] = Array.from({ length: H }, () => ({ steer: 0, throttle: 0 }));
    for (let k = 0; k < K; k++) {
      const w = Math.exp(-(costs[k] - min) / lambda);
      wsum += w;
      for (let t = 0; t < H; t++) {
        next[t].steer += w * seqs[k][t].steer;
        next[t].throttle += w * seqs[k][t].throttle;
      }
    }
    for (let t = 0; t < H; t++) {
      next[t].steer /= wsum;
      next[t].throttle /= wsum;
    }
    if (keepTraces) {
      if (this.best.length !== H * 2) this.best = new Float32Array(H * 2);
      this.rollout(track, p, state, next, this.best);
    }
    const u = next[0];
    // warm start : le plan est décalé d'un pas pour le prochain appel
    this.plan = [...next.slice(1), { ...next[H - 1] }];
    this.lastSteer = u.steer;
    return u;
  }

  /**
   * Apprentissage en ligne du modèle : on compare le lacet prédit au lacet mesuré
   * et on corrige l'adhérence supposée par descente de gradient sur l'erreur au carré.
   */
  observe(p: CarParams, before: CarState, after: CarState, u: Control, dt: number) {
    if (!this.learning || before.v < 6 || Math.abs(before.lat) > 7) return;
    const measured = angleDiff(after.psi, before.psi) / dt;
    const lim = steerLimit(p, before.v);
    const steer = Math.max(-lim, Math.min(lim, u.steer));
    const cmd = (before.v * Math.tan(steer)) / p.wheelbase;
    const limHat = (this.muModel * G) / before.v;
    const z = cmd / limHat;
    const pred = limHat * Math.tanh(z);
    const sech2 = 1 / Math.cosh(z) ** 2;
    const dPred = (G / before.v) * (Math.tanh(z) - z * sech2);
    const err = pred - measured;
    this.muModel -= 0.1 * err * dPred;
    this.muModel = Math.max(0.4, Math.min(3, this.muModel));
  }
}

export function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
