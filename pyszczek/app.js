/* Pyszczek: aplikacja (widoki, zdarzenia, zapis). Dane tylko w localStorage tej przeglądarki. */
(function () {
  'use strict';
  const A = window.Analysis, Fd = window.Food, C = window.Charts;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = C.esc, fmt = A.fmt, isNum = A.isNum;
  const KEY = 'pyszczek.v1';
  const TODAY = () => A.todayISO();

  /* ---------- stan i zapis ---------- */
  const defaults = () => ({ name: '', age: '', heightCm: '', weightKg: '', activity: 'mid', goal: 'maintain', cycleLen: 28, periodLen: 5, trackCycle: true, hideKcal: false, supplements: [], lastBackup: null, onboarded: false });
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); o.settings = Object.assign(defaults(), o.settings || {}); o.days = o.days || {}; return o; } } catch (e) { /* pusty start */ }
    return { v: 1, settings: defaults(), days: {} };
  }
  let db = load(); let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Pamięć przeglądarki jest pełna. Zrób kopię zapasową w Profilu.'); } }, 200);
  }
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(() => {}); }

  const S = { tab: 'today', date: TODAY(), range: 90, hm: TODAY().slice(0, 7), hs: TODAY(), cmp: { x: 'sleepHours', y: 'mood', lag: 0 }, sheet: null, newSupp: '' };
  const MONTHS_G = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTHS_N = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
  const DOW = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const dateObj = (iso) => new Date(iso + 'T12:00:00');
  const longDate = (iso) => { const d = dateObj(iso); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_G[d.getMonth()]; };
  const dayLabel = (iso) => { const t = TODAY(); if (iso === t) return 'Dziś'; if (iso === A.addDays(t, -1)) return 'Wczoraj'; const d = dateObj(iso); return d.getDate() + ' ' + MONTHS_G[d.getMonth()].slice(0, 3); };
  const day = (date, create) => { let d = db.days[date]; if (!d && create) d = db.days[date] = { meals: [], symptoms: {}, stressors: [] }; return d; };
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };
  const hide = () => db.settings.hideKcal;
  const r0 = (v) => Math.round(v);
  const macroTxt = (t) => (hide() ? '' : r0(t.kcal) + ' kcal, ') + 'białko ' + fmt(t.p, 0) + ' g, węgle ' + fmt(t.c, 0) + ' g, tłuszcz ' + fmt(t.f, 0) + ' g';

  /* ---------- klocki UI ---------- */
  function scale(key, val, kind, lo, hi) {
    let h = '<div class="scale" role="radiogroup">';
    for (let i = 1; i <= 10; i++) h += '<button class="sp' + (val === i ? ' on ' + kind : '') + '" data-a="set" data-k="' + key + '" data-v="' + i + '" role="radio" aria-checked="' + (val === i) + '" aria-label="' + i + '">' + i + '</button>';
    return h + '</div><div class="scale-lbl"><span>' + lo + '</span><span>' + hi + '</span></div>';
  }
  function stepper(key, val, o) {
    return '<div class="stepper"><button class="sb" data-a="step" data-k="' + key + '" data-d="' + (-o.step) + '" data-min="' + o.min + '" data-max="' + o.max + '" data-start="' + o.start + '" aria-label="Mniej">−</button>'
      + '<div class="sv"><b>' + (val == null ? '–' : fmt(val, o.dec || 0)) + '</b><span>' + o.unit + '</span></div>'
      + '<button class="sb" data-a="step" data-k="' + key + '" data-d="' + o.step + '" data-min="' + o.min + '" data-max="' + o.max + '" data-start="' + o.start + '" aria-label="Więcej">+</button></div>';
  }
  const card = (title, hint, body, cls) => '<section class="card ' + (cls || '') + '"><div class="card-hd"><h2>' + title + '</h2>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>' + body + '</section>';
  const prog = (v, t, cls) => '<div class="prog ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, t ? v / t * 100 : 0)).toFixed(0) + '%"></i></div>';
  function topBar(sub) {
    const date = S.date, t = TODAY();
    return '<div class="top"><div class="brand"><img src="icon-192.png" alt=""><b>Pyszczek</b></div>'
      + '<div class="datebar"><button data-a="date" data-d="-1" aria-label="Poprzedni dzień">‹</button><button data-a="date" data-d="today" style="width:auto;padding:0 6px;font-size:14px;font-weight:700;color:var(--ink);min-width:104px">' + dayLabel(date) + '</button><button data-a="date" data-d="1" ' + (date >= t ? 'disabled style="opacity:.3"' : '') + ' aria-label="Następny dzień">›</button></div></div>';
  }
  const wbLabel = (v) => v == null ? 'Zacznij od nastroju i energii' : v < 35 ? 'Trudny dzień' : v < 55 ? 'Raczej średnio' : v < 75 ? 'Całkiem dobrze' : 'Świetny dzień';
  const phaseHint = { menstruacja: 'Energia bywa niższa. Zadbaj o odpoczynek i produkty z żelazem.', folikularna: 'Zwykle energia i nastrój rosną.', owulacja: 'Często szczyt energii i nastroju.', lutealna: 'Możliwe objawy PMS: ochota na słodycze, wahania nastroju.' };

  /* ---------- DZIŚ ---------- */
  function viewToday() {
    const date = S.date, d = db.days[date] || {}, st = db.settings, tg = A.targets(st), cyc = A.cycleInfo(db.days, st);
    const wb = A.wellbeing(d), meals = d.meals || [], tot = A.dayTotals(d), t = TODAY();
    const done = [A.checkedIn(d), isNum(d.sleepHours) || isNum(d.sleepQuality), (d.water > 0) || isNum(d.exercise) || isNum(d.caffeine), meals.length > 0, Object.keys(d.symptoms || {}).length > 0 || d.noSymptoms || (d.stressors || []).length > 0].filter(Boolean).length;
    const streak = A.streak(db.days, t);
    let h = topBar();
    h += '<div class="page-title"><h1>' + (st.name ? 'Cześć, ' + esc(st.name) : 'Cześć') + '</h1><p class="muted">' + longDate(date) + '</p></div>';

    if (!st.onboarded && !Object.keys(db.days).length) {
      h += '<section class="card welcome tint"><h2>Witaj w Pyszczku</h2><ul><li>Codziennie zapisz nastrój, sen, objawy i posiłki. Zajmuje to około dwóch minut.</li><li>Posiłki wpisujesz zwykłym zdaniem, a makro liczy się samo.</li><li>Po kilku dniach Pyszczek pokaże, co faktycznie wpływa na Twoje samopoczucie.</li></ul><div class="btns two"><button class="btn primary" data-a="onboard">Zaczynam</button><button class="btn" data-a="demo-load">Zobacz na przykładzie</button></div></section>';
    }
    const real = Object.keys(db.days).filter((k) => !db.days[k].demo).length;
    if (real >= 7 && (!st.lastBackup || A.diffDays(t, st.lastBackup) >= 14)) h += '<section class="card amber"><div class="row"><div><h3>Czas na kopię zapasową</h3><p class="small">Dane są tylko w tej przeglądarce. Zapisz kopię, żeby ich nie stracić.</p></div><button class="btn sm" data-a="nav" data-t="profile" style="flex:none">Profil</button></div></section>';

    h += '<section class="card hero"><div class="face">' + C.face(wb, 112) + '</div><div style="min-width:0"><div class="score' + (wb == null ? ' none' : '') + '">' + (wb == null ? '–' : wb + '<small>/100</small>') + '</div><div class="lbl">' + wbLabel(wb) + '</div><div class="small muted">' + done + ' z 5 sekcji uzupełnionych</div>' + (streak >= 2 && date === t ? '<div class="small b" style="color:var(--teal-600)">' + streak + ' dni wpisów z rzędu</div>' : '') + prog(done, 5) + '</div></section>';

    if (st.trackCycle) {
      const ph = cyc.phaseOf(date); let body;
      if (ph) {
        const cls = ph.phase === 'menstruacja' ? 'mens' : ph.phase === 'owulacja' ? 'ovu' : ph.phase === 'folikularna' ? 'fol' : '';
        const nd = cyc.next ? A.diffDays(cyc.next, date) : null;
        body = '<div class="cyc"><div class="dot ' + cls + '">' + ph.cd + '</div><div><div class="b">Dzień ' + ph.cd + ' cyklu, ' + A.PHASES[ph.phase].toLowerCase() + '</div><div class="small muted">' + (ph.pms ? 'Zbliża się miesiączka. ' : '') + phaseHint[ph.phase] + '</div>' + (nd !== null && nd > 0 ? '<div class="small" style="margin-top:4px">Następna miesiączka ok. <b>' + dateObj(cyc.next).getDate() + ' ' + MONTHS_G[dateObj(cyc.next).getMonth()] + '</b> (za ' + nd + ' dni)</div>' : '') + '</div></div>';
      } else body = '<p class="small muted">Zaznacz pierwszy dzień miesiączki poniżej (sekcja „Cykl”). Pyszczek zacznie liczyć fazy i przewidywać kolejną.</p>';
      h += '<section class="card tint"><div class="card-hd"><h2>Cykl</h2></div>' + body + '</section>';
    }

    h += card('Jak się czujesz?', '',
      '<div class="field"><div class="field-hd"><b>Nastrój</b><span class="val">' + (isNum(d.mood) ? d.mood + '/10' : '') + '</span></div>' + scale('mood', d.mood, 'pos', 'bardzo źle', 'świetnie') + '</div>'
      + '<div class="field"><div class="field-hd"><b>Energia</b><span class="val">' + (isNum(d.energy) ? d.energy + '/10' : '') + '</span></div>' + scale('energy', d.energy, 'pos', 'wyczerpana', 'pełna sił') + '</div>'
      + '<div class="field"><div class="field-hd"><b>Stres</b><span class="val neg">' + (isNum(d.stress) ? d.stress + '/10' : '') + '</span></div>' + scale('stress', d.stress, 'neg', 'spokój', 'bardzo duży') + '</div>');

    h += card('Sen', 'ostatnia noc',
      '<div class="field"><div class="field-hd"><b>Ile godzin spałaś?</b></div><div style="margin-top:8px">' + stepper('sleepHours', d.sleepHours, { step: 0.5, min: 0, max: 14, start: 7, unit: 'h', dec: 1 }) + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Jakość snu</b><span class="val">' + (isNum(d.sleepQuality) ? d.sleepQuality + '/10' : '') + '</span></div>' + scale('sleepQuality', d.sleepQuality, 'pos', 'koszmarna', 'regeneracyjna') + '</div>');

    const wg = tg.water, wv = d.water || 0;
    h += card('Nawyki', '',
      '<div class="field"><div class="field-hd"><b>Woda</b><span class="val">' + wv + ' / ' + wg + ' ml</span></div>' + prog(wv, wg) + '<div class="chips" style="margin-top:10px"><button class="chip" data-a="water" data-d="250">+250 ml</button><button class="chip" data-a="water" data-d="500">+500 ml</button><button class="chip" data-a="water" data-d="-250">−250 ml</button></div></div>'
      + '<div class="field"><div class="field-hd"><b>Kofeina</b><span class="small muted">kawa, herbata, energetyk</span></div><div style="margin-top:8px">' + stepper('caffeine', d.caffeine, { step: 1, min: 0, max: 12, start: 0, unit: 'porcji' }) + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Alkohol</b><span class="small muted">kieliszek, piwo, drink</span></div><div style="margin-top:8px">' + stepper('alcohol', d.alcohol, { step: 1, min: 0, max: 12, start: 0, unit: 'porcji' }) + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Ruch</b></div><div class="chips" style="margin-top:8px">' + [0, 15, 30, 45, 60, 90].map((m) => '<button class="chip' + (d.exercise === m ? ' on' : '') + '" data-a="set" data-k="exercise" data-v="' + m + '">' + (m === 0 ? 'Brak' : m + ' min') + '</button>').join('') + '</div></div>');

    h += card('Objawy', 'dotknij, aby zwiększyć nasilenie',
      '<div class="chips">' + A.SYMPTOMS.map(([k, l]) => { const v = (d.symptoms || {})[k] || 0; return '<button class="chip' + (v ? ' s' + v : '') + '" data-a="sym" data-k="' + k + '" aria-label="' + l + ', nasilenie ' + v + '">' + l + (v ? '<i>' + '●'.repeat(v) + '</i>' : '') + '</button>'; }).join('')
      + '<button class="chip' + (d.noSymptoms ? ' on' : '') + '" data-a="nosym">Dziś bez objawów</button></div><p class="tiny muted" style="margin-top:8px">1 kropka to lekkie, 3 kropki to silne.</p>');

    h += card('Co Cię stresowało?', '',
      '<div class="chips">' + A.STRESSORS.map(([k, l]) => '<button class="chip rose' + ((d.stressors || []).includes(k) ? ' on' : '') + '" data-a="tog" data-k="stressors" data-v="' + k + '">' + l + '</button>').join('') + '</div>');

    if (st.trackCycle) {
      h += card('Cykl: krwawienie', '',
        '<div class="chips">' + [[0, 'Brak'], [1, 'Plamienie'], [2, 'Lekkie'], [3, 'Średnie'], [4, 'Obfite']].map(([v, l]) => '<button class="chip rose' + ((d.flow || 0) === v ? ' on' : '') + '" data-a="set" data-k="flow" data-v="' + v + '">' + l + '</button>').join('') + '</div>');
    }
    if ((st.supplements || []).length) {
      h += card('Suplementy i leki', 'zaznacz, co wzięłaś',
        '<div class="chips">' + st.supplements.map((s) => '<button class="chip' + ((d.supp || {})[s] ? ' on' : '') + '" data-a="supp" data-v="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>');
    }

    h += '<section class="card"><div class="card-hd"><h2>Posiłki</h2><span class="hint">' + (meals.length ? meals.length + ' zapisane' : 'jeszcze nic') + '</span></div>'
      + (meals.length ? '<p class="small" style="margin-bottom:10px">' + macroTxt(tot) + '</p>' : '<p class="small muted" style="margin-bottom:10px">Napisz zwykłym zdaniem, co zjadłaś. Makro policzy się samo.</p>')
      + '<button class="btn" data-a="sh-new">Dodaj posiłek</button></section>';

    h += card('Notatka', '', '<textarea data-i="note" placeholder="Jak minął dzień? Co poprawiło humor, co Cię martwiło?">' + esc(d.note || '') + '</textarea>');
    return h;
  }

  /* ---------- POSIŁKI ---------- */
  function macroRow(label, val, target, unit, cls) {
    return '<div class="macro"><span>' + label + '</span>' + prog(val, target, cls) + '<b>' + fmt(val, 0) + (target ? '<span class="muted" style="font-weight:500"> / ' + fmt(target, 0) + '</span>' : '') + ' ' + unit + '</b></div>';
  }
  function viewMeals() {
    const date = S.date, d = db.days[date] || {}, st = db.settings, tg = A.targets(st), tot = A.dayTotals(d), meals = (d.meals || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    let h = topBar() + '<div class="page-title"><h1>Posiłki</h1><p class="muted">' + longDate(date) + '</p></div>';
    h += '<section class="card"><div class="card-hd"><h2>Podsumowanie dnia</h2><span class="hint">cele orientacyjne</span></div>'
      + (hide() ? '' : macroRow('Energia', tot.kcal, tg.kcal, 'kcal', tg.kcal && tot.kcal > tg.kcal * 1.1 ? 'over' : ''))
      + macroRow('Białko', tot.p, tg.protein, 'g') + macroRow('Węgle', tot.c, 0, 'g') + macroRow('Tłuszcz', tot.f, 0, 'g')
      + macroRow('Błonnik', tot.fib, tg.fiber, 'g') + macroRow('Żelazo', tot.fe, tg.iron, 'mg', 'pink') + macroRow('Wapń', tot.ca, tg.calcium, 'mg')
      + (tg.kcal ? '' : '<p class="tiny muted" style="margin-top:6px">Uzupełnij wiek, wzrost i wagę w Profilu, aby zobaczyć cel energii.</p>') + '</section>';
    h += '<div style="margin-bottom:12px"><button class="btn primary" data-a="sh-new">Dodaj posiłek</button></div>';
    if (!meals.length) {
      h += '<section class="card empty"><svg class="em" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#E3F7F4"/><circle cx="23" cy="28" r="3" fill="#11302E"/><circle cx="41" cy="28" r="3" fill="#11302E"/><circle cx="17" cy="38" r="4" fill="#EE4D8B" opacity=".3"/><circle cx="47" cy="38" r="4" fill="#EE4D8B" opacity=".3"/><path d="M24 40q8 8 16 0" fill="none" stroke="#11302E" stroke-width="3" stroke-linecap="round"/></svg><h2>Pusto na talerzu</h2><p>Wpisz na przykład „owsianka z bananem, orzechami i łyżką masła orzechowego”. Pyszczek rozpozna produkty i policzy makro.</p></section>';
    }
    meals.forEach((m) => {
      const t = Fd.sumItems(m.items); const sc = m.after && m.after.score;
      h += '<section class="card meal"><div class="meal-hd"><div><b>' + esc(m.type || 'Posiłek') + '</b> <span class="muted small">' + esc(m.time || '') + '</span></div><button class="btn sm" data-a="sh-edit" data-id="' + m.id + '">Edytuj</button></div>'
        + '<div class="meal-items">' + m.items.map((it) => esc(it.name.replace(/ \(.*\)$/, '')) + ' ' + r0(it.grams) + ' g').join(', ') + '</div>'
        + '<div class="meal-mac">' + (hide() ? '' : '<span>' + r0(t.kcal) + ' <em>kcal</em></span>') + '<span>' + fmt(t.p, 0) + ' <em>g białka</em></span><span>' + fmt(t.c, 0) + ' <em>g węgli</em></span><span>' + fmt(t.f, 0) + ' <em>g tłuszczu</em></span></div>'
        + '<div class="small muted" style="margin-top:12px">Jak się czułaś po posiłku?</div><div class="rate">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (sc === v ? 'on' + (v <= 2 ? ' low' : '') : '') + '" data-a="rate" data-id="' + m.id + '" data-v="' + v + '" aria-label="Ocena ' + v + ' z 5">' + v + '</button>').join('') + '</div>'
        + ((m.after && m.after.tags && m.after.tags.length) ? '<div class="tagrow">' + m.after.tags.map((g) => '<span class="tag ' + (A.AFTER_TAGS.find((x) => x[0] === g) && ['energia', 'sytość'].includes(g) ? 'good' : 'bad') + '">' + esc(g) + '</span>').join('') + '</div>' : '') + '</section>';
    });
    return h;
  }

  /* ---------- WNIOSKI ---------- */
  const trend = (c) => c.delta === null ? '' : (Math.abs(c.delta) < (c.dec ? 0.15 : 1) ? '<span class="d eq">bez zmian</span>' : '<span class="d ' + ((c.good ? c.delta * c.good > 0 : c.delta > 0) ? 'up' : 'dn') + '">' + (c.delta > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(c.delta), c.dec) + '</span>');
  function insCard(r) {
    const s = r.sentence, tone = s.tone === 'good' ? 'good' : s.tone === 'bad' ? 'bad' : '';
    return '<div class="ins ' + tone + '"><div class="bar"></div><div><h3>' + esc(s.title) + '</h3><p>' + esc(s.detail) + '</p><span class="badge ' + (r.conf === 'wstępna' ? 'a' : r.conf === 'wyraźna' ? 'g' : '') + '">' + r.conf + '</span><span class="badge">n=' + r.n + ', ρ=' + fmt(r.rho, 2) + '</span></div></div>';
  }
  const CMP_KEYS = [['Samopoczucie', ['mood', 'energy', 'stress', 'wbCore']], ['Sen', ['sleepHours', 'sleepQuality']], ['Nawyki', ['water', 'caffeine', 'alcohol', 'exerciseMin']], ['Jedzenie', ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'iron', 'calcium', 'afterAvg']], ['Objawy', ['symptoms'].concat(A.SYMPTOMS.map((x) => 'sym_' + x[0]))]];

  function viewInsights() {
    const res = A.analyze(db, { today: TODAY(), range: S.range }), tg = A.targets(db.settings);
    let h = '<div class="top"><div class="brand"><img src="icon-192.png" alt=""><b>Pyszczek</b></div></div><div class="page-title"><h1>Wnioski</h1><p class="muted">Co naprawdę wpływa na Twoje samopoczucie</p></div>';
    h += '<div class="seg" role="tablist">' + [[14, '14 dni'], [30, '30 dni'], [90, '90 dni'], [0, 'Wszystko']].map(([v, l]) => '<button class="' + ((S.range || 0) === v ? 'on' : '') + '" data-a="range" data-v="' + v + '">' + l + '</button>').join('') + '</div>';

    res.alerts.forEach((a) => { h += '<section class="card ' + (a.level === 'warn' ? 'amber' : 'tint') + '"><p class="small" style="color:var(--ink)">' + esc(a.text) + '</p></section>'; });

    const nd = res.checkedDays;
    if (nd < 14) {
      h += '<section class="card tint"><h2>Zbieram dane</h2><p class="small muted" style="margin:4px 0 8px">' + (nd < 7 ? 'Po 7 dniach wpisów pojawi się podsumowanie tygodnia, a po 14 pierwsze zależności.' : 'Po 14 dniach wpisów pojawią się pierwsze zależności.') + ' Masz ' + nd + ' z 14 dni.</p>' + prog(nd, 14) + (nd < 3 ? '<button class="btn sm" style="margin-top:12px" data-a="demo-load">Zobacz na danych przykładowych</button>' : '') + '</section>';
    }
    if (nd >= 3 && res.week.length) {
      h += card('Ostatni tydzień', 'zmiana vs tydzień wcześniej', '<div class="tiles">' + res.week.slice(0, 8).map((c) => '<div class="tile"><div class="t">' + c.label + '</div><div class="n">' + fmt(c.cur, c.dec) + '<span class="small muted" style="font-weight:600">' + c.unit + '</span></div>' + trend(c) + '</div>').join('') + '</div>');
    }
    if (nd >= 3) {
      const first = res.recs.length ? res.recs[0].date : TODAY(); const from = S.range ? A.addDays(TODAY(), -(S.range - 1)) : first;
      const ser = (k) => res.recs.map((r) => [r.date, r[k]]);
      h += card('Trendy', S.range && S.range <= 14 ? 'wartości dzienne' : 'średnia z 3 dni',
        C.line({ from, to: TODAY(), min: 1, max: 10, ticks: [1, 5, 10], smooth: S.range && S.range <= 14 ? 1 : 3, label: 'Nastrój, energia i stres w czasie', series: [{ color: '#12B3A4', data: ser('mood') }, { color: '#EE4D8B', data: ser('energy') }, { color: '#5B7F7B', dash: '2 5', data: ser('stress') }] })
        + '<div class="legend"><span><i style="background:#12B3A4"></i>Nastrój</span><span><i style="background:#EE4D8B"></i>Energia</span><span><i style="background:#5B7F7B"></i>Stres</span></div>'
        + '<div style="margin-top:16px"><h3>Sen</h3>' + C.bars({ from, to: TODAY(), max: 12, band: [7, 9], label: 'Godziny snu', data: ser('sleepHours'), color: (v) => (v >= 7 && v <= 9) ? '#12B3A4' : v < 6 ? '#F4A3C4' : '#8FD6CE' }) + '<p class="tiny muted">Zielone tło to zalecane 7–9 godzin.</p></div>');
    }

    const corr = res.correlations;
    if (nd >= 14) {
      h += '<section class="card"><div class="card-hd"><h2>Zależności w Twoich danych</h2><span class="hint">' + corr.tested + ' sprawdzonych</span></div>';
      if (corr.confirmed.length) h += corr.confirmed.map(insCard).join('');
      else h += '<p class="small muted">Na razie żadna zależność nie wyróżnia się na tle przypadku. To normalne przy małej liczbie dni, więc zapisuj dalej.</p>';
      if (corr.preliminary.length) h += '<details style="margin-top:10px"><summary class="small b" style="cursor:pointer;color:var(--teal-600)">Wstępne sygnały (' + corr.preliminary.length + ')</summary><p class="tiny muted" style="margin:6px 0">Mogą być przypadkowe. Potraktuj je jak podpowiedź do obserwacji.</p>' + corr.preliminary.map(insCard).join('') + '</details>';
      h += '<p class="tiny muted" style="margin-top:10px">ρ (rho) to siła zależności od −1 do 1. Wyniki są poprawione na wielokrotne testowanie, żeby ograniczyć przypadkowe trafienia.</p></section>';
      if (res.experiment) h += '<section class="card rose"><h2>Eksperyment na ten tydzień</h2><p class="small" style="margin-top:4px">' + esc(res.experiment.text) + '</p></section>';
    }

    if (res.bestWorst) {
      const bw = res.bestWorst;
      h += card('Najlepsze i najtrudniejsze dni', 'górna i dolna trójka dni', '<p class="small muted" style="margin-bottom:6px">Porównanie ' + bw.nTop + ' najlepszych dni (średnio ' + fmt(bw.topAvg, 0) + '/100) z ' + bw.nBottom + ' najtrudniejszymi (' + fmt(bw.bottomAvg, 0) + '/100).</p>'
        + (bw.rows.length ? '<div class="bw" style="font-size:12px;color:var(--muted);font-weight:700"><span></span><span>najlepsze</span><span>trudne</span></div>' + bw.rows.map((r) => { const M = A.METRICS[r.key]; return '<div class="bw"><span>' + r.label + '</span><span class="a">' + fmt(r.top, M.dec) + '</span><span class="c">' + fmt(r.bottom, M.dec) + '</span></div>'; }).join('') : '<p class="small muted">Nie ma jeszcze wyraźnych różnic między tymi dniami.</p>'));
    }

    if (nd >= 10) {
      const f = res.food; let body;
      if (f.n < 14) body = '<p class="small muted">Oceniaj samopoczucie po posiłkach (pod każdym zapisanym posiłkiem), a Pyszczek wskaże produkty, po których czujesz się gorzej lub lepiej. Masz ' + f.n + ' z 14 ocenionych posiłków.</p>' + prog(f.n, 14);
      else if (!f.rows.length) body = '<p class="small muted">Nic nie wyróżnia się na tle przypadku (' + f.n + ' ocenionych posiłków).</p>';
      else body = f.rows.map((t) => '<div class="ins ' + (t.tone === 'good' ? 'good' : 'bad') + '"><div class="bar"></div><div><p style="color:var(--ink);margin:0">' + esc(t.text) + '</p><span class="badge">' + t.nA + ' vs ' + t.nB + ' posiłków</span></div></div>').join('') + '<p class="tiny muted" style="margin-top:8px">Posiłki łączą wiele składników naraz, więc to wskazówka do sprawdzenia, a nie dowód. Spróbuj wyeliminować jeden element na 1–2 tygodnie i porównaj.</p>';
      h += card('Jedzenie a samopoczucie', f.n + ' ocen', body);
    }
    if (res.stressSources.length) {
      h += card('Źródła stresu', 'Twój stres, gdy…', res.stressSources.map((s) => '<div class="bw"><span>' + esc(s.label) + ' <span class="tiny muted">(' + s.n + ' dni)</span></span><span class="c">' + fmt(s.stressWith) + '</span><span class="a">' + fmt(s.stressWithout) + '</span></div>').join('') + '<p class="tiny muted">Pierwsza liczba: średni stres w dni z tym źródłem. Druga: bez niego.</p>');
    }

    const cy = res.cycle;
    if (db.settings.trackCycle && (cy.info.starts.length || nd >= 14)) {
      let body = '';
      if (!cy.info.starts.length) body = '<p class="small muted">Zaznacz dni krwawienia w sekcji „Cykl”, aby zobaczyć wzorce w poszczególnych fazach.</p>';
      else {
        body += '<div class="kv"><span>Średnia długość cyklu</span><b>' + cy.info.avg + ' dni' + (cy.info.valid.length >= 2 && cy.info.sdLen !== null ? ' (±' + fmt(cy.info.sdLen, 1) + ')' : '') + '</b></div><div class="kv"><span>Średni czas miesiączki</span><b>' + cy.info.periodLen + ' dni</b></div>' + (cy.info.next ? '<div class="kv"><span>Następna miesiączka</span><b>ok. ' + dateObj(cy.info.next).getDate() + ' ' + MONTHS_G[dateObj(cy.info.next).getMonth()] + '</b></div>' : '');
        if (cy.phases) body += '<div style="margin-top:12px"><div class="phase h"><span>Faza</span><span>Nastrój</span><span>Energia</span><span>Objawy</span></div>' + cy.phases.map((p) => '<div class="phase"><b>' + ({ menstruacja: 'Menstruacja', folikularna: 'Folikularna', owulacja: 'Owulacja', lutealna: 'Lutealna' })[p.phase] + ' <span class="tiny muted">(' + p.n + ')</span></b><span>' + fmt(p.mood) + '</span><span>' + fmt(p.energy) + '</span><span>' + fmt(p.symptoms) + '</span></div>').join('') + '</div>';
        if (cy.findings.length) body += cy.findings.map((g) => '<div class="ins ' + (g.rows.some((x) => x.tone === 'bad') ? 'bad' : 'good') + '"><div class="bar"></div><div><h3>' + esc(g.title) + '</h3><p class="tiny" style="margin-bottom:4px">w porównaniu z: ' + esc(g.vs) + '</p>' + g.rows.map((x) => '<div class="kv" style="padding:4px 0;border:0"><span style="color:var(--ink)">' + esc(x.label) + '</span><b style="color:' + (x.tone === 'bad' ? 'var(--pink-600)' : 'var(--teal-600)') + '">' + fmt(x.a, 1) + ' vs ' + fmt(x.b, 1) + '</b></div>').join('') + (g.prelim ? '<span class="badge a">wstępne</span>' : '') + '</div></div>').join('');
        if (cy.cycles < 2) body += '<p class="tiny muted" style="margin-top:8px">Wzorce cyklu są wiarygodne po 2–3 pełnych cyklach. Na razie to wstępny obraz.</p>';
      }
      h += card('Cykl a samopoczucie', cy.cycles + ' ' + (cy.cycles === 1 ? 'pełny cykl' : 'pełnych cykli'), body);
    }

    if (res.nutrition) {
      const n = res.nutrition, sp = n.split;
      h += card('Odżywianie na tle celów', 'średnia z ' + n.days + ' dni',
        (hide() ? '' : macroRow('Energia', n.kcal, tg.kcal, 'kcal')) + macroRow('Białko', n.protein, tg.protein, 'g') + macroRow('Błonnik', n.fiber, tg.fiber, 'g') + macroRow('Żelazo', n.iron, tg.iron, 'mg', 'pink') + macroRow('Wapń', n.calcium, tg.calcium, 'mg')
        + '<div class="split"><i style="width:' + sp.p + '%;background:#12B3A4"></i><i style="width:' + sp.c + '%;background:#8FD6CE"></i><i style="width:' + sp.f + '%;background:#EE4D8B"></i></div><div class="legend"><span><i style="background:#12B3A4"></i>Białko ' + sp.p + '%</span><span><i style="background:#8FD6CE"></i>Węgle ' + sp.c + '%</span><span><i style="background:#EE4D8B"></i>Tłuszcz ' + sp.f + '%</span></div>'
        + '<p class="tiny muted" style="margin-top:8px">Udział energii. Cele są orientacyjne (zalecenia EFSA/IŻŻ dla dorosłych kobiet) i nie zastępują porady dietetyka. Do analizy liczą się dni z zapisem co najmniej 600 kcal.</p>');
    }

    /* porównywarka */
    const opt = (sel) => CMP_KEYS.map(([g, ks]) => '<optgroup label="' + g + '">' + ks.map((k) => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + A.metricLabel(k) + '</option>').join('') + '</optgroup>').join('');
    const cmp = A.compare(db, S.cmp.x, S.cmp.y, S.cmp.lag); let cb = '';
    if (!cmp.ok) cb = '<p class="small muted" style="margin-top:12px">Za mało wspólnych dni (' + cmp.n + '). Potrzeba co najmniej 10.</p>';
    else {
      const X = A.METRICS[S.cmp.x], Y = A.METRICS[S.cmp.y], ar = Math.abs(cmp.rho), strength = ar < 0.2 ? 'bardzo słaba' : ar < 0.4 ? 'słaba' : ar < 0.6 ? 'umiarkowana' : 'silna';
      cb = '<div style="margin-top:12px">' + C.scatter({ points: cmp.points, xl: X.label + (X.unit ? ' (' + X.unit.trim() + ')' : ''), yl: Y.label, xdec: X.dec, ydec: Y.dec, label: 'Wykres zależności' }) + '</div>'
        + '<p class="small" style="margin-top:6px"><b>' + (cmp.rho >= 0 ? 'Dodatnia' : 'Ujemna') + ', ' + strength + '</b> (ρ=' + fmt(cmp.rho, 2) + ', n=' + cmp.n + '). ' + (cmp.p < 0.05 ? 'Taka zależność jest mało prawdopodobna jako przypadek (p=' + (cmp.p < 0.001 ? '<0,001' : fmt(cmp.p, 3)) + ').' : 'Może to być przypadek (p=' + fmt(cmp.p, 2) + ').') + '</p>'
        + (cmp.groups ? '<p class="small muted" style="margin-top:4px">' + esc(A.metricLabel(S.cmp.x)) + ' powyżej ' + fmt(cmp.groups.med, X.dec) + X.unit + ': ' + esc(Y.label.toLowerCase()) + ' średnio ' + fmt(cmp.groups.hiMean, Y.dec) + ' wobec ' + fmt(cmp.groups.loMean, Y.dec) + ' w pozostałe dni.</p>' : '');
    }
    h += card('Porównaj dwie rzeczy', 'dowolna para',
      '<div class="stack"><div><label class="lb">Co zmieniam (przyczyna)</label><select data-i="cmp-x">' + opt(S.cmp.x) + '</select></div><div><label class="lb">Co sprawdzam (skutek)</label><select data-i="cmp-y">' + opt(S.cmp.y) + '</select></div><div><label class="lb">Kiedy</label><select data-i="cmp-lag"><option value="0"' + (S.cmp.lag === 0 ? ' selected' : '') + '>Tego samego dnia</option><option value="1"' + (S.cmp.lag === 1 ? ' selected' : '') + '>Następnego dnia</option></select></div></div>' + cb);

    h += '<p class="disclaimer">Pyszczek pokazuje zależności statystyczne w Twoich zapisach. Korelacja nie dowodzi przyczyny, a wyniki nie są diagnozą ani poradą medyczną. Przy niepokojących objawach skontaktuj się z lekarzem.</p>';
    return h;
  }

  /* ---------- HISTORIA ---------- */
  function viewHistory() {
    const [y, m] = S.hm.split('-').map(Number), first = new Date(y, m - 1, 1), nd = new Date(y, m, 0).getDate(), lead = (first.getDay() + 6) % 7, t = TODAY();
    let h = '<div class="top"><div class="brand"><img src="icon-192.png" alt=""><b>Pyszczek</b></div></div><div class="page-title"><h1>Historia</h1><p class="muted">Kolor dnia pokazuje wskaźnik samopoczucia</p></div>';
    h += '<section class="card"><div class="row" style="margin-bottom:12px"><button class="sb" data-a="month" data-d="-1" aria-label="Poprzedni miesiąc">‹</button><b style="font-size:17px">' + MONTHS_N[m - 1] + ' ' + y + '</b><button class="sb" data-a="month" data-d="1" aria-label="Następny miesiąc">›</button></div><div class="cal">';
    ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].forEach((w) => { h += '<div class="wd">' + w + '</div>'; });
    for (let i = 0; i < lead; i++) h += '<button class="out" tabindex="-1" aria-hidden="true"></button>';
    for (let d = 1; d <= nd; d++) {
      const iso = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'), dd = db.days[iso], wb = dd ? A.wellbeing(dd) : null, bg = C.heat(wb);
      h += '<button class="' + (iso === t ? 'today ' : '') + (iso === S.hs ? 'sel' : '') + '" data-a="hsel" data-v="' + iso + '" style="' + (bg ? 'background:' + bg : '') + '" aria-label="' + d + ' ' + MONTHS_G[m - 1] + (wb != null ? ', wskaźnik ' + wb : '') + '">' + d + (dd && (dd.flow || 0) >= 1 ? '<span class="fl"></span>' : '') + (dd && dd.note ? '<span class="nt"></span>' : '') + '</button>';
    }
    h += '</div><div style="margin-top:14px"><div class="heatbar"></div><div class="scale-lbl"><span>gorszy dzień</span><span>lepszy dzień</span></div><p class="tiny muted" style="margin-top:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--pink);margin-right:5px"></span>krwawienie</p></div></section>';
    const d = db.days[S.hs];
    h += '<section class="card"><div class="card-hd"><h2>' + longDate(S.hs) + '</h2></div>';
    if (!d || (!A.checkedIn(d) && !(d.meals || []).length && !d.note)) h += '<p class="small muted" style="margin-bottom:12px">Brak wpisów z tego dnia.</p>';
    else {
      const wb = A.wellbeing(d), tot = A.dayTotals(d), sy = Object.keys(d.symptoms || {});
      h += '<div class="kv"><span>Wskaźnik dnia</span><b>' + (wb == null ? '–' : wb + '/100') + '</b></div><div class="kv"><span>Nastrój, energia, stres</span><b>' + [d.mood, d.energy, d.stress].map((v) => isNum(v) ? v : '–').join(', ') + '</b></div>'
        + '<div class="kv"><span>Sen</span><b>' + (isNum(d.sleepHours) ? fmt(d.sleepHours) + ' h' : '–') + (isNum(d.sleepQuality) ? ', jakość ' + d.sleepQuality + '/10' : '') + '</b></div>'
        + (sy.length ? '<div class="kv"><span>Objawy</span><b>' + sy.map((k) => esc((A.SYMPTOMS.find((x) => x[0] === k) || [0, k])[1]) + ' ' + d.symptoms[k] + '/3').join(', ') + '</b></div>' : '')
        + ((d.meals || []).length ? '<div class="kv"><span>Posiłki</span><b>' + d.meals.length + ', ' + macroTxt(tot) + '</b></div>' : '')
        + (d.note ? '<div class="kv"><span>Notatka</span><b style="max-width:70%;font-weight:600">' + esc(d.note) + '</b></div>' : '');
    }
    return h + '<button class="btn" data-a="hopen" style="margin-top:6px">Otwórz ten dzień</button></section>';
  }

  /* ---------- PROFIL ---------- */
  function viewProfile() {
    const st = db.settings, tg = A.targets(st), nDays = Object.keys(db.days).length, nDemo = Object.keys(db.days).filter((k) => db.days[k].demo).length;
    const tog = (k, title, sub) => '<div class="toggle"><div><b>' + title + '</b><div class="small muted">' + sub + '</div></div><button class="sw' + (st[k] ? ' on' : '') + '" role="switch" aria-checked="' + !!st[k] + '" aria-label="' + title + '" data-a="stog" data-k="' + k + '"></button></div>';
    let h = '<div class="top"><div class="brand"><img src="icon-192.png" alt=""><b>Pyszczek</b></div></div><div class="page-title"><h1>Profil</h1><p class="muted">Dane zostają na tym urządzeniu</p></div>';
    h += card('O mnie', 'do wyliczenia celów', '<div class="stack"><div><label class="lb" for="p-name">Imię</label><input id="p-name" type="text" data-i="prof" data-k="name" value="' + esc(st.name) + '" autocomplete="given-name"></div>'
      + '<div class="grid3"><div><label class="lb" for="p-age">Wiek</label><input id="p-age" type="number" inputmode="numeric" data-i="prof" data-k="age" value="' + esc(st.age) + '"></div><div><label class="lb" for="p-h">Wzrost (cm)</label><input id="p-h" type="number" inputmode="numeric" data-i="prof" data-k="heightCm" value="' + esc(st.heightCm) + '"></div><div><label class="lb" for="p-w">Waga (kg)</label><input id="p-w" type="number" inputmode="decimal" data-i="prof" data-k="weightKg" value="' + esc(st.weightKg) + '"></div></div>'
      + '<div class="grid2"><div><label class="lb" for="p-act">Aktywność</label><select id="p-act" data-i="prof" data-k="activity"><option value="low"' + (st.activity === 'low' ? ' selected' : '') + '>Niska</option><option value="mid"' + (st.activity === 'mid' ? ' selected' : '') + '>Umiarkowana</option><option value="high"' + (st.activity === 'high' ? ' selected' : '') + '>Wysoka</option></select></div><div><label class="lb" for="p-goal">Cel</label><select id="p-goal" data-i="prof" data-k="goal"><option value="maintain"' + (st.goal === 'maintain' ? ' selected' : '') + '>Utrzymanie</option><option value="lose"' + (st.goal === 'lose' ? ' selected' : '') + '>Redukcja</option><option value="gain"' + (st.goal === 'gain' ? ' selected' : '') + '>Przyrost</option></select></div></div></div>');
    h += '<section class="card tint"><div class="card-hd"><h2>Moje cele dzienne</h2></div><div class="kv"><span>Energia</span><b>' + (tg.kcal ? tg.kcal + ' kcal' : 'uzupełnij dane') + '</b></div><div class="kv"><span>Białko</span><b>' + tg.protein + ' g</b></div><div class="kv"><span>Błonnik</span><b>' + tg.fiber + ' g</b></div><div class="kv"><span>Żelazo</span><b>' + tg.iron + ' mg</b></div><div class="kv"><span>Wapń</span><b>' + tg.calcium + ' mg</b></div><div class="kv"><span>Woda</span><b>' + tg.water + ' ml</b></div><p class="tiny muted" style="margin-top:8px">Energia wg wzoru Mifflina-St Jeora, żelazo i wapń wg norm EFSA dla dorosłych kobiet. To wartości orientacyjne.</p></section>';
    h += '<section class="card">' + tog('trackCycle', 'Śledzę cykl', 'Fazy, prognoza miesiączki i analiza wzorców')
      + tog('hideKcal', 'Ukryj kalorie', 'Pokazuj tylko białko, węgle, tłuszcz i samopoczucie') + '</section>';
    h += card('Suplementy i leki', 'pojawią się w sekcji Dziś',
      '<div class="chips">' + (st.supplements || []).map((s, i) => '<button class="chip on" data-a="supp-del" data-i="' + i + '" aria-label="Usuń ' + esc(s) + '">' + esc(s) + ' ×</button>').join('') + '</div><div class="grid2" style="grid-template-columns:1fr auto;margin-top:10px"><input type="text" id="p-supp" placeholder="np. żelazo, witamina D" data-i="supp-new" value="' + esc(S.newSupp) + '"><button class="btn sm" style="min-height:46px" data-a="supp-add">Dodaj</button></div>');
    if (st.trackCycle) h += card('Cykl: wartości startowe', 'do czasu zebrania własnych danych', '<div class="grid2"><div><label class="lb" for="p-cl">Długość cyklu (dni)</label><input id="p-cl" type="number" inputmode="numeric" data-i="prof" data-k="cycleLen" value="' + esc(st.cycleLen) + '"></div><div><label class="lb" for="p-pl">Czas miesiączki (dni)</label><input id="p-pl" type="number" inputmode="numeric" data-i="prof" data-k="periodLen" value="' + esc(st.periodLen) + '"></div></div>');
    h += card('Raport na wizytę', '', '<p class="small muted" style="margin-bottom:10px">Zestawienie z ostatnich 90 dni do wydruku lub zapisu jako PDF, np. dla lekarza.</p><button class="btn" data-a="nav" data-t="report">Otwórz raport</button>');
    h += card('Moje dane', nDays + ' dni zapisanych', '<div class="btns"><button class="btn" data-a="export">Zapisz kopię zapasową</button><button class="btn ghost" data-a="import">Wczytaj kopię</button>'
      + (nDemo ? '<button class="btn ghost" data-a="demo-clear">Usuń dane przykładowe (' + nDemo + ' dni)</button>' : '<button class="btn ghost" data-a="demo-load">Wczytaj dane przykładowe</button>')
      + '<button class="btn danger" data-a="wipe">Usuń wszystkie dane</button></div>' + (st.lastBackup ? '<p class="tiny muted" style="margin-top:8px">Ostatnia kopia: ' + st.lastBackup + '</p>' : '')
      + '<p class="tiny muted" style="margin-top:8px">Pyszczek nie wysyła Twoich wpisów na żaden serwer. Jedyne zapytanie sieciowe to opcjonalne wyszukiwanie produktu w Open Food Facts.</p>');
    return h + '<p class="disclaimer">Pyszczek nie jest wyrobem medycznym i nie stawia diagnoz. Wartości odżywcze są orientacyjne. Jeśli odczuwasz niepokojące objawy, skontaktuj się z lekarzem.</p>';
  }

  /* ---------- RAPORT ---------- */
  function viewReport() {
    const res = A.analyze(db, { today: TODAY(), range: 90 }), st = db.settings, r = res.inRange.filter((x) => x.ci);
    const avg = (k) => A.mean(r.map((x) => x[k]).filter(isNum)); const cy = res.cycle.info;
    const symRows = A.SYMPTOMS.map(([k, l]) => { const days = r.filter((x) => (x['sym_' + k] || 0) > 0); return { l, n: days.length, sev: days.length ? A.mean(days.map((x) => x['sym_' + k])) : 0 }; }).filter((x) => x.n).sort((a, b) => b.n - a.n);
    let h = '<div class="top noprint"><button class="btn sm" data-a="nav" data-t="profile">‹ Wróć</button><button class="btn sm primary" data-a="print">Drukuj lub zapisz PDF</button></div>';
    h += '<section class="card report"><h1>Raport zdrowotny</h1><p class="muted">' + (st.name ? esc(st.name) + ', ' : '') + 'ostatnie 90 dni do ' + longDate(TODAY()) + '. Dni z wpisem: ' + r.length + '.</p></section>';
    h += card('Samopoczucie i sen', '', ['mood', 'energy', 'stress', 'sleepHours', 'sleepQuality', 'water', 'exerciseMin'].map((k) => { const M = A.METRICS[k]; return '<div class="kv"><span>' + M.label + ' (średnio)</span><b>' + fmt(avg(k), M.dec) + M.unit + '</b></div>'; }).join(''), 'report');
    if (symRows.length) h += card('Objawy', 'liczba dni i średnie nasilenie', symRows.map((x) => '<div class="kv"><span>' + x.l + '</span><b>' + x.n + ' dni, nasilenie ' + fmt(x.sev, 1) + '/3</b></div>').join(''), 'report');
    if (st.trackCycle && cy.starts.length) h += card('Cykl', '', '<div class="kv"><span>Liczba zapisanych cykli</span><b>' + Math.max(0, cy.starts.length - 1) + '</b></div><div class="kv"><span>Średnia długość cyklu</span><b>' + cy.avg + ' dni' + (cy.sdLen != null ? ' (±' + fmt(cy.sdLen, 1) + ')' : '') + '</b></div><div class="kv"><span>Średni czas krwawienia</span><b>' + cy.periodLen + ' dni</b></div><div class="kv"><span>Początki ostatnich miesiączek</span><b>' + cy.starts.slice(-4).join(', ') + '</b></div>', 'report');
    if (res.nutrition) { const n = res.nutrition; h += card('Odżywianie', 'średnie z ' + n.days + ' dni', (hide() ? '' : '<div class="kv"><span>Energia</span><b>' + r0(n.kcal) + ' kcal</b></div>') + '<div class="kv"><span>Białko, węgle, tłuszcz</span><b>' + r0(n.protein) + ', ' + r0(n.carbs) + ', ' + r0(n.fat) + ' g</b></div><div class="kv"><span>Błonnik</span><b>' + r0(n.fiber) + ' g</b></div><div class="kv"><span>Żelazo</span><b>' + fmt(n.iron) + ' mg</b></div><div class="kv"><span>Wapń</span><b>' + r0(n.calcium) + ' mg</b></div>', 'report'); }
    if (res.correlations.confirmed.length) h += card('Zauważone zależności', '', res.correlations.confirmed.slice(0, 5).map((c) => '<div class="kv" style="display:block"><b style="text-align:left">' + esc(c.sentence.title) + '</b><div class="small muted">' + esc(c.sentence.detail) + '</div></div>').join(''), 'report');
    return h + '<p class="disclaimer">Raport powstał z samodzielnych zapisów i ma charakter pomocniczy. Nie jest diagnozą medyczną.</p>';
  }

  /* ---------- ARKUSZ POSIŁKU ---------- */
  const MEAL_TYPES = ['śniadanie', 'obiad', 'kolacja', 'przekąska'];
  function newSheet(date, m) {
    const now = new Date(), hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), hr = now.getHours();
    const type = hr < 11 ? 'śniadanie' : hr < 16 ? 'obiad' : hr < 21 ? 'kolacja' : 'przekąska';
    return m ? { id: m.id, date, type: m.type, time: m.time || '12:00', text: m.text || '', items: JSON.parse(JSON.stringify(m.items || [])), unmatched: [], score: m.after && isNum(m.after.score) ? m.after.score : null, tags: (m.after && m.after.tags) ? m.after.tags.slice() : [], manual: null, off: null, q: '' }
      : { id: null, date, type, time: date === TODAY() ? hh : '12:00', text: '', items: [], unmatched: [], score: null, tags: [], manual: null, off: null, q: '' };
  }
  const itemSmall = (it) => { const t = Fd.itemTotals(it); return (hide() ? '' : r0(t.kcal) + ' kcal, ') + 'białko ' + fmt(t.p, 1) + ' g'; };
  function sheetTotals() { return macroTxt(Fd.sumItems(S.sheet.items)); }
  function viewSheet() {
    const sh = S.sheet; let h = '<div class="sheet" role="dialog" aria-modal="true" aria-label="Posiłek"><div class="sheet-hd"><button class="x" data-a="sh-close">Anuluj</button><b>' + (sh.id ? 'Edytuj posiłek' : 'Nowy posiłek') + '</b><button class="btn sm primary" data-a="sh-save">Zapisz</button></div><div class="sheet-body stack">';
    h += '<div class="chips">' + MEAL_TYPES.map((t) => '<button class="chip' + (sh.type === t ? ' on' : '') + '" data-a="sh-type" data-v="' + t + '">' + t + '</button>').join('') + '</div>';
    h += '<div class="grid2" style="grid-template-columns:110px 1fr;align-items:end"><div><label class="lb" for="sh-time">Godzina</label><input id="sh-time" type="time" data-i="sh-time" value="' + esc(sh.time) + '"></div><button class="btn" data-a="sh-calc" style="min-height:46px">Przelicz makro</button></div>';
    h += '<div><label class="lb" for="sh-text">Co zjadłaś?</label><textarea id="sh-text" data-i="sh-text" placeholder="np. owsianka z bananem, orzechami włoskimi i łyżką masła orzechowego">' + esc(sh.text) + '</textarea><p class="tiny muted" style="margin-top:4px">Pisz zwyczajnie. Możesz podać ilości: „150 g kurczaka”, „2 jajka”, „szklanka mleka”.</p></div>';
    if (sh.unmatched.length) {
      h += '<section class="card amber" style="margin:0"><h3>Nie rozpoznałam</h3>' + sh.unmatched.map((u, i) => '<div class="row" style="margin-top:8px"><b>' + esc(u.text) + '</b><span style="display:flex;gap:6px"><button class="btn sm" data-a="sh-off" data-i="' + i + '">Szukaj</button><button class="btn sm ghost" data-a="sh-man" data-i="' + i + '">Wpisz</button><button class="btn sm ghost" data-a="sh-skip" data-i="' + i + '" aria-label="Pomiń">×</button></span></div>').join('') + '</section>';
    }
    h += '<section class="card" style="margin:0"><div class="card-hd"><h2>Skład</h2><span class="hint" id="sh-tot">' + (sh.items.length ? sheetTotals() : '') + '</span></div><div id="sh-items">' + (sh.items.length ? sh.items.map(itemRow).join('') : '<p class="small muted">Wpisz posiłek i naciśnij „Przelicz makro” albo dodaj produkt poniżej.</p>') + '</div></section>';
    h += '<div><label class="lb" for="sh-q">Dodaj produkt</label><input id="sh-q" type="search" data-i="sh-q" placeholder="Szukaj w bazie, np. jabłko" value="' + esc(sh.q) + '" autocomplete="off"><div id="sh-sugs">' + sugsHtml() + '</div></div>';
    if (sh.off) {
      h += '<section class="card" style="margin:0"><div class="card-hd"><h2>Open Food Facts</h2><button class="x small muted b" data-a="sh-offx">Zamknij</button></div>' + (sh.off.loading ? '<p class="small muted">Szukam…</p>' : sh.off.error ? '<p class="small" style="color:var(--pink-600)">' + esc(sh.off.error) + '</p>' : sh.off.results.length ? '<div class="sug">' + sh.off.results.map((r, i) => '<button data-a="sh-off-add" data-i="' + i + '"><span>' + esc(r.name) + (r.brand ? ' <small>' + esc(r.brand) + '</small>' : '') + '</span><small>' + r0(r.per100.kcal) + ' kcal/100 g</small></button>').join('') + '</div>' : '<p class="small muted">Brak wyników. Spróbuj innej nazwy albo wpisz wartości ręcznie.</p>') + '</section>';
    }
    if (sh.manual) {
      const m = sh.manual; h += '<section class="card" style="margin:0"><h2>Wpisz ręcznie</h2><p class="tiny muted" style="margin-bottom:8px">Podaj wartości dla całej porcji.</p><div class="stack"><div><label class="lb">Nazwa</label><input type="text" data-i="man" data-k="name" value="' + esc(m.name) + '"></div><div class="grid2"><div><label class="lb">Porcja (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="grams" value="' + esc(m.grams) + '"></div><div><label class="lb">Energia (kcal)</label><input type="number" inputmode="decimal" data-i="man" data-k="kcal" value="' + esc(m.kcal) + '"></div></div><div class="grid3"><div><label class="lb">Białko (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="p" value="' + esc(m.p) + '"></div><div><label class="lb">Węgle (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="c" value="' + esc(m.c) + '"></div><div><label class="lb">Tłuszcz (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="f" value="' + esc(m.f) + '"></div></div><div class="btns two"><button class="btn primary" data-a="sh-man-save">Dodaj</button><button class="btn ghost" data-a="sh-man-x">Anuluj</button></div></div></section>';
    } else h += '<button class="btn ghost" data-a="sh-man" data-i="-1">Wpisz produkt ręcznie</button>';
    h += '<section class="card tint" style="margin:0"><h2>Jak się czułaś po posiłku?</h2><p class="tiny muted" style="margin-bottom:6px">Możesz uzupełnić później. Dzięki temu Pyszczek znajdzie produkty, po których czujesz się gorzej lub lepiej.</p><div class="rate" style="margin-top:6px">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (sh.score === v ? 'on' + (v <= 2 ? ' low' : '') : '') + '" data-a="sh-score" data-v="' + v + '">' + v + '</button>').join('') + '</div><div class="scale-lbl"><span>źle</span><span>świetnie</span></div><div class="chips" style="margin-top:12px">' + A.AFTER_TAGS.map(([k, l]) => '<button class="chip' + (sh.tags.includes(k) ? ' on' : '') + '" data-a="sh-tag" data-v="' + k + '">' + l + '</button>').join('') + '</div></section>';
    if (sh.id) h += '<button class="btn danger" data-a="sh-delete">Usuń posiłek</button>';
    return h + '</div></div>';
  }
  function itemRow(it, i) {
    return '<div class="it" data-row="' + i + '"><div class="it-n">' + esc(it.name) + '<small>' + itemSmall(it) + '</small></div><div class="it-g"><input type="number" inputmode="decimal" min="0" data-i="sh-gr" data-idx="' + i + '" value="' + it.grams + '" aria-label="Gramy: ' + esc(it.name) + '"><span>g</span></div><button class="del" data-a="sh-del" data-idx="' + i + '" aria-label="Usuń ' + esc(it.name) + '">×</button></div>';
  }
  function sugsHtml() {
    const q = S.sheet && S.sheet.q ? S.sheet.q.trim() : ''; if (q.length < 2) return '';
    const res = Fd.search(q, 6);
    return '<div class="sug">' + res.map((f) => '<button data-a="sh-add" data-id="' + f.id + '"><span>' + esc(f.name) + '</span><small>' + (hide() ? '' : r0(f.per100.kcal) + ' kcal/100 g') + '</small></button>').join('') + '<button data-a="sh-off" data-i="-1"><span>Szukaj „' + esc(q) + '” w Open Food Facts</span><small>online</small></button></div>';
  }
  function openSheet() { const el = $('#sheet'); el.hidden = false; renderSheet(); document.body.style.overflow = 'hidden'; }
  function closeSheet() { S.sheet = null; $('#sheet').hidden = true; document.body.style.overflow = ''; }
  function renderSheet() { const el = $('#sheet'), old = $('.sheet-body', el), y = old ? old.scrollTop : 0; el.innerHTML = viewSheet(); const nb = $('.sheet-body', el); if (nb) nb.scrollTop = y; }
  function refreshItems() {
    const sh = S.sheet; $('#sh-items').innerHTML = sh.items.length ? sh.items.map(itemRow).join('') : '<p class="small muted">Wpisz posiłek i naciśnij „Przelicz makro” albo dodaj produkt poniżej.</p>'; $('#sh-tot').textContent = sh.items.length ? sheetTotals() : '';
  }
  function calc() {
    const sh = S.sheet; if (!sh.text.trim()) { toast('Najpierw wpisz, co zjadłaś'); return false; }
    const r = Fd.parseMeal(sh.text); sh.items = sh.items.filter((i) => !i.auto).concat(r.items.map((i) => Object.assign(i, { auto: true })));
    sh.unmatched = r.unmatched.map((t) => ({ text: t }));
    if (!sh.items.length && !sh.unmatched.length) { toast('Nie rozpoznałam produktów. Spróbuj prościej lub dodaj ręcznie.'); }
    renderSheet(); return true;
  }
  async function offSearch(q, uIdx) {
    const sh = S.sheet; sh.off = { q, loading: true, results: [], uIdx }; renderSheet();
    try {
      const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=8&lc=pl&fields=product_name,brands,nutriments';
      const res = await fetch(url); if (!res.ok) throw new Error('http');
      const j = await res.json(); const n = (p, k) => Number(p.nutriments[k]) || 0;
      sh.off.results = (j.products || []).filter((p) => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] != null).slice(0, 6).map((p) => ({ name: p.product_name, brand: (p.brands || '').split(',')[0], per100: { kcal: n(p, 'energy-kcal_100g'), p: n(p, 'proteins_100g'), c: n(p, 'carbohydrates_100g'), f: n(p, 'fat_100g'), fib: n(p, 'fiber_100g'), sug: n(p, 'sugars_100g'), fe: n(p, 'iron_100g') * 1000, ca: n(p, 'calcium_100g') * 1000 } }));
      sh.off.loading = false;
    } catch (e) { sh.off.loading = false; sh.off.error = 'Nie udało się połączyć z Open Food Facts. Sprawdź internet albo wpisz wartości ręcznie.'; }
    if (S.sheet === sh) renderSheet();
  }
  function saveMeal() {
    const sh = S.sheet; if (!sh.items.length && sh.text.trim()) { if (!calc()) return; }
    if (sh.unmatched.length && !sh.items.length) { toast('Dodaj lub wpisz rozpoznane produkty'); return; }
    if (!sh.items.length) { toast('Dodaj co najmniej jeden produkt'); return; }
    const d = day(sh.date, true), meal = { id: sh.id || 'm' + Date.now().toString(36), type: sh.type, time: sh.time, text: sh.text.trim(), items: sh.items.map((i) => { const o = Object.assign({}, i); delete o.auto; return o; }), after: isNum(sh.score) ? { score: sh.score, tags: sh.tags.slice() } : null };
    const idx = d.meals.findIndex((m) => m.id === meal.id); if (idx >= 0) d.meals[idx] = meal; else d.meals.push(meal);
    save(); closeSheet(); render(); toast('Posiłek zapisany');
  }

  /* ---------- dane: kopia, demo ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pyszczek-kopia-' + TODAY() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    db.settings.lastBackup = TODAY(); save(); render(); toast('Kopia zapisana');
  }
  function importData() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const o = JSON.parse(rd.result); if (!o || typeof o.days !== 'object') throw 0; if (!confirm('Wczytanie kopii zastąpi dane w tej przeglądarce. Kontynuować?')) return; o.settings = Object.assign(defaults(), o.settings || {}); db = o; save(); render(); toast('Wczytano ' + Object.keys(o.days).length + ' dni'); } catch (e) { toast('To nie wygląda na kopię z Pyszczka'); } }; rd.readAsText(f); };
    inp.click();
  }
  function loadDemo() {
    const demo = window.Demo.generate(TODAY(), 75, 7); Object.keys(demo).forEach((k) => { if (!db.days[k]) db.days[k] = demo[k]; });
    db.settings.onboarded = true; if (!db.settings.age) { db.settings.age = 31; db.settings.heightCm = 168; db.settings.weightKg = 62; db.settings.demoProfile = true; }
    save(); S.tab = 'insights'; render(); window.scrollTo(0, 0); toast('Wczytano dane przykładowe');
  }
  function clearDemo() {
    Object.keys(db.days).forEach((k) => { if (db.days[k].demo) delete db.days[k]; });
    if (db.settings.demoProfile) { db.settings.age = ''; db.settings.heightCm = ''; db.settings.weightKg = ''; delete db.settings.demoProfile; }
    save(); render(); toast('Usunięto dane przykładowe');
  }

  /* ---------- zdarzenia ---------- */
  function render(top) {
    const y = window.scrollY, views = { today: viewToday, meals: viewMeals, insights: viewInsights, history: viewHistory, profile: viewProfile, report: viewReport };
    $('#view').innerHTML = views[S.tab](); document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === S.tab || (S.tab === 'report' && b.dataset.t === 'profile')));
    window.scrollTo(0, top ? 0 : y);
  }
  const clean = (d, date) => { if (d && !A.checkedIn(d) && !(d.meals || []).length && !d.note && !d.sleepHours && !d.water && !Object.keys(d.symptoms || {}).length && !d.flow && d.exercise == null && d.caffeine == null && d.alcohol == null && !(d.stressors || []).length && !d.noSymptoms && !d.supp) delete db.days[date]; };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el) return; const a = el.dataset.a, k = el.dataset.k, v = el.dataset.v, sh = S.sheet;
    switch (a) {
      case 'nav': S.tab = el.dataset.t; render(true); break;
      case 'date': { const t = TODAY(); S.date = el.dataset.d === 'today' ? t : A.addDays(S.date, Number(el.dataset.d)); if (S.date > t) S.date = t; render(); break; }
      case 'onboard': db.settings.onboarded = true; save(); render(); break;
      case 'set': { const d = day(S.date, true), n = Number(v); if (k === 'flow' && n === 0) delete d.flow; else if (d[k] === n) delete d[k]; else d[k] = n; clean(d, S.date); save(); render(); break; }
      case 'step': { const d = day(S.date, true); let cur = d[k]; const dl = Number(el.dataset.d); cur = cur == null ? Number(el.dataset.start) : cur + dl; cur = Math.max(Number(el.dataset.min), Math.min(Number(el.dataset.max), cur)); d[k] = Math.round(cur * 2) / 2; save(); render(); break; }
      case 'water': { const d = day(S.date, true); d.water = Math.max(0, (d.water || 0) + Number(el.dataset.d)); save(); render(); break; }
      case 'sym': { const d = day(S.date, true); d.symptoms = d.symptoms || {}; const n = ((d.symptoms[k] || 0) + 1) % 4; if (n) d.symptoms[k] = n; else delete d.symptoms[k]; delete d.noSymptoms; save(); render(); break; }
      case 'nosym': { const d = day(S.date, true); d.noSymptoms = !d.noSymptoms; if (d.noSymptoms) d.symptoms = {}; save(); render(); break; }
      case 'tog': { const d = day(S.date, true); d[k] = d[k] || []; const i = d[k].indexOf(v); if (i >= 0) d[k].splice(i, 1); else d[k].push(v); save(); render(); break; }
      case 'supp': { const d = day(S.date, true); d.supp = d.supp || {}; if (d.supp[v]) delete d.supp[v]; else d.supp[v] = true; save(); render(); break; }
      case 'range': S.range = Number(v); render(); break;
      case 'month': { const [y, m] = S.hm.split('-').map(Number), dt = new Date(y, m - 1 + Number(el.dataset.d), 1); S.hm = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'); render(); break; }
      case 'hsel': S.hs = v; render(); break;
      case 'hopen': S.date = S.hs; S.tab = 'today'; render(true); break;
      case 'stog': db.settings[k] = !db.settings[k]; save(); render(); break;
      case 'supp-add': { const t = (S.newSupp || '').trim(); if (t && !db.settings.supplements.includes(t)) { db.settings.supplements.push(t); S.newSupp = ''; save(); render(); } break; }
      case 'supp-del': db.settings.supplements.splice(Number(el.dataset.i), 1); save(); render(); break;
      case 'export': exportData(); break;
      case 'import': importData(); break;
      case 'demo-load': loadDemo(); break;
      case 'demo-clear': clearDemo(); break;
      case 'wipe': if (confirm('Usunąć wszystkie dane z tej przeglądarki? Tej operacji nie da się cofnąć.') && confirm('Na pewno? Zrób najpierw kopię zapasową, jeśli chcesz zachować dane.')) { db = { v: 1, settings: defaults(), days: {} }; save(); S.tab = 'today'; render(true); toast('Dane usunięte'); } break;
      case 'print': window.print(); break;
      case 'rate': { const d = db.days[S.date], m = d && d.meals.find((x) => x.id === el.dataset.id); if (m) { const n = Number(v); m.after = m.after || { score: null, tags: [] }; m.after.score = m.after.score === n ? null : n; save(); render(); } break; }
      /* arkusz */
      case 'sh-new': S.sheet = newSheet(S.date, null); openSheet(); break;
      case 'sh-edit': { const m = (db.days[S.date].meals || []).find((x) => x.id === el.dataset.id); if (m) { S.sheet = newSheet(S.date, m); openSheet(); } break; }
      case 'sh-close': closeSheet(); break;
      case 'sh-type': sh.type = v; renderSheet(); break;
      case 'sh-calc': calc(); break;
      case 'sh-del': sh.items.splice(Number(el.dataset.idx), 1); refreshItems(); break;
      case 'sh-add': { const f = Fd.FOODS.find((x) => x.id === el.dataset.id); if (f) { sh.items.push(Fd.fromFood(f)); sh.q = ''; renderSheet(); } break; }
      case 'sh-skip': sh.unmatched.splice(Number(el.dataset.i), 1); renderSheet(); break;
      case 'sh-off': { const i = Number(el.dataset.i), q = i >= 0 ? sh.unmatched[i].text : sh.q; if (q && q.trim()) offSearch(q.trim(), i); break; }
      case 'sh-offx': sh.off = null; renderSheet(); break;
      case 'sh-off-add': { const r = sh.off.results[Number(el.dataset.i)], it = { fid: null, name: r.name, grams: 100, per100: r.per100, tags: Fd.guessTags(r.name), src: 'off' }; sh.items.push(it); if (sh.off.uIdx >= 0) sh.unmatched.splice(sh.off.uIdx, 1); sh.off = null; sh.q = ''; renderSheet(); toast('Dodano. Ustaw gramy.'); break; }
      case 'sh-man': { const i = Number(el.dataset.i); sh.manual = { name: i >= 0 ? sh.unmatched[i].text : sh.q || '', grams: 100, kcal: '', p: '', c: '', f: '', u: i }; renderSheet(); break; }
      case 'sh-man-x': sh.manual = null; renderSheet(); break;
      case 'sh-man-save': { const m = sh.manual, g = Number(m.grams) || 100; if (!m.name.trim()) { toast('Podaj nazwę'); break; } const k100 = 100 / g; sh.items.push({ fid: null, name: m.name.trim(), grams: g, per100: { kcal: (Number(m.kcal) || 0) * k100, p: (Number(m.p) || 0) * k100, c: (Number(m.c) || 0) * k100, f: (Number(m.f) || 0) * k100, fib: 0, sug: 0, fe: 0, ca: 0 }, tags: Fd.guessTags(m.name), src: 'manual' }); if (m.u >= 0) sh.unmatched.splice(m.u, 1); sh.manual = null; renderSheet(); break; }
      case 'sh-score': sh.score = sh.score === Number(v) ? null : Number(v); renderSheet(); break;
      case 'sh-tag': { const i = sh.tags.indexOf(v); if (i >= 0) sh.tags.splice(i, 1); else sh.tags.push(v); renderSheet(); break; }
      case 'sh-save': saveMeal(); break;
      case 'sh-delete': if (confirm('Usunąć ten posiłek?')) { const d = db.days[sh.date]; d.meals = d.meals.filter((m) => m.id !== sh.id); clean(d, sh.date); save(); closeSheet(); render(); } break;
    }
  });
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) closeSheet(); });

  document.addEventListener('input', (e) => {
    const el = e.target, i = el.dataset && el.dataset.i; if (!i) return;
    if (i === 'note') { const d = day(S.date, true); if (el.value) d.note = el.value; else delete d.note; save(); }
    else if (i === 'prof') { const k = el.dataset.k; db.settings[k] = (el.type === 'number') ? (el.value === '' ? '' : Number(el.value)) : el.value; save(); }
    else if (i === 'supp-new') S.newSupp = el.value;
    else if (i === 'sh-text') S.sheet.text = el.value;
    else if (i === 'sh-time') S.sheet.time = el.value;
    else if (i === 'sh-q') { S.sheet.q = el.value; $('#sh-sugs').innerHTML = sugsHtml(); }
    else if (i === 'sh-gr') { const it = S.sheet.items[Number(el.dataset.idx)]; it.grams = Math.max(0, Number(el.value) || 0); const row = el.closest('.it'); $('small', row).textContent = itemSmall(it); $('#sh-tot').textContent = sheetTotals(); }
    else if (i === 'man') { S.sheet.manual[el.dataset.k] = el.value; }
  });
  document.addEventListener('change', (e) => {
    const el = e.target, i = el.dataset && el.dataset.i; if (!i) return;
    if (i === 'cmp-x') { S.cmp.x = el.value; render(); } else if (i === 'cmp-y') { S.cmp.y = el.value; render(); } else if (i === 'cmp-lag') { S.cmp.lag = Number(el.value); render(); }
    else if (i === 'prof' && el.tagName === 'SELECT') { db.settings[el.dataset.k] = el.value; save(); render(); }
    else if (i === 'prof') render();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.i === 'supp-new') { e.preventDefault(); const t = (S.newSupp || '').trim(); if (t && !db.settings.supplements.includes(t)) { db.settings.supplements.push(t); S.newSupp = ''; save(); render(); } } });

  /* start: jeśli dzień zmienił się, gdy karta była w tle */
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.tab === 'today' && S.date !== TODAY() && !S.touched) { /* zostaw wybraną datę */ } });
  window.__pyszczek = { db: () => db, S, render };
  render(true);
})();
