/* 音乐页逻辑：唱片架渲染 + CD 播放器 + 歌词同步 + 校准模式 */
(function () {
  var SONGS = window.SONGS || [];
  var body = document.body;

  function fmt(s) {
    if (!isFinite(s)) return '00:00';
    s = Math.max(0, Math.round(s));
    return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ---------- 唱片架 ---------- */
  if (body.classList.contains('page-music-index')) {
    var box = document.getElementById('songList');
    if (box) {
      box.innerHTML = SONGS.map(function (s, i) {
        return '<a class="song-row" href="song.html?p=' + s.slug + '">'
          + '<span class="song-no">' + ('0' + (i + 1)).slice(-2) + '</span>'
          + '<span class="mini-disc"></span>'
          + '<span class="song-title">' + esc(s.title)
          + (s.sub ? '<small>' + esc(s.sub) + '</small>' : '')
          + (s.lrc && s.lrc.length ? '<span class="song-tag">词</span>' : '')
          + '</span>'
          + '<span class="song-dur">' + esc(s.dur || '') + '</span>'
          + '</a>';
      }).join('');
    }
    return;
  }

  /* ---------- CD 播放页 ---------- */
  if (!body.classList.contains('page-music-song')) return;

  var q = new URLSearchParams(location.search);
  var tune = q.get('tune') === '1';
  if (tune) body.classList.add('tune');

  var idx = 0;
  for (var i = 0; i < SONGS.length; i++) if (SONGS[i].slug === q.get('p')) idx = i;

  var $ = function (id) { return document.getElementById(id); };
  var disc = $('disc'), playBtn = $('playBtn'), prevBtn = $('prevSong'), nextBtn = $('nextSong');
  var bar = $('seekBar'), tCur = $('tCur'), tAll = $('tAll');
  var lyricsEl = $('lyrics'), titleEl = $('songTitle'), subEl = $('songSub');
  var tBar = $('tuneCur'), tOut = $('tuneOut');
  var audio = new Audio();
  audio.preload = 'metadata';
  var dragging = false, lastCur = -2, lrc = null, sel = 0;

  function loadSong(i) {
    idx = (i + SONGS.length) % SONGS.length;
    var s = SONGS[idx];
    document.title = s.title + ' · 音乐 · 阿元的自留地';
    titleEl.textContent = s.title;
    subEl.textContent = s.sub ? s.sub + ' · 阿元壹号' : '阿元壹号';
    audio.src = s.audio;
    lrc = s.lrc && s.lrc.length ? s.lrc.slice() : null;
    sel = 0; lastCur = -2;
    bar.value = 0; tCur.textContent = '00:00'; tAll.textContent = s.dur || '00:00';
    if (lrc) {
      lyricsEl.innerHTML = lrc.map(function (l, k) {
        return '<p class="lrc-line" data-k="' + k + '">' + esc(l[1]) + '</p>';
      }).join('');
    } else {
      lyricsEl.innerHTML = '<p class="lrc-empty">歌词待补充<br>先听 CD 吧</p>';
    }
    try { history.replaceState(null, '', 'song.html?p=' + s.slug + (tune ? '&tune=1' : '')); } catch (e) {}
  }

  function play() { audio.play().catch(function () {}); }
  function toggle() { audio.paused ? play() : audio.pause(); }

  disc.addEventListener('click', toggle);
  playBtn.addEventListener('click', toggle);
  audio.addEventListener('play', function () { body.classList.add('playing'); });
  audio.addEventListener('pause', function () { body.classList.remove('playing'); });

  prevBtn.addEventListener('click', function () { loadSong(idx - 1); play(); });
  nextBtn.addEventListener('click', function () { loadSong(idx + 1); play(); });
  audio.addEventListener('ended', function () { loadSong(idx + 1); play(); });

  bar.addEventListener('input', function () {
    if (audio.duration) audio.currentTime = bar.value / 1000 * audio.duration;
  });
  bar.addEventListener('pointerdown', function () { dragging = true; });
  window.addEventListener('pointerup', function () { dragging = false; });

  lyricsEl.addEventListener('click', function (e) {
    var p = e.target.closest('.lrc-line');
    if (p && lrc) { audio.currentTime = lrc[Number(p.getAttribute('data-k'))][0]; if (audio.paused) play(); }
  });

  audio.addEventListener('timeupdate', function () {
    var d = audio.duration || 0, c = audio.currentTime || 0;
    if (!dragging && d) bar.value = Math.round(c / d * 1000);
    tCur.textContent = fmt(c);
    if (!lrc || dragging) return;
    var cur = -1;
    for (var k = 0; k < lrc.length; k++) if (c >= lrc[k][0] - 0.15) cur = k;
    if (cur !== lastCur) {
      lastCur = cur;
      var lines = lyricsEl.querySelectorAll('.lrc-line');
      for (var j = 0; j < lines.length; j++) lines[j].classList.toggle('cur', j === cur);
      var el = lines[cur >= 0 ? cur : 0];
      if (el) {
        /* 只滚歌词容器，别把整页窗口一起滚走（scrollIntoView 会滚所有可滚祖先，CD 会被顶出屏） */
        var box = lyricsEl.getBoundingClientRect();
        var r = el.getBoundingClientRect();
        lyricsEl.scrollTop += r.top - box.top - box.height / 2 + r.height / 2;
      }
    }
  });

  /* ---------- 校准模式 ---------- */
  function paintTune() {
    tBar.textContent = '第 ' + (sel + 1) + ' 行 · ' + fmt(lrc ? lrc[sel][0] : 0);
  }
  if (tune) {
    document.getElementById('tSelPrev').addEventListener('click', function () { sel = Math.max(0, sel - 1); paintTune(); });
    document.getElementById('tSelNext').addEventListener('click', function () { sel = Math.min((lrc ? lrc.length : 1) - 1, sel + 1); paintTune(); });
    document.getElementById('tMark').addEventListener('click', function () {
      if (lrc) { lrc[sel][0] = +audio.currentTime.toFixed(2); paintTune(); }
    });
    document.getElementById('tShift').addEventListener('click', function () {
      if (!lrc) return;
      var off = +(audio.currentTime - lrc[0][0]).toFixed(2);
      for (var k = 0; k < lrc.length; k++) lrc[k][0] = +(lrc[k][0] + off).toFixed(2);
      paintTune();
    });
    document.getElementById('tCopy').addEventListener('click', function () {
      if (!lrc) return;
      var json = JSON.stringify(lrc);
      tOut.value = json;
      tOut.parentElement.classList.add('show-out');
      tOut.select();
      try { document.execCommand('copy'); } catch (e) {}
      if (navigator.clipboard) navigator.clipboard.writeText(json).catch(function () {});
    });
  }

  loadSong(idx);
  paintTune();
  window.__musicTest = audio; /* 验证钩子：自动化测试用 */
})();
