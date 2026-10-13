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
    artistGroup: $('artist-group'), artistChips: $('artist-chips'), artistHint: $('artist-hint'),
    swFill: $('sw-fill'), swEndless: $('sw-endless'),
    btnStart: $('btn-start'), btnAgain: $('btn-again'), btnHome: $('btn-home'),
    btnRules: $('btn-rules'), btnScores: $('btn-scores'), btnQuit: $('btn-quit'),
    badge: $('badge'),
    hudIdx: $('hud-idx'), hudScore: $('hud-score'), hudRight: $('hud-right'),
    disc: $('disc'), discIco: $('disc-ico'),
    lyricBox: $('lyric-box'), lyricText: $('lyric-text'), btnListen: $('btn-listen'),
    playerTip: $('player-tip'), timerFill: $('timer-fill'), timer: $('timer'),
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
    btnRoomStart: $('btn-room-start'), roomHint: $('room-hint'), roomLog: $('room-log'),
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
    tkCode: $('tk-code'), btnTake: $('btn-take'), tkHint: $('tk-hint'),
    // 个人主页
    btnProfileBack: $('btn-profile-back'),
    pfAvatar: $('pf-avatar'), pfNick: $('pf-nick'), pfAccount: $('pf-account'),
    pfAvatars: $('pf-avatars'), pfNickInput: $('pf-nick-input'), btnPfNick: $('btn-pf-nick'),
    pfScCount: $('pf-sc-count'), pfScores: $('pf-scores'), btnLogout: $('btn-logout'),
    // 等级 / 经验
    pfLv: $('pf-lv'), pfLvTitle: $('pf-lv-title'), pfExp: $('pf-exp'),
    pfLvFill: $('pf-lv-fill'), pfLvTip: $('pf-lv-tip'),
    btnCheckin: $('btn-checkin'), pfCheckinTip: $('pf-checkin-tip'),
    acctLv: $('acct-lv'),
    // 好友
    btnFriends: $('btn-friends'), frMe: $('fr-me'), btnFriendsBack: $('btn-friends-back'),
    friendTabs: $('friend-tabs'),
    paneFlist: $('pane-flist'), paneFadd: $('pane-fadd'), paneFreq: $('pane-freq'),
    friendList: $('friend-list'),
    frSearch: $('fr-search'), btnFrSearch: $('btn-fr-search'), frSearchResult: $('fr-search-result'),
    blCount: $('bl-count'), blList: $('bl-list'),
    reqBadge: $('req-badge'), reqList: $('req-list'),
    // 多人：已登录提示
    lobbyNameGroup: $('lobby-name-group'), lobbyAs: $('lobby-as'),
    // 聊天
    btnChatBack: $('btn-chat-back'), chatAv: $('chat-av'), chatName: $('chat-name'),
    btnChatMore: $('btn-chat-more'), chatBody: $('chat-body'),
    emojiRow: $('emoji-row'), btnEmoji: $('btn-emoji'),
    chatText: $('chat-text'), btnChatSend: $('btn-chat-send'),
    // 首页账号胶囊
    acctChip: $('acct-chip'), acctAv: $('acct-av'), acctNick: $('acct-nick'),
    // 首页：宠物 / 金币 / 签到 / 每日挑战 / 商店
    petEmoji: $('pet-emoji'), petName: $('pet-name'), petNote: $('pet-note'),
    homeLv: $('home-lv'), homeLvFill: $('home-lv-fill'), homeCoins: $('home-coins'),
    btnHomeCheckin: $('btn-home-checkin'), homeCheckinTip: $('home-checkin-tip'),
    btnShop: $('btn-shop'), btnDaily: $('btn-daily'), dailyLeft: $('daily-left'),
    itemBar: $('item-bar'),
    // 新排版：金币胶囊 / 更多选项 / 商店页
    coinChip: $('coin-chip'), btnMore: $('btn-more'), moreOpts: $('more-opts'),
    artistHint: $('artist-hint'),
    btnShopBack: $('btn-shop-back'), shopCoins: $('shop-coins'),
    shopTabs: $('shop-tabs'), shopBody: $('shop-body')
  };

  var audio = new Audio();
  audio.preload = 'auto';

  var pool = 'artist', play = 'sound', fill = false, endless = false;
  /* 歌手专项支持多选：artistPicks 是 { 歌手名: 1 } */
  var artistPicks = { '周杰伦': 1 };
  function pickedArtists() {
    return artistStats().filter(function (x) { return artistPicks[x.name]; })
      .map(function (x) { return x.name; });
  }
  function artistPoolName() {
    var a = pickedArtists();
    if (a.length === 1) return a[0] + '专项';
    return '歌手专项(' + a.length + '位)';
  }
  var POOL_NAME = { artist: '歌手专项', zh: '国语专项', yue: '粤语专项', car: '车载经典', douyin: '抖音热门' };
  var PLAY_NAME = { sound: '听声猜歌', lyric: '看词猜歌', singer: '听歌猜歌手' };
  var LYRIC_HIT = 5;      // 看词猜歌：直接答对
  var LYRIC_PLAYED = 1;   // 看词猜歌：听了音乐才答对
  /* ---------------- 热门歌手（63 位） ----------------
     两个用途：
       1) 「歌手专项」里列出来的就是这 63 位
       2) 难度「简单」只出这 63 位歌手的歌
     列表按「普通人叫得出名字」来挑，覆盖国语 + 粤语。 */
  var HOT_ARTISTS = [
    // 国语 / 华语
    '周杰伦', '林俊杰', '王力宏', '陈奕迅', '张学友', '邓紫棋', '薛之谦', '陶喆',
    '五月天', '王菲', '张惠妹', '蔡依林', 'S.H.E', '田馥甄', '张韶涵', '梁静茹',
    '刘若英', '周华健', '李宗盛', '罗大佑', '邓丽君', '那英', '汪峰', '许嵩',
    '汪苏泷', '华晨宇', '周深', '毛不易', '李荣浩', '任贤齐', '张信哲', '伍佰',
    '张宇', '林宥嘉', '杨丞琳', '萧敬腾', '苏打绿', '陈绮贞', '周传雄', '张震岳',
    // 粤语 / 港乐
    '刘德华', '黎明', '郭富城', '张国荣', '梅艳芳', '谭咏麟', 'Beyond', '李克勤',
    '容祖儿', '杨千嬅', '郑秀文', '陈慧琳', 'Twins', '谢霆锋', '张敬轩', '谢安琪',
    '卫兰', '陈慧娴', '叶倩文', '林忆莲', '古巨基', '周柏豪', '许志安',
    // 偶像团体
    'TFBOYS', '时代少年团'
  ];
  var HOT_SET = {};
  HOT_ARTISTS.forEach(function (a) { HOT_SET[a] = 1; });

  var DIFF_NAME = { easy: '简单', normal: '普通', hard: '困难' };

  function popOf(s) { return s.pop || 3; }   // 3=热门 2=中等 1=冷门

  var state = null, rafId = null, locked = false, nextTimer = null;

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
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

  /* 专题标签：s.tg 形如 'car' / 'douyin' / 'car,douyin' */
  function hasTag(s, tag) { return !!(s.tg && s.tg.indexOf(tag) >= 0); }

  function poolOf(p) {
    if (p === 'artist') return DB.filter(function (s) { return artistPicks[s.a]; });
    if (p === 'yue') return DB.filter(function (s) { return s.l === 'yue'; });
    if (p === 'car') return DB.filter(function (s) { return hasTag(s, 'car'); });
    if (p === 'douyin') return DB.filter(function (s) { return hasTag(s, 'douyin'); });
    return DB.filter(function (s) { return s.l !== 'yue'; });
  }
  function gamePool() {
    var p = poolOf(pool);
    if (play === 'lyric') p = p.filter(lyricOK);
    if (play === 'singer') {
      // 听歌猜歌手：库里至少要有 4 位不同歌手，不然出不了题
      var arts = {};
      p.forEach(function (s) { arts[s.a] = 1; });
      if (Object.keys(arts).length < 4) p = poolOf('zh');
    }
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
    var isSinger = (play === 'singer');
    var key = isSinger ? 'a' : 't';
    var dis = [], taken = {}, cand = shuffle(p);
    taken[correct[key]] = 1;
    for (var j = 0; j < cand.length && dis.length < 3; j++) {
      if (taken[cand[j][key]]) continue;
      taken[cand[j][key]] = 1;
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
      var item = state.queue.pop();
      var s = item.s || item;
      if (state.used[s.t]) continue;
      state.used[s.t] = 1;
      // 每日挑战：每题的玩法不一样
      if (item.m) play = item.m;
      else if (state.basePlay) play = state.basePlay;
      q = makeQuestion(s);
      if (q) break;
    }
    if (!q) { endGame('题库用完啦'); return; }
    state.current = q;
    renderQuestion();
    renderItemBar();
  }

  /* 歌词是否够看：必须能凑出两行有内容的，否则「看词猜歌」会出现空白 */
  function lyricLines(s) {
    return String((s && s.ly) || '').split('\n')
      .map(function (x) { return x.trim(); })
      .filter(function (x) {
        return x.length >= 5 && x.indexOf('[') !== 0 && x.indexOf('（') !== 0;
      });
  }
  function lyricOK(s) { return lyricLines(s).length >= 2; }

  function lyricHint(song) {
    var lines = lyricLines(song);
    if (lines.length < 2) return '';
    var start = Math.floor(Math.random() * Math.max(1, lines.length - 2));
    return lines.slice(start, start + 2).join('\n');
  }

  /* ---------------- 音频 ---------------- */
  function stopAudio() {
    try { audio.pause(); } catch (e) {}
    el.disc.classList.remove('is-playing');
    el.discIco.textContent = '▶';
  }

  /* 点唱片：播放 / 暂停 / 继续 / 重播 */
  function togglePlay() {
    if (locked || !state || !state.current) return;
    var song = state.current.correct;

    // 正在放 → 暂停
    if (el.disc.classList.contains('is-playing')) {
      try { audio.pause(); } catch (e) {}
      el.disc.classList.remove('is-playing');
      el.discIco.textContent = '▶';
      el.playerTip.textContent = '⏸ 已暂停 · 再点一下继续';
      return;
    }

    var resume = (audio.src === song.p) && audio.currentTime > 0 && !audio.ended && !audio.__done;

    var start = function (fromScratch) {
      if (fromScratch) {
        var d = audio.duration || 30;
        var pos = Math.max(0, Math.random() * Math.max(1, d - 15));
        try { audio.currentTime = pos; } catch (e) {}
      }
      var pr = audio.play();
      var ok = function () {
        if (state) state.played = true;    // 看词猜歌：听过音乐就只能拿 1 分
        audio.__done = false;
        el.disc.classList.add('is-playing');
        el.discIco.textContent = '❚❚';
        el.playerTip.textContent = '🎵 播放中（再点一下暂停）';
      };
      var bad = function () { el.playerTip.textContent = '播放失败，再点一次'; };
      if (pr && pr.then) pr.then(ok).catch(bad); else ok();
    };

    var fail = function () {
      el.playerTip.textContent = '这首加载不出来，自动跳过…';
      setTimeout(function () { if (!locked) judge(false, null); }, 700);
    };

    if (audio.src !== song.p) audio.src = song.p;

    if (resume) { start(false); return; }          // 接着上次的位置继续
    if (audio.readyState >= 1) start(true);
    else {
      audio.addEventListener('loadedmetadata', function () { start(true); }, { once: true });
      audio.addEventListener('error', fail, { once: true });
      audio.load();
    }
  }

  /* ---------------- 计时 ---------------- */
  /* 答错后的「N 秒后下一题」倒计时 */
  var cdTimer = null;
  function stopCountdown() { if (cdTimer) { clearInterval(cdTimer); cdTimer = null; } }
  function countdownNext(sec, tipPrefix) {
    stopCountdown();
    var left = sec;
    var step = function () {
      if (left <= 0) {
        stopCountdown();
        if (isMulti && mState) renderMultiQuestion(); else nextQuestion();
        return;
      }
      el.playerTip.textContent = tipPrefix + ' · ' + left + ' 秒后下一题';
      left--;
    };
    step();
    cdTimer = setInterval(step, 1000);
  }

  function startTimer() {
    stopTimer();
    stopCountdown();
    state.tStart = performance.now();
    if (play === 'lyric') {
      // 看词猜歌不限时
      state.usedSec = 0;
      el.timerFill.style.width = '100%';
      el.timerFill.classList.remove('is-low');
      if (el.timer) el.timer.classList.add('is-off');
      return;
    }
    if (el.timer) el.timer.classList.remove('is-off');
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
    stopTimer();
    stopAudio();
    el.disc.classList.add('is-done');

    var q = state.current;

    /* 💖 「再来一次」：手里有这个道具，答错自动用掉，这道题不算输 */
    if (!isRight && !isTimeout && !fill && !q.revived && itemCount('revive') > 0) {
      q.revived = true;
      UserAPI.useItem('revive', function (err, rec) {
        if (err) { alert(err); return; }
        if (rec) { myProfile = rec; renderItemBar(); }
        sfxRight();
        expToast('💖 用了「再来一次」，这道题不算错！');
      });
      locked = false;
      var ob = el.options.querySelectorAll('.opt');
      for (var bi = 0; bi < ob.length; bi++) {
        if (ob[bi].textContent === userText) {
          ob[bi].classList.add('is-dim', 'is-gone');
          ob[bi].disabled = true;
        }
      }
      el.playerTip.textContent = '💖 再来一次，还有机会！';
      return;
    }

    locked = true;
    state.answered++;

    // 答题模式：记下这题的作答明细，出题人那边能看到「你答了什么 / 正确答案是什么」
    if (state.take && state.detail && state.detail.length < 60) {
      state.detail.push({
        k: q.correct.a + '|' + q.correct.t,
        ok: isRight ? 1 : 0,
        p: String(userText == null ? '' : userText).slice(0, 30),
        s: Math.round(state.usedSec || 0)
      });
    }

    var wrongTip = '';
    var gain = 0;
    if (isRight) {
      if (play === 'lyric') {
        // 看词猜歌：不限时。直接答对 +5；听了音乐才答对 +1
        gain = state.played ? LYRIC_PLAYED : LYRIC_HIT;
      } else {
        gain = scoreFor(state.usedSec);
      }
      if (fill) gain *= 2;   // 填空：单人和多人都是双倍
      state.score += gain;
      state.right++;
      sfxRight();
      popScore('+' + fmt(gain));
      if (state.daily) {
        var cg = (window.Economy && window.Economy.DAILY_COINS[play]) || 0;
        state.daily.coins += cg;
        el.playerTip.textContent = '✅ 答对！+' + fmt(gain) + ' 分 · <b>+' + cg + ' 金币 🪙</b>';
      } else {
        el.playerTip.textContent = '✅ 答对！+' + fmt(gain) + ' 分';
      }
      markDot(true);
    } else {
      sfxWrong();
      var ans = (play === 'singer') ? ('正确答案：' + q.correct.a) : ('正确答案：' + q.correct.a + '《' + q.correct.t + '》');
      wrongTip = (isTimeout ? '⏰ 超时了 · ' : '❌ 答错了 · ') + ans + (state.daily ? ' · 本题 0 金币' : '');
      el.playerTip.textContent = wrongTip;
      revealAnswer(userText);
      markDot(false);
    }
    updateHud();

    if (isMulti && mState) {
      // 多人：分数交给房主，题目节奏每个人自己走（不等别人）
      RoomAPI.submit(room.code, { score: gain, right: isRight ? 1 : 0 }, function () {});
      if (isHost()) setTimeout(hostCheckEnd, 300);
      if (isRight) nextTimer = setTimeout(renderMultiQuestion, 620);
      else countdownNext(3, wrongTip);
      return;
    }
    if (isRight) nextTimer = setTimeout(nextQuestion, 620);
    else countdownNext(3, wrongTip);
  }

  function revealAnswer(userText) {
    var q = state.current;
    if (fill) {
      el.fillInput.value = '';
      el.fillInput.placeholder = (play === 'singer') ? q.correct.a : q.correct.t;
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
    // total 为 0 / 空 = 不限题数（无限模式、限时对战）
    if (endless || !state.total) {
      el.hudIdx.textContent = '第 ' + no + ' 题';
    } else {
      el.hudIdx.textContent = Math.min(no, state.total) + '/' + state.total;
    }
  }

  /* ---------------- 渲染 ---------------- */
  function renderQuestion() {
    locked = false;
    stopCountdown();
    var q = state.current;
    var isLyric = play === 'lyric';

    el.disc.classList.remove('is-playing', 'is-done');
    el.discIco.textContent = '▶';
    el.timerFill.style.width = '100%';
    el.timerFill.classList.remove('is-low');
    state.usedSec = 0;
    state.played = false;
    audio.__done = false;

    el.disc.hidden = isLyric;
    el.lyricBox.hidden = !isLyric;
    el.playerTip.textContent = isLyric ? '根据歌词猜歌名（不限时）'
      : (play === 'singer' ? '点击播放片段，猜是哪位歌手' : '点击播放片段');
    var lyrHint = isLyric ? lyricHint(q.correct) : '';
    el.lyricText.textContent = lyrHint;

    // 选项 / 填空
    el.options.hidden = fill;
    el.fillArea.hidden = !fill;
    el.options.innerHTML = '';
    if (fill) {
      el.fillInput.value = '';
      el.fillInput.placeholder = (play === 'singer' ? '输入歌手名后按回车' : '输入歌名后按回车');
      el.fillInput.classList.remove('is-reveal');
      el.fillInput.disabled = false;
      el.btnSubmit.disabled = false;
    } else {
      q.opts.forEach(function (s, i) {
        var b = document.createElement('button');
        b.className = 'opt';
        b.setAttribute('data-k', 'ABCD'[i] || '');
        b.textContent = (play === 'singer') ? s.a : s.t;
        b.addEventListener('click', function () { judge(s === q.correct, b.textContent); });
        el.options.appendChild(b);
      });
    }

    if (state.daily && el.badge) {
      el.badge.textContent = '🎯 每日挑战 · ' + (state.answered + 1) + '/' + state.total +
        ' · ' + PLAY_NAME[play] + ' · 答对 +' + ((window.Economy && Economy.DAILY_COINS[play]) || 0) + ' 金币';
    }

    if (!endless) {
      for (var i = 0; i < el.dots.children.length; i++)
        el.dots.children[i].classList.toggle('is-now', i === state.answered);
    }

    updateHud();
    startTimer();

    // 兜底：万一挑到没有可用歌词的歌，别让玩家对着空白发呆
    if (isLyric && !lyrHint) {
      locked = true;
      el.lyricText.textContent = '（这首歌没有可用的歌词，马上换下一题）';
      if (nextTimer) clearTimeout(nextTimer);
      nextTimer = setTimeout(function () {
        if (isMulti && mState) renderMultiQuestion(); else nextQuestion();
      }, 900);
    }
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
      '<li><b>曲库</b>：歌手专项（挑一位歌手，只听他/她的歌）/ 国语专项 / 粤语专项</li>' +
      '<li><b>玩法</b>：听声猜歌（听片段猜歌名）、看词猜歌（看歌词猜歌名）、听歌猜歌手（听片段猜是哪位歌手）</li>' +
      '<li>「听歌猜歌手」会自动切到国语/粤语曲库，因为需要多位歌手</li>' +
      '</ul>' +
      '<h4>🎵 听声猜歌 / 听歌猜歌手 · 计分</h4>' +
      '<ul>' +
      '<li>点唱片播放，<b>再点一下暂停</b>，再点继续（放完可以重播）</li>' +
      '<li>每题最长 30 秒，超时算答错</li>' +
      '<li>答对按用时给分 —— <span class="hl">3 秒内 5 分</span>、8 秒内 3 分、15 秒内 1 分、更久 0.5 分</li>' +
      '</ul>' +
      '<h4>📖 看词猜歌 · 计分</h4>' +
      '<ul>' +
      '<li><b>不限时</b>，慢慢想，答出来就算</li>' +
      '<li>直接答对 <span class="hl">+5 分</span></li>' +
      '<li>如果点了「听一下这段」再答对，只 <span class="hl">+1 分</span></li>' +
      '</ul>' +
      '<h4>✍️ 挑战选项</h4>' +
      '<ul>' +
      '<li><b>填空作答</b>：不给选项，自己打出歌名，完全正确才算对，<span class="hl">得分 ×2</span></li>' +
      '<li><b>无限模式</b>：题目一直出，直到你点「退出」或曲库用完；可与填空叠加</li>' +
      '</ul>' +
      '<h4>📊 通用规则</h4>' +
      '<ul>' +
      '<li>每题<b>只有一次</b>作答机会</li>' +
      '<li>答错：<b>不扣分</b>，亮出正确答案，3 秒后进入下一题</li>' +
      '<li>普通模式每局 10 题</li>' +
      '</ul>' +
      '<h4>🎮 多人对战</h4>' +
      '<ul>' +
      '<li>房主建房，把 6 位房间码发给朋友，输码进来</li>' +
      '<li>只有房主能改设置：玩法、题目数量 / 时长、题目类型、<b>曲库（含歌手专项）</b>、<b>难度</b></li>' +
      '<li><b>难度</b>：简单只出很热门的歌，普通放宽一档，困难全部歌曲都出</li>' +
      '<li><b>各答各的</b>：每个人按自己的节奏答题，不用等别人；答完 / 时间到会显示「等其他人」</li>' +
      '<li>登录后自动用你的昵称，不用再起名字</li>' +
      '<li>结束后按分数排名，第一名是 MVP</li>' +
      '</ul>' +
      '<h4>👥 好友</h4>' +
      '<ul>' +
      '<li>搜账号发申请，对方同意即成好友</li>' +
      '<li>可以私信、邀请对战、看 TA 的成绩、删除、拉黑</li>' +
      '<li>拉黑后对方无法再加你，除非你把他移出黑名单</li>' +
      '</ul>' +
      '<h4>⏱ 说明</h4>' +
      '<ul>' +
      '<li>音源为 Apple 公开试听片段（约 30 秒），<b>不一定从歌曲开头开始</b></li>' +
      '<li>账号是轻量账号：密码只做简单哈希，<b>别用重要密码</b></li>' +
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
    var html = '<p style="margin:0 0 12px;color:#8b8fa3;font-size:12.5px">' + todayKey() + ' · 共 ' + arr.length +
      ' 局</p><p class="lv-tip" style="margin:-6px 0 12px">清空只清今天的分数记录，<b>经验不会掉</b>。</p>';
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
  /* 把这一局成绩记到自己的账号下（好友才能看到） */
  function pushMyScore(extra) {
    if (!UserAPI.savedName()) return;
    if (!state) return;
    UserAPI.pushScore({
      code: extra.code || '',
      author: extra.author || '',
      mode: extra.mode || '',
      score: state.score,
      right: state.right,
      total: state.answered
    }, function () {});
  }

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

    // 每日挑战：把这一轮的结果和金币记到账号里
    if (state.daily) {
      UserAPI.saveDaily({
        slot: state.daily.slot, round: state.daily.round, done: true,
        score: state.score, right: state.right, coins: state.daily.coins || 0
      }, function (e2, rec) {
        if (e2) { alert(e2); return; }
        if (rec) myProfile = rec;
        renderHome(); refreshUserUI();
        expToast('🎯 挑战完成 · <b>+' + (state.daily.coins || 0) + ' 金币</b>', true);
      });
    }

    if (state.take && takeCtx) {
      UserAPI.submitResult(takeCtx.code, {
        player: myUser || ('游客' + String(UserAPI.myPid()).slice(-4)),
        score: state.score,
        right: state.right,
        total: state.answered,
        detail: (state.detail || []).slice(0, 60)
      }, function () {});
    }
    // 每一局都记一份成绩，好友那边才看得到
    pushMyScore({
      code: state.take && takeCtx ? takeCtx.code : '',
      author: state.take && takeCtx ? (takeCtx.paper.author || '匿名')
        : (pool === 'artist' ? artistPoolName() : POOL_NAME[pool]) + ' · ' + PLAY_NAME[play],
      mode: state.take ? '答题' : (endless ? '无限' : '单机')
    });

    // 经验：与得分正相关，但独立保存 —— 之后清空得分记录也不会掉经验
    grantExp(state.take ? 'take' : 'solo', {
      score: state.score, right: state.right, total: state.answered
    });

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
      over: false,
      total: TOTAL,
      basePlay: play
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

    var tags = [pool === 'artist' ? artistPoolName() : POOL_NAME[pool], PLAY_NAME[play]];
    if (fill) tags.push('填空×2');
    if (endless) tags.push('无限');
    el.badge.textContent = tags.join(' · ');

    show('s-game');
    nextQuestion();
  }

  /* 歌手专项：63 位热门歌手，按拼音（首字母）排序 */
  function artistStats() {
    var have = {};
    DB.forEach(function (s) { have[s.a] = (have[s.a] || 0) + 1; });
    return HOT_ARTISTS.filter(function (a) { return have[a]; })
      .sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); })
      .map(function (a) { return { name: a, n: have[a] }; });
  }

  function renderArtistChips() {
    if (!el.artistChips) return;
    var list = artistStats();
    if (!pickedArtists().length && list.length) artistPicks[list[0].name] = 1;
    el.artistChips.innerHTML = '';

    // 全选 / 清空
    var bar = document.createElement('div');
    bar.className = 'chip-tools';
    [['全选', function () { list.forEach(function (x) { artistPicks[x.name] = 1; }); }],
     ['清空', function () { artistPicks = {}; }]].forEach(function (pair) {
      var tb = document.createElement('button');
      tb.className = 'chip-tool';
      tb.textContent = pair[0];
      tb.addEventListener('click', function () {
        pair[1]();
        if (!pickedArtists().length && list.length) artistPicks[list[0].name] = 1;
        sfxTap();
        renderArtistChips();
        refreshCounts();
      });
      bar.appendChild(tb);
    });
    var cnt = document.createElement('span');
    cnt.className = 'chip-count';
    var pk = pickedArtists();
    cnt.textContent = '已选 ' + pk.length + ' 位：' +
      (pk.length > 3 ? (pk.slice(0, 3).join('、') + ' 等') : pk.join('、'));
    bar.appendChild(cnt);
    // 工具条放在滚动区外面，滚歌手列表时不会被一起滚走
    var oldBar = el.artistGroup ? el.artistGroup.querySelector('.chip-tools') : null;
    if (oldBar && oldBar.parentNode) oldBar.parentNode.removeChild(oldBar);
    if (el.artistGroup) el.artistGroup.insertBefore(bar, el.artistChips);
    else el.artistChips.appendChild(bar);

    list.forEach(function (x) {
      var b = document.createElement('button');
      b.className = 'artist-chip' + (artistPicks[x.name] ? ' on' : '');
      b.textContent = x.name;
      b.addEventListener('click', function () {
        if (artistPicks[x.name]) delete artistPicks[x.name];
        else artistPicks[x.name] = 1;
        if (!pickedArtists().length) artistPicks[x.name] = 1;   // 至少留一位
        sfxTap();
        renderArtistChips();
        refreshCounts();
      });
      if (artistPicks[x.name]) b.setAttribute('data-on', '1');
      el.artistChips.appendChild(b);
    });

    // 选中的歌手可能在滚动区外，首次渲染时把它滚进可视范围
    if (!artistChipsShown) {
      artistChipsShown = true;
      var firstOn = el.artistChips.querySelector('.artist-chip.on');
      if (firstOn && firstOn.scrollIntoView) {
        try { firstOn.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      }
    }
  }
  var artistChipsShown = false;

  function refreshCounts() {
    var node;
    node = document.querySelector('[data-count="zh"]');
    if (node) node.textContent = poolOf('zh').length + ' 首';
    node = document.querySelector('[data-count="yue"]');
    if (node) node.textContent = poolOf('yue').length + ' 首';
    node = document.querySelector('[data-count="artist"]');
    if (node) node.textContent = '已选 ' + pickedArtists().length + ' / ' + artistStats().length + ' 位';
    node = document.querySelector('[data-count="car"]');
    if (node) node.textContent = DB.filter(function (s) { return hasTag(s, 'car'); }).length + ' 首';
    node = document.querySelector('[data-count="douyin"]');
    if (node) node.textContent = DB.filter(function (s) { return hasTag(s, 'douyin'); }).length + ' 首';
    if (el.artistGroup) el.artistGroup.hidden = (pool !== 'artist');
    if (pool === 'artist' && el.artistGroup && !el.artistGroup.hidden) artistChipsShown = false;
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
  /* 按房间设置挑题库：曲库 × 难度 × 玩法 */
  function poolBySettings(st) {
    var all = DB.slice();
    if (st.pool === 'yue') all = all.filter(function (s) { return s.l === 'yue'; });
    else if (st.pool === 'artist') {
      var names = st.artists && st.artists.length ? st.artists : (st.artist ? [st.artist] : []);
      all = all.filter(function (s) { return names.indexOf(s.a) >= 0; });
    }
    else if (st.pool === 'car') all = all.filter(function (s) { return hasTag(s, 'car'); });
    else if (st.pool === 'douyin') all = all.filter(function (s) { return hasTag(s, 'douyin'); });
    else all = all.filter(function (s) { return s.l !== 'yue'; });

    /* 难度：
         简单 = 热门歌手 的 热门歌
         普通 = 所有歌手 的 热门歌（包含简单那批）
         困难 = 全部 */
    var f = null;
    if (st.difficulty === 'easy') {
      f = all.filter(function (s) { return HOT_SET[s.a] && popOf(s) === 3; });
    } else if (st.difficulty === 'normal') {
      f = all.filter(function (s) { return popOf(s) === 3; });
    }
    if (f && f.length >= 20) all = f;

    if (st.play === 'lyric') {
      var fl = all.filter(lyricOK);
      if (fl.length >= 10) all = fl;
    }
    if (st.play === 'singer') {
      var arts = {};
      all.forEach(function (s) { arts[s.a] = 1; });
      if (Object.keys(arts).length < 4) all = DB.filter(function (s) { return s.l !== 'yue'; });
    }
    return all;
  }
  function uniqByTitle(pool) {
    var seen = {}, out = [];
    pool.forEach(function (x) { if (!seen[x.t]) { seen[x.t] = 1; out.push(x); } });
    return out;
  }

  /* 多人里的显示名：登录了就用昵称，没登录才让用户自己填 */
  function myRoomName() {
    var me = UserAPI.savedName();
    if (!me) return '';
    var n = (myProfile && myProfile.nick) || me;
    return String(n).slice(0, 8);
  }
  function pickName() {
    var me = UserAPI.savedName();
    if (me) return myRoomName();
    return (el.lobbyName && el.lobbyName.value || '').trim().slice(0, 8);
  }

  function goLobby() {
    show('s-lobby');
    var me = UserAPI.savedName();
    if (me) {
      var rn = myRoomName();
      if (el.lobbyName) el.lobbyName.value = rn;
      if (el.lobbyNameGroup) el.lobbyNameGroup.hidden = true;
      if (el.lobbyAs) el.lobbyAs.innerHTML = '以登录身份 <b>' + esc(rn) + '</b> 加入，不用再起名字';
    } else {
      if (el.lobbyName) el.lobbyName.value = loadName();
      if (el.lobbyNameGroup) el.lobbyNameGroup.hidden = false;
      if (el.lobbyAs) el.lobbyAs.textContent = '';
    }
    if (el.lobbyHint) {
      el.lobbyHint.textContent = RoomAPI.backend === 'mqtt'
        ? '房间码发给朋友，他们在自己手机上输码就能进来。'
        : '⚠️ 当前是本机测试模式：只能在同一浏览器开多个标签试玩。';
    }
  }

  function enterRoom(r) {
    room = r; isMulti = true;
    lastRoomSig = '';
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
        stopRoomPoll();
        roomGone('房间没了', '房间已经关闭或不存在了。');
        return;
      }
      // 房间作废（房主退出 / 掉线 / 没人了）
      if (r.closed) {
        stopRoomPoll();
        var reason = r.closeReason || '房间已关闭';
        var wasGame = isActive('s-game');
        stopTimer(); stopAudio(); stopCountdown();
        if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
        if (state) state.over = true;
        room = null; isMulti = false; mState = null;
        el.liveRank.hidden = true;
        el.board.hidden = true;
        roomGone('🚪 房间已失效', reason + (wasGame ? '\n这局不算，回主界面重新开吧。' : ''));
        return;
      }
      var prevNames = (room.players || []).map(function (p) { return p.name; });
      var prevClosed = room.closed;
      room = r;
      // 有人走了 → 提示一下（房间页里也会留一行记录）
      var nowNames = (room.players || []).map(function (p) { return p.name; });
      if (isMulti && !isActive('s-lobby')) {
        prevNames.forEach(function (n) {
          if (n !== myRoomName() && nowNames.indexOf(n) < 0) expToast('👋 <b>' + esc(n) + '</b> 退出了房间');
        });
      }
      if (room.status === 'playing' && !isActive('s-game')) {
        try { startMultiGame(); } catch (e) { console.error('startMultiGame failed', e); }
      }
      if (room.status === 'over' && isActive('s-game')) endMultiGame();
      if (isActive('s-room') && (roomSig(r) !== lastRoomSig)) { lastRoomSig = roomSig(r); renderRoom(); }
      if (isActive('s-game') && isMulti) {
        updateLiveRank();
        updateMultiBadge();
        if (isHost()) hostCheckEnd();
        // 时间到 / 已经答完 → 停手等人
        var s = room.settings;
        if (s.mode === 'timed' && room.endsAt && Date.now() >= room.endsAt && !locked) {
          multiWaiting('⏰ 时间到，等其他人…');
        }
      }
    });
  }

  /* 房间没了/失效 → 统一提示（不弹「再来一局」那种结算页） */
  function roomGone(title, msg) {
    room = null; isMulti = false; mState = null;
    el.liveRank.hidden = true;
    el.board.hidden = true;
    openModal(title,
      '<p class="empty-tip" style="white-space:pre-line">' + esc(msg) + '</p>',
      [
        { label: '回主界面', cls: 'btn-primary', fn: function () { closeModal(); show('s-start'); } },
        { label: '重新开一局', cls: 'btn-ghost', fn: function () { closeModal(); goLobby(); } }
      ]);
  }

  /* 房间页只在「真的变了」的时候重画 —— 否则每秒重画会把歌手的滚动位置弹回去 */
  var lastRoomSig = '';
  function roomSig(r) {
    return r.code + '|' + r.status + '|' + JSON.stringify(r.settings) + '|' +
      (r.players || []).map(function (p) { return p.id + ':' + p.name; }).join(',') + '|' +
      JSON.stringify((r.events || []).slice(-3));
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

    // 进出记录
    if (el.roomLog) {
      var evs = (room.events || []).slice(-4);
      el.roomLog.innerHTML = '';
      evs.forEach(function (e) {
        var d = document.createElement('div');
        d.className = 'rl-item ' + (e.t === 'leave' ? 'is-out' : 'is-in');
        d.textContent = e.t === 'leave'
          ? ('👋 ' + e.name + ' 退出了房间')
          : ('✅ ' + e.name + ' 加入了房间');
        el.roomLog.appendChild(d);
      });
    }
  }

  function renderRoomSettings(editable) {
    var s = room.settings;
    var defs = [
      { k: 'mode', name: '玩法', opts: [['speed', '有限题·比速度'], ['timed', '限时·比总分']] },
      { k: 'rounds', name: '题目数量', opts: [[5, '5 题'], [10, '10 题'], [15, '15 题'], [20, '20 题']], show: s.mode === 'speed' },
      { k: 'minutes', name: '时长', opts: [[1, '1 分钟'], [3, '3 分钟'], [5, '5 分钟']], show: s.mode === 'timed' },
      { k: 'play', name: '题目类型', opts: [['sound', '听声'], ['lyric', '看词'], ['singer', '猜歌手']] },
      { k: 'fill', name: '作答方式', opts: [[0, '选选项'], [1, '填空 ×2']] },
      { k: 'pool', name: '曲库', opts: [['zh', '国语'], ['yue', '粤语'], ['artist', '歌手专项'],
                                        ['car', '车载经典'], ['douyin', '抖音热门']] },
      { k: 'difficulty', name: '难度', opts: [['easy', '简单'], ['normal', '普通'], ['hard', '困难']] }
    ];
    el.roomSettings.innerHTML = '';

    var patch = function (k, v) {
      var p = {}; p[k] = v;
      RoomAPI.updateSettings(room.code, p, function (err, r) {
        if (err) { alert(err); return; }
        room = r; renderRoom();
      });
    };

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
          var p = {}; p[d.k] = o[0];
          // 猜歌手必须有多位歌手，「歌手专项」不适用
          if (d.k === 'play' && o[0] === 'singer' && s.pool === 'artist') p.pool = 'zh';
          RoomAPI.updateSettings(room.code, p, function (err, r) {
            if (err) { alert(err); return; }
            room = r; renderRoom();
          });
        });
        seg.appendChild(b);
      });
      row.appendChild(seg);
      el.roomSettings.appendChild(row);
    });

    // 歌手专项：可多选
    if (s.pool === 'artist') {
      var picked = (s.artists && s.artists.length) ? s.artists.slice() : (s.artist ? [s.artist] : []);
      var arow = document.createElement('div');
      arow.className = 'set-row set-row-col';
      var anm = document.createElement('span');
      anm.className = 'set-name';
      anm.textContent = '选歌手（已选 ' + picked.length + ' 位，可多选）';
      arow.appendChild(anm);

      var bar = document.createElement('div');
      bar.className = 'chip-tools';
      [['全选', 'all'], ['清空', 'none']].forEach(function (pair) {
        var tb = document.createElement('button');
        tb.className = 'chip-tool';
        tb.textContent = pair[0];
        tb.disabled = !editable;
        tb.addEventListener('click', function () {
          var names = artistStats().map(function (x) { return x.name; });
          patch('artists', pair[1] === 'all' ? names : ['周杰伦']);
        });
        bar.appendChild(tb);
      });
      arow.appendChild(bar);

      var wrap = document.createElement('div');
      wrap.className = 'artist-chips artist-chips-sm';
      artistStats().forEach(function (x) {
        var b = document.createElement('button');
        var on = picked.indexOf(x.name) >= 0;
        b.className = 'artist-chip' + (on ? ' on' : '');
        b.textContent = x.name;
        b.disabled = !editable;
        b.addEventListener('click', function () {
          var list = picked.slice();
          var i = list.indexOf(x.name);
          if (i >= 0) list.splice(i, 1); else list.push(x.name);
          if (!list.length) list = [x.name];            // 至少留一位
          patch('artists', list);
        });
        wrap.appendChild(b);
      });
      arow.appendChild(wrap);
      el.roomSettings.appendChild(arow);
    }

    // 提示当前设置的题库规模
    var tip = document.createElement('p');
    tip.className = 'hint';
    tip.textContent = '当前题库：' + poolBySettings(s).length + ' 首可选';
    el.roomSettings.appendChild(tip);
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

  /* ---- 多人游戏 ----
     模型：房主开局时把整份题目清单发到房间状态里，之后每个人按自己的节奏答题，
     互不等待；房主只负责判定「整局什么时候结束」。 */
  function startMultiGame() {
    var s = room.settings;
    play = s.play;   // 多人时题目类型跟随房间设置，而不是首页的选择
    fill = !!s.fill;   // 多人也能玩填空（得分 ×2）
    endless = false;
    var list = uniqByTitle(shuffle(poolBySettings(s)));
    if (list.length < 4) {
      alert('这个设置的题库不够（' + POOL_NAME[s.pool] + ' · ' + DIFF_NAME[s.difficulty] +
        '），让房主换个曲库或难度');
      return;
    }

    // 题目清单：优先用房主发下来的（保证每个人题目一致）
    var keys = (room.songs && room.songs.length) ? room.songs.slice() : [];
    if (!keys.length) {
      var need = (s.mode === 'speed') ? s.rounds : Math.min(list.length, 40);
      keys = list.slice(0, need).map(function (x) { return x.a + '|' + x.t; });
    }

    mState = { idx: 0, over: false, songs: keys };
    state = {
      allPool: list, queue: [], used: {}, answered: 0, score: 0, right: 0,
      usedSec: 0, tStart: 0, current: null, over: false,
      total: (s.mode === 'speed') ? s.rounds : 0     // 0 = 不限题数（限时模式）
    };
    el.hudScore.textContent = '0';
    el.hudRight.textContent = '0';
    el.dots.innerHTML = '';
    el.dots.hidden = true;
    el.liveRank.hidden = false;
    show('s-game');
    updateMultiBadge();
    updateLiveRank();
    renderMultiQuestion();
  }

  function multiLeft() {
    if (!room || !room.endsAt) return '';
    var left = Math.max(0, room.endsAt - Date.now());
    var m = Math.floor(left / 60000), sec = Math.floor(left % 60000 / 1000);
    return ' · 剩 ' + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function updateMultiBadge() {
    var s = room.settings;
    var diff = (s.difficulty && s.difficulty !== 'normal') ? (' · ' + DIFF_NAME[s.difficulty]) : '';
    var poolName = (s.pool === 'artist')
      ? ((s.artists && s.artists.length === 1) ? (s.artists[0] + '专项')
        : ('歌手专项(' + ((s.artists && s.artists.length) || 1) + '位)'))
      : POOL_NAME[s.pool];
    el.badge.textContent = '多人 · ' + PLAY_NAME[s.play] + ' · ' + poolName + diff +
      (s.fill ? ' · 填空' : '') + ' · ' +
      (s.mode === 'speed' ? (s.rounds + ' 题') : (s.minutes + ' 分钟')) + multiLeft();
  }

  /* 答完了 / 时间到 → 停手等别人 */
  function multiWaiting(msg) {
    locked = true;
    stopTimer(); stopAudio();
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    el.options.innerHTML = '';
    el.options.hidden = true;
    el.fillArea.hidden = true;
    el.lyricBox.hidden = true;
    el.disc.hidden = true;
    el.timerFill.style.width = '100%';
    if (el.timer) el.timer.classList.add('is-off');
    el.playerTip.textContent = msg || '✅ 你答完了，等其他人…';
    if (isHost()) hostCheckEnd();
  }

  /* 渲染「我自己的」下一题 */
  function renderMultiQuestion() {
    if (!mState || !state || state.over || !room) return;
    var s = room.settings;
    if (s.mode === 'speed' && mState.idx >= s.rounds) return multiWaiting();
    if (s.mode === 'timed' && room.endsAt && Date.now() >= room.endsAt) return multiWaiting('⏰ 时间到，等其他人…');
    if (mState.idx >= mState.songs.length) return multiWaiting();

    var guard = 0, q = null;
    while (guard++ < 200 && mState.idx < mState.songs.length) {
      var song = findSong(mState.songs[mState.idx++]);
      if (!song) continue;
      q = makeQuestion(song);
      if (q) break;
    }
    if (!q) return multiWaiting();

    state.current = q;
    renderQuestion();
    updateMultiBadge();
  }

  /* 房主：判断整局该不该结束 */
  function hostCheckEnd() {
    if (!isHost() || !room || room.status !== 'playing') return;
    var s = room.settings, over = false;
    if (s.mode === 'speed') {
      over = room.players.every(function (p) { return (p.answered || 0) >= s.rounds; });
      // 兜底：有人一直不答，别把整局卡死
      if (!over && room.startedAt && Date.now() - room.startedAt > (s.rounds * 30 + 120) * 1000) over = true;
    } else {
      over = !!(room.endsAt && Date.now() >= room.endsAt);
    }
    if (over) RoomAPI.finish(room.code, function () {});
  }

  function updateLiveRank() {
    if (!room || !el.liveRank) return;
    var s = room.settings;
    var list = room.players.slice().sort(function (a, b) { return b.score - a.score; });
    el.liveRank.innerHTML = '';
    list.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'lr-item' + (p.id === RoomAPI.myId() ? ' is-me' : '');
      var n = document.createElement('span'); n.className = 'lr-n'; n.textContent = p.name;
      var g = document.createElement('span'); g.className = 'lr-g';
      g.textContent = (p.answered || 0) + (s.mode === 'speed' ? '/' + s.rounds : '');
      var sc = document.createElement('span'); sc.className = 'lr-s'; sc.textContent = fmt(p.score);
      d.appendChild(n); d.appendChild(g); d.appendChild(sc);
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

    if (UserAPI.savedName() && meP) {
      UserAPI.pushScore({
        code: '', author: '多人对战', mode: '多人',
        score: meP.score, right: meP.right, total: meP.answered
      }, function () {});
      // 对战经验：按得分给，第一名再多给一份
      grantExp('multi', {
        score: meP.score, right: meP.right, total: meP.answered,
        mvp: !!(mvp && mvp.id === RoomAPI.myId())
      });
    }

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
    var wasHost = isHost();
    if (room) RoomAPI.leave(room.code, function () {});
    stopRoomPoll();
    stopTimer(); stopAudio(); stopCountdown();
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    if (hostAdvTimer) { clearTimeout(hostAdvTimer); hostAdvTimer = null; }
    if (state) state.over = true;
    room = null; isMulti = false; mState = null;
    lastRoomSig = '';
    el.liveRank.hidden = true;
    el.board.hidden = true;
    show('s-start');
    if (wasHost) expToast('房间已解散，其他人也会收到提示');
  }

  /* ================= 账号 ================= */
  var myUser = null;

  function refreshUserUI() {
    if (el.quizUser) el.quizUser.textContent = myUser ? ('👤 ' + myUser) : '未登录';
    if (typeof renderHome === 'function') renderHome();
    if (el.acctNick) {
      if (myUser) {
        el.acctNick.textContent = (myProfile && myProfile.nick) || myUser;
        if (el.acctAv) el.acctAv.textContent = (myProfile && myProfile.avatar) || '🐱';
        if (el.acctChip) el.acctChip.classList.add('is-on');
      } else {
        el.acctNick.textContent = '登录 / 注册';
        if (el.acctAv) el.acctAv.textContent = '👤';
        if (el.acctChip) el.acctChip.classList.remove('is-on');
      }
    }
    if (el.acctLv) {
      if (myProfile) { el.acctLv.hidden = false; el.acctLv.textContent = 'Lv' + lvInfo(myProfile).level; }
      else el.acctLv.hidden = true;
    }
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

  /* ===== 打开网站就检测登录状态 ===== */
  function bootAuth() {
    var me = UserAPI.savedName();
    if (me) {
      myUser = me;
      refreshUserUI();
      openModal('👋 欢迎回来',
        '<div class="welcome-hello" id="wc-hello">欢迎回来，' + esc(me) + '</div>' +
        '<p class="empty-tip">今天也来猜几首？</p>',
        [
          { label: '我的主页', cls: 'btn-ghost', fn: function () { closeModal(); goProfile(); } },
          { label: '开始游戏', cls: 'btn-primary', fn: closeModal }
        ]);
      // 顺便把昵称/头像拿回来（拿不到也不影响）
      UserAPI.getProfile(me, function (err, p) {
        if (err || !p) return;
        myProfile = p;
        renderLevelCard();
        renderHome();
        refreshUserUI();
        var h = document.getElementById('wc-hello');
        if (h) h.textContent = '欢迎回来，' + (p.nick || p.name);
        if (el.lobbyAs && UserAPI.savedName()) {
          el.lobbyAs.innerHTML = '以登录身份 <b>' + esc(myRoomName()) + '</b> 加入，不用再起名字';
        }
      });
      return;
    }
    showAuthModal();
  }

  function showAuthModal() {
    openModal('👤 登录 / 注册',
      '<div class="field"><label>用户名</label>' +
      '<input type="text" id="m-acc-name" class="text-input" maxlength="12" placeholder="用户名（最多 12 个字）" autocomplete="off" /></div>' +
      '<div class="field"><label>密码</label>' +
      '<input type="password" id="m-acc-pwd" class="text-input" maxlength="32" placeholder="密码（至少 4 位）" autocomplete="off" /></div>' +
      '<p class="hint" id="m-acc-hint">登录后才能加好友、私信、出题。轻量账号：密码只做简单哈希，<b>别用重要密码</b>。</p>',
      [
        { label: '先随便玩玩', cls: 'btn-ghost', fn: closeModal },
        { label: '注册', cls: 'btn-multi', fn: function () { doAuth('register'); } },
        { label: '登录', cls: 'btn-primary', fn: function () { doAuth('login'); } }
      ]);
    var n = document.getElementById('m-acc-name');
    if (n) n.value = UserAPI.savedName() || '';
  }

  function doAuth(kind) {
    var nEl = document.getElementById('m-acc-name');
    var pEl = document.getElementById('m-acc-pwd');
    var hEl = document.getElementById('m-acc-hint');
    if (!nEl || !pEl) return;
    var warn = function (msg, input) {
      if (hEl) { hEl.textContent = '⚠️ ' + msg; hEl.classList.add('is-warn'); }
      if (input) {
        input.classList.add('is-error');
        try { input.focus(); } catch (e) {}
        setTimeout(function () { input.classList.remove('is-error'); }, 1500);
      }
      sfxWrong();
    };
    var n = (nEl.value || '').trim().slice(0, 12);
    var p = pEl.value || '';
    if (!n) return warn('请输入用户名', nEl);
    if (kind === 'login' && !p) return warn('请输入密码', pEl);
    if (kind === 'register' && p.length < 4) return warn('密码至少 4 位', pEl);
    if (hEl) { hEl.classList.remove('is-warn'); hEl.textContent = kind === 'login' ? '登录中…' : '注册中…'; }
    var done = function (err) {
      if (err) return warn(err);
      myUser = n;
      refreshUserUI();
      UserAPI.getProfile(n, function (e2, prof) { if (prof) { myProfile = prof; renderLevelCard(); } });
      openModal('✅ ' + (kind === 'login' ? '登录成功' : '注册成功'),
        '<div class="welcome-hello">欢迎，' + esc(n) + '</div>' +
        '<p class="empty-tip">现在可以加好友、私信、出题、多人对战了。</p>',
        [
          { label: '加好友', cls: 'btn-ghost', fn: function () { closeModal(); goFriends(); } },
          { label: '开始游戏', cls: 'btn-primary', fn: closeModal }
        ]);
    };
    if (kind === 'login') UserAPI.login(n, p, done);
    else UserAPI.register(n, p, done);
  }

  /* ================= 金币 / 宠物 / 每日挑战 / 商店 ================= */

  function E() { return window.Economy; }
  function myCoins() { return Math.floor(Number((myProfile && myProfile.coins) || 0)); }
  function itemCount(k) { return Math.floor(Number((myProfile && myProfile.items && myProfile.items[k]) || 0)); }

  /* 加速孵化：每天只能买一次（否则等级可以无限刷） */
  function canBoost() {
    var L = window.Level;
    if (!L || !UserAPI.savedName()) return false;
    var prof = myProfile || {};
    return (prof.boostDay || '') !== L.dayKey();
  }
  function boostTip() {
    var L = window.Level;
    if (!L) return '';
    if (!UserAPI.savedName()) return '登录后才能加速孵化';
    if (canBoost()) return '今天还能加速一次（每天限 1 次）';
    return '今天的加速已经用过了，明天再来（每天限 1 次）';
  }

  function mmss(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return (h > 0 ? h + ':' : '') + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  /* 首页那张卡：宠物 + 等级条 + 金币 + 签到 */
  function renderHome() {
    var E2 = window.Economy, L = window.Level;
    if (!E2 || !L) return;
    var prof = myProfile || {};
    var exp = Math.floor(Number(prof.exp) || 0);
    var info = L.fromExp(exp);
    var pet = E2.petOf(info.level);
    var sk = E2.skinOf(prof.petSkin);

    if (el.petEmoji) {
      el.petEmoji.textContent = pet.emoji;
      el.petEmoji.className = 'pet-emoji' + (sk.id ? ' skin-' + sk.id : '');
    }
    if (el.petName) el.petName.textContent = (info.title || '') + ' · ' + pet.name;
    if (el.homeLv) el.homeLv.textContent = 'Lv' + info.level;
    if (el.homeLvFill) el.homeLvFill.style.width = info.pct + '%';
    if (el.petNote) {
      el.petNote.textContent = UserAPI.savedName()
        ? pet.note + ' · 经验 ' + info.cur + '/' + info.need
        : '登录后开始孵化，等级越高它长得越大';
    }
    if (el.homeCoins) el.homeCoins.textContent = myCoins();

    // 签到
    var ci = prof.checkin || { last: '', streak: 0 };
    var st = L.nextStreak(ci);
    var signedToday = (ci.last === L.dayKey());
    if (el.btnHomeCheckin) {
      if (!UserAPI.savedName()) {
        el.btnHomeCheckin.textContent = '📅 登录后可签到';
        el.btnHomeCheckin.disabled = false;
      } else if (signedToday) {
        el.btnHomeCheckin.textContent = '✅ 今天已签到';
      } else {
        el.btnHomeCheckin.textContent = '📅 每日签到';
      }
    }
    if (el.homeCheckinTip) {
      if (!UserAPI.savedName()) el.homeCheckinTip.textContent = '';
      else if (signedToday) el.homeCheckinTip.textContent = '已连签 ' + (ci.streak || 0) + ' 天 · 明天再来（断一天就重新算）';
      else el.homeCheckinTip.textContent = '签到得 ' + E2.checkinCoins(st) + ' 金币 + ' + L.checkinGain(st) + ' 经验 · 已连签 ' + (ci.streak || 0) + ' 天（每满一周金币 +1）';
    }

    // 每日挑战
    var slot = E2.dailySlot();
    var d = prof.daily || {};
    var done = (d.slot === slot && d.done);
    if (el.btnDaily) {
      el.btnDaily.textContent = !UserAPI.savedName() ? '登录后开始挑战'
        : done ? ('已挑战 · 花 15 金币换一批（🪙 ' + myCoins() + '）')
        : '开始挑战';
    }
    renderDailyLeft();
  }

  var dailyLeftTimer = null;
  function renderDailyLeft() {
    var E2 = window.Economy;
    if (!E2 || !el.dailyLeft) return;
    if (dailyLeftTimer) { clearInterval(dailyLeftTimer); dailyLeftTimer = null; }
    var tick = function () {
      el.dailyLeft.textContent = mmss(E2.dailyLeft());
    };
    tick();
    dailyLeftTimer = setInterval(tick, 1000);
  }

  el.btnHomeCheckin.addEventListener('click', function () {
    if (!UserAPI.savedName()) { goAccount(); return; }
    UserAPI.doCheckin(function (err, rec, out) {
      if (err) { alert(err); return; }
      if (out && out.already) { expToast('今天已经签过啦'); return; }
      if (rec) { myProfile = rec; }
      renderHome(); refreshUserUI();
      sfxRight();
      expToast('📅 签到成功 · 连签 <b>' + (out.streak || 1) + '</b> 天 · <b>+' + (out.coins || 0) + ' 金币</b> +' + (out.gained || 0) + ' 经验', true);
    });
  });

  /* ---------- 每日挑战 ---------- */
  el.btnDaily.addEventListener('click', function () {
    if (!UserAPI.savedName()) {
      openModal('🎯 每日挑战', '<p class="empty-tip">先登录才能参加，金币和挑战记录都记在账号里。</p>',
        [{ label: '去登录', cls: 'btn-primary', fn: function () { closeModal(); goAccount(); } },
         { label: '先不', cls: 'btn-ghost', fn: closeModal }]);
      return;
    }
    startDaily();
  });

  function startDaily() {
    var E2 = window.Economy;
    var d = (myProfile && myProfile.daily) || {};
    var slot = E2.dailySlot();
    var done = (d.slot === slot && d.done);
    if (done) {
      UserAPI.refreshDaily(function (err, rec) {
        if (err) { alert(err); return; }
        if (rec) myProfile = rec;
        renderHome();
        startDailyRun(slot, (rec && rec.daily && rec.daily.round) || 1);
      });
      return;
    }
    var round = (d.slot === slot && d.round) ? d.round : 1;
    startDailyRun(slot, round);
  }

  function startDailyRun(slot, round) {
    var E2 = window.Economy;
    var seed = slot * 100 + round;
    var plan = E2.dailyPlan(seed);
    var rand = E2.rng(seed);
    var items = [], usedT = {};
    plan.forEach(function (kind) {
      var p;
      if (kind === 'lyric') p = DB.filter(function (s) { return lyricOK(s) && popOf(s) === 3; });
      else p = DB.filter(function (s) { return popOf(s) === 3; });
      var s = null, guard = 0;
      while (guard++ < 400) {
        var c = p[Math.floor(rand() * p.length)];
        if (c && !usedT[c.t]) { s = c; break; }
      }
      if (!s) s = p[Math.floor(rand() * p.length)] || p[0];
      if (!s) return;
      usedT[s.t] = 1;
      items.push({ s: s, m: kind });
    });
    if (items.length < 4) { alert('挑战题库不够，稍后再试'); return; }

    play = 'sound';
    fill = false; endless = false;
    isMulti = false; room = null; mState = null; stopRoomPoll();
    if (hostAdvTimer) { clearTimeout(hostAdvTimer); hostAdvTimer = null; }
    el.liveRank.hidden = true;
    el.board.hidden = true;
    state = {
      basePlay: 'sound', allPool: uniqByTitle(DB.slice()),
      queue: items, used: {}, answered: 0, score: 0, right: 0,
      usedSec: 0, tStart: 0, current: null, over: false,
      total: items.length,
      daily: { slot: slot, round: round, coins: 0 }
    };
    el.hudScore.textContent = '0';
    el.hudRight.textContent = '0';
    el.dots.innerHTML = '';
    el.dots.hidden = false;
    items.forEach(function () { var d2 = document.createElement('span'); d2.className = 'dot'; el.dots.appendChild(d2); });
    el.badge.textContent = '🎯 每日挑战 · ' + items.length + ' 题';
    show('s-game');
    renderItemBar();
    nextQuestion();
  }

  /* ---------- 商店 ---------- */
  el.btnShop.addEventListener('click', goShop);
  if (el.btnShopBack) el.btnShopBack.addEventListener('click', function () { show('s-start'); });
  if (el.coinChip) el.coinChip.addEventListener('click', goShop);
  if (el.btnMore) el.btnMore.addEventListener('click', function () {
    var open = el.moreOpts.hidden;
    el.moreOpts.hidden = !open;
    el.btnMore.textContent = open ? '更多选项 ▴' : '更多选项 ▾';
  });

  function goShop() {
    if (!UserAPI.savedName()) {
      openModal('🛍 商店', '<p class="empty-tip">先登录才能用金币买东西。</p>',
        [{ label: '去登录', cls: 'btn-primary', fn: function () { closeModal(); goAccount(); } },
         { label: '先不', cls: 'btn-ghost', fn: closeModal }]);
      return;
    }
    show('s-shop');
    renderShop();
  }

  var shopTab = 'item';
  if (el.shopTabs) {
    el.shopTabs.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      shopTab = b.getAttribute('data-t');
      Array.prototype.forEach.call(el.shopTabs.querySelectorAll('button'), function (x) {
        x.classList.toggle('on', x === b);
      });
      sfxTap();
      renderShop();
    });
  }

  function shopRow(left, right) {
    return '<div class="shop-row"><div class="sr-l">' + left + '</div><div class="sr-r">' + right + '</div></div>';
  }

  function renderShop() {
    var E2 = window.Economy;
    if (!E2 || !el.shopBody) return;
    var prof = myProfile || {};
    var items = prof.items || {};
    var own = prof.own || { avatars: [], titles: [], skins: [] };
    if (el.shopCoins) el.shopCoins.textContent = myCoins();

    var h = '';
    if (shopTab === 'item') {
      h += '<p class="shop-note">答题时出现在题目上方，点一下就用。</p>';
      E2.ITEM_KEYS.forEach(function (k) {
        var it = E2.ITEMS[k];
        var n = items[k] || 0;
        h += shopRow(
          '<b>' + it.emoji + ' ' + it.name + '</b><i>' + it.desc + '</i>',
          '<span class="sr-count">' + (n ? '已有 ' + n : '') + '</span>' +
          '<button class="btn btn-multi btn-sm" data-buy="' + k + '">🪙 ' + it.cost + '</button>');
      });
    } else if (shopTab === 'box') {
      h += '<div class="box-card">' +
        '<div class="box-ico">🎁</div>' +
        '<div class="box-t">抽一次盲盒</div>' +
        '<div class="box-s">普通 70% · 稀有 25% · 传说 5%<br>抽到重复的退 ' + E2.BOX_REFUND + ' 金币</div>' +
        '<button class="btn btn-primary" data-box="1">🪙 ' + E2.BOX_COST + ' 抽一次</button>' +
        '</div>';
      h += '<div class="shop-sec">我的称号</div>';
      var ts = (own.titles || []);
      h += '<div class="tag-wrap">' + (ts.length ? ts.map(function (t) {
        return '<button class="tag-btn' + (prof.title === t ? ' on' : '') + '" data-title="' + esc(t) + '">' +
          esc(t) + (prof.title === t ? ' ✓' : '') + '</button>';
      }).join('') : '<span class="muted">还没有，去抽一个</span>') + '</div>';
      h += '<div class="shop-sec">我的头像</div>';
      var as = (own.avatars || []);
      h += '<div class="tag-wrap">' + (as.length ? as.map(function (a) {
        return '<button class="tag-btn av' + (prof.avatar === a ? ' on' : '') + '" data-avatar="' + esc(a) + '">' + esc(a) + '</button>';
      }).join('') : '<span class="muted">还没有，去抽一个</span>') + '</div>';
    } else {
      var pet = E2.petOf(Level.fromExp(Math.floor(Number(prof.exp) || 0)).level);
      h += '<div class="box-card">' +
        '<div class="box-ico">' + pet.emoji + '</div>' +
        '<div class="box-t">' + pet.name + '</div>' +
        '<div class="box-s">' + pet.note + '</div>' +
        '<button class="btn btn-multi" data-boost="1"' + (canBoost() ? '' : ' disabled') + '>' +
        '⚡ 加速孵化 · 🪙 ' + E2.BOOST.cost + '（+' + E2.BOOST.exp + ' 经验）</button>' +
        '<div class="box-s" style="margin-top:8px">' + boostTip() + '</div>' +
        '</div>';
      h += '<div class="shop-sec">宠物皮肤</div>';
      E2.PET_SKINS.forEach(function (sk) {
        if (!sk.id) return;
        var has = (own.skins || []).indexOf(sk.id) >= 0;
        var on = prof.petSkin === sk.id;
        h += shopRow(
          '<b>' + E2.petOf(15).emoji + ' ' + sk.name + '</b><i>' + (on ? '佩戴中' : has ? '已拥有' : '给蛋换个颜色') + '</i>',
          has ? '<button class="btn btn-ghost btn-sm" data-skin="' + sk.id + '">' + (on ? '佩戴中' : '换上') + '</button>'
              : '<button class="btn btn-multi btn-sm" data-skin="' + sk.id + '">🪙 ' + sk.cost + '</button>');
      });
    }

    el.shopBody.innerHTML = h;

    el.shopBody.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        UserAPI.buyItem(b.getAttribute('data-buy'), function (err, rec) {
          if (err) { alert(err); return; }
          if (rec) myProfile = rec;
          renderHome(); renderShop(); refreshUserUI();
          sfxTap();
        });
      });
    });
    el.shopBody.querySelectorAll('[data-box]').forEach(function (b) {
      b.addEventListener('click', function () {
        UserAPI.openBox(function (err, rec, out) {
          if (err) { alert(err); return; }
          if (rec) myProfile = rec;
          renderHome(); refreshUserUI();
          sfxRight();
          var tag = E2.RARITY_NAME[out.rarity] || '';
          openModal('🎁 ' + tag + '！',
            '<div class="box-win r' + out.rarity + '">' + (out.kind === 'avatar' ? out.value : '🏷') + '</div>' +
            '<p class="empty-tip">' + (out.kind === 'avatar' ? '新头像「' : '新称号「') + esc(out.value) + '」' +
            (out.dup ? '（重复了，退 ' + out.refund + ' 金币）' : '') + '</p>' +
            (out.kind === 'title' ? '<p class="hint">在商店「盲盒」页点它就能佩戴。</p>' : ''),
            [{ label: '再抽一次', cls: 'btn-multi', fn: function () { closeModal(); renderShop(); } },
             { label: '好', cls: 'btn-ghost', fn: function () { closeModal(); renderShop(); } }]);
        });
      });
    });
    el.shopBody.querySelectorAll('[data-boost]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!canBoost()) { alert(boostTip()); return; }
        UserAPI.buyBoost(function (err, rec, out) {
          if (err) { alert(err); return; }
          if (rec) myProfile = rec;
          renderHome(); refreshUserUI(); renderShop();
          sfxRight();
          confetti();
          openModal('⚡ 孵化加速', '<div class="welcome-hello">+' + E2.BOOST.exp + ' 经验！</div>' +
            '<p class="empty-tip">' + E2.petOf(Level.fromExp(myProfile.exp || 0).level).note + '</p>',
            [{ label: '好', cls: 'btn-primary', fn: closeModal }]);
        });
      });
    });
    el.shopBody.querySelectorAll('[data-skin]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-skin');
        var has = ((myProfile.own && myProfile.own.skins) || []).indexOf(id) >= 0;
        var after = function (rec) {
          if (rec) myProfile = rec;
          renderHome(); refreshUserUI(); renderShop();
        };
        if (has) UserAPI.equip('skin', id, function (e2, rec) { if (e2) { alert(e2); return; } after(rec); });
        else UserAPI.buySkin(id, function (e2, rec) {
          if (e2) { alert(e2); return; }
          if (rec) myProfile = rec;
          UserAPI.equip('skin', id, function (e3, rec2) { after(rec2 || rec); });
        });
      });
    });
    el.shopBody.querySelectorAll('[data-title]').forEach(function (b) {
      b.addEventListener('click', function () {
        UserAPI.equip('title', b.getAttribute('data-title'), function (e2, rec) {
          if (e2) { alert(e2); return; }
          if (rec) myProfile = rec;
          renderHome(); refreshUserUI(); renderShop();
        });
      });
    });
    el.shopBody.querySelectorAll('[data-avatar]').forEach(function (b) {
      b.addEventListener('click', function () {
        UserAPI.equip('avatar', b.getAttribute('data-avatar'), function (e2, rec) {
          if (e2) { alert(e2); return; }
          if (rec) myProfile = rec;
          renderHome(); refreshUserUI(); renderShop();
        });
      });
    });
  }

  /* ---------- 答题里的道具 ---------- */
  function renderItemBar() {
    var bar = el.itemBar;
    if (!bar) return;
    if (!state || state.over || isMulti || fill) { bar.hidden = true; return; }
    var E2 = window.Economy;
    if (!E2 || !UserAPI.savedName()) { bar.hidden = true; return; }
    bar.innerHTML = '';
    var any = false;
    E2.ITEM_KEYS.forEach(function (k) {
      var n = itemCount(k);
      if (n <= 0) return;
      any = true;
      var it = E2.ITEMS[k];
      var b = document.createElement('button');
      b.className = 'item-btn';
      b.innerHTML = '<span class="ib-emoji"></span><span class="ib-name"></span><span class="ib-count"></span>';
      b.querySelector('.ib-emoji').textContent = it.emoji;
      b.querySelector('.ib-name').textContent = it.name;
      b.querySelector('.ib-count').textContent = '×' + n;
      b.addEventListener('click', function () { useItem(k, b); });
      bar.appendChild(b);
    });
    bar.hidden = !any;
  }

  function useItem(k, btn) {
    if (!state || state.over || locked) { if (k === 'revive') return; }
    var E2 = window.Economy;
    if (!E2) return;
    if (k === 'hint2') {
      if (locked || !state || !state.current) { expToast('这道题已经答过了'); return; }
      var btns = el.options.querySelectorAll('.opt');
      if (!btns.length) { expToast('这道题用不了'); return; }
      var wrongs = [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].disabled) continue;
        if (btns[i].textContent !== state.current.correct.t) wrongs.push(btns[i]);
      }
      if (wrongs.length < 2) { expToast('错项不够两个了'); return; }
      UserAPI.useItem('hint2', function (err, rec) {
        if (err) { alert(err); return; }
        if (rec) { myProfile = rec; renderItemBar(); }
        var q = state.current;
        q.opts.forEach(function (o) { if (o.t !== q.correct.t) q.removed = (q.removed || 0); });
        wrongs.slice(0, 2).forEach(function (b) { b.classList.add('is-dim'); b.disabled = true; b.classList.add('is-gone'); });
        sfxTap();
      });
      return;
    }
    if (k === 'peek') {
      if (locked || !state || !state.current) { expToast('这道题已经答过了'); return; }
      var q2 = state.current.correct;
      var first = (play === 'singer') ? q2.a : q2.t;
      UserAPI.useItem('peek', function (err, rec) {
        if (err) { alert(err); return; }
        if (rec) { myProfile = rec; renderItemBar(); }
        sfxTap();
        el.playerTip.textContent = '🔍 提示：答案的第一个字是「' + first.charAt(0) + '」';
      });
      return;
    }
    // revive 只在答错后的间隙可用
    expToast('答错的时候会自动用「再来一次」');
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
    // 打分排序：歌名完全一致 > 歌名开头 > 歌名包含 > 歌手开头 > 歌手包含
    var scored = [];
    for (var i = 0; i < DB.length; i++) {
      var s = DB[i], t = s.t.toLowerCase(), a = s.a.toLowerCase(), sc = -1;
      if (t === q) sc = 0;
      else if (t.indexOf(q) === 0) sc = 1;
      else if (t.indexOf(q) >= 0) sc = 2;
      else if (a.indexOf(q) === 0) sc = 3;
      else if (a.indexOf(q) >= 0) sc = 4;
      if (sc >= 0) scored.push([sc, i, s]);
    }
    scored.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
    var hits = scored.slice(0, 40).map(function (x) { return x[2]; });
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
      var wrap = document.createElement('div');
      wrap.className = 'qr-item';

      var d = document.createElement('div');
      d.className = 'result-row';
      d.innerHTML = '<div class="av-sm"></div><div style="flex:1;min-width:0"><div class="rr-n"></div><div class="rr-s"></div></div><div class="rr-v"></div>';
      d.querySelector('.av-sm').textContent = r.avatar || '👤';
      d.querySelector('.rr-n').textContent = r.player;
      d.querySelector('.rr-s').textContent = '答对 ' + r.right + '/' + r.total + ' · ' + timeAgo(r.finishedAt);
      d.querySelector('.rr-v').textContent = fmt(r.score);
      wrap.appendChild(d);

      var det = r.detail || [];
      if (det.length) {
        var btn = document.createElement('button');
        btn.className = 'qr-toggle';
        btn.textContent = '👀 看他的作答（' + det.length + ' 题）▾';
        var box = document.createElement('div');
        box.className = 'qr-detail';
        box.hidden = true;
        det.forEach(function (x, i) {
          var parts = String(x.k || '').split('|');
          var row = document.createElement('div');
          row.className = 'qr-row ' + (x.ok ? 'is-ok' : 'is-no');
          row.innerHTML = '<span class="qr-i"></span><span class="qr-c"></span>' +
            '<span class="qr-p"></span><span class="qr-m"></span>';
          row.querySelector('.qr-i').textContent = (i + 1);
          row.querySelector('.qr-c').textContent = parts[0] + '《' + parts[1] + '》';
          row.querySelector('.qr-p').textContent = x.ok
            ? '✅ 答对'
            : ('❌ 他答：' + (x.p ? x.p : '（超时 / 没答）'));
          row.querySelector('.qr-m').textContent = x.s ? (x.s + 's') : '';
          box.appendChild(row);
        });
        btn.addEventListener('click', function () {
          box.hidden = !box.hidden;
          btn.textContent = box.hidden ? ('👀 看他的作答（' + det.length + ' 题）▾') : '收起作答 ▴';
        });
        wrap.appendChild(btn);
        wrap.appendChild(box);
      } else {
        var tip = document.createElement('p');
        tip.className = 'qr-none';
        tip.textContent = '（这位是旧版本答的，没有作答明细）';
        wrap.appendChild(tip);
      }
      el.mkResultsList.appendChild(wrap);
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
      total: pool.length, take: true, basePlay: play, detail: []
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

  /* ================= 个人主页 ================= */
  var AVATARS = ['🐱','🐶','🐼','🦊','🐯','🦁','🐸','🐵','🐰','🐨','🦄','🐲','👻','🤖','🎧','🎤','🎸','🎮','⚽','🍜','🌙','⭐','🔥','💎'];
  var myProfile = null;

  function timeAgo(ts) {
    if (!ts) return '';
    var d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    return Math.floor(d / 86400) + ' 天前';
  }

  function scoreRow(s) {
    var d = document.createElement('div');
    d.className = 'result-row';
    d.innerHTML = '<div style="flex:1;min-width:0"><div class="rr-n"></div><div class="rr-s"></div></div><div class="rr-v"></div>';
    d.querySelector('.rr-n').textContent = s.author ? ('出题人 ' + s.author) : (s.mode || '对局');
    d.querySelector('.rr-s').textContent = '答对 ' + s.right + '/' + s.total + ' · ' + timeAgo(s.at) +
      (s.author && s.mode ? ' · ' + s.mode : '');
    d.querySelector('.rr-v').textContent = fmt(s.score);
    return d;
  }

  function goProfile() {
    var me = UserAPI.savedName();
    if (!me) { goAccount(); return; }
    show('s-profile');
    UserAPI.getProfile(me, function (err, p) {
      if (err) { alert(err); return; }
      myProfile = p;
      renderProfile();
      UserAPI.getScores(me, renderProfileScores);
    });
  }

  function renderProfile() {
    if (!myProfile) return;
    el.pfAvatar.textContent = myProfile.avatar || '👤';
    el.pfNick.textContent = myProfile.nick || myProfile.name;
    el.pfAccount.textContent = '账号：' + myProfile.name;
    el.pfNickInput.value = '';
    el.pfAvatars.innerHTML = '';
    AVATARS.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'av-item' + (a === myProfile.avatar ? ' on' : '');
      b.textContent = a;
      b.addEventListener('click', function () {
        UserAPI.updateProfile({ avatar: a }, function (err, rec) {
          if (err) { alert(err); return; }
          myProfile = rec; renderProfile(); sfxTap();
        });
      });
      el.pfAvatars.appendChild(b);
    });
    renderLevelCard();
  }

  function renderProfileScores(list) {
    list = list || [];
    el.pfScCount.textContent = list.length + ' 次';
    el.pfScores.innerHTML = '';
    if (!list.length) {
      var e = document.createElement('p');
      e.className = 'empty-tip'; e.textContent = '还没答过题';
      el.pfScores.appendChild(e);
      return;
    }
    list.slice().reverse().forEach(function (s) { el.pfScores.appendChild(scoreRow(s)); });
  }

  /* ================= 等级 / 经验 =================
     经验(exp) 独立于 得分(score)：
       · 得分可以一键清零，经验永远不会清零
       · 经验的多少与得分正相关（得分越高、答对越多，经验越多）
       · 来源：答题 / 答别人出的题 / 多人对战 / 每日签到
  ================================================= */
  function lvInfo(rec) {
    var L = window.Level;
    if (!L) return { level: 1, cur: 0, need: 100, pct: 0, title: '', exp: 0 };
    return L.fromExp(rec ? rec.exp : 0);
  }

  /* 顶部小提示条（不打断游戏流程） */
  var toastTimer = null;
  function expToast(html, isUp) {
    var t = document.getElementById('exp-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'exp-toast';
      t.className = 'exp-toast';
      document.body.appendChild(t);
    }
    t.innerHTML = html;
    t.className = 'exp-toast show' + (isUp ? ' is-up' : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (t) t.className = 'exp-toast'; }, 2800);
  }

  /* 刷新等级卡片 + 首页等级角标 + 签到按钮 */
  function renderLevelCard() {
    var i = lvInfo(myProfile);
    if (el.pfLv) el.pfLv.textContent = 'Lv' + i.level;
    if (el.pfLvTitle) el.pfLvTitle.textContent = i.title;
    if (el.pfExp) el.pfExp.textContent = i.cur + ' / ' + i.need + '（累计 ' + i.exp + '）';
    if (el.pfLvFill) el.pfLvFill.style.width = i.pct + '%';
    var todayExp = (myProfile && myProfile.expToday && window.Level &&
                    myProfile.expToday.day === window.Level.dayKey()) ? myProfile.expToday.amount : 0;
    if (el.pfLvTip) {
      el.pfLvTip.textContent = '再得 ' + Math.max(0, i.need - i.cur) + ' 点经验升到 Lv' + (i.level + 1) +
        (todayExp ? ' · 今天已得 ' + todayExp + ' 点' : '');
    }
    if (el.acctLv) {
      el.acctLv.hidden = !myProfile;
      if (myProfile) el.acctLv.textContent = 'Lv' + i.level;
    }
    if (el.btnCheckin && el.pfCheckinTip && window.Level) {
      var ci = (myProfile && myProfile.checkin) || { last: '', streak: 0 };
      var streak = window.Level.nextStreak(ci);
      if (streak === 0) {
        el.btnCheckin.disabled = true;
        el.btnCheckin.textContent = '✅ 今天已签到';
        el.pfCheckinTip.textContent = '已连续签到 ' + (ci.streak || 0) + ' 天，明天再来';
      } else {
        el.btnCheckin.disabled = false;
        el.btnCheckin.textContent = '📅 签到 +' + window.Level.checkinGain(streak) + ' 经验';
        el.pfCheckinTip.textContent = (ci.streak ? ('已连续 ' + ci.streak + ' 天，今天是第 ' + streak + ' 天')
                                                : '每天一次，连着签经验更多');
      }
    }
  }

  /* 发经验。kind: 'solo' | 'take' | 'multi' */
  function grantExp(kind, o, done) {
    o = o || {};
    if (!UserAPI.savedName() || !window.Level) return done && done(null);
    var gain = window.Level.gainFrom({
      kind: kind, score: o.score, right: o.right, total: o.total, mvp: !!o.mvp
    });
    UserAPI.addExp(gain, kind, function (err, rec, out) {
      if (err || !rec) return done && done(err);
      myProfile = rec;
      var lvBefore = (out && typeof out.before === 'number') ? lvInfo({ exp: out.before }).level : null;
      var lvAfter = lvInfo(rec).level;
      renderLevelCard();
      renderHome();
      if (lvBefore !== null && lvAfter > lvBefore) {
        confetti();
        expToast('🎉 升级！<b>Lv' + lvAfter + '</b> ' + lvInfo(rec).title, true);
        sfxRight();
      } else {
        expToast('✨ 经验 +' + gain);
      }
      done && done(null, out);
    });
  }

  /* 每日签到 */
  function doCheckin() {
    if (!UserAPI.savedName()) { goAccount(); return; }
    if (!el.btnCheckin) return;
    var lvBefore = lvInfo(myProfile).level;
    el.btnCheckin.disabled = true;
    UserAPI.doCheckin(function (err, rec, out) {
      if (err) {
        el.btnCheckin.disabled = false;
        alert(err);
        return;
      }
      if (!rec) { el.btnCheckin.disabled = false; return; }
      myProfile = rec;
      renderLevelCard();
      if (out && out.already) {
        expToast('今天已经签到过了，明天再来～');
        return;
      }
      var lvAfter = lvInfo(rec).level;
      if (lvAfter > lvBefore) {
        confetti();
        expToast('📅 签到 +' + out.gained + ' 经验 · 🎉 升级 <b>Lv' + lvAfter + '</b>', true);
      } else {
        expToast('📅 签到成功 · 连续 ' + out.streak + ' 天 · 经验 +' + out.gained);
      }
      sfxRight();
    });
  }

  /* ================= 好友 ================= */
  function goFriends() {
    var me = UserAPI.savedName();
    if (!me) { goAccount(); return; }
    show('s-friends');
    el.frMe.textContent = '👤 ' + me;
    loadFriends();
    loadRequests();
    loadBlocked();
    UserAPI.watchSelf(me, function () { loadRequests(); loadFriends(); });
  }

  function loadFriends() {
    UserAPI.getFriends(function (err, list) {
      list = list || [];
      if (!list.length) {
        el.friendList.innerHTML = '<p class="empty-tip">还没有好友，去「加好友」搜账号吧</p>';
        return;
      }
      UserAPI.getProfiles(list.map(function (x) { return x.name; }), function (e2, profs) {
        el.friendList.innerHTML = '';
        // 等级高的排前面
        list = list.slice().sort(function (a, b) {
          return (((profs[b.name] || {}).exp) || 0) - (((profs[a.name] || {}).exp) || 0);
        });
        list.forEach(function (f) {
          var p = profs[f.name] || {};
          var d = document.createElement('div');
          d.className = 'friend-item';
          d.innerHTML = '<div class="av-sm"></div><div style="flex:1;min-width:0"><div class="fi-n"></div><div class="fi-s"></div></div>' +
            '<div class="fi-actions"><button class="fi-more" title="更多">⋯</button></div>';
          d.querySelector('.av-sm').textContent = p.avatar || '👤';
          d.querySelector('.fi-n').textContent = p.nick || f.name;
          var flv = lvInfo(p);
          d.querySelector('.fi-s').textContent = 'Lv' + flv.level + ' ' + flv.title + ' · @' + f.name;
          d.addEventListener('click', function () { openChat(f.name, p); });
          d.querySelector('.fi-more').addEventListener('click', function (ev) {
            ev.stopPropagation();
            openFriendMenu(f.name, p);
          });
          el.friendList.appendChild(d);
        });
      });
    });
  }

  function loadRequests() {
    UserAPI.getRequests(function (err, list) {
      list = list || [];
      if (el.reqBadge) el.reqBadge.textContent = list.length ? '(' + list.length + ')' : '';
      if (!list.length) {
        el.reqList.innerHTML = '<p class="empty-tip">没有新的好友申请</p>';
        return;
      }
      UserAPI.getProfiles(list.map(function (x) { return x.from; }), function (e2, profs) {
        el.reqList.innerHTML = '';
        list.forEach(function (r) {
          var p = profs[r.from] || {};
          var d = document.createElement('div');
          d.className = 'result-row';
          d.innerHTML = '<div class="av-sm"></div><div style="flex:1;min-width:0"><div class="rr-n"></div><div class="rr-s"></div></div>';
          d.querySelector('.av-sm').textContent = p.avatar || '👤';
          d.querySelector('.rr-n').textContent = p.nick || r.from;
          d.querySelector('.rr-s').textContent = '@' + r.from + ' 想加你好友';
          var yes = document.createElement('button');
          yes.className = 'btn btn-primary btn-sm'; yes.textContent = '同意';
          yes.addEventListener('click', function () { UserAPI.acceptRequest(r.from, function () { loadRequests(); loadFriends(); }); });
          var no = document.createElement('button');
          no.className = 'btn btn-ghost btn-sm'; no.textContent = '忽略';
          no.style.marginLeft = '6px';
          no.addEventListener('click', function () { UserAPI.rejectRequest(r.from, function () { loadRequests(); }); });
          var box = d.querySelector('div[style]');
          box.appendChild(yes); box.appendChild(no);
          el.reqList.appendChild(d);
        });
      });
    });
  }

  function loadBlocked() {
    UserAPI.getBlocked(function (err, list) {
      list = list || [];
      el.blCount.textContent = list.length + ' 人';
      el.blList.innerHTML = '';
      if (!list.length) {
        el.blList.innerHTML = '<p class="empty-tip">黑名单是空的</p>';
        return;
      }
      list.forEach(function (b) {
        var d = document.createElement('div');
        d.className = 'result-row';
        d.innerHTML = '<div style="flex:1;min-width:0"><div class="rr-n"></div></div>';
        d.querySelector('.rr-n').textContent = b.name;
        var btn = document.createElement('button');
        btn.className = 'btn btn-ghost btn-sm'; btn.textContent = '移出黑名单';
        btn.addEventListener('click', function () { UserAPI.unblockUser(b.name, function () { loadBlocked(); }); });
        d.appendChild(btn);
        el.blList.appendChild(d);
      });
    });
  }

  function openFriendMenu(name, prof) {
    openModal('@' + name,
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn btn-primary" id="fm-dm">💬 发私信</button>' +
      '<button class="btn btn-multi" id="fm-invite">🎮 邀请对战</button>' +
      '<button class="btn btn-ghost" id="fm-score">🏆 看 TA 的成绩</button>' +
      '<button class="btn btn-ghost" id="fm-del">🗑 删除好友</button>' +
      '<button class="btn btn-ghost" id="fm-block">🚫 拉黑</button>' +
      '</div>',
      [{ label: '关闭', cls: 'btn-ghost', fn: closeModal }]);

    var g = function (id) { return document.getElementById(id); };
    g('fm-dm').addEventListener('click', function () { closeModal(); openChat(name, prof); });
    g('fm-invite').addEventListener('click', function () { closeModal(); inviteFriend(name); });
    g('fm-score').addEventListener('click', function () { closeModal(); viewFriendScores(name, prof); });
    g('fm-del').addEventListener('click', function () { closeModal(); UserAPI.removeFriend(name, function () { loadFriends(); }); });
    g('fm-block').addEventListener('click', function () {
      closeModal();
      openModal('拉黑 @' + name + '？',
        '<p class="empty-tip">拉黑后你们不再是好友，对方也无法再向你发好友申请（除非你把他移出黑名单）。</p>',
        [
          { label: '取消', cls: 'btn-ghost', fn: closeModal },
          { label: '确定拉黑', cls: 'btn-primary', fn: function () { closeModal(); UserAPI.blockUser(name, function () { loadFriends(); loadBlocked(); }); } }
        ]);
    });
  }

  /* ================= 聊天（微信式独立界面） ================= */
  var EMOJIS = ['😀','😄','😁','😆','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😜','🤪','🤗',
                '🤔','🤨','😐','😴','😢','😭','😤','😡','🥺','😱','🤯','🥳','😎','🤓','🙄','😷',
                '👍','👎','👏','🙏','💪','🤝','✌️','🤟','👋','🎉','🔥','💯','❤️','💔','⭐','✨',
                '🎵','🎧','🎤','🏆','👑','🍻','🍜','☕','🌙','☀️','🚀','💡','😂','🤝','🐶','🐱'];

  var chatPeer = null, chatProf = null, chatTick = null, chatPending = null;

  function dayLabel(ts) {
    var d = new Date(ts), n = new Date();
    var same = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
    var y = new Date(n.getTime() - 86400000);
    if (same(d, n)) return '今天';
    if (same(d, y)) return '昨天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function hhmm(ts) {
    var d = new Date(ts);
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  function openChat(name, prof) {
    chatPeer = name;
    chatProf = prof || {};
    var clv = lvInfo(chatProf);
    el.chatName.textContent = (chatProf.nick || name) +
      (chatProf && chatProf.exp !== undefined ? ' · Lv' + clv.level : '');
    el.chatAv.textContent = chatProf.avatar || '👤';
    el.chatText.value = '';
    el.emojiRow.hidden = true;
    el.btnEmoji.classList.remove('on');
    show('s-chat');
    renderChat([]);
    reloadChat();
    UserAPI.watchInbox(function (topic, data) {
      if (data && (data.from === name || data.to === name)) reloadChat();
    });
    if (chatTick) clearInterval(chatTick);
    chatTick = setInterval(reloadChat, 5000);
  }

  function closeChat() {
    if (chatTick) { clearInterval(chatTick); chatTick = null; }
    if (chatPending) { clearTimeout(chatPending); chatPending = null; }
    UserAPI.watchInbox(null);
    chatPeer = null;
    show('s-friends');
  }

  /* 合并刷新：短时间内多次触发只拉一次，避免「收到消息→刷新→再订阅→再收到」来回打转 */
  function reloadChat() {
    if (!chatPeer || chatPending) return;
    chatPending = setTimeout(function () {
      chatPending = null;
      if (!chatPeer) return;
      UserAPI.getDMs(chatPeer, function (err, list) { if (chatPeer) renderChat(list || []); });
    }, 250);
  }

  function renderChat(list) {
    var box = el.chatBody;
    if (!box) return;
    var me = UserAPI.savedName() || '我';
    var myAv = (myProfile && myProfile.avatar) || '👤';
    box.innerHTML = '';
    if (!list.length) {
      var e = document.createElement('div');
      e.className = 'chat-empty';
      e.innerHTML = '还没有消息<br>打个招呼吧 👋';
      box.appendChild(e);
      return;
    }
    var lastDay = '';
    list.forEach(function (m) {
      var day = dayLabel(m.at);
      if (day !== lastDay) {
        lastDay = day;
        var dv = document.createElement('div');
        dv.className = 'chat-day'; dv.textContent = day;
        box.appendChild(dv);
      }
      var mine = (m.from === me);
      var row = document.createElement('div');
      row.className = 'msg-row ' + (mine ? 'me' : 'you');
      var av = document.createElement('div');
      av.className = 'msg-av';
      av.textContent = mine ? myAv : (chatProf.avatar || '👤');
      var wrap = document.createElement('div');
      var bub = document.createElement('div');
      bub.className = 'msg-bub';
      bub.textContent = m.text;
      var meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.textContent = hhmm(m.at);
      wrap.appendChild(bub); wrap.appendChild(meta);
      row.appendChild(av); row.appendChild(wrap);
      box.appendChild(row);
    });
    box.scrollTop = box.scrollHeight;
  }

  function renderEmojiRow() {
    el.emojiRow.innerHTML = '';
    EMOJIS.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = e;
      b.addEventListener('click', function () {
        el.chatText.value += e;
        try { el.chatText.focus(); } catch (err) {}
      });
      el.emojiRow.appendChild(b);
    });
  }

  function sendChat() {
    if (!chatPeer) return;
    var v = (el.chatText.value || '').trim();
    if (!v) return;
    el.chatText.value = '';
    UserAPI.sendDM(chatPeer, v, function () { reloadChat(); });
  }

  el.btnChatBack.addEventListener('click', closeChat);
  el.btnChatSend.addEventListener('click', sendChat);
  el.chatText.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  });
  el.btnEmoji.addEventListener('click', function () {
    var on = el.emojiRow.hidden;
    el.emojiRow.hidden = !on;
    el.btnEmoji.classList.toggle('on', on);
    if (on) { renderEmojiRow(); setTimeout(function () { el.chatBody.scrollTop = el.chatBody.scrollHeight; }, 60); }
  });
  el.btnChatMore.addEventListener('click', function () {
    if (!chatPeer) return;
    var p = chatPeer;
    var prof = chatProf;
    openModal('@' + p,
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn btn-multi" id="cm-invite">🎮 邀请 TA 对战</button>' +
      '<button class="btn btn-ghost" id="cm-score">🏆 看 TA 的成绩</button>' +
      '<button class="btn btn-ghost" id="cm-del">🗑 删除好友</button>' +
      '<button class="btn btn-ghost" id="cm-block">🚫 拉黑</button>' +
      '</div>',
      [{ label: '关闭', cls: 'btn-ghost', fn: closeModal }]);
    var g = function (id) { return document.getElementById(id); };
    g('cm-invite').addEventListener('click', function () { closeModal(); inviteFriend(p); });
    g('cm-score').addEventListener('click', function () { closeModal(); viewFriendScores(p, prof); });
    g('cm-del').addEventListener('click', function () { closeModal(); UserAPI.removeFriend(p, function () { closeChat(); }); });
    g('cm-block').addEventListener('click', function () {
      closeModal();
      openModal('拉黑 @' + p + '？',
        '<p class="empty-tip">拉黑后你们不再是好友，对方也无法再向你发好友申请（除非你把他移出黑名单）。</p>',
        [
          { label: '取消', cls: 'btn-ghost', fn: closeModal },
          { label: '确定拉黑', cls: 'btn-primary', fn: function () { closeModal(); UserAPI.blockUser(p, function () { closeChat(); }); } }
        ]);
    });
  });

  function inviteFriend(name) {
    RoomAPI.create(UserAPI.savedName() || '房主', function (err, r) {
      if (err) { alert(err); return; }
      room = r; isMulti = true;
      UserAPI.sendDM(name, '【对战邀请】房间码 ' + r.code + ' —— 打开猜歌王 → 多人对战 → 输码进来！', function () {});
      openModal('已邀请 @' + name,
        '<p class="empty-tip">房间码 <b>' + r.code + '</b> 已经私信给 TA。<br>你现在是房主，等人进来就能开始。</p>',
        [{ label: '进入房间', cls: 'btn-primary', fn: function () { closeModal(); show('s-room'); renderRoom(); startRoomPoll(); } }]);
    });
  }

  function viewFriendScores(name, prof) {
    UserAPI.getScores(name, function (err, list) {
      list = list || [];
      var lv = lvInfo(prof);
      openModal('🏆 ' + ((prof && prof.nick) || name) + (prof && prof.exp !== undefined ? ' · Lv' + lv.level : ''),
        '<p class="lv-tip" style="margin:-4px 0 10px">' + (prof && prof.exp !== undefined
          ? ('等级 Lv' + lv.level + ' · ' + lv.title + ' · 累计经验 ' + lv.exp)
          : 'TA 还没登录过') + '</p>' +
        '<div class="results" id="fs-list"></div>',
        [{ label: '关闭', cls: 'btn-ghost', fn: closeModal }]);
      var box = document.getElementById('fs-list');
      if (!box) return;
      if (!list.length) { box.innerHTML = '<p class="empty-tip">TA 还没有答题记录</p>'; return; }
      list.slice().reverse().forEach(function (s) { box.appendChild(scoreRow(s)); });
    });
  }

  /* ---------------- 事件 ---------------- */
  el.poolTiles.forEach(function (t) {
    t.addEventListener('click', function () {
      el.poolTiles.forEach(function (x) { x.classList.remove('is-active'); });
      t.classList.add('is-active');
      pool = t.getAttribute('data-pool');
      sfxTap();
      refreshCounts();
    });
  });
  el.playTiles.forEach(function (t) {
    t.addEventListener('click', function () {
      el.playTiles.forEach(function (x) { x.classList.remove('is-active'); });
      t.classList.add('is-active');
      play = t.getAttribute('data-play');
      // 听歌猜歌手需要库里有多位歌手，「歌手专项」不适用
      if (play === 'singer' && pool === 'artist') {
        pool = 'zh';
        el.poolTiles.forEach(function (x) { x.classList.toggle('is-active', x.getAttribute('data-pool') === 'zh'); });
      }
      refreshCounts();
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
  el.disc.addEventListener('click', togglePlay);
  audio.addEventListener('ended', function () {
    audio.__done = true;
    el.disc.classList.remove('is-playing');
    el.discIco.textContent = '▶';
    if (!locked && state && state.current) el.playerTip.textContent = '播放完了 · 点唱片重播';
  });
  el.btnListen.addEventListener('click', togglePlay);
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
    var name = pickName();
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
    var name = pickName();
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
    var s = room.settings;
    var list = uniqByTitle(shuffle(poolBySettings(s)));
    if (list.length < 4) {
      alert('这个设置的题库不够（' + POOL_NAME[s.pool] + ' · ' + DIFF_NAME[s.difficulty] +
        '），换个曲库或难度再开始');
      return;
    }
    var need = (s.mode === 'speed') ? s.rounds : Math.min(list.length, 40);
    var keys = list.slice(0, need).map(function (x) { return x.a + '|' + x.t; });
    RoomAPI.start(room.code, keys, function (err) { if (err) alert(err); });
  });

  el.btnRoomLeave.addEventListener('click', function () {
    var host = isHost();
    openModal(host ? '解散房间？' : '离开房间？',
      '<p class="empty-tip">' + (host
        ? '你是房主，你离开后<b>整个房间会解散</b>，其他人会收到「房间已失效」的提示。'
        : '离开后要重新输入房间码才能回来。') + '</p>',
      [
        { label: '再玩会儿', cls: 'btn-ghost', fn: closeModal },
        { label: host ? '解散并离开' : '离开', cls: 'btn-primary', fn: function () { closeModal(); leaveRoom(); } }
      ]);
  });

  /* ---- 账号事件 ---- */
  el.btnAccount.addEventListener('click', goProfile);
  if (el.acctChip) el.acctChip.addEventListener('click', function () {
    if (UserAPI.savedName()) goProfile(); else goAccount();
  });
  el.btnFriends.addEventListener('click', goFriends);
  el.btnProfileBack.addEventListener('click', function () { show('s-start'); });
  el.btnFriendsBack.addEventListener('click', function () { show('s-start'); });
  el.btnLogout.addEventListener('click', function () {
    UserAPI.loggedOut(); myUser = null; myProfile = null; refreshUserUI(); show('s-start');
  });
  el.btnPfNick.addEventListener('click', function () {
    var v = (el.pfNickInput.value || '').trim().slice(0, 12);
    if (!v) {
      el.pfNickInput.classList.add('is-error');
      setTimeout(function () { el.pfNickInput.classList.remove('is-error'); }, 1500);
      sfxWrong();
      return;
    }
    UserAPI.updateProfile({ nick: v }, function (err, rec) {
      if (err) { alert(err); return; }
      myProfile = rec; renderProfile();
    });
  });
  if (el.btnCheckin) el.btnCheckin.addEventListener('click', doCheckin);
  el.friendTabs.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    Array.prototype.forEach.call(el.friendTabs.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    var tab = b.getAttribute('data-tab');
    el.paneFlist.hidden = tab !== 'list';
    el.paneFadd.hidden = tab !== 'add';
    el.paneFreq.hidden = tab !== 'req';
    if (tab === 'req') loadRequests();
    if (tab === 'add') loadBlocked();
  });
  el.btnFrSearch.addEventListener('click', function () {
    var q = (el.frSearch.value || '').trim();
    if (!q) {
      el.frSearch.classList.add('is-error');
      setTimeout(function () { el.frSearch.classList.remove('is-error'); }, 1500);
      sfxWrong();
      return;
    }
    el.frSearchResult.innerHTML = '<p class="empty-tip">搜索中…</p>';
    UserAPI.getProfile(q, function (err, p) {
      el.frSearchResult.innerHTML = '';
      if (err || !p) {
        el.frSearchResult.innerHTML = '<p class="empty-tip">没找到这个账号</p>';
        return;
      }
      var d = document.createElement('div');
      d.className = 'friend-item';
      d.innerHTML = '<div class="av-sm"></div><div style="flex:1;min-width:0"><div class="fi-n"></div><div class="fi-s"></div></div>';
      d.querySelector('.av-sm').textContent = p.avatar || '👤';
      d.querySelector('.fi-n').textContent = p.nick || p.name;
      var slv = lvInfo(p);
      d.querySelector('.fi-s').textContent = 'Lv' + slv.level + ' ' + slv.title + ' · @' + p.name;
      var add = document.createElement('button');
      add.className = 'btn btn-primary btn-sm';
      add.textContent = '加好友';
      add.addEventListener('click', function () {
        add.disabled = true;
        UserAPI.sendFriendRequest(p.name, function (err2) {
          add.disabled = false;
          alert(err2 ? err2 : '申请已发送，等对方同意');
        });
      });
      d.appendChild(add);
      el.frSearchResult.appendChild(d);
    });
  });
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
      UserAPI.getProfile(n, function (e2, prof) { if (prof) { myProfile = prof; renderLevelCard(); } });
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
      UserAPI.getProfile(n, function (e2, prof) { if (prof) { myProfile = prof; renderLevelCard(); } });
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
    var want = (play === 'singer') ? state.current.correct.a : state.current.correct.t;
    judge(normTitle(v) === normTitle(want), v);
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

  renderArtistChips();
  refreshCounts();
  var ld = document.getElementById('loading');
  if (ld) setTimeout(function () { ld.classList.add('hide'); }, 260);

  /* 打开网站就检测登录状态 */
  myUser = UserAPI.savedName() || null;
  refreshUserUI();
  if (UserAPI.savedName()) {
    UserAPI.getProfile(UserAPI.savedName(), function (err, p) { if (p) myProfile = p; });
  }
  setTimeout(bootAuth, 500);
})();
