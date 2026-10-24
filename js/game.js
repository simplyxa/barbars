// Игровая логика. Без DOM — работает и в браузере, и в Node (для тестов).
(function (root) {
  'use strict';

  const D = root.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const { FACTIONS, LOCATIONS, MONSTERS, DUNGEONS, TOWERS, SLOTS, QUALITIES, QUESTS,
    ENEMY_NAMES, ENEMY_TITLES, POTIONS, STATS } = D;

  const SAVE_VERSION = 1;
  const BAG_LIMIT = 20;
  const MAX_PLUS = 10;
  const COSTS = { power: 8, heal: 10 };

  const G = { rng: Math.random, BAG_LIMIT, MAX_PLUS, COSTS };

  const rnd = (a, b) => a + Math.floor(G.rng() * (b - a + 1));
  const chance = (p) => G.rng() < p;
  const pick = (arr) => arr[Math.floor(G.rng() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const vary = (v, spread) => v * (1 - spread + G.rng() * spread * 2);

  // ---------- Состояние ----------

  G.enemyFaction = (f) => (f === 'north' ? 'south' : 'north');

  G.newState = function (name, faction, now) {
    now = now || Date.now();
    const s = {
      v: SAVE_VERSION, name, faction, lvl: 1, exp: 0, gold: 60, glory: 0, points: 0,
      stats: { str: 5, vit: 5, ene: 5, arm: 5 },
      hp: 0, en: 0, loc: 'city', screen: 'loc', view: null,
      equip: { weapon: null, helm: null, armor: null, shield: null, boots: null, amulet: null },
      bag: [], nextId: 1, potions: { hp: 3, en: 2 },
      quests: {}, kills: {}, record: { monsters: 0, deaths: 0, arenaWin: 0, arenaLoss: 0, towers: 0, bosses: 0 },
      towers: {}, dungeonCd: {}, fight: null,
      log: [], flash: [], lastTick: now, towerAcc: 0, created: now,
    };
    for (const id in TOWERS) s.towers[id] = { owner: chance(0.5) ? 'north' : 'south' };
    s.equip.weapon = G.makeItem(s, 'weapon', 1, 0);
    s.equip.armor = G.makeItem(s, 'armor', 1, 0);
    const d = G.derived(s);
    s.hp = d.maxHp; s.en = d.maxEn;
    G.log(s, `${name} прибывает в ${FACTIONS[faction].city}. Слава ${FACTIONS[faction].dat}!`);
    return s;
  };

  G.log = function (s, text) {
    s.log.unshift({ t: Date.now(), text });
    if (s.log.length > 60) s.log.length = 60;
  };
  G.flash = function (s, text, cls) { s.flash.push({ text, cls: cls || '' }); };

  G.locName = (s, id) => (id === 'city' ? FACTIONS[s.faction].city : LOCATIONS[id].name);

  // ---------- Формулы ----------

  G.expNeed = (lvl) => Math.round(45 * Math.pow(lvl, 2.1));
  G.statCost = (v) => Math.round(2 * Math.pow(v, 1.6));
  G.reduction = (armor, attackerLvl) => clamp(armor / (armor + 40 + attackerLvl * 8), 0, 0.75);

  G.itemStats = function (it) {
    const q = QUALITIES[it.q].mult * (1 + 0.1 * it.plus);
    const L = it.lvl;
    const r = (x) => Math.round(x * q);
    switch (it.slot) {
      case 'weapon': return { dmg: r(2 + L * 2) };
      case 'helm':   return { arm: r(1 + L * 1), hp: r(L * 3) };
      case 'armor':  return { arm: r(1 + L * 1.5), hp: r(L * 5) };
      case 'shield': return { arm: r(1 + L * 1.3) };
      case 'boots':  return { hp: r(5 + L * 5) };
      case 'amulet': return { en: r(3 + L * 2), dmg: r(L * 0.5) };
    }
    return {};
  };

  G.itemPower = function (it) {
    const st = G.itemStats(it);
    return (st.dmg || 0) * 3 + (st.hp || 0) * 0.5 + (st.arm || 0) * 2 + (st.en || 0) * 0.3;
  };

  G.derived = function (s) {
    const gear = { dmg: 0, hp: 0, en: 0, arm: 0 };
    for (const slot in s.equip) {
      const it = s.equip[slot];
      if (!it) continue;
      const st = G.itemStats(it);
      for (const k in st) gear[k] += st[k];
    }
    return {
      dmg: Math.round(3 + s.stats.str * 1.5 + gear.dmg),
      maxHp: Math.round(50 + s.stats.vit * 10 + gear.hp),
      maxEn: Math.round(20 + s.stats.ene * 5 + gear.en),
      armor: Math.round(s.stats.arm * 2 + gear.arm),
    };
  };

  G.power = function (s) {
    const d = G.derived(s);
    return Math.round(d.dmg * 3 + d.maxHp * 0.5 + d.armor * 2 + d.maxEn * 0.3);
  };

  G.towerBonus = function (s) {
    let n = 0;
    for (const id in s.towers) if (s.towers[id].owner === s.faction) n++;
    return n * 0.05;
  };

  // ---------- Предметы ----------

  // Тир определяет и название, и внешний вид вещи на манекене.
  G.itemTier = (it) => Math.min(Math.floor((it.lvl - 1) / 3), SLOTS[it.slot].names.length - 1);
  G.itemName = (it) => SLOTS[it.slot].names[G.itemTier(it)];
  G.itemPrice = (it) => Math.round((it.lvl * 10 + 10) * Math.pow(QUALITIES[it.q].mult, 2) * (1 + 0.15 * it.plus));
  G.sellPrice = (it) => Math.round(G.itemPrice(it) * 0.3);
  G.upgradeCost = (it) => Math.round((it.lvl * 6 + 10) * QUALITIES[it.q].mult * (it.plus + 1));
  G.upgradeChance = (it) => Math.max(0.3, 1 - it.plus * 0.08);

  G.makeItem = function (s, slot, lvl, q) {
    return { id: s.nextId++, slot, lvl: Math.max(1, lvl), q, plus: 0 };
  };

  G.rollQuality = function (minQ, luck) {
    luck = luck || 1;
    const r = G.rng() / luck;
    let q = 0;
    if (r < 0.01) q = 4; else if (r < 0.04) q = 3; else if (r < 0.12) q = 2; else if (r < 0.35) q = 1;
    return Math.max(q, minQ || 0);
  };

  G.dropItem = function (s, lvl, minQ, luck) {
    const it = G.makeItem(s, pick(Object.keys(SLOTS)), lvl, G.rollQuality(minQ, luck));
    if (s.bag.length >= BAG_LIMIT) {
      const gold = G.sellPrice(it);
      s.gold += gold;
      G.flash(s, `Рюкзак полон! Добыча «${G.itemName(it)}» продана за ${gold} зол.`, 'warn');
      return null;
    }
    s.bag.push(it);
    return it;
  };

  G.findItem = function (s, id) {
    id = Number(id);
    const inBag = s.bag.find((i) => i.id === id);
    if (inBag) return { item: inBag, where: 'bag' };
    for (const slot in s.equip) if (s.equip[slot] && s.equip[slot].id === id) return { item: s.equip[slot], where: 'equip' };
    return null;
  };

  G.equip = function (s, id) {
    const f = G.findItem(s, id);
    if (!f || f.where !== 'bag') return false;
    const it = f.item;
    if (it.lvl > s.lvl) { G.flash(s, `Нужен ${it.lvl} уровень.`, 'bad'); return false; }
    s.bag = s.bag.filter((i) => i !== it);
    const old = s.equip[it.slot];
    if (old) s.bag.push(old);
    s.equip[it.slot] = it;
    G.clampVitals(s);
    G.flash(s, `Надето: ${G.itemName(it)}.`, 'good');
    return true;
  };

  G.unequip = function (s, slot) {
    const it = s.equip[slot];
    if (!it) return false;
    if (s.bag.length >= BAG_LIMIT) { G.flash(s, 'Рюкзак полон.', 'bad'); return false; }
    s.equip[slot] = null;
    s.bag.push(it);
    G.clampVitals(s);
    return true;
  };

  G.sell = function (s, id) {
    const f = G.findItem(s, id);
    if (!f || f.where !== 'bag') return false;
    const price = G.sellPrice(f.item);
    s.bag = s.bag.filter((i) => i !== f.item);
    s.gold += price;
    G.flash(s, `Продано за ${price} зол.`, 'good');
    return true;
  };

  G.sellJunk = function (s) {
    let total = 0, n = 0;
    s.bag = s.bag.filter((it) => {
      if (it.q === 0 && it.plus === 0) { total += G.sellPrice(it); n++; return false; }
      return true;
    });
    s.gold += total;
    G.flash(s, n ? `Продано обычных вещей: ${n}, получено ${total} зол.` : 'Нечего продавать.', n ? 'good' : '');
    return n;
  };

  G.shopOffer = function (s) {
    return Object.keys(SLOTS).map((slot) => ({ slot, lvl: s.lvl, q: s.lvl >= 5 ? 1 : 0, plus: 0 }));
  };
  G.shopPrice = (it) => Math.round(G.itemPrice(it) * 1.5);

  G.buyItem = function (s, slot) {
    const offer = G.shopOffer(s).find((o) => o.slot === slot);
    if (!offer) return false;
    const price = G.shopPrice(offer);
    if (s.gold < price) { G.flash(s, 'Не хватает золота.', 'bad'); return false; }
    if (s.bag.length >= BAG_LIMIT) { G.flash(s, 'Рюкзак полон.', 'bad'); return false; }
    s.gold -= price;
    const it = G.makeItem(s, slot, offer.lvl, offer.q);
    s.bag.push(it);
    G.flash(s, `Куплено: ${G.itemName(it)}.`, 'good');
    return true;
  };

  G.buyPotion = function (s, type, n) {
    n = n || 1;
    const p = POTIONS[type];
    if (!p) return false;
    if (s.gold < p.price * n) { G.flash(s, 'Не хватает золота.', 'bad'); return false; }
    s.gold -= p.price * n;
    s.potions[type] += n;
    G.flash(s, `Куплено: ${p.name} ×${n}.`, 'good');
    return true;
  };

  G.upgrade = function (s, id) {
    const f = G.findItem(s, id);
    if (!f) return false;
    const it = f.item;
    if (it.plus >= MAX_PLUS) { G.flash(s, 'Предмет уже заточен до предела.', 'bad'); return false; }
    const cost = G.upgradeCost(it);
    if (s.gold < cost) { G.flash(s, 'Не хватает золота.', 'bad'); return false; }
    s.gold -= cost;
    if (chance(G.upgradeChance(it))) {
      it.plus++;
      G.flash(s, `Удача! ${G.itemName(it)} теперь +${it.plus}.`, 'good');
      if (it.plus >= 7) G.log(s, `Кузнец заточил «${G.itemName(it)}» до +${it.plus}!`);
    } else {
      G.flash(s, 'Заточка не удалась. Золото потрачено.', 'bad');
    }
    G.clampVitals(s);
    return true;
  };

  // ---------- Тренер ----------

  G.trainStat = function (s, key) {
    if (!STATS[key]) return false;
    if (s.points > 0) {
      s.points--;
    } else {
      const cost = G.statCost(s.stats[key]);
      if (s.gold < cost) { G.flash(s, 'Не хватает золота.', 'bad'); return false; }
      s.gold -= cost;
    }
    s.stats[key]++;
    G.flash(s, `${STATS[key].name} повышена до ${s.stats[key]}.`, 'good');
    return true;
  };

  // ---------- Жизнь и регенерация ----------

  G.clampVitals = function (s) {
    const d = G.derived(s);
    s.hp = clamp(s.hp, 0, d.maxHp);
    s.en = clamp(s.en, 0, d.maxEn);
  };

  G.tick = function (s, now) {
    now = now || Date.now();
    const dt = Math.max(0, (now - s.lastTick) / 1000);
    s.lastTick = now;
    if (!s.fight) {
      const d = G.derived(s);
      s.hp = Math.min(d.maxHp, s.hp + dt * d.maxHp / 150);
      s.en = Math.min(d.maxEn, s.en + dt * d.maxEn / 100);
    }
    // Война за башни идёт и без игрока.
    s.towerAcc += Math.min(dt, 7200);
    while (s.towerAcc >= 60) {
      s.towerAcc -= 60;
      for (const id in s.towers) {
        const t = s.towers[id];
        if (t.owner === s.faction && chance(0.015)) {
          t.owner = G.enemyFaction(s.faction);
          G.log(s, `⚑ ${FACTIONS[t.owner].name} захватили ${TOWERS[id].name}!`);
        } else if (t.owner !== s.faction && chance(0.006)) {
          t.owner = s.faction;
          G.log(s, `⚑ Соратники отбили ${TOWERS[id].name}!`);
        }
      }
    }
  };

  G.usePotion = function (s, type) {
    if (!s.potions[type]) { G.flash(s, 'Зелий не осталось.', 'bad'); return false; }
    const d = G.derived(s);
    s.potions[type]--;
    if (type === 'hp') s.hp = Math.min(d.maxHp, s.hp + d.maxHp * 0.4);
    else s.en = Math.min(d.maxEn, s.en + d.maxEn * 0.5);
    return true;
  };

  // ---------- Перемещение ----------

  G.canGo = function (s, to) {
    const here = LOCATIONS[s.loc];
    return !s.fight && here.exits.includes(to);
  };

  G.go = function (s, to) {
    if (!G.canGo(s, to)) return false;
    if (LOCATIONS[to].minLvl > s.lvl + 1) {
      G.flash(s, `Туда опасно идти: рекомендуется ${LOCATIONS[to].minLvl} уровень.`, 'warn');
    }
    s.loc = to;
    s.screen = 'loc';
    return true;
  };

  // ---------- Противники ----------

  G.makeMonster = function (base, lvl, name) {
    const m = {
      name: name || base.name, lvl,
      maxHp: Math.round((35 + lvl * 30) * base.hp),
      dmg: Math.round((3 + lvl * 4) * base.dmg),
      armor: Math.round(lvl * 3 * base.arm),
    };
    m.hp = m.maxHp;
    const k = (base.hp + base.dmg + base.arm) / 3;
    m.exp = Math.round((10 + lvl * 8) * k);
    m.gold = Math.round((3 + lvl * 4) * k);
    return m;
  };

  G.spawnMonster = function (id, lvl) {
    const base = MONSTERS[id];
    const m = G.makeMonster(base, lvl || base.lvl + rnd(0, 1));
    m.id = id;
    return m;
  };

  G.makeWarrior = function (faction, lvl, mult) {
    mult = mult || 1;
    const name = `${pick(ENEMY_TITLES)} ${pick(ENEMY_NAMES[faction])}`;
    const m = G.makeMonster({ hp: 1.2 * mult, dmg: 1.1 * mult, arm: 1.2 * mult }, lvl, name);
    m.faction = faction;
    return m;
  };

  // Соперник на арене — подстраивается под силу игрока.
  G.makeArenaRival = function (s) {
    const d = G.derived(s);
    const f = G.enemyFaction(s.faction);
    const k = vary(0.9, 0.15);
    const lvl = Math.max(1, s.lvl + rnd(-1, 1));
    return {
      name: `${pick(ENEMY_TITLES)} ${pick(ENEMY_NAMES[f])}`, lvl, faction: f,
      maxHp: Math.round(d.maxHp * k), hp: Math.round(d.maxHp * k),
      dmg: Math.round(d.dmg * k), armor: Math.round(d.armor * k),
      exp: Math.round(15 + s.lvl * 10), gold: Math.round(5 + s.lvl * 5),
    };
  };

  // ---------- Бой ----------

  G.startFight = function (s, type, enemies, extra) {
    s.fight = Object.assign({ type, enemy: enemies[0], queue: enemies.slice(1), log: [], result: null, round: 0, loot: [] }, extra || {});
    s.screen = 'fight';
  };

  G.hunt = function (s) {
    const loc = LOCATIONS[s.loc];
    if (s.fight || !loc.monsters) return false;
    if (s.hp < 1) { G.flash(s, 'Вы слишком изранены. Отдохните.', 'bad'); return false; }
    const m = G.spawnMonster(pick(loc.monsters));
    G.startFight(s, 'hunt', [m]);
    s.fight.log.push(`Из засады выходит ${m.name} [${m.lvl}]!`);
    return true;
  };

  G.arena = function (s) {
    if (s.fight || s.loc !== 'city') return false;
    const d = G.derived(s);
    if (s.hp < d.maxHp * 0.5) { G.flash(s, 'На арену пускают только с половиной здоровья и больше.', 'bad'); return false; }
    const r = G.makeArenaRival(s);
    G.startFight(s, 'arena', [r]);
    s.fight.log.push(`На песок арены выходит ${r.name} [${r.lvl}], ${FACTIONS[r.faction].name}.`);
    return true;
  };

  G.towerAssault = function (s, id) {
    const t = s.towers[id];
    if (s.fight || !t || LOCATIONS[s.loc].tower !== id) return false;
    if (t.owner === s.faction) { G.flash(s, 'Башня и так ваша.', ''); return false; }
    const lvl = TOWERS[id].lvl;
    const guards = [G.makeWarrior(t.owner, lvl), G.makeWarrior(t.owner, lvl), G.makeWarrior(t.owner, lvl + 1, 1.15)];
    guards[2].name = 'Комендант ' + guards[2].name.split(' ').pop();
    G.startFight(s, 'tower', guards, { tower: id });
    s.fight.log.push(`Штурм начался! Башню защищают ${guards.length} воина.`);
    return true;
  };

  G.dungeonReady = function (s, id, now) {
    const cd = s.dungeonCd[id] || 0;
    return Math.max(0, cd - (now || Date.now()));
  };

  G.enterDungeon = function (s, id, now) {
    const dg = DUNGEONS[id];
    if (s.fight || !dg || LOCATIONS[s.loc].dungeon !== id) return false;
    if (s.lvl < dg.minLvl) { G.flash(s, `Нужен ${dg.minLvl} уровень.`, 'bad'); return false; }
    if (G.dungeonReady(s, id, now) > 0) { G.flash(s, 'Подземелье ещё не восстановилось.', 'bad'); return false; }
    const list = dg.rooms.map(([mid, lvl]) => G.spawnMonster(mid, lvl));
    const boss = G.makeMonster(dg.boss, dg.boss.lvl);
    boss.boss = true;
    list.push(boss);
    s.dungeonCd[id] = (now || Date.now()) + dg.cooldownMin * 60000;
    G.startFight(s, 'dungeon', list, { dungeon: id });
    s.fight.log.push(`Вы спускаетесь в ${dg.name}. Впереди ${list.length} противников. Здоровье здесь не восстанавливается!`);
    return true;
  };

  function roll(v) { return Math.max(1, Math.round(vary(v, 0.15))); }

  G.act = function (s, kind) {
    const f = s.fight;
    if (!f || f.result || f.between) return false;
    const d = G.derived(s);
    const e = f.enemy;
    const lines = [];
    f.round++;

    if (kind === 'hit' || kind === 'power') {
      if (kind === 'power') {
        if (s.en < COSTS.power) { G.flash(s, 'Не хватает энергии.', 'bad'); f.round--; return false; }
        s.en -= COSTS.power;
      }
      let dmg = roll(d.dmg) * (1 - G.reduction(e.armor, s.lvl));
      if (kind === 'power') dmg *= 2.2;
      const crit = chance(0.1);
      if (crit) dmg *= 1.8;
      dmg = Math.max(1, Math.round(dmg));
      e.hp -= dmg;
      lines.push(`${kind === 'power' ? 'Мощный удар' : 'Вы бьёте'}: −${dmg}${crit ? ' (крит!)' : ''}`);
    } else if (kind === 'heal') {
      if (s.en < COSTS.heal) { G.flash(s, 'Не хватает энергии.', 'bad'); f.round--; return false; }
      s.en -= COSTS.heal;
      const h = Math.round(d.maxHp * 0.35);
      s.hp = Math.min(d.maxHp, s.hp + h);
      lines.push(`Вы перевязываете раны: +${h}`);
    } else if (kind === 'potion_hp' || kind === 'potion_en') {
      const type = kind === 'potion_hp' ? 'hp' : 'en';
      if (!G.usePotion(s, type)) { f.round--; return false; }
      lines.push(`Вы пьёте ${POTIONS[type].name.toLowerCase()}.`);
    } else if (kind === 'flee') {
      if (f.type === 'dungeon' || f.type === 'tower') {
        if (chance(0.5)) return G.fleeSuccess(s);
      } else if (chance(0.65)) {
        return G.fleeSuccess(s);
      }
      lines.push('Сбежать не удалось!');
    } else {
      f.round--;
      return false;
    }

    if (e.hp <= 0) {
      e.hp = 0;
      f.log.unshift(...lines.reverse());
      return G.winRound(s);
    }

    if (chance(0.06)) {
      lines.push(`${e.name} промахивается.`);
    } else {
      let dmg = roll(e.dmg) * (1 - G.reduction(d.armor, e.lvl));
      const crit = chance(e.boss ? 0.15 : 0.07);
      if (crit) dmg *= 1.6;
      dmg = Math.max(1, Math.round(dmg));
      s.hp -= dmg;
      lines.push(`${e.name} бьёт: −${dmg}${crit ? ' (крит!)' : ''}`);
    }
    f.log.unshift(...lines.reverse());
    if (f.log.length > 30) f.log.length = 30;
    if (s.hp <= 0) return G.loseFight(s);
    return true;
  };

  G.fleeSuccess = function (s) {
    s.fight.result = 'fled';
    s.fight.log.unshift('Вы отступили.');
    return true;
  };

  G.gainExp = function (s, exp) {
    s.exp += exp;
    while (s.exp >= G.expNeed(s.lvl)) {
      s.exp -= G.expNeed(s.lvl);
      s.lvl++;
      s.points += 3;
      const d = G.derived(s);
      s.hp = d.maxHp; s.en = d.maxEn;
      G.flash(s, `★ Новый уровень: ${s.lvl}! Получено 3 очка параметров.`, 'good');
      G.log(s, `${s.name} достигает ${s.lvl} уровня!`);
    }
  };

  G.winRound = function (s) {
    const f = s.fight;
    const e = f.enemy;
    const bonus = 1 + G.towerBonus(s);
    const exp = Math.round(vary(e.exp, 0.1) * bonus);
    const gold = Math.round(vary(e.gold, 0.3) * bonus);
    f.log.unshift(`${e.name} повержен! +${exp} опыта, +${gold} зол.`);
    s.gold += gold;
    f.totalExp = (f.totalExp || 0) + exp;
    f.totalGold = (f.totalGold || 0) + gold;
    s.record.monsters++;
    if (e.id) {
      s.kills[e.id] = (s.kills[e.id] || 0) + 1;
      for (const qid in s.quests) {
        const q = QUESTS.find((x) => x.id === qid);
        if (q && q.target === e.id && s.quests[qid].progress < q.count) s.quests[qid].progress++;
      }
    }

    let loot = null;
    if (f.type === 'hunt' && chance(0.12)) loot = G.dropItem(s, e.lvl, 0);
    else if (f.type === 'dungeon' && e.boss) loot = G.dropItem(s, e.lvl, 2, 2);
    else if (f.type === 'dungeon' && chance(0.3)) loot = G.dropItem(s, e.lvl, 1);
    else if (f.type === 'tower' && f.queue.length === 0) loot = G.dropItem(s, e.lvl, 1, 1.5);
    if (loot) { f.loot.push(loot); f.log.unshift(`Добыча: ${G.itemName(loot)} (${QUALITIES[loot.q].name.toLowerCase()}).`); }
    if (f.type === 'hunt' && chance(0.08)) { s.potions.hp++; f.log.unshift('Найдено зелье здоровья.'); }

    if (f.type === 'arena') {
      const glory = 2 + Math.floor(s.lvl / 2);
      s.glory += glory;
      s.record.arenaWin++;
      f.log.unshift(`Толпа ликует! +${glory} славы.`);
    }

    G.gainExp(s, exp);

    if (f.queue.length) {
      f.between = true;
      return true;
    }
    if (f.type === 'tower') {
      s.towers[f.tower].owner = s.faction;
      s.record.towers++;
      s.glory += 5;
      G.log(s, `⚑ ${TOWERS[f.tower].name} захвачена! Герой штурма — ${s.name}.`);
      f.log.unshift(`${TOWERS[f.tower].name} захвачена! +5 славы. Все союзники получают бонус.`);
    }
    if (f.type === 'dungeon') {
      s.record.bosses++;
      G.log(s, `Пал ${e.name}! Герой — ${s.name}.`);
    }
    f.result = 'win';
    return true;
  };

  G.nextEnemy = function (s) {
    const f = s.fight;
    if (!f || !f.between) return false;
    f.between = false;
    f.enemy = f.queue.shift();
    f.log.unshift(`— Новый противник: ${f.enemy.name} [${f.enemy.lvl}] —`);
    return true;
  };

  G.loseFight = function (s) {
    const f = s.fight;
    s.hp = 0;
    f.result = 'lose';
    if (f.type === 'arena') {
      s.record.arenaLoss++;
      f.log.unshift('Вы проиграли поединок. Лекари арены вытаскивают вас с песка.');
      s.hp = 1;
      return true;
    }
    const lost = Math.floor(s.gold * 0.1);
    s.gold -= lost;
    s.record.deaths++;
    f.log.unshift(`Вы пали в бою. Потеряно ${lost} зол. Вас вынесли в город.`);
    s.hp = 1;
    return true;
  };

  G.endFight = function (s) {
    const f = s.fight;
    if (!f) return false;
    if (!f.result && !f.between) return false;
    // Выход из подземелья/штурма между боями — тоже отступление.
    if (f.result === 'lose' && f.type !== 'arena') s.loc = 'city';
    s.fight = null;
    s.screen = 'loc';
    G.clampVitals(s);
    return true;
  };

  // ---------- Задания ----------

  G.questsAvailable = (s) => QUESTS.filter((q) => q.minLvl <= s.lvl);

  G.takeQuest = function (s, id) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || s.quests[id] || q.minLvl > s.lvl) return false;
    if (Object.keys(s.quests).length >= 3) { G.flash(s, 'Можно держать не больше трёх заданий.', 'bad'); return false; }
    s.quests[id] = { progress: 0 };
    G.flash(s, `Задание принято: «${q.title}».`, 'good');
    return true;
  };

  G.claimQuest = function (s, id) {
    const q = QUESTS.find((x) => x.id === id);
    const st = s.quests[id];
    if (!q || !st || st.progress < q.count) return false;
    delete s.quests[id];
    s.gold += q.gold;
    G.flash(s, `Задание «${q.title}» выполнено! +${q.gold} зол., +${q.exp} опыта.`, 'good');
    G.gainExp(s, q.exp);
    return true;
  };

  G.dropQuest = function (s, id) {
    if (!s.quests[id]) return false;
    delete s.quests[id];
    return true;
  };

  // ---------- Сохранение ----------

  G.serialize = (s) => JSON.stringify(Object.assign({}, s, { flash: [] }));
  G.deserialize = function (json) {
    const s = JSON.parse(json);
    if (!s || s.v !== SAVE_VERSION || !FACTIONS[s.faction]) return null;
    s.flash = [];
    return s;
  };

  root.Game = G;
  if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
