const G = require('./logic.js');
const n = +process.argv[2] || 10;
if (process.argv[3]) G.setSave(+process.argv[3], +process.argv[4]);
G.opt.demo = true; if (process.env.RIVAL) G.opt.rival = +process.env.RIVAL;
let fouls = 0, goals = 0, shots = 0, draws = 0, t0 = Date.now();
for (let k = 0; k < n; k++) {
  G.newGame(); let steps = 0;
  while (G.W.state !== G.S_OVER && steps < 60 * 60 * 20) { G.step(); steps++; }
  goals += G.W.score[0] + G.W.score[1]; shots += G.W.stats.shots[0] + G.W.stats.shots[1];
  if (G.W.score[0] === G.W.score[1]) draws++; fouls += G.W.stats.fouls[0] + G.W.stats.fouls[1];
  if (k < 4) console.log(`partido ${k + 1}: ${G.W.score}  tiros ${G.W.stats.shots}  ${(steps / 60).toFixed(0)} s`);
}
console.log(`goles/partido ${(goals / n).toFixed(1)} tiros ${(shots / n).toFixed(1)} acierto ${(100 * goals / shots).toFixed(0)}% empates ${draws}/${n} faltas ${(fouls/n).toFixed(1)}  (${Date.now() - t0} ms)`);
