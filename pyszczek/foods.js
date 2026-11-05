/* Pyszczek: baza produktów i parser posiłków (PL). Wartości na 100 g, orientacyjne (tabele USDA/IŻŻ). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Food = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = (s) => String(s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s\/.,]/g, ' ').replace(/\s+/g, ' ').trim();

  const SUF = ['ami', 'ach', 'ego', 'emu', 'ymi', 'ych', 'ich', 'owi', 'iem', 'om', 'ow', 'em', 'ie', 'ym', 'im', 'ej', 'a', 'e', 'i', 'o', 'u', 'y'];
  function stem1(w) {
    if (w.length <= 3) return w;
    for (const s of SUF) if (w.length - s.length >= 3 && w.endsWith(s)) return w.slice(0, -s.length);
    return w;
  }
  const stem = (w) => stem1(stem1(w));
  const STOP = new Set(['z', 'ze', 'i', 'w', 'we', 'na', 'po', 'do', 'od', 'oraz', 'plus', 'ok', 'ca', 'a', 'o', 'u', 'tak', 'jak', 'sie', 'dodatkiem', 'dodatek', 'troche', 'mala', 'duza', 'maly', 'duzy', 'sredni', 'srednia']);
  const tokenize = (s) => norm(s).split(' ').filter(Boolean);
  const stemsOf = (s) => tokenize(s).filter((t) => !STOP.has(t)).map(stem);
  const IGNORE = new Set(['smoothie', 'koktajl', 'shake', 'sniadanie', 'obiad', 'kolacja', 'przekaska', 'lunch', 'deser'].map(stem));

  /* ---------- BAZA ---------- */
  const FOODS = [];
  function F(name, aliases, kcal, p, c, f, fib, sug, fe, ca, tags, defG, units, extra) {
    const t = tags ? tags.split(',') : [];
    if (fib >= 6) t.push('wysokobłonnikowe');
    FOODS.push(Object.assign({
      id: 'f' + FOODS.length, name, aliases: [name].concat(aliases ? aliases.split('|') : []),
      per100: { kcal, p, c, f, fib, sug, fe, ca }, tags: t, defG: defG || 100, units: units || {}
    }, extra || {}));
  }
  // zboża i pieczywo
  F('płatki owsiane', 'platki owsiane|platki|platkow owsianych', 372, 13.5, 60, 7, 10, 1, 4.3, 50, '', 50, { tbsp: 8, cup: 90 });
  F('chleb pszenny', 'chleb|pieczywo|chleb jasny|tost|tosty|kromka|kromki', 265, 9, 49, 3.2, 2.7, 5, 3.6, 144, 'gluten', 70, { slice: 35, piece: 35 });
  F('chleb żytni razowy', 'chleb zytni|chleb razowy|zytni|razowy|chleb ciemny', 259, 8.5, 48, 3.3, 5.8, 3.9, 2.8, 73, 'gluten', 70, { slice: 35, piece: 35 });
  F('chleb pełnoziarnisty', 'pelnoziarnisty|chleb pelnoziarnisty|graham|chleb graham', 247, 13, 41, 3.4, 7, 6, 2.5, 107, 'gluten', 70, { slice: 35, piece: 35 });
  F('bułka', 'bulka|bulki|bulke|bagietka|bagietki|rogal', 280, 9, 55, 2, 2.5, 5, 2.5, 100, 'gluten', 60, { piece: 50 });
  F('wafle ryżowe', 'wafle ryzowe|wafel ryzowy|wafle|chrupki ryzowe', 387, 8, 81, 2.8, 4, 0.2, 1.2, 10, '', 18, { piece: 9 });
  F('makaron (ugotowany)', 'makaron|makaronu|spaghetti|penne|makaron gotowany', 158, 5.8, 31, 0.9, 1.8, 0.6, 1.3, 7, 'gluten', 180);
  F('ryż biały (ugotowany)', 'ryz|ryz bialy|ryzu|ryz gotowany', 130, 2.7, 28, 0.3, 0.4, 0.1, 0.2, 10, '', 150, { cup: 160 });
  F('ryż brązowy (ugotowany)', 'ryz brazowy|ryz pelnoziarnisty', 123, 2.7, 26, 1, 1.8, 0.2, 0.6, 10, '', 150, { cup: 160 });
  F('kasza gryczana (ugotowana)', 'kasza gryczana|gryczana|kasza|kaszy|kaszka', 92, 3.4, 20, 0.6, 2.7, 0.9, 0.8, 7, '', 130);
  F('kasza jaglana (ugotowana)', 'kasza jaglana|jaglana|jaglanka|kasza jagla', 119, 3.5, 23.7, 1, 1.3, 0.1, 0.6, 3, '', 130);
  F('kasza jęczmienna (ugotowana)', 'kasza jeczmienna|peczak|kasza peczak', 123, 2.3, 28, 0.4, 3.8, 0.3, 1.3, 11, 'gluten', 130);
  F('kuskus (ugotowany)', 'kuskus|couscous', 112, 3.8, 23, 0.2, 1.4, 0.1, 0.4, 8, 'gluten', 150);
  F('quinoa (ugotowana)', 'quinoa|komosa ryzowa|komosa', 120, 4.4, 21, 1.9, 2.8, 0.9, 1.5, 17, '', 150);
  F('musli', 'musli', 363, 10, 66, 6, 8, 20, 4, 70, 'gluten', 50, { tbsp: 10 });
  F('granola', 'granola', 450, 10, 64, 17, 7, 24, 3, 50, 'gluten', 50, { tbsp: 10 });
  F('płatki kukurydziane', 'platki kukurydziane|corn flakes|cornflakes', 378, 7, 84, 0.9, 3, 8, 8, 5, '', 40);
  F('tortilla pszenna', 'tortilla|wrap|placek tortilla', 310, 8, 51, 8, 3, 2, 3, 100, 'gluten', 60, { piece: 60 });
  F('ziemniaki (gotowane)', 'ziemniaki|ziemniak|ziemniaczki|puree|pure', 86, 1.7, 20, 0.1, 1.8, 0.9, 0.3, 8, '', 200, { piece: 100 });
  F('frytki', 'frytki|frytek', 312, 3.4, 41, 15, 3.8, 0.3, 0.8, 10, 'smażone', 150);
  F('batat', 'batat|bataty|batata|slodkie ziemniaki', 90, 2, 21, 0.1, 3.3, 6.5, 0.7, 38, '', 200, { piece: 150 });
  // białko
  F('jajko', 'jajko|jajka|jaj|jajek|jajo|jajeczko', 143, 12.6, 0.7, 9.5, 0, 0.4, 1.8, 56, 'jajka', 55, { piece: 55 });
  F('pierś z kurczaka (pieczona)', 'piers kurczaka|piers|kurczak|kurczaka|filet kurczaka|kurczaki', 165, 31, 0, 3.6, 0, 0, 1, 15, '', 150);
  F('udko z kurczaka', 'udko|udka|udko kurczaka|skrzydelka', 209, 26, 0, 11, 0, 0, 1, 12, '', 150);
  F('pierś z indyka', 'indyk|indyka|piers indyka|indyczy', 135, 30, 0, 1, 0, 0, 0.7, 10, '', 150);
  F('wołowina', 'wolowina|wolowiny|stek|mielone|mielona|mieso mielone', 250, 26, 0, 15, 0, 0, 2.6, 18, 'czerwone mięso', 150);
  F('wieprzowina (schab)', 'wieprzowina|schab|schabu|karkowka|wieprzowiny', 200, 27, 0, 9, 0, 0, 0.9, 10, 'czerwone mięso', 150);
  F('szynka', 'szynka|szynki|szynce|szynke|szynka drobiowa', 110, 17, 1, 4, 0, 0.5, 0.8, 10, 'przetworzone', 30, { slice: 15 }, { addG: 30 });
  F('kiełbasa', 'kielbasa|kielbasy|parowki|parowka|kabanos|virsli', 300, 13, 2, 27, 0, 1, 1.2, 15, 'przetworzone,czerwone mięso', 100, { piece: 80 });
  F('bekon', 'bekon|boczek|bekonu', 540, 37, 1.4, 42, 0, 0, 1, 10, 'przetworzone,smażone', 30, { slice: 12 });
  F('łosoś (pieczony)', 'losos|lososia|lososiem|ryba losos', 206, 22, 0, 13, 0, 0, 0.3, 15, 'ryby', 150);
  F('dorsz (pieczony)', 'dorsz|dorsza|ryba|ryby|miruna|morszczuk|ryba biala', 105, 23, 0, 0.9, 0, 0, 0.4, 15, 'ryby', 150);
  F('tuńczyk z puszki (w wodzie)', 'tunczyk|tunczyka|tunczykiem', 116, 26, 0, 1, 0, 0, 1.4, 10, 'ryby', 100, { can: 120 });
  F('krewetki', 'krewetki|krewetek', 99, 24, 0.2, 0.3, 0, 0, 0.5, 70, 'ryby', 100);
  F('tofu', 'tofu', 76, 8, 1.9, 4.8, 0.3, 0.6, 5.4, 350, 'soja', 120);
  F('hummus', 'hummus|humus', 166, 8, 14, 10, 6, 0.3, 2.4, 38, 'strączkowe', 50, { tbsp: 15 }, { addG: 40 });
  F('soczewica (ugotowana)', 'soczewica|soczewicy|soczewice|dal|dhal', 116, 9, 20, 0.4, 7.9, 1.8, 3.3, 19, 'strączkowe', 150);
  F('ciecierzyca (ugotowana)', 'ciecierzyca|ciecierzycy|ciecierzyce|cieciorka', 164, 8.9, 27, 2.6, 7.6, 4.8, 2.9, 49, 'strączkowe', 120);
  F('fasola (ugotowana)', 'fasola|fasoli|fasole|czerwona fasola|biala fasola', 127, 8.7, 22.8, 0.5, 6.4, 0.3, 2.9, 35, 'strączkowe', 120);
  F('odżywka białkowa', 'odzywka bialkowa|bialko w proszku|whey|odzywka|shake bialkowy|protein', 380, 80, 7, 5, 0, 4, 0.5, 500, 'nabiał,laktoza', 30, { piece: 30, tbsp: 10 });
  // nabiał
  F('mleko 2%', 'mleko|mleka|mlekiem|mleko krowie', 50, 3.4, 4.8, 2, 0, 4.8, 0, 120, 'nabiał,laktoza', 200, { cup: 250 }, { addG: 50 });
  F('mleko pełne', 'mleko pelne|mleko tluste', 61, 3.2, 4.8, 3.3, 0, 5, 0, 113, 'nabiał,laktoza', 200, { cup: 250 }, { addG: 50 });
  F('napój owsiany', 'mleko owsiane|napoj owsiany|owsiane mleko|mleko roslinne|napoj roslinny', 45, 1, 7, 1.5, 0.8, 3.5, 0.1, 120, '', 200, { cup: 250 }, { addG: 50 });
  F('napój sojowy', 'mleko sojowe|napoj sojowy|sojowe mleko', 40, 3.3, 2.5, 1.8, 0.5, 2, 0.4, 120, 'soja', 200, { cup: 250 }, { addG: 50 });
  F('napój migdałowy', 'mleko migdalowe|napoj migdalowy|migdalowe mleko', 17, 0.6, 0.1, 1.5, 0.2, 0, 0.1, 120, 'orzechy', 200, { cup: 250 }, { addG: 50 });
  F('jogurt naturalny', 'jogurt|jogurtu|jogurtem|jogurty', 61, 3.5, 4.7, 3.3, 0, 4.7, 0.1, 121, 'nabiał,laktoza', 150, { tbsp: 20 }, { addG: 50 });
  F('jogurt grecki', 'jogurt grecki|grecki|greckiego', 97, 9, 3.9, 5, 0, 3.6, 0, 100, 'nabiał,laktoza', 150, { tbsp: 25 }, { addG: 50 });
  F('skyr', 'skyr', 63, 11, 4, 0.2, 0, 4, 0.1, 120, 'nabiał,laktoza', 150);
  F('kefir', 'kefir|kefiru|maslanka', 51, 3.4, 4.5, 2, 0, 4.5, 0.1, 120, 'nabiał,laktoza', 200, { cup: 250 });
  F('twaróg', 'twarog|twarogu|twarozek|serek wiejski|ser bialy', 133, 18, 3.5, 5, 0, 3.5, 0.2, 95, 'nabiał,laktoza', 100, { tbsp: 20 }, { addG: 50 });
  F('ser żółty', 'ser zolty|ser|sera|serem|cheddar|gouda|edamski|zolty ser', 350, 25, 1, 27, 0, 0.5, 0.3, 750, 'nabiał', 20, { slice: 20 }, { addG: 20 });
  F('mozzarella', 'mozzarella|mozarella', 280, 22, 2.2, 22, 0, 1, 0.4, 505, 'nabiał', 60, { piece: 125 }, { addG: 40 });
  F('feta', 'feta|ser feta|serek feta', 264, 14, 4, 21, 0, 4, 0.7, 493, 'nabiał', 40, {}, { addG: 30 });
  F('parmezan', 'parmezan|parmezanu', 431, 38, 4, 29, 0, 0.9, 0.8, 1184, 'nabiał', 10, { tbsp: 6 }, { addG: 10 });
  F('serek śmietankowy', 'serek smietankowy|serek kremowy|serek', 342, 6, 4, 34, 0, 3, 0.4, 98, 'nabiał,laktoza', 30, { tbsp: 20 }, { addG: 20 });
  F('masło', 'maslo|masla|maslem|masle', 717, 0.9, 0.1, 81, 0, 0.1, 0, 24, 'nabiał,laktoza', 10, { tbsp: 14, tsp: 5 }, { addG: 8 });
  F('śmietana 18%', 'smietana|smietanka|smietany|smietanie', 190, 2.8, 3.6, 18, 0, 3.6, 0.1, 100, 'nabiał,laktoza', 30, { tbsp: 20 }, { addG: 20 });
  F('lody', 'lody|lodow|lod|galka lodow', 207, 3.5, 24, 11, 0.7, 21, 0.1, 128, 'nabiał,cukier,laktoza', 100, { piece: 50 });
  // tłuszcze, orzechy, nasiona
  F('oliwa z oliwek', 'oliwa|oliwy|oliwe|olej|oleju|olej rzepakowy|olejem', 884, 0, 0, 100, 0, 0, 0.6, 1, '', 10, { tbsp: 13, tsp: 4.5 }, { addG: 10 });
  F('masło orzechowe', 'maslo orzechowe|masla orzechowego|maslo arachidowe|pasta orzechowa|pasta arachidowa', 588, 25, 20, 50, 6, 9, 1.9, 49, 'orzechy', 20, { tbsp: 16, tsp: 5.5 }, { addG: 15 });
  F('orzechy włoskie', 'orzechy wloskie|orzechow wloskich|wloskie|orzech wloski', 654, 15, 14, 65, 6.7, 2.6, 2.9, 98, 'orzechy', 30, { handful: 30 }, { addG: 20 });
  F('migdały', 'migdaly|migdalow|migdalami', 579, 21, 22, 50, 12.5, 4.4, 3.7, 269, 'orzechy', 30, { handful: 30 }, { addG: 20 });
  F('orzechy nerkowca', 'nerkowce|orzechy nerkowca|nerkowca|nerkowcow', 553, 18, 30, 44, 3.3, 6, 6.7, 37, 'orzechy', 30, { handful: 30 }, { addG: 20 });
  F('orzechy (mieszanka)', 'orzechy|orzechow|orzechami|orzeszki|bakalie|mieszanka orzechow', 607, 18, 21, 54, 7, 4, 3.5, 100, 'orzechy', 30, { handful: 30 }, { addG: 20 });
  F('nasiona chia', 'chia|nasiona chia|nasion chia', 486, 17, 42, 31, 34, 0, 7.7, 631, '', 15, { tbsp: 12, tsp: 4 }, { addG: 10 });
  F('siemię lniane', 'siemie lniane|siemie|siemienia|lniane', 534, 18, 29, 42, 27, 1.6, 5.7, 255, '', 10, { tbsp: 10, tsp: 3.5 }, { addG: 10 });
  F('pestki dyni', 'pestki dyni|pestek dyni', 559, 30, 11, 49, 6, 1.4, 8.8, 46, '', 20, { tbsp: 9 }, { addG: 15 });
  F('słonecznik (pestki)', 'slonecznik|pestki slonecznika|slonecznika', 584, 21, 20, 51, 8.6, 2.6, 5.2, 78, '', 20, { tbsp: 9 }, { addG: 15 });
  F('tahini', 'tahini|pasta sezamowa', 595, 17, 21, 54, 9.3, 0.5, 8, 426, '', 15, { tbsp: 15 }, { addG: 10 });
  F('awokado', 'awokado|avocado', 160, 2, 8.5, 14.7, 6.7, 0.7, 0.6, 12, '', 100, { piece: 150 }, { addG: 60 });
  // warzywa
  F('pomidor', 'pomidor|pomidory|pomidora|pomidorem|pomidorki|koktajlowe', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 0.3, 10, '', 100, { piece: 120, slice: 15 }, { addG: 40 });
  F('ogórek', 'ogorek|ogorki|ogorka|ogorkiem|swiezy ogorek', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 0.3, 16, '', 100, { piece: 150, slice: 5 }, { addG: 40 });
  F('papryka', 'papryka|papryki|paprykę|papryke|papryka czerwona', 31, 1, 6, 0.3, 2.1, 4.2, 0.4, 7, '', 100, { piece: 150 }, { addG: 40 });
  F('marchew', 'marchew|marchewka|marchewki|marchwi|marchewke', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 0.3, 33, '', 80, { piece: 70 }, { addG: 40 });
  F('brokuł', 'brokul|brokuly|brokula', 34, 2.8, 6.6, 0.4, 2.6, 1.7, 0.7, 47, '', 120);
  F('szpinak', 'szpinak|szpinaku|szpinaki', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 2.7, 99, '', 80, { handful: 30 }, { addG: 30 });
  F('sałata', 'salata|salaty|salate|mix salat|rukola|rukoli|roszponka', 15, 1.4, 2.9, 0.2, 1.3, 0.8, 0.9, 36, '', 60, { handful: 30 }, { addG: 30 });
  F('cebula', 'cebula|cebuli|cebule|cebulka', 40, 1.1, 9.3, 0.1, 1.7, 4.2, 0.2, 23, '', 50, { piece: 80 }, { addG: 20 });
  F('czosnek', 'czosnek|czosnku|zabek czosnku', 149, 6.4, 33, 0.5, 2.1, 1, 1.7, 181, '', 5, { piece: 4 }, { addG: 4 });
  F('kalafior', 'kalafior|kalafiora', 25, 1.9, 5, 0.3, 2, 1.9, 0.4, 22, '', 120);
  F('cukinia', 'cukinia|cukinii|cukinie', 17, 1.2, 3.1, 0.3, 1, 2.5, 0.4, 16, '', 120);
  F('burak', 'burak|buraki|buraka|burakow|buraczki|cwikla', 43, 1.6, 9.6, 0.2, 2.8, 6.8, 0.8, 16, '', 100);
  F('dynia', 'dynia|dyni|dynie', 26, 1, 6.5, 0.1, 0.5, 2.8, 0.8, 21, '', 150);
  F('kapusta', 'kapusta|kapusty|kapuste', 25, 1.3, 5.8, 0.1, 2.5, 3.2, 0.5, 40, '', 100);
  F('pieczarki', 'pieczarki|pieczarek|grzyby|grzybow|grzybki', 22, 3.1, 3.3, 0.3, 1, 2, 0.5, 3, '', 100);
  F('kukurydza', 'kukurydza|kukurydzy|kukurydze', 86, 3.3, 19, 1.4, 2, 6.3, 0.5, 2, '', 100, { can: 140, tbsp: 15 }, { addG: 40 });
  F('jarmuż', 'jarmuz|jarmuzu', 49, 4.3, 8.8, 0.9, 3.6, 2.3, 1.5, 150, '', 60, { handful: 30 }, { addG: 30 });
  F('groszek zielony', 'groszek|groszku', 81, 5.4, 14, 0.4, 5.1, 5.7, 1.5, 25, '', 80, {}, { addG: 40 });
  F('bakłażan', 'baklazan|baklazana|baklazany', 25, 1, 6, 0.2, 3, 3.5, 0.2, 9, '', 150);
  F('ogórki kiszone', 'ogorki kiszone|ogorek kiszony|kiszony ogorek|kiszone ogorki|kiszonki', 11, 0.3, 2.3, 0.2, 1, 1.1, 0.3, 15, 'kiszonki', 60, { piece: 60 });
  F('kapusta kiszona', 'kapusta kiszona|kiszona kapusta|kiszonej kapusty', 19, 0.9, 4.3, 0.1, 2.9, 1.8, 1.5, 30, 'kiszonki', 80);
  F('oliwki', 'oliwki|oliwek', 115, 0.8, 6, 11, 3.2, 0, 3.3, 88, '', 30, {}, { addG: 20 });
  F('passata pomidorowa', 'passata|sos pomidorowy|przecier pomidorowy', 32, 1.4, 6, 0.3, 1.5, 5, 1, 15, '', 100, {}, { addG: 50 });
  F('ketchup', 'ketchup|ketchupu', 100, 1, 26, 0.1, 0.3, 22, 0.4, 15, 'cukier', 15, { tbsp: 17 }, { addG: 15 });
  F('majonez', 'majonez|majonezu', 680, 1, 0.6, 75, 0, 0.6, 0.2, 5, '', 15, { tbsp: 14 }, { addG: 15 });
  F('sos sojowy', 'sos sojowy|sojowy sos', 53, 8, 5, 0.6, 0.8, 0.4, 2.4, 33, 'soja', 10, { tbsp: 16 }, { addG: 10 });
  // owoce
  F('banan', 'banan|banany|banana|bananem|bananow', 89, 1.1, 23, 0.3, 2.6, 12, 0.3, 5, '', 120, { piece: 120 });
  F('jabłko', 'jablko|jablka|jablek|jablkiem', 52, 0.3, 14, 0.2, 2.4, 10, 0.1, 6, '', 180, { piece: 180 });
  F('gruszka', 'gruszka|gruszki|gruszke|gruszek', 57, 0.4, 15, 0.1, 3.1, 9.8, 0.2, 9, '', 170, { piece: 170 });
  F('pomarańcza', 'pomarancza|pomarancze|pomaranczy|pomarancz', 47, 0.9, 12, 0.1, 2.4, 9.4, 0.1, 40, '', 180, { piece: 180 });
  F('mandarynka', 'mandarynka|mandarynki|mandarynke|klementynka|klementynki', 53, 0.8, 13, 0.3, 1.8, 10.6, 0.2, 37, '', 80, { piece: 80 });
  F('truskawki', 'truskawki|truskawek|truskawka|truskawkami', 32, 0.7, 7.7, 0.3, 2, 4.9, 0.4, 16, '', 150, { handful: 80 }, { addG: 60 });
  F('maliny', 'maliny|malin|malinami', 52, 1.2, 12, 0.7, 6.5, 4.4, 0.7, 25, '', 100, { handful: 60 }, { addG: 50 });
  F('borówki', 'borowki|borowek|jagody|jagod|borowkami', 57, 0.7, 14, 0.3, 2.4, 10, 0.3, 6, '', 100, { handful: 60 }, { addG: 50 });
  F('winogrona', 'winogrona|winogron', 69, 0.7, 18, 0.2, 0.9, 16, 0.4, 10, '', 100, { handful: 80 });
  F('arbuz', 'arbuz|arbuza', 30, 0.6, 7.6, 0.2, 0.4, 6.2, 0.2, 7, '', 200);
  F('kiwi', 'kiwi', 61, 1.1, 15, 0.5, 3, 9, 0.3, 34, '', 80, { piece: 75 });
  F('mango', 'mango', 60, 0.8, 15, 0.4, 1.6, 14, 0.2, 11, '', 150);
  F('ananas', 'ananas|ananasa', 50, 0.5, 13, 0.1, 1.4, 10, 0.3, 13, '', 150);
  F('brzoskwinia', 'brzoskwinia|brzoskwinie|brzoskwinki|nektarynka|nektarynki', 39, 0.9, 10, 0.3, 1.5, 8.4, 0.3, 6, '', 150, { piece: 150 });
  F('daktyle', 'daktyle|daktyl|daktyli', 282, 2.5, 75, 0.4, 8, 63, 1, 39, '', 24, { piece: 8 });
  F('rodzynki', 'rodzynki|rodzynek|rodzynkami', 299, 3.1, 79, 0.5, 3.7, 59, 1.9, 50, '', 20, { tbsp: 12 }, { addG: 15 });
  F('morele suszone', 'morele suszone|suszone morele|morele|morela', 241, 3.4, 63, 0.5, 7.3, 53, 2.7, 55, '', 30, { piece: 8 });
  F('sok pomarańczowy', 'sok pomaranczowy|sok|soku|sok owocowy', 45, 0.7, 10, 0.2, 0.2, 8.4, 0.2, 11, '', 200, { cup: 250 });
  // słodycze i przekąski
  F('czekolada gorzka', 'czekolada gorzka|gorzka czekolada|czekolady gorzkiej|gorzka', 598, 7.8, 46, 43, 11, 24, 11.9, 73, 'cukier', 20, { cube: 5 });
  F('czekolada mleczna', 'czekolada mleczna|czekolada|czekolady|mleczna', 535, 7.7, 59, 30, 3.4, 52, 2.3, 189, 'cukier,nabiał', 20, { cube: 5 });
  F('ciastko', 'ciastko|ciastka|ciasteczko|ciasteczka|herbatnik|herbatniki|ciastek|babeczka|muffin|drozdzowka|ciasto|ciasta|szarlotka|sernik|makowiec|brownie|paczek|pączek|wafelek|wafel', 450, 6, 65, 19, 2, 25, 2, 30, 'gluten,cukier', 50, { piece: 40 });
  F('baton', 'baton|batonik|batony|baton czekoladowy|baton zbozowy', 470, 6, 60, 23, 2, 45, 1.4, 70, 'cukier', 50, { piece: 50 });
  F('chipsy', 'chipsy|chipsow|chrupki|paluszki', 536, 7, 53, 34, 4.4, 0.3, 1.3, 24, 'smażone,przetworzone', 40, { handful: 30 });
  F('popcorn', 'popcorn|popcornu', 387, 13, 78, 4.5, 15, 0.9, 3.2, 7, '', 30, { handful: 15 });
  F('miód', 'miod|miodu|miodem', 304, 0.3, 82, 0, 0.2, 82, 0.4, 6, 'cukier', 10, { tbsp: 21, tsp: 7 }, { addG: 10 });
  F('cukier', 'cukier|cukru|cukrem', 387, 0, 100, 0, 0, 100, 0, 1, 'cukier', 5, { tbsp: 12, tsp: 5 }, { addG: 5 });
  F('dżem', 'dzem|dzemu|dzemem|konfitura|marmolada', 250, 0.4, 63, 0.1, 1, 48, 0.5, 20, 'cukier', 20, { tbsp: 20, tsp: 7 }, { addG: 15 });
  F('krem czekoladowy', 'krem czekoladowy|krem orzechowy|krem czekoladowo orzechowy', 539, 6.3, 57.5, 30.9, 3.4, 56.3, 3, 160, 'cukier,orzechy,nabiał', 20, { tbsp: 19, tsp: 7 }, { addG: 15 });
  F('kakao', 'kakao|kakaa', 228, 20, 58, 14, 33, 1.8, 13.9, 128, '', 10, { tbsp: 8, tsp: 3 }, { addG: 8 });
  // napoje
  F('kawa (czarna)', 'kawa|kawy|kawe|kawa czarna|americano|czarna kawa', 2, 0.3, 0, 0, 0, 0, 0, 2, 'kofeina', 200, { cup: 200, piece: 200 });
  F('espresso', 'espresso|ristretto', 2, 0.1, 0, 0.2, 0, 0, 0.1, 2, 'kofeina', 30, { piece: 30 });
  F('herbata', 'herbata|herbaty|herbate|czarna herbata|zielona herbata|herbatke|matcha', 1, 0, 0.3, 0, 0, 0, 0, 0, 'kofeina', 250, { cup: 250 });
  F('herbata ziołowa', 'ziolowa|herbata ziolowa|melisa|rumianek|mieta|napar|herbata owocowa|rooibos', 1, 0, 0.2, 0, 0, 0, 0, 0, '', 250, { cup: 250 });
  F('woda', 'woda|wody|wode|woda mineralna', 0, 0, 0, 0, 0, 0, 0, 0, '', 250, { cup: 250 });
  F('cola', 'cola|napoj gazowany|gazowany|lemoniada', 42, 0, 10.6, 0, 0, 10.6, 0, 3, 'cukier,kofeina', 330, { piece: 330 });
  F('napój energetyczny', 'energetyk|napoj energetyczny|energy drink', 45, 0, 11, 0, 0, 11, 0, 2, 'cukier,kofeina', 250, { piece: 250 });
  F('piwo', 'piwo|piwa|piwko|piwem', 43, 0.5, 3.6, 0, 0, 0, 0, 4, 'alkohol,gluten', 500, { piece: 500 });
  F('wino', 'wino|wina|winem|prosecco|szampan', 83, 0.1, 2.6, 0, 0, 1, 0.4, 8, 'alkohol', 150, { piece: 150 });
  F('mocny alkohol', 'wodka|whisky|rum|gin|alkohol|drink|shot|likier', 231, 0, 0, 0, 0, 0, 0, 0, 'alkohol', 40, { piece: 40 });
  // dania
  F('pizza', 'pizza|pizzy|pizze', 266, 11, 33, 10, 2.3, 3.6, 2.5, 188, 'gluten,nabiał', 120, { piece: 120 });
  F('burger', 'burger|hamburger|cheeseburger', 250, 13, 24, 11, 1.5, 5, 2.5, 100, 'gluten,smażone,przetworzone', 200, { piece: 200 });
  F('kebab', 'kebab|kebaba|gyros|shawarma', 215, 14, 18, 10, 1.5, 2, 1.5, 50, 'gluten', 350, { piece: 350 });
  F('sushi', 'sushi|maki|roll', 140, 4.5, 28, 0.7, 0.5, 5, 0.4, 10, 'ryby', 200);
  F('pierogi', 'pierogi|pierogow|pierogami|pieroga|uszka|kopytka|knedle|pyzy', 190, 5.5, 30, 5.5, 1.8, 1.5, 0.8, 50, 'gluten', 250, { piece: 35 });
  F('naleśniki', 'nalesnik|nalesniki|nalesnikow|placki|racuchy', 190, 6, 26, 7, 0.9, 5, 1.2, 80, 'gluten,nabiał', 80, { piece: 80 });
  F('kotlet panierowany', 'kotlet schabowy|schabowy|kotlet|panierowany|kotlet panierowany|nuggetsy|nuggets', 255, 18, 10, 15, 0.5, 0.5, 1, 20, 'gluten,smażone', 150, { piece: 120 });
  F('zupa warzywna', 'zupa|zupy|zupe|jarzynowa|krupnik|pomidorowa|ogorkowa|zurek|barszcz|flaki', 45, 1.5, 6, 1.5, 1.2, 2, 0.4, 15, '', 350, { cup: 250, bowl: 350 });
  F('zupa krem', 'zupa krem|krem z|krem dyniowy|krem', 60, 1.5, 8, 2.5, 1, 4, 0.4, 20, '', 350, { cup: 250, bowl: 350 });
  F('rosół', 'rosol|rosolu', 25, 2, 1.5, 1.2, 0.3, 0.5, 0.3, 8, '', 300, { bowl: 300 });
  F('sałatka', 'salatka|salatki|salatke|salatka warzywna', 60, 2, 7, 3, 2, 3, 0.8, 30, '', 250, { bowl: 250 });

  const byName = {};
  FOODS.forEach((f) => { byName[f.name] = f; });

  /* gotowe zestawy: [[nazwa produktu, gramy], ...] */
  const DISHES = [
    { name: 'owsianka', aliases: ['owsianka', 'owsianki', 'owsianke', 'owsianka na mleku'], items: [['płatki owsiane', 50], ['mleko 2%', 200]], milk: 'mleko 2%' },
    { name: 'jajecznica', aliases: ['jajecznica', 'jajecznicy', 'jajecznice'], items: [['jajko', 110], ['masło', 10]] },
    { name: 'omlet', aliases: ['omlet', 'omleta'], items: [['jajko', 110], ['mleko 2%', 30], ['oliwa z oliwek', 5]] },
    { name: 'kanapka', aliases: ['kanapka', 'kanapki', 'kanapke', 'kanapek'], items: [['chleb pszenny', 70], ['masło', 5]] },
    { name: 'latte', aliases: ['latte', 'cappuccino', 'flat white', 'kawa latte'], items: [['kawa (czarna)', 100], ['mleko 2%', 200]] }
  ];

  /* ---------- INDEKS ---------- */
  const INDEX = [];
  FOODS.forEach((f) => f.aliases.forEach((a) => {
    const toks = stemsOf(a);
    if (toks.length) INDEX.push({ kind: 'food', ref: f, toks, score: toks.reduce((s, t) => s + t.length, 0) });
  }));
  DISHES.forEach((d) => d.aliases.forEach((a) => {
    const toks = stemsOf(a);
    INDEX.push({ kind: 'dish', ref: d, toks, score: toks.reduce((s, t) => s + t.length, 0) + 1 });
  }));

  function matchBest(stems) {
    let best = null;
    for (const e of INDEX) {
      if (!e.toks.every((t) => stems.includes(t))) continue;
      if (!best || e.score > best.score) best = e;
    }
    return best;
  }

  /* ---------- ILOŚCI ---------- */
  const NUMW = { pol: 0.5, polowa: 0.5, polowe: 0.5, poltora: 1.5, jeden: 1, jedna: 1, jedno: 1, jedną: 1, dwa: 2, dwie: 2, dwoch: 2, trzy: 3, trzech: 3, cztery: 4, piec: 5, szesc: 6, siedem: 7, osiem: 8, dziewiec: 9, dziesiec: 10 };
  const UNIT_RX = [
    ['g', /^(g|gr|gram|gramy|gramow)$/], ['kg', /^(kg|kilo|kilogram\w*)$/], ['dag', /^dag$/], ['ml', /^ml$/], ['l', /^(l|litr\w*)$/],
    ['tbsp', /^(lyzka|lyzki|lyzke|lyzek|lyzce|lyzkami)$/], ['tsp', /^lyzecz\w*$/], ['cup', /^szklank\w*$/], ['mug', /^(kubek|kubka|kubki|kubeczek)$/],
    ['filiz', /^filizank\w*$/], ['piece', /^(szt|sztuk\w*|sztuka)$/], ['slice', /^kromk\w*$/], ['plast', /^plast\w*$/], ['handful', /^gars\w*$/],
    ['cube', /^kostk\w*$/], ['kawal', /^(kawal\w*)$/], ['portion', /^porcj\w*$/], ['bowl', /^(miseczk\w*|misk\w*)$/], ['can', /^puszk\w*$/], ['pack', /^(opakowan\w*|paczk\w*|sloik\w*)$/]
  ];
  const unitOf = (t) => { for (const [u, rx] of UNIT_RX) if (rx.test(t)) return u; return null; };

  function extractQty(tokens) {
    let qty = null, unit = null; const used = new Set();
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]; let m;
      if ((m = t.match(/^(\d+(?:[.,]\d+)?)([a-z]+)?$/))) {
        if (m[2] && !unitOf(m[2])) continue;
        if (!m[2] && i !== 0 && !used.size) { /* liczba bez jednostki tylko na początku */ const nx = unitOf(tokens[i + 1] || ''); if (!nx) continue; }
        qty = parseFloat(m[1].replace(',', '.')); used.add(i);
        if (m[2]) unit = unitOf(m[2]); else { const nx = unitOf(tokens[i + 1] || ''); if (nx) { unit = nx; used.add(i + 1); } }
        break;
      } else if ((m = t.match(/^(\d+)\/(\d+)$/))) { qty = parseInt(m[1], 10) / parseInt(m[2], 10); used.add(i); const nx = unitOf(tokens[i + 1] || ''); if (nx) { unit = nx; used.add(i + 1); } break; }
      else if (NUMW[t] !== undefined && (i === 0 || unitOf(tokens[i + 1] || ''))) { qty = NUMW[t]; used.add(i); const nx = unitOf(tokens[i + 1] || ''); if (nx) { unit = nx; used.add(i + 1); } break; }
    }
    if (qty === null) { for (let i = 0; i < tokens.length; i++) { const u = unitOf(tokens[i]); if (u && u !== 'g' && u !== 'ml') { qty = 1; unit = u; used.add(i); break; } } }
    let mult = 1;
    if (tokens.includes('duzy') || tokens.includes('duza') || tokens.includes('duze')) mult = 1.3;
    if (tokens.includes('maly') || tokens.includes('mala') || tokens.includes('male')) mult = 0.7;
    return { qty, unit, mult, rest: tokens.filter((_, i) => !used.has(i)) };
  }

  function toGrams(food, qty, unit, mult) {
    const u = food.units || {}; mult = mult || 1;
    switch (unit) {
      case 'g': case 'ml': return qty;
      case 'kg': case 'l': return qty * 1000;
      case 'dag': return qty * 10;
      case 'tbsp': return qty * (u.tbsp || 15);
      case 'tsp': return qty * (u.tsp || 5);
      case 'cup': return qty * (u.cup || 250);
      case 'mug': return qty * (u.cup || 250);
      case 'filiz': return qty * Math.min(u.cup || 250, 150);
      case 'slice': return qty * (u.slice || u.piece || 35);
      case 'plast': return qty * (u.slice || 15);
      case 'handful': return qty * (u.handful || 30);
      case 'cube': return qty * (u.cube || 5);
      case 'bowl': return qty * (u.bowl || food.defG * 1.2);
      case 'can': return qty * (u.can || food.defG);
      case 'piece': case 'kawal': return qty * (u.piece || food.defG) * mult;
      case 'portion': case 'pack': return qty * food.defG;
      default: return qty * (u.piece || food.defG) * mult;
    }
  }

  const mkItem = (food, grams, src) => ({ fid: food.id, name: food.name, grams: Math.round(grams * 10) / 10, per100: Object.assign({}, food.per100), tags: food.tags.slice(), src: src || 'db' });

  /* ---------- PARSER ---------- */
  function splitChunks(text) {
    const t = text.replace(/\b(pierś|piersi|filet|udko|udka)\s+z\s+/gi, '$1 ').replace(/\d+(?:[.,]\d+)?\s*%/g, ' ');
    const rx = /\s*[,;+\n]\s*|\s+(oraz|plus|ze|z|i)\s+/gi;
    const out = []; let last = 0, sep = 'start', m;
    while ((m = rx.exec(t))) {
      out.push({ text: t.slice(last, m.index), sep });
      sep = (m[1] || ',').toLowerCase(); last = m.index + m[0].length;
    }
    out.push({ text: t.slice(last), sep });
    return out.filter((c) => c.text.trim());
  }

  function parseMeal(text) {
    const items = [], unmatched = [];
    let lastDish = null, lastDishIdx = -9;
    const chunks = splitChunks(text);
    for (let ci = 0; ci < chunks.length; ci++) {
      const ch = chunks[ci];
      const tokens = tokenize(ch.text);
      const q = extractQty(tokens);
      const stems = q.rest.filter((t) => !STOP.has(t)).map(stem);
      if (!stems.length) continue;
      if (stems.every((s) => IGNORE.has(s))) continue;
      const isAdd = ch.sep === 'z' || ch.sep === 'ze';
      let remaining = stems.slice();
      let m = matchBest(remaining);
      if (!m) { unmatched.push(ch.text.trim()); continue; }
      remaining = remaining.filter((s) => !m.toks.includes(s));

      if (m.kind === 'dish') {
        const d = m.ref; const comps = d.items.map(([n, g]) => ({ food: byName[n], grams: g }));
        if (q.rest.includes('wodzie') && d.milk) { const i = comps.findIndex((c) => c.food.name === d.milk); if (i >= 0) comps.splice(i, 1); }
        let handled = false;
        if (q.qty) {
          const m2 = matchBest(remaining);
          const comp = m2 && m2.kind === 'food' ? comps.find((c) => c.food === m2.ref) : null;
          if (comp) { comp.grams = toGrams(comp.food, q.qty, q.unit, q.mult); handled = true; remaining = remaining.filter((s) => !m2.toks.includes(s)); }
          else if (q.unit === 'g' || q.unit === 'ml' || q.unit === 'kg') { const tot = comps.reduce((s, c) => s + c.grams, 0); comps.forEach((c) => { c.grams = c.grams * q.qty / tot; }); handled = true; }
          else { comps.forEach((c) => { c.grams *= q.qty; }); handled = true; }
        }
        const dishItems = comps.map((c) => mkItem(c.food, c.grams, 'dish:' + d.name));
        items.push(...dishItems); lastDish = { name: d.name, items: dishItems }; lastDishIdx = ci;
        // dodatki w tej samej porcji
        for (let k = 0; k < 3 && remaining.length; k++) {
          const m3 = matchBest(remaining); if (!m3 || m3.kind !== 'food') break;
          remaining = remaining.filter((s) => !m3.toks.includes(s));
          if (!dishItems.some((it) => it.fid === m3.ref.id)) items.push(mkItem(m3.ref, m3.ref.addG || m3.ref.defG * 0.5, 'db'));
        }
        continue;
      }

      const food = m.ref;
      // nadpisanie składnika ostatniego zestawu (np. "jajecznica z 3 jaj")
      if (lastDish && isAdd && lastDishIdx === ci - 1) {
        const comp = lastDish.items.find((it) => it.fid === food.id);
        if (comp) { if (q.qty) comp.grams = Math.round(toGrams(food, q.qty, q.unit, q.mult) * 10) / 10; continue; }
      }
      let grams;
      if (q.qty) grams = toGrams(food, q.qty, q.unit, q.mult);
      else grams = isAdd ? (food.addG || food.defG) : food.defG;
      items.push(mkItem(food, grams, 'db'));
      // drugi produkt w tym samym fragmencie ("jajka na maśle")
      for (let k = 0; k < 2 && remaining.length; k++) {
        const m3 = matchBest(remaining); if (!m3 || m3.kind !== 'food') break;
        remaining = remaining.filter((s) => !m3.toks.includes(s));
        if (m3.ref.id !== food.id) items.push(mkItem(m3.ref, m3.ref.addG || m3.ref.defG * 0.5, 'db'));
      }
    }
    return { items, unmatched };
  }

  /* ---------- OBLICZENIA ---------- */
  const KEYS = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'fe', 'ca'];
  function itemTotals(it) {
    const k = (Number(it.grams) || 0) / 100; const o = {};
    KEYS.forEach((x) => { o[x] = (it.per100[x] || 0) * k; });
    return o;
  }
  function sumItems(items) {
    const o = {}; KEYS.forEach((x) => { o[x] = 0; });
    (items || []).forEach((it) => { const t = itemTotals(it); KEYS.forEach((x) => { o[x] += t[x]; }); });
    return o;
  }
  function search(q, limit) {
    const qs = stemsOf(q); if (!qs.length) return [];
    const res = [];
    FOODS.forEach((f) => {
      let best = 0;
      f.aliases.forEach((a) => {
        const as = stemsOf(a); const hit = qs.filter((s) => as.some((x) => x === s || (s.length >= 3 && x.startsWith(s)))).length;
        if (hit === qs.length) best = Math.max(best, hit * 10 - as.length);
      });
      if (best) res.push([best, f]);
    });
    return res.sort((a, b) => b[0] - a[0]).slice(0, limit || 8).map((r) => r[1]);
  }
  function fromFood(f, grams) { return mkItem(f, grams || f.defG, 'db'); }
  function guessTags(name) {
    const n = norm(name), t = [];
    if (/mlek|ser|jogurt|maslo|smietan|twarog|kefir|lod|serek/.test(n)) t.push('nabiał');
    if (/chleb|bulk|makaron|pszen|zytni|ciast|ciastk|nalesn|pierog|pizza|tortill/.test(n)) t.push('gluten');
    if (/czekolad|baton|cukier|slodk|cola|dzem|lody|ciast/.test(n)) t.push('cukier');
    if (/kawa|herbat|cola|energ/.test(n)) t.push('kofeina');
    if (/piwo|wino|wodka|alkohol/.test(n)) t.push('alkohol');
    if (/smazon|frytk|chips|panier/.test(n)) t.push('smażone');
    return t;
  }
  return { FOODS, DISHES, KEYS, norm, stem, parseMeal, itemTotals, sumItems, search, fromFood, guessTags, toGrams, unitOf };
});
