/* 猜歌王 — 逻辑
   曲库：周杰伦专项 / 国语专项 / 粤语专项
   玩法：前奏猜歌 / 随机猜歌 / 歌词猜歌
   挑战：填空作答（×2 分）、无限模式
   计分：按答题用时递减（≤3s=5、≤8s=3、≤15s=1、更久=0.5），答错不扣分
   纯前端，无依赖。数据来自 data/songs.js。 */
(function () {
  'use strict';

  var DB = Array.isArray(window.DB) ? window.DB : (Array.isArray(window.SONGS) ? window.SONGS : []);
  DB = DB.filter(function (s) { return s && s.t && s.p; });

  var TOTAL = 10;      // 普通模式题数
  var TIMEOUT = 30;    // 每题最长作答秒数

  function $(id) { return document.getElementById(id); }

  var el = {
    screens: document.querySelectorAll('.screen'),
    poolTiles: document.querySelectorAll('#pool-tiles .tile'),
    playTiles: document.querySelectorAll('#play-tiles .tile'),
    swFill: $('sw-fill'), swEndless: $('sw-endless'),
    btnStart: $('btn-start'), btnAgain: $('btn-again'), btnHome: $('btn-home'),
    btnRules: $('btn-rules'), btnScores: $('btn-scores'), btnQuit: $('btn-quit'),
    badge: $('badge'),
    hudIdx: $('hud-idx'), hudScore: $('hud-score'), hudRight: $('hud-right'),
    disc: $('disc'), discIco: $('disc-ico'),
    lyricBox: $('lyric-box'), lyricText: $('lyric-text'), btnListen: $('btn-listen'),
    playerTip: $('player-tip'), timerFill: $('timer-fill'),
    volume: $('volume'), volIco: $('vol-ico'),
    options: $('options'), dots: $('dots'),
    fillArea: $('fill-area'), fillInput: $('fill-input'), btnSubmit: $('btn-submit'),
    rank: $('rank'), rankLabel: $('rank-label'), finalScore: $('final-score'),
    statRight: $('stat-right'), statTotal: $('stat-total'), statAcc: $('stat-acc'),
    modal: $('modal'), modalTitle: $('modal-title'), modalBody: $('modal-body'),
    modalActions: $('modal-actions'), modalClose: $('modal-close'),
    // 多人
    btnMulti: $('btn-multi'),
    lobbyName: $('lobby-name'), joinCode: $('join-code'),
    btnCreate: $('btn-create'), btnJoin: $('btn-join'),
    lobbyHint: $('lobby-hint'), btnLobbyBack: $('btn-lobby-back'),
    roomCode: $('room-code'), btnRoomLeave: $('btn-room-leave'),
    playerList: $('player-list'), playerCount: $('player-count'),
    roomSettings: $('room-settings'), hostTag: $('host-tag'),
    btnRoomStart: $('btn-room-start'), roomHint: $('room-hint'),
    liveRank: $('live-rank'), board: $('board'),
    btnAccount: $('btn-account'),
    accName: $('acc-name'), accPwd: $('acc-pwd'),
    btnLogin: $('btn-login'), btnRegister: $('btn-register'),
    accHint: $('acc-hint'), btnLoginBack: $('btn-login-back'),
    btnQuiz: $('btn-quiz'), quizUser: $('quiz-user'), btnQuizBack: $('btn-quiz-back'),
    quizTabs: $('quiz-tabs'),
    paneMake: $('pane-make'), paneTake: $('pane-take'),
    mkPlay: $('mk-play'), mkFill: $('mk-fill'),
    mkSearch: $('mk-search'), mkResults: $('mk-results'),
    mkPicked: $('mk-picked'), mkCount: $('mk-count'),
    btnMake: $('btn-make'),
    mkCodeBox: $('mk-code-box'), mkCode: $('mk-code'),
    mkResultBlock: $('mk-result-block'), mkRcount: $('mk-rcount'), mkResultsList: $('mk-results-list'),
    tkCode: $('tk-code'), btnTake: $('btn-take'), tkHint: $('tk-hint')
  };

  var audio = new Audio();
  audio.preload = 'auto';

  var pool = 'zh', play = 'sound', fill = false, endless = false;
  var POOL_NAME = { jay: '周杰伦专项', zh: '国语专项', yue: '粤语专项' };
  var PLAY_NAME = { sound: '听声猜歌', lyric: '看词猜歌' };

  var state = null, rafId = null, locked = false, nextTimer = null;

  /* ---------------- 工具 ---------------- */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function show(id) {
    for (var i = 0; i < el.screens.length; i++)
      el.screens[i].classList.toggle('is-active', el.screens[i].id === id);
    window.scrollTo(0, 0);
  }
  function fmt(n) { return (n % 1 === 0) ? String(n) : n.toFixed(1); }

  function poolOf(p) {
    if (p === 'jay') return DB.filter(function (s) { return s.a === '周杰伦'; });
    if (p === 'yue') return DB.filter(function (s) { return s.l === 'yue'; });
    return DB.filter(function (s) { return s.l !== 'yue'; });
  }
  function gamePool() {
    var p = poolOf(pool);
    if (play === 'lyric') p = p.filter(function (s) { return s.ly && s.ly.length > 40; });
    return p;
  }

  /* 计分：按答题用时 */
  function scoreFor(sec) {
    if (sec <= 3) return 5;
    if (sec <= 8) return 3;
    if (sec <= 15) return 1;
    return 0.5;
  }

  /* 歌名归一化（填空比对）：忽略大小写、空格、常见标点 */
  function normTitle(s) {
    return String(s || '').toLowerCase()
      .replace(/[\s\u3000]/g, '')
      .replace(/[，。！？、·・,\.\!\?\-—_'"“”‘’()（）\[\]【】《》<>:：;；~～&＋+]/g, '');
  }

  /* ---------------- 出题 ---------------- */
  function makeQuestion(correct) {
    var p = state.allPool;
    var dis = [], taken = {}, cand = shuffle(p);
    taken[correct.t] = 1;
    for (var j = 0; j < cand.length && dis.length < 3; j++) {
      if (taken[cand[j].t]) continue;
      taken[cand[j].t] = 1;
      dis.push(cand[j]);
    }
    if (dis.length < 3) return null;
    return { correct: correct, opts: shuffle([correct].concat(dis)) };
  }

  function nextQuestion() {
    if (state.over) return;
    var lim = state.total || TOTAL;
    if (!endless && state.answered >= lim) { endGame(); return; }
    var q = null, guard = 0;
    while (guard++ < 5000) {
      if (!state.queue.length) { endGame('题库用完啦'); return; }
      var s = state.queue.pop();
      if (state.used[s.t]) continue;
      state.used[s.t] = 1;
      q = makeQuestion(s);
      if (q) break;
    }
    if (!q) { endGame('题库用完啦'); return; }
    state.current = q;
    renderQuestion();
  }

  function lyricHint(song) {
    var lines = (song.ly || '').split('\n')
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length >= 5 && x.indexOf('[') !== 0 && x.indexOf('（') !== 0; });
    if (lines.length < 2) return song.ly || '';
    var start = Math.floor(Math.random() * Math.max(1, lines.length - 2));
    return lines.slice(start, start + 2).join('\n');
  }

  /* ---------------- 音频 ---------------- */
  function stopAudio() {
    try { audio.pause(); } catch (e) {}
    el.disc.classList.remove('is-playing');
    el.discIco.textContent = '▶';
  }

  function playClip() {
    if (locked || !state || !state.current) return;
    if (el.disc.classList.contains('is-playing')) return;

    var song = state.current.correct;
    try { audio.pause(); } catch (e) {}
    audio.src = song.p;

    var begin = function () {
      var d = audio.duration || 30;
      // 听声 / 看词 都从片段里的随机位置开始放
      var start = Math.max(0, Math.random() * Math.max(1, d - 15));
      try { audio.currentTime = start; } catch (e) {}
      var pr = audio.play();
      var ok = function () {
        el.disc.classList.add('is-playing');
        el.discIco.textContent = '❚❚';
        el.playerTip.textContent = '🎵 播放中…';
      };
      var bad = function () { el.playerTip.textContent = '播放失败，再点一次'; };
      if (pr && pr.then) pr.then(ok).catch(bad); else ok();
    };
    var fail = function () {
      el.playerTip.textContent = '这首加载不出来，自动跳过…';
      setTimeout(function () { if (!locked) judge(false, null); }, 700);
    };

    if (audio.readyState >= 1) begin();
    else {
      audio.addEventListener('loadedmetadata', begin, { once: true });
      audio.addEventListener('error', fail, { once: true });
      audio.load();
    }
  }

  /* ---------------- 计时 ---------------- */
  function startTimer() {
    stopTimer();
    state.tStart = performance.now();
    var tick = function () {
      var used = (performance.now() - state.tStart) / 1000;
      state.usedSec = used;
      var remain = Math.max(0, TIMEOUT - used);
      el.timerFill.style.width = (remain / TIMEOUT * 100) + '%';
      el.timerFill.classList.toggle('is-low', remain <= 10);
      if (remain <= 0) { stopTimer(); judge(false, null, true); return; }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function stopTimer() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  /* ---------------- 判定 ---------------- */
  function judge(isRight, userText, isTimeout) {
    if (locked || !state || !state.current) return;
    locked = true;
    stopTimer();
    stopAudio();
    el.disc.classList.add('is-done');

    var q = state.current;
    state.answered++;

    var gain = 0;
    if (isRight) {
      gain = scoreFor(state.usedSec);
      if (fill && !isMulti) gain *= 2;
      state.score += gain;
      state.right++;
      sfxRight();
      popScore('+' + fmt(gain));
      el.playerTip.textContent = '✅ 答对！+' + fmt(gain) + ' 分';
      markDot(true);
    } else {
      sfxWrong();
      el.playerTip.textContent = isTimeout
        ? ('⏰ 超时了 · 正确答案：' + q.correct.a + '《' + q.correct.t + '》')
        : ('❌ 答错了 · 正确答案：' + q.correct.a + '《' + q.correct.t + '》');
      revealAnswer(userText);
      markDot(false);
    }
    updateHud();

    if (isMulti && mState) {
      // 多人：分数交上去，题目节奏由房主控制
      mState.answered++;
      RoomAPI.submit(room.code, { score: gain, right: isRight ? 1 : 0 }, function () {});
      if (isHost()) scheduleHostAdvance();
      return;
    }
    nextTimer = setTimeout(nextQuestion, isRight ? 620 : 3000);
  }

  function revealAnswer(userText) {
    var q = state.current;
    if (fill) {
      el.fillInput.value = '';
      el.fillInput.placeholder = q.correct.t;
      el.fillInput.classList.add('is-reveal');
      return;
    }
    var btns = el.options.querySelectorAll('.opt');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.add('is-lock');
      if (q.opts[i] === q.correct) btns[i].classList.add('is-right');
      else if (userText !== null && btns[i].textContent === userText) btns[i].classList.add('is-wrong');
      else btns[i].classList.add('is-dim');
    }
  }

  function markDot(right) {
    if (endless) return;
    var dot = el.dots.children[state.answered - 1];
    if (dot) { dot.classList.remove('is-now'); dot.classList.add(right ? 'is-right' : 'is-wrong'); }
  }

  function updateHud() {
    el.hudScore.textContent = fmt(state.score);
    el.hudRight.textContent = state.right;
    var no = state.answered + 1;
    el.hudIdx.textContent = endless
      ? ('第 ' + no + ' 题')
      : (Math.min(no, TOTAL) + '/' + TOTAL);
  }

  /* ---------------- 渲染 ---------------- */
  function renderQuestion() {
    locked = false;
    var q = state.current;
    var isLyric = play === 'lyric';

    el.disc.classList.remove('is-playing', 'is-done');
    el.discIco.textContent = '▶';
    el.timerFill.style.width = '100%';
    el.timerFill.classList.remove('is-low');
    state.usedSec = 0;

    el.disc.hidden = isLyric;
    el.lyricBox.hidden = !isLyric;
    el.playerTip.textContent = isLyric ? '根据歌词猜歌名' : '点击播放片段';
    el.lyricText.textContent = isLyric ? lyricHint(q.correct) : '';

    // 选项 / 填空
    el.options.hidden = fill;
    el.fillArea.hidden = !fill;
    el.options.innerHTML = '';
    if (fill) {
      el.fillInput.value = '';
      el.fillInput.placeholder = '输入歌名后按回车';
      el.fillInput.classList.remove('is-reveal');
      el.fillInput.disabled = false;
      el.btnSubmit.disabled = false;
    } else {
      q.opts.forEach(function (s) {
        var b = document.createElement('button');
        b.className = 'opt';
        b.textContent = s.t;
        b.addEventListener('click', function () { judge(s === q.correct, s.t); });
        el.options.appendChild(b);
      });
    }

    if (!endless) {
      for (var i = 0; i < el.dots.children.length; i++)
        el.dots.children[i].classList.toggle('is-now', i === state.answered);
    }

    updateHud();
    startTimer();
  }

  /* ---------------- 音效 ---------------- */
  var actx = null;
  function beep(freq, dur, type, vol, delay) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime + (delay || 0);
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol || 0.07, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur);
    } catch (e) {}
  }
  function sfxRight() { beep(880, 0.12, 'sine', 0.07); beep(1318, 0.18, 'sine', 0.055, 0.1); }
  function sfxWrong() { beep(196, 0.3, 'sawtooth', 0.05); }
  function sfxTap() { beep(520, 0.05, 'triangle', 0.035); }

  function popScore(text) {
    var d = document.createElement('div');
    d.className = 'float-score';
    d.textContent = text;
    d.style.top = (window.innerHeight * 0.32) + 'px';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1150);
  }

  function confetti() {
    var colors = ['#7c5cff', '#22d3ee', '#fbbf24', '#22c55e', '#f43f5e'];
    for (var i = 0; i < 44; i++) {
      (function () {
        var c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = (Math.random() * 100) + 'vw';
        c.style.background = colors[(Math.random() * colors.length) | 0];
        c.style.animationDuration = (1.6 + Math.random() * 1.5) + 's';
        c.style.animationDelay = (Math.random() * 0.7) + 's';
        document.body.appendChild(c);
        setTimeout(function () { c.remove(); }, 4200);
      })();
    }
  }

  /* ---------------- 今日分数 ---------------- */
  function todayKey() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function loadScores() {
    try { return JSON.parse(window.localStorage.getItem('gs_scores') || '{}'); } catch (e) { return {}; }
  }
  function saveScore() {
    try {
      var all = loadScores(), k = todayKey();
      if (!all[k]) all[k] = [];
      all[k].push({
        p: pool, y: play, f: fill ? 1 : 0, e: endless ? 1 : 0,
        s: state.score, r: state.right, n: state.answered
      });
      window.localStorage.setItem('gs_scores', JSON.stringify(all));
    } catch (e) {}
  }
  function clearScores() {
    try {
      var all = loadScores();
      all[todayKey()] = [];
      window.localStorage.setItem('gs_scores', JSON.stringify(all));
    } catch (e) {}
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(title, html, actions) {
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = html;
    el.modalActions.innerHTML = '';
    var list = actions || [{ label: '知道了', cls: 'btn-primary', fn: closeModal }];
    list.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'btn-primary');
      b.textContent = a.label;
      b.addEventListener('click', a.fn);
      el.modalActions.appendChild(b);
    });
    el.modal.hidden = false;
  }
  function closeModal() { el.modal.hidden = true; }

  function rulesHTML() {
    return '' +
      '<h4>🎯 三种曲库 × 三种玩法</h4>' +
      '<ul>' +
      '<li><b>曲库</b>：周杰伦专项 / 国语专项 / 粤语专项</li>' +
      '<li><b>玩法</b>：前奏猜歌（听开头）、随机猜歌（听片段）、歌词猜歌（看歌词）</li>' +
      '</ul>' +
      '<h4>✍️ 挑战选项</h4>' +
      '<ul>' +
      '<li><b>填空作答</b>：不给选项，自己打出歌名，完全正确才算对，<span class="hl">得分 ×2</span></li>' +
      '<li><b>无限模式</b>：题目一直出，直到你点「退出」或曲库用完；可与填空叠加</li>' +
      '</ul>' +
      '<h4>📊 计分规则</h4>' +
      '<ul>' +
      '<li>每题<b>只有一次</b>作答机会</li>' +
      '<li>答对：按用时给分 —— <span class="hl">3 秒内 5 分</span>、8 秒内 3 分、15 秒内 1 分、更久 0.5 分</li>' +
      '<li>答错 / 超时：<b>不扣分</b>，亮出正确答案，3 秒后进入下一题</li>' +
      '<li>填空模式下所有得分 <span class="hl">×2</span></li>' +
      '</ul>' +
      '<h4>⏱ 说明</h4>' +
      '<ul>' +
      '<li>每题最长 30 秒，超时算答错</li>' +
      '<li>普通模式每局 10 题；无限模式直到你退出</li>' +
      '<li>音源为 Apple 公开试听片段（约 30 秒），<b>不一定从歌曲开头开始</b></li>' +
      '</ul>';
  }

  function showScores() {
    var all = loadScores(), arr = all[todayKey()] || [];
    if (!arr.length) {
      openModal('🏆 今日分数', '<p class="empty-tip">今天还没有战绩，去玩一局吧～</p>', [
        { label: '清空今日记录', cls: 'btn-ghost', fn: function () { clearScores(); showScores(); } },
        { label: '知道了', cls: 'btn-primary', fn: closeModal }
      ]);
      return;
    }
    var groups = {};
    arr.forEach(function (r) {
      var k = r.p + '|' + r.y + '|' + r.f;
      if (!groups[k]) groups[k] = { best: 0, count: 0, last: 0 };
      groups[k].count++;
      groups[k].last = r.s;
      if (r.s > groups[k].best) groups[k].best = r.s;
    });
    var html = '<p style="margin:0 0 12px;color:#8b8fa3;font-size:12.5px">' + todayKey() + ' · 共 ' + arr.length + ' 局</p>';
    Object.keys(groups).forEach(function (k) {
      var parts = k.split('|');
      var g = groups[k];
      var name = POOL_NAME[parts[0]] + ' · ' + PLAY_NAME[parts[1]] + (parts[2] === '1' ? ' · 填空' : '');
      html += '<div class="score-row"><div><div class="sr-name">' + name + '</div>' +
        '<div class="sr-sub">' + g.count + ' 局 · 最近 ' + fmt(g.last) + ' 分</div></div>' +
        '<div class="sr-val">' + fmt(g.best) + '</div></div>';
    });
    openModal('🏆 今日分数', html, [
      { label: '清空今日记录', cls: 'btn-ghost', fn: function () { clearScores(); showScores(); } },
      { label: '知道了', cls: 'btn-primary', fn: closeModal }
    ]);
  }

  /* ---------------- 结算 ---------------- */
  function endGame(reason) {
    if (!state || state.over) return;
    state.over = true;
    stopTimer();
    stopAudio();
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }

    var n = state.answered || 1;
    var acc = Math.round(state.right / n * 100);
    var maxPossible = n * 5 * (fill ? 2 : 1);
    var ratio = maxPossible ? state.score / maxPossible : 0;

    var r, label;
    if (ratio >= 0.85) { r = 'S'; label = '封神！你是曲库本人'; }
    else if (ratio >= 0.7) { r = 'A'; label = '歌王级，耳朵很毒'; }
    else if (ratio >= 0.5) { r = 'B'; label = '高手，稳'; }
    else if (ratio >= 0.3) { r = 'C'; label = '还行，继续练'; }
    else { r = 'D'; label = '再接再厉'; }

    saveScore();

    if (state.take && takeCtx) {
      UserAPI.submitResult(takeCtx.code, {
        player: myUser || ('游客' + String(UserAPI.myPid()).slice(-4)),
        score: state.score,
        right: state.right,
        total: state.answered
      }, function () {});
    }

    el.rank.textContent = r;
    var isBest = false;
    try {
      var bkey = 'gs_best_' + pool + '_' + play;
      var bprev = parseInt(window.localStorage.getItem(bkey) || '0', 10);
      if (state.score > bprev) { window.localStorage.setItem(bkey, String(state.score)); isBest = true; }
    } catch (e) {}
    el.rankLabel.textContent = (reason ? (reason + ' · ' + label) : (isBest ? (label + ' · 新纪录！') : label)) +
      (state.take ? ' · 成绩已交给出题人' : '');
    el.finalScore.textContent = fmt(state.score);
    el.statRight.textContent = state.right;
    el.statTotal.textContent = state.answered;
    el.statAcc.textContent = acc + '%';
    el.board.hidden = true;
    show('s-over');
    if (ratio >= 0.7 && state.answered >= 5) confetti();
  }

  /* ---------------- 开始 ---------------- */
  function startGame() {
    // 单机模式：清掉多人状态
    isMulti = false;
    stopRoomPoll();
    room = null; mState = null;
    if (hostAdvTimer) { clearTimeout(hostAdvTimer); hostAdvTimer = null; }
    el.liveRank.hidden = true;
    el.board.hidden = true;

    var p = shuffle(gamePool());
    // 歌名去重
    var seen = {}, uniq = [];
    for (var i = 0; i < p.length; i++) {
      if (seen[p[i].t]) continue;
      seen[p[i].t] = 1;
      uniq.push(p[i]);
    }
    if (uniq.length < 4) {
      openModal('提示', '<p class="empty-tip">' +
        (play === 'lyric' ? '这个曲库里有歌词的歌还不够，换个曲库或玩法试试。'
          : '这个曲库的歌太少了，换个模式试试。') + '</p>');
      return;
    }
    state = {
      allPool: uniq,
      queue: shuffle(uniq),
      used: {},
      answered: 0,
      score: 0,
      right: 0,
      usedSec: 0,
      tStart: 0,
      current: null,
      over: false
    };
    el.hudScore.textContent = '0';
    el.hudRight.textContent = '0';

    // 进度点
    el.dots.innerHTML = '';
    el.dots.hidden = endless;
    if (!endless) {
      for (var k = 0; k < TOTAL; k++) {
        var d = document.createElement('span');
        d.className = 'dot';
        el.dots.appendChild(d);
      }
    }

    var tags = [POOL_NAME[pool], PLAY_NAME[play]];
    if (fill) tags.push('填空×2');
    if (endless) tags.push('无限');
    el.badge.textContent = tags.join(' · ');

    show('s-game');
    nextQuestion();
  }

  function refreshCounts() {
    var map = { jay: poolOf('jay').length, zh: poolOf('zh').length, yue: poolOf('yue').length };
    Object.keys(map).forEach(function (k) {
      var node = document.querySelector('[data-count="' + k + '"]');
      if (node) node.textContent = map[k] + ' 首';
    });
  }

  /* ================= 多人对战 ================= */
  var room = null, roomPoll = null, isMulti = false, mState = null, hostAdvTimer = null;
  var NAME_KEY = 'gs_myname';

  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }
  function loadName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function isHost() { return !!(room && room.hostId === RoomAPI.myId()); }
  function isActive(id) { var n = $(id); return !!(n && n.classList.contains('is-active')); }
  function findSong(key) {
    for (var i = 0; i < DB.length; i++) if ((DB[i].a + '|' + DB[i].t) === key) return DB[i];
    return null;
  }
  function poolForPlay(p) {
    var all = DB.slice();
    if (p === 'lyric') all = all.filter(function (s) { return s.ly && s.ly.length > 40; });
    return all;
  }
  function uniqByTitle(pool) {
    var seen = {}, out = [];
    pool.forEach(function (x) { if (!seen[x.t]) { seen[x.t] = 1; out.push(x); } });
    return out;
  }

  function goLobby() {
    show('s-lobby');
    if (el.lobbyName) el.lobbyName.value = loadName();
    if (el.lobbyHint) {
      el.lobbyHint.textContent = RoomAPI.backend === 'mqtt'
        ? '房间码发给朋友，他们在自己手机上输码就能进来。'
        : '⚠️ 当前是本机测试模式：只能在同一浏览器开多个标签试玩。';
    }
  }

  function enterRoom(r) {
    room = r; isMulti = true;
    show('s-room');
    renderRoom();
    startRoomPoll();
  }
  function startRoomPoll() { stopRoomPoll(); roomPoll = setInterval(pollRoom, 1000); }
  function stopRoomPoll() { if (roomPoll) { clearInterval(roomPoll); roomPoll = null; } }

  function pollRoom() {
    if (!room) return;
    if (RoomAPI.ping) RoomAPI.ping();      // 每秒一次，顺便当心跳
    RoomAPI.get(room.code, function (err, r) {
      if (err || !r) {
        stopRoomPoll(); alert('房间已关闭'); room = null; isMulti = false; show('s-lobby'); return;
      }
      room = r;
      if (room.status === 'playing' && !isActive('s-game')) {
        try { startMultiGame(); } catch (e) { console.error('startMultiGame failed', e); }
      }
      if (room.status === 'over' && isActive('s-game')) endMultiGame();
      if (isActive('s-room')) renderRoom();
      if (isActive('s-game') && isMulti) {
        updateLiveRank();
        if (room.songId && (!mState || room.songId !== mState.songId)) showMultiQuestion(room.songId);
      }
    });
  }

  function renderRoom() {
    if (!room) return;
    var host = isHost();
    el.roomCode.textContent = room.code;
    el.playerCount.textContent = room.players.length + ' 人';
    el.playerList.innerHTML = '';
    room.players.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'player-item' + (p.id === RoomAPI.myId() ? ' is-me' : '');
      var nm = document.createElement('span');
      nm.className = 'p-name'; nm.textContent = p.name;
      d.appendChild(nm);
      if (p.id === room.hostId) {
        var t = document.createElement('span');
        t.className = 'p-tag'; t.textContent = '房主';
        d.appendChild(t);
      }
      if (p.id === RoomAPI.myId()) {
        var eb = document.createElement('button');
        eb.className = 'p-edit'; eb.textContent = '✏️'; eb.title = '改名字';
        eb.addEventListener('click', renameSelf);
        d.appendChild(eb);
      }
      el.playerList.appendChild(d);
    });
    renderRoomSettings(host);
    el.btnRoomStart.hidden = !host;
    el.hostTag.textContent = host ? '你是房主，可以修改' : '只有房主能改';
    el.roomHint.textContent = host ? '你是房主，设置好后点「开始游戏」' : '等房主开始…';
  }

  function renderRoomSettings(editable) {
    var s = room.settings;
    var defs = [
      { k: 'mode', name: '玩法', opts: [['speed', '有限题·比速度'], ['timed', '限时·比总分']] },
      { k: 'rounds', name: '题目数量', opts: [[5, '5 题'], [10, '10 题'], [15, '15 题'], [20, '20 题']], show: s.mode === 'speed' },
      { k: 'minutes', name: '时长', opts: [[1, '1 分钟'], [3, '3 分钟'], [5, '5 分钟']], show: s.mode === 'timed' },
      { k: 'play', name: '题目类型', opts: [['sound', '听声'], ['lyric', '看词']] }
    ];
    el.roomSettings.innerHTML = '';
    defs.forEach(function (d) {
      if (d.show === false) return;
      var row = document.createElement('div');
      row.className = 'set-row';
      var nm = document.createElement('span');
      nm.className = 'set-name'; nm.textContent = d.name;
      row.appendChild(nm);
      var seg = document.createElement('div');
      seg.className = 'seg';
      d.opts.forEach(function (o) {
        var b = document.createElement('button');
        b.textContent = o[1];
        if (String(s[d.k]) === String(o[0])) b.className = 'on';
        b.disabled = !editable;
        b.addEventListener('click', function () {
          var patch = {}; patch[d.k] = o[0];
          RoomAPI.updateSettings(room.code, patch, function (err, r) {
            if (err) { alert(err); return; }
            room = r; renderRoom();
          });
        });
        seg.appendChild(b);
      });
      row.appendChild(seg);
      el.roomSettings.appendChild(row);
    });
  }

  function renameSelf() {
    openModal('改名字',
      '<input type="text" id="rename-input" class="text-input" maxlength="8" placeholder="新名字（最多 8 个字）" />',
      [
        { label: '取消', cls: 'btn-ghost', fn: closeModal },
        {
          label: '确定', cls: 'btn-primary', fn: function () {
            var inp = document.getElementById('rename-input');
            var v = (inp && inp.value || '').trim().slice(0, 8);
            if (!v) return;
            RoomAPI.rename(room.code, v, function (err, r) {
              if (err) { alert(err); return; }
              room = r; saveName(v); closeModal(); renderRoom();
            });
          }
        }
      ]);
  }

  /* ---- 多人游戏 ---- */
  function startMultiGame() {
    var s = room.settings;
    play = s.play;   // 多人时题目类型跟随房间设置，而不是首页的选择
    var pool = uniqByTitle(shuffle(poolForPlay(s.play)));
    if (pool.length < 4) { alert('这个玩法的题库不够'); return; }

    mState = { songId: null, pool: pool, cursor: 0, answered: 0, over: false };
    state = {
      allPool: pool, queue: [], used: {}, answered: 0, score: 0, right: 0,
      usedSec: 0, tStart: 0, current: null, over: false
    };
    el.hudScore.textContent = '0';
    el.hudRight.textContent = '0';
    el.dots.innerHTML = '';
    el.dots.hidden = true;
    el.liveRank.hidden = false;
    el.badge.textContent = '多人 · ' + PLAY_NAME[s.play] + ' · ' +
      (s.mode === 'speed' ? (s.rounds + ' 题') : (s.minutes + ' 分钟'));
    show('s-game');
    if (isHost()) hostPushNext();
    updateLiveRank();
  }

  function hostPushNext() {
    if (!isHost() || !mState || mState.over) return;
    var s = room.settings;
    if (s.mode === 'speed' && mState.cursor >= s.rounds) return RoomAPI.finish(room.code, function () {});
    if (s.mode === 'timed' && room.endsAt && Date.now() > room.endsAt) return RoomAPI.finish(room.code, function () {});
    if (mState.cursor >= mState.pool.length) return RoomAPI.finish(room.code, function () {});
    var song = mState.pool[mState.cursor++];
    RoomAPI.setSong(room.code, song.a + '|' + song.t, function () {});
  }

  /* 房主：等所有人答完（最多 9 秒）再推下一题 */
  function scheduleHostAdvance() {
    if (hostAdvTimer) { clearTimeout(hostAdvTimer); hostAdvTimer = null; }
    var t0 = Date.now();
    var tick = function () {
      if (!isHost() || !mState || mState.over || !isActive('s-game')) return;
      var idx = mState.cursor - 1;
      var allDone = room.players.every(function (p) { return p.answered > idx; });
      if (allDone || Date.now() - t0 > 9000) { hostPushNext(); return; }
      hostAdvTimer = setTimeout(tick, 500);
    };
    hostAdvTimer = setTimeout(tick, 900);
  }

  function showMultiQuestion(key) {
    var song = findSong(key);
    if (!song || !mState) return;
    mState.songId = key;
    var q = makeQuestion(song);
    if (!q) { if (isHost()) hostPushNext(); return; }
    state.current = q;
    renderQuestion();
  }

  function updateLiveRank() {
    if (!room || !el.liveRank) return;
    var list = room.players.slice().sort(function (a, b) { return b.score - a.score; });
    el.liveRank.innerHTML = '';
    list.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'lr-item' + (p.id === RoomAPI.myId() ? ' is-me' : '');
      var n = document.createElement('span'); n.className = 'lr-n'; n.textContent = p.name;
      var s = document.createElement('span'); s.className = 'lr-s'; s.textContent = fmt(p.score);
      d.appendChild(n); d.appendChild(s);
      el.liveRank.appendChild(d);
    });
  }

  function endMultiGame() {
    if (!state || state.over) return;
    state.over = true;
    stopTimer(); stopAudio();
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    if (hostAdvTimer) { clearTimeout(hostAdvTimer); hostAdvTimer = null; }
    isMulti = false;
    showBoard();
  }

  function showBoard() {
    var list = room.players.slice().sort(function (a, b) { return b.score - a.score; });
    var mvp = list[0], meP = null;
    list.forEach(function (p) { if (p.id === RoomAPI.myId()) meP = p; });

    el.rank.textContent = '🏁';
    el.rankLabel.textContent = '本局结束';
    el.finalScore.textContent = fmt(meP ? meP.score : 0);
    el.statRight.textContent = meP ? meP.right : 0;
    el.statTotal.textContent = meP ? meP.answered : 0;
    el.statAcc.textContent = (meP && meP.answered) ? Math.round(meP.right / meP.answered * 100) + '%' : '0%';

    el.board.hidden = false;
    el.board.innerHTML = '';
    if (mvp) {
      var b = document.createElement('div');
      b.className = 'mvp-banner';
      b.innerHTML = '<div class="mvp-t">👑 MVP</div><div class="mvp-n"></div>';
      b.querySelector('.mvp-n').textContent = mvp.name;
      el.board.appendChild(b);
    }
    list.forEach(function (p, i) {
      var row = document.createElement('div');
      row.className = 'board-row' + (i === 0 ? ' is-mvp' : '') + (p.id === RoomAPI.myId() ? ' is-me' : '');
      row.innerHTML = '<div class="b-rank"></div><div style="flex:1;min-width:0"><div class="b-name"></div><div class="b-sub"></div></div><div class="b-score"></div>';
      row.querySelector('.b-rank').textContent = i === 0 ? '👑' : String(i + 1);
      row.querySelector('.b-name').textContent = p.name;
      row.querySelector('.b-sub').textContent = '答对 ' + p.right + ' / ' + p.answered + ' 题';
      row.querySelector('.b-score').textContent = fmt(p.score);
      el.board.appendChild(row);
    });

    show('s-over');
    if (mvp && mvp.id === RoomAPI.myId()) confetti();
  }

  function leaveRoom() {
    if (room) RoomAPI.leave(room.code, function () {});
    stopRoomPoll();
    if (hostAdvTimer) { clearTimeout(hostAdvTimer); hostAdvTimer = null; }
    room = null; isMulti = false; mState = null;
    el.liveRank.hidden = true;
    el.board.hidden = true;
    show('s-start');
  }

  /* ================= 账号 ================= */
  var myUser = null;

  function refreshUserUI() {
    if (el.quizUser) el.quizUser.textContent = myUser ? ('👤 ' + myUser) : '未登录';
  }
  function goAccount() {
    show('s-login');
    if (el.accName) el.accName.value = UserAPI.savedName() || '';
    if (el.accPwd) el.accPwd.value = '';
    if (el.accHint) {
      el.accHint.classList.remove('is-warn');
      el.accHint.innerHTML = '轻量账号：密码只做简单哈希后存在公开频道上，<b>别用重要密码</b>。';
    }
  }
  function accWarn(msg, input) {
    if (el.accHint) {
      el.accHint.textContent = '⚠️ ' + msg;
      el.accHint.classList.add('is-warn');
    }
    if (input) {
      input.classList.add('is-error');
      try { input.focus(); } catch (e) {}
      setTimeout(function () { input.classList.remove('is-error'); }, 1500);
    }
    sfxWrong();
  }

  /* ================= 出题 / 答题 ================= */
  var mkPicked = [], mkPlay = 'sound', mkFill = 0;
  var currentQuizCode = null;
  var takeCtx = null;

  function goQuiz() {
    myUser = UserAPI.savedName() || null;
    refreshUserUI();
    show('s-quiz');
    renderPicked();
    if (el.tkHint) { el.tkHint.textContent = ''; el.tkHint.classList.remove('is-warn'); }
  }

  function renderPicked() {
    if (!el.mkCount) return;
    el.mkCount.textContent = '已选 ' + mkPicked.length + ' 首';
    el.mkPicked.innerHTML = '';
    mkPicked.forEach(function (s, i) {
      var d = document.createElement('div');
      d.className = 'picked-item';
      var t = document.createElement('span'); t.textContent = s.t;
      var b = document.createElement('button'); b.textContent = '✕'; b.title = '移除';
      b.addEventListener('click', function () { mkPicked.splice(i, 1); renderPicked(); });
      d.appendChild(t); d.appendChild(b);
      el.mkPicked.appendChild(d);
    });
  }

  function searchSongs(q) {
    q = (q || '').trim().toLowerCase();
    el.mkResults.innerHTML = '';
    if (!q) return;
    var hits = DB.filter(function (s) {
      return s.t.toLowerCase().indexOf(q) >= 0 || s.a.toLowerCase().indexOf(q) >= 0;
    }).slice(0, 20);
    if (!hits.length) {
      var e = document.createElement('p');
      e.className = 'empty-tip'; e.textContent = '没搜到，换个词试试';
      el.mkResults.appendChild(e);
      return;
    }
    hits.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'song-item';
      b.innerHTML = '<span class="si-t"></span><span class="si-a"></span><span class="si-add">＋</span>';
      b.querySelector('.si-t').textContent = s.t;
      b.querySelector('.si-a').textContent = s.a;
      b.addEventListener('click', function () {
        if (mkPicked.some(function (x) { return x.a === s.a && x.t === s.t; })) return;
        mkPicked.push({ a: s.a, t: s.t });
        renderPicked();
        sfxTap();
      });
      el.mkResults.appendChild(b);
    });
  }

  function renderQuizResults(code, res) {
    if (code !== currentQuizCode) return;
    var list = Object.keys(res || {}).map(function (k) { return res[k]; })
      .sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    el.mkRcount.textContent = list.length + ' 人';
    el.mkResultsList.innerHTML = '';
    if (!list.length) {
      var e = document.createElement('p');
      e.className = 'empty-tip'; e.textContent = '还没人作答';
      el.mkResultsList.appendChild(e);
      return;
    }
    list.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'result-row';
      d.innerHTML = '<div style="flex:1;min-width:0"><div class="rr-n"></div><div class="rr-s"></div></div><div class="rr-v"></div>';
      d.querySelector('.rr-n').textContent = r.player;
      d.querySelector('.rr-s').textContent = '答对 ' + r.right + '/' + r.total;
      d.querySelector('.rr-v').textContent = fmt(r.score);
      el.mkResultsList.appendChild(d);
    });
  }

  function startTakeQuiz(code, paper) {
    var pool = [];
    (paper.songs || []).forEach(function (x) {
      var s = findSong(x.a + '|' + x.t);
      if (s) pool.push(s);
    });
    if (!pool.length) { alert('这份题卷是空的'); return; }

    takeCtx = { code: code, paper: paper };
    play = paper.play;
    fill = !!paper.fill;
    isMulti = false; room = null; mState = null;
    stopRoomPoll();
    if (hostAdvTimer) { clearTimeout(hostAdvTimer); hostAdvTimer = null; }

    el.liveRank.hidden = true;
    el.board.hidden = true;
    state = {
      allPool: uniqByTitle(DB.slice()),
      queue: shuffle(pool.slice()),
      used: {},
      answered: 0, score: 0, right: 0,
      usedSec: 0, tStart: 0, current: null, over: false,
      total: pool.length, take: true
    };
    el.hudScore.textContent = '0';
    el.hudRight.textContent = '0';
    el.dots.innerHTML = '';
    el.dots.hidden = false;
    pool.forEach(function () { var d = document.createElement('span'); d.className = 'dot'; el.dots.appendChild(d); });
    el.badge.textContent = '答题 · ' + (PLAY_NAME[paper.play] || '') + ' · 出题人 ' + (paper.author || '匿名');
    show('s-game');
    nextQuestion();
  }

  /* ---------------- 事件 ---------------- */
  el.poolTiles.forEach(function (t) {
    t.addEventListener('click', function () {
      el.poolTiles.forEach(function (x) { x.classList.remove('is-active'); });
      t.classList.add('is-active');
      pool = t.getAttribute('data-pool');
    });
  });
  el.playTiles.forEach(function (t) {
    t.addEventListener('click', function () {
      el.playTiles.forEach(function (x) { x.classList.remove('is-active'); });
      t.classList.add('is-active');
      play = t.getAttribute('data-play');
    });
  });
  function toggleSwitch(node, cb) {
    node.addEventListener('click', function () {
      var on = node.getAttribute('aria-pressed') === 'true';
      node.setAttribute('aria-pressed', on ? 'false' : 'true');
      cb(!on);
    });
  }
  toggleSwitch(el.swFill, function (v) { fill = v; });
  toggleSwitch(el.swEndless, function (v) { endless = v; });

  el.btnStart.addEventListener('click', startGame);
  el.btnAgain.addEventListener('click', function () {
    if (room) { show('s-room'); renderRoom(); return; }   // 多人：回房间等下一局
    startGame();
  });
  el.btnHome.addEventListener('click', function () {
    if (room) { leaveRoom(); return; }
    show('s-start');
  });
  el.disc.addEventListener('click', playClip);
  el.btnListen.addEventListener('click', playClip);
  el.btnRules.addEventListener('click', function () { openModal('📖 规则说明', rulesHTML()); });
  el.btnScores.addEventListener('click', showScores);
  el.modalClose.addEventListener('click', closeModal);
  el.modal.addEventListener('click', function (e) { if (e.target === el.modal) closeModal(); });

  /* ---- 多人事件 ---- */
  el.btnMulti.addEventListener('click', goLobby);
  el.btnLobbyBack.addEventListener('click', function () { show('s-start'); });
  el.joinCode.addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  function lobbyWarn(msg, input) {
    if (el.lobbyHint) {
      el.lobbyHint.textContent = msg;
      el.lobbyHint.classList.add('is-warn');
    }
    if (input) {
      input.classList.add('is-error');
      try { input.focus(); } catch (e) {}
      setTimeout(function () { input.classList.remove('is-error'); }, 1500);
    }
    sfxWrong();
  }
  function lobbyInfo(msg) {
    if (!el.lobbyHint) return;
    el.lobbyHint.classList.remove('is-warn');
    el.lobbyHint.textContent = msg;
  }

  el.btnCreate.addEventListener('click', function () {
    var name = (el.lobbyName.value || '').trim().slice(0, 8);
    if (!name) return lobbyWarn('⚠️ 请先输入你的名字', el.lobbyName);
    saveName(name);
    lobbyInfo('正在创建房间…');
    RoomAPI.create(name, function (err, r) {
      if (err) return lobbyWarn('⚠️ ' + err);
      lobbyInfo('房间码发给朋友，他们在自己手机上输码就能进来。');
      enterRoom(r);
    });
  });

  el.btnJoin.addEventListener('click', function () {
    var name = (el.lobbyName.value || '').trim().slice(0, 8);
    var code = (el.joinCode.value || '').trim().toUpperCase();
    if (!name) return lobbyWarn('⚠️ 请先输入你的名字', el.lobbyName);
    if (code.length !== 6) return lobbyWarn('⚠️ 房间码是 6 位', el.joinCode);
    saveName(name);
    lobbyInfo('正在加入…');
    RoomAPI.join(code, name, function (err, r) {
      if (err) return lobbyWarn('⚠️ ' + err);
      lobbyInfo('');
      enterRoom(r);
    });
  });

  el.lobbyName.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (el.joinCode) el.joinCode.focus(); }
  });
  el.joinCode.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); el.btnJoin.click(); }
  });

  el.btnRoomStart.addEventListener('click', function () {
    if (!isHost()) return;
    RoomAPI.start(room.code, function (err) { if (err) alert(err); });
  });

  el.btnRoomLeave.addEventListener('click', function () {
    openModal('离开房间？', '<p class="empty-tip">离开后要重新输入房间码才能回来。</p>', [
      { label: '再玩会儿', cls: 'btn-ghost', fn: closeModal },
      { label: '离开', cls: 'btn-primary', fn: function () { closeModal(); leaveRoom(); } }
    ]);
  });

  /* ---- 账号事件 ---- */
  el.btnAccount.addEventListener('click', goAccount);
  el.btnLoginBack.addEventListener('click', function () { show('s-start'); });
  el.btnLogin.addEventListener('click', function () {
    var n = (el.accName.value || '').trim().slice(0, 12);
    var p = (el.accPwd.value || '');
    if (!n) return accWarn('请输入用户名', el.accName);
    if (!p) return accWarn('请输入密码', el.accPwd);
    el.btnLogin.disabled = true;
    UserAPI.login(n, p, function (err) {
      el.btnLogin.disabled = false;
      if (err) return accWarn(err);
      myUser = n; refreshUserUI();
      openModal('登录成功', '<p class="empty-tip">欢迎回来，「' + n + '」</p>');
    });
  });
  el.btnRegister.addEventListener('click', function () {
    var n = (el.accName.value || '').trim().slice(0, 12);
    var p = (el.accPwd.value || '');
    if (!n) return accWarn('请输入用户名', el.accName);
    if (p.length < 4) return accWarn('密码至少 4 位', el.accPwd);
    el.btnRegister.disabled = true;
    UserAPI.register(n, p, function (err) {
      el.btnRegister.disabled = false;
      if (err) return accWarn(err);
      myUser = n; refreshUserUI();
      openModal('注册成功', '<p class="empty-tip">已登录为「' + n + '」</p>');
    });
  });

  /* ---- 出题 / 答题事件 ---- */
  el.btnQuiz.addEventListener('click', goQuiz);
  el.btnQuizBack.addEventListener('click', function () { show('s-start'); });
  el.quizTabs.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    Array.prototype.forEach.call(el.quizTabs.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    var tab = b.getAttribute('data-tab');
    el.paneMake.hidden = tab !== 'make';
    el.paneTake.hidden = tab !== 'take';
  });
  el.mkPlay.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    Array.prototype.forEach.call(el.mkPlay.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
    b.classList.add('on'); mkPlay = b.getAttribute('data-v');
  });
  el.mkFill.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    Array.prototype.forEach.call(el.mkFill.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
    b.classList.add('on'); mkFill = parseInt(b.getAttribute('data-v'), 10);
  });
  el.mkSearch.addEventListener('input', function () { searchSongs(this.value); });
  el.btnMake.addEventListener('click', function () {
    if (!mkPicked.length) return alert('先挑至少 1 首歌');
    if (!myUser) { openModal('还没登录', '<p class="empty-tip">出题需要一个用户名，去「账号」里注册或登录一下。</p>'); return; }
    el.btnMake.disabled = true;
    UserAPI.publishQuiz({ author: myUser, play: mkPlay, fill: mkFill === 1, songs: mkPicked.slice() }, function (err, p) {
      el.btnMake.disabled = false;
      if (err) return alert(err);
      currentQuizCode = p.code;
      el.mkCode.textContent = p.code;
      el.mkCodeBox.hidden = false;
      el.mkResultBlock.hidden = false;
      UserAPI.watchResults(p.code, renderQuizResults);
    });
  });
  el.tkCode.addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  el.btnTake.addEventListener('click', function () {
    var code = (el.tkCode.value || '').trim().toUpperCase();
    if (code.length !== 6) {
      el.tkHint.textContent = '⚠️ 答题码是 6 位';
      el.tkHint.classList.add('is-warn');
      sfxWrong();
      return;
    }
    el.tkHint.classList.remove('is-warn');
    el.tkHint.textContent = '正在获取题卷…';
    UserAPI.fetchQuiz(code, function (err, paper) {
      if (err) {
        el.tkHint.textContent = '⚠️ ' + err;
        el.tkHint.classList.add('is-warn');
        return;
      }
      el.tkHint.textContent = '';
      startTakeQuiz(code, paper);
    });
  });

  el.btnQuit.addEventListener('click', function () {
    if (isMulti) {
      openModal('退出对局？', '<p class="empty-tip">退出后你会离开这个房间。</p>', [
        { label: '继续玩', cls: 'btn-ghost', fn: closeModal },
        { label: '退出房间', cls: 'btn-primary', fn: function () { closeModal(); leaveRoom(); } }
      ]);
      return;
    }
    if (!state || state.over) { show('s-start'); return; }
    openModal('退出本局？', '<p class="empty-tip">当前得分 ' + fmt(state.score) + ' 分，退出后会结算。</p>', [
      { label: '继续玩', cls: 'btn-ghost', fn: closeModal },
      { label: '退出并结算', cls: 'btn-primary', fn: function () { closeModal(); endGame('主动退出'); } }
    ]);
  });

  function submitFill() {
    if (locked || !state || !state.current || !fill) return;
    var v = el.fillInput.value;
    if (!v.trim()) return;
    el.fillInput.disabled = true;
    el.btnSubmit.disabled = true;
    judge(normTitle(v) === normTitle(state.current.correct.t), v);
  }
  el.btnSubmit.addEventListener('click', submitFill);
  el.fillInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitFill(); }
  });

  /* 音量（记忆上次设置） */
  var VOL_KEY = 'gs_volume';
  function applyVolume(v) {
    var val = parseInt(v, 10);
    if (isNaN(val)) val = 100;
    val = Math.max(0, Math.min(100, val));
    try { audio.volume = val / 100; } catch (e) {}
    if (el.volume) el.volume.value = String(val);
    if (el.volIco) el.volIco.textContent = val === 0 ? '🔇' : (val < 50 ? '🔉' : '🔊');
    try { window.localStorage.setItem(VOL_KEY, String(val)); } catch (e) {}
  }
  var savedVol = 100;
  try { savedVol = parseInt(window.localStorage.getItem(VOL_KEY) || '100', 10); } catch (e) {}
  applyVolume(savedVol);
  if (el.volume) {
    el.volume.addEventListener('input', function () { applyVolume(this.value); });
  }

  window.addEventListener('pagehide', function () { try { audio.pause(); } catch (e) {} });

  refreshCounts();
  var ld = document.getElementById('loading');
  if (ld) setTimeout(function () { ld.classList.add('hide'); }, 260);
})();
