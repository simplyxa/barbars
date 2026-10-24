// Манекен персонажа: SVG, который собирается из надетых вещей.
// Форма вещи зависит от тира (уровня), цвет отделки — от качества, свечение — от заточки.
(function (root) {
  'use strict';

  const G = root.Game || (typeof require !== 'undefined' ? require('./game.js') : null);

  const QCOLOR = ['#d9d2c4', '#7fc76b', '#5fa8f0', '#c07ef0', '#ff9d3a'];
  const INK = '#2a1e14';
  const SKIN = '#d4a77f';
  const RUNE = '#6fe0ff';
  const GOLD = '#d4a52b';
  // Материал по тиру: ткань/кожа, железо, сталь, полированная сталь, рунный металл, драконья чешуя.
  const MAT = ['#7a5a3a', '#8a8f96', '#6f7780', '#b7bec6', '#4a6b8a', '#6b2a24'];
  const MAT_DARK = ['#5b4129', '#666b72', '#525961', '#8d949c', '#344d66', '#4a1b17'];
  const WOOD = '#7a5430';
  const FACTION = {
    north: { cloak: '#3b4f66', hair: '#c9a35b', shield: '#2f5f8a' },
    south: { cloak: '#8a3b1f', hair: '#2a1d14', shield: '#9a4a1c' },
  };

  let uid = 0;

  const el = (tag, attrs, inner) => {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return inner === undefined ? `<${tag} ${a}/>` : `<${tag} ${a}>${inner}</${tag}>`;
  };
  const path = (d, fill, extra) => el('path', Object.assign({ d, fill, stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' }, extra || {}));
  const line = (x1, y1, x2, y2, stroke, w, extra) => el('line', Object.assign({ x1, y1, x2, y2, stroke, 'stroke-width': w, 'stroke-linecap': 'round' }, extra || {}));
  const circle = (cx, cy, r, fill, extra) => el('circle', Object.assign({ cx, cy, r, fill, stroke: INK, 'stroke-width': 1 }, extra || {}));

  // Заточка +5 и выше подсвечивает вещь цветом её качества.
  function glow(it, inner) {
    if (!it || it.plus < 5) return inner;
    const r = it.plus >= 10 ? 4 : it.plus >= 8 ? 3 : 2;
    return `<g style="filter: drop-shadow(0 0 ${r}px ${QCOLOR[it.q]})">${inner}</g>`;
  }

  // ---------- Тело ----------

  function cloak(faction) {
    const f = FACTION[faction];
    let h = path('M60 50 L100 50 L114 156 L46 156 Z', f.cloak);
    if (faction === 'north') h += el('ellipse', { cx: 80, cy: 50, rx: 24, ry: 6, fill: '#d8d2c6', stroke: INK, 'stroke-width': 1 });
    return h;
  }

  function body(faction, hasBoots) {
    const f = FACTION[faction];
    let h = '';
    // Руки.
    h += el('polyline', { points: '61,55 52,82 50,106', fill: 'none', stroke: INK, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    h += el('polyline', { points: '61,55 52,82 50,106', fill: 'none', stroke: SKIN, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    h += el('polyline', { points: '99,55 108,82 110,106', fill: 'none', stroke: INK, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    h += el('polyline', { points: '99,55 108,82 110,106', fill: 'none', stroke: SKIN, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    // Ноги в штанах.
    h += path('M63 100 L79 100 L78 172 L66 172 Z', '#4a3b2c');
    h += path('M81 100 L97 100 L94 172 L82 172 Z', '#4a3b2c');
    if (!hasBoots) {
      h += el('ellipse', { cx: 71, cy: 174, rx: 8, ry: 4, fill: SKIN, stroke: INK, 'stroke-width': 1 });
      h += el('ellipse', { cx: 89, cy: 174, rx: 8, ry: 4, fill: SKIN, stroke: INK, 'stroke-width': 1 });
    }
    // Торс, шея, голова.
    h += path('M62 50 L98 50 L102 60 L98 100 L62 100 L58 60 Z', SKIN);
    h += path('M75 42 L85 42 L85 51 L75 51 Z', SKIN);
    h += circle(80, 34, 12, SKIN);
    // Волосы и лицо.
    if (faction === 'north') {
      h += path('M68 32 Q68 19 80 19 Q92 19 92 32 L94 46 L89 38 Q80 28 71 38 L66 46 Z', f.hair);
      h += path('M72 39 Q80 54 88 39 Q84 43 80 43 Q76 43 72 39 Z', f.hair);
    } else {
      h += path('M68 33 Q67 20 80 20 Q93 20 92 33 Q88 26 80 26 Q72 26 68 33 Z', f.hair);
      h += path('M74 40 Q80 37 86 40 L86 42 Q80 40 74 42 Z', f.hair, { 'stroke-width': 0.5 });
    }
    h += circle(76, 33, 1.2, INK, { 'stroke-width': 0 }) + circle(84, 33, 1.2, INK, { 'stroke-width': 0 });
    return h;
  }

  function hands() {
    return circle(50, 108, 5, SKIN) + circle(110, 108, 5, SKIN);
  }

  // ---------- Вещи ----------

  function armor(it, uidp) {
    if (!it) return '';
    const t = G.itemTier(it);
    const q = QCOLOR[it.q];
    const m = MAT[t], md = MAT_DARK[t];
    let h = '';
    // Рукава.
    if (t >= 1) {
      h += el('polyline', { points: '61,55 55,76', fill: 'none', stroke: INK, 'stroke-width': 12, 'stroke-linecap': 'round' });
      h += el('polyline', { points: '61,55 55,76', fill: 'none', stroke: m, 'stroke-width': 10, 'stroke-linecap': 'round' });
      h += el('polyline', { points: '99,55 105,76', fill: 'none', stroke: INK, 'stroke-width': 12, 'stroke-linecap': 'round' });
      h += el('polyline', { points: '99,55 105,76', fill: 'none', stroke: m, 'stroke-width': 10, 'stroke-linecap': 'round' });
    }
    // Юбка доспеха.
    if (t >= 1) h += path('M60 101 L100 101 L103 116 L57 116 Z', md);
    // Корпус.
    const fill = t === 1 ? `url(#${uidp}-chain)` : t === 2 ? `url(#${uidp}-scale)` : m;
    h += path('M60 49 L100 49 L104 60 L100 104 L60 104 L56 60 Z', fill);
    if (t === 0) {
      for (const y of [62, 72, 82, 92]) h += line(59, y, 101, y, md, 1);
      h += line(80, 50, 80, 96, md, 1);
    }
    if (t >= 3) {
      h += path('M64 58 Q72 70 80 62 Q88 70 96 58', 'none', { stroke: md, 'stroke-width': 1.5 });
      h += line(80, 62, 80, 94, md, 1.5);
    }
    if (t === 4) {
      h += el('path', { d: 'M70 70 L74 78 L70 86 M90 70 L86 78 L90 86 M80 68 L80 74', fill: 'none', stroke: RUNE, 'stroke-width': 1.5, style: `filter: drop-shadow(0 0 2px ${RUNE})` });
    }
    // Наплечники.
    if (t >= 2) {
      const rx = 7 + t, ry = 5 + t * 0.6;
      h += el('ellipse', { cx: 59, cy: 54, rx, ry, fill: m, stroke: INK, 'stroke-width': 1 });
      h += el('ellipse', { cx: 101, cy: 54, rx, ry, fill: m, stroke: INK, 'stroke-width': 1 });
      if (t === 5) {
        h += path('M52 50 L48 38 L57 47 Z', GOLD) + path('M60 48 L60 36 L65 47 Z', GOLD);
        h += path('M108 50 L112 38 L103 47 Z', GOLD) + path('M100 48 L100 36 L95 47 Z', GOLD);
      }
    }
    // Пояс с пряжкой цвета качества.
    h += path('M60 96 L100 96 L100 102 L60 102 Z', t === 5 ? GOLD : '#3b2a1a');
    h += el('rect', { x: 76, y: 95, width: 8, height: 8, rx: 1.5, fill: q, stroke: INK, 'stroke-width': 1 });
    return glow(it, h);
  }

  function amulet(it) {
    if (!it) return '';
    const t = G.itemTier(it);
    let h = el('path', { d: 'M72 49 Q80 66 88 49', fill: 'none', stroke: t >= 2 ? GOLD : '#8a6a3a', 'stroke-width': 1 });
    if (t === 0) h += path('M78 60 L80 70 L82 60 Z', '#efe6d2');
    else h += circle(80, 63, 2.5 + t * 0.5, QCOLOR[it.q], t >= 4 ? { style: `filter: drop-shadow(0 0 3px ${QCOLOR[it.q]})` } : {});
    return glow(it, h);
  }

  function helm(it) {
    if (!it) return '';
    const t = G.itemTier(it);
    const q = QCOLOR[it.q];
    const m = MAT[t];
    let h = '';
    if (t === 0) {
      h += path('M67 33 Q67 17 80 17 Q93 17 93 33 Z', m);
      h += line(67, 32, 93, 32, q, 2);
    } else if (t <= 2) {
      if (t === 2) {
        h += path('M68 27 Q55 22 56 8 Q61 20 71 23 Z', '#e8dcc0');
        h += path('M92 27 Q105 22 104 8 Q99 20 89 23 Z', '#e8dcc0');
      }
      h += path('M66 35 Q66 15 80 15 Q94 15 94 35 Z', m);
      h += path('M78.5 30 L81.5 30 L81.5 41 L78.5 41 Z', m);
      h += line(66, 34, 94, 34, q, 2);
    } else if (t === 3 || t === 4) {
      h += el('rect', { x: 66, y: 18, width: 28, height: 31, rx: 7, fill: m, stroke: INK, 'stroke-width': 1 });
      const slit = t === 4 ? RUNE : INK;
      const style = t === 4 ? `filter: drop-shadow(0 0 2px ${RUNE})` : '';
      h += el('rect', { x: 69, y: 31, width: 22, height: 2.5, fill: slit, style });
      h += el('rect', { x: 78.75, y: 33, width: 2.5, height: 9, fill: slit, style });
      h += line(80, 18, 80, 28, q, 2);
    } else {
      h += path('M67 28 L67 16 L72 22 L76 11 L80 19 L84 11 L88 22 L93 16 L93 28 Z', GOLD);
      h += circle(80, 23, 2.2, q) + circle(72, 25, 1.6, q) + circle(88, 25, 1.6, q);
    }
    return glow(it, h);
  }

  function boots(it) {
    if (!it) return '';
    const t = G.itemTier(it);
    const m = MAT[t];
    const q = QCOLOR[it.q];
    let h = '';
    const top = t === 0 ? 156 : t >= 3 ? 140 : 148;
    const fill = t === 0 ? '#9b8360' : t <= 2 ? '#5a3d24' : m;
    h += path(`M64 ${top} L79 ${top} L79 172 L82 179 L60 179 L63 172 Z`, fill);
    h += path(`M81 ${top} L96 ${top} L95 172 L100 179 L78 179 L81 172 Z`, fill);
    if (t === 0) {
      for (const y of [160, 165, 170]) h += line(64, y, 79, y - 3, '#6e5a3e', 1) + line(81, y, 96, y - 3, '#6e5a3e', 1);
    }
    if (t === 2) {
      h += path(`M63 ${top} L80 ${top} L80 ${top + 6} L63 ${top + 6} Z`, '#8b6a45');
      h += path(`M80 ${top} L97 ${top} L97 ${top + 6} L80 ${top + 6} Z`, '#8b6a45');
    }
    if (t >= 3) h += circle(71.5, top + 2, 4.5, MAT_DARK[t]) + circle(88.5, top + 2, 4.5, MAT_DARK[t]);
    if (t >= 4) {
      const c = t === 4 ? RUNE : q;
      const style = `filter: drop-shadow(0 0 2px ${c})`;
      h += el('path', { d: 'M70 156 L73 162 L69 166 M90 156 L87 162 L91 166', fill: 'none', stroke: c, 'stroke-width': 1.5, style });
    }
    h += line(62, 178, 79, 178, q, 1.5) + line(80, 178, 99, 178, q, 1.5);
    return glow(it, h);
  }

  function weapon(it) {
    if (!it) return '';
    const t = G.itemTier(it);
    const q = QCOLOR[it.q];
    const steel = MAT[Math.max(2, t)];
    let h = '';
    if (t === 0) {
      h += line(50, 100, 50, 117, WOOD, 3);
      h += path('M47 101 L53 101 L54 74 L50 66 L46 78 Z', '#8a6f5a');
      h += line(44, 101, 56, 101, q, 2.5);
    } else if (t === 1) {
      h += line(50, 122, 50, 64, WOOD, 3.5);
      h += path('M50 70 L36 63 Q31 76 36 89 L50 81 Z', steel);
      h += circle(50, 66, 1.8, q);
    } else if (t === 2) {
      h += line(50, 126, 50, 56, WOOD, 4);
      h += path('M50 61 L32 52 Q25 70 32 88 L50 79 Z', steel);
      h += path('M50 63 L62 57 Q66 70 62 83 L50 77 Z', steel);
      h += circle(50, 56, 2, q);
    } else if (t === 3 || t === 4) {
      const blade = t === 4 ? MAT[4] : '#d8dde2';
      h += line(50, 102, 50, 119, '#3b2a1a', 3.5);
      h += path('M46.5 100 L53.5 100 L53.5 36 L50 26 L46.5 36 Z', blade);
      if (t === 4) h += el('line', { x1: 50, y1: 96, x2: 50, y2: 34, stroke: RUNE, 'stroke-width': 1.5, style: `filter: drop-shadow(0 0 2px ${RUNE})` });
      h += path('M40 99 L60 99 L60 103 L40 103 Z', t === 4 ? '#2c3d50' : GOLD);
      h += circle(50, 121, 2.5, q);
    } else {
      h += line(50, 128, 50, 62, '#3b2a1a', 4);
      h += el('rect', { x: 36, y: 46, width: 28, height: 18, rx: 2, fill: MAT[5], stroke: INK, 'stroke-width': 1 });
      h += path('M36 50 L64 50 L64 53 L36 53 Z', GOLD) + path('M36 57 L64 57 L64 60 L36 60 Z', GOLD);
      h += el('path', { d: 'M48 40 L44 47 L50 47 L46 54', fill: 'none', stroke: q, 'stroke-width': 1.5, style: `filter: drop-shadow(0 0 3px ${q})` });
    }
    return glow(it, h);
  }

  function emblem(faction, cx, cy, r, color) {
    if (faction === 'north') {
      return line(cx, cy - r, cx, cy + r, color, 1.5) + line(cx - r * 0.87, cy - r / 2, cx + r * 0.87, cy + r / 2, color, 1.5)
        + line(cx - r * 0.87, cy + r / 2, cx + r * 0.87, cy - r / 2, color, 1.5);
    }
    return circle(cx, cy, r * 0.6, color, { 'stroke-width': 0 })
      + circle(cx + r * 0.35, cy - r * 0.2, r * 0.5, FACTION.south.shield, { 'stroke-width': 0 });
  }

  function shield(it, faction) {
    if (!it) return '';
    const t = G.itemTier(it);
    const q = QCOLOR[it.q];
    const face = FACTION[faction].shield;
    let h = '';
    if (t === 0) {
      h += circle(113, 98, 12, WOOD);
      h += line(105, 92, 121, 92, '#5b3d20', 1) + line(103, 98, 123, 98, '#5b3d20', 1) + line(105, 104, 121, 104, '#5b3d20', 1);
      h += circle(113, 98, 2.5, q);
    } else if (t === 1) {
      h += circle(113, 96, 14, WOOD, { stroke: '#8a8f96', 'stroke-width': 3 });
      h += line(113, 82, 113, 110, '#8a8f96', 2.5);
      h += circle(113, 96, 3, q);
    } else if (t === 2) {
      h += circle(113, 94, 17, face, { stroke: MAT[2], 'stroke-width': 3 });
      h += emblem(faction, 113, 94, 9, '#e8dcc0');
      h += circle(113, 94, 3.5, q);
    } else if (t === 3) {
      h += el('rect', { x: 98, y: 70, width: 30, height: 48, rx: 4, fill: face, stroke: MAT[3], 'stroke-width': 3 });
      h += emblem(faction, 113, 92, 9, '#e8dcc0');
      h += line(100, 72, 126, 72, q, 2);
    } else {
      const big = t === 5;
      const d = big ? 'M113 64 L131 74 L127 104 L113 124 L99 104 L95 74 Z' : 'M113 68 L129 77 L125 103 L113 120 L101 103 L97 77 Z';
      h += path(d, big ? face : '#2c3d50', { stroke: big ? GOLD : MAT[4], 'stroke-width': 3 });
      const c = big ? q : RUNE;
      h += `<g style="filter: drop-shadow(0 0 2px ${c})">${emblem(faction, 113, 92, 10, c)}</g>`;
    }
    return glow(it, h);
  }

  // ---------- Сборка ----------

  function render(equip, faction, opts) {
    opts = opts || {};
    const p = 'doll' + (++uid);
    const defs = `<defs>
      <pattern id="${p}-chain" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="${MAT[1]}"/><circle cx="2" cy="2" r="1.3" fill="none" stroke="${MAT_DARK[1]}" stroke-width="0.7"/>
      </pattern>
      <pattern id="${p}-scale" width="6" height="5" patternUnits="userSpaceOnUse">
        <rect width="6" height="5" fill="${MAT[2]}"/><path d="M0 0 Q3 6 6 0" fill="none" stroke="${MAT_DARK[2]}" stroke-width="0.8"/>
      </pattern>
    </defs>`;
    const h = [
      defs,
      el('ellipse', { cx: 80, cy: 181, rx: 34, ry: 5, fill: 'rgba(0,0,0,.35)' }),
      cloak(faction),
      body(faction, !!equip.boots),
      boots(equip.boots),
      armor(equip.armor, p),
      amulet(equip.amulet),
      helm(equip.helm),
      weapon(equip.weapon),
      hands(),
      shield(equip.shield, faction),
    ].join('');
    const label = opts.label ? ` aria-label="${opts.label}"` : '';
    return `<svg class="doll-svg" viewBox="0 0 160 190" role="img"${label} xmlns="http://www.w3.org/2000/svg">${h}</svg>`;
  }

  root.Doll = { render };
  if (typeof module !== 'undefined') module.exports = root.Doll;
})(typeof window !== 'undefined' ? window : globalThis);
