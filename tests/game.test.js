const test = require('node:test');
const assert = require('node:assert');
const DATA = require('../js/data.js');
const G = require('../js/game.js');

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function fresh(seed) {
  G.rng = seeded(seed || 1);
  return G.newState('Тест', 'north', 0);
}

test('новый герой: город, полное здоровье, стартовое снаряжение', () => {
  const s = fresh();
  const d = G.derived(s);
  assert.strictEqual(s.loc, 'city');
  assert.strictEqual(s.hp, d.maxHp);
  assert.strictEqual(s.en, d.maxEn);
  assert.ok(s.equip.weapon && s.equip.armor);
  assert.strictEqual(Object.keys(s.towers).length, Object.keys(DATA.TOWERS).length);
});

test('перемещение только по дорогам', () => {
  const s = fresh();
  assert.strictEqual(G.go(s, 'ruins'), false);
  assert.strictEqual(G.go(s, 'forest'), true);
  assert.strictEqual(s.loc, 'forest');
});

test('охота: бой заканчивается победой или поражением', () => {
  const s = fresh(7);
  G.go(s, 'forest');
  assert.ok(G.hunt(s));
  let guard = 200;
  while (!s.fight.result && guard--) G.act(s, 'hit');
  assert.ok(['win', 'lose'].includes(s.fight.result));
  G.endFight(s);
  assert.strictEqual(s.fight, null);
});

test('повышение уровня даёт очки и восстанавливает здоровье', () => {
  const s = fresh();
  s.hp = 1;
  G.gainExp(s, G.expNeed(1));
  assert.strictEqual(s.lvl, 2);
  assert.strictEqual(s.points, 3);
  assert.strictEqual(s.hp, G.derived(s).maxHp);
});

test('тренировка: сначала очки, потом золото', () => {
  const s = fresh();
  s.points = 1;
  G.trainStat(s, 'str');
  assert.strictEqual(s.stats.str, 6);
  assert.strictEqual(s.points, 0);
  const gold = s.gold;
  G.trainStat(s, 'str');
  assert.strictEqual(s.gold, gold - G.statCost(6));
});

test('нельзя надеть вещь выше своего уровня', () => {
  const s = fresh();
  const it = G.makeItem(s, 'helm', 5, 2);
  s.bag.push(it);
  assert.strictEqual(G.equip(s, it.id), false);
  s.lvl = 5;
  assert.strictEqual(G.equip(s, it.id), true);
  assert.strictEqual(s.equip.helm, it);
});

test('заточка увеличивает параметры предмета', () => {
  const s = fresh();
  G.rng = () => 0; // всегда успех
  s.gold = 10000;
  const before = G.itemStats(s.equip.weapon).dmg;
  G.upgrade(s, s.equip.weapon.id);
  assert.strictEqual(s.equip.weapon.plus, 1);
  assert.ok(G.itemStats(s.equip.weapon).dmg >= before);
});

test('задание засчитывает убийства и выдаёт награду', () => {
  const s = fresh(3);
  assert.ok(G.takeQuest(s, 'q_wolf'));
  s.quests.q_wolf.progress = 5;
  const gold = s.gold;
  assert.ok(G.claimQuest(s, 'q_wolf'));
  assert.strictEqual(s.gold, gold + 30);
  assert.ok(!s.quests.q_wolf);
});

test('штурм башни меняет владельца после победы над всеми защитниками', () => {
  const s = fresh(5);
  s.towers.swamp.owner = 'south';
  s.loc = 'swamp';
  s.stats.str = 200; s.stats.vit = 200;
  s.hp = G.derived(s).maxHp;
  assert.ok(G.towerAssault(s, 'swamp'));
  let guard = 500;
  while (!s.fight.result && guard--) {
    if (s.fight.between) G.nextEnemy(s); else G.act(s, 'hit');
  }
  assert.strictEqual(s.fight.result, 'win');
  assert.strictEqual(s.towers.swamp.owner, 'north');
  assert.ok(G.towerBonus(s) >= 0.05);
});

test('поражение: потеря золота и возврат в город', () => {
  const s = fresh(9);
  s.loc = 'wastes';
  s.gold = 100;
  G.startFight(s, 'hunt', [G.spawnMonster('demon', 20)]);
  let guard = 500;
  while (!s.fight.result && guard--) G.act(s, 'hit');
  assert.strictEqual(s.fight.result, 'lose');
  assert.strictEqual(s.gold, 90);
  G.endFight(s);
  assert.strictEqual(s.loc, 'city');
});

test('сохранение и загрузка', () => {
  const s = fresh();
  s.gold = 777;
  const loaded = G.deserialize(G.serialize(s));
  assert.strictEqual(loaded.gold, 777);
  assert.strictEqual(G.deserialize('{"v":0}'), null);
});

test('регенерация вне боя', () => {
  const s = fresh();
  s.hp = 1; s.lastTick = 0;
  G.tick(s, 30000);
  assert.ok(s.hp > 1);
});

test('манекен меняется от надетых вещей', () => {
  const Doll = require('../js/doll.js');
  const s = fresh();
  const base = Doll.render(s.equip, s.faction);
  const seen = new Set([base]);
  for (const slot of Object.keys(DATA.SLOTS)) {
    for (let tier = 0; tier < 6; tier++) {
      const equip = Object.assign({}, s.equip, { [slot]: { id: 99, slot, lvl: tier * 3 + 1, q: 2, plus: 0 } });
      const svg = Doll.render(equip, s.faction);
      assert.ok(!/undefined|NaN/.test(svg), `${slot} тир ${tier}`);
      seen.add(svg.replace(/doll\d+/g, ''));
    }
  }
  // Каждый слот и тир дают свой вид (кроме уже надетых стартовых вещей).
  assert.ok(seen.size >= 34);
  const glowing = Doll.render(Object.assign({}, s.equip, { weapon: Object.assign({}, s.equip.weapon, { plus: 7 }) }), s.faction);
  assert.ok(glowing.includes('drop-shadow'));
});
