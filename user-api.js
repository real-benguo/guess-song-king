/* 猜歌王 · 账号 + 出题/答题 数据层（MQTT）
   ---------------------------------------------------------------
   注意：这是「轻量账号」，不是安全账号系统。
   密码只做简单哈希后存在公开频道上 —— 能防「明文裸奔」，但挡不住有心人。
   够朋友之间记录成绩用，别拿来存重要密码。

   频道：
     gs2/user/{用户名}                  账号（retained）
     gs2/quiz/{答题码}/paper            题卷（retained）
     gs2/quiz/{答题码}/result/{pid}     每人的答题结果（retained）
   --------------------------------------------------------------- */
window.UserAPI = (function () {
  'use strict';

  var BROKER = 'wss://broker.emqx.io:8084/mqtt';
  var NS = 'gs2';
  var NAME_KEY = 'gs_user_name';
  var ID_KEY = 'gs_room_id';

  var client = null;
  var cacheUser = {};
  var cachePaper = {};
  var results = {};          // code -> { pid: result }
  var onResults = null;

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function tUser(n) { return NS + '/user/' + encodeURIComponent(n); }
  function tPaper(c) { return NS + '/quiz/' + c + '/paper'; }
  function tResult(c, pid) { return NS + '/quiz/' + c + '/result/' + pid; }
  function later(fn) { setTimeout(fn, 30); }
  function code6() {
    var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    for (var i = 0; i < 6; i++) out += s[Math.floor(Math.random() * s.length)];
    return out;
  }
  function myPid() {
    var v = null;
    try { v = localStorage.getItem(ID_KEY); } catch (e) {}
    if (!v) { v = 'p' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem(ID_KEY, v); } catch (e) {} }
    return v;
  }
  function savedName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }

  /* ---------------- 连接 ---------------- */
  function connect(cb) {
    if (client && client.connected) return cb(null);
    if (typeof mqtt === 'undefined') return cb('消息库没加载出来，刷新页面重试');
    if (client) { try { client.end(true); } catch (e) {} client = null; }

    client = mqtt.connect(BROKER, {
      clientId: 'gs_u_' + Math.random().toString(16).slice(2, 12),
      connectTimeout: 15000,
      reconnectPeriod: 3000,
      clean: true
    });

    var settled = false;
    var timer = setTimeout(function () { if (!settled) { settled = true; cb('连接超时，检查网络'); } }, 16000);
    client.on('connect', function () { if (!settled) { settled = true; clearTimeout(timer); cb(null); } });
    client.on('error', function () {});

    client.on('message', function (topic, payload) {
      var data;
      try { data = JSON.parse(payload.toString()); } catch (e) { return; }

      if (topic.indexOf(NS + '/user/') === 0) {
        cacheUser[decodeURIComponent(topic.slice((NS + '/user/').length))] = data;
        return;
      }
      if (/\/paper$/.test(topic)) {
        var parts = topic.split('/');
        cachePaper[parts[2]] = data;
        return;
      }
      var m = topic.match(/\/quiz\/([A-Za-z0-9]+)\/result\/(.+)$/);
      if (m) {
        var c = m[1], p = m[2];
        if (!results[c]) results[c] = {};
        results[c][p] = data;
        if (onResults) onResults(c, results[c]);
      }
    });
  }

  return {
    backend: 'mqtt',
    savedName: savedName,
    saveName: saveName,
    myPid: myPid,

    /* ---------- 账号 ---------- */
    register: function (name, pwd, cb) {
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tUser(name), { qos: 1 }, function () {
          setTimeout(function () {
            if (cacheUser[name]) return cb('这个名字已经被注册了，换一个，或者直接登录');
            var rec = { name: name, hash: hash(name + '::' + pwd), createdAt: Date.now() };
            client.publish(tUser(name), JSON.stringify(rec), { qos: 1, retain: true });
            setTimeout(function () { saveName(name); cb(null, { name: name }); }, 350);
          }, 700);
        });
      });
    },

    login: function (name, pwd, cb) {
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tUser(name), { qos: 1 }, function () {
          setTimeout(function () {
            var rec = cacheUser[name];
            if (!rec) return cb('没有这个账号，先注册一个吧');
            if (rec.hash !== hash(name + '::' + pwd)) return cb('密码不对');
            saveName(name);
            cb(null, { name: name });
          }, 700);
        });
      });
    },

    /* ---------- 出题 ---------- */
    publishQuiz: function (paper, cb) {
      connect(function (err) {
        if (err) return cb(err);
        if (!paper.code) paper.code = code6();
        paper.createdAt = Date.now();
        client.publish(tPaper(paper.code), JSON.stringify(paper), { qos: 1, retain: true });
        client.subscribe(NS + '/quiz/' + paper.code + '/result/+', { qos: 1 }, function () {
          setTimeout(function () { cb(null, paper); }, 300);
        });
      });
    },

    /* 出题者：监听自己题卷的结果 */
    watchResults: function (code, cb) {
      connect(function (err) {
        if (err) return cb && cb(err);
        onResults = cb || null;
        client.subscribe(NS + '/quiz/' + code + '/result/+', { qos: 1 }, function () {
          if (results[code] && cb) cb(code, results[code]);
          cb && cb(null);
        });
      });
    },
    stopWatch: function () { onResults = null; },
    getResults: function (code) { return results[code] || {}; },

    /* ---------- 答题 ---------- */
    fetchQuiz: function (code, cb) {
      code = (code || '').toUpperCase();
      connect(function (err) {
        if (err) return cb(err);
        client.subscribe(tPaper(code), { qos: 1 }, function () {
          setTimeout(function () {
            var p = cachePaper[code];
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
        client.publish(tResult(code, result.pid), JSON.stringify(result), { qos: 1, retain: true });
        later(function () { cb && cb(null); });
      });
    }
  };
})();
