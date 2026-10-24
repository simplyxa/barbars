// Интерфейс: рендер экранов и обработка кликов по ссылкам.
(function () {
  'use strict';

  const G = window.Game;
  const { FACTIONS, LOCATIONS, MONSTERS, DUNGEONS, TOWERS, SLOTS, QUALITIES, QUESTS, POTIONS, STATS } = window.DATA;
  const SAVE_KEY = 'northsteppe-save-v1';
  const $app = document.getElementById('app');
  let s = null;

  // ---------- Хелперы разметки ----------

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = (text, a, p, cls) => `<a href="#" class="${cls || ''}" data-a="${a}"${p !== undefined ? ` data-p="${esc(p)}"` : ''}>${text}</a>`;
  const item = (it) => `<span class="${QUALITIES[it.q].cls}">${esc(G.itemName(it))}${it.plus ? ' +' + it.plus : ''}</span> <span class="dim">[${it.lvl}]</span>`;
  const bar = (cur, max, cls) => {
    const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
    return `<div class="bar ${cls}"><i style="width:${pct}%"></i><span>${Math.floor(cur)}/${max}</span></div>`;
  };
  const statsText = (st) => {
    const names = { dmg: 'урон', hp: 'здоровье', en: 'энергия', arm: 'броня' };
    return Object.keys(st).filter((k) => st[k]).map((k) => `+${st[k]} ${names[k]}`).join(', ');
  };
  const mins = (ms) => {
    const m = Math.ceil(ms / 60000);
    return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
  };
  const back = (text) => `<div class="nav">${link(text || '← Назад', 'screen', 'loc')}</div>`;
  const section = (title, body) => `<h2>${title}</h2>${body}`;

  // ---------- Экраны ----------

  function header() {
    const d = G.derived(s);
    return `<div class="hud" id="hud">
      <div class="hud-top">
        <span class="${FACTIONS[s.faction].color}">⚑</span> <b>${esc(s.name)}</b> <span class="dim">[${s.lvl}]</span>
        <span class="right">💰 ${s.gold}${s.glory ? ` · ✪ ${s.glory}` : ''}</span>
      </div>
      ${bar(s.hp, d.maxHp, 'hp')}
      ${bar(s.en, d.maxEn, 'en')}
      ${bar(s.exp, G.expNeed(s.lvl), 'xp')}
    </div>`;
  }

  function flashes() {
    if (!s.flash.length) return '';
    const html = s.flash.map((f) => `<div class="flash ${f.cls}">${esc(f.text)}</div>`).join('');
    s.flash = [];
    return html;
  }

  function footer() {
    if (s.fight) return '';
    const links = [
      ['Главная', 'screen', 'loc'], ['Персонаж', 'screen', 'char'], ['Рюкзак', 'screen', 'bag'],
      ['Задания', 'screen', 'quests'], ['Башни', 'screen', 'towers'], ['Журнал', 'screen', 'log'], ['Настройки', 'screen', 'settings'],
    ];
    return `<div class="footer">${links.map(([t, a, p]) => link(t, a, p)).join(' · ')}</div>`;
  }

  const screens = {};

  screens.create = function () {
    return `<div class="create">
      <h1>Север и Степь</h1>
      <p class="dim">Текстовая браузерная RPG. Две фракции, одна земля и бесконечная война.</p>
      <form id="create-form">
        <label>Имя героя<br><input id="hero-name" maxlength="16" required placeholder="Например, Хротгар" autocomplete="off"></label>
        <p>Выберите сторону:</p>
        ${Object.entries(FACTIONS).map(([id, f], i) => `
          <label class="faction-pick ${f.color}">
            <input type="radio" name="faction" value="${id}" ${i === 0 ? 'checked' : ''}>
            <b>${f.name}</b> — столица ${f.city}<br><span class="dim">${f.desc}</span>
          </label>`).join('')}
        <button type="submit">Начать путь</button>
      </form>
    </div>`;
  };

  screens.loc = function () {
    const L = LOCATIONS[s.loc];
    let h = `<h1>${esc(G.locName(s, s.loc))}</h1><p class="desc">${L.desc}</p>`;
    if (L.services) {
      h += `<div class="menu">
        ${link('🛒 Торговая лавка', 'screen', 'shop')}
        ${link('💪 Тренировочный двор', 'screen', 'trainer')}
        ${link('⚒ Кузница', 'screen', 'smith')}
        ${link('🍺 Таверна (задания)', 'screen', 'quests')}
        ${link('⚔ Арена', 'screen', 'arena')}
      </div>`;
    }
    if (L.monsters) {
      const lv = L.monsters.map((m) => MONSTERS[m].lvl);
      h += `<div class="menu">${link(`⚔ Искать противника <span class="dim">(ур. ${Math.min(...lv)}–${Math.max(...lv) + 1})</span>`, 'hunt', undefined, 'big')}</div>
        <p class="dim small">Здесь обитают: ${L.monsters.map((m) => MONSTERS[m].name).join(', ')}.</p>`;
    }
    if (L.tower) {
      const t = s.towers[L.tower];
      h += `<div class="menu">${link(`⚑ ${TOWERS[L.tower].name}`, 'screen', 'tower')} — <span class="${FACTIONS[t.owner].color}">${FACTIONS[t.owner].name}</span></div>`;
    }
    if (L.dungeon) {
      const dg = DUNGEONS[L.dungeon];
      h += `<div class="menu">${link(`☠ ${dg.name}`, 'screen', 'dungeon')} <span class="dim">(ур. ${dg.minLvl}+)</span></div>`;
    }
    h += `<h2>Дороги</h2><div class="menu">${L.exits.map((x) => {
      const warn = LOCATIONS[x].minLvl > s.lvl ? ' danger' : '';
      return link(`→ ${esc(G.locName(s, x))} <span class="dim">(ур. ${LOCATIONS[x].minLvl}+)</span>`, 'go', x, warn);
    }).join('')}</div>`;
    if (s.log.length) {
      h += `<h2>События</h2><ul class="log">${s.log.slice(0, 4).map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul>`;
    }
    return h;
  }

  screens.fight = function () {
    const f = s.fight;
    const e = f.enemy;
    const d = G.derived(s);
    const titles = { hunt: 'Бой', arena: 'Арена', tower: 'Штурм башни', dungeon: 'Подземелье' };
    let h = `<h1>${titles[f.type]}</h1>
      <div class="enemy"><b>${esc(e.name)}</b> <span class="dim">[${e.lvl}]</span>${e.boss ? ' <span class="q3">босс</span>' : ''}
      ${e.faction ? ` <span class="${FACTIONS[e.faction].color}">${FACTIONS[e.faction].short}</span>` : ''}
      ${bar(e.hp, e.maxHp, 'hp enemy-hp')}</div>`;
    if (f.queue.length) h += `<p class="dim small">Впереди ещё противников: ${f.queue.length}</p>`;

    if (f.result) {
      const msg = { win: '<div class="flash good">Победа!</div>', lose: '<div class="flash bad">Поражение…</div>', fled: '<div class="flash warn">Вы отступили.</div>' };
      h += msg[f.result];
      if (f.totalExp) h += `<p>Итого: +${f.totalExp} опыта, +${f.totalGold} зол.</p>`;
      if (f.loot.length) h += `<p>Добыча: ${f.loot.map(item).join(', ')}</p>`;
      h += `<div class="menu">${link('Продолжить', 'endFight', undefined, 'big')}`;
      if (f.result === 'win' && f.type === 'hunt') h += link('⚔ Искать ещё', 'again', undefined, 'big');
      h += '</div>';
    } else if (f.between) {
      h += `<div class="menu">${link('→ Дальше', 'next', undefined, 'big')}${link('Уйти', 'endFight')}</div>`;
    } else {
      h += `<div class="actions">
        ${link('⚔ Атаковать', 'act', 'hit', 'big')}
        ${link(`💥 Мощный удар <span class="dim">(${G.COSTS.power}⚡)</span>`, 'act', 'power', s.en < G.COSTS.power ? 'off' : '')}
        ${link(`✚ Лечиться <span class="dim">(${G.COSTS.heal}⚡)</span>`, 'act', 'heal', s.en < G.COSTS.heal || s.hp >= d.maxHp ? 'off' : '')}
        ${link(`🧪 Зелье здоровья <span class="dim">(${s.potions.hp})</span>`, 'act', 'potion_hp', s.potions.hp ? '' : 'off')}
        ${link(`🔷 Зелье энергии <span class="dim">(${s.potions.en})</span>`, 'act', 'potion_en', s.potions.en ? '' : 'off')}
        ${link('🏃 Бежать', 'act', 'flee')}
      </div>`;
    }
    h += `<ul class="log fightlog">${f.log.slice(0, 12).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    return h;
  };

  screens.char = function () {
    const d = G.derived(s);
    const r = s.record;
    let h = `<h1>${esc(s.name)}</h1>
      <p><span class="${FACTIONS[s.faction].color}">${FACTIONS[s.faction].name}</span>, ${s.lvl} уровень · Мощь: <b>${G.power(s)}</b></p>
      <table class="stats">
        <tr><td>Урон</td><td>${d.dmg}</td></tr>
        <tr><td>Здоровье</td><td>${Math.floor(s.hp)}/${d.maxHp}</td></tr>
        <tr><td>Энергия</td><td>${Math.floor(s.en)}/${d.maxEn}</td></tr>
        <tr><td>Броня</td><td>${d.armor} <span class="dim">(−${Math.round(G.reduction(d.armor, s.lvl) * 100)}% урона)</span></td></tr>
        <tr><td>Опыт</td><td>${s.exp}/${G.expNeed(s.lvl)}</td></tr>
        <tr><td>Слава</td><td>${s.glory}</td></tr>
      </table>
      <h2>Параметры</h2>
      <table class="stats">${Object.keys(STATS).map((k) => `<tr><td>${STATS[k].name}</td><td>${s.stats[k]}</td></tr>`).join('')}</table>
      ${s.points ? `<p class="flash good">Свободных очков: ${s.points} — ${link('распределить', 'screen', 'trainer')}</p>` : ''}
      <h2>Снаряжение</h2><div class="menu">`;
    for (const slot in SLOTS) {
      const it = s.equip[slot];
      h += `<div>${SLOTS[slot].name}: ${it ? link(item(it), 'item', it.id) : '<span class="dim">пусто</span>'}</div>`;
    }
    h += `</div><h2>Достижения</h2>
      <p class="small">Побед над врагами: ${r.monsters} · Смертей: ${r.deaths}<br>
      Арена: ${r.arenaWin} побед / ${r.arenaLoss} поражений<br>
      Захвачено башен: ${r.towers} · Повержено боссов: ${r.bosses}</p>`;
    return h + back();
  };

  screens.bag = function () {
    let h = `<h1>Рюкзак <span class="dim">${s.bag.length}/${G.BAG_LIMIT}</span></h1>
      <div class="menu">
        ${link(`🧪 Зелье здоровья ×${s.potions.hp}`, 'potion', 'hp', s.potions.hp ? '' : 'off')}
        ${link(`🔷 Зелье энергии ×${s.potions.en}`, 'potion', 'en', s.potions.en ? '' : 'off')}
      </div>`;
    if (!s.bag.length) h += '<p class="dim">Вещей нет. Добыча падает с монстров, боссов и защитников башен.</p>';
    else {
      const sorted = s.bag.slice().sort((a, b) => b.q - a.q || b.lvl - a.lvl);
      h += `<div class="menu">${sorted.map((it) => {
        const cur = s.equip[it.slot];
        const better = !cur || G.itemPower(it) > G.itemPower(cur);
        return `<div>${link(item(it), 'item', it.id)} <span class="dim small">${SLOTS[it.slot].name}</span>${better && it.lvl <= s.lvl ? ' <span class="good">▲</span>' : ''}</div>`;
      }).join('')}</div>`;
      if (s.loc === 'city') h += `<div class="menu">${link('Продать все обычные вещи', 'sellJunk')}</div>`;
    }
    return h + back();
  };

  screens.item = function () {
    const f = G.findItem(s, s.view);
    if (!f) { s.screen = 'bag'; return screens.bag(); }
    const it = f.item;
    const cur = s.equip[it.slot];
    let h = `<h1>${item(it)}</h1>
      <p>${SLOTS[it.slot].name} · <span class="${QUALITIES[it.q].cls}">${QUALITIES[it.q].name}</span> · требуется ${it.lvl} ур.</p>
      <p>${statsText(G.itemStats(it))}</p>`;
    if (f.where === 'bag' && cur) h += `<p class="dim small">Надето сейчас: ${item(cur)} — ${statsText(G.itemStats(cur))}</p>`;
    h += '<div class="menu">';
    if (f.where === 'bag') {
      h += link('Надеть', 'equip', it.id, it.lvl > s.lvl ? 'off' : '');
      if (s.loc === 'city') h += link(`Продать за ${G.sellPrice(it)} зол.`, 'sell', it.id);
      else h += '<span class="dim small">Продать можно в городе.</span>';
    } else {
      h += link('Снять', 'unequip', it.slot);
    }
    if (s.loc === 'city') h += link('Заточить в кузнице', 'screen', 'smith');
    h += '</div>';
    return h + `<div class="nav">${link('← Рюкзак', 'screen', 'bag')} · ${link('Персонаж', 'screen', 'char')}</div>`;
  };

  screens.shop = function () {
    let h = `<h1>Торговая лавка</h1><p class="desc">Пузатый торговец раскладывает товар. «Всё лучшее — для героев!»</p>
      <h2>Зелья</h2><div class="menu">`;
    for (const k in POTIONS) {
      const p = POTIONS[k];
      h += `<div>${p.name} — ${p.price} зол. <span class="dim small">${p.desc}</span><br>
        ${link('Купить 1', 'buyPotion', k)} · ${link(`Купить 5 (${p.price * 5})`, 'buyPotion5', k)}</div>`;
    }
    h += '</div><h2>Снаряжение</h2><div class="menu">';
    for (const o of G.shopOffer(s)) {
      h += `<div>${item(o)} — ${G.shopPrice(o)} зол. <span class="dim small">${statsText(G.itemStats(o))}</span><br>${link('Купить', 'buyItem', o.slot)}</div>`;
    }
    h += '</div><p class="dim small">Продать вещи можно из рюкзака.</p>';
    return h + back();
  };

  screens.trainer = function () {
    let h = `<h1>Тренировочный двор</h1><p class="desc">Старый наставник оценивающе смотрит на вас. «Сила приходит через пот и золото».</p>`;
    if (s.points) h += `<p class="flash good">Свободных очков: ${s.points}. Тренировка бесплатна, пока они есть.</p>`;
    h += '<table class="stats">';
    for (const k in STATS) {
      const cost = G.statCost(s.stats[k]);
      const label = s.points ? '+1 (очко)' : `+1 за ${cost} зол.`;
      h += `<tr><td>${STATS[k].name} <b>${s.stats[k]}</b><br><span class="dim small">${STATS[k].desc}</span></td>
        <td>${link(label, 'train', k, !s.points && s.gold < cost ? 'off' : '')}</td></tr>`;
    }
    return h + '</table>' + back();
  };

  screens.smith = function () {
    let h = `<h1>Кузница</h1><p class="desc">Кузнец раздувает горн. «Каждая заточка — +10% к силе вещи. Но металл не всегда слушается».</p><div class="menu">`;
    const all = Object.values(s.equip).filter(Boolean).concat(s.bag.filter((i) => i.q > 0 || i.plus > 0));
    if (!all.length) h += '<p class="dim">Нечего затачивать.</p>';
    for (const it of all) {
      const worn = Object.values(s.equip).includes(it);
      if (it.plus >= G.MAX_PLUS) { h += `<div>${item(it)} — <span class="dim">предел</span></div>`; continue; }
      const cost = G.upgradeCost(it);
      h += `<div>${item(it)}${worn ? ' <span class="dim small">(надето)</span>' : ''}<br>
        ${link(`Заточить до +${it.plus + 1}: ${cost} зол., шанс ${Math.round(G.upgradeChance(it) * 100)}%`, 'upgrade', it.id, s.gold < cost ? 'off' : '')}</div>`;
    }
    return h + '</div><p class="dim small">Показаны надетые вещи и необычные вещи из рюкзака.</p>' + back();
  };

  screens.quests = function () {
    let h = `<h1>Таверна «Пьяный медведь»</h1><p class="desc">За кружкой эля можно узнать, кому нужна помощь.</p><h2>Активные задания</h2>`;
    const active = Object.keys(s.quests);
    if (!active.length) h += '<p class="dim">Нет активных заданий.</p>';
    h += '<div class="menu">';
    for (const id of active) {
      const q = QUESTS.find((x) => x.id === id);
      const p = s.quests[id].progress;
      const done = p >= q.count;
      h += `<div><b>${q.title}</b>: ${MONSTERS[q.target].name} ${p}/${q.count}<br>
        ${done ? (s.loc === 'city' ? link('Получить награду', 'claim', id, 'good') : '<span class="good small">Выполнено! Вернитесь в город за наградой.</span>') : link('Отказаться', 'dropQuest', id, 'small')}</div>`;
    }
    h += '</div>';
    if (s.loc === 'city') {
      h += '<h2>Доступные задания</h2><div class="menu">';
      const list = G.questsAvailable(s).filter((q) => !s.quests[q.id]);
      if (!list.length) h += '<p class="dim">Пока ничего нового.</p>';
      for (const q of list) {
        h += `<div><b>${q.title}</b> <span class="dim">(ур. ${q.minLvl}+)</span><br>Убить: ${MONSTERS[q.target].name} ×${q.count}.
          Награда: ${q.gold} зол., ${q.exp} опыта.<br>${link('Взять', 'takeQuest', q.id)}</div>`;
      }
      h += '</div>';
    } else {
      h += '<p class="dim small">Новые задания выдают в таверне столицы.</p>';
    }
    return h + back();
  };

  screens.arena = function () {
    const d = G.derived(s);
    return `<h1>Арена</h1><p class="desc">Песок, кровь и рёв толпы. Здесь сходятся воины враждующих фракций.</p>
      <p>Побед: ${s.record.arenaWin} · Поражений: ${s.record.arenaLoss} · Слава: ${s.glory}</p>
      <p class="dim small">Соперник подбирается под вашу силу. Поражение на арене не стоит золота. Нужно не меньше половины здоровья.</p>
      <div class="menu">${link('⚔ Вызвать соперника', 'arena', undefined, s.hp < d.maxHp * 0.5 ? 'off big' : 'big')}</div>` + back();
  };

  screens.tower = function () {
    const id = LOCATIONS[s.loc].tower;
    if (!id) { s.screen = 'loc'; return screens.loc(); }
    const t = s.towers[id];
    const mine = t.owner === s.faction;
    let h = `<h1>${TOWERS[id].name}</h1>
      <p>Владелец: <span class="${FACTIONS[t.owner].color}">${FACTIONS[t.owner].name}</span></p>
      <p class="desc">Каждая башня вашей фракции даёт +5% опыта и золота за победы. Враги не дремлют и будут пытаться её отбить.</p>`;
    if (mine) h += '<p class="good">Над башней реет ваше знамя.</p>';
    else h += `<p>Защитники: 2 воина [${TOWERS[id].lvl}] и комендант [${TOWERS[id].lvl + 1}].</p><div class="menu">${link('⚑ Штурмовать', 'assault', id, 'big')}</div>`;
    return h + back();
  };

  screens.towers = function () {
    let h = `<h1>Война за башни</h1><p>Бонус фракции: <b>+${Math.round(G.towerBonus(s) * 100)}%</b> к опыту и золоту.</p><table class="stats">`;
    for (const id in TOWERS) {
      const t = s.towers[id];
      h += `<tr><td>${TOWERS[id].name}<br><span class="dim small">${LOCATIONS[id].name}</span></td><td class="${FACTIONS[t.owner].color}">${FACTIONS[t.owner].name}</td></tr>`;
    }
    return h + '</table>' + back();
  };

  screens.dungeon = function () {
    const id = LOCATIONS[s.loc].dungeon;
    if (!id) { s.screen = 'loc'; return screens.loc(); }
    const dg = DUNGEONS[id];
    const wait = G.dungeonReady(s, id);
    let h = `<h1>${dg.name}</h1>
      <p class="desc">Цепочка из ${dg.rooms.length} схваток и босс — ${dg.boss.name} [${dg.boss.lvl}]. Внутри здоровье не восстанавливается, а сбежать удаётся лишь в половине случаев.</p>
      <p>Босс гарантированно оставляет редкую или лучшую вещь. Перезарядка: ${dg.cooldownMin} мин.</p>`;
    if (s.lvl < dg.minLvl) h += `<p class="bad">Нужен ${dg.minLvl} уровень.</p>`;
    else if (wait) h += `<p class="warn">Подземелье восстановится через ${mins(wait)}.</p>`;
    else h += `<div class="menu">${link('☠ Войти', 'dungeon', id, 'big')}</div>`;
    return h + back();
  };

  screens.log = function () {
    return `<h1>Журнал</h1><ul class="log">${s.log.map((l) => `<li><span class="dim">${new Date(l.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span> ${esc(l.text)}</li>`).join('')}</ul>` + back();
  };

  screens.settings = function () {
    return `<h1>Настройки</h1>
      <h2>Сохранение</h2>
      <p class="dim small">Игра сохраняется автоматически в этом браузере. Можно перенести героя через код сохранения.</p>
      <div class="menu">${link('Показать код сохранения', 'exportSave')}</div>
      <textarea id="save-box" rows="4" placeholder="Вставьте код сохранения"></textarea>
      <div class="menu">${link('Загрузить из кода', 'importSave')}</div>
      <h2>Опасная зона</h2>
      <div class="menu">${link('Удалить героя и начать заново', 'reset', undefined, 'danger')}</div>` + back();
  };

  // ---------- Действия ----------

  const actions = {
    screen(p) { s.screen = p; },
    go(p) { G.go(s, p); },
    hunt() { G.hunt(s); },
    again() { G.endFight(s); G.hunt(s); },
    act(p) { G.act(s, p); },
    next() { G.nextEnemy(s); },
    endFight() {
      const back = s.fight && s.fight.type === 'arena' ? 'arena' : null;
      G.endFight(s);
      if (back) s.screen = back;
    },
    item(p) { s.view = Number(p); s.screen = 'item'; },
    equip(p) { if (G.equip(s, p)) s.screen = 'bag'; },
    unequip(p) { if (G.unequip(s, p)) s.screen = 'char'; },
    sell(p) { if (G.sell(s, p)) s.screen = 'bag'; },
    sellJunk() { G.sellJunk(s); },
    potion(p) { if (G.usePotion(s, p)) G.flash(s, `Выпито: ${POTIONS[p].name}.`, 'good'); },
    buyPotion(p) { G.buyPotion(s, p, 1); },
    buyPotion5(p) { G.buyPotion(s, p, 5); },
    buyItem(p) { G.buyItem(s, p); },
    train(p) { G.trainStat(s, p); },
    upgrade(p) { G.upgrade(s, p); },
    takeQuest(p) { G.takeQuest(s, p); },
    claim(p) { G.claimQuest(s, p); },
    dropQuest(p) { G.dropQuest(s, p); },
    arena() { G.arena(s); },
    assault(p) { G.towerAssault(s, p); },
    dungeon(p) { G.enterDungeon(s, p); },
    exportSave() {
      const box = document.getElementById('save-box');
      box.value = btoa(unescape(encodeURIComponent(G.serialize(s))));
      box.select();
      return 'keep';
    },
    importSave() {
      const box = document.getElementById('save-box');
      try {
        const loaded = G.deserialize(decodeURIComponent(escape(atob(box.value.trim()))));
        if (!loaded) throw new Error('bad');
        s = loaded;
        G.flash(s, 'Герой загружен.', 'good');
        s.screen = 'loc';
      } catch (e) {
        alert('Не удалось прочитать код сохранения.');
        return 'keep';
      }
    },
    reset() {
      if (!confirm('Точно удалить героя? Это нельзя отменить.')) return 'keep';
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* хранилище недоступно */ }
      s = null;
    },
  };

  // ---------- Цикл ----------

  function save() {
    if (!s) return;
    try { localStorage.setItem(SAVE_KEY, G.serialize(s)); } catch (e) { /* хранилище недоступно */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? G.deserialize(raw) : null;
    } catch (e) { return null; }
  }

  function render() {
    if (!s) { $app.innerHTML = screens.create(); return; }
    if (s.fight) s.screen = 'fight';
    const scr = screens[s.screen] || screens.loc;
    const body = scr();
    $app.innerHTML = header() + flashes() + `<div class="screen">${body}</div>` + footer();
    window.scrollTo(0, 0);
  }

  function refreshHud() {
    if (!s) return;
    G.tick(s);
    const hud = document.getElementById('hud');
    if (hud) hud.outerHTML = header();
  }

  $app.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[data-a]');
    if (!a) return;
    ev.preventDefault();
    if (!s || a.classList.contains('off')) return;
    const fn = actions[a.dataset.a];
    if (!fn) return;
    G.tick(s);
    const res = fn(a.dataset.p);
    save();
    if (res !== 'keep') render();
  });

  $app.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'create-form') return;
    ev.preventDefault();
    const name = document.getElementById('hero-name').value.trim().slice(0, 16);
    const faction = (ev.target.querySelector('input[name=faction]:checked') || {}).value;
    if (!name || !FACTIONS[faction]) return;
    s = G.newState(name, faction);
    save();
    render();
  });

  s = load();
  if (s) G.tick(s);
  render();
  setInterval(() => { refreshHud(); save(); }, 1000);
})();
