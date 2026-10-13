/* 猜歌王 · 账号 / 资料 / 好友 / 私信 / 成绩（MQTT）
   ---------------------------------------------------------------
   轻量实现：数据存在公开的 MQTT 频道上（retained）。账号名就是「钥匙」。
   不是安全系统 —— 密码只做简单哈希，别用重要密码。

   频道：
     gs2/u/{账号}                     账号资料 {name, nick, hash, avatar, createdAt}
     gs2/fr/{账号}                    收到的好友申请 [{from, at}]
     gs2/fl/{账号}                    好友列表 [{name, since}]
     gs2/bl/{账号}                    黑名单 [{name, at}]
     gs2/dm/{账号}/{对方}/{ts}        私信
     gs2/sc/{账号}                    最近答题成绩 [{code, author, score, right, total, at}]

   读取策略：订阅后「一有数据就返回」，最多等 6 秒。
   不用固定 sleep —— 公共服务的响应时间不稳定，固定等待会随机读空。
   --------------------------------------------------------------- */
window.UserAPI = (function () {
  'use strict';

  var BROKER = 'wss://broker.emqx.io:8084/mqtt';
  var NS = 'gs2';
  var NAME_KEY = 'gs_user_name';
  var ID_KEY = 'gs_room_id';
  var MAX_SCORES = 30;
  var MAX_DM = 80;
  var WAIT_MS = 6000;

  var client = null;
  var cache = {};          // topic -> payload
  var listeners = [];      // [{re, fn}]
  var subscribed = {};     // 已经订阅过的主题（避免重复订阅 → 服务端重推历史 → 死循环）
  var desired = {};        // 断线重连后要恢复订阅的主题

  /* ---------------- 基础 ---------------- */
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function enc(s) { return encodeURIComponent(String(s)); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function tU(n) { return NS + '/u/' + enc(n); }
  function tFR(n) { return NS + '/fr/' + enc(n); }
  function tFL(n) { return NS + '/fl/' + enc(n); }
  function tBL(n) { return NS + '/bl/' + enc(n); }
  function tSC(n) { return NS + '/sc/' + enc(n); }
  function tDMpre(n, peer) { return NS + '/dm/' + enc(n) + '/' + enc(peer) + '/'; }
  function tDM(n, peer, ts) { return tDMpre(n, peer) + ts; }

  function later(fn) { setTimeout(fn, 25); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function myPid() {
    var v = null;
    try { v = localStorage.getItem(ID_KEY); } catch (e) {}
    if (!v) { v = 'p' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem(ID_KEY, v); } catch (e) {} }
    return v;
  }
  function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }
  function loggedOut() { try { localStorage.removeItem(NAME_KEY); } catch (e) {} }

  /* ---------------- 连接 ---------------- */
  function connect(cb) {
    if (client && client.connected) return cb(null);
    if (typeof mqtt === 'undefined') return cb('消息库没加载出来，刷新页面重试');
    if (client) { try { client.end(true); } catch (e) {} client = null; }

    client = mqtt.connect(BROKER, {
      clientId: 'gs_u_' + Math.random().toString(16).slice(2, 12),
      connectTimeout: 15000, reconnectPeriod: 3000, clean: true
    });

    var settled = false;
    var timer = setTimeout(function () { if (!settled) { settled = true; cb('连接超时，检查网络'); } }, 16000);
    client.on('connect', function () {
      // 断线重连后把订阅恢复回来（clean session 会丢订阅）
      var all = Object.keys(desired);
      if (all.length) client.subscribe(all, { qos: 1 }, function () {});
      if (!settled) { settled = true; clearTimeout(timer); cb(null); }
    });
    client.on('error', function () {});

    client.on('message', function (topic, payload) {
      var data;
      try { data = JSON.parse(payload.toString()); } catch (e) { return; }
      cache[topic] = data;
      for (var i = 0; i < listeners.length; i++) {
        if (listeners[i].re.test(topic)) { try { listeners[i].fn(topic, data); } catch (e) {} }
      }
    });
  }

  function pub(topic, obj, cb) {
    connect(function (err) {
      if (err) return cb && cb(err);
      client.publish(topic, JSON.stringify(obj), { qos: 1, retain: true });
      later(function () { cb && cb(null); });
    });
  }

  /* 主题匹配（支持 + 通配） */
  function topicMatches(pattern, topic) {
    if (pattern === topic) return true;
    if (pattern.indexOf('+') < 0) return false;
    var pp = pattern.split('/'), tp = topic.split('/');
    if (pp.length !== tp.length) return false;
    for (var i = 0; i < pp.length; i++) {
      if (pp[i] === '+') continue;
      if (pp[i] !== tp[i]) return false;
    }
    return true;
  }

  /* 缓存里有没有「匹配这个模式」的数据（模式可能是通配的，不能只按字面 key 查） */
  function hasData(pattern) {
    if (cache[pattern] !== undefined) return true;
    for (var k in cache) { if (topicMatches(pattern, k)) return true; }
    return false;
  }

  /* 只订阅一次：重复订阅会让服务端重推 retained 历史，进而触发「收到消息→刷新→再订阅」死循环 */
  function ensureSub(topics, cb) {
    connect(function (err) {
      if (err) return cb(err);
      var list = (Array.isArray(topics) ? topics : [topics]);
      list.forEach(function (t) { desired[t] = 1; });
      var todo = list.filter(function (t) { return !subscribed[t]; });
      if (!todo.length) return cb(null);
      client.subscribe(todo, { qos: 1 }, function () {
        todo.forEach(function (t) { subscribed[t] = 1; });
        cb(null);
      });
    });
  }

  /* 订阅后等「指定主题」到达；到了立刻返回，最多等 ms 毫秒 */
  function waitTopics(topics, ms, cb) {
    var list = Array.isArray(topics) ? topics : [topics];
    var deadline = Date.now() + (ms || WAIT_MS);
    ensureSub(list, function (err) {
      if (err) return cb(err);
      var check = function () {
        var missing = 0;
        for (var i = 0; i < list.length; i++) if (!hasData(list[i])) missing++;
        if (!missing) return cb(null, true);
        if (Date.now() > deadline) return cb(null, false);
        setTimeout(check, 120);
      };
      check();
    });
  }

  /* 只要有一个主题到了就返回（用于私信这种「可能为空」的读取） */
  function waitAny(topics, ms, cb) {
    var list = Array.isArray(topics) ? topics : [topics];
    var deadline = Date.now() + (ms || 2200);
    ensureSub(list, function (err) {
      if (err) return cb(err);
      var check = function () {
        for (var i = 0; i < list.length; i++) if (hasData(list[i])) return cb(null, true);
        if (Date.now() > deadline) return cb(null, false);
        setTimeout(check, 120);
      };
      check();
    });
  }

  function sub(topic, cb) {
    ensureSub(topic, function (err) { if (err) return cb && cb(err); later(function () { cb && cb(null); }); });
  }

  /* 订阅自己的所有频道，登录后调用 */
  function watchSelf(name, onChange) {
    if (onChange) {
      listeners = listeners.filter(function (l) { return l.tag !== 'self'; });
      var re = new RegExp('^' + NS + '/(fr|fl|bl|dm|sc)/' + reEsc(enc(name)));
      listeners.push({ tag: 'self', re: re, fn: function () { onChange(); } });
    }
    return sub([tFR(name), tFL(name), tBL(name), tSC(name), tDMpre(name, '+') + '+'], function () {});
  }

  /* 确保自己的「空列表」频道存在（retained），这样读取不用等超时 */
  function ensureSelf(name, cb) {
    var topics = [tFR(name), tFL(name), tBL(name), tSC(name)];
    ensureSub(topics, function (err) {
      if (err) return cb && cb(err);
      setTimeout(function () {
        topics.forEach(function (t) {
          if (cache[t] === undefined) client.publish(t, '[]', { qos: 1, retain: true });
        });
        later(function () { cb && cb(null); });
      }, 500);
    });
  }

  /* 记录"今天拿了多少经验"（跨天自动归零，只用于展示） */
  function addToday(rec, amount) {
    var L = window.Level;
    var day = L ? L.dayKey() : '';
    if (!rec.expToday || rec.expToday.day !== day) rec.expToday = { day: day, amount: 0 };
    rec.expToday.amount = Math.floor(Number(rec.expToday.amount) || 0) + amount;
    return rec.expToday.amount;
  }

  /* 资料改动串行队列：
     两次改动如果并行（比如连着打两局，两次加经验几乎同时发生），
     后一次会基于前一次写回前的旧资料计算，把前一次的经验覆盖掉 —— 表现为"经验丢了"。
     这里排队执行，保证每次都基于最新资料。 */
  var patchQueue = [], patchBusy = false;

  function patchSelf(fn, cb) {
    patchQueue.push({ fn: fn, cb: cb });
    runPatchQueue();
  }

  function runPatchQueue() {
    if (patchBusy) return;
    var item = patchQueue.shift();
    if (!item) return;
    patchBusy = true;
    doPatch(item.fn, function (err, rec, out) {
      patchBusy = false;
      try { item.cb && item.cb(err, rec, out); } catch (e) {}
      later(runPatchQueue);
    });
  }

  /* 真正的「读出 -> 改动 -> 写回」 */
  function doPatch(fn, cb) {
    var me = savedName();
    if (!me) return cb && cb('还没登录');
    waitTopics(tU(me), WAIT_MS, function (err) {
      if (err) return cb && cb(err);
      var rec = cache[tU(me)];
      if (!rec) return cb && cb('账号资料没读到，稍后再试');
      var out;
      try { out = fn(rec) || {}; } catch (e) { return cb && cb('资料更新失败'); }
      if (out && out.fail) return cb && cb(out.fail, clone(rec), out);
      if (!(Number(rec.exp) >= 0)) rec.exp = 0;
      rec.updatedAt = Date.now();
      client.publish(tU(me), JSON.stringify(rec), { qos: 1, retain: true });
      later(function () { cb && cb(null, clone(rec), out); });
    });
  }

  /* ---------------- 对外 ---------------- */
  return {
    backend: 'mqtt',
    savedName: savedName,
    saveName: saveName,
    loggedOut: loggedOut,
    myPid: myPid,

    /* ===== 账号 ===== */
    register: function (name, pwd, cb) {
      name = String(name || '').trim();
      connect(function (err) {
        if (err) return cb(err);
        // 只等一小会儿：查重不需要等满（等太久新用户注册会很慢）
        waitTopics(tU(name), 1800, function () {
          if (cache[tU(name)]) return cb('这个账号名已经被注册了，换一个，或者直接登录');
          var rec = {
            name: name, nick: name, hash: hash(name + '::' + pwd),
            avatar: '🐱', createdAt: Date.now(),
            exp: 0,                                  // 经验：永不清零
            coins: 0,                                // 金币
            checkin: { last: '', streak: 0 },        // 每日签到 { 上次日期, 连续天数 }
            items: {},                               // 道具背包
            own: { avatars: [], titles: [], skins: [] },  // 盲盒抽到的东西
            daily: {},                               // 每日挑战记录
            title: ''                                // 佩戴的称号
          };
          client.publish(tU(name), JSON.stringify(rec), { qos: 1, retain: true });
          saveName(name);
          ensureSelf(name, function () { cb(null, rec); });
        });
      });
    },

    login: function (name, pwd, cb) {
      name = String(name || '').trim();
      waitTopics(tU(name), WAIT_MS, function (err) {
        if (err) return cb(err);
        var rec = cache[tU(name)];
        if (!rec) return cb('没有这个账号，先注册一个吧');
        if (rec.hash !== hash(name + '::' + pwd)) return cb('密码不对');
        saveName(name);
        ensureSelf(name, function () { cb(null, rec); });
      });
    },

    getProfile: function (name, cb) {
      waitTopics(tU(name), WAIT_MS, function (err) {
        if (err) return cb(err);
        var rec = cache[tU(name)];
        if (!rec) return cb('没找到这个用户');
        cb(null, rec);
      });
    },

    /* 改昵称 / 换头像（账号名不可改） */
    updateProfile: function (patch, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      waitTopics(tU(me), WAIT_MS, function (err) {
        if (err) return cb(err);
        var rec = cache[tU(me)];
        if (!rec) return cb('账号资料没读到，稍后再试');
        if (patch.nick !== undefined) rec.nick = String(patch.nick).slice(0, 12) || me;
        if (patch.avatar !== undefined) rec.avatar = String(patch.avatar).slice(0, 4);
        rec.updatedAt = Date.now();
        client.publish(tU(me), JSON.stringify(rec), { qos: 1, retain: true });
        later(function () { cb(null, clone(rec)); });
      });
    },

    /* ===== 经验 / 等级 / 签到 ===== */

    /* 通用：读出自己的资料 -> 改动 -> 写回（保证不丢字段） */
    patchSelf: patchSelf,

    /* 加经验。amount<=0 直接返回。回调 (err, rec, {before, after, gained, reason}) */
    addExp: function (amount, reason, cb) {
      amount = Math.floor(Number(amount) || 0);
      if (amount <= 0) return later(function () { cb && cb(null, null, { gained: 0 }); });
      patchSelf(function (rec) {
        var before = Math.floor(Number(rec.exp) || 0);
        var after = before + amount;
        rec.exp = after;
        addToday(rec, amount);
        return { before: before, after: after, gained: amount, reason: String(reason || '') };
      }, cb);
    },

    /* 每日签到。回调 (err, rec, {already, streak, gained, coins}) */
    doCheckin: function (cb) {
      var L = window.Level, E = window.Economy;
      if (!L) return cb && cb('等级模块没加载，刷新页面试试');
      patchSelf(function (rec) {
        var ci = rec.checkin || { last: '', streak: 0 };
        var s = L.nextStreak(ci);
        if (!s) return { already: true, streak: ci.streak || 0, gained: 0, coins: 0 };
        var gain = L.checkinGain(s);
        var coins = E ? E.checkinCoins(s) : 5;
        ci.last = L.dayKey();
        ci.streak = s;
        rec.checkin = ci;
        rec.exp = Math.floor(Number(rec.exp) || 0) + gain;
        rec.coins = Math.floor(Number(rec.coins) || 0) + coins;
        addToday(rec, gain);
        return { already: false, streak: s, gained: gain, coins: coins, exp: rec.exp, totalCoins: rec.coins };
      }, cb);
    },

    /* ===== 金币 / 道具 / 盲盒 / 每日挑战 ===== */

    /* 加减金币。回调 (err, rec, {before, after, gained}) */
    addCoins: function (amount, reason, cb) {
      amount = Math.floor(Number(amount) || 0);
      if (!amount) return later(function () { cb && cb(null, null, { gained: 0 }); });
      patchSelf(function (rec) {
        var before = Math.floor(Number(rec.coins) || 0);
        rec.coins = Math.max(0, before + amount);
        return { before: before, after: rec.coins, gained: amount, reason: String(reason || '') };
      }, cb);
    },

    /* 买道具 */
    buyItem: function (key, cb) {
      var E = window.Economy;
      var it = E && E.ITEMS[key];
      if (!it) return cb && cb('没有这个道具');
      patchSelf(function (rec) {
        var coins = Math.floor(Number(rec.coins) || 0);
        if (coins < it.cost) return { fail: '金币不够（还差 ' + (it.cost - coins) + ' 个）' };
        rec.coins = coins - it.cost;
        rec.items = rec.items || {};
        rec.items[key] = Math.floor(Number(rec.items[key]) || 0) + 1;
        return { bought: key, cost: it.cost, count: rec.items[key], coins: rec.coins };
      }, cb);
    },

    /* 用掉一个道具 */
    useItem: function (key, cb) {
      patchSelf(function (rec) {
        rec.items = rec.items || {};
        var n = Math.floor(Number(rec.items[key]) || 0);
        if (n <= 0) return { fail: '这个道具用完了' };
        rec.items[key] = n - 1;
        return { used: key, left: rec.items[key] };
      }, cb);
    },

    /* 抽盲盒 */
    openBox: function (cb) {
      var E = window.Economy;
      if (!E) return cb && cb('金币模块没加载');
      patchSelf(function (rec) {
        var coins = Math.floor(Number(rec.coins) || 0);
        if (coins < E.BOX_COST) return { fail: '金币不够（还差 ' + (E.BOX_COST - coins) + ' 个）' };
        rec.coins = coins - E.BOX_COST;
        var got = E.openBox();
        rec.own = rec.own || { avatars: [], titles: [], skins: [] };
        var list = got.kind === 'avatar' ? rec.own.avatars : rec.own.titles;
        var dup = list.indexOf(got.value) >= 0;
        var refund = 0;
        if (dup) { refund = E.BOX_REFUND; rec.coins += refund; }
        else list.push(got.value);
        return {
          kind: got.kind, value: got.value, rarity: got.rarity,
          dup: dup, refund: refund, coins: rec.coins
        };
      }, cb);
    },

    /* 买宠物皮肤 */
    buySkin: function (id, cb) {
      var E = window.Economy;
      var sk = E && E.skinOf(id);
      if (!sk || !sk.id) return cb && cb('没有这个皮肤');
      patchSelf(function (rec) {
        rec.own = rec.own || { avatars: [], titles: [], skins: [] };
        rec.own.skins = rec.own.skins || [];
        if (rec.own.skins.indexOf(sk.id) >= 0) return { fail: '你已经有了' };
        var coins = Math.floor(Number(rec.coins) || 0);
        if (coins < sk.cost) return { fail: '金币不够（还差 ' + (sk.cost - coins) + ' 个）' };
        rec.coins = coins - sk.cost;
        rec.own.skins.push(sk.id);
        return { skin: sk.id, coins: rec.coins };
      }, cb);
    },

    /* 装备头像 / 称号 / 皮肤 */
    equip: function (what, value, cb) {
      patchSelf(function (rec) {
        if (what === 'avatar') rec.avatar = String(value).slice(0, 4);
        else if (what === 'title') rec.title = String(value).slice(0, 12);
        else if (what === 'skin') rec.petSkin = String(value).slice(0, 8);
        return { equipped: what, value: value };
      }, cb);
    },

    /* 加速孵化：花金币买经验，每天限一次（否则等级能无限刷） */
    buyBoost: function (cb) {
      var E = window.Economy, L = window.Level;
      if (!E) return cb && cb('金币模块没加载');
      if (!L) return cb && cb('等级模块没加载');
      patchSelf(function (rec) {
        var day = L.dayKey();
        if ((rec.boostDay || '') === day) return { fail: '今天的加速已经用过了，明天再来（每天限 1 次）' };
        var coins = Math.floor(Number(rec.coins) || 0);
        if (coins < E.BOOST.cost) return { fail: '金币不够（还差 ' + (E.BOOST.cost - coins) + ' 个）' };
        rec.coins = coins - E.BOOST.cost;
        rec.exp = Math.floor(Number(rec.exp) || 0) + E.BOOST.exp;
        rec.boostDay = day;
        addToday(rec, E.BOOST.exp);
        return { exp: rec.exp, coins: rec.coins, gained: E.BOOST.exp, boostDay: day };
      }, cb);
    },

    /* 记录每日挑战结果 */
    saveDaily: function (st, cb) {
      patchSelf(function (rec) {
        rec.daily = {
          slot: st.slot, round: st.round || 1,
          done: !!st.done, score: Math.floor(st.score || 0),
          right: Math.floor(st.right || 0), coins: Math.floor(st.coins || 0),
          at: Date.now()
        };
        if (st.coins > 0) rec.coins = Math.floor(Number(rec.coins) || 0) + Math.floor(st.coins);
        return { daily: rec.daily, coins: rec.coins };
      }, cb);
    },

    /* 花金币刷新每日挑战（换一批题 + 重置本轮的挑战机会） */
    refreshDaily: function (cb) {
      var E = window.Economy;
      if (!E) return cb && cb('金币模块没加载');
      patchSelf(function (rec) {
        var coins = Math.floor(Number(rec.coins) || 0);
        if (coins < E.DAILY_REFRESH_COINS) {
          return { fail: '金币不够（还差 ' + (E.DAILY_REFRESH_COINS - coins) + ' 个）' };
        }
        rec.coins = coins - E.DAILY_REFRESH_COINS;
        var old = rec.daily || {};
        rec.daily = {
          slot: E.dailySlot(), round: (Math.floor(old.round) || 1) + 1,
          done: false, score: 0, right: 0, coins: 0, at: Date.now()
        };
        return { daily: rec.daily, coins: rec.coins };
      }, cb);
    },

    /* ===== 好友 ===== */
    getProfiles: function (names, cb) {
      names = (names || []).filter(Boolean);
      if (!names.length) return later(function () { cb(null, {}); });
      waitTopics(names.map(tU), 4000, function (err) {
        if (err) return cb(err);
        var out = {};
        names.forEach(function (n) { out[n] = cache[tU(n)] || { name: n, nick: n, avatar: '👤' }; });
        cb(null, out);
      });
    },

    sendFriendRequest: function (to, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      if (to === me) return cb('不能加自己');
      waitTopics([tU(to), tBL(to), tFR(to)], WAIT_MS, function (err) {
        if (err) return cb(err);
        if (!cache[tU(to)]) return cb('没有这个账号');
        var bl = cache[tBL(to)] || [];
        if (bl.some(function (x) { return x.name === me; })) return cb('对方把你拉黑了，加不了');
        var fl = cache[tFL(to)] || [];
        if (fl.some(function (x) { return x.name === me; })) return cb('你们已经是好友了');
        var fr = cache[tFR(to)] || [];
        if (fr.some(function (x) { return x.from === me; })) return cb('已经发过申请了，等对方同意');
        fr.push({ from: me, at: Date.now() });
        client.publish(tFR(to), JSON.stringify(fr), { qos: 1, retain: true });
        later(function () { cb(null); });
      });
    },

    getRequests: function (cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      waitTopics(tFR(me), 2600, function (err) {
        if (err) return cb(err);
        cb(null, cache[tFR(me)] || []);
      });
    },

    acceptRequest: function (from, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      waitTopics([tFR(me), tFL(me), tFL(from)], WAIT_MS, function (err) {
        if (err) return cb(err);
        var fr = (cache[tFR(me)] || []).filter(function (x) { return x.from !== from; });
        client.publish(tFR(me), JSON.stringify(fr), { qos: 1, retain: true });

        var mine = cache[tFL(me)] || [];
        if (!mine.some(function (x) { return x.name === from; })) mine.push({ name: from, since: Date.now() });
        client.publish(tFL(me), JSON.stringify(mine), { qos: 1, retain: true });

        var theirs = cache[tFL(from)] || [];
        if (!theirs.some(function (x) { return x.name === me; })) theirs.push({ name: me, since: Date.now() });
        client.publish(tFL(from), JSON.stringify(theirs), { qos: 1, retain: true });

        later(function () { cb(null); });
      });
    },

    rejectRequest: function (from, cb) {
      var me = savedName();
      waitTopics(tFR(me), WAIT_MS, function (err) {
        if (err) return cb(err);
        var fr = (cache[tFR(me)] || []).filter(function (x) { return x.from !== from; });
        client.publish(tFR(me), JSON.stringify(fr), { qos: 1, retain: true });
        later(function () { cb(null); });
      });
    },

    getFriends: function (cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      waitTopics(tFL(me), 2600, function (err) {
        if (err) return cb(err);
        cb(null, cache[tFL(me)] || []);
      });
    },

    removeFriend: function (name, cb) {
      var me = savedName();
      waitTopics([tFL(me), tFL(name)], WAIT_MS, function (err) {
        if (err) return cb(err);
        var mine = (cache[tFL(me)] || []).filter(function (x) { return x.name !== name; });
        client.publish(tFL(me), JSON.stringify(mine), { qos: 1, retain: true });
        var theirs = (cache[tFL(name)] || []).filter(function (x) { return x.name !== me; });
        client.publish(tFL(name), JSON.stringify(theirs), { qos: 1, retain: true });
        later(function () { cb(null); });
      });
    },

    getBlocked: function (cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      waitTopics(tBL(me), 2600, function (err) {
        if (err) return cb(err);
        cb(null, cache[tBL(me)] || []);
      });
    },

    blockUser: function (name, cb) {
      var me = savedName();
      waitTopics([tBL(me), tFL(me), tFL(name), tFR(me)], WAIT_MS, function (err) {
        if (err) return cb(err);
        var bl = cache[tBL(me)] || [];
        if (!bl.some(function (x) { return x.name === name; })) bl.push({ name: name, at: Date.now() });
        client.publish(tBL(me), JSON.stringify(bl), { qos: 1, retain: true });

        var mine = (cache[tFL(me)] || []).filter(function (x) { return x.name !== name; });
        client.publish(tFL(me), JSON.stringify(mine), { qos: 1, retain: true });
        var theirs = (cache[tFL(name)] || []).filter(function (x) { return x.name !== me; });
        client.publish(tFL(name), JSON.stringify(theirs), { qos: 1, retain: true });
        var fr = (cache[tFR(me)] || []).filter(function (x) { return x.from !== name; });
        client.publish(tFR(me), JSON.stringify(fr), { qos: 1, retain: true });

        later(function () { cb(null); });
      });
    },

    unblockUser: function (name, cb) {
      var me = savedName();
      waitTopics(tBL(me), WAIT_MS, function (err) {
        if (err) return cb(err);
        var bl = (cache[tBL(me)] || []).filter(function (x) { return x.name !== name; });
        client.publish(tBL(me), JSON.stringify(bl), { qos: 1, retain: true });
        later(function () { cb(null); });
      });
    },

    /* ===== 私信 ===== */
    sendDM: function (to, text, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      var ts = Date.now();
      var body = { from: me, to: to, text: String(text).slice(0, 300), at: ts };
      connect(function (err) {
        if (err) return cb && cb(err);
        client.publish(tDM(to, me, ts), JSON.stringify(body), { qos: 1, retain: true });
        client.publish(tDM(me, to, ts), JSON.stringify(body), { qos: 1, retain: true });
        later(function () { cb && cb(null); });
      });
    },

    /* 读「我和 peer」的全部私信（两边都存一份，合并去重） */
    getDMs: function (peer, cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      waitAny([tDMpre(me, peer) + '+', tDMpre(peer, me) + '+'], 2400, function (err) {
        if (err) return cb(err);
        var re = new RegExp('^' + NS + '/dm/' + reEsc(enc(me)) + '/' + reEsc(enc(peer)) + '/(\\d+)$');
        var list = [], seen = {};
        Object.keys(cache).forEach(function (t) {
          var m = t.match(re);
          if (!m) return;
          var rec = cache[t];
          if (!rec || seen[rec.at + '|' + rec.text]) return;
          seen[rec.at + '|' + rec.text] = 1;
          list.push(rec);
        });
        list.sort(function (a, b) { return a.at - b.at; });
        cb(null, list.slice(-MAX_DM));
      });
    },

    /* 会话列表：最近和谁聊过（基于本地缓存里的 dm 主题） */
    getConversations: function (cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      sub(tDMpre(me, '+') + '+', function () {
        setTimeout(function () {
          var pre = NS + '/dm/' + enc(me) + '/';
          var last = {};
          Object.keys(cache).forEach(function (t) {
            if (t.indexOf(pre) !== 0) return;
            var rec = cache[t];
            if (!rec || !rec.at) return;
            var peer = t.slice(pre.length).split('/')[0];
            peer = decodeURIComponent(peer);
            if (!last[peer] || rec.at > last[peer].at) last[peer] = rec;
          });
          var out = Object.keys(last).map(function (k) { return last[k]; });
          out.sort(function (a, b) { return b.at - a.at; });
          cb(null, out);
        }, 1800);
      });
    },

    /* 订阅"所有发给我"的私信，有新消息就回调 */
    watchInbox: function (cb) {
      var me = savedName();
      if (!me) return;
      listeners = listeners.filter(function (l) { return l.tag !== 'inbox'; });
      if (cb) {
        var re = new RegExp('^' + NS + '/dm/' + reEsc(enc(me)) + '/([^/]+)/(\\d+)$');
        listeners.push({ tag: 'inbox', re: re, fn: cb });
      }
      sub(tDMpre(me, '+') + '+', function () {});
    },

    /* ===== 成绩 ===== */
    pushScore: function (rec, cb) {
      var me = savedName();
      if (!me) return cb && cb(null);
      waitTopics(tSC(me), WAIT_MS, function (err) {
        if (err) return cb && cb(err);
        var list = cache[tSC(me)] || [];
        list.push({
          code: rec.code || '', author: rec.author || '',
          score: rec.score, right: rec.right, total: rec.total,
          mode: rec.mode || '', at: Date.now()
        });
        list = list.slice(-MAX_SCORES);
        client.publish(tSC(me), JSON.stringify(list), { qos: 1, retain: true });
        later(function () { cb && cb(null); });
      });
    },

    getScores: function (name, cb) {
      waitTopics(tSC(name), WAIT_MS, function (err) {
        if (err) return cb(err);
        cb(null, cache[tSC(name)] || []);
      });
    },

    /* ===== 出题 / 答题 ===== */
    publishQuiz: function (paper, cb) {
      connect(function (err) {
        if (err) return cb(err);
        if (!paper.code) {
          var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
          for (var i = 0; i < 6; i++) out += s[Math.floor(Math.random() * s.length)];
          paper.code = out;
        }
        paper.createdAt = Date.now();
        client.publish(NS + '/quiz/' + paper.code + '/paper', JSON.stringify(paper), { qos: 1, retain: true });
        ensureSub(NS + '/quiz/' + paper.code + '/result/+', function () {
          later(function () { cb(null, paper); });
        });
      });
    },

    watchResults: function (code, cb) {
      connect(function (err) {
        if (err) return cb && cb(err);
        var re = new RegExp('^' + NS + '/quiz/' + code + '/result/');
        listeners = listeners.filter(function (l) { return l.tag !== 'quiz'; });
        listeners.push({ tag: 'quiz', re: re, fn: function () { emitQuiz(code, cb); } });
        ensureSub(NS + '/quiz/' + code + '/result/+', function () {
          setTimeout(function () { emitQuiz(code, cb); }, 1200);
        });
      });
    },

    fetchQuiz: function (code, cb) {
      code = String(code || '').toUpperCase();
      waitTopics(NS + '/quiz/' + code + '/paper', WAIT_MS, function (err) {
        if (err) return cb(err);
        var p = cache[NS + '/quiz/' + code + '/paper'];
        if (!p) return cb('没找到这个答题码，检查一下');
        cb(null, p);
      });
    },

    submitResult: function (code, result, cb) {
      connect(function (err) {
        if (err) return cb && cb(err);
        result.pid = myPid();
        result.finishedAt = Date.now();
        var me = savedName();
        if (me) {
          result.player = result.player || me;
          var p = cache[tU(me)];
          result.avatar = (p && p.avatar) || '👤';
        }
        client.publish(NS + '/quiz/' + code + '/result/' + result.pid, JSON.stringify(result), { qos: 1, retain: true });
        later(function () { cb && cb(null); });
      });
    },

    watchSelf: watchSelf,
    ensureSelf: ensureSelf
  };

  function emitQuiz(code, cb) {
    var pre = NS + '/quiz/' + code + '/result/';
    var out = {};
    Object.keys(cache).forEach(function (t) {
      if (t.indexOf(pre) === 0) out[t.slice(pre.length)] = cache[t];
    });
    try { cb(code, out); } catch (e) {}
  }
})();
