// Mode rulesets — one shared simulation, different rules layered on top.
export const MODES = {
  run: {
    id: 'run', name: 'Shopping Run', icon: '🛒',
    tagline: 'One list, one clock. Shop fast, break little.',
    timer: 'down', startTime: 150, listLen: 6, billing: true,
    refillList: false, chaosScore: false, zen: false,
  },
  time: {
    id: 'time', name: 'Time Attack', icon: '⏱️',
    tagline: 'Timer counts up. Damage adds seconds. Beat your best.',
    timer: 'up', startTime: 0, listLen: 6, billing: true, damageTimePenalty: 1.5,
    refillList: false, chaosScore: false, zen: false,
  },
  endless: {
    id: 'endless', name: 'Register Rush', icon: '🔁',
    tagline: 'Bank a list, gain time, get a longer one. Survive.',
    timer: 'down', startTime: 75, listLen: 4, billing: true,
    refillList: true, listGrow: 1, timeBonusPerList: 14,
    chaosScore: false, zen: false,
  },
  chaos: {
    id: 'chaos', name: 'Chaos Shift', icon: '💥',
    tagline: '90 seconds. Damage IS the score. Go nuts.',
    timer: 'down', startTime: 90, listLen: 0, billing: true,
    refillList: false, chaosScore: true, zen: false,
  },
  zen: {
    id: 'zen', name: 'Zen Shopping', icon: '🍃',
    tagline: 'No timer, no bill, no judgement. Just a nice store.',
    timer: 'none', startTime: 0, listLen: 6, billing: false,
    refillList: true, listGrow: 0, chaosScore: false, zen: true,
  },
};

// Grade thresholds operate on the normalized run score.
export function gradeFor(mode, score) {
  const bands = {
    run: [[2200, 'S'], [1600, 'A'], [1100, 'B'], [600, 'C']],
    time: [[1800, 'S'], [1300, 'A'], [900, 'B'], [500, 'C']],
    endless: [[3800, 'S'], [2600, 'A'], [1600, 'B'], [800, 'C']],
    chaos: [[5000, 'S'], [3400, 'A'], [2100, 'B'], [1000, 'C']],
  }[mode] || [];
  for (const [min, g] of bands) if (score >= min) return g;
  return 'D';
}
