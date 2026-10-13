/* 猜歌王 · 等级 / 经验
   ---------------------------------------------------------------
   设计要点：
   1) 经验(exp) 与 得分(score) 是两套独立的东西。
      得分可以一键清零，经验永远不会清零。
   2) 经验与得分正相关：一局得分越高、答对越多，拿到的经验越多。
   3) 等级越高，升下一级要的经验越多：
        第 N 级 -> 第 N+1 级 需要  100 + (N-1)*80  点
        （1->2:100  2->3:180  3->4:260  4->5:340 ……）
   4) 纯函数模块，不碰 DOM、不碰网络 —— 方便单独跑测试。
   --------------------------------------------------------------- */
(function (root) {
  'use strict';

  var MAX_LEVEL = 999;

  /* 第 lv 级升到 lv+1 级所需的经验 */
  function needFor(lv) {
    if (lv < 1) lv = 1;
    return 100 + (lv - 1) * 80;
  }

  /* 从 1 级升到 lv 级，总共累计需要多少经验 */
  function totalToReach(lv) {
    var s = 0;
    for (var i = 1; i < lv; i++) s += needFor(i);
    return s;
  }

  /* 总经验 -> 等级信息 */
  function fromExp(exp) {
    exp = Math.floor(Number(exp) || 0);
    if (exp < 0) exp = 0;
    var lv = 1, rest = exp;
    while (rest >= needFor(lv) && lv < MAX_LEVEL) {
      rest -= needFor(lv);
      lv++;
    }
    var need = needFor(lv);
    return {
      exp: exp,
      level: lv,
      cur: rest,                                  // 当前等级内已有经验
      need: need,                                 // 升下一级还需要的经验
      pct: Math.max(0, Math.min(100, Math.round(rest / need * 100))),
      title: titleOf(lv)
    };
  }

  /* 段位称号（纯展示） */
  var TITLES = [
    [1, '乐盲'], [4, '路人'], [7, '听众'], [11, '歌迷'],
    [16, '麦霸'], [22, '曲库'], [30, '歌王'], [40, '传说']
  ];
  function titleOf(lv) {
    var t = TITLES[0][1];
    for (var i = 0; i < TITLES.length; i++) if (lv >= TITLES[i][0]) t = TITLES[i][1];
    return t;
  }

  /* ---------- 经验获取 ----------
     kind:
       'solo'   单机 / 无限模式答题
       'take'   答别人出的题（额外加成）
       'multi'  多人对战（额外加成，MVP 再加）
       'checkin' 每日签到
     参数 o = { score, right, total, mvp }
  --------------------------------------------------------------- */
  function gainFrom(o) {
    o = o || {};
    var score = Math.max(0, Number(o.score) || 0);
    var right = Math.max(0, Number(o.right) || 0);

    // 基础：得分 + 每答对一题 2 点（与得分正比例相关）
    var base = Math.round(score) + right * 2;

    if (o.kind === 'take') base = Math.round(base * 1.5) + 10;          // 答别人的题：加成
    else if (o.kind === 'multi') base = Math.round(base * 1.2) + (o.mvp ? 30 : 0); // 对战加成

    return Math.max(1, Math.min(2000, base));   // 保底 1 点，单局封顶 2000
  }

  /* 每日签到：连续天数越多给越多，第 7 天起封顶 50 */
  function checkinGain(streak) {
    streak = Math.max(1, Number(streak) || 1);
    return 20 + Math.min(streak - 1, 6) * 5;
  }

  /* 本地日期键（按用户本机时区），格式 YYYY-MM-DD */
  function dayKey(ts) {
    var d = ts ? new Date(ts) : new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /* 判断今天能不能签到；返回连续天数（已签过返回 0） */
  function nextStreak(checkin) {
    var today = dayKey();
    var last = (checkin && checkin.last) || '';
    if (last === today) return 0;                 // 今天已经签过了
    var y = dayKey(Date.now() - 86400000);
    var prev = (checkin && checkin.streak) || 0;
    return (last === y) ? prev + 1 : 1;           // 昨天签过就续上，否则从头
  }

  var API = {
    needFor: needFor,
    totalToReach: totalToReach,
    fromExp: fromExp,
    titleOf: titleOf,
    gainFrom: gainFrom,
    checkinGain: checkinGain,
    dayKey: dayKey,
    nextStreak: nextStreak
  };

  root.Level = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
