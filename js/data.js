// Статические данные игры: фракции, локации, монстры, предметы, задания.
(function (root) {
  'use strict';

  const FACTIONS = {
    north: { name: 'Северяне', dat: 'Северянам', short: 'Север', city: 'Хольмгард', color: 'north',
      desc: 'Суровые воины фьордов. Топоры, меха и холодная ярость.' },
    south: { name: 'Степняки', dat: 'Степнякам', short: 'Степь', city: 'Кара-Тау', color: 'south',
      desc: 'Всадники бескрайних степей. Сабли, луки и горячая кровь.' },
  };

  // Карта мира. Город у каждой фракции свой (название берётся из FACTIONS).
  const LOCATIONS = {
    city: {
      name: null, minLvl: 1,
      desc: 'Стены столицы надёжно защищают от врагов. Здесь можно торговать, тренироваться и набирать задания.',
      exits: ['forest'], services: ['shop', 'trainer', 'smith', 'tavern', 'arena'],
    },
    forest: {
      name: 'Тёмный лес', minLvl: 1,
      desc: 'Под кронами вековых елей бродят волки и разбойники.',
      exits: ['city', 'swamp'], monsters: ['wolf', 'bandit', 'boar'],
    },
    swamp: {
      name: 'Гнилые топи', minLvl: 4,
      desc: 'Зловонная трясина. Из тумана доносится бульканье и чьё-то хриплое дыхание.',
      exits: ['forest', 'ruins'], monsters: ['leech', 'drowner', 'swampwitch'], tower: 'swamp',
    },
    ruins: {
      name: 'Древние руины', minLvl: 6,
      desc: 'Обломки забытой империи. Мертвецы здесь не спят.',
      exits: ['swamp', 'mountains'], monsters: ['skeleton', 'ghoul', 'cultist'], tower: 'ruins', dungeon: 'crypt',
    },
    mountains: {
      name: 'Ледяные горы', minLvl: 9,
      desc: 'Пронизывающий ветер и снежные бури. В пещерах живут тролли.',
      exits: ['ruins', 'wastes'], monsters: ['yeti', 'troll', 'harpy'], tower: 'mountains',
    },
    wastes: {
      name: 'Выжженные пустоши', minLvl: 12,
      desc: 'Земля, сожжённая драконьим пламенем. Дальше лежит лишь Чёрная цитадель.',
      exits: ['mountains'], monsters: ['salamander', 'demon', 'golem'], tower: 'wastes', dungeon: 'citadel',
    },
  };

  // kind: множители к базовым параметрам уровня.
  const MONSTERS = {
    wolf:       { name: 'Серый волк',        lvl: 1,  hp: 0.8, dmg: 1.0, arm: 0.5 },
    bandit:     { name: 'Лесной разбойник',  lvl: 2,  hp: 1.0, dmg: 1.0, arm: 1.0 },
    boar:       { name: 'Бешеный вепрь',     lvl: 3,  hp: 1.3, dmg: 0.9, arm: 1.2 },
    leech:      { name: 'Гигантская пиявка', lvl: 4,  hp: 0.9, dmg: 1.1, arm: 0.6 },
    drowner:    { name: 'Утопец',            lvl: 4,  hp: 1.1, dmg: 1.0, arm: 1.0 },
    swampwitch: { name: 'Болотная ведьма',   lvl: 5,  hp: 0.9, dmg: 1.3, arm: 0.8 },
    skeleton:   { name: 'Скелет-воин',       lvl: 6,  hp: 1.0, dmg: 1.0, arm: 1.3 },
    ghoul:      { name: 'Трупоед',           lvl: 7,  hp: 1.2, dmg: 1.0, arm: 0.9 },
    cultist:    { name: 'Тёмный культист',   lvl: 9,  hp: 0.9, dmg: 1.3, arm: 0.9 },
    yeti:       { name: 'Йети',              lvl: 9,  hp: 1.4, dmg: 0.9, arm: 1.0 },
    harpy:      { name: 'Гарпия',            lvl: 10, hp: 0.8, dmg: 1.3, arm: 0.7 },
    troll:      { name: 'Горный тролль',     lvl: 12, hp: 1.5, dmg: 1.1, arm: 1.3 },
    salamander: { name: 'Огненная саламандра', lvl: 12, hp: 1.0, dmg: 1.2, arm: 1.0 },
    golem:      { name: 'Обсидиановый голем', lvl: 14, hp: 1.6, dmg: 1.0, arm: 1.6 },
    demon:      { name: 'Демон пепла',       lvl: 15, hp: 1.2, dmg: 1.3, arm: 1.1 },
  };

  const DUNGEONS = {
    crypt: {
      name: 'Склеп Забытого Короля', minLvl: 7, cooldownMin: 20,
      rooms: [['skeleton', 7], ['ghoul', 8], ['cultist', 8], ['skeleton', 9]],
      boss: { name: 'Король-лич', lvl: 10, hp: 3.0, dmg: 1.3, arm: 1.5 },
    },
    citadel: {
      name: 'Чёрная цитадель', minLvl: 14, cooldownMin: 30,
      rooms: [['demon', 14], ['golem', 15], ['salamander', 15], ['demon', 16]],
      boss: { name: 'Пепельный дракон', lvl: 18, hp: 3.5, dmg: 1.4, arm: 1.6 },
    },
  };

  const TOWERS = {
    swamp:     { name: 'Башня Топей',    lvl: 5 },
    ruins:     { name: 'Башня Руин',     lvl: 8 },
    mountains: { name: 'Башня Перевала', lvl: 11 },
    wastes:    { name: 'Башня Пепла',    lvl: 14 },
  };

  const SLOTS = {
    weapon: { name: 'Оружие',  names: ['Ржавый тесак', 'Боевой топор', 'Тяжёлая секира', 'Двуручный меч', 'Рунный клинок', 'Молот ярости'] },
    helm:   { name: 'Шлем',    names: ['Кожаный колпак', 'Железный шлем', 'Рогатый шлем', 'Шлем витязя', 'Рунный шлем', 'Корона ярла'] },
    armor:  { name: 'Доспех',  names: ['Стёганка', 'Кольчуга', 'Чешуйчатый доспех', 'Латы', 'Рунный доспех', 'Доспех дракона'] },
    shield: { name: 'Щит',     names: ['Деревянный щит', 'Окованный щит', 'Круглый щит', 'Башенный щит', 'Рунный щит', 'Эгида'] },
    boots:  { name: 'Сапоги',  names: ['Обмотки', 'Кожаные сапоги', 'Сапоги следопыта', 'Латные сапоги', 'Рунные сапоги', 'Поступь бури'] },
    amulet: { name: 'Амулет',  names: ['Клык на шнурке', 'Медный оберег', 'Серебряный амулет', 'Амулет шамана', 'Рунный амулет', 'Сердце бури'] },
  };

  const QUALITIES = [
    { id: 0, name: 'Обычный',     mult: 1.0, cls: 'q0' },
    { id: 1, name: 'Хороший',     mult: 1.3, cls: 'q1' },
    { id: 2, name: 'Редкий',      mult: 1.7, cls: 'q2' },
    { id: 3, name: 'Эпический',   mult: 2.2, cls: 'q3' },
    { id: 4, name: 'Легендарный', mult: 3.0, cls: 'q4' },
  ];

  const QUESTS = [
    { id: 'q_wolf',     title: 'Волчья напасть',     target: 'wolf',       count: 5, minLvl: 1,  gold: 30,  exp: 120 },
    { id: 'q_bandit',   title: 'Лесные разбойники',  target: 'bandit',     count: 5, minLvl: 2,  gold: 50,  exp: 200 },
    { id: 'q_drowner',  title: 'Тишина в топях',     target: 'drowner',    count: 6, minLvl: 4,  gold: 90,  exp: 450 },
    { id: 'q_witch',    title: 'Ведьмина охота',     target: 'swampwitch', count: 3, minLvl: 5,  gold: 140, exp: 700 },
    { id: 'q_skeleton', title: 'Упокоить мёртвых',   target: 'skeleton',   count: 8, minLvl: 6,  gold: 180, exp: 900 },
    { id: 'q_cultist',  title: 'Культ тьмы',         target: 'cultist',    count: 5, minLvl: 9,  gold: 260, exp: 1500 },
    { id: 'q_troll',    title: 'Тролли перевала',    target: 'troll',      count: 5, minLvl: 12, gold: 420, exp: 3000 },
    { id: 'q_demon',    title: 'Изгнание демонов',   target: 'demon',      count: 6, minLvl: 15, gold: 650, exp: 5000 },
  ];

  const ENEMY_NAMES = {
    north: ['Бьорн', 'Торвальд', 'Сигурд', 'Ульф', 'Рагнар', 'Хальвдан', 'Ингвар', 'Эйрик', 'Гуннар', 'Асгейр'],
    south: ['Тимур', 'Батыр', 'Кайрат', 'Арслан', 'Ерлан', 'Кутлуг', 'Таргын', 'Алпамыс', 'Жанибек', 'Мерген'],
  };
  const ENEMY_TITLES = ['Свирепый', 'Хмурый', 'Быстрый', 'Кровавый', 'Безжалостный', 'Одноглазый', 'Стальной', 'Бешеный'];

  const POTIONS = {
    hp: { name: 'Зелье здоровья', price: 15, desc: 'Восстанавливает 40% здоровья' },
    en: { name: 'Зелье энергии',  price: 12, desc: 'Восстанавливает 50% энергии' },
  };

  const STATS = {
    str: { name: 'Сила',      desc: '+1.5 к урону' },
    vit: { name: 'Живучесть', desc: '+10 к здоровью' },
    ene: { name: 'Энергия',   desc: '+5 к энергии' },
    arm: { name: 'Броня',     desc: '+2 к броне' },
  };

  root.DATA = { FACTIONS, LOCATIONS, MONSTERS, DUNGEONS, TOWERS, SLOTS, QUALITIES, QUESTS,
    ENEMY_NAMES, ENEMY_TITLES, POTIONS, STATS };
  if (typeof module !== 'undefined') module.exports = root.DATA;
})(typeof window !== 'undefined' ? window : globalThis);
