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
    modalActions: $('modal-actions'), modalClose: $('modal-close')
  };

  var audio = new Audio();
  audio.preload = 'auto';

  var pool = 'zh', play = 'intro', fill = false, endless = false;
  var POOL_NAME = { jay: '周杰伦专项', zh: '国语专项', yue: '粤语专项' };
  var PLAY_NAME = { intro: '前奏猜歌', random: '随机猜歌', lyric: '歌词猜歌' };

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
    if (!endless && state.answered >= TOTAL) { endGame(); return; }
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
      var start = 0;
      if (play === 'random' || play === 'lyric') {
        start = Math.max(0, Math.random() * Math.max(1, d - 15));
      }
      try { audio.currentTime = start; } catch (e) {}
      var pr = audio.play();
      var ok = function () {
        el.disc.classList.add('is-playing');
        el.discIco.textContent = '❚❚';
        el.playerTip.textContent = play === 'intro' ? '🎵 播放中（试听片段）' : '🎵 播放中…';
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

    if (isRight) {
      var gain = scoreFor(state.usedSec);
      if (fill) gain *= 2;
      state.score += gain;
      state.right++;
      sfxRight();
      popScore('+' + fmt(gain));
      el.playerTip.textContent = '✅ 答对！+' + fmt(gain) + ' 分';
      markDot(true);
      updateHud();
      nextTimer = setTimeout(nextQuestion, 620);   // 直接进入下一题
    } else {
      sfxWrong();
      el.playerTip.textContent = isTimeout
        ? ('⏰ 超时了 · 正确答案：' + q.correct.a + '《' + q.correct.t + '》')
        : ('❌ 答错了 · 正确答案：' + q.correct.a + '《' + q.correct.t + '》');
      revealAnswer(userText);
      markDot(false);
      updateHud();
      nextTimer = setTimeout(nextQuestion, 3000);  // 3 秒后下一题
    }
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
    el.playerTip.textContent = isLyric ? '根据歌词猜歌名'
      : (play === 'intro' ? '点击播放（试听片段，非完整前奏）' : '点击唱片播放片段');
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

    el.rank.textContent = r;
    el.rankLabel.textContent = reason ? (reason + ' · ' + label) : label;
    el.finalScore.textContent = fmt(state.score);
    el.statRight.textContent = state.right;
    el.statTotal.textContent = state.answered;
    el.statAcc.textContent = acc + '%';
    show('s-over');
    if (ratio >= 0.7 && state.answered >= 5) confetti();
  }

  /* ---------------- 开始 ---------------- */
  function startGame() {
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
  el.btnAgain.addEventListener('click', startGame);
  el.btnHome.addEventListener('click', function () { show('s-start'); });
  el.disc.addEventListener('click', playClip);
  el.btnListen.addEventListener('click', playClip);
  el.btnRules.addEventListener('click', function () { openModal('📖 规则说明', rulesHTML()); });
  el.btnScores.addEventListener('click', showScores);
  el.modalClose.addEventListener('click', closeModal);
  el.modal.addEventListener('click', function (e) { if (e.target === el.modal) closeModal(); });

  el.btnQuit.addEventListener('click', function () {
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
