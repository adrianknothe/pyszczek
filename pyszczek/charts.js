/* Pyszczek: lekkie wykresy SVG (bez bibliotek, działają offline). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./analysis.js'));
  else root.Charts = factory(root.Analysis);
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lab = (iso) => { const p = iso.split('-'); return parseInt(p[2], 10) + '.' + p[1]; };
  const num = (v) => typeof v === 'number' && !isNaN(v);

  function smooth(data, k) {
    if (!k || k < 2) return data; const half = Math.floor(k / 2);
    return data.map((pt, i) => {
      if (!num(pt[1])) return pt; const vals = []; for (let j = i - half; j <= i + half; j++) if (data[j] && num(data[j][1])) vals.push(data[j][1]);
      return [pt[0], vals.reduce((s, x) => s + x, 0) / vals.length];
    });
  }

  function line(o) {
    const w = 340, h = o.h || 170, L = 26, R = 10, T = 10, B = 24, lo = o.min, hi = o.max;
    const N = Math.max(2, A.diffDays(o.to, o.from) + 1), X = (i) => L + i * (w - L - R) / (N - 1), Y = (v) => T + (hi - v) * (h - T - B) / (hi - lo);
    let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + esc(o.label || 'Wykres') + '">';
    (o.ticks || [lo, (lo + hi) / 2, hi]).forEach((t) => { s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end" class="ct">' + t + '</text>'; });
    if (o.band) s += '<rect x="' + L + '" y="' + Y(o.band[1]) + '" width="' + (w - L - R) + '" height="' + (Y(o.band[0]) - Y(o.band[1])) + '" fill="var(--teal-50)" opacity=".8"/>';
    const xl = N > 6 ? [0, Math.floor((N - 1) / 2), N - 1] : [0, N - 1];
    xl.forEach((i) => { s += '<text x="' + X(i) + '" y="' + (h - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle') + '" class="ct">' + lab(A.addDays(o.from, i)) + '</text>'; });
    o.series.forEach((se) => {
      const data = smooth(se.data, o.smooth).map((p) => [A.diffDays(p[0], o.from), p[1]]).filter((p) => num(p[1]) && p[0] >= 0);
      const segs = []; let cur = [];
      data.forEach((p, i) => { if (cur.length && p[0] - cur[cur.length - 1][0] > 3) { segs.push(cur); cur = []; } cur.push(p); });
      if (cur.length) segs.push(cur);
      segs.forEach((sg) => {
        if (sg.length === 1) { s += '<circle cx="' + X(sg[0][0]) + '" cy="' + Y(sg[0][1]) + '" r="3" fill="' + se.color + '"/>'; return; }
        s += '<polyline fill="none" stroke="' + se.color + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"' + (se.dash ? ' stroke-dasharray="' + se.dash + '"' : '') + ' points="' + sg.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ') + '"/>';
      });
      const last = data[data.length - 1]; if (last) s += '<circle cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="4" fill="' + se.color + '" stroke="#fff" stroke-width="2"/>';
    });
    return s + '</svg>';
  }

  function bars(o) {
    const w = 340, h = o.h || 150, L = 26, R = 10, T = 10, B = 24, lo = 0, hi = o.max || 10; const N = Math.max(2, A.diffDays(o.to, o.from) + 1);
    const slot = (w - L - R) / N, bw = Math.max(2, Math.min(14, slot * 0.7)), Y = (v) => T + (hi - v) * (h - T - B) / (hi - lo);
    let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + esc(o.label || 'Wykres') + '">';
    [0, 4, 8].forEach((t) => { s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end" class="ct">' + t + '</text>'; });
    if (o.band) s += '<rect x="' + L + '" y="' + Y(o.band[1]) + '" width="' + (w - L - R) + '" height="' + (Y(o.band[0]) - Y(o.band[1])) + '" fill="var(--teal-50)"/>';
    o.data.forEach((p) => {
      const i = A.diffDays(p[0], o.from); if (i < 0 || !num(p[1])) return; const v = p[1], x = L + i * slot + (slot - bw) / 2;
      const col = o.color ? o.color(v) : 'var(--teal)'; s += '<rect x="' + x.toFixed(1) + '" y="' + Y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Y(0) - Y(v)).toFixed(1) + '" rx="' + Math.min(4, bw / 2) + '" fill="' + col + '"/>';
    });
    [0, N - 1].forEach((i) => { s += '<text x="' + (L + i * slot + (i ? slot : 0)) + '" y="' + (h - 6) + '" text-anchor="' + (i ? 'end' : 'start') + '" class="ct">' + lab(A.addDays(o.from, i)) + '</text>'; });
    return s + '</svg>';
  }

  function scatter(o) {
    const w = 340, h = 210, L = 38, R = 12, T = 12, B = 36; const pts = o.points; if (!pts.length) return '';
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); let x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (x0 === x1) { x0 -= 1; x1 += 1; } if (y0 === y1) { y0 -= 1; y1 += 1; }
    const px = (x1 - x0) * 0.06, py = (y1 - y0) * 0.08; x0 -= px; x1 += px; y0 -= py; y1 += py;
    const X = (v) => L + (v - x0) / (x1 - x0) * (w - L - R), Y = (v) => T + (y1 - v) / (y1 - y0) * (h - T - B);
    const nice = (v, d) => Number(v).toFixed(d || 0).replace('.', ',');
    let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + esc(o.label || 'Wykres punktowy') + '">';
    [0, 0.5, 1].forEach((f) => { const yv = y0 + (y1 - y0) * f, xv = x0 + (x1 - x0) * f; s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(yv) + '" y2="' + Y(yv) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (Y(yv) + 4) + '" text-anchor="end" class="ct">' + nice(yv, o.ydec) + '</text><text x="' + X(xv) + '" y="' + (h - 18) + '" text-anchor="middle" class="ct">' + nice(xv, o.xdec) + '</text>'; });
    pts.forEach((p, i) => { const jx = ((i * 37) % 11 - 5) * 0.35, jy = ((i * 53) % 11 - 5) * 0.35; s += '<circle cx="' + (X(p[0]) + jx).toFixed(1) + '" cy="' + (Y(p[1]) + jy).toFixed(1) + '" r="4.2" fill="var(--teal)" opacity=".55"/>'; });
    const n = pts.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0;
    pts.forEach((p) => { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); });
    if (sxx > 0) { const b = sxy / sxx, a = my - b * mx; s += '<line x1="' + X(x0) + '" y1="' + Y(a + b * x0) + '" x2="' + X(x1) + '" y2="' + Y(a + b * x1) + '" stroke="var(--pink)" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round"/>'; }
    s += '<text x="' + (L + (w - L - R) / 2) + '" y="' + (h - 2) + '" text-anchor="middle" class="ct ca">' + esc(o.xl || '') + '</text>';
    s += '<text transform="translate(10 ' + (T + (h - T - B) / 2) + ') rotate(-90)" text-anchor="middle" class="ct ca">' + esc(o.yl || '') + '</text>';
    return s + '</svg>';
  }

  function spark(values, color) {
    const v = values.filter(num); if (v.length < 2) return ''; const w = 70, h = 24, lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), r = hi - lo || 1;
    const pts = v.map((x, i) => (i * (w - 4) / (v.length - 1) + 2).toFixed(1) + ',' + (h - 3 - (x - lo) / r * (h - 6)).toFixed(1)).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* kolor mapy cieplnej: 0..100, różowy -> neutralny -> turkusowy */
  function heat(v) {
    if (!num(v)) return null; const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
    const pink = [250, 164, 198], mid = [238, 244, 243], teal = [32, 185, 168];
    const c = v < 50 ? mix(pink, mid, Math.min(1, v / 50)) : mix(mid, teal, Math.min(1, (v - 50) / 40));
    return 'rgb(' + c.join(',') + ')';
  }

  /* buźka: łuk uśmiechu zależy od wskaźnika 0..100 */
  function face(score, size) {
    const s = size || 112, has = num(score), sc = has ? score : 50, k = (sc - 50) / 50, cy = 71 + k * 15, R = 52, C = 2 * Math.PI * R, off = has ? C * (1 - sc / 100) : C;
    const id = 'g' + Math.round(Math.random() * 1e6);
    return '<svg viewBox="0 0 120 120" width="' + s + '" height="' + s + '" role="img" aria-label="Wskaźnik dnia ' + (has ? sc : 'brak danych') + '">'
      + '<defs><linearGradient id="' + id + '" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#F0508C"/></linearGradient></defs>'
      + '<circle cx="60" cy="60" r="' + R + '" fill="#fff" stroke="#E2EEEC" stroke-width="9"/>'
      + '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="url(#' + id + ')" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)" class="ring"/>'
      + '<circle cx="46" cy="52" r="4.2" fill="#11302E"/><circle cx="74" cy="52" r="4.2" fill="#11302E"/>'
      + '<circle cx="37" cy="66" r="6" fill="#F0508C" opacity=".28"/><circle cx="83" cy="66" r="6" fill="#F0508C" opacity=".28"/>'
      + '<path d="M44 71 Q60 ' + cy.toFixed(1) + ' 76 71" fill="none" stroke="#11302E" stroke-width="3.6" stroke-linecap="round"/></svg>';
  }

  return { line, bars, scatter, spark, heat, face, esc, lab };
});
