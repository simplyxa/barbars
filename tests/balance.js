// Симуляция: бот играет как обычный игрок и показывает темп прокачки.
// Запуск: node tests/balance.js
require('../js/data.js');
const G = require('../js/game.js');
const { LOCATIONS, MONSTERS } = globalThis.DATA;

let t = 0;
const s = G.newState('Бот', 'north', t);
const order = ['forest', 'swamp', 'ruins', 'mountains', 'wastes'];
const path = { forest: ['forest'], swamp: ['forest', 'swamp'], ruins: ['forest', 'swamp', 'ruins'],
  mountains: ['forest', 'swamp', 'ruins', 'mountains'], wastes: ['forest', 'swamp', 'ruins', 'mountains', 'wastes'] };

function bestZone() {
  let z = 'forest';
  for (const id of order) if (LOCATIONS[id].minLvl <= s.lvl) z = id;
  return z;
}
function goTo(target) {
  s.loc = 'city';
  for (const step of path[target]) G.go(s, step);
}
function shopping() {
  s.loc = 'city';
  while (s.points) G.trainStat(s, ['str', 'vit', 'arm', 'vit'][s.points % 4]);
  for (const it of s.bag.slice()) {
    const cur = s.equip[it.slot];
    if (it.lvl <= s.lvl && (!cur || G.itemPower(it) > G.itemPower(cur))) G.equip(s, it.id);
  }
  G.sellJunk(s);
  for (const it of s.bag.slice()) G.sell(s, it.id);
  for (const o of G.shopOffer(s)) {
    const cur = s.equip[o.slot];
    if ((!cur || G.itemPower(o) > G.itemPower(cur) * 1.15) && s.gold > G.shopPrice(o) * 2) {
      G.buyItem(s, o.slot);
      G.equip(s, s.bag[s.bag.length - 1].id);
    }
  }
  if (s.potions.hp < 5 && s.gold > 200) G.buyPotion(s, 'hp', 5);
  const keys = ['str', 'vit', 'arm'];
  for (let i = 0; i < 30; i++) {
    const k = keys[i % 3];
    if (s.gold > G.statCost(s.stats[k]) * 3) G.trainStat(s, k);
  }
}

let fights = 0;
const report = [];
let lastLvl = 1;
while (s.lvl < 16 && fights < 20000) {
  shopping();
  goTo(bestZone());
  // Отдых до полного здоровья.
  const d = G.derived(s);
  const wait = ((d.maxHp - s.hp) / d.maxHp) * 150 * 1000;
  t += wait + 5000; G.tick(s, t);
  for (let i = 0; i < 10; i++) {
    if (s.hp < G.derived(s).maxHp * 0.4) break;
    G.hunt(s); fights++;
    while (!s.fight.result) {
      const dd = G.derived(s);
      if (s.hp < dd.maxHp * 0.35 && s.en >= G.COSTS.heal) G.act(s, 'heal');
      else if (s.hp < dd.maxHp * 0.25 && s.potions.hp) G.act(s, 'potion_hp');
      else if (s.en >= G.COSTS.power + G.COSTS.heal) G.act(s, 'power');
      else G.act(s, 'hit');
      t += 1500;
    }
    G.endFight(s);
    G.tick(s, t);
    if (s.loc === 'city') break;
  }
  if (s.lvl !== lastLvl) {
    lastLvl = s.lvl;
    report.push(`ур.${String(s.lvl).padStart(2)}  боёв: ${String(fights).padStart(5)}  время: ${String(Math.round(t / 60000)).padStart(4)} мин  смертей: ${s.record.deaths}  мощь: ${G.power(s)}  зона: ${bestZone()}`);
  }
}
console.log(report.join('\n'));
