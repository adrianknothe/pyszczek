/* Pyszczek: aplikacja (widoki, zdarzenia, zapis). Dane tylko w localStorage tej przeglądarki. */
(function () {
  'use strict';
  const A = window.Analysis, Fd = window.Food, C = window.Charts, I = window.Insights;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = C.esc, fmt = A.fmt, isNum = A.isNum;
  const KEY = 'pyszczek.v1';
  const TODAY = () => A.todayISO();

  /* ---------- stan i zapis ---------- */
  const defaults = () => ({ name: '', age: '', heightCm: '', weightKg: '', activity: 'mid', goal: 'maintain', cycleLen: 28, periodLen: 5, trackCycle: true, hideKcal: false, pet: { on: true, caught: 0 }, rem: { evening: true, eTime: '20:30', morning: false, mTime: '08:30', water: false }, experiment: null, expHistory: [], supplements: [], customFoods: [], lastBackup: null, onboarded: false });
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); o.settings = Object.assign(defaults(), o.settings || {}); o.days = o.days || {}; return o; } } catch (e) { /* pusty start */ }
    return { v: 1, settings: defaults(), days: {} };
  }
  let db = load(); let saveT = null;
  Fd.setCustom(db.settings.customFoods);
  function save() {
    S.ver++; clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Pamięć przeglądarki jest pełna. Zrób kopię zapasową w Profilu.'); } }, 200);
  }
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(() => {}); }

  const S = { ob: null, tab: 'today', date: TODAY(), range: 90, hm: TODAY().slice(0, 7), hs: TODAY(), cmp: { x: 'sleepHours', y: 'mood', lag: 0 }, sheet: null, newSupp: '', itab: 'over', open: { feel: true }, xd: null, wi: { x: 'sleepHours', y: 'wbCore', lag: 0, v: null }, ver: 0, expProp: null };
  const MONTHS_G = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTHS_N = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
  const DOW = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const dateObj = (iso) => new Date(iso + 'T12:00:00');
  const longDate = (iso) => { const d = dateObj(iso); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_G[d.getMonth()]; };
  const dayLabel = (iso) => { const t = TODAY(); if (iso === t) return 'Dziś'; if (iso === A.addDays(t, -1)) return 'Wczoraj'; if (iso === A.addDays(t, 1)) return 'Jutro'; const d = dateObj(iso); return d.getDate() + ' ' + MONTHS_G[d.getMonth()].slice(0, 3); };
  const day = (date, create) => { let d = db.days[date]; if (!d && create) d = db.days[date] = { meals: [], symptoms: {}, stressors: [] }; return d; };
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };
  const hide = () => db.settings.hideKcal;
  const r0 = (v) => Math.round(v);
  const macroTxt = (t) => (hide() ? '' : r0(t.kcal) + ' kcal, ') + 'białko ' + fmt(t.p, 0) + ' g, węgle ' + fmt(t.c, 0) + ' g, tłuszcz ' + fmt(t.f, 0) + ' g';

  const plPl = (n, one, few, many) => { const a = Math.abs(n); if (a === 1) return one; if (a % 1) return few; const m10 = a % 10, m100 = a % 100; return (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) ? few : many; };
  const GLASS = 250, CUP = 300, BOTTLE = 500;
  const glassTxt = (ml) => { const n = Math.round(ml / GLASS * 2) / 2; return fmt(n, n % 1 ? 1 : 0) + ' ' + plPl(n, 'szklanka', 'szklanki', 'szklanek'); };
  const OBS_TAGS = [['glod', 'Głód'], ['zachcianka', 'Zachcianka'], ['skurcz', 'Skurcz brzucha'], ['wzdecie', 'Wzdęcie'], ['zgaga', 'Zgaga'], ['nudnosci', 'Nudności'], ['glowa', 'Ból głowy'], ['senność', 'Senność'], ['spadek', 'Spadek energii'], ['przyplyw', 'Przypływ energii'], ['napiecie', 'Napięcie'], ['inne', 'Inne']];
  const obsName = (k) => { const f = OBS_TAGS.find((x) => x[0] === k); if (f) return f[1]; k = String(k || ''); return k.charAt(0).toUpperCase() + k.slice(1); };
  const SEV = ['', 'lekko', 'średnio', 'mocno'];
  const HUNGER = ['', 'brak', 'lekki', 'średni', 'duży', 'wilczy'], SAT = ['', 'wciąż głodna', 'trochę głodna', 'syta', 'bardzo syta', 'przejedzona'];
  const nowHM = () => { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); };

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
      + '<div class="datebar"><button data-a="date" data-d="-1" aria-label="Poprzedni dzień">‹</button><button data-a="date" data-d="today" style="width:auto;padding:0 6px;font-size:14px;font-weight:700;color:var(--ink);min-width:104px">' + dayLabel(date) + '</button><button data-a="date" data-d="1" ' + (date >= A.addDays(t, 14) ? 'disabled style="opacity:.3"' : '') + ' aria-label="Następny dzień">›</button></div></div>';
  }
  const wbLabel = (v) => v == null ? 'Zacznij od nastroju i energii' : v < 35 ? 'Trudny dzień' : v < 55 ? 'Raczej średnio' : v < 75 ? 'Całkiem dobrze' : 'Świetny dzień';
  const phaseHint = { menstruacja: 'Energia bywa niższa. Zadbaj o odpoczynek i produkty z żelazem.', folikularna: 'Zwykle energia i nastrój rosną.', owulacja: 'Często szczyt energii i nastroju.', lutealna: 'Możliwe objawy PMS: ochota na słodycze, wahania nastroju.' };

  /* ---------- DZIŚ ---------- */
  const ICO = {
    feel: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5q3.5 3 7 0M9 9.5h.01M15 9.5h.01"/>', sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    habits: '<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/>', symptoms: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>', stress: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    cycle: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', supp: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="m9.5 8.5 6 6"/>', note: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'
  };
  function acc(id, title, sum, done, body) {
    const open = !!S.open[id];
    return '<section class="acc' + (open ? ' open' : '') + (done ? ' done' : '') + '" id="sec-' + id + '"><button class="acc-hd" data-a="sec" data-id="' + id + '" aria-expanded="' + open + '"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24">' + (ICO[id] || ICO.note) + '</svg></span><span class="acc-t"><b>' + title + '</b><small>' + sum + '</small></span><span class="chev" aria-hidden="true"></span></button>' + (open ? '<div class="acc-bd">' + body + '</div>' : '') + '</section>';
  }
  function expToday(date) {
    const ex = db.settings.experiment; if (!ex) return '';
    const ev = I.evalExperiment(db, ex, TODAY()), rec = A.buildRecords(db.days).find((r) => r.date === date), X = A.METRICS[ex.x], v = rec ? rec[ex.x] : null;
    const ok = isNum(v) && (ex.dir === 'up' ? v >= ex.target : v <= ex.target);
    return '<section class="card rose"><div class="card-hd"><h2>Wyzwanie tygodnia</h2><span class="hint">' + (ev.done ? 'zakończone' : 'dzień ' + Math.max(1, Math.min(7, ev.elapsed)) + ' z 7') + '</span></div><p class="small">' + esc(ex.title) + '</p>'
      + (ev.done ? '<button class="btn sm" data-a="nav" data-t="insights" style="margin-top:10px">Zobacz wynik</button>' : '<p class="small" style="margin-top:6px"><b>Dziś:</b> ' + (isNum(v) ? fmt(v, X.dec) + X.unit + (ok ? ', cel osiągnięty' : ', cel jeszcze nie osiągnięty') : 'brak wpisu') + '</p>' + prog(ev.elapsed, 7)) + '</section>';
  }
  function timeline(d) {
    const ev = []; (d.meals || []).forEach((m) => ev.push({ t: m.time || '12:00', m })); (d.obs || []).forEach((o) => ev.push({ t: o.t || '12:00', o }));
    if (!ev.length) return '';
    ev.sort((a, b) => a.t.localeCompare(b.t));
    return '<div class="tl">' + ev.map((e) => {
      if (e.m) { const m = e.m, t = Fd.sumItems(m.items); const hs = (isNum(m.hunger) ? 'głód przed: ' + HUNGER[m.hunger] : '') + (isNum(m.hunger) && isNum(m.sat) ? ' · ' : '') + (isNum(m.sat) ? 'sytość po: ' + SAT[m.sat] : ''); return '<div class="tl-i meal"><span class="tl-t">' + esc(e.t) + '</span><div class="tl-b"><b>' + esc(m.type || 'Posiłek') + '</b> <span class="small muted">' + (hide() ? '' : r0(t.kcal) + ' kcal') + '</span><div class="small">' + m.items.slice(0, 4).map((it) => esc(it.name.replace(/ \(.*\)$/, ''))).join(', ') + (m.items.length > 4 ? '…' : '') + '</div>' + (hs ? '<div class="tiny muted">' + hs + '</div>' : '') + '</div></div>'; }
      const o = e.o; return '<div class="tl-i obs"><span class="tl-t">' + esc(e.t) + '</span><div class="tl-b"><b>' + esc(obsName(o.tag)) + '</b>' + (o.sev ? ' <span class="tag bad">' + SEV[o.sev] + '</span>' : '') + (o.text && o.text.toLowerCase() !== String(o.tag).toLowerCase() ? '<div class="small">' + esc(o.text) + '</div>' : '') + '</div><button class="del" data-a="ob-del" data-id="' + o.id + '" aria-label="Usuń wpis z godziny ' + esc(o.t) + '">×</button></div>';
    }).join('') + '</div>';
  }
  function obsForm(date) {
    const t = TODAY(); S.ob = S.ob || { t: date === t ? nowHM() : '09:00', tag: null, sev: 2, text: '' }; const o = S.ob;
    return '<div class="grid2" style="grid-template-columns:110px 1fr;align-items:end"><div><label class="lb" for="ob-t">Godzina</label><input id="ob-t" type="time" data-i="ob-t" value="' + esc(o.t) + '"></div><div><label class="lb" for="ob-x">Co się dzieje?</label><input id="ob-x" type="text" data-i="ob-text" placeholder="np. ucisk w klatce" value="' + esc(o.text) + '" autocomplete="off"></div></div>'
      + '<div class="chips" style="margin-top:10px">' + OBS_TAGS.map(([k, l]) => '<button class="chip' + (o.tag === k ? ' on' : '') + '" data-a="ob-tag" data-v="' + k + '">' + l + '</button>').join('') + '</div>'
      + '<div class="small b" style="margin-top:12px">Jak mocno?</div><div class="chips" style="margin-top:6px">' + [1, 2, 3].map((v) => '<button class="chip rose' + (o.sev === v ? ' on' : '') + '" data-a="ob-sev" data-v="' + v + '">' + SEV[v] + '</button>').join('') + '</div>'
      + '<button class="btn primary" data-a="ob-add" style="margin-top:12px">Dodaj z godziną</button>';
  }
  function viewToday() {
    const date = S.date, d = db.days[date] || {}, st = db.settings, tg = A.targets(st), cyc = A.cycleInfo(db.days, st);
    const wb = A.wellbeing(d), meals = d.meals || [], tot = A.dayTotals(d), t = TODAY();
    const done = [A.checkedIn(d), isNum(d.sleepHours) || isNum(d.sleepQuality), (d.water > 0) || isNum(d.exercise) || isNum(d.caffeine), meals.length > 0, Object.keys(d.symptoms || {}).length > 0 || d.noSymptoms || (d.stressors || []).length > 0].filter(Boolean).length;
    const streak = A.streak(db.days, t);
    const ORDER = [['feel', A.checkedIn(d), 'Jak się czujesz?'], ['sleep', isNum(d.sleepHours) || isNum(d.sleepQuality), 'Sen'], ['habits', (d.water > 0) || isNum(d.exercise) || isNum(d.caffeine) || isNum(d.alcohol) || isNum(d.steps) || isNum(d.walkMin), 'Nawyki'], ['symptoms', Object.keys(d.symptoms || {}).length > 0 || !!d.noSymptoms, 'Objawy'], ['meals', meals.length > 0, 'Posiłki']];
    const nxt = ORDER.find((x) => !x[1]);
    const nextBtn = nxt ? '<button class="linkbtn" data-a="sec-go" data-id="' + nxt[0] + '">Dalej: ' + nxt[2] + '</button>' : '<div class="small b" style="color:var(--brand-600)">Dzień uzupełniony</div>';
    let h = topBar();
    h += '<div class="page-title"><h1>' + (st.name ? 'Cześć, ' + esc(st.name) : 'Cześć') + '</h1><p class="muted">' + longDate(date) + '</p></div>';
    if (date > t) h += '<section class="card amber"><h3>Planujesz dzień z wyprzedzeniem</h3><p class="small">Możesz już dodać posiłki, ćwiczenia i płyny. Do analiz trafią dopiero, gdy dzień nadejdzie.</p></section>';

    if (!st.onboarded && !Object.keys(db.days).length) {
      h += '<section class="card welcome tint"><h2>Witaj w Pyszczku</h2><ul><li>Codziennie zapisz nastrój, sen, objawy i posiłki. Zajmuje to około dwóch minut.</li><li>Posiłki wpisujesz zwykłym zdaniem, a makro liczy się samo.</li><li>Po kilku dniach Pyszczek pokaże, co faktycznie wpływa na Twoje samopoczucie.</li></ul><div class="btns two"><button class="btn primary" data-a="onboard">Zaczynam</button><button class="btn" data-a="demo-load">Zobacz na przykładzie</button></div></section>';
    }
    const real = Object.keys(db.days).filter((k) => !db.days[k].demo).length;
    if (real >= 7 && (!st.lastBackup || A.diffDays(t, st.lastBackup) >= 14)) h += '<section class="card amber"><div class="row"><div><h3>Czas na kopię zapasową</h3><p class="small">Dane są tylko w tej przeglądarce. Zapisz kopię, żeby ich nie stracić.</p></div><button class="btn sm" data-a="nav" data-t="profile" style="flex:none">Profil</button></div></section>';

    h += '<section class="card hero ' + (wb == null ? 'm0' : wb < 35 ? 'm1' : wb < 55 ? 'm2' : wb < 75 ? 'm3' : 'm4') + (S.seen ? '' : ' intro') + '"><div class="face">' + C.face(wb, 112) + '</div><div style="min-width:0"><div class="score' + (wb == null ? ' none' : '') + '">' + (wb == null ? '–' : wb + '<small>/100</small>') + '</div><div class="lbl">' + wbLabel(wb) + '</div><div class="small muted">' + done + ' z 5 sekcji uzupełnionych</div>' + nextBtn + (streak >= 2 && date === t ? '<div class="small b" style="color:var(--brand-600)">' + streak + ' dni wpisów z rzędu</div>' : '') + prog(done, 5) + '</div></section>';

    {
      const wk = []; for (let i = 6; i >= 0; i--) wk.push(A.addDays(date > t ? t : date, -i));
      const lv = (v) => v == null ? 'n' : v < 35 ? '1' : v < 55 ? '2' : v < 75 ? '3' : '4';
      const WD = ['n', 'p', 'w', 'ś', 'c', 'p', 's'];
      h += '<section class="card wkc"><div class="card-hd"><h2>Ostatnie 7 dni</h2><span class="hint">dotknij dzień</span></div><div class="wk7">' + wk.map((x) => { const w = A.wellbeing(db.days[x]); return '<button class="wd l' + lv(w) + (x === date ? ' sel' : '') + '" data-a="xopen" data-d="' + x + '" aria-label="' + longDate(x) + (w == null ? ', brak danych' : ', wskaźnik ' + w) + '"><i>' + (w == null ? '–' : w) + '</i><span>' + WD[dateObj(x).getDay()] + '</span></button>'; }).join('') + '</div></section>';
      const pc = (v, g) => g ? Math.max(0, Math.min(100, Math.round(v / g * 100))) : 0;
      const tile = (sec, label, val, unit, pct, cls) => '<button class="gt ' + cls + '" data-a="sec-go" data-id="' + sec + '" style="--p:' + pct + '"><span class="gr"><b>' + pct + '<small>%</small></b></span><span class="gl">' + label + '</span><span class="gv">' + val + '<small> ' + unit + '</small></span></button>';
      h += '<div class="goals">'
        + tile('sleep', 'Sen', isNum(d.sleepHours) ? fmt(d.sleepHours, 1) : '–', 'h', pc(d.sleepHours || 0, 8), 'g-sleep')
        + tile('habits', 'Płyny', fmt((d.water || 0) / GLASS, (d.water || 0) % GLASS ? 1 : 0), 'z ' + Math.round(tg.water / GLASS), pc(d.water || 0, tg.water), 'g-water')
        + tile('habits', 'Kroki', isNum(d.steps) ? fmt(d.steps / 1000, 1) : '–', 'tys. z 8', pc(d.steps || 0, 8000), 'g-steps')
        + tile('meals', 'Białko', fmt(tot.p, 0), 'z ' + tg.protein + ' g', pc(tot.p, tg.protein), 'g-prot') + '</div>';
    }
    if (date === t) h += expToday(date) + nudge();
    if (st.trackCycle) {
      const ph = cyc.phaseOf(date); let body;
      if (ph) {
        const cls = ph.phase === 'menstruacja' ? 'mens' : ph.phase === 'owulacja' ? 'ovu' : ph.phase === 'folikularna' ? 'fol' : '';
        const nd = cyc.next ? A.diffDays(cyc.next, date) : null;
        body = '<div class="cyc"><div class="dot ' + cls + '">' + ph.cd + '</div><div><div class="b">Dzień ' + ph.cd + ' cyklu, ' + A.PHASES[ph.phase].toLowerCase() + '</div><div class="small muted">' + (ph.pms ? 'Zbliża się miesiączka. ' : '') + phaseHint[ph.phase] + '</div>' + (nd !== null && nd > 0 ? '<div class="small" style="margin-top:4px">Następna miesiączka ok. <b>' + dateObj(cyc.next).getDate() + ' ' + MONTHS_G[dateObj(cyc.next).getMonth()] + '</b> (za ' + nd + ' dni)</div>' : '') + '</div></div>';
      } else body = '<p class="small muted">Zaznacz pierwszy dzień miesiączki w sekcji „Cykl: krwawienie” poniżej. Pyszczek zacznie liczyć fazy i przewidywać kolejną.</p>';
      h += '<section class="card tint">' + (ph ? '<div class="card-hd"><h2>Cykl</h2></div>' : '') + body + '</section>';
    }

    const sv = (k) => isNum(d[k]) ? d[k] : '–';
    const dFeel = A.checkedIn(d), dSleep = isNum(d.sleepHours) || isNum(d.sleepQuality), dHab = (d.water > 0) || isNum(d.exercise) || isNum(d.caffeine) || isNum(d.alcohol) || isNum(d.steps) || isNum(d.walkMin);
    const symK = Object.keys(d.symptoms || {}), dSym = symK.length > 0 || !!d.noSymptoms || (d.obs || []).length > 0, dStr = (d.stressors || []).length > 0;
    h += acc('feel', 'Jak się czujesz?', dFeel ? 'nastrój ' + sv('mood') + ' · energia ' + sv('energy') + ' · stres ' + sv('stress') : 'Nastrój, energia, stres', dFeel,
      '<div class="field"><div class="field-hd"><b>Nastrój</b><span class="val">' + (isNum(d.mood) ? d.mood + '/10' : '') + '</span></div>' + scale('mood', d.mood, 'pos', 'bardzo źle', 'świetnie') + '</div>'
      + '<div class="field"><div class="field-hd"><b>Energia</b><span class="val">' + (isNum(d.energy) ? d.energy + '/10' : '') + '</span></div>' + scale('energy', d.energy, 'pos', 'wyczerpana', 'pełna sił') + '</div>'
      + '<div class="field"><div class="field-hd"><b>Stres</b><span class="val neg">' + (isNum(d.stress) ? d.stress + '/10' : '') + '</span></div>' + scale('stress', d.stress, 'neg', 'spokój', 'bardzo duży') + '</div>');

    h += acc('sleep', 'Sen', dSleep ? (isNum(d.sleepHours) ? fmt(d.sleepHours, 1) + ' h' : '') + (isNum(d.sleepHours) && isNum(d.sleepQuality) ? ' · ' : '') + (isNum(d.sleepQuality) ? 'jakość ' + d.sleepQuality + '/10' : '') : 'Ostatnia noc', dSleep,
      '<div class="field"><div class="field-hd"><b>Ile godzin spałaś?</b></div><div style="margin-top:8px">' + stepper('sleepHours', d.sleepHours, { step: 0.5, min: 0, max: 14, start: 7, unit: 'h', dec: 1 }) + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Jakość snu</b><span class="val">' + (isNum(d.sleepQuality) ? d.sleepQuality + '/10' : '') + '</span></div>' + scale('sleepQuality', d.sleepQuality, 'pos', 'koszmarna', 'regeneracyjna') + '</div>');

    const wg = tg.water, wv = d.water || 0, gGoal = Math.round(wg / GLASS);
    const habS = []; if (wv) habS.push(glassTxt(wv)); if (isNum(d.steps)) habS.push(fmt(d.steps, 0) + ' kroków'); if (isNum(d.walkMin)) habS.push('spacer ' + d.walkMin + ' min'); if (isNum(d.caffeine)) habS.push('kofeina ' + d.caffeine); if (isNum(d.alcohol)) habS.push('alkohol ' + d.alcohol); if (isNum(d.exercise)) habS.push(d.exercise ? 'ćwiczenia ' + d.exercise + ' min' : 'bez ćwiczeń');
    h += acc('habits', 'Nawyki', habS.length ? habS.join(' · ') : 'Płyny, kroki, kofeina, ruch', dHab,
      '<div class="field"><div class="field-hd"><b>Płyny</b><span class="val">' + glassTxt(wv) + ' z ' + gGoal + '</span></div>' + prog(wv, wg) + '<p class="tiny muted" style="margin-top:6px">Szklanka to ' + GLASS + ' ml, kubek ' + CUP + ' ml, butelka ' + BOTTLE + ' ml. Razem: ' + fmt(wv / 1000, 2) + ' l.</p><div class="chips" style="margin-top:8px"><button class="chip" data-a="water" data-d="' + GLASS + '">+ szklanka</button><button class="chip" data-a="water" data-d="' + CUP + '">+ kubek</button><button class="chip" data-a="water" data-d="' + BOTTLE + '">+ butelka</button><button class="chip" data-a="water" data-d="-' + GLASS + '">− szklanka</button></div></div>'
      + '<div class="field"><div class="field-hd"><b>Kroki</b><span class="small muted">z telefonu lub zegarka</span></div><div style="margin-top:8px">' + stepper('steps', d.steps, { step: 1000, min: 0, max: 40000, start: 5000, unit: 'kroków' }) + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Spacer</b><span class="small muted">minuty marszu</span></div><div class="chips" style="margin-top:8px">' + [0, 10, 20, 30, 45, 60, 90].map((m) => '<button class="chip' + (d.walkMin === m ? ' on' : '') + '" data-a="set" data-k="walkMin" data-v="' + m + '">' + (m === 0 ? 'Brak' : m + ' min') + '</button>').join('') + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Kofeina</b><span class="small muted">kawa, herbata, energetyk</span></div><div style="margin-top:8px">' + stepper('caffeine', d.caffeine, { step: 1, min: 0, max: 12, start: 0, unit: 'porcji' }) + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Alkohol</b><span class="small muted">kieliszek, piwo, drink</span></div><div style="margin-top:8px">' + stepper('alcohol', d.alcohol, { step: 1, min: 0, max: 12, start: 0, unit: 'porcji' }) + '</div></div>'
      + '<div class="field"><div class="field-hd"><b>Ćwiczenia</b><span class="small muted">trening, siłownia, bieganie</span></div><div class="chips" style="margin-top:8px">' + [0, 15, 30, 45, 60, 90].map((m) => '<button class="chip' + (d.exercise === m ? ' on' : '') + '" data-a="set" data-k="exercise" data-v="' + m + '">' + (m === 0 ? 'Brak' : m + ' min') + '</button>').join('') + '</div></div>');

    const symName = (k) => (A.SYMPTOMS.find((x) => x[0] === k) || [k, k])[1];
    const obs = d.obs || [];
    const symSum = symK.map((k) => symName(k).toLowerCase()).concat(obs.length ? [obs.length + ' ' + plPl(obs.length, 'wpis', 'wpisy', 'wpisów') + ' z godziną'] : []);
    h += acc('symptoms', 'Objawy', symSum.length ? symSum.join(', ') : d.noSymptoms ? 'Dziś bez objawów' : 'Dotknij lub wpisz z godziną', dSym || obs.length > 0,
      '<div class="chips">' + A.SYMPTOMS.map(([k, l]) => { const v = (d.symptoms || {})[k] || 0; return '<button class="chip' + (v ? ' s' + v : '') + '" data-a="sym" data-k="' + k + '" aria-label="' + l + ', nasilenie ' + v + '">' + l + (v ? '<i>' + '●'.repeat(v) + '</i>' : '') + '</button>'; }).join('')
      + '<button class="chip' + (d.noSymptoms ? ' on' : '') + '" data-a="nosym">Dziś bez objawów</button></div><p class="tiny muted" style="margin-top:8px">Dotknij kilka razy, aby zwiększyć nasilenie: 1 kropka to lekkie, 3 to silne.</p>'
      + '<div class="obs-box"><h3>Wpisz objaw z godziną</h3><p class="tiny muted" style="margin-bottom:10px">Własnymi słowami, np. „9:00 mega głodna” albo „18:00 skurcz brzucha”.</p>' + timeline(d) + '<div style="margin-top:' + ((d.meals || []).length || obs.length ? '12' : '0') + 'px">' + obsForm(date) + '</div></div>');

    const strName = (k) => (A.STRESSORS.find((x) => x[0] === k) || [k, k])[1];
    h += acc('stress', 'Co Cię stresowało?', dStr ? d.stressors.map((k) => strName(k).toLowerCase()).join(', ') : 'Praca, relacje, finanse…', dStr,
      '<div class="chips">' + A.STRESSORS.map(([k, l]) => '<button class="chip rose' + ((d.stressors || []).includes(k) ? ' on' : '') + '" data-a="tog" data-k="stressors" data-v="' + k + '">' + l + '</button>').join('') + '</div>');

    if (st.trackCycle) {
      const FL = ['Brak', 'Plamienie', 'Lekkie', 'Średnie', 'Obfite'];
      h += acc('cycle', 'Cykl: krwawienie', isNum(d.flow) && d.flow > 0 ? FL[d.flow] : 'Zaznacz, jeśli masz miesiączkę', isNum(d.flow) && d.flow > 0,
        '<div class="chips">' + FL.map((l, v) => '<button class="chip rose' + ((d.flow || 0) === v ? ' on' : '') + '" data-a="set" data-k="flow" data-v="' + v + '">' + l + '</button>').join('') + '</div>');
    }
    if ((st.supplements || []).length) {
      const taken = st.supplements.filter((x) => (d.supp || {})[x]);
      h += acc('supp', 'Suplementy i leki', taken.length ? taken.map(esc).join(', ') : 'Zaznacz, co wzięłaś', taken.length > 0,
        '<div class="chips">' + st.supplements.map((x) => '<button class="chip' + ((d.supp || {})[x] ? ' on' : '') + '" data-a="supp" data-v="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>');
    }

    h += '<section class="card" id="sec-meals"><div class="card-hd"><h2>Posiłki</h2><span class="hint">' + (meals.length ? meals.length + ' zapisane' : 'jeszcze nic') + '</span></div>'
      + (meals.length ? '<p class="small" style="margin-bottom:10px">' + macroTxt(tot) + '</p>' : '<p class="small muted" style="margin-bottom:10px">Napisz zwykłym zdaniem, co zjadłaś. Makro policzy się samo.</p>')
      + '<button class="btn" data-a="sh-new">Dodaj posiłek</button></section>';

    h += acc('note', 'Notatka', d.note ? esc(d.note.length > 46 ? d.note.slice(0, 46) + '…' : d.note) : 'Jak minął dzień?', !!d.note,
      '<textarea data-i="note" placeholder="Jak minął dzień? Co poprawiło humor, co Cię martwiło?">' + esc(d.note || '') + '</textarea>');
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
      h += '<section class="card empty"><svg class="em" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#FDEBF2"/><circle cx="23" cy="28" r="3" fill="#2B1824"/><circle cx="41" cy="28" r="3" fill="#2B1824"/><circle cx="17" cy="38" r="4" fill="#7B5BE0" opacity=".3"/><circle cx="47" cy="38" r="4" fill="#7B5BE0" opacity=".3"/><path d="M24 40q8 8 16 0" fill="none" stroke="#2B1824" stroke-width="3" stroke-linecap="round"/></svg><h2>Pusto na talerzu</h2><p>Wpisz na przykład „owsianka z bananem, orzechami i łyżką masła orzechowego”. Pyszczek rozpozna produkty i policzy makro.</p></section>';
    }
    meals.forEach((m) => {
      const t = Fd.sumItems(m.items); const sc = m.after && m.after.score;
      h += '<section class="card meal"><div class="meal-hd"><div><b>' + esc(m.type || 'Posiłek') + '</b> <span class="muted small">' + esc(m.time || '') + '</span></div><button class="btn sm" data-a="sh-edit" data-id="' + m.id + '">Edytuj</button></div>'
        + '<div class="meal-items">' + m.items.map((it) => esc(it.name.replace(/ \(.*\)$/, '')) + ' ' + r0(it.grams) + ' g').join(', ') + '</div>'
        + '<div class="meal-mac">' + (hide() ? '' : '<span>' + r0(t.kcal) + ' <em>kcal</em></span>') + '<span>' + fmt(t.p, 0) + ' <em>g białka</em></span><span>' + fmt(t.c, 0) + ' <em>g węgli</em></span><span>' + fmt(t.f, 0) + ' <em>g tłuszczu</em></span></div>'
        + ((isNum(m.hunger) || isNum(m.sat)) ? '<div class="small" style="margin-top:10px">' + (isNum(m.hunger) ? 'Głód przed: <b>' + HUNGER[m.hunger] + '</b>' : '') + (isNum(m.hunger) && isNum(m.sat) ? ' · ' : '') + (isNum(m.sat) ? 'sytość po: <b>' + SAT[m.sat] + '</b>' : '') + '</div>' : '')
        + '<div class="small muted" style="margin-top:12px">Jak się czułaś po posiłku?</div><div class="rate">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (sc === v ? 'on' + (v <= 2 ? ' low' : '') : '') + '" data-a="rate" data-id="' + m.id + '" data-v="' + v + '" aria-label="Ocena ' + v + ' z 5">' + v + '</button>').join('') + '</div>'
        + ((m.after && m.after.tags && m.after.tags.length) ? '<div class="tagrow">' + m.after.tags.map((g) => '<span class="tag ' + (A.AFTER_TAGS.find((x) => x[0] === g) && ['energia', 'sytość'].includes(g) ? 'good' : 'bad') + '">' + esc(g) + '</span>').join('') + '</div>' : '') + '</section>';
    });
    return h;
  }

  /* ---------- WNIOSKI ---------- */
  const trend = (c) => c.delta === null ? '' : (Math.abs(c.delta) < (c.dec ? 0.15 : 1) ? '<span class="d eq">bez zmian</span>' : '<span class="d ' + ((c.good ? c.delta * c.good > 0 : c.delta > 0) ? 'up' : 'dn') + '">' + (c.delta > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(c.delta), c.dec) + '</span>');
  function insCard(r) {
    const s = r.sentence, tone = s.tone === 'good' ? 'good' : s.tone === 'bad' ? 'bad' : '';
    return '<div class="ins ' + tone + '"><div class="bar"></div><div><h3>' + esc(s.title) + '</h3><p>' + esc(s.detail) + '</p><span class="badge ' + (r.conf === 'wstępna' ? 'a' : r.conf === 'wyraźna' ? 'g' : '') + '">' + r.conf + '</span><span class="badge">n=' + r.n + ', ρ=' + fmt(r.rho, 2) + '</span><div><button class="linkbtn" data-a="explore" data-x="' + r.xk + '" data-y="' + r.yk + '" data-lag="' + (r.lag || 0) + '">Pokaż na wykresie</button></div></div></div>';
  }
  const CMP_KEYS = [['Samopoczucie', ['mood', 'energy', 'stress', 'wbCore']], ['Sen', ['sleepHours', 'sleepQuality']], ['Nawyki', ['water', 'steps', 'walkMin', 'caffeine', 'alcohol', 'exerciseMin']], ['Jedzenie', ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'iron', 'calcium', 'afterAvg']], ['Objawy', ['symptoms'].concat(A.SYMPTOMS.map((x) => 'sym_' + x[0]))]];

  function viewInsights() {
    const res = A.analyze(db, { today: TODAY(), range: S.range }), tg = A.targets(db.settings);
    const P = { over: '', rel: '', lab: '', food: '', cyc: '' }; let cur = 'over';
    let h = '<div class="top"><div class="brand"><img src="icon-192.png" alt=""><b>Pyszczek</b></div></div><div class="page-title"><h1>Wnioski</h1><p class="muted">Co naprawdę wpływa na Twoje samopoczucie</p></div>';
    h += '<div class="seg" role="tablist">' + [[14, '14 dni'], [30, '30 dni'], [90, '90 dni'], [0, 'Wszystko']].map(([v, l]) => '<button class="' + ((S.range || 0) === v ? 'on' : '') + '" data-a="range" data-v="' + v + '">' + l + '</button>').join('') + '</div>';

    res.alerts.forEach((a) => { P[cur] += '<section class="card ' + (a.level === 'warn' ? 'amber' : 'tint') + '"><p class="small" style="color:var(--ink)">' + esc(a.text) + '</p></section>'; });

    const nd = res.checkedDays;
    if (nd < 14) {
      P[cur] += '<section class="card tint"><h2>Zbieram dane</h2><p class="small muted" style="margin:4px 0 8px">' + (nd < 7 ? 'Po 7 dniach wpisów pojawi się podsumowanie tygodnia, a po 14 pierwsze zależności.' : 'Po 14 dniach wpisów pojawią się pierwsze zależności.') + ' Masz ' + nd + ' z 14 dni.</p>' + prog(nd, 14) + (nd < 3 ? '<button class="btn sm" style="margin-top:12px" data-a="demo-load">Zobacz na danych przykładowych</button>' : '') + '</section>';
    }
    if (nd >= 3 && res.week.length) {
      P[cur] += card('Ostatni tydzień', 'zmiana vs tydzień wcześniej', '<div class="tiles">' + res.week.slice(0, 8).map((c) => '<div class="tile"><div class="t">' + c.label + '</div><div class="n">' + fmt(c.cur, c.dec) + '<span class="small muted" style="font-weight:600">' + c.unit + '</span></div>' + trend(c) + '</div>').join('') + '</div>');
    }
    if (nd >= 3) {
      const first = res.recs.length ? res.recs[0].date : TODAY(); const from = S.range ? A.addDays(TODAY(), -(S.range - 1)) : first;
      const ser = (k) => res.recs.map((r) => [r.date, r[k]]);
      P[cur] += card('Trendy', S.range && S.range <= 14 ? 'wartości dzienne' : 'średnia z 3 dni',
        C.line({ from, to: TODAY(), min: 1, max: 10, ticks: [1, 5, 10], smooth: S.range && S.range <= 14 ? 1 : 3, label: 'Nastrój, energia i stres w czasie', series: [{ color: '#DB3F78', data: ser('mood') }, { color: '#7B5BE0', data: ser('energy') }, { color: '#8A7280', dash: '2 5', data: ser('stress') }] })
        + '<div class="legend"><span><i style="background:#DB3F78"></i>Nastrój</span><span><i style="background:#7B5BE0"></i>Energia</span><span><i style="background:#8A7280"></i>Stres</span></div>'
        + '<div style="margin-top:16px"><h3>Sen</h3>' + C.bars({ from, to: TODAY(), max: 12, band: [7, 9], label: 'Godziny snu', data: ser('sleepHours'), color: (v) => (v >= 7 && v <= 9) ? '#DB3F78' : v < 6 ? '#C9BBF3' : '#F0A6C3' }) + '<p class="tiny muted">Zielone tło to zalecane 7–9 godzin.</p></div>');
    }

    P[cur] += expCard(res) + weekdayCard(res);
    cur = 'rel';
    const corr = res.correlations;
    if (nd >= 14) {
      P[cur] += '<section class="card"><div class="card-hd"><h2>Zależności w Twoich danych</h2><span class="hint">' + corr.tested + ' sprawdzonych</span></div>';
      if (corr.confirmed.length) P[cur] += corr.confirmed.map(insCard).join('');
      else P[cur] += '<p class="small muted">Na razie żadna zależność nie wyróżnia się na tle przypadku. To normalne przy małej liczbie dni, więc zapisuj dalej.</p>';
      if (corr.preliminary.length) P[cur] += '<details style="margin-top:10px"><summary class="small b" style="cursor:pointer;color:var(--brand-600)">Wstępne sygnały (' + corr.preliminary.length + ')</summary><p class="tiny muted" style="margin:6px 0">Mogą być przypadkowe. Potraktuj je jak podpowiedź do obserwacji.</p>' + corr.preliminary.map(insCard).join('') + '</details>';
      P[cur] += '<p class="tiny muted" style="margin-top:10px">ρ (rho) to siła zależności od −1 do 1. Wyniki są poprawione na wielokrotne testowanie, żeby ograniczyć przypadkowe trafienia.</p></section>';
    }

    P[cur] += explainCard(res);
    if (res.bestWorst) {
      const bw = res.bestWorst;
      P[cur] += card('Najlepsze i najtrudniejsze dni', 'górna i dolna trójka dni', '<p class="small muted" style="margin-bottom:6px">Porównanie ' + bw.nTop + ' najlepszych dni (średnio ' + fmt(bw.topAvg, 0) + '/100) z ' + bw.nBottom + ' najtrudniejszymi (' + fmt(bw.bottomAvg, 0) + '/100).</p>'
        + (bw.rows.length ? '<div class="bw" style="font-size:12px;color:var(--muted);font-weight:700"><span></span><span>najlepsze</span><span>trudne</span></div>' + bw.rows.map((r) => { const M = A.METRICS[r.key]; return '<div class="bw"><span>' + r.label + '</span><span class="a">' + fmt(r.top, M.dec) + '</span><span class="c">' + fmt(r.bottom, M.dec) + '</span></div>'; }).join('') : '<p class="small muted">Nie ma jeszcze wyraźnych różnic między tymi dniami.</p>'));
    }

    cur = 'food';
    if (nd >= 10) {
      const f = res.food; let body;
      if (f.n < 14) body = '<p class="small muted">Oceniaj samopoczucie po posiłkach (pod każdym zapisanym posiłkiem), a Pyszczek wskaże produkty, po których czujesz się gorzej lub lepiej. Masz ' + f.n + ' z 14 ocenionych posiłków.</p>' + prog(f.n, 14);
      else if (!f.rows.length) body = '<p class="small muted">Nic nie wyróżnia się na tle przypadku (' + f.n + ' ocenionych posiłków).</p>';
      else body = f.rows.map((t) => '<div class="ins ' + (t.tone === 'good' ? 'good' : 'bad') + '"><div class="bar"></div><div><p style="color:var(--ink);margin:0">' + esc(t.text) + '</p><span class="badge">' + t.nA + ' vs ' + t.nB + ' posiłków</span></div></div>').join('') + '<p class="tiny muted" style="margin-top:8px">Posiłki łączą wiele składników naraz, więc to wskazówka do sprawdzenia, a nie dowód. Spróbuj wyeliminować jeden element na 1–2 tygodnie i porównaj.</p>';
      P[cur] += card('Jedzenie a samopoczucie', f.n + ' ocen', body);
    }
    {
      const sa = I.satiety(db, TODAY()); let b;
      if (sa.n < 6) b = '<p class="small muted">Zaznaczaj głód przed posiłkiem i sytość po nim (w oknie posiłku). Masz ' + sa.n + ' z 12 ocen sytości, od tylu Pyszczek zacznie szukać wzorców.</p>' + prog(sa.n, 12);
      else {
        b = '<div class="kv"><span>Średnia sytość po posiłku</span><b>' + fmt(sa.avgSat, 1) + ' z 5 (' + SAT[Math.round(sa.avgSat)] + ')</b></div>';
        sa.rows.forEach((x) => { b += '<div class="ins ' + (x.rho > 0 ? 'good' : 'bad') + '"><div class="bar"></div><div><p style="color:var(--ink);margin:0">' + 'Im więcej: ' + esc(x.label.toLowerCase()) + ' w posiłku, tym ' + (x.rho > 0 ? 'bardziej syta' : 'mniej syta') + ' jesteś po nim.</p><span class="badge">ρ = ' + fmt(x.rho, 2) + ', ' + x.n + ' posiłków</span></div></div>'; });
        if (sa.foodsTop && sa.foodsTop.length) b += '<p class="small" style="margin-top:8px"><b>Najbardziej syci:</b> ' + sa.foodsTop.map((x) => esc(x.name.replace(/ \(.*\)$/, '')) + ' (' + fmt(x.mean, 1) + ')').join(', ') + '</p>';
        if (sa.foodsLow && sa.foodsLow.length) b += '<p class="small"><b>Słabo syci:</b> ' + sa.foodsLow.map((x) => esc(x.name.replace(/ \(.*\)$/, '')) + ' (' + fmt(x.mean, 1) + ')').join(', ') + '</p>';
        if (sa.gap) b += '<div class="ins ' + (sa.gap.rho > 0 ? 'good' : 'bad') + '"><div class="bar"></div><div><p style="color:var(--ink);margin:0">' + (sa.gap.rho > 0 ? 'Im dłuższa przerwa między posiłkami, tym większy głód przed kolejnym.' : 'Dłuższa przerwa nie robi Cię bardziej głodną.') + '</p><span class="badge">ρ = ' + fmt(sa.gap.rho, 2) + ', ' + sa.gap.n + ' posiłków</span></div></div>';
        if (!sa.rows.length && !(sa.foodsTop && sa.foodsTop.length) && !(sa.foodsLow && sa.foodsLow.length) && !sa.gap) b += '<p class="small muted" style="margin-top:6px">Na razie nic nie wyróżnia się wyraźnie. Zapisuj dalej.</p>';
      }
      P[cur] += card('Głód i sytość', sa.n + ' ocen', b);
      const oa = I.obsAnalysis(db, TODAY());
      if (oa.total) P[cur] += card('Obserwacje z godziną', oa.total + ' ' + plPl(oa.total, 'wpis', 'wpisy', 'wpisów'),
        oa.rows.length ? oa.rows.map((x) => '<div class="ins"><div class="bar"></div><div><h3>' + esc(obsName(x.tag)) + ' <span class="tiny muted">(' + x.n + ' razy)</span></h3><p class="small" style="margin:0">Najczęściej około ' + x.peak + ':00 (' + x.peakN + ' z ' + x.n + ' wpisów). Średnio ' + SEV[Math.max(1, Math.round(x.avgSev))] + '.</p>' + (x.foods.length ? x.foods.map((g) => '<p class="small" style="margin:4px 0 0">W ' + g.k + ' z ' + g.n + ' przypadków posiłek sprzed maks. 3 h miał cechę „' + esc(g.tag) + '”, a tak jedzenie stanowi ok. ' + Math.round(g.base * 100) + '% Twoich posiłków.</p>').join('') : '') + '</div></div>').join('') + '<p class="tiny muted" style="margin-top:8px">To zbieżność w czasie, nie dowód przyczyny.</p>'
          : '<p class="small muted">Pyszczek szuka wzorców od 4 wpisów tego samego rodzaju. Dodawaj obserwacje z godziną, a pokażemy, o której porze wracają.</p>');
    }
    cur = 'rel';
    if (res.stressSources.length) {
      P[cur] += card('Źródła stresu', 'Twój stres, gdy…', res.stressSources.map((s) => '<div class="bw"><span>' + esc(s.label) + ' <span class="tiny muted">(' + s.n + ' dni)</span></span><span class="c">' + fmt(s.stressWith) + '</span><span class="a">' + fmt(s.stressWithout) + '</span></div>').join('') + '<p class="tiny muted">Pierwsza liczba: średni stres w dni z tym źródłem. Druga: bez niego.</p>');
    }

    cur = 'cyc';
    const cy = res.cycle;
    if (db.settings.trackCycle && (cy.info.starts.length || nd >= 14)) {
      let body = '';
      if (!cy.info.starts.length) body = '<p class="small muted">Zaznacz dni krwawienia w sekcji „Cykl”, aby zobaczyć wzorce w poszczególnych fazach.</p>';
      else {
        body += '<div class="kv"><span>Średnia długość cyklu</span><b>' + cy.info.avg + ' dni' + (cy.info.valid.length >= 2 && cy.info.sdLen !== null ? ' (±' + fmt(cy.info.sdLen, 1) + ')' : '') + '</b></div><div class="kv"><span>Średni czas miesiączki</span><b>' + cy.info.periodLen + ' dni</b></div>' + (cy.info.next ? '<div class="kv"><span>Następna miesiączka</span><b>ok. ' + dateObj(cy.info.next).getDate() + ' ' + MONTHS_G[dateObj(cy.info.next).getMonth()] + '</b></div>' : '');
        if (cy.phases) body += '<div style="margin-top:12px"><div class="phase h"><span>Faza</span><span>Nastrój</span><span>Energia</span><span>Objawy</span></div>' + cy.phases.map((p) => '<div class="phase"><b>' + ({ menstruacja: 'Menstruacja', folikularna: 'Folikularna', owulacja: 'Owulacja', lutealna: 'Lutealna' })[p.phase] + ' <span class="tiny muted">(' + p.n + ')</span></b><span>' + fmt(p.mood) + '</span><span>' + fmt(p.energy) + '</span><span>' + fmt(p.symptoms) + '</span></div>').join('') + '</div>';
        if (cy.findings.length) body += cy.findings.map((g) => '<div class="ins ' + (g.rows.some((x) => x.tone === 'bad') ? 'bad' : 'good') + '"><div class="bar"></div><div><h3>' + esc(g.title) + '</h3><p class="tiny" style="margin-bottom:4px">w porównaniu z: ' + esc(g.vs) + '</p>' + g.rows.map((x) => '<div class="kv" style="padding:4px 0;border:0"><span style="color:var(--ink)">' + esc(x.label) + '</span><b style="color:' + (x.tone === 'bad' ? 'var(--pink-600)' : 'var(--brand-600)') + '">' + fmt(x.a, 1) + ' vs ' + fmt(x.b, 1) + '</b></div>').join('') + (g.prelim ? '<span class="badge a">wstępne</span>' : '') + '</div></div>').join('');
        if (cy.cycles < 2) body += '<p class="tiny muted" style="margin-top:8px">Wzorce cyklu są wiarygodne po 2–3 pełnych cyklach. Na razie to wstępny obraz.</p>';
      }
      P[cur] += card('Cykl a samopoczucie', cy.cycles + ' ' + (cy.cycles === 1 ? 'pełny cykl' : 'pełnych cykli'), body);
    }

    cur = 'food';
    if (res.nutrition) {
      const n = res.nutrition, sp = n.split;
      P[cur] += card('Odżywianie na tle celów', 'średnia z ' + n.days + ' dni',
        (hide() ? '' : macroRow('Energia', n.kcal, tg.kcal, 'kcal')) + macroRow('Białko', n.protein, tg.protein, 'g') + macroRow('Błonnik', n.fiber, tg.fiber, 'g') + macroRow('Żelazo', n.iron, tg.iron, 'mg', 'pink') + macroRow('Wapń', n.calcium, tg.calcium, 'mg')
        + '<div class="split"><i style="width:' + sp.p + '%;background:#DB3F78"></i><i style="width:' + sp.c + '%;background:#F0A6C3"></i><i style="width:' + sp.f + '%;background:#7B5BE0"></i></div><div class="legend"><span><i style="background:#DB3F78"></i>Białko ' + sp.p + '%</span><span><i style="background:#F0A6C3"></i>Węgle ' + sp.c + '%</span><span><i style="background:#7B5BE0"></i>Tłuszcz ' + sp.f + '%</span></div>'
        + '<p class="tiny muted" style="margin-top:8px">Udział energii. Cele są orientacyjne (zalecenia EFSA/IŻŻ dla dorosłych kobiet) i nie zastępują porady dietetyka. Do analizy liczą się dni z zapisem co najmniej 600 kcal.</p>');
    }

    cur = 'lab';
    P[cur] += simCard();
    /* porównywarka */
    const opt = (sel) => CMP_KEYS.map(([g, ks]) => '<optgroup label="' + g + '">' + ks.map((k) => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + A.metricLabel(k) + '</option>').join('') + '</optgroup>').join('');
    const cmp = A.compare(db, S.cmp.x, S.cmp.y, S.cmp.lag); let cb = '';
    if (!cmp.ok) cb = '<p class="small muted" style="margin-top:12px">Za mało wspólnych dni (' + cmp.n + '). Potrzeba co najmniej 10.</p>';
    else {
      const X = A.METRICS[S.cmp.x], Y = A.METRICS[S.cmp.y], ar = Math.abs(cmp.rho), strength = ar < 0.2 ? 'bardzo słaba' : ar < 0.4 ? 'słaba' : ar < 0.6 ? 'umiarkowana' : 'silna';
      cb = '<div style="margin-top:12px">' + C.scatter({ points: cmp.points, xl: X.label + (X.unit ? ' (' + X.unit.trim() + ')' : ''), yl: Y.label, xdec: X.dec, ydec: Y.dec, label: 'Wykres zależności' }) + '</div>'
        + '<p class="small" style="margin-top:6px"><b>' + (cmp.rho >= 0 ? 'Dodatnia' : 'Ujemna') + ', ' + strength + '</b> (ρ=' + fmt(cmp.rho, 2) + ', n=' + cmp.n + '). ' + (cmp.p < 0.05 ? 'Taka zależność jest mało prawdopodobna jako przypadek (' + (cmp.p < 0.001 ? 'p<0,001' : 'p=' + fmt(cmp.p, 3)) + ').' : 'Może to być przypadek (p=' + fmt(cmp.p, 2) + ').') + '</p>'
        + (cmp.groups ? '<p class="small muted" style="margin-top:4px">' + esc(A.metricLabel(S.cmp.x)) + ' powyżej ' + fmt(cmp.groups.med, X.dec) + X.unit + ': ' + esc(Y.label.toLowerCase()) + ' średnio ' + fmt(cmp.groups.hiMean, Y.dec) + ' wobec ' + fmt(cmp.groups.loMean, Y.dec) + ' w pozostałe dni.</p>' : '');
    }
    P[cur] += card('Porównaj dwie rzeczy', 'dowolna para',
      '<div class="stack"><div><label class="lb">Co zmieniam (przyczyna)</label><select data-i="cmp-x">' + opt(S.cmp.x) + '</select></div><div><label class="lb">Co sprawdzam (skutek)</label><select data-i="cmp-y">' + opt(S.cmp.y) + '</select></div><div><label class="lb">Kiedy</label><select data-i="cmp-lag"><option value="0"' + (S.cmp.lag === 0 ? ' selected' : '') + '>Tego samego dnia</option><option value="1"' + (S.cmp.lag === 1 ? ' selected' : '') + '>Następnego dnia</option></select></div></div>' + cb);

    const TABS = [['over', 'Przegląd'], ['rel', 'Zależności'], ['lab', 'Eksploruj'], ['food', 'Jedzenie']].concat(db.settings.trackCycle ? [['cyc', 'Cykl']] : []);
    if (!TABS.some((x) => x[0] === S.itab)) S.itab = 'over';
    h += '<div class="tabs" role="tablist">' + TABS.map(([k, l]) => '<button role="tab" aria-selected="' + (S.itab === k) + '" class="' + (S.itab === k ? 'on' : '') + '" data-a="itab" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
    h += P[S.itab] || '<section class="card"><p class="small muted">Tu pojawią się wyniki, gdy zbierze się więcej danych.</p></section>';
    h += '<p class="disclaimer">Pyszczek pokazuje zależności statystyczne w Twoich zapisach. Korelacja nie dowodzi przyczyny, a wyniki nie są diagnozą ani poradą medyczną. Przy niepokojących objawach skontaktuj się z lekarzem.</p>';
    return h;
  }


  /* ---------- analityka interaktywna ---------- */
  const WI_X = { sleepHours: 0.5, sleepQuality: 1, water: 100, exerciseMin: 5, steps: 1000, walkMin: 10, caffeine: 1, alcohol: 1, sugar: 5, fiber: 1, protein: 5, stressors: 1 };
  const WI_Y = ['wbCore', 'mood', 'energy', 'stress', 'sleepQuality', 'symptoms', 'afterAvg'];
  const rangeFrom = () => S.range ? A.addDays(TODAY(), -(S.range - 1)) : null;
  const sgn = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);

  function expCard(res) {
    const ex = db.settings.experiment; let h = '';
    if (ex) {
      const ev = I.evalExperiment(db, ex, TODAY()), Y = A.METRICS[ev.exp.y], X = A.METRICS[ev.exp.x];
      let body = '<p class="small">' + esc(ex.title) + '</p>' + prog(Math.min(7, ev.elapsed), 7)
        + '<p class="small muted" style="margin-top:6px">Dzień ' + Math.max(1, Math.min(7, ev.elapsed)) + ' z 7. Cel osiągnięty w ' + ev.adh + ' z ' + ev.logged + ' dni z wpisem (' + esc(X.label.toLowerCase()) + ').</p>';
      if (ev.done) {
        const V = { lepiej: 'Wynik: ruch w dobrą stronę. W czasie wyzwania „' + Y.label + '” było średnio ' + fmt(ev.yMean, Y.dec) + ' wobec ' + fmt(ev.baseMean, Y.dec) + ' w 2 tygodniach wcześniej (' + sgn(ev.delta, Y.dec) + '). Jeden tydzień to za mało na pewność, więc najlepiej powtórzyć lub kontynuować.',
          gorzej: 'Wynik: „' + Y.label + '” było średnio ' + fmt(ev.yMean, Y.dec) + ' wobec ' + fmt(ev.baseMean, Y.dec) + ' wcześniej (' + sgn(ev.delta, Y.dec) + '), czyli gorzej niż przed wyzwaniem. Ta zmiana mogła mieć inną przyczynę, np. cykl, stres albo pogodę. Zależność z analizy może nie być przyczynowa.',
          'bez-zmian': 'Wynik: bez wyraźnej zmiany („' + Y.label + '” ' + fmt(ev.yMean, Y.dec) + ' wobec ' + fmt(ev.baseMean, Y.dec) + ' wcześniej). Zależność z analizy mogła być przypadkowa albo efekt wymaga dłuższego czasu.',
          'za-malo': 'Plan udało się utrzymać tylko w ' + ev.adh + ' z 7 dni, więc wyniku nie da się wiarygodnie ocenić. Spróbuj jeszcze raz z celem, który jest dla Ciebie realny.',
          'brak-danych': 'Za mało wpisów, aby porównać ten tydzień z poprzednimi. Wpisuj samopoczucie codziennie, a wynik będzie czytelniejszy.' };
        body += '<div class="verdict ' + ev.verdict + '"><p class="small">' + V[ev.verdict] + '</p></div><button class="btn" data-a="exp-end" style="margin-top:10px">Zapisz wynik i zamknij</button>';
      } else body += '<button class="btn ghost sm" data-a="exp-cancel" style="margin-top:10px">Przerwij wyzwanie</button>';
      h += '<section class="card rose"><div class="card-hd"><h2>Wyzwanie tygodnia</h2><span class="hint">' + (ev.done ? 'koniec' : 'w toku') + '</span></div>' + body + '</section>';
    } else if (res.experiment) {
      S.expProp = res.experiment;
      h += '<section class="card rose"><div class="card-hd"><h2>Wyzwanie na ten tydzień</h2></div><p class="small">' + esc(res.experiment.text) + '</p><button class="btn primary" data-a="exp-start" style="margin-top:12px">Podejmuję wyzwanie</button><p class="tiny muted" style="margin-top:8px">Pyszczek sprawdzi po 7 dniach, czy samopoczucie faktycznie się zmieniło względem 2 poprzednich tygodni.</p></section>';
    }
    const hist = db.settings.expHistory || [];
    if (hist.length) h += card('Zakończone wyzwania', '', hist.slice(-4).reverse().map((x) => '<div class="kv"><span>' + esc(x.title) + '</span><b>' + ({ lepiej: 'lepiej', gorzej: 'gorzej', 'bez-zmian': 'bez zmian', 'za-malo': 'niemiarodajne', 'brak-danych': 'brak danych' })[x.verdict] + '</b></div>').join(''));
    return h;
  }

  function weekdayCard(res) {
    if (res.checkedDays < 14) return '';
    const w = I.weekdays(db, 'wbCore', rangeFrom());
    if (!w.ok) return card('Dni tygodnia', '', '<p class="small muted">Po około 4 tygodniach wpisów zobaczysz, które dni tygodnia są dla Ciebie lżejsze, a które trudniejsze.</p>');
    const vals = w.rows.map((r) => r.mean), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const bars = '<div class="wk7">' + w.rows.map((r) => '<div class="wk-c' + (w.sig && r === w.best ? ' best' : '') + (w.sig && r === w.worst ? ' worst' : '') + '"><b>' + fmt(r.mean, 0) + '</b><i style="height:' + Math.max(6, (r.mean - Math.min(lo, 40) * 0) / Math.max(hi, 1) * 74).toFixed(0) + 'px"></i><span>' + r.short + '</span></div>').join('') + '</div>';
    const txt = w.sig ? 'Najlepiej czujesz się w dzień: <b>' + w.best.label + '</b> (' + fmt(w.best.mean, 0) + '/100), a najtrudniej: <b>' + w.worst.label + '</b> (' + fmt(w.worst.mean, 0) + '/100). Ten wzorzec rzadko jest dziełem przypadku (p=' + fmt(w.p, 3) + ').'
      : 'Różnice między dniami tygodnia (do ' + fmt(w.spread, 0) + ' pkt) mieszczą się w granicach przypadku (p=' + fmt(w.p, 2) + '), więc na razie nie ma stałego wzorca.';
    return card('Dni tygodnia', 'średnie samopoczucie (0–100)', bars + '<p class="small" style="margin-top:8px">' + txt + '</p>');
  }

  function explainCard(res) {
    if (res.checkedDays < 14) return '';
    const from = rangeFrom(), t = TODAY(), worst = I.extremeDay(db, from, t, false), best = I.extremeDay(db, from, t, true);
    const date = S.xd || worst; if (!date) return '';
    const e = I.explainDay(db, date), recs = res.recs.filter((r) => !from || r.date >= from).slice(-35);
    const lvl = (v) => v == null ? 'e' : v < 35 ? '0' : v < 55 ? '1' : v < 75 ? '2' : '3';
    const strip = '<div class="dots" role="group" aria-label="Wybierz dzień">' + recs.map((r) => '<button class="dd l' + lvl(r.wbCore) + (r.date === date ? ' sel' : '') + '" data-a="xday" data-d="' + r.date + '" aria-label="' + longDate(r.date) + '"></button>').join('') + '</div><div class="legend" style="margin-top:4px"><span><i class="lg0"></i>trudny</span><span><i class="lg2"></i>dobry</span><span><i class="lg3"></i>świetny</span></div>';
    let body = '<div class="chips" style="margin-bottom:10px"><button class="chip' + (date === worst ? ' on' : '') + '" data-a="xday" data-d="' + worst + '">Najtrudniejszy</button><button class="chip' + (date === best ? ' on' : '') + '" data-a="xday" data-d="' + best + '">Najlepszy</button><button class="chip' + (date === t ? ' on' : '') + '" data-a="xday" data-d="' + t + '">Dziś</button></div>' + strip;
    if (!e.ok) body += '<p class="small muted" style="margin-top:10px">' + esc(e.reason) + '</p>';
    else {
      body += '<div class="xhead"><div><b>' + longDate(date) + '</b><div class="small muted">samopoczucie ' + fmt(e.score, 0) + '/100, ' + (e.delta >= 0 ? 'o ' + fmt(e.delta, 0) + ' pkt powyżej' : 'o ' + fmt(-e.delta, 0) + ' pkt poniżej') + ' Twojej średniej (' + fmt(e.base, 0) + ')</div></div></div>';
      if (!e.factors.length) body += '<p class="small" style="margin-top:8px">Nic wyraźnie nie odbiega od Twojej normy. W Twoich danych ten dzień nie ma jednej oczywistej przyczyny.</p>';
      else {
        const sub = e.delta < 0 ? 'Co mogło się na to złożyć' : 'Co mogło temu sprzyjać';
        body += '<h3 style="margin:12px 0 4px">' + sub + '</h3>' + e.factors.map((f) => '<div class="ins ' + (f.good ? 'good' : 'bad') + '"><div class="bar"></div><div><b>' + esc(f.label) + (f.lag ? ' (dzień wcześniej)' : '') + ': ' + fmt(f.value, f.dec) + f.unit + '</b> <span class="small muted">(zwykle ' + fmt(f.typical, f.dec) + f.unit + ')</span><p class="small" style="margin-top:2px">' + (f.good ? 'W Twoich danych taka wartość zwykle idzie w parze z lepszym samopoczuciem.' : 'W Twoich danych taka wartość zwykle idzie w parze z gorszym samopoczuciem.') + '</p></div></div>').join('')
          + '<p class="tiny muted" style="margin-top:6px">To zestawienie z Twoich własnych zależności (korelacje), a nie dowód przyczyny.</p>';
      }
      if (S.date !== date) body += '<button class="btn sm" data-a="xopen" data-d="' + date + '" style="margin-top:10px">Otwórz ten dzień w dzienniku</button>';
    }
    return card('Dlaczego ten dzień był taki?', 'dotknij dnia', body);
  }

  const wiKey = () => S.wi.x + '|' + S.wi.y + '|' + S.wi.lag + '|' + S.ver;
  function wiGet() { if (!S.wiC || S.wiC.key !== wiKey()) S.wiC = { key: wiKey(), w: I.whatIf(db, S.wi.x, S.wi.y, S.wi.lag) }; return S.wiC.w; }
  function wiSvg(w, v) {
    const W = 300, H = 150, pl = 8, pr = 8, pt = 8, pb = 8, X0 = w.xmin, X1 = w.xmax === w.xmin ? w.xmin + 1 : w.xmax;
    const pairs = A.buildRecords(db.days); const by = {}; pairs.forEach((r) => { by[r.date] = r; });
    const pts = []; pairs.forEach((r) => { const x = r[S.wi.x]; if (!isNum(x)) return; const o = by[S.wi.lag ? A.addDays(r.date, S.wi.lag) : r.date]; if (o && isNum(o[S.wi.y])) pts.push([x, o[S.wi.y]]); });
    const ys = pts.map((p) => p[1]).concat([w.at(X0).y, w.at(X1).y]); let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys); if (y1 - y0 < 1) { y1 += .5; y0 -= .5; }
    const sx = (x) => pl + (x - X0) / (X1 - X0) * (W - pl - pr), sy = (y) => H - pb - (y - y0) / (y1 - y0) * (H - pt - pb);
    const band = [X0, X1].map((x) => [sx(x), sy(w.at(x).hi)]).concat([X1, X0].map((x) => [sx(x), sy(w.at(x).lo)]));
    let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wi-svg" role="img" aria-label="Wykres zależności z prognozą"><polygon points="' + band.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ') + '" fill="var(--brand-100)" opacity=".7"/>';
    pts.forEach((p) => { g += '<circle cx="' + sx(p[0]).toFixed(1) + '" cy="' + sy(p[1]).toFixed(1) + '" r="2.6" fill="var(--pink)" opacity=".35"/>'; });
    g += '<line x1="' + sx(X0).toFixed(1) + '" y1="' + sy(w.at(X0).y).toFixed(1) + '" x2="' + sx(X1).toFixed(1) + '" y2="' + sy(w.at(X1).y).toFixed(1) + '" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round"/>';
    const cx = sx(Math.max(X0, Math.min(X1, v))), a = w.at(v); g += '<line x1="' + cx.toFixed(1) + '" y1="' + pt + '" x2="' + cx.toFixed(1) + '" y2="' + (H - pb) + '" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 3"/><circle cx="' + cx.toFixed(1) + '" cy="' + sy(a.y).toFixed(1) + '" r="6" fill="var(--brand)" stroke="#fff" stroke-width="2.5"/></svg>';
    return g;
  }
  function wiOut(w) {
    const X = A.METRICS[S.wi.x], Y = A.METRICS[S.wi.y], step = WI_X[S.wi.x];
    let v = S.wi.v == null ? Math.round(w.xmed / step) * step : S.wi.v; v = Math.max(w.xmin, Math.min(w.xmax, v));
    const at = w.at(v), base = w.at(w.xmean), d = at.y - base.y;
    let t = '<p class="wi-big">Gdy „' + esc(X.label) + '” = <b>' + fmt(v, X.dec) + X.unit + '</b></p><p class="small">„' + esc(Y.label) + '”' + (S.wi.lag ? ' następnego dnia' : '') + ' wynosiło w Twoich danych średnio ok. <b>' + fmt(at.y, Y.dec) + Y.unit + '</b> (zakres niepewności ' + fmt(at.lo, Y.dec) + ' do ' + fmt(at.hi, Y.dec) + ').</p>';
    if (Math.abs(d) >= (Y.dec ? 0.1 : 1)) t += '<p class="small" style="margin-top:4px">To ' + sgn(d, Y.dec) + Y.unit + ' względem Twojej typowej wartości (' + fmt(w.xmean, X.dec) + X.unit + ').</p>';
    if (!w.sig) t += '<p class="small" style="margin-top:6px;color:var(--amber-600)">Ta zależność jest słaba lub niepewna (' + (w.p < 0.001 ? 'p<0,001' : 'p=' + fmt(w.p, 2)) + '), więc potraktuj prognozę jako ciekawostkę.</p>';
    if (v < w.x10 || v > w.x90) t += '<p class="tiny muted" style="margin-top:4px">Ta wartość rzadko się u Ciebie zdarza, więc szacunek jest mniej pewny.</p>';
    return { chart: wiSvg(w, v), text: t, v };
  }
  function simCard() {
    const opt = (o, sel, fn) => o.map((k) => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + fn(k) + '</option>').join('');
    const w = wiGet();
    let body = '<div class="grid2"><div><label class="lb" for="wi-x">Gdybym zmieniła</label><select id="wi-x" data-i="wi-x">' + opt(Object.keys(WI_X), S.wi.x, A.metricLabel) + '</select></div><div><label class="lb" for="wi-y">Jak to wpłynie na</label><select id="wi-y" data-i="wi-y">' + opt(WI_Y, S.wi.y, A.metricLabel) + '</select></div></div>'
      + '<div style="margin-top:8px"><label class="lb" for="wi-l">Kiedy</label><select id="wi-l" data-i="wi-l"><option value="0"' + (S.wi.lag === 0 ? ' selected' : '') + '>Tego samego dnia</option><option value="1"' + (S.wi.lag === 1 ? ' selected' : '') + '>Następnego dnia</option></select></div>';
    if (!w.ok) return card('Symulator „co jeśli”', '', body + '<p class="small muted" style="margin-top:12px">Za mało wspólnych dni (' + w.n + '). Potrzeba co najmniej 14.</p>');
    const o = wiOut(w), X = A.METRICS[S.wi.x];
    body += '<div id="wi-box" style="margin-top:14px"><div id="wi-chart">' + o.chart + '</div><input type="range" id="wi-r" class="range" data-i="wi-v" min="' + w.xmin + '" max="' + w.xmax + '" step="' + WI_X[S.wi.x] + '" value="' + o.v + '" aria-label="' + esc(X.label) + '"><div class="scale-lbl"><span>' + fmt(w.xmin, X.dec) + X.unit + '</span><span>' + fmt(w.xmax, X.dec) + X.unit + '</span></div><div id="wi-text">' + o.text + '</div></div>'
      + '<p class="tiny muted" style="margin-top:8px">Linia pokazuje średni trend z Twoich ' + w.n + ' dni, a jasny pas to niepewność tego trendu. To opis zależności w Twoich zapisach, nie obietnica efektu.</p>';
    return card('Symulator „co jeśli”', 'przesuń suwak', body);
  }


  /* ---------- przypomnienia ---------- */
  const hhmm = (v) => /^\d{2}:\d{2}$/.test(v || '') ? v : '20:30';
  function nudge() {
    const r = db.settings.rem || {}, d = db.days[TODAY()]; if (!r.evening || A.checkedIn(d)) return '';
    const now = new Date(), cur = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (cur < hhmm(r.eTime)) return '';
    return '<section class="card amber"><div class="row"><div><h3>Czas na dzisiejszy wpis</h3><p class="small">Zajmie około minuty. Zacznij od nastroju i energii.</p></div><button class="btn sm" data-a="sec-go" data-id="feel" style="flex:none">Zaczynam</button></div></section>';
  }
  function icsText() {
    const r = db.settings.rem || {}, t = TODAY().replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', ev = [];
    const add = (uid, time, title, desc) => { const p = hhmm(time).split(':'); ev.push(['BEGIN:VEVENT', 'UID:pyszczek-' + uid + '@pyszczek', 'DTSTAMP:' + stamp, 'DTSTART:' + t + 'T' + p[0] + p[1] + '00', 'DURATION:PT10M', 'RRULE:FREQ=DAILY', 'SUMMARY:' + title, 'DESCRIPTION:' + desc, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + title, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n')); };
    if (r.evening) add('wieczor', r.eTime, 'Pyszczek: wpis wieczorny', 'Jak minął dzień? Uzupełnij nastrój, energię i posiłki.');
    if (r.morning) add('rano', r.mTime, 'Pyszczek: jak spałaś?', 'Zapisz godziny i jakość snu.');
    if (r.water) { add('woda1', '11:00', 'Pyszczek: czas na wodę', 'Szklanka wody.'); add('woda2', '15:00', 'Pyszczek: czas na wodę', 'Szklanka wody.'); add('woda3', '19:00', 'Pyszczek: czas na wodę', 'Szklanka wody.'); }
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pyszczek//PL', 'CALSCALE:GREGORIAN'].concat(ev, ['END:VCALENDAR']).join('\r\n');
  }
  function downloadIcs() {
    const r = db.settings.rem || {}; if (!r.evening && !r.morning && !r.water) { toast('Włącz co najmniej jedno przypomnienie'); return; }
    const blob = new Blob([icsText()], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pyszczek-przypomnienia.ics'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Otwórz pobrany plik, aby dodać do Kalendarza');
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
    const cfl = st.customFoods || [];
    h += card('Moje produkty', cfl.length + ' zapisanych', cfl.length ? cfl.map((c, i) => '<div class="row" style="padding:6px 0"><span><b>' + esc(c.name) + '</b><div class="tiny muted">' + (hide() ? '' : r0(c.per100.kcal) + ' kcal, ') + 'białko ' + fmt(c.per100.p, 1) + ' g / 100 g</div></span><button class="btn sm ghost" data-a="cf-del" data-i="' + i + '" aria-label="Usuń ' + esc(c.name) + '">Usuń</button></div>').join('') : '<p class="small muted">Gdy dodasz produkt ręcznie w posiłku i zaznaczysz „Zapamiętaj”, pojawi się tutaj i będzie rozpoznawany we wpisach.</p>');
    h += '<section class="card tint"><div class="card-hd"><h2>Moje cele dzienne</h2></div><div class="kv"><span>Energia</span><b>' + (tg.kcal ? tg.kcal + ' kcal' : 'uzupełnij dane') + '</b></div><div class="kv"><span>Białko</span><b>' + tg.protein + ' g</b></div><div class="kv"><span>Błonnik</span><b>' + tg.fiber + ' g</b></div><div class="kv"><span>Żelazo</span><b>' + tg.iron + ' mg</b></div><div class="kv"><span>Wapń</span><b>' + tg.calcium + ' mg</b></div><div class="kv"><span>Woda</span><b>' + tg.water + ' ml</b></div><p class="tiny muted" style="margin-top:8px">Energia wg wzoru Mifflina-St Jeora, żelazo i wapń wg norm EFSA dla dorosłych kobiet. To wartości orientacyjne.</p></section>';
    h += '<section class="card">' + tog('trackCycle', 'Śledzę cykl', 'Fazy, prognoza miesiączki i analiza wzorców')
      + tog('hideKcal', 'Ukryj kalorie', 'Pokazuj tylko białko, węgle, tłuszcz i samopoczucie') + '</section>';
    h += card('Suplementy i leki', 'pojawią się w sekcji Dziś',
      '<div class="chips">' + (st.supplements || []).map((s, i) => '<button class="chip on" data-a="supp-del" data-i="' + i + '" aria-label="Usuń ' + esc(s) + '">' + esc(s) + ' ×</button>').join('') + '</div><div class="grid2" style="grid-template-columns:1fr auto;margin-top:10px"><input type="text" id="p-supp" placeholder="np. żelazo, witamina D" data-i="supp-new" value="' + esc(S.newSupp) + '"><button class="btn sm" style="min-height:46px" data-a="supp-add">Dodaj</button></div>');
    if (st.trackCycle) h += card('Cykl: wartości startowe', 'do czasu zebrania własnych danych', '<div class="grid2"><div><label class="lb" for="p-cl">Długość cyklu (dni)</label><input id="p-cl" type="number" inputmode="numeric" data-i="prof" data-k="cycleLen" value="' + esc(st.cycleLen) + '"></div><div><label class="lb" for="p-pl">Czas miesiączki (dni)</label><input id="p-pl" type="number" inputmode="numeric" data-i="prof" data-k="periodLen" value="' + esc(st.periodLen) + '"></div></div>');
    const rm = st.rem || {}, rtog = (k, title, sub) => '<div class="toggle"><div><b>' + title + '</b><div class="small muted">' + sub + '</div></div><button class="sw' + (rm[k] ? ' on' : '') + '" role="switch" aria-checked="' + !!rm[k] + '" aria-label="' + title + '" data-a="rem" data-k="' + k + '"></button></div>';
    h += card('Przypomnienia', 'przez Kalendarz w telefonie',
      rtog('evening', 'Wpis wieczorny', 'Codziennie o <input class="tm" type="time" data-i="rem-t" data-k="eTime" value="' + hhmm(rm.eTime) + '" aria-label="Godzina wpisu wieczornego">')
      + rtog('morning', 'Rano: jak spałaś', 'Codziennie o <input class="tm" type="time" data-i="rem-t" data-k="mTime" value="' + hhmm(rm.mTime) + '" aria-label="Godzina porannego wpisu">')
      + rtog('water', 'Woda', 'Trzy razy dziennie: 11:00, 15:00 i 19:00')
      + '<button class="btn" data-a="ics" style="margin-top:10px">Dodaj do Kalendarza</button>'
      + '<p class="tiny muted" style="margin-top:8px">Pyszczek działa bez serwera, więc przypomnienia dodajesz do Kalendarza telefonu: po dotknięciu przycisku otwórz pobrany plik i wybierz „Dodaj wszystkie”. Alarmy będą działały nawet przy zamkniętej aplikacji. Gdy zmienisz godzinę, dodaj plik ponownie i usuń stare wydarzenia. Tego, że dziś nie ma wpisu, aplikacja przypomni sama po otwarciu.</p>');
    const pt = st.pet || { on: true, caught: 0 };
    h += card('Pyszczek, Twój zwierzak', '', '<div class="toggle" style="padding-top:0"><div><b>Pokazuj zwierzaka</b><div class="small muted">Podczas przewijania czasem wygląda zza krawędzi ekranu. Złap go dotknięciem, a dostaniesz buziaka w nosek.</div></div><button class="sw' + (pt.on ? ' on' : '') + '" role="switch" aria-checked="' + !!pt.on + '" aria-label="Pokazuj zwierzaka" data-a="pet-tog"></button></div>' + (window.__pyszczekPet ? '<div class="pets" role="radiogroup" aria-label="Wybierz zwierzaka">' + window.__pyszczekPet.KINDS.map((k) => '<button class="pk' + ((pt.kind || 'kot') === k[0] ? ' on' : '') + '" role="radio" aria-checked="' + ((pt.kind || 'kot') === k[0]) + '" data-a="pet-kind" data-v="' + k[0] + '">' + window.__pyszczekPet.face(false, k[0]) + '<span>' + k[1] + '</span></button>').join('') + '</div>' : '') + '<div class="kv"><span>Złapane Pyszczki</span><b>' + (pt.caught || 0) + '</b></div>');
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
    return m ? { id: m.id, date, type: m.type, time: m.time || '12:00', text: m.text || '', items: JSON.parse(JSON.stringify(m.items || [])), unmatched: [], score: m.after && isNum(m.after.score) ? m.after.score : null, tags: (m.after && m.after.tags) ? m.after.tags.slice() : [], hunger: isNum(m.hunger) ? m.hunger : null, sat: isNum(m.sat) ? m.sat : null, manual: null, off: null, q: '' }
      : { id: null, date, type, time: date === TODAY() ? hh : '12:00', text: '', items: [], unmatched: [], score: null, tags: [], hunger: null, sat: null, manual: null, off: null, q: '' };
  }
  const itemSmall = (it) => { const t = Fd.itemTotals(it); return (hide() ? '' : r0(t.kcal) + ' kcal, ') + 'białko ' + fmt(t.p, 1) + ' g'; };
  function sheetTotals() { return macroTxt(Fd.sumItems(S.sheet.items)); }
  function viewSheet() {
    const sh = S.sheet; let h = '<div class="sheet" role="dialog" aria-modal="true" aria-label="Posiłek"><div class="sheet-hd"><button class="x" data-a="sh-close">Anuluj</button><b>' + (sh.id ? 'Edytuj posiłek' : 'Nowy posiłek') + '</b><button class="btn sm primary" data-a="sh-save">Zapisz</button></div><div class="sheet-body stack">';
    h += '<div class="chips">' + MEAL_TYPES.map((t) => '<button class="chip' + (sh.type === t ? ' on' : '') + '" data-a="sh-type" data-v="' + t + '">' + t + '</button>').join('') + '</div>';
    h += '<div class="grid2" style="grid-template-columns:110px 1fr;align-items:end"><div><label class="lb" for="sh-time">Godzina</label><input id="sh-time" type="time" data-i="sh-time" value="' + esc(sh.time) + '"></div><button class="btn" data-a="sh-calc" style="min-height:46px">Przelicz makro</button></div>';
        h += '<div><label class="lb" for="sh-text">Co zjadłaś?</label><textarea id="sh-text" data-i="sh-text" placeholder="np. owsianka z bananem, orzechami włoskimi i łyżką masła orzechowego">' + esc(sh.text) + '</textarea><p class="tiny muted" style="margin-top:4px">Pisz zwyczajnie, np. „100 g mix warzyw”, „2 łyżki oliwy”, „szklanka mleka”, „czubata łyżka masła orzechowego”. Czego nie ma w bazie, dodaj poniżej i zapamiętaj.</p></div>';
    if (sh.unmatched.length) {
      h += '<section class="card amber" style="margin:0"><h3>Nie rozpoznałam</h3>' + sh.unmatched.map((u, i) => '<div class="row" style="margin-top:8px"><b>' + esc(u.text) + '</b><span style="display:flex;gap:6px"><button class="btn sm" data-a="sh-off" data-i="' + i + '">Szukaj</button><button class="btn sm ghost" data-a="sh-man" data-i="' + i + '">Wpisz</button><button class="btn sm ghost" data-a="sh-skip" data-i="' + i + '" aria-label="Pomiń">×</button></span></div>').join('') + '</section>';
    }
    h += '<section class="card" style="margin:0"><div class="card-hd"><h2>Skład</h2><span class="hint" id="sh-tot">' + (sh.items.length ? sheetTotals() : '') + '</span></div><div id="sh-items">' + (sh.items.length ? sh.items.map(itemRow).join('') : '<p class="small muted">Wpisz posiłek i naciśnij „Przelicz makro” albo dodaj produkt poniżej.</p>') + '</div></section>';
    h += '<div><label class="lb" for="sh-q">Dodaj produkt</label><input id="sh-q" type="search" data-i="sh-q" placeholder="Szukaj w bazie, np. jabłko" value="' + esc(sh.q) + '" autocomplete="off"><div id="sh-sugs">' + sugsHtml() + '</div></div>';
    if (sh.off) {
      h += '<section class="card" style="margin:0"><div class="card-hd"><h2>Open Food Facts</h2><button class="x small muted b" data-a="sh-offx">Zamknij</button></div>' + (sh.off.loading ? '<p class="small muted">Szukam…</p>' : sh.off.error ? '<p class="small" style="color:var(--pink-600)">' + esc(sh.off.error) + '</p>' : sh.off.results.length ? '<div class="sug">' + sh.off.results.map((r, i) => '<button data-a="sh-off-add" data-i="' + i + '"><span>' + esc(r.name) + (r.brand ? ' <small>' + esc(r.brand) + '</small>' : '') + '</span><small>' + r0(r.per100.kcal) + ' kcal/100 g</small></button>').join('') + '</div>' : '<p class="small muted">Brak wyników. Spróbuj innej nazwy albo wpisz wartości ręcznie.</p>') + '</section>';
    }
    if (sh.manual) {
      const m = sh.manual; h += '<section class="card" style="margin:0"><h2>Wpisz ręcznie</h2><p class="tiny muted" style="margin-bottom:8px">Podaj wartości dla całej porcji.</p><div class="stack"><div><label class="lb">Nazwa</label><input type="text" data-i="man" data-k="name" value="' + esc(m.name) + '"></div><div class="grid2"><div><label class="lb">Porcja (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="grams" value="' + esc(m.grams) + '"></div><div><label class="lb">Energia (kcal)</label><input type="number" inputmode="decimal" data-i="man" data-k="kcal" value="' + esc(m.kcal) + '"></div></div><div class="grid3"><div><label class="lb">Białko (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="p" value="' + esc(m.p) + '"></div><div><label class="lb">Węgle (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="c" value="' + esc(m.c) + '"></div><div><label class="lb">Tłuszcz (g)</label><input type="number" inputmode="decimal" data-i="man" data-k="f" value="' + esc(m.f) + '"></div></div><label class="check"><input type="checkbox" data-i="man-rem"' + (m.rem ? ' checked' : '') + '> Zapamiętaj ten produkt na przyszłość</label><div class="btns two"><button class="btn primary" data-a="sh-man-save">Dodaj</button><button class="btn ghost" data-a="sh-man-x">Anuluj</button></div></div></section>';
    } else h += '<button class="btn ghost" data-a="sh-man" data-i="-1">Wpisz produkt ręcznie</button>';
    h += '<section class="card tint" style="margin:0"><h2>Głód i sytość</h2><p class="tiny muted" style="margin-bottom:6px">Zaznacz przed jedzeniem albo po nim. Pyszczek porówna, po czym jesteś najedzona najdłużej.</p><div class="small b">Jak bardzo byłaś głodna przed posiłkiem?</div><div class="rate" style="margin-top:6px">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (sh.hunger === v ? 'on' : '') + '" data-a="sh-hun" data-v="' + v + '" aria-label="Głód ' + HUNGER[v] + '">' + v + '</button>').join('') + '</div><div class="scale-lbl"><span>brak</span><span>wilczy głód</span></div><div class="small b" style="margin-top:12px">Jak syta jesteś po posiłku?</div><div class="rate" style="margin-top:6px">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (sh.sat === v ? 'on' : '') + '" data-a="sh-sat" data-v="' + v + '" aria-label="Sytość ' + SAT[v] + '">' + v + '</button>').join('') + '</div><div class="scale-lbl"><span>wciąż głodna</span><span>przejedzona</span></div></section>';
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
    if (isNum(sh.hunger)) meal.hunger = sh.hunger; if (isNum(sh.sat)) meal.sat = sh.sat;
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
    $('#view').innerHTML = views[S.tab](); const fab = $('#fab'); if (fab) fab.hidden = !(S.tab === 'today' || S.tab === 'meals'); document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === S.tab || (S.tab === 'report' && b.dataset.t === 'profile')));
    window.scrollTo(0, top ? 0 : y); S.seen = true;
  }
  const clean = (d, date) => { if (d && !A.checkedIn(d) && !(d.meals || []).length && !d.note && !d.sleepHours && !d.water && !Object.keys(d.symptoms || {}).length && !d.flow && d.exercise == null && d.caffeine == null && d.alcohol == null && !(d.stressors || []).length && !d.noSymptoms && !d.supp && d.steps == null && d.walkMin == null && !(d.obs || []).length) delete db.days[date]; };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el) return; const a = el.dataset.a, k = el.dataset.k, v = el.dataset.v, sh = S.sheet;
    switch (a) {
      case 'nav': S.tab = el.dataset.t; render(true); break;
      case 'sec': S.open[el.dataset.id] = !S.open[el.dataset.id]; render(); break;
      case 'sec-go': { const id = el.dataset.id; if (id !== 'meals') S.open[id] = true; if (S.tab !== 'today') S.tab = 'today'; render(); const t = document.getElementById('sec-' + id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
      case 'itab': S.itab = v; render(true); break;
      case 'explore': S.cmp = { x: el.dataset.x, y: el.dataset.y, lag: Number(el.dataset.lag) }; if (WI_X[el.dataset.x]) { S.wi = { x: el.dataset.x, y: WI_Y.includes(el.dataset.y) ? el.dataset.y : 'wbCore', lag: Number(el.dataset.lag), v: null }; } S.itab = 'lab'; render(true); break;
      case 'xday': S.xd = el.dataset.d; render(); break;
      case 'xopen': S.date = el.dataset.d; S.tab = 'today'; render(true); break;
      case 'exp-start': { const p = S.expProp; if (!p) break; db.settings.experiment = { x: p.x, y: p.y, lag: p.lag, dir: p.dir, target: p.target, start: TODAY(), days: 7, title: p.text.split(' W Twoich danych')[0] }; save(); render(); toast('Wyzwanie rozpoczęte. Powodzenia!'); break; }
      case 'exp-cancel': if (confirm('Przerwać wyzwanie?')) { db.settings.experiment = null; save(); render(); } break;
      case 'exp-end': { const ex = db.settings.experiment, ev = ex && I.evalExperiment(db, ex, TODAY()); if (ev) { db.settings.expHistory = (db.settings.expHistory || []).concat([{ title: ex.title, verdict: ev.verdict, date: TODAY() }]).slice(-12); db.settings.experiment = null; save(); render(); } break; }
      case 'rem': { db.settings.rem = Object.assign({}, db.settings.rem); db.settings.rem[k] = !db.settings.rem[k]; save(); render(); break; }
      case 'ics': downloadIcs(); break;
      case 'pet-kind': { db.settings.pet = Object.assign({ on: true, caught: 0 }, db.settings.pet); db.settings.pet.kind = v; save(); render(); if (window.__pyszczekPet) window.__pyszczekPet.spawn(); break; }
      case 'pet-tog': { db.settings.pet = Object.assign({ caught: 0 }, db.settings.pet); db.settings.pet.on = !db.settings.pet.on; save(); render(); break; }
      case 'date': { S.ob = null; const t = TODAY(); S.date = el.dataset.d === 'today' ? t : A.addDays(S.date, Number(el.dataset.d)); if (S.date > A.addDays(t, 14)) S.date = A.addDays(t, 14); render(); break; }
      case 'onboard': db.settings.onboarded = true; save(); render(); break;
      case 'set': { const d = day(S.date, true), n = Number(v); if (k === 'flow' && n === 0) delete d.flow; else if (d[k] === n) delete d[k]; else d[k] = n; clean(d, S.date); save(); render(); break; }
      case 'step': { const d = day(S.date, true); let cur = d[k]; const dl = Number(el.dataset.d); cur = cur == null ? Number(el.dataset.start) : cur + dl; cur = Math.max(Number(el.dataset.min), Math.min(Number(el.dataset.max), cur)); d[k] = Math.round(cur * 2) / 2; if (k === 'steps') d[k] = Math.round(cur); save(); render(); break; }
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
      case 'ob-tag': S.ob.tag = S.ob.tag === v ? null : v; render(); break;
      case 'ob-sev': S.ob.sev = Number(v); render(); break;
      case 'ob-add': { const o = S.ob; if (!o || !/^\d{1,2}:\d{2}$/.test(o.t || '')) { toast('Ustaw godzinę'); break; } if (!o.tag && !(o.text || '').trim()) { toast('Wpisz objaw albo wybierz z listy'); break; } const d = day(S.date, true); d.obs = d.obs || []; d.obs.push({ id: 'o' + Date.now().toString(36), t: o.t.padStart(5, '0'), tag: o.tag || (o.text || '').trim().toLowerCase().slice(0, 40), sev: o.sev || 2, text: (o.text || '').trim() }); S.ob = null; S.open.symptoms = true; save(); render(); toast('Dodano wpis'); break; }
      case 'ob-del': { const d = db.days[S.date]; if (d) { d.obs = (d.obs || []).filter((x) => x.id !== el.dataset.id); clean(d, S.date); save(); render(); } break; }
      case 'cf-del': { const cf = db.settings.customFoods || []; cf.splice(Number(el.dataset.i), 1); Fd.setCustom(cf); save(); render(); break; }
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
      case 'sh-man': { const i = Number(el.dataset.i); sh.manual = { name: i >= 0 ? sh.unmatched[i].text : sh.q || '', grams: 100, kcal: '', p: '', c: '', f: '', u: i, rem: true }; renderSheet(); break; }
      case 'sh-man-x': sh.manual = null; renderSheet(); break;
      case 'sh-man-save': { const m = sh.manual, g = Number(m.grams) || 100; if (!m.name.trim()) { toast('Podaj nazwę'); break; } const k100 = 100 / g; const per100 = { kcal: (Number(m.kcal) || 0) * k100, p: (Number(m.p) || 0) * k100, c: (Number(m.c) || 0) * k100, f: (Number(m.f) || 0) * k100, fib: 0, sug: 0, fe: 0, ca: 0 }; sh.items.push({ fid: null, name: m.name.trim(), grams: g, per100, tags: Fd.guessTags(m.name), src: 'manual' });
        if (m.rem) { const cf = db.settings.customFoods = (db.settings.customFoods || []).filter((x) => x.name.toLowerCase() !== m.name.trim().toLowerCase()); cf.push({ name: m.name.trim(), per100, tags: Fd.guessTags(m.name), defG: g }); Fd.setCustom(cf); save(); toast('Zapamiętano: ' + m.name.trim()); } if (m.u >= 0) sh.unmatched.splice(m.u, 1); sh.manual = null; renderSheet(); break; }
      case 'sh-hun': sh.hunger = sh.hunger === Number(v) ? null : Number(v); renderSheet(); break;
      case 'sh-sat': sh.sat = sh.sat === Number(v) ? null : Number(v); renderSheet(); break;
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
    else if (i === 'man-rem') { S.sheet.manual.rem = el.checked; }
    else if (i === 'ob-t') { S.ob = S.ob || { tag: null, sev: 2, text: '' }; S.ob.t = el.value; }
    else if (i === 'ob-text') { S.ob = S.ob || { tag: null, sev: 2, t: '09:00' }; S.ob.text = el.value; }
    else if (i === 'wi-v') { S.wi.v = Number(el.value); const w = wiGet(); if (w.ok) { const o = wiOut(w); $('#wi-chart').innerHTML = o.chart; $('#wi-text').innerHTML = o.text; } }
    else if (i === 'rem-t') { db.settings.rem = Object.assign({}, db.settings.rem); db.settings.rem[el.dataset.k] = el.value; save(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target, i = el.dataset && el.dataset.i; if (!i) return;
    if (i === 'wi-x') { S.wi.x = el.value; S.wi.v = null; render(); } else if (i === 'wi-y') { S.wi.y = el.value; render(); } else if (i === 'wi-l') { S.wi.lag = Number(el.value); render(); }
    else if (i === 'cmp-x') { S.cmp.x = el.value; render(); } else if (i === 'cmp-y') { S.cmp.y = el.value; render(); } else if (i === 'cmp-lag') { S.cmp.lag = Number(el.value); render(); }
    else if (i === 'prof' && el.tagName === 'SELECT') { db.settings[el.dataset.k] = el.value; save(); render(); }
    else if (i === 'prof') render();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.i === 'supp-new') { e.preventDefault(); const t = (S.newSupp || '').trim(); if (t && !db.settings.supplements.includes(t)) { db.settings.supplements.push(t); S.newSupp = ''; save(); render(); } } });

  /* start: jeśli dzień zmienił się, gdy karta była w tle */
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.tab === 'today' && S.date !== TODAY() && !S.touched) { /* zostaw wybraną datę */ } });
  window.__pyszczek = { db: () => db, S, render, save };
  render(true);
})();
