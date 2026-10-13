/* 猜歌王 · 金币 / 每日挑战 / 盲盒 / 道具 / 宠物孵化
   ---------------------------------------------------------------
   纯逻辑模块：不碰 DOM、不碰网络，方便单独跑测试。
   数据存在账号资料里（UserAPI 的 patchSelf），换设备也在。

   金币来源：
     · 每日签到：5 金币；每连续签满一周 +1（第 7 天 6 个，第 14 天 7 个…）
     · 每日挑战答对：听声 +3 / 猜歌手 +5 / 看词 +10
   金币用途：
     · 答题道具（再来一次 / 去掉两个错项 / 看提示）
     · 抽盲盒（头像、称号）
     · 宠物皮肤、买经验加速孵化
   --------------------------------------------------------------- */
(function (root) {
  'use strict';

  /* ---------------- 宠物孵化（跟等级绑定） ---------------- */
  var PET_STAGES = [
    { min: 1, emoji: '🥚', name: '一颗蛋', note: '再升 2 级就裂壳' },
    { min: 3, emoji: '🐣', name: '裂壳了', note: '再升 3 级就孵出小鸡' },
    { min: 6, emoji: '🐤', name: '小鸡', note: '再升 4 级就长成半大' },
    { min: 10, emoji: '🐥', name: '半大鸡', note: '再升 5 级就长大' },
    { min: 15, emoji: '🐔', name: '戴耳机的大鸡', note: '已经长大了，戴上耳机继续猜' }
  ];

  function petOf(level) {
    level = Math.max(1, Math.floor(Number(level) || 1));
    var idx = 0;
    for (var i = 0; i < PET_STAGES.length; i++) if (level >= PET_STAGES[i].min) idx = i;
    var cur = PET_STAGES[idx];
    var next = PET_STAGES[idx + 1] || null;
    return {
      stage: idx,
      emoji: cur.emoji,
      name: cur.name,
      note: next ? ('再升 ' + (next.min - level) + ' 级就变「' + next.name + '」') : cur.note,
      nextAt: next ? next.min : null,
      grown: !next
    };
  }

  /* 宠物皮肤（抽盲盒或金币解锁） */
  var PET_SKINS = [
    { id: '', name: '原色' },
    { id: 'gold', name: '金色', cost: 60 },
    { id: 'star', name: '星空', cost: 80 }
  ];
  function skinOf(id) {
    for (var i = 0; i < PET_SKINS.length; i++) if (PET_SKINS[i].id === id) return PET_SKINS[i];
    return PET_SKINS[0];
  }

  /* ---------------- 金币 ---------------- */
  var CHECKIN_COINS = 5;              // 每日签到基础金币
  function checkinCoins(streak) {
    streak = Math.max(1, Math.floor(Number(streak) || 1));
    return CHECKIN_COINS + Math.floor(streak / 7);   // 每连续满一周 +1
  }

  /* ---------------- 每日挑战 ---------------- */
  var DAILY_SLOT_MS = 3 * 3600 * 1000;             // 3 小时一轮
  var DAILY_REFRESH_COINS = 15;                    // 花金币立刻刷新
  var DAILY_COINS = { sound: 3, singer: 5, lyric: 10 };
  var DAILY_PLAN = { sound: 5, singer: 3, lyric: 2 };   // 10 题：5 听声 + 3 猜歌手 + 2 看词

  function dailySlot(ts) { return Math.floor((ts || Date.now()) / DAILY_SLOT_MS); }
  function dailyNextAt(ts) { return (dailySlot(ts) + 1) * DAILY_SLOT_MS; }
  function dailyLeft(ts) { return Math.max(0, dailyNextAt(ts) - (ts || Date.now())); }

  /* 固定种子的伪随机（同一个 3 小时窗口，所有人的题目一样） */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shuffledWith(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 按固定的题型配比排出 10 题（顺序用种子打乱） */
  function dailyPlan(seed) {
    var out = [];
    Object.keys(DAILY_PLAN).forEach(function (k) {
      for (var i = 0; i < DAILY_PLAN[k]; i++) out.push(k);
    });
    return shuffledWith(out, rng(seed));
  }

  /* ---------------- 盲盒 ---------------- */
  var BOX_COST = 20;
  var BOX_REFUND = 8;               // 抽到重复的，退一点金币，别让人太亏

  var BOX_AVATARS = [
    { v: '🐶', r: 1 }, { v: '🐱', r: 1 }, { v: '🐼', r: 1 }, { v: '🐨', r: 1 },
    { v: '🦊', r: 1 }, { v: '🐷', r: 1 }, { v: '🐸', r: 1 }, { v: '🐵', r: 1 },
    { v: '🦁', r: 2 }, { v: '🐯', r: 2 }, { v: '🐺', r: 2 }, { v: '🦄', r: 2 },
    { v: '🐲', r: 2 }, { v: '🦅', r: 2 },
    { v: '👽', r: 3 }, { v: '🤖', r: 3 }, { v: '🎃', r: 3 }, { v: '🦖', r: 3 }
  ];
  var BOX_TITLES = [
    { v: '麦霸', r: 1 }, { v: 'K歌之王', r: 2 }, { v: '曲库王', r: 2 },
    { v: '副歌杀手', r: 1 }, { v: '前奏识别器', r: 1 }, { v: '歌词活字典', r: 2 },
    { v: '金曲猎人', r: 3 }, { v: '时光点唱机', r: 3 }
  ];
  var RARITY_NAME = { 1: '普通', 2: '稀有', 3: '传说' };

  /* 概率：普通 70% / 稀有 25% / 传说 5% */
  function rollRarity(rand) {
    var x = rand();
    if (x < 0.05) return 3;
    if (x < 0.30) return 2;
    return 1;
  }

  /* 抽一次。rand 可注入（测试用）。返回 {kind, value, rarity} */
  function openBox(rand) {
    rand = rand || Math.random;
    var r = rollRarity(rand);
    var pool = [];
    BOX_AVATARS.forEach(function (a) { if (a.r === r) pool.push({ kind: 'avatar', value: a.v, rarity: r }); });
    BOX_TITLES.forEach(function (t) { if (t.r === r) pool.push({ kind: 'title', value: t.v, rarity: r }); });
    if (!pool.length) pool.push({ kind: 'avatar', value: '🐱', rarity: 1 });
    return pool[Math.floor(rand() * pool.length) % pool.length];
  }

  /* ---------------- 道具 ---------------- */
  var ITEMS = {
    revive: { name: '再来一次', emoji: '💖', cost: 10, desc: '答错后可以再答一次' },
    hint2: { name: '去掉两个错项', emoji: '✂️', cost: 6, desc: '帮你去掉两个错误选项' },
    peek: { name: '看提示', emoji: '🔍', cost: 4, desc: '看词/猜歌手时，提示答案的第一个字' }
  };
  var ITEM_KEYS = Object.keys(ITEMS);

  /* ---------------- 加速孵化 ---------------- */
  var BOOST = { cost: 15, exp: 200, name: '买 200 经验' };

  var API = {
    // 宠物
    PET_STAGES: PET_STAGES,
    PET_SKINS: PET_SKINS,
    petOf: petOf,
    skinOf: skinOf,
    // 金币
    CHECKIN_COINS: CHECKIN_COINS,
    checkinCoins: checkinCoins,
    // 每日挑战
    DAILY_SLOT_MS: DAILY_SLOT_MS,
    DAILY_REFRESH_COINS: DAILY_REFRESH_COINS,
    DAILY_COINS: DAILY_COINS,
    DAILY_PLAN: DAILY_PLAN,
    dailySlot: dailySlot,
    dailyNextAt: dailyNextAt,
    dailyLeft: dailyLeft,
    dailyPlan: dailyPlan,
    rng: rng,
    shuffledWith: shuffledWith,
    // 盲盒
    BOX_COST: BOX_COST,
    BOX_REFUND: BOX_REFUND,
    BOX_AVATARS: BOX_AVATARS,
    BOX_TITLES: BOX_TITLES,
    RARITY_NAME: RARITY_NAME,
    openBox: openBox,
    // 道具
    ITEMS: ITEMS,
    ITEM_KEYS: ITEM_KEYS,
    // 加速
    BOOST: BOOST
  };

  root.Economy = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
