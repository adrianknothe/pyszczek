/* Pyszczek: interaktywna analityka (wyjaśnianie dnia, symulator „co jeśli”, dni tygodnia, eksperymenty). Korzysta z Analysis. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./analysis.js'));
  else root.Insights = factory(root.Analysis);
})(typeof self !== 'undefined' ? self : this, function (A) {
  const isNum = A.isNum, fmt = A.fmt, M = A.METRICS;
  const DOW = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const DOW3 = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
  const dow = (iso) => new Date(iso + 'T12:00:00').getDay();
  /* deterministyczny generator, żeby wyniki nie skakały po odświeżeniu */
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const med = (a) => A.median(a);

  /* ---- pary (x z dnia t, y z dnia t+lag) ---- */
  function pairs(recs, xk, yk, lag) {
    const by = {}; recs.forEach((r) => { by[r.date] = r; }); const X = [], Y = [], D = [];
    recs.forEach((r) => { const x = r[xk]; if (!isNum(x)) return; const o = by[lag ? A.addDays(r.date, lag) : r.date]; if (!o || !isNum(o[yk])) return; X.push(x); Y.push(o[yk]); D.push(r.date); });
    return { X, Y, D };
  }

  /* ---- 1. Wyjaśnij dzień ---- */
  /* czynniki: [klucz, opóźnienie względem dnia ocenianego: 0 = ten sam dzień, 1 = poprzedni dzień] */
  const DRIVERS = [['sleepHours', 0], ['sleepQuality', 0], ['water', 0], ['exerciseMin', 0], ['steps', 0], ['walkMin', 0], ['caffeine', 1], ['alcohol', 1], ['stressors', 0]];
  function explainDay(db, date, targetKey) {
    const tk = targetKey || 'wbCore', recs = A.buildRecords(db.days || {}), by = {}; recs.forEach((r) => { by[r.date] = r; });
    const rec = by[date]; if (!rec || !isNum(rec[tk])) return { ok: false, reason: 'Dla tego dnia brak wpisu o samopoczuciu.' };
    const base = A.mean(recs.filter((r) => isNum(r[tk])).map((r) => r[tk]));
    const factors = [];
    DRIVERS.forEach(([k, lag]) => {
      if (k === 'sleepQuality' && tk === 'wbCore') { /* jakość snu nie wchodzi do wbCore, więc można jej użyć */ }
      const { X, Y } = pairs(recs.map((r) => r), k, tk, 0); // y z tego samego dnia co x
      // dla opóźnienia: x z dnia poprzedniego, y z dnia ocenianego
      let XX = X, YY = Y, xv = rec[k];
      if (lag) { const p = pairs(recs, k, tk, lag); XX = p.X; YY = p.Y; const prev = by[A.addDays(date, -lag)]; xv = prev ? prev[k] : null; }
      if (!isNum(xv) || XX.length < 12) return;
      const rho = A.spearman(XX, YY); if (rho === null || Math.abs(rho) < 0.15) return;
      const m = A.mean(XX), s = A.sd(XX); if (!s) return;
      const z = (xv - m) / s; if (Math.abs(z) < 0.5) return;
      const contrib = Math.max(-2.5, Math.min(2.5, z)) * rho;
      factors.push({ key: k, lag, label: A.metricLabel(k), value: xv, typical: med(XX), z, rho, n: XX.length, contrib, good: contrib > 0, dir: z > 0 ? 'wyżej' : 'niżej', dec: M[k].dec, unit: M[k].unit });
    });
    factors.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
    return { ok: true, date, score: rec[tk], base, delta: rec[tk] - base, key: tk, factors: factors.slice(0, 4), rec };
  }
  /* najtrudniejszy / najlepszy dzień w zakresie */
  function extremeDay(db, from, today, best) {
    const recs = A.buildRecords(db.days || {}).filter((r) => isNum(r.wbCore) && r.date >= (from || '0000') && r.date <= today); if (!recs.length) return null;
    return recs.reduce((m, r) => (best ? r.wbCore > m.wbCore : r.wbCore < m.wbCore) ? r : m, recs[0]).date;
  }

  /* ---- 2. Symulator „co jeśli” (regresja liniowa + bootstrap przedziału) ---- */
  function ols(X, Y) {
    const n = X.length, mx = A.mean(X), my = A.mean(Y); let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (X[i] - mx) * (X[i] - mx); sxy += (X[i] - mx) * (Y[i] - my); }
    if (!sxx) return null; const b = sxy / sxx; return { b, a: my - b * mx, mx, my };
  }
  function whatIf(db, xk, yk, lag) {
    const recs = A.buildRecords(db.days || {}), { X, Y } = pairs(recs, xk, yk, lag || 0), n = X.length;
    if (n < 14) return { ok: false, n };
    const fit = ols(X, Y); if (!fit) return { ok: false, n };
    const rho = A.spearman(X, Y), p = A.pRho(rho, n);
    const R = rng(12345 + n), bs = [];
    for (let t = 0; t < 400; t++) { const xs = [], ys = []; for (let i = 0; i < n; i++) { const k = Math.floor(R() * n); xs.push(X[k]); ys.push(Y[k]); } const f = ols(xs, ys); if (f) bs.push(f.b); }
    bs.sort((a, b) => a - b); const lo = bs.length ? bs[Math.floor(bs.length * 0.05)] : fit.b, hi = bs.length ? bs[Math.min(bs.length - 1, Math.floor(bs.length * 0.95))] : fit.b;
    const xs = X.slice().sort((a, b) => a - b), q = (f) => xs[Math.min(xs.length - 1, Math.floor(f * (xs.length - 1)))];
    const My = M[yk], clampY = (v) => { if (/\/10$/.test(My.unit)) return Math.max(1, Math.min(10, v)); if (/\/100$/.test(My.unit)) return Math.max(0, Math.min(100, v)); if (/\/5$/.test(My.unit)) return Math.max(1, Math.min(5, v)); return Math.max(0, v); };
    const at = (x) => ({ y: clampY(fit.a + fit.b * x), lo: clampY(fit.my + Math.min(lo * (x - fit.mx), hi * (x - fit.mx))), hi: clampY(fit.my + Math.max(lo * (x - fit.mx), hi * (x - fit.mx))) });
    const sig = p < 0.05 && (lo > 0 || hi < 0);
    return { ok: true, n, rho, p, slope: fit.b, ci: [lo, hi], xmin: xs[0], xmax: xs[xs.length - 1], x10: q(0.1), x90: q(0.9), xmed: med(X), xmean: fit.mx, ymean: fit.my, at, sig, xk, yk, lag: lag || 0 };
  }

  /* ---- 3. Wzorzec dni tygodnia (test permutacyjny) ---- */
  function weekdays(db, key, from) {
    const k = key || 'wbCore', recs = A.buildRecords(db.days || {}).filter((r) => isNum(r[k]) && (!from || r.date >= from));
    const g = [[], [], [], [], [], [], []]; recs.forEach((r) => g[dow(r.date)].push(r[k]));
    const order = [1, 2, 3, 4, 5, 6, 0], rows = order.map((d) => ({ dow: d, label: DOW[d], short: DOW3[d], n: g[d].length, mean: g[d].length ? A.mean(g[d]) : null }));
    const ok = rows.every((r) => r.n >= 4); if (!ok) return { ok: false, rows, n: recs.length };
    const range = (arr) => { const ms = arr.map((x) => A.mean(x)); return Math.max.apply(null, ms) - Math.min.apply(null, ms); };
    const obs = range(g), vals = recs.map((r) => r[k]), sizes = g.map((x) => x.length), R = rng(777 + recs.length); let ge = 0; const N = 600;
    for (let t = 0; t < N; t++) { const sh = vals.slice(); for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp; } let o = 0; const parts = sizes.map((s) => { const part = sh.slice(o, o + s); o += s; return part; }); if (range(parts) >= obs) ge++; }
    const p = (ge + 1) / (N + 1), best = rows.reduce((m, r) => r.mean > m.mean ? r : m), worst = rows.reduce((m, r) => r.mean < m.mean ? r : m);
    return { ok: true, rows, p, best, worst, spread: obs, n: recs.length, sig: p < 0.05 && obs >= 5 };
  }

  /* ---- 4. Eksperyment: ocena po tygodniu ---- */
  function evalExperiment(db, exp, today) {
    if (!exp) return null;
    const recs = A.buildRecords(db.days || {}), by = {}; recs.forEach((r) => { by[r.date] = r; });
    const Y = M[exp.y], X = M[exp.x], lag = exp.lag || 0, len = exp.days || 7;
    const elapsed = Math.min(len, A.diffDays(today, exp.start) + 1), end = A.addDays(exp.start, len - 1);
    const met = (v) => isNum(v) && (exp.dir === 'up' ? v >= exp.target - 1e-9 : v <= exp.target + 1e-9);
    let adh = 0, logged = 0; const ys = [];
    for (let i = 0; i < elapsed; i++) {
      const d = A.addDays(exp.start, i), r = by[d]; if (r && isNum(r[exp.x])) { logged++; if (met(r[exp.x])) adh++; }
      const o = by[A.addDays(d, lag)]; if (o && isNum(o[exp.y]) && A.diffDays(today, A.addDays(d, lag)) >= 0) ys.push(o[exp.y]);
    }
    const b0 = A.addDays(exp.start, -14), base = recs.filter((r) => r.date >= b0 && r.date < exp.start && isNum(r[exp.y])).map((r) => r[exp.y]);
    const res = { exp, elapsed, end, adh, logged, done: A.diffDays(today, end) > 0 || elapsed >= len && A.diffDays(today, end) >= 0, yMean: ys.length ? A.mean(ys) : null, baseMean: base.length >= 5 ? A.mean(base) : null, baseN: base.length, nY: ys.length, xLabel: X.label, yLabel: Y.label };
    res.done = A.diffDays(today, exp.start) >= len;
    if (res.yMean !== null && res.baseMean !== null) {
      const sd = A.sd(base) || 1; res.delta = res.yMean - res.baseMean; res.effect = res.delta * (Y.good || 1) / sd;
      res.verdict = res.adh < Math.min(5, len - 2) ? 'za-malo' : Math.abs(res.effect) < 0.4 ? 'bez-zmian' : res.effect > 0 ? 'lepiej' : 'gorzej';
    } else res.verdict = 'brak-danych';
    return res;
  }


  /* ---- 5. Obserwacje z godziną a posiłki ---- */
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const mealTot = (m) => { const o = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0 }; (m.items || []).forEach((it) => { const k = (Number(it.grams) || 0) / 100, p = it.per100 || {}; Object.keys(o).forEach((x) => { o[x] += (p[x] || 0) * k; }); }); return o; };
  function binomP(k, n, p) { /* P(X >= k) dla Bin(n, p) */
    let s = 0, c = 1; const lp = Math.log(p), lq = Math.log(1 - p); let lg = 0;
    const lf = [0]; for (let x = 1; x <= n; x++) lf[x] = lf[x - 1] + Math.log(x);
    for (let x = k; x <= n; x++) { lg = lf[n] - lf[x] - lf[n - x] + x * lp + (n - x) * lq; s += Math.exp(lg); }
    return Math.min(1, s);
  }
  function obsAnalysis(db, today) {
    const days = db.days || {}, entries = [];
    Object.keys(days).filter((d) => !today || d <= today).forEach((d) => (days[d].obs || []).forEach((o) => { const t = toMin(o.t); if (t !== null && o.tag) entries.push({ date: d, t, tag: o.tag, sev: o.sev || 1, text: o.text || '' }); }));
    const byTag = {}; entries.forEach((e) => { (byTag[e.tag] = byTag[e.tag] || []).push(e); });
    const allMeals = []; Object.keys(days).filter((d) => !today || d <= today).forEach((d) => (days[d].meals || []).forEach((m) => { const t = toMin(m.time); if (t !== null) allMeals.push({ date: d, t, m }); }));
    const rows = [];
    Object.keys(byTag).forEach((tag) => {
      const list = byTag[tag]; if (list.length < 4) return;
      const hours = list.map((e) => e.t / 60), buckets = {}; list.forEach((e) => { const h = Math.floor(e.t / 60); buckets[h] = (buckets[h] || 0) + 1; });
      const peak = Object.keys(buckets).reduce((m, h) => buckets[h] > (buckets[m] || 0) ? h : m, Object.keys(buckets)[0]);
      const near = list.map((e) => { let best = null; allMeals.filter((x) => x.date === e.date && x.t <= e.t && e.t - x.t <= 180).forEach((x) => { if (!best || x.t > best.t) best = x; }); return best; });
      const withMeal = near.filter(Boolean).length, row = { tag, n: list.length, peak: Number(peak), peakN: buckets[peak], withMeal, avgSev: A.mean(list.map((e) => e.sev)), foods: [] };
      /* które cechy posiłków poprzedzają obserwację częściej, niż wynika z ich udziału w posiłkach */
      const cand = {}; allMeals.forEach((x) => (x.m.items || []).forEach((it) => (it.tags || []).forEach((t) => { cand[t] = 1; })));
      Object.keys(cand).forEach((t) => {
        const hasTag = (x) => (x.m.items || []).some((it) => (it.tags || []).indexOf(t) >= 0), base = allMeals.filter(hasTag).length / Math.max(1, allMeals.length), k = near.filter((x) => x && hasTag(x)).length;
        if (withMeal >= 4 && base > 0.03 && base < 0.9 && k >= 3) { const p = binomP(k, withMeal, base); if (p < 0.1) row.foods.push({ tag: t, k, n: withMeal, base, p }); }
      });
      row.foods.sort((a, b) => a.p - b.p); row.foods = row.foods.slice(0, 2); rows.push(row);
    });
    rows.sort((a, b) => b.n - a.n); return { rows, total: entries.length };
  }

  /* ---- 6. Głód i sytość ---- */
  function satiety(db, today) {
    const days = db.days || {}, ms = [];
    Object.keys(days).sort().filter((d) => !today || d <= today).forEach((d) => { const arr = (days[d].meals || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')); arr.forEach((m, k) => { const t = mealTot(m), prev = k ? toMin(arr[k - 1].time) : null, cur = toMin(m.time); ms.push({ date: d, m, t, hun: isNum(m.hunger) ? m.hunger : null, sat: isNum(m.sat) ? m.sat : null, gap: prev !== null && cur !== null && cur > prev ? (cur - prev) / 60 : null }); }); });
    const out = { n: ms.filter((x) => x.sat !== null).length, nh: ms.filter((x) => x.hun !== null).length, rows: [], foods: [], gap: null, avgSat: null };
    const sm = ms.filter((x) => x.sat !== null); if (sm.length) out.avgSat = A.mean(sm.map((x) => x.sat));
    const DRV = [['p', 'Białko', ' g'], ['fib', 'Błonnik', ' g'], ['sug', 'Cukry', ' g'], ['f', 'Tłuszcz', ' g'], ['c', 'Węglowodany', ' g'], ['kcal', 'Kalorie', ' kcal']];
    if (sm.length >= 12) DRV.forEach(([k, label]) => { const X = sm.map((x) => x.t[k]), Y = sm.map((x) => x.sat), rho = A.spearman(X, Y); if (rho === null) return; const p = A.pRho(rho, X.length); if (p < 0.1 && Math.abs(rho) >= 0.25) out.rows.push({ key: k, label, rho, p, n: X.length }); });
    out.rows.sort((a, b) => a.p - b.p);
    /* produkty (po nazwie) z najwyższą / najniższą sytością */
    const byFood = {}; sm.forEach((x) => { const seen = {}; (x.m.items || []).forEach((it) => { if ((Number(it.grams) || 0) < 20 || seen[it.name]) return; seen[it.name] = 1; (byFood[it.name] = byFood[it.name] || []).push(x.sat); }); });
    const overall = out.avgSat; Object.keys(byFood).forEach((n) => { if (byFood[n].length >= 4) out.foods.push({ name: n, n: byFood[n].length, mean: A.mean(byFood[n]), diff: A.mean(byFood[n]) - overall }); });
    out.foods.sort((a, b) => b.diff - a.diff); out.foodsTop = out.foods.filter((f) => f.diff >= 0.5).slice(0, 3); out.foodsLow = out.foods.filter((f) => f.diff <= -0.5).slice(-3).reverse();
    const gm = ms.filter((x) => x.hun !== null && x.gap !== null); if (gm.length >= 12) { const rho = A.spearman(gm.map((x) => x.gap), gm.map((x) => x.hun)); if (rho !== null) { const p = A.pRho(rho, gm.length); if (p < 0.1 && Math.abs(rho) >= 0.25) out.gap = { rho, p, n: gm.length }; } }
    return out;
  }

  return { explainDay, extremeDay, whatIf, weekdays, evalExperiment, obsAnalysis, satiety, DOW, DOW3, dow };
});
