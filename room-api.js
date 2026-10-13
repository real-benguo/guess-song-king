/* 猜歌王 · 房间数据层（MQTT 版）
   ---------------------------------------------------------------
   用一个公开的 MQTT 消息服务当「房间中转站」：
     · gs2/{房间码}/state   房主广播的完整房间状态（retained，后来的人也能立刻拿到）
     · gs2/{房间码}/up      客户端上行：加入 / 改名 / 交分 / 离开 / 心跳
   房主是唯一的状态权威：其他人只读 state，往 up 发请求。
   接口保持 cb(err, room)，上层（app.js）不用改。
   --------------------------------------------------------------- */
window.RoomAPI = (function () {
  'use strict';

  var BROKER = 'wss://broker.emqx.io:8084/mqtt';
  var NS = 'gs2';
  var ID_KEY = 'gs_room_id';
  var MAX_PLAYERS = 8;
  var STALE_MS = 25000;      // 超过这么久没心跳的玩家，房主会踢掉

  var DEFAULT_SETTINGS = {
    rounds: 10, play: 'sound', mode: 'speed', minutes: 3,
    pool: 'zh', artist: '周杰伦', difficulty: 'normal'
  };

  var client = null;
  var myRoom = null;
  var cache = {};
  var isHostClient = false;
  var sweepTimer = null;
  var desired = {};          // 订阅过的主题（重连后恢复）

  function uid() { return 'p' + Math.random().toString(36).slice(2, 10); }
  function myId() {
    var id = null;
    try { id = localStorage.getItem(ID_KEY); } catch (e) {}
    if (!id) { id = uid(); try { localStorage.setItem(ID_KEY, id); } catch (e) {} }
    return id;
  }
  function code6() {
    var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    for (var i = 0; i < 6; i++) out += s[Math.floor(Math.random() * s.length)];
    return out;
  }
  function later(fn) { setTimeout(fn, 30); }
  function tState(code) { return NS + '/' + code + '/state'; }
  function tUp(code) { return NS + '/' + code + '/up'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- 连接 ---------------- */
  function connect(cb) {
    if (client && client.connected) return cb(null);
    if (typeof mqtt === 'undefined') return cb('消息库没加载出来，刷新页面重试');
    if (client) { try { client.end(true); } catch (e) {} client = null; }

    client = mqtt.connect(BROKER, {
      clientId: 'gs_' + Math.random().toString(16).slice(2, 12),
      connectTimeout: 15000,
      reconnectPeriod: 3000,
      clean: true
    });

    var settled = false;
    var timer = setTimeout(function () {
      if (!settled) { settled = true; cb('连接超时，检查一下网络'); }
    }, 16000);

    client.on('connect', function () {
      // 断线重连后恢复订阅（clean session 会丢订阅）
      var all = Object.keys(desired);
      if (all.length) client.subscribe(all, { qos: 1 }, function () {});
      if (settled) return;
      settled = true; clearTimeout(timer);
      cb(null);
    });
    client.on('error', function () {});
    client.on('message', onMessage);
  }

  function onMessage(topic, payload) {
    var data;
    try { data = JSON.parse(payload.toString()); } catch (e) { return; }
    if (!myRoom) return;

    if (topic === tState(myRoom.code)) {
      if (isHostClient) return;              // 房主以自己为准
      cache[myRoom.code] = data;
      return;
    }
    if (topic === tUp(myRoom.code) && isHostClient) {
      handleUp(data);
    }
  }

  /* ---------------- 房主侧：处理上行 ---------------- */
  function handleUp(msg) {
    if (!myRoom || !isHostClient) return;
    var p, changed = false;

    if (msg.t === 'join') {
      p = findPlayer(msg.pid);
      if (p) {
        p.lastSeen = Date.now();
      } else {
        if (myRoom.status !== 'waiting') {
          sendTo(msg.pid, { t: 'reject', reason: '这局已经开始了，等下一局吧' });
          return;
        }
        if (myRoom.players.length >= MAX_PLAYERS) {
          sendTo(msg.pid, { t: 'reject', reason: '房间满了（最多 ' + MAX_PLAYERS + ' 人）' });
          return;
        }
        if (myRoom.players.some(function (x) { return x.name === msg.name; })) {
          sendTo(msg.pid, { t: 'reject', reason: '这个名字已经有人用了，换一个' });
          return;
        }
        myRoom.players.push({
          id: msg.pid, name: msg.name, score: 0, right: 0, answered: 0, lastSeen: Date.now()
        });
        changed = true;
      }
    } else if (msg.t === 'rename') {
      p = findPlayer(msg.pid);
      if (!p) return;
      if (myRoom.players.some(function (x) { return x.id !== msg.pid && x.name === msg.name; })) {
        sendTo(msg.pid, { t: 'reject', reason: '这个名字已经有人用了，换一个' });
        return;
      }
      p.name = msg.name; p.lastSeen = Date.now(); changed = true;
    } else if (msg.t === 'score') {
      p = findPlayer(msg.pid);
      if (!p) return;
      p.score += msg.score || 0;
      p.right += msg.right || 0;
      p.answered += 1;
      p.lastSeen = Date.now();
      changed = true;
    } else if (msg.t === 'ping') {
      p = findPlayer(msg.pid);
      if (p) { p.lastSeen = Date.now(); }
      else if (msg.name) {
        sendTo(msg.pid, { t: 'rejoin' });     // 让客户端重新 join
      }
      return;
    } else if (msg.t === 'leave') {
      var before = myRoom.players.length;
      myRoom.players = myRoom.players.filter(function (x) { return x.id !== msg.pid; });
      if (myRoom.players.length !== before) {
        changed = true;
        if (myRoom.hostId === msg.pid && myRoom.players.length) {
          myRoom.hostId = myRoom.players[0].id;   // 房主走了，顺位交接
        }
      }
    }

    if (changed) publishState();
  }

  function findPlayer(id) {
    if (!myRoom) return null;
    for (var i = 0; i < myRoom.players.length; i++) if (myRoom.players[i].id === id) return myRoom.players[i];
    return null;
  }
  function sendTo(pid, msg) {
    msg.pid = pid;
    publishUp(msg);
  }
  function publishUp(msg) {
    if (!client || !myRoom) return;
    client.publish(tUp(myRoom.code), JSON.stringify(msg), { qos: 1 });
  }
  function publishState() {
    if (!client || !myRoom || !isHostClient) return;
    myRoom.updatedAt = Date.now();
    cache[myRoom.code] = clone(myRoom);
    client.publish(tState(myRoom.code), JSON.stringify(myRoom), { qos: 1, retain: true });
  }

  /* 房主：定期踢掉掉线的人 */
  function startSweep() {
    stopSweep();
    sweepTimer = setInterval(function () {
      if (!myRoom || !isHostClient) return;
      var t = Date.now(), changed = false;
      myRoom.players = myRoom.players.filter(function (p) {
        if (t - (p.lastSeen || 0) > STALE_MS) { changed = true; return false; }
        return true;
      });
      if (!myRoom.players.length) { closeRoom(); return; }
      if (changed) {
        if (!findPlayer(myRoom.hostId)) myRoom.hostId = myRoom.players[0].id;
        publishState();
      }
    }, 6000);
  }
  function stopSweep() { if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; } }

  function closeRoom() {
    if (!myRoom) return;
    myRoom.closed = true;
    publishState();
    stopSweep();
  }

  /* ---------------- 对外接口 ---------------- */
  return {
    backend: 'mqtt',
    BROKER: BROKER,
    MAX_PLAYERS: MAX_PLAYERS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    myId: myId,

    /* 创建房间：我是房主 */
    create: function (name, cb) {
      connect(function (err) {
        if (err) return cb(err);
        var code = code6();
        isHostClient = true;
        myRoom = {
          code: code,
          hostId: myId(),
          settings: clone(DEFAULT_SETTINGS),
          status: 'waiting',
          players: [{ id: myId(), name: name, score: 0, right: 0, answered: 0, lastSeen: Date.now() }],
          qIndex: 0,
          songId: null,
          startedAt: null,
          endsAt: null,
          closed: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        client.subscribe(tUp(code), { qos: 1 }, function () {
          desired[tUp(code)] = 1;
          publishState();
          startSweep();
          later(function () { cb(null, clone(myRoom)); });
        });
      });
    },

    /* 加入房间：我是客人 */
    join: function (code, name, cb) {
      code = (code || '').toUpperCase();
      connect(function (err) {
        if (err) return cb(err);
        isHostClient = false;
        myRoom = { code: code, players: [] };
        cache[code] = null;

        client.subscribe(tState(code), { qos: 1 }, function () {
          desired[tState(code)] = 1;
          // 等 retained 状态到达
          setTimeout(function () {
            var st = cache[code];
            if (st && st.closed) return cb('这个房间已经关闭了');
            publishUp({ t: 'join', pid: myId(), name: name });
            // 再等房主确认
            setTimeout(function () {
              var st2 = cache[code];
              if (st2 && !st2.closed) cb(null, clone(st2));
              else cb('没能加入房间，检查一下房间码');
            }, 900);
          }, 700);
        });
      });
    },

    /* 轮询读当前状态（实际是读 MQTT 推过来的缓存） */
    get: function (code, cb) {
      code = (code || '').toUpperCase();
      if (isHostClient && myRoom && myRoom.code === code) {
        return later(function () { cb(myRoom.closed ? '房间已关闭' : null, clone(myRoom)); });
      }
      var st = cache[code];
      if (st && st.closed) return later(function () { cb('房间已关闭', st); });
      if (st) return later(function () { cb(null, clone(st)); });
      later(function () { cb(null, null); });
    },

    rename: function (code, name, cb) {
      if (isHostClient) {
        if (myRoom.players.some(function (p) { return p.id !== myId() && p.name === name; })) {
          return later(function () { cb('这个名字已经有人用了，换一个'); });
        }
        var me0 = findPlayer(myId());
        if (me0) me0.name = name;
        publishState();
        return later(function () { cb(null, clone(myRoom)); });
      }
      publishUp({ t: 'rename', pid: myId(), name: name });
      later(function () { cb(null, clone(myRoom)); });
    },

    updateSettings: function (code, settings, cb) {
      if (!isHostClient) return later(function () { cb('只有房主能改设置'); });
      for (var k in settings) if (Object.prototype.hasOwnProperty.call(settings, k)) myRoom.settings[k] = settings[k];
      publishState();
      later(function () { cb(null, clone(myRoom)); });
    },

    /* 开始：房主把整份题目清单发下去，之后每个人按自己的节奏答题 */
    start: function (code, songs, cb) {
      if (!isHostClient) return later(function () { cb('只有房主能开始'); });
      var s = myRoom.settings;
      myRoom.status = 'playing';
      myRoom.qIndex = 0;
      myRoom.songs = (songs || []).slice();
      myRoom.total = myRoom.songs.length;
      myRoom.startedAt = Date.now();
      myRoom.endsAt = s.mode === 'timed' ? Date.now() + s.minutes * 60000 : null;
      myRoom.songId = null;
      myRoom.players.forEach(function (p) { p.score = 0; p.right = 0; p.answered = 0; });
      publishState();
      later(function () { cb(null, clone(myRoom)); });
    },

    setSong: function (code, songId, cb) {
      if (!isHostClient) return later(function () { cb && cb(null, clone(myRoom)); });
      myRoom.songId = songId;
      publishState();
      later(function () { cb && cb(null, clone(myRoom)); });
    },

    finish: function (code, cb) {
      if (!isHostClient) return later(function () { cb && cb(null, clone(myRoom)); });
      myRoom.status = 'over';
      publishState();
      later(function () { cb && cb(null, clone(myRoom)); });
    },

    submit: function (code, delta, cb) {
      if (isHostClient) {
        var me = findPlayer(myId());
        if (me) {
          me.score += delta.score || 0;
          me.right += delta.right || 0;
          me.answered += 1;
          me.lastSeen = Date.now();
          publishState();
        }
        return later(function () { cb && cb(null, clone(myRoom)); });
      }
      publishUp({ t: 'score', pid: myId(), score: delta.score || 0, right: delta.right || 0 });
      later(function () { cb && cb(null, clone(myRoom)); });
    },

    leave: function (code, cb) {
      try {
        if (isHostClient) { closeRoom(); }
        else { publishUp({ t: 'leave', pid: myId() }); }
      } catch (e) {}
      stopSweep();
      isHostClient = false;
      myRoom = null;
      later(function () { cb && cb(null, null); });
    },

    /* 心跳（app.js 每秒调一次） */
    ping: function () {
      if (!myRoom || !client || !client.connected) return;
      if (isHostClient) {
        var me = findPlayer(myId());
        if (me) me.lastSeen = Date.now();
      } else {
        publishUp({ t: 'ping', pid: myId(), name: '' });
      }
    }
  };
})();
