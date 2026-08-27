import { MODES } from './modes.js';
import { getSave } from './save.js';

// Title / pause / results screens. Owns which screen shows; the game loop
// only runs when state === 'ingame'.
export function createMenu({ game, world, requestLock, releaseLock }) {
  const titleEl = document.getElementById('title');
  const pauseEl = document.getElementById('pause');
  const resultsEl = document.getElementById('results');
  const modeList = document.getElementById('modelist');
  let state = 'title'; // title | ingame | paused | results

  function fmtT(t) { return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }

  function renderTitle() {
    const best = getSave().best;
    modeList.innerHTML = '';
    for (const m of Object.values(MODES)) {
      const b = best[m.id];
      const el = document.createElement('div');
      el.className = 'modebtn';
      el.innerHTML = `<span class="ic">${m.icon}</span><span><span class="nm">${m.name}</span><br><span class="tg">${m.tagline}</span></span>
        <span class="bst">${b ? `best ${b.score}<br>grade ${b.grade}` : 'not played'}</span>`;
      el.onclick = () => start(m.id);
      modeList.appendChild(el);
    }
  }

  function show(which) {
    titleEl.style.display = which === 'title' ? 'flex' : 'none';
    pauseEl.style.display = which === 'paused' ? 'flex' : 'none';
    resultsEl.style.display = which === 'results' ? 'flex' : 'none';
    if (which !== null) {
      for (const id of ['list', 'timer', 'score', 'prompt', 'banner']) document.getElementById(id).style.display = 'none';
    }
  }

  function start(modeId) {
    game.startRun(modeId);
    state = 'ingame';
    show(null);
    requestLock();
  }

  function toTitle() {
    state = 'title';
    renderTitle();
    show('title');
    releaseLock();
  }

  function showPause() {
    if (state !== 'ingame') return;
    state = 'paused';
    const s = game.state;
    document.getElementById('pausestats').textContent =
      `${game.mode.name} · score ${s.score} · ${game.mode.timer === 'down' ? fmtT(s.time) + ' left' : fmtT(s.time)}`;
    show('paused');
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'ingame';
    show(null);
    requestLock();
  }

  function showResults(r) {
    state = 'results';
    releaseLock();
    document.getElementById('resmode').textContent = `${r.mode.icon} ${r.mode.name}`;
    const g = document.getElementById('grade');
    g.textContent = r.grade;
    g.style.color = { S: '#ffd23b', A: '#8be0a4', B: '#8fd8ff', C: '#e8c58f', D: '#e8907f' }[r.grade] || '#fff';
    g.style.animation = 'none'; void g.offsetWidth; g.style.animation = '';
    document.getElementById('newbest').style.display = r.isBest ? 'block' : 'none';
    const rows = [
      ['Final score', String(r.score)],
      ['Time', fmtT(r.time)],
      ['Lists banked', String(r.lists)],
      ['Damage', `${r.damage.count} items · $${r.damage.total.toFixed(2)}`],
    ];
    if (r.events.tips) rows.push(['Aisles tipped', String(r.events.tips)]);
    if (r.events.glass) rows.push(['Freezer doors', String(r.events.glass)]);
    if (r.events.tvs) rows.push(['TVs harmed', String(r.events.tvs)]);
    if (r.style.sprintGrabs) rows.push(['Sprint grabs', String(r.style.sprintGrabs)]);
    if (r.style.debrisGrabs) rows.push(['Floor rescues', String(r.style.debrisGrabs)]);
    document.getElementById('resrows').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
    document.getElementById('againbtn').onclick = () => start(r.mode.id);
    show('results');
  }

  document.getElementById('resumebtn').onclick = resume;
  document.getElementById('quitbtn').onclick = toTitle;
  document.getElementById('titlebtn').onclick = toTitle;

  game.onRunEnd = showResults;
  renderTitle();
  show('title');

  return {
    get state() { return state; },
    showPause, resume, toTitle,
  };
}
