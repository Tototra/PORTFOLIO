// Banc d'essai du pilote MPC, sans navigateur : node scripts/race-bench.ts
import { CAR, Mpc, Track, step } from '../src/demos/race-sim.ts';

const track = new Track();
console.log('longueur du circuit', track.length.toFixed(0), 'm');

function run(label: string, muModel: number, learning: boolean, seconds = 90) {
  const mpc = new Mpc(muModel);
  mpc.learning = learning;
  let c = track.gridSlot(8, 0);
  const dt = 1 / 60;
  let t = 0;
  let offFrames = 0;
  let vmax = 0;
  const laps: number[] = [];
  let lastLapT = 0;
  while (t < seconds) {
    const u = mpc.act(track, CAR, c, false);
    const before = c;
    c = step(track, CAR, CAR.mu, c, u, dt / 2);
    c = step(track, CAR, CAR.mu, c, u, dt / 2);
    mpc.observe(CAR, before, c, u, dt);
    t += dt;
    if (Math.abs(c.lat) > track.halfWidth) offFrames++;
    vmax = Math.max(vmax, c.v);
    if (Math.floor(c.s / track.length) > laps.length) {
      laps.push(t - lastLapT);
      lastLapT = t;
    }
  }
  console.log(label.padEnd(22), 'tours', laps.map((l) => l.toFixed(1)).join(' / ').padEnd(40), 'hors piste', (offFrames / 60).toFixed(1) + 's', 'vmax', (vmax * 3.6).toFixed(0) + 'km/h', 'mu', mpc.muModel.toFixed(2));
}

const t0 = performance.now();
run('modele exact', CAR.mu, false, 45);
console.log('ms par pas de controle', ((performance.now() - t0) / (90 * 60)).toFixed(3));
run('modele faux', CAR.mu * 2.1, false);
run('faux + apprentissage', CAR.mu * 2.1, true);

// Suivi de l'estimation de l'adhérence pendant l'apprentissage
{
  const mpc = new Mpc(CAR.mu * 2.1);
  mpc.learning = true;
  let c = track.gridSlot(8, 0);
  const trace: string[] = [];
  let off = 0;
  for (let f = 0; f < 60 * 40; f++) {
    const u = mpc.act(track, CAR, c, false);
    const before = c;
    c = step(track, CAR, CAR.mu, c, u, 1 / 120);
    c = step(track, CAR, CAR.mu, c, u, 1 / 120);
    mpc.observe(CAR, before, c, u, 1 / 60);
    if (Math.abs(c.lat) > track.halfWidth) off++;
    if (f % 120 === 0) trace.push(`${f / 60}s:${mpc.muModel.toFixed(2)}${off ? '*' : ''}`);
    off = 0;
  }
  console.log('mu estime au fil du temps (* = hors piste)', trace.join(' '));
}
