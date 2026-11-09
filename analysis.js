/* Pyszczek: silnik analiz. Czysta logika, bez DOM. Korelacje rangowe (Spearman), korekta FDR, testy Manna-Whitneya. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./foods.js'));
  else root.Analysis = factory(root.Food);
})(typeof self !== 'undefined' ? self : this, function (Food) {
  'use strict';

  /* ---------- SŁOWNIKI ---------- */
  const SYMPTOMS = [['glowa', 'Ból głowy'], ['wzdecia', 'Wzdęcia'], ['brzuch', 'Skurcze brzucha'], ['nudnosci', 'Nudności'], ['zmeczenie', 'Zmęczenie'],
    ['plecy', 'Ból pleców'], ['piersi', 'Tkliwość piersi'], ['tradzik', 'Trądzik'], ['mgla', 'Mgła mózgowa'], ['zgaga', 'Zgaga'],
    ['wahania', 'Wahania nastroju'], ['obrzeki', 'Obrzęki'], ['slodycze', 'Ochota na słodycze']];
  const STRESSORS = [['praca', 'Praca'], ['relacje', 'Relacje'], ['pieniadze', 'Pieniądze'], ['zdrowie', 'Zdrowie'], ['rodzina', 'Rodzina'], ['czas', 'Brak czasu'], ['podroz', 'Podróż'], ['inne', 'Coś innego']];
  const AFTER_TAGS = [['wzdęcie', 'wzdęcie'], ['ciężkość', 'ciężkość'], ['senność', 'senność'], ['zgaga', 'zgaga'], ['nudności', 'nudności'], ['energia', 'energia'], ['sytość', 'dobra sytość']];
  const BAD_AFTER = ['wzdęcie', 'ciężkość', 'senność', 'zgaga', 'nudności'];
  const PHASES = { menstruacja: 'Menstruacja', folikularna: 'Faza folikularna', owulacja: 'Okolice owulacji', lutealna: 'Faza lutealna' };

  const METRICS = {
    mood: { label: 'Nastrój', unit: '/10', dec: 1, good: 1 },
    energy: { label: 'Energia', unit: '/10', dec: 1, good: 1 },
    stress: { label: 'Stres', unit: '/10', dec: 1, good: -1 },
    sleepHours: { label: 'Długość snu', unit: ' h', dec: 1, good: 1 },
    sleepQuality: { label: 'Jakość snu', unit: '/10', dec: 1, good: 1 },
    water: { label: 'Woda', unit: ' ml', dec: 0, good: 1 },
    caffeine: { label: 'Kofeina', unit: ' porcji', dec: 1, good: -1 },
    alcohol: { label: 'Alkohol', unit: ' porcji', dec: 1, good: -1 },
    exerciseMin: { label: 'Ćwiczenia', unit: ' min', dec: 0, good: 1 },
    steps: { label: 'Kroki', unit: ' kroków', dec: 0, good: 1 },
    walkMin: { label: 'Spacer', unit: ' min', dec: 0, good: 1 },
    kcal: { label: 'Kalorie', unit: ' kcal', dec: 0, good: 0 },
    protein: { label: 'Białko', unit: ' g', dec: 0, good: 1 },
    carbs: { label: 'Węglowodany', unit: ' g', dec: 0, good: 0 },
    fat: { label: 'Tłuszcz', unit: ' g', dec: 0, good: 0 },
    fiber: { label: 'Błonnik', unit: ' g', dec: 0, good: 1 },
    sugar: { label: 'Cukry', unit: ' g', dec: 0, good: -1 },
    iron: { label: 'Żelazo', unit: ' mg', dec: 1, good: 1 },
    calcium: { label: 'Wapń', unit: ' mg', dec: 0, good: 1 },
    afterAvg: { label: 'Samopoczucie po posiłkach', unit: '/5', dec: 1, good: 1 },
    symptoms: { label: 'Objawy (suma)', unit: ' pkt', dec: 1, good: -1 },
    stressors: { label: 'Liczba stresorów', unit: '', dec: 1, good: -1 },
    wellbeing: { label: 'Wskaźnik samopoczucia', unit: '/100', dec: 0, good: 1 },
    wbCore: { label: 'Samopoczucie w ciągu dnia', unit: '/100', dec: 0, good: 1 },
    cycleDay: { label: 'Dzień cyklu', unit: '', dec: 0, good: 0 }
  };
  SYMPTOMS.forEach(([k, l]) => { METRICS['sym_' + k] = { label: l, unit: '/3', dec: 1, good: -1 }; });
  const metricLabel = (k) => (METRICS[k] || {}).label || k;

  /* ---------- NARZĘDZIA ---------- */
  const fmt = (v, d) => (v === null || v === undefined || isNaN(v)) ? '–' : Number(v).toFixed(d === undefined ? 1 : d).replace('.', ',');
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => a.length ? sum(a) / a.length : null;
  const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) * (x - m))) / (a.length - 1)); };
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const quantile = (a, q) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return null; const pos = (s.length - 1) * q, lo = Math.floor(pos); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo); };
  const isNum = (v) => typeof v === 'number' && !isNaN(v);

  function addDays(iso, n) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
  function diffDays(a, b) { const f = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((f(a) - f(b)) / 86400000); }
  function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function ranks(a) {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0;
    while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
    return r;
  }
  function pearson(x, y) {
    const n = x.length; if (n < 3) return null; const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    if (sxx === 0 || syy === 0) return null; return sxy / Math.sqrt(sxx * syy);
  }
  const spearman = (x, y) => pearson(ranks(x), ranks(y));
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) { y += 1; s += c[j] / y; }
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function betacf(a, b, x) {
    const FP = 1e-30; const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function pRho(rho, n) {
    if (n < 5) return 1; const r = Math.max(-0.999999, Math.min(0.999999, rho)); const t = r * Math.sqrt((n - 2) / (1 - r * r));
    return betai((n - 2) / 2, 0.5, (n - 2) / (n - 2 + t * t));
  }
  function normCdf(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p;
  }
  function mannWhitney(a, b) {
    const n1 = a.length, n2 = b.length; if (n1 < 3 || n2 < 3) return { p: 1 };
    const all = a.concat(b), r = ranks(all); let R1 = 0; for (let i = 0; i < n1; i++) R1 += r[i];
    const U1 = R1 - n1 * (n1 + 1) / 2, mu = n1 * n2 / 2, N = n1 + n2, cnt = {}; all.forEach((v) => { cnt[v] = (cnt[v] || 0) + 1; });
    let ts = 0; Object.keys(cnt).forEach((k) => { const t = cnt[k]; ts += t * t * t - t; });
    const sigma = Math.sqrt(n1 * n2 / 12 * ((N + 1) - ts / (N * (N - 1)))); if (!sigma) return { p: 1 };
    const z = (Math.abs(U1 - mu) - 0.5) / sigma; return { p: Math.min(1, 2 * (1 - normCdf(Math.max(0, z)))) };
  }
  function twoProp(x1, n1, x2, n2) {
    const p1 = x1 / n1, p2 = x2 / n2, pp = (x1 + x2) / (n1 + n2), se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)); if (!se) return 1;
    return Math.min(1, 2 * (1 - normCdf((Math.abs(p1 - p2) - 0.5 * (1 / n1 + 1 / n2)) / se)));
  }
  function bh(ps) {
    const m = ps.length, order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), q = new Array(m); let prev = 1;
    for (let k = m - 1; k >= 0; k--) { const v = Math.min(prev, order[k][0] * m / (k + 1)); q[order[k][1]] = v; prev = v; }
    return q;
  }
  function cohenD(a, b) {
    if (a.length < 3 || b.length < 3) return 0; const sa = sd(a), sb = sd(b);
    const sp = Math.sqrt(((a.length - 1) * sa * sa + (b.length - 1) * sb * sb) / (a.length + b.length - 2)); return sp ? (mean(a) - mean(b)) / sp : 0;
  }

  /* ---------- CELE ---------- */
  function targets(s) {
    s = s || {}; const w = Number(s.weightKg) || 0, h = Number(s.heightCm) || 0, a = Number(s.age) || 0; let kcal = null;
    if (w && h && a) {
      const bmr = 10 * w + 6.25 * h - 5 * a - 161, mult = { low: 1.35, mid: 1.55, high: 1.75 }[s.activity || 'mid'];
      kcal = bmr * mult; if (s.goal === 'lose') kcal *= 0.9; if (s.goal === 'gain') kcal *= 1.1; kcal = Math.round(Math.max(1400, kcal) / 10) * 10;
    }
    return { kcal, protein: w ? Math.round(w * 1.0) : 70, fiber: 25, iron: a && a > 50 ? 11 : 16, calcium: 950, water: w ? Math.max(1500, Math.min(3000, Math.round(w * 30 / 50) * 50)) : 2000 };
  }

  /* ---------- REKORDY DZIENNE ---------- */
  function dayMeals(d) { return (d && d.meals) || []; }
  function dayTotals(d) {
    const o = Food.sumItems([].concat(...dayMeals(d).map((m) => m.items || []))); o.meals = dayMeals(d).length; return o;
  }
  const checkedIn = (d) => d && (isNum(d.mood) || isNum(d.energy) || isNum(d.stress));
  const symTotal = (d) => Object.keys(d.symptoms || {}).reduce((s, k) => s + (d.symptoms[k] || 0), 0);
  function wellbeing(d) {
    if (!d) return null; const parts = [];
    if (isNum(d.mood)) parts.push([0.30, (d.mood - 1) / 9]);
    if (isNum(d.energy)) parts.push([0.25, (d.energy - 1) / 9]);
    if (isNum(d.stress)) parts.push([0.20, 1 - (d.stress - 1) / 9]);
    if (isNum(d.sleepQuality)) parts.push([0.15, (d.sleepQuality - 1) / 9]);
    if (checkedIn(d)) parts.push([0.10, 1 - Math.min(1, symTotal(d) / 12)]);
    if (parts.length < 2) return null; const w = sum(parts.map((p) => p[0]));
    return Math.round(100 * sum(parts.map((p) => p[0] * p[1])) / w);
  }
  /* wersja bez snu: używana jako wynik w analizach, żeby uniknąć kołowych zależności */
  function wellbeingCore(d) {
    if (!d) return null; const parts = [];
    if (isNum(d.mood)) parts.push([0.35, (d.mood - 1) / 9]);
    if (isNum(d.energy)) parts.push([0.30, (d.energy - 1) / 9]);
    if (isNum(d.stress)) parts.push([0.25, 1 - (d.stress - 1) / 9]);
    if (checkedIn(d)) parts.push([0.10, 1 - Math.min(1, symTotal(d) / 12)]);
    if (parts.length < 2) return null; const w = sum(parts.map((p) => p[0]));
    return Math.round(100 * sum(parts.map((p) => p[0] * p[1])) / w);
  }
  function mealAfterAvg(d) { const v = dayMeals(d).map((m) => m.after && m.after.score).filter(isNum); return v.length ? mean(v) : null; }

  function buildRecords(days) {
    const tdy = todayISO(); const dates = Object.keys(days).sort().filter((x) => x <= tdy); const recs = [];
    dates.forEach((date) => {
      const d = days[date]; const ci = checkedIn(d); const t = dayTotals(d); const full = t.meals > 0 && t.kcal >= 600;
      const r = {
        date, ci, mood: isNum(d.mood) ? d.mood : null, energy: isNum(d.energy) ? d.energy : null, stress: isNum(d.stress) ? d.stress : null,
        sleepHours: isNum(d.sleepHours) ? d.sleepHours : null, sleepQuality: isNum(d.sleepQuality) ? d.sleepQuality : null,
        water: isNum(d.water) ? d.water : null, caffeine: isNum(d.caffeine) ? d.caffeine : null, alcohol: isNum(d.alcohol) ? d.alcohol : null,
        exerciseMin: isNum(d.exercise) ? d.exercise : null, steps: isNum(d.steps) ? d.steps : null, walkMin: isNum(d.walkMin) ? d.walkMin : null,
        kcal: full ? t.kcal : null, protein: full ? t.p : null, carbs: full ? t.c : null, fat: full ? t.f : null, fiber: full ? t.fib : null,
        sugar: full ? t.sug : null, iron: full ? t.fe : null, calcium: full ? t.ca : null, afterAvg: mealAfterAvg(d),
        symptoms: ci ? symTotal(d) : null, stressors: ci ? (d.stressors || []).length : null, flow: d.flow || 0, wellbeing: wellbeing(d), wbCore: wellbeingCore(d)
      };
      SYMPTOMS.forEach(([k]) => { r['sym_' + k] = ci ? ((d.symptoms || {})[k] || 0) : null; });
      recs.push(r);
    });
    return recs;
  }

  /* ---------- CYKL ---------- */
  function cycleInfo(days, settings) {
    const s = settings || {}; const dates = Object.keys(days).sort(); const isP = (d) => ((days[d] || {}).flow || 0) >= 2;
    const starts = [];
    dates.forEach((d) => { if (isP(d) && !isP(addDays(d, -1)) && !isP(addDays(d, -2)) && !isP(addDays(d, -3))) starts.push(d); });
    const lengths = []; for (let i = 1; i < starts.length; i++) lengths.push(diffDays(starts[i], starts[i - 1]));
    const valid = lengths.filter((l) => l >= 18 && l <= 50);
    const avg = valid.length ? Math.round(mean(valid.slice(-6))) : (Number(s.cycleLen) || 28);
    const plens = starts.map((st) => { let n = 0; while (((days[addDays(st, n)] || {}).flow || 0) >= 1 && n < 12) n++; return n; }).filter((n) => n > 0);
    const periodLen = plens.length ? Math.round(mean(plens)) : (Number(s.periodLen) || 5);
    const last = starts.length ? starts[starts.length - 1] : null;
    const ovDay = Math.max(periodLen + 3, avg - 14);
    function phaseOf(date) {
      let st = null; for (let i = starts.length - 1; i >= 0; i--) if (starts[i] <= date) { st = starts[i]; break; }
      if (!st) return null; const cd = diffDays(date, st) + 1; if (cd > Math.max(avg * 1.5, 45)) return null;
      let phase = 'lutealna'; if (cd <= periodLen) phase = 'menstruacja'; else if (cd < ovDay - 1) phase = 'folikularna'; else if (cd <= ovDay + 1) phase = 'owulacja';
      return { cd, phase, pms: phase === 'lutealna' && cd >= avg - 5 };
    }
    return { starts, lengths, valid, avg, periodLen, last, next: last ? addDays(last, avg) : null, sdLen: sd(valid), phaseOf, ovDay };
  }

  /* ---------- KORELACJE ---------- */
  const HYP = [];
  const H = (xs, ys, lags) => xs.forEach((x) => ys.forEach((y) => lags.forEach((l) => { if (x !== y || l) HYP.push([x, y, l]); })));
  H(['sleepHours', 'sleepQuality'], ['mood', 'energy', 'stress', 'symptoms', 'sym_glowa', 'sym_zmeczenie', 'sym_mgla'], [0]);
  H(['stress'], ['symptoms', 'sym_glowa', 'sym_wzdecia', 'sym_zgaga', 'sym_brzuch', 'energy', 'afterAvg'], [0]);
  H(['stress', 'caffeine', 'alcohol', 'exerciseMin', 'steps', 'walkMin', 'sugar', 'stressors'], ['sleepQuality', 'sleepHours'], [1]);
  H(['exerciseMin', 'steps', 'walkMin'], ['mood', 'energy', 'stress'], [0, 1]);
  H(['steps', 'walkMin'], ['sleepQuality', 'sym_zmeczenie'], [0, 1]);
  H(['water'], ['sym_glowa', 'energy', 'sym_zmeczenie', 'sym_wzdecia'], [0]);
  H(['caffeine'], ['stress', 'energy', 'sym_glowa'], [0]);
  H(['alcohol'], ['mood', 'energy', 'sym_glowa', 'stress'], [1]);
  H(['fiber'], ['afterAvg', 'sym_wzdecia', 'sym_brzuch'], [0, 1]);
  H(['sugar'], ['energy', 'mood', 'sym_slodycze'], [0, 1]);
  H(['protein'], ['energy', 'afterAvg'], [0, 1]);
  H(['carbs'], ['energy', 'mood'], [0]);
  H(['fat'], ['afterAvg', 'sym_zgaga'], [0]);
  H(['iron'], ['energy', 'sym_zmeczenie'], [0, 1]);
  H(['stressors'], ['mood'], [0]);
  H(['sleepHours', 'sleepQuality', 'exerciseMin', 'steps', 'walkMin', 'water', 'caffeine', 'alcohol', 'sugar', 'fiber', 'protein', 'stressors'], ['wbCore'], [0, 1]);

  function pairs(recs, xk, yk, lag, from) {
    const by = {}; recs.forEach((r) => { by[r.date] = r; }); const X = [], Y = [], D = [];
    recs.forEach((r) => {
      if (from && r.date < from) return; const x = r[xk]; if (!isNum(x)) return;
      const o = by[lag ? addDays(r.date, lag) : r.date]; if (!o || !isNum(o[yk])) return;
      X.push(x); Y.push(o[yk]); D.push(r.date);
    });
    return { X, Y, D };
  }
  function splitGroups(X, Y) {
    const med = median(X); let hi = [], lo = [];
    X.forEach((x, i) => { (x > med ? hi : lo).push(Y[i]); });
    if (hi.length < 4) { hi = []; lo = []; X.forEach((x, i) => { (x >= med ? hi : lo).push(Y[i]); }); }
    if (hi.length < 4 || lo.length < 4) return null;
    return { med, hiMean: mean(hi), loMean: mean(lo), nHi: hi.length, nLo: lo.length };
  }
  function relation(recs, xk, yk, lag, from) {
    const { X, Y } = pairs(recs, xk, yk, lag, from); const n = X.length;
    if (n < 10) return { xk, yk, lag, n, ok: false };
    const rho = spearman(X, Y); if (rho === null) return { xk, yk, lag, n, ok: false };
    return { xk, yk, lag, n, ok: true, rho, p: pRho(rho, n), groups: splitGroups(X, Y), points: X.map((x, i) => [x, Y[i]]) };
  }
  function correlations(recs, from) {
    const res = HYP.map(([x, y, l]) => relation(recs, x, y, l, from)).filter((r) => r.ok && r.n >= 14);
    const q = bh(res.map((r) => r.p)); res.forEach((r, i) => { r.q = q[i]; });
    res.forEach((r) => { r.sentence = sentenceFor(r); });
    const strong = res.filter((r) => r.q < 0.10 && Math.abs(r.rho) >= 0.25 && r.groups).sort((a, b) => a.p - b.p);
    const early = res.filter((r) => r.q >= 0.10 && r.p < 0.05 && Math.abs(r.rho) >= 0.3 && r.groups).sort((a, b) => a.p - b.p);
    strong.forEach((r) => { r.conf = (r.q < 0.05 && r.n >= 30 && Math.abs(r.rho) >= 0.4) ? 'wyraźna' : 'prawdopodobna'; });
    early.forEach((r) => { r.conf = 'wstępna'; });
    return { tested: res.length, confirmed: strong.slice(0, 8), preliminary: early.slice(0, 5) };
  }
  function sentenceFor(r) {
    const X = METRICS[r.xk] || { label: r.xk, unit: '', dec: 1 }, Y = METRICS[r.yk] || { label: r.yk, unit: '', dec: 1 };
    const title = X.label + ' → ' + Y.label + (r.lag ? ' (następny dzień)' : '');
    let detail = '', tone = 'neutral';
    if (r.groups) {
      const g = r.groups, diff = g.hiMean - g.loMean;
      detail = 'W dni z wartością „' + X.label + '” powyżej ' + fmt(g.med, X.dec) + X.unit + ' wskaźnik „' + Y.label + '” był średnio ' + fmt(g.hiMean, Y.dec) + ' wobec ' + fmt(g.loMean, Y.dec) + ' w pozostałe dni (' + (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff), Y.dec) + ').';
      if (Y.good) tone = diff * Y.good > 0 ? 'good' : 'bad';
    }
    return { title, detail, tone };
  }

  /* ---------- NAJLEPSZE VS NAJGORSZE DNI ---------- */
  function bestWorst(recs, from) {
    const r = recs.filter((x) => isNum(x.wbCore) && (!from || x.date >= from)); if (r.length < 15) return null;
    const vals = r.map((x) => x.wbCore), hiT = quantile(vals, 2 / 3), loT = quantile(vals, 1 / 3);
    const top = r.filter((x) => x.wbCore >= hiT), bot = r.filter((x) => x.wbCore <= loT);
    const keys = ['sleepHours', 'sleepQuality', 'exerciseMin', 'water', 'caffeine', 'alcohol', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'stressors'];
    const rows = [];
    keys.forEach((k) => {
      const a = top.map((x) => x[k]).filter(isNum), b = bot.map((x) => x[k]).filter(isNum); if (a.length < 5 || b.length < 5) return;
      const d = cohenD(a, b); rows.push({ key: k, label: metricLabel(k), top: mean(a), bottom: mean(b), d, p: mannWhitney(a, b).p });
    });
    rows.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    return { nTop: top.length, nBottom: bot.length, topAvg: mean(top.map((x) => x.wbCore)), bottomAvg: mean(bot.map((x) => x.wbCore)), rows: rows.filter((x) => Math.abs(x.d) >= 0.4).slice(0, 6) };
  }

  /* ---------- JEDZENIE A SAMOPOCZUCIE ---------- */
  function mealList(days, from) {
    const out = [];
    Object.keys(days).sort().forEach((date) => {
      if (from && date < from) return;
      dayMeals(days[date]).forEach((m) => {
        if (!m.after || !isNum(m.after.score)) return; const t = Food.sumItems(m.items || []); const f = new Set();
        (m.items || []).forEach((it) => { (it.tags || []).forEach((g) => f.add(g)); f.add('produkt: ' + it.name.replace(/ \(.*\)$/, '')); });
        if (t.kcal >= 800) f.add('duży posiłek'); if (t.sug >= 25) f.add('dużo cukrów'); if (t.fib >= 10) f.add('dużo błonnika'); if (t.f >= 35) f.add('dużo tłuszczu');
        if (m.time && m.time >= '21:00') f.add('późny posiłek');
        out.push({ i: out.length, date, feats: f, score: m.after.score, tags: m.after.tags || [] });
      });
    });
    return out;
  }
  function foodTriggers(days, from) {
    const meals = mealList(days, from); if (meals.length < 14) return { n: meals.length, rows: [] };
    const all = new Set(); meals.forEach((m) => m.feats.forEach((f) => all.add(f)));
    const tests = [];
    all.forEach((f) => {
      const A = meals.filter((m) => m.feats.has(f)), B = meals.filter((m) => !m.feats.has(f)); if (A.length < 5 || B.length < 5) return;
      const sa = A.map((m) => m.score), sb = B.map((m) => m.score), set = new Set(A.map((m) => m.i));
      tests.push({ feat: f, outcome: 'score', nA: A.length, nB: B.length, a: mean(sa), b: mean(sb), diff: mean(sa) - mean(sb), p: mannWhitney(sa, sb).p, set });
      BAD_AFTER.forEach((t) => {
        const xa = A.filter((m) => m.tags.includes(t)).length, xb = B.filter((m) => m.tags.includes(t)).length; if (xa + xb < 4) return;
        tests.push({ feat: f, outcome: t, nA: A.length, nB: B.length, a: xa / A.length, b: xb / B.length, diff: xa / A.length - xb / B.length, p: twoProp(xa, A.length, xb, B.length), set });
      });
    });
    const q = bh(tests.map((t) => t.p)); tests.forEach((t, i) => { t.q = q[i]; });
    const cand = tests.filter((t) => t.q < 0.15 && ((t.outcome === 'score' && Math.abs(t.diff) >= 0.4) || (t.outcome !== 'score' && t.diff >= 0.2)))
      .sort((x, y) => (x.p - y.p) || ((x.feat.indexOf('produkt:') === 0) - (y.feat.indexOf('produkt:') === 0)) || (y.nA - x.nA));
    const rows = [];
    cand.forEach((t) => {
      if (rows.length >= 8) return;
      const dup = rows.some((r) => {
        if (r.outcome !== t.outcome) return false; let inter = 0; t.set.forEach((i) => { if (r.set.has(i)) inter++; });
        if (inter / (t.set.size + r.set.size - inter) >= 0.7) return true;
        const subset = inter / t.set.size >= 0.9; // prawie wszystkie posiłki tej cechy zawierają też silniejszy czynnik
        if (subset && t.diff * r.diff > 0) return t.outcome === 'score' ? Math.abs(t.diff) <= Math.abs(r.diff) + 0.3 : t.diff <= r.diff + 0.15;
        return false;
      });
      if (!dup) rows.push(t);
    });
    rows.forEach((t) => {
      const f = t.feat.replace('produkt: ', '');
      t.text = t.outcome === 'score'
        ? 'Posiłki z elementem „' + f + '” oceniałaś średnio na ' + fmt(t.a) + '/5 wobec ' + fmt(t.b) + '/5 bez niego (' + (t.diff >= 0 ? '+' : '−') + fmt(Math.abs(t.diff)) + ').'
        : 'Po posiłkach z elementem „' + f + '” zgłaszałaś „' + t.outcome + '” w ' + Math.round(t.a * 100) + '% przypadków, bez niego w ' + Math.round(t.b * 100) + '%.';
      t.tone = t.outcome === 'score' ? (t.diff > 0 ? 'good' : 'bad') : 'bad';
    });
    return { n: meals.length, rows };
  }

  /* ---------- CYKL: ANALIZA ---------- */
  function cycleAnalysis(days, recs, settings, from) {
    const ci = cycleInfo(days, settings); const out = { info: ci, phases: null, findings: [], cycles: Math.max(0, ci.starts.length - 1) };
    if (!ci.starts.length) return out;
    const keys = ['mood', 'energy', 'stress', 'sleepQuality', 'symptoms', 'sym_slodycze', 'sym_wzdecia', 'sym_piersi', 'sym_wahania'];
    const groups = {}; Object.keys(PHASES).forEach((p) => { groups[p] = []; });
    recs.forEach((r) => { if (from && r.date < from) return; const ph = ci.phaseOf(r.date); if (ph && r.ci) { r.phase = ph.phase; r.cycleDay = ph.cd; r.pms = ph.pms; groups[ph.phase].push(r); } });
    const rows = Object.keys(PHASES).map((p) => { const o = { phase: p, label: PHASES[p], n: groups[p].length }; keys.forEach((k) => { o[k] = mean(groups[p].map((r) => r[k]).filter(isNum)); }); return o; });
    out.phases = rows.some((r) => r.n >= 3) ? rows : null;
    const G = groups, all = [].concat(G.menstruacja, G.folikularna, G.owulacja, G.lutealna);
    const defs = [
      { label: 'Tuż przed miesiączką', vs: 'w reszcie cyklu', A: all.filter((r) => r.pms), B: all.filter((r) => !r.pms && r.phase !== 'menstruacja'), keys: ['mood', 'energy', 'stress', 'sleepQuality', 'symptoms', 'sym_slodycze', 'sym_wzdecia', 'sym_piersi', 'sym_wahania', 'sym_tradzik'] },
      { label: 'W czasie miesiączki', vs: 'poza miesiączką', A: G.menstruacja, B: all.filter((r) => r.phase !== 'menstruacja'), keys: ['energy', 'mood', 'sleepQuality', 'symptoms', 'sym_brzuch', 'sym_plecy', 'sym_zmeczenie', 'sym_glowa'] },
      { label: 'W fazie lutealnej', vs: 'w fazie folikularnej i okolicach owulacji', A: G.lutealna, B: G.folikularna.concat(G.owulacja), keys: ['mood', 'energy', 'stress', 'symptoms', 'sym_slodycze', 'sym_wzdecia'] }
    ];
    const tests = [];
    defs.forEach((df) => df.keys.forEach((k) => {
      const a = df.A.map((r) => r[k]).filter(isNum), b = df.B.map((r) => r[k]).filter(isNum); if (a.length < 5 || b.length < 5) return;
      tests.push({ df, key: k, a: mean(a), b: mean(b), diff: mean(a) - mean(b), p: mannWhitney(a, b).p });
    }));
    const q = bh(tests.map((t) => t.p)); tests.forEach((t, i) => { t.q = q[i]; });
    const seen = new Set(), grp = {};
    tests.filter((t) => t.p < 0.05 && Math.abs(t.diff) >= (t.key.startsWith('sym_') ? 0.3 : 0.6)).sort((a, b) => a.p - b.p).forEach((t) => {
      if (seen.has(t.key) || seen.size >= 7) return; seen.add(t.key);
      const M = METRICS[t.key]; const g = grp[t.df.label] = grp[t.df.label] || { title: t.df.label, vs: t.df.vs, rows: [], prelim: false };
      g.rows.push({ label: M.label, dec: 1, a: t.a, b: t.b, diff: t.diff, tone: (t.diff * M.good) < 0 ? 'bad' : 'good' });
      if (t.q >= 0.1 || out.cycles < 2) g.prelim = true;
    });
    out.findings = Object.keys(grp).map((k) => grp[k]);
    return out;
  }

  /* ---------- ŹRÓDŁA STRESU ---------- */
  function stressSources(days, from) {
    const rows = []; const recs = Object.keys(days).sort().filter((d) => (!from || d >= from) && checkedIn(days[d]));
    if (recs.length < 14) return [];
    STRESSORS.forEach(([k, label]) => {
      const A = recs.filter((d) => (days[d].stressors || []).includes(k)), B = recs.filter((d) => !(days[d].stressors || []).includes(k)); if (A.length < 5 || B.length < 5) return;
      const sa = A.map((d) => days[d].stress).filter(isNum), sb = B.map((d) => days[d].stress).filter(isNum); if (sa.length < 5 || sb.length < 5) return;
      const ma = A.map((d) => days[d].mood).filter(isNum), mb = B.map((d) => days[d].mood).filter(isNum);
      rows.push({ key: k, label, n: A.length, stressWith: mean(sa), stressWithout: mean(sb), moodWith: mean(ma), moodWithout: mean(mb), diff: mean(sa) - mean(sb), p: mannWhitney(sa, sb).p });
    });
    const q = bh(rows.map((r) => r.p)); rows.forEach((r, i) => { r.q = q[i]; });
    return rows.filter((r) => r.p < 0.05 && r.diff >= 0.7).sort((a, b) => b.diff - a.diff);
  }

  /* ---------- ODŻYWIANIE VS CELE ---------- */
  function nutrition(recs, settings, from) {
    const r = recs.filter((x) => isNum(x.kcal) && (!from || x.date >= from)); if (r.length < 3) return null;
    const tg = targets(settings); const avg = (k) => mean(r.map((x) => x[k]).filter(isNum));
    const kc = avg('kcal'), pk = avg('protein') * 4, ck = avg('carbs') * 4, fk = avg('fat') * 9, tot = pk + ck + fk || 1;
    return {
      days: r.length, targets: tg, kcal: kc, protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat'), fiber: avg('fiber'), sugar: avg('sugar'), iron: avg('iron'), calcium: avg('calcium'),
      split: { p: Math.round(pk / tot * 100), c: Math.round(ck / tot * 100), f: Math.round(fk / tot * 100) }
    };
  }

  /* ---------- PODSUMOWANIE TYGODNIA ---------- */
  function weekCompare(recs, today) {
    const w1from = addDays(today, -6), w0from = addDays(today, -13), w0to = addDays(today, -7);
    const cur = recs.filter((r) => r.date >= w1from && r.date <= today), prev = recs.filter((r) => r.date >= w0from && r.date <= w0to);
    const keys = ['wellbeing', 'mood', 'energy', 'stress', 'sleepHours', 'sleepQuality', 'water', 'exerciseMin', 'symptoms'];
    return keys.map((k) => {
      const a = cur.map((r) => r[k]).filter(isNum), b = prev.map((r) => r[k]).filter(isNum); const m = METRICS[k];
      return { key: k, label: m.label, unit: m.unit, dec: m.dec, good: m.good, cur: mean(a), prev: mean(b), n: a.length, delta: a.length && b.length ? mean(a) - mean(b) : null };
    }).filter((x) => x.cur !== null);
  }

  /* ---------- UWAGI (nie diagnoza) ---------- */
  function alerts(recs, cyc, today) {
    const out = []; const last7 = recs.filter((r) => r.date >= addDays(today, -6)), last14 = recs.filter((r) => r.date >= addDays(today, -13));
    const sl = last7.map((r) => r.sleepHours).filter(isNum);
    if (sl.length >= 4 && mean(sl) < 6) out.push({ level: 'warn', text: 'W ostatnim tygodniu śpisz średnio ' + fmt(mean(sl)) + ' h. Dorosłym zaleca się zwykle 7–9 h. Krótki sen często obniża nastrój i energię następnego dnia.' });
    const md = last14.map((r) => r.mood).filter(isNum);
    if (md.length >= 8 && mean(md) <= 3) out.push({ level: 'warn', text: 'Przez ostatnie dwa tygodnie nastrój jest wyraźnie niski (średnio ' + fmt(mean(md)) + '/10). To ważny sygnał: warto porozmawiać z lekarzem lub psychologiem. Jeśli pojawiają się myśli o zrobieniu sobie krzywdy, zadzwoń na 112 lub telefon zaufania 116 123.' });
    else if (md.length >= 8 && mean(md) <= 4.5) out.push({ level: 'info', text: 'Nastrój w ostatnich dwóch tygodniach jest niski (średnio ' + fmt(mean(md)) + '/10). Jeśli to trwa, porozmawiaj ze specjalistą.' });
    const wt = last7.map((r) => r.water).filter(isNum); if (wt.length >= 4 && mean(wt) < 1000) out.push({ level: 'info', text: 'Średnie nawodnienie w ostatnim tygodniu to ' + Math.round(mean(wt)) + ' ml. Przy bólach głowy lub zmęczeniu warto to sprawdzić.' });
    const kc = last7.map((r) => r.kcal).filter(isNum); if (kc.length >= 5 && mean(kc) < 1200) out.push({ level: 'info', text: 'Zapisane posiłki dają średnio poniżej 1200 kcal dziennie. Jeśli nie jest to niepełny zapis, taka podaż energii bywa zbyt niska. Warto omówić ją z lekarzem lub dietetykiem.' });
    const hs = last7.filter((r) => (r.sym_glowa || 0) >= 2).length; if (hs >= 3) out.push({ level: 'info', text: 'Silne bóle głowy w ' + hs + ' z ostatnich 7 dni. Przy nawracających bólach warto zgłosić się do lekarza.' });
    if (cyc && cyc.starts.length) {
      if (cyc.valid.length >= 3 && (cyc.avg < 21 || cyc.avg > 35)) out.push({ level: 'info', text: 'Średnia długość cyklu to ' + cyc.avg + ' dni, czyli poza typowym zakresem 21–35 dni. Zapisy mogą pomóc lekarzowi ginekologowi.' });
      if (cyc.valid.length >= 4 && cyc.sdLen > 7) out.push({ level: 'info', text: 'Długość cykli jest zmienna (odchylenie ' + fmt(cyc.sdLen) + ' dni). Przy nieregularnych cyklach warto skonsultować się z ginekologiem.' });
      if (cyc.last && diffDays(today, cyc.last) > 45 && cyc.starts.length >= 3) out.push({ level: 'warn', text: 'Od początku ostatniej miesiączki minęło ' + diffDays(today, cyc.last) + ' dni. Jeśli to nietypowe, rozważ test ciążowy i konsultację lekarską.' });
      if (cyc.periodLen > 7) out.push({ level: 'info', text: 'Miesiączki trwają u Ciebie średnio ' + cyc.periodLen + ' dni. Jeśli są też obfite, warto to omówić z lekarzem (ryzyko niedoboru żelaza).' });
    }
    return out;
  }

  /* ---------- EKSPERYMENT TYGODNIA ---------- */
  const MODIFIABLE = { sleepHours: 1, exerciseMin: 1, water: 1, caffeine: 1, alcohol: 1, sugar: 1, fiber: 1, protein: 1 };
  const OUT_GOOD = { mood: 1, energy: 1, sleepQuality: 1, wellbeing: 1, stress: -1, symptoms: -1, sym_glowa: -1, sym_wzdecia: -1, sym_zmeczenie: -1, afterAvg: 1 };
  function experiment(corr, recs) {
    const c = (corr.confirmed || []).concat(corr.preliminary || []).filter((r) => MODIFIABLE[r.xk] && OUT_GOOD[r.yk] && r.groups);
    if (!c.length) return null;
    const r = c[0], Y = METRICS[r.yk], g = r.groups, benefitUp = (g.hiMean - g.loMean) * OUT_GOOD[r.yk] > 0;
    const better = benefitUp ? g.hiMean : g.loMean, other = benefitUp ? g.loMean : g.hiMean, med = g.med;
    const up = (v) => Math.ceil(v * 2) / 2;
    const R5 = (v, s) => Math.round(v / s) * s;
    const T = {
      sleepHours: { v: Math.max(up(med), 7), dir: 'up', txt: (t) => 'Przez 7 dni połóż się tak, by spać co najmniej ' + fmt(t, 1) + ' h.' },
      exerciseMin: { v: Math.max(15, Math.ceil(med / 5) * 5), dir: 'up', txt: (t) => 'Przez 7 dni zaplanuj ćwiczenia co najmniej ' + t + ' min dziennie.' },
      steps: { v: Math.max(6000, R5(med + 1500, 500)), dir: 'up', txt: (t) => 'Przez 7 dni zrób co najmniej ' + t + ' kroków dziennie.' },
      walkMin: { v: Math.max(20, R5(med + 10, 5)), dir: 'up', txt: (t) => 'Przez 7 dni idź na spacer co najmniej ' + t + ' min dziennie.' },
      water: { v: Math.max(R5(Math.max(med, 1500), 250), 1500), dir: 'up', txt: (t) => 'Przez 7 dni pij co najmniej ' + t + ' ml wody dziennie.' },
      caffeine: { v: Math.floor(med), dir: 'down', txt: (t) => t >= 1 ? 'Przez 7 dni ogranicz kofeinę do ' + t + ' porcji dziennie i nie pij kawy po południu.' : 'Przez 7 dni spróbuj obejść się bez kofeiny albo pić ją tylko rano.' },
      alcohol: { v: Math.floor(med), dir: 'down', txt: (t) => t >= 1 ? 'Przez 7 dni ogranicz alkohol do ' + t + ' porcji lub mniej.' : 'Przez 7 dni spróbuj obyć się bez alkoholu.' },
      sugar: { v: Math.max(10, R5(med, 5)), dir: 'down', txt: (t) => 'Przez 7 dni ogranicz cukry do około ' + t + ' g dziennie.' },
      fiber: { v: Math.round(med), dir: 'up', txt: (t) => 'Przez 7 dni jedz co najmniej ' + t + ' g błonnika dziennie (warzywa, płatki owsiane, strączki).' },
      protein: { v: Math.max(20, R5(med, 5)), dir: 'up', txt: (t) => 'Przez 7 dni jedz co najmniej ' + t + ' g białka dziennie.' }
    };
    const tpl = T[r.xk], when = r.lag ? 'następnego dnia ' : '';
    return { x: r.xk, y: r.yk, lag: r.lag || 0, dir: tpl.dir, target: tpl.v, text: tpl.txt(tpl.v) + ' W Twoich danych w takie dni ' + when + 'wskaźnik „' + Y.label + '” to średnio ' + fmt(better, Y.dec) + ' (wobec ' + fmt(other, Y.dec) + ' w pozostałe dni). Po tygodniu sprawdź, czy zależność się potwierdza.' };
  }

  /* ---------- GŁÓWNA FUNKCJA ---------- */
  function analyze(db, opts) {
    opts = opts || {}; const today = opts.today || todayISO(); const days = {}; Object.keys(db.days || {}).forEach((k) => { if (k <= today) days[k] = db.days[k]; }); const settings = db.settings || {};
    const recs = buildRecords(days); const from = opts.range ? addDays(today, -(opts.range - 1)) : null;
    const inRange = recs.filter((r) => !from || r.date >= from);
    const checked = inRange.filter((r) => r.ci).length;
    const corr = correlations(recs, from);
    const cyc = cycleAnalysis(days, recs, settings, from);
    return {
      today, from, recs, inRange, checkedDays: checked, totalDays: recs.filter((r) => r.ci).length,
      week: weekCompare(recs, today), stressSources: stressSources(days, from), correlations: corr, bestWorst: bestWorst(recs, from), food: foodTriggers(days, from),
      cycle: cyc, nutrition: nutrition(recs, settings, from), alerts: alerts(recs, cyc.info, today), experiment: experiment(corr, recs)
    };
  }

  function compare(db, xk, yk, lag) { return relation(buildRecords(db.days || {}), xk, yk, lag || 0, null); }

  function streak(days, today) { let n = 0, d = today; if (!checkedIn(days[d])) d = addDays(d, -1); while (checkedIn(days[d])) { n++; d = addDays(d, -1); } return n; }

  return { SYMPTOMS, STRESSORS, AFTER_TAGS, PHASES, METRICS, metricLabel, fmt, mean, median, sd, addDays, diffDays, todayISO, targets, dayTotals, wellbeing, buildRecords, cycleInfo, analyze, compare, streak, checkedIn, symTotal, spearman, pRho, mannWhitney, bh, isNum };
});
