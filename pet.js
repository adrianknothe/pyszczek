/* Pyszczek: zwierzak, który czasem wygląda zza krawędzi ekranu podczas przewijania. Złapanie = sekunda buziaka w nosek. */
(function () {
  const app = window.__pyszczek; if (!app) return;
  const cfg = () => { const s = app.db().settings; if (!s.pet) s.pet = { on: true, caught: 0 }; return s.pet; };
  const chosen = () => cfg().kind || 'kot';
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  /* oryginalne, słodkie zwierzaki: kot, królik, miś, piesek. closed = zamknięte oczy (szczęśliwy) */
  const KINDS = [['kot', 'Kotek'], ['krolik', 'Króliczek'], ['mis', 'Miś'], ['pies', 'Piesek']];
  const EARS = {
    kot: '<path d="M16 58Q12 22 24 15Q31 12 37 19L53 37Z" fill="#F29AB9"/><path d="M104 58Q108 22 96 15Q89 12 83 19L67 37Z" fill="#F29AB9"/><path d="M25 50Q23 28 27 23Q30 21 33 26L43 37Z" fill="#FFD3E3"/><path d="M95 50Q97 28 93 23Q90 21 87 26L77 37Z" fill="#FFD3E3"/>',
    krolik: '<ellipse cx="40" cy="24" rx="12" ry="28" fill="#F29AB9" transform="rotate(-9 40 24)"/><ellipse cx="80" cy="24" rx="12" ry="28" fill="#F29AB9" transform="rotate(9 80 24)"/><ellipse cx="40" cy="26" rx="6" ry="20" fill="#FFD3E3" transform="rotate(-9 40 26)"/><ellipse cx="80" cy="26" rx="6" ry="20" fill="#FFD3E3" transform="rotate(9 80 26)"/>',
    mis: '<circle cx="25" cy="38" r="17" fill="#F29AB9"/><circle cx="95" cy="38" r="17" fill="#F29AB9"/><circle cx="25" cy="39" r="9" fill="#FFD3E3"/><circle cx="95" cy="39" r="9" fill="#FFD3E3"/>',
    pies: '<ellipse cx="17" cy="62" rx="13" ry="27" fill="#E7B49A" transform="rotate(14 17 62)"/><ellipse cx="103" cy="62" rx="13" ry="27" fill="#E7B49A" transform="rotate(-14 103 62)"/>'
  };
  const face = (closed, kind) => {
    kind = EARS[kind] ? kind : 'kot';
    return '<svg viewBox="0 0 120 120" aria-hidden="true">' + EARS[kind]
      + '<ellipse cx="60" cy="69" rx="47" ry="40" fill="' + (kind === 'pies' ? '#FFF1E6' : '#FFE9F1') + '"/><ellipse cx="60" cy="83" rx="23" ry="15" fill="#fff"/>'
      + '<ellipse cx="29" cy="80" rx="9.5" ry="7.5" fill="#F8A9C5" opacity=".8"/><ellipse cx="91" cy="80" rx="9.5" ry="7.5" fill="#F8A9C5" opacity=".8"/>'
      + (kind === 'pies' ? '<ellipse cx="38" cy="55" rx="13" ry="12" fill="#E7B49A" opacity=".55"/>' : '')
      + (closed ? '<path d="M34 66q8-10 16 0M70 66q8-10 16 0" fill="none" stroke="#2B1824" stroke-width="3.6" stroke-linecap="round"/>'
        : '<ellipse cx="42" cy="64" rx="7" ry="8" fill="#2B1824"/><ellipse cx="78" cy="64" rx="7" ry="8" fill="#2B1824"/><circle cx="44.6" cy="60.8" r="2.9" fill="#fff"/><circle cx="80.6" cy="60.8" r="2.9" fill="#fff"/><circle cx="39.8" cy="67.6" r="1.3" fill="#fff"/><circle cx="75.8" cy="67.6" r="1.3" fill="#fff"/>')
      + (kind === 'kot' ? '<path d="M30 82L45 84M30 90L45 88M90 82L75 84M90 90L75 88" stroke="#D7B0C0" stroke-width="1.6" stroke-linecap="round" fill="none"/>' : '')
      + '<path class="nose" d="M54 74Q60 71 66 74Q64 81 60 82Q56 81 54 74Z" fill="' + (kind === 'pies' ? '#3A2530' : '#DB3F78') + '"/>'
      + '<path d="M60 82v3.5M53 88q3.5 3.5 7 0q3.5 3.5 7 0" fill="none" stroke="#2B1824" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>'
      + (kind === 'krolik' ? '<rect x="56" y="89" width="8" height="7" rx="2.4" fill="#fff" stroke="#E8C9D6" stroke-width="1.2"/>' : '')
      + (kind === 'pies' ? '<path d="M56 90q4 9 4 9q0 0 4-9" fill="#F27FA8" opacity=".9"/>' : '')
      + '</svg>';
  };
  const lips = '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="M2 12C8 0 16 2 20 8c4-6 12-8 18 4-6 12-30 12-36 0z" fill="#E0457B"/><path d="M6 11c5-5 10-3 14 0 4-3 9-5 14 0-6 3-22 3-28 0z" fill="#F27FA8"/><path d="M8 9c3-2 6-2 9 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>';

  let el = null, lastShown = Date.now() - 30000, acc = 0, lastY = window.scrollY, busy = false;
  const canShow = () => cfg().on && !el && !busy && document.getElementById('sheet').hidden && document.visibilityState === 'visible';

  function spawn() {
    const side = Math.random() < 0.5 ? 'l' : 'r', top = 18 + Math.random() * 42; /* % wysokości widocznego ekranu, z dala od dolnej nawigacji */
    el = document.createElement('button'); el.type = 'button'; el.className = 'pet pet-' + side; el.style.top = top + 'vh'; el.setAttribute('aria-label', 'Złap Pyszczka');
    el.innerHTML = face(false, chosen()); document.body.appendChild(el); lastShown = Date.now();
    requestAnimationFrame(() => el && el.classList.add('in'));
    el.addEventListener('click', catchIt);
  }
  function hearts(box) {
    for (let i = 0; i < 7; i++) { const h = document.createElement('i'); h.className = 'kheart'; h.style.setProperty('--x', (Math.random() * 150 - 75).toFixed(0) + 'px'); h.style.setProperty('--d', (i * 55) + 'ms'); h.style.setProperty('--s', (0.7 + Math.random() * 0.8).toFixed(2)); box.appendChild(h); }
  }
  function catchIt() {
    if (!el) return; const old = el; el = null; busy = true; old.remove();
    const c = cfg(); c.caught = (c.caught || 0) + 1; if (app.save) app.save(); if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) { /* brak wibracji */ } }
    const box = document.createElement('div'); box.className = 'kiss' + (reduce() ? ' still' : ''); box.setAttribute('role', 'status');
    box.innerHTML = '<div class="kiss-in"><div class="kiss-pet">' + face(true, chosen()) + '</div><div class="kiss-lips">' + lips + '</div></div><div class="kiss-txt">Buziak w nosek!</div>';
    document.body.appendChild(box); hearts(box.querySelector('.kiss-in'));
    setTimeout(() => box.classList.add('out'), 850); setTimeout(() => { box.remove(); busy = false; if (app.S.tab === 'profile') app.render(); }, 1150);
  }
  /* pojawianie: po przewinięciu ok. 700 px, nie częściej niż co 25 s i z losową szansą */
  window.addEventListener('scroll', () => {
    const y = window.scrollY; acc += Math.abs(y - lastY); lastY = y;
    if (acc < 700) return; acc = 0;
    if (!canShow() || Date.now() - lastShown < 25000 || Math.random() > 0.45) return; spawn();
  }, { passive: true });
  window.__pyszczekPet = { KINDS, face, spawn: () => { if (!el) spawn(); }, catchIt };
})();
