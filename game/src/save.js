// Versioned localStorage save. Everything the game remembers lives here:
// best scores per mode, lifetime stats, achievements, settings.
const KEY = 'gd3d_save';
const VERSION = 1;

const DEFAULTS = () => ({
  v: VERSION,
  best: {},        // mode -> { score, time, grade }
  stats: {         // lifetime
    runs: 0, itemsGrabbed: 0, debrisGrabbed: 0, damageTotal: 0,
    aislesTipped: 0, glassBroken: 0, tvsBroken: 0, npcTalks: 0, listsCompleted: 0,
  },
  ach: {},         // id -> unlock timestamp
  settings: { muted: false },
});

let data = DEFAULTS();

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === VERSION) data = { ...DEFAULTS(), ...parsed, stats: { ...DEFAULTS().stats, ...parsed.stats } };
    }
  } catch (e) { data = DEFAULTS(); }
  return data;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
}

export const getSave = () => data;

export function bumpStat(k, n = 1) { data.stats[k] = (data.stats[k] || 0) + n; }

export function recordBest(mode, score, time, grade) {
  const b = data.best[mode];
  const better = !b || score > b.score || (score === b.score && time < b.time);
  if (better) data.best[mode] = { score, time, grade };
  save();
  return better;
}

export function unlock(id) {
  if (data.ach[id]) return false;
  data.ach[id] = Date.now();
  save();
  return true;
}
