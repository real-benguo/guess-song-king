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
   --------------------------------------------------------------- */
window.UserAPI = (function () {
  'use strict';

  var BROKER = 'wss://broker.emqx.io:8084/mqtt';
  var NS = 'gs2';
  var NAME_KEY = 'gs_user_name';
  var ID_KEY = 'gs_room_id';
  var MAX_SCORES = 20;
  var MAX_DM = 60;

  var client = null;
  var cache = {};          // topic -> payload
  var listeners = [];      // [{re, fn}]

  /* ---------------- 基础 ---------------- */
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function enc(s) { return encodeURIComponent(String(s)); }
  function tU(n) { return NS + '/u/' + enc(n); }
  function tFR(n) { return NS + '/fr/' + enc(n); }
  function tFL(n) { return NS + '/fl/' + enc(n); }
  function tBL(n) { return NS + '/bl/' + enc(n); }
  function tSC(n) { return NS + '/sc/' + enc(n); }
  function tDMpre(n, peer) { return NS + '/dm/' + enc(n) + '/' + enc(peer) + '/'; }
  function tDM(n, peer, ts) { return tDMpre(n, peer) + ts; }

  function later(fn) { setTimeout(fn, 30); }
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
    client.on('connect', function () { if (!settled) { settled = true; clearTimeout(timer); cb(null); } });
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

  function sub(topic, cb) {
    connect(function (err) {
      if (err) return cb && cb(err);
      client.subscribe(topic, { qos: 1 }, function () { later(function () { cb && cb(null); }); });
    });
  }

  /* 订阅自己的所有频道，登录后调用 */
  function watchSelf(name, onChange) {
    if (onChange) {
      listeners = listeners.filter(function (l) { return l.tag !== 'self'; });
      var re = new RegExp('^' + NS + '/(fr|fl|bl|dm|sc)/' + enc(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      listeners.push({ tag: 'self', re: re, fn: function () { onChange(); } });
    }
    return sub([tFR(name), tFL(name), tBL(name), tSC(name), tDMpre(name, '+')].join(','), function () {});
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
        client.subscribe(tU(name), { qos: 1 }, function () {
          setTimeout(function () {
            if (cache[tU(name)]) return cb('这个账号名已经被注册了，换一个，或者直接登录');
            var rec = {
              name: name, nick: name, hash: hash(name + '::' + pwd),
              avatar: '🐱', createdAt: Date.now()
            };
            client.publish(tU(name), JSON.stringify(rec), { qos: 1, retain: true });
            setTimeout(function () { saveName(name); cb(null, rec); }, 350);
          }, 700);
        });
      });
    },

    login: function (name, pwd, cb) {
      name = String(name || '').trim();
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tU(name), { qos: 1 }, function () {
          setTimeout(function () {
            var rec = cache[tU(name)];
            if (!rec) return cb('没有这个账号，先注册一个吧');
            if (rec.hash !== hash(name + '::' + pwd)) return cb('密码不对');
            saveName(name);
            cb(null, rec);
          }, 700);
        });
      });
    },

    getProfile: function (name, cb) {
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tU(name), { qos: 1 }, function () {
          setTimeout(function () { cb(cache[tU(name)] ? null : '没找到这个用户', cache[tU(name)] || null); }, 800);
        });
      });
    },

    /* 改昵称 / 换头像（账号名不可改） */
    updateProfile: function (patch, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tU(me), { qos: 1 }, function () {
          setTimeout(function () {
            var rec = cache[tU(me)];
            if (!rec) return cb('账号资料没读到，稍后再试');
            if (patch.nick !== undefined) rec.nick = String(patch.nick).slice(0, 12) || me;
            if (patch.avatar !== undefined) rec.avatar = String(patch.avatar).slice(0, 4);
            rec.updatedAt = Date.now();
            client.publish(tU(me), JSON.stringify(rec), { qos: 1, retain: true });
            later(function () { cb(null, clone(rec)); });
          }, 600);
        });
      });
    },

    /* ===== 好友 ===== */
    /* 取一批用户的资料（用于显示头像和昵称） */
    getProfiles: function (names, cb) {
      if (!names || !names.length) return later(function () { cb(null, {}); });
      connect(function (err) {
        if (err) return cb(err);
        var topics = names.map(tU).join(',');
        client.subscribe(topics, { qos: 1 }, function () {
          setTimeout(function () {
            var out = {};
            names.forEach(function (n) { out[n] = cache[tU(n)] || { name: n, nick: n, avatar: '👤' }; });
            cb(null, out);
          }, 900);
        });
      });
    },

    /* 发好友申请（同时检查对方是否拉黑了我） */
    sendFriendRequest: function (to, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      if (to === me) return cb('不能加自己');
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe([tU(to), tBL(to), tFR(to)].join(','), { qos: 1 }, function () {
          setTimeout(function () {
            if (!cache[tU(to)]) return cb('没有这个账号');
            var bl = cache[tBL(to)] || [];
            if (bl.some(function (x) { return x.name === me; })) return cb('对方把你拉黑了，加不了');
            var fr = cache[tFR(to)] || [];
            if (fr.some(function (x) { return x.from === me; })) return cb('已经发过申请了，等对方同意');
            fr.push({ from: me, at: Date.now() });
            client.publish(tFR(to), JSON.stringify(fr), { qos: 1, retain: true });
            later(function () { cb(null); });
          }, 800);
        });
      });
    },

    getRequests: function (cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tFR(me), { qos: 1 }, function () {
          setTimeout(function () { cb(null, cache[tFR(me)] || []); }, 800);
        });
      });
    },

    /* 同意申请：双方好友列表都加上 */
    acceptRequest: function (from, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe([tFR(me), tFL(me), tFL(from)].join(','), { qos: 1 }, function () {
          setTimeout(function () {
            var fr = cache[tFR(me)] || [];
            fr = fr.filter(function (x) { return x.from !== from; });
            client.publish(tFR(me), JSON.stringify(fr), { qos: 1, retain: true });

            var mine = cache[tFL(me)] || [];
            if (!mine.some(function (x) { return x.name === from; })) mine.push({ name: from, since: Date.now() });
            client.publish(tFL(me), JSON.stringify(mine), { qos: 1, retain: true });

            var theirs = cache[tFL(from)] || [];
            if (!theirs.some(function (x) { return x.name === me; })) theirs.push({ name: me, since: Date.now() });
            client.publish(tFL(from), JSON.stringify(theirs), { qos: 1, retain: true });

            later(function () { cb(null); });
          }, 800);
        });
      });
    },

    rejectRequest: function (from, cb) {
      var me = savedName();
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tFR(me), { qos: 1 }, function () {
          setTimeout(function () {
            var fr = (cache[tFR(me)] || []).filter(function (x) { return x.from !== from; });
            client.publish(tFR(me), JSON.stringify(fr), { qos: 1, retain: true });
            later(function () { cb(null); });
          }, 600);
        });
      });
    },

    getFriends: function (cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tFL(me), { qos: 1 }, function () {
          setTimeout(function () { cb(null, cache[tFL(me)] || []); }, 800);
        });
      });
    },

    removeFriend: function (name, cb) {
      var me = savedName();
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe([tFL(me), tFL(name)].join(','), { qos: 1 }, function () {
          setTimeout(function () {
            var mine = (cache[tFL(me)] || []).filter(function (x) { return x.name !== name; });
            client.publish(tFL(me), JSON.stringify(mine), { qos: 1, retain: true });
            var theirs = (cache[tFL(name)] || []).filter(function (x) { return x.name !== me; });
            client.publish(tFL(name), JSON.stringify(theirs), { qos: 1, retain: true });
            later(function () { cb(null); });
          }, 700);
        });
      });
    },

    getBlocked: function (cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tBL(me), { qos: 1 }, function () {
          setTimeout(function () { cb(null, cache[tBL(me)] || []); }, 700);
        });
      });
    },

    /* 拉黑：加进黑名单，同时把好友关系也断掉 */
    blockUser: function (name, cb) {
      var me = savedName();
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe([tBL(me), tFL(me), tFL(name), tFR(me)].join(','), { qos: 1 }, function () {
          setTimeout(function () {
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
          }, 800);
        });
      });
    },

    unblockUser: function (name, cb) {
      var me = savedName();
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tBL(me), { qos: 1 }, function () {
          setTimeout(function () {
            var bl = (cache[tBL(me)] || []).filter(function (x) { return x.name !== name; });
            client.publish(tBL(me), JSON.stringify(bl), { qos: 1, retain: true });
            later(function () { cb(null); });
          }, 600);
        });
      });
    },

    /* ===== 私信 ===== */
    sendDM: function (to, text, cb) {
      var me = savedName();
      if (!me) return cb('还没登录');
      var ts = Date.now();
      pub(tDM(to, me, ts), { from: me, to: to, text: String(text).slice(0, 200), at: ts }, cb);
      /* 同时写一份到自己这边，方便看历史 */
      pub(tDM(me, to, ts), { from: me, to: to, text: String(text).slice(0, 200), at: ts }, function () {});
    },

    getDMs: function (peer, cb) {
      var me = savedName();
      if (!me) return later(function () { cb(null, []); });
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tDMpre(me, peer) + '+', { qos: 1 }, function () {
          setTimeout(function () {
            var list = [];
            var re = new RegExp('^' + NS + '/dm/' + enc(me).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/' + enc(peer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/(\\d+)$');
            Object.keys(cache).forEach(function (t) {
              var m = t.match(re);
              if (m) list.push(cache[t]);
            });
            list.sort(function (a, b) { return a.at - b.at; });
            cb(null, list.slice(-MAX_DM));
          }, 900);
        });
      });
    },

    /* 订阅"所有发给我"的私信，有新消息就回调 */
    watchInbox: function (cb) {
      var me = savedName();
      if (!me) return;
      var re = new RegExp('^' + NS + '/dm/' + enc(me).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/([^/]+)/(\\d+)$');
      listeners.push({ tag: 'inbox', re: re, fn: cb });
      sub(tDMpre(me, '+') + '+', function () {});
    },

    /* ===== 成绩 ===== */
    pushScore: function (rec, cb) {
      var me = savedName();
      if (!me) return cb && cb(null);
      connect(function (err) {
        if (err) return cb && cb(err);
        client.subscribe(tSC(me), { qos: 1 }, function () {
          setTimeout(function () {
            var list = cache[tSC(me)] || [];
            list.push({
              code: rec.code, author: rec.author,
              score: rec.score, right: rec.right, total: rec.total, at: Date.now()
            });
            list = list.slice(-MAX_SCORES);
            client.publish(tSC(me), JSON.stringify(list), { qos: 1, retain: true });
            later(function () { cb && cb(null); });
          }, 600);
        });
      });
    },

    getScores: function (name, cb) {
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tSC(name), { qos: 1 }, function () {
          setTimeout(function () { cb(null, cache[tSC(name)] || []); }, 800);
        });
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
        client.subscribe(NS + '/quiz/' + paper.code + '/result/+', { qos: 1 }, function () {
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
        client.subscribe(NS + '/quiz/' + code + '/result/+', { qos: 1 }, function () {
          setTimeout(function () { emitQuiz(code, cb); }, 800);
        });
      });
    },

    fetchQuiz: function (code, cb) {
      code = String(code || '').toUpperCase();
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(NS + '/quiz/' + code + '/paper', { qos: 1 }, function () {
          setTimeout(function () {
            var p = cache[NS + '/quiz/' + code + '/paper'];
            if (!p) return cb('没找到这个答题码，检查一下');
            cb(null, p);
          }, 800);
        });
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

    watchSelf: watchSelf
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
