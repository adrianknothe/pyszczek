/* Pyszczek: dane przykładowe (syntetyczne) do podglądu analiz. Każdy dzień ma flagę demo:true. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./foods.js'), require('./analysis.js'));
  else root.Demo = factory(root.Food, root.Analysis);
})(typeof self !== 'undefined' ? self : this, function (Food, A) {
  'use strict';

  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const BREAKFAST = ['owsianka z bananem i orzechami włoskimi', 'jajecznica z 3 jaj i 2 kromki chleba żytniego', 'jogurt grecki z granolą i malinami', 'kanapka z serem i pomidorem, kawa z mlekiem',
    'płatki owsiane 60 g na wodzie z borówkami i masłem orzechowym', 'chleb pełnoziarnisty z awokado i jajkiem', 'owsianka z jabłkiem i siemieniem lnianym'];
  const LUNCH = ['pierś z kurczaka 150g, ryż 100g, brokuły', 'makaron 200g z tuńczykiem, passata i parmezan', 'zupa warzywna i bułka', 'łosoś, ziemniaki 200g, sałatka',
    'pierogi 250g', 'kasza gryczana, soczewica i szpinak', 'pizza 2 kawałki', 'kotlet panierowany, ziemniaki 200g, kapusta', 'ryż 150g, tofu 120g, brokuły, papryka'];
  const DINNER = ['kanapka z szynką i ogórkiem', 'sałatka z fetą i oliwkami, chleb', 'naleśniki 2 szt z twarogiem', 'omlet z pieczarkami i serem', 'jogurt naturalny z truskawkami i płatkami owsianymi',
    'zupa krem i chleb', 'makaron 150g z cukinią i pomidorem', 'jajecznica z 2 jaj i chleb'];
  const SNACK = ['jabłko i garść migdałów', 'baton', 'czekolada gorzka 20g', 'banan', 'ciastko i kawa', 'skyr', 'orzechy', 'chipsy'];
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  function generate(today, n, seed) {
    n = n || 75; const r = rng(seed || 7); const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v)); const days = {};
    const start = A.addDays(today, -(n - 1));
    // cykl: początek ~ 26 dni przed końcem okna, długość 28 +/- 2
    const starts = []; let s = A.addDays(today, -9); starts.unshift(s);
    while (s > start) { s = A.addDays(s, -(27 + Math.floor(r() * 3))); starts.unshift(s); }
    const phaseOf = (date) => { let st = null; for (let i = starts.length - 1; i >= 0; i--) if (starts[i] <= date) { st = starts[i]; break; } if (!st) return { cd: 14, ph: 'folikularna' }; const cd = A.diffDays(date, st) + 1; const ph = cd <= 5 ? 'menstruacja' : cd < 13 ? 'folikularna' : cd <= 15 ? 'owulacja' : 'lutealna'; return { cd, ph, pms: ph === 'lutealna' && cd >= 23 }; };
    let prev = { caffeine: 2, alcohol: 0, stress: 5, exercise: 0 };
    for (let i = 0; i < n; i++) {
      const date = A.addDays(start, i); if (i < n - 1 && r() < 0.07) { continue; }
      const ph = phaseOf(date); const d = { demo: true, meals: [], symptoms: {}, stressors: [] };
      const caffeine = clamp(Math.round(2 + gauss() * 1.2), 0, 5), alcohol = r() < 0.2 ? 1 + Math.floor(r() * 3) : 0, exercise = r() < 0.5 ? pick(r, [20, 30, 45, 60]) : 0;
      const steps = Math.round(clamp(7200 + gauss() * 2400 + (exercise ? 1500 : 0), 1500, 16000) / 100) * 100, walkMin = Math.round(clamp(steps / 110 + gauss() * 6, 5, 120) / 5) * 5;
      const stressors = []; ['praca', 'relacje', 'pieniadze', 'czas', 'rodzina'].forEach((k) => { if (r() < (k === 'praca' ? 0.45 : 0.15)) stressors.push(k); });
      let stress = clamp(Math.round(3.8 + stressors.length * 1.0 + (ph.pms ? 1 : 0) + gauss() * 1.0), 1, 10);
      const sleepHours = Math.round(clamp(7.1 + gauss() * 0.9 - (prev.alcohol ? 0.3 : 0), 4.5, 9.5) * 2) / 2;
      const sleepQuality = clamp(Math.round(6 + 0.7 * (sleepHours - 7) - 0.6 * Math.max(0, prev.caffeine - 2) - 0.9 * prev.alcohol - 0.25 * (prev.stress - 5) + 0.01 * prev.exercise + gauss() * 0.9), 1, 10);
      const phMood = ph.ph === 'lutealna' ? (ph.pms ? -1.4 : -0.5) : ph.ph === 'menstruacja' ? -0.6 : ph.ph === 'owulacja' ? 0.5 : 0.2;
      const mood = clamp(Math.round(6.4 + 0.6 * (sleepHours - 7) + 0.0003 * (steps - 7000) + 0.012 * exercise + phMood - 0.25 * (stress - 4.5) + gauss() * 0.9), 1, 10);
      const energy = clamp(Math.round(6.0 + 0.35 * (sleepQuality - 6) + 0.02 * exercise + (ph.ph === 'menstruacja' ? -0.9 : 0) - 0.15 * (stress - 4.5) - 0.2 * prev.alcohol + gauss() * 0.9), 1, 10);
      const water = Math.round(clamp(1700 + gauss() * 500, 600, 3000) / 250) * 250;
      Object.assign(d, { mood, energy, stress, sleepHours, sleepQuality, caffeine, alcohol, exercise, water, stressors, steps, walkMin, obs: [] });
      const addMin = (hm, m) => { const t = Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) + m; return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
      let snacked = false;
      // posiłki
      let bloat = 0;
      [['śniadanie', '08:00', BREAKFAST], ['obiad', '13:30', LUNCH], ['kolacja', r() < 0.15 ? '21:30' : '19:00', DINNER], ['przekąska', '16:30', SNACK]].forEach(([type, time, list]) => {
        if (type === 'przekąska' && r() < 0.35) return; const text = pick(r, list); const p = Food.parseMeal(text); if (!p.items.length) return;
        const tags = new Set(); p.items.forEach((it) => it.tags.forEach((t) => tags.add(t)));
        let sc = 4.1 + gauss() * 0.6; const bad = [];
        if (tags.has('laktoza') && r() < 0.75) { sc -= 1.3; bad.push('wzdęcie'); bloat++; }
        if (tags.has('smażone')) { sc -= 0.7; bad.push('ciężkość'); }
        if (time >= '21:00') { sc -= 0.6; if (r() < 0.6) bad.push('zgaga'); }
        if (tags.has('cukier') && r() < 0.5) { bad.push('senność'); sc -= 0.3; }
        if (tags.has('wysokobłonnikowe')) sc += 0.2;
        const good = sc >= 4 && r() < 0.5 ? ['sytość'] : [];
        if (type === 'przekąska') snacked = true;
        const tt = Food.sumItems(p.items), hunger = clamp(Math.round(3 + gauss() * 0.9 + (type === 'obiad' ? 0.4 : 0) + (type === 'przekąska' ? -0.3 : 0)), 1, 5), sat = clamp(Math.round(2.0 + 0.04 * tt.p + 0.14 * tt.fib - 0.01 * tt.sug + gauss() * 0.55), 1, 5);
        if (bad.includes('wzdęcie') && r() < 0.6) d.obs.push({ id: 'do' + i + type, t: addMin(time, 50 + Math.floor(r() * 70)), tag: 'wzdecie', sev: 1 + Math.floor(r() * 3), text: '' });
        d.meals.push({ id: 'd' + i + type, type, time, text, hunger, sat, items: p.items, after: { score: clamp(Math.round(sc), 1, 5), tags: Array.from(new Set(bad.concat(good))) } });
      });
      if (!snacked && r() < 0.6) d.obs.push({ id: 'dg' + i, t: addMin('17:00', Math.floor(r() * 50)), tag: 'glod', sev: 2 + Math.floor(r() * 2), text: r() < 0.5 ? 'mega głodna' : '' });
      if (ph.ph === 'menstruacja' && r() < 0.6) d.obs.push({ id: 'dk' + i, t: addMin('17:30', Math.floor(r() * 40)), tag: 'skurcz', sev: 1 + Math.floor(r() * 3), text: 'skurcz brzucha' });
      // objawy
      const sym = d.symptoms; const sv = (p) => (r() < p ? 1 + Math.floor(r() * 3) : 0);
      if (sv(0.08 + (stress > 6 ? 0.25 : 0) + (water < 1250 ? 0.2 : 0))) sym.glowa = pick(r, [1, 2, 2, 3]);
      if (bloat || r() < 0.08) sym.wzdecia = clamp(bloat + (ph.pms ? 1 : 0) + (r() < 0.2 ? 1 : 0), 1, 3);
      if (ph.ph === 'menstruacja' && r() < 0.7) sym.brzuch = 1 + Math.floor(r() * 3);
      if (ph.ph === 'menstruacja' && r() < 0.4) sym.plecy = 1 + Math.floor(r() * 2);
      if (sleepHours < 6.5 && r() < 0.6) sym.zmeczenie = 1 + Math.floor(r() * 2); else if (r() < 0.08) sym.zmeczenie = 1;
      if (ph.pms) { if (r() < 0.8) sym.slodycze = 1 + Math.floor(r() * 3); if (r() < 0.6) sym.piersi = 1 + Math.floor(r() * 2); if (r() < 0.6) sym.wahania = 1 + Math.floor(r() * 2); }
      if (r() < 0.05) sym.tradzik = 1;
      Object.keys(sym).forEach((k) => { if (!sym[k]) delete sym[k]; });
      // krwawienie
      const ci = starts.find((st) => A.diffDays(date, st) >= 0 && A.diffDays(date, st) < 5);
      if (ci) d.flow = [3, 4, 3, 2, 1][A.diffDays(date, ci)];
      days[date] = d; prev = { caffeine, alcohol, stress, exercise };
    }
    return days;
  }
  /* kontrola: dane losowe bez żadnych zależności */
  function generateNoise(today, n, seed) {
    const r = rng(seed || 3); const days = {}; const start = A.addDays(today, -(n - 1));
    for (let i = 0; i < n; i++) {
      const date = A.addDays(start, i); const q = () => 1 + Math.floor(r() * 10);
      days[date] = { demo: true, mood: q(), energy: q(), stress: q(), sleepHours: 5 + Math.round(r() * 8) / 2, sleepQuality: q(), caffeine: Math.floor(r() * 5), alcohol: r() < 0.2 ? 1 : 0, exercise: r() < 0.5 ? 30 : 0, water: 1000 + Math.floor(r() * 8) * 250, symptoms: r() < 0.3 ? { glowa: 1 } : {}, stressors: [], meals: [] };
      ['owsianka z bananem', 'pierś z kurczaka 150g, ryż 100g, brokuły', 'kanapka z serem i pomidorem', 'jogurt naturalny z truskawkami'].forEach((t, k) => {
        const p = Food.parseMeal(t); days[date].meals.push({ id: 'n' + i + k, type: 'posiłek', time: '12:00', text: t, items: p.items, after: { score: 1 + Math.floor(r() * 5), tags: r() < 0.2 ? ['wzdęcie'] : [] } });
      });
    }
    return days;
  }
  return { generate, generateNoise };
});
