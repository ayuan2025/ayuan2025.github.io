/* 首页书桌：点书脊 → 抽出 → 转到眼前 → 掀开封面 → 溶进纸里 → 进入翻页书
 * 点 CD 盒 → 捧起 jewel case → 打开盒盖 → 溶进纸里 → 进入唱片架
 * 点黑胶唱机 → 唱片升起旋转放大 → 溶进纸里 → 进入唱机播放界面
 *
 * 三条硬约束（防跳转白屏）：
 *   1. 不再「推近铺满」。收尾只轻轻凑近一点点，同时整体淡出。
 *   2. 底色从书桌色起步、收尾渐变到纸色（= 落地页底色）。
 *   3. 最后一帧是纯纸色；落地页用同一块纸色遮罩接住。
 *
 * 节奏（约 1.14s，三种过场共用同一时间线）：
 *   0ms    底色升起 + 轻微压暗
 *   30ms   起飞：原位撑大、移到眼前（.5s）
 *   480ms  开：书=掀封面 / CD=翻盒盖 / 唱机=唱片就位
 *   820ms  收尾：凑近一点 + 淡出 + 底色归一到纸色
 *   1140ms 跳转
 */
(function () {
  var overlay = document.getElementById('flipOverlay');
  var flyBook = document.getElementById('flyBook');
  var flyCover = document.getElementById('flyCoverFace');
  var flyTitle = document.getElementById('flyPageTitle');
  var flyCd = document.getElementById('flyCd');
  if (!overlay || !flyBook) return;

  var busy = false;
  var timers = [];

  var T_PULL = 30;    // 起飞（让底色先起来）
  var T_OPEN = 480;   // 开（封面/盒盖/唱片就位）
  var T_SETTLE = 820; // 收尾
  var T_GO = 1140;    // 跳转

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function reset() {
    clearTimers();
    busy = false;
    overlay.className = 'flip-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    flyBook.className = 'fly-book';
    flyBook.style.transition = 'none';
    flyBook.style.transform = '';
    flyBook.style.opacity = '';
    flyBook.style.display = '';
    if (flyCd) {
      flyCd.className = 'fly-cd';
      flyCd.setAttribute('aria-hidden', 'true');
      flyCd.style.transition = 'none';
      flyCd.style.left = '';
      flyCd.style.top = '';
      flyCd.style.width = '';
      flyCd.style.height = '';
      flyCd.style.transform = '';
      flyCd.style.opacity = '';
    }
  }

  function go(href) {
    try { sessionStorage.setItem('fromShelf', '1'); } catch (e) {}
    window.location.href = href;
  }

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  /* 公共时间线：startOrbit(元素, 原位rect, 目标尺寸) → open → settle → go */
  function runTimeline(el, r, tw, th, tilt, onOpen, href) {
    el.style.transition = 'none';
    el.style.opacity = '';
    el.style.left = r.left + 'px';
    el.style.top = r.top + 'px';
    el.style.width = r.width + 'px';
    el.style.height = r.height + 'px';
    el.style.transform = 'perspective(1200px) ' +
      (tilt && tilt !== 'none' ? tilt + ' ' : '') + 'rotateY(-9deg)';

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');

    at(T_PULL, function () {
      el.style.transition = '';
      el.classList.add('moving');
      el.style.left = Math.round((window.innerWidth - tw) / 2) + 'px';
      el.style.top = Math.round((window.innerHeight - th) / 2) + 'px';
      el.style.width = Math.round(tw) + 'px';
      el.style.height = Math.round(th) + 'px';
      el.style.transform = 'perspective(1200px) rotate(0deg) rotateY(0deg)';
    });

    at(T_OPEN, function () { el.classList.add('opening'); if (onOpen) onOpen(); });

    at(T_SETTLE, function () {
      el.classList.remove('moving');
      el.classList.add('settling');
      el.style.transform = 'scale(1.05)';
      overlay.classList.add('settling');
    });

    at(T_GO, function () { go(href); });
  }

  function targetSize() {
    return {
      w: Math.min(430, window.innerWidth * 0.58),
      h: Math.min(580, window.innerHeight * 0.72)
    };
  }

  /* ---- 书：抽出 → 掀封面 ---- */
  function openBook(spine) {
    var href = spine.getAttribute('data-href');
    var label = spine.getAttribute('data-label') || '';
    var r = spine.getBoundingClientRect();
    flyBook.style.display = '';
    if (flyCd) flyCd.style.display = 'none';
    // 封面沿用这本书的纸质底色与斑驳
    flyCover.style.backgroundImage = getComputedStyle(spine).backgroundImage;
    flyTitle.textContent = label;
    var t = targetSize();
    runTimeline(flyBook, r, t.w, t.h, getComputedStyle(spine).transform, null, href);
  }

  /* ---- CD 盒：捧起 jewel case → 盒盖翻开，露出唱片 ---- */
  function openCd(spine) {
    if (!flyCd) { openBook(spine); return; }
    var href = spine.getAttribute('data-href');
    var r = spine.getBoundingClientRect();
    flyBook.style.display = 'none';
    flyCd.style.display = 'block';
    flyCd.setAttribute('aria-hidden', 'false');
    var t = targetSize();
    // jewel case 近正方，高度略收
    var side = Math.min(t.w, t.h * 0.82, 380);
    runTimeline(flyCd, r, side, side, getComputedStyle(spine).transform, null, href);
  }

  /* ---- 黑胶唱机：唱片升起、旋转放大，溶进纸色 ---- */
  function openTurntable(tt) {
    if (!flyCd) { go(tt.getAttribute('data-href')); return; }
    var href = tt.getAttribute('data-href');
    var r = tt.getBoundingClientRect();
    flyBook.style.display = 'none';
    flyCd.style.display = 'block';
    flyCd.setAttribute('aria-hidden', 'false');
    flyCd.classList.add('vinyl'); // 变体：只露一张黑胶
    var side = Math.min(480, window.innerWidth * 0.62, window.innerHeight * 0.7);
    runTimeline(flyCd, r, side, side, 'none', null, href);
  }

  function dispatch(sp) {
    if (busy) return;
    busy = true;
    // 系统关掉了动画偏好：直接过去，不做过场
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { go(sp.getAttribute('data-href')); return; }
    if (sp.classList.contains('turntable')) openTurntable(sp);
    else if (sp.classList.contains('cd')) openCd(sp);
    else openBook(sp);
  }

  // 书脊 / CD 盒：点击 / 键盘可达
  document.querySelectorAll('.spine').forEach(function (sp) {
    sp.addEventListener('click', function () { dispatch(sp); });
    sp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch(sp); }
    });
  });

  // 黑胶唱机
  document.querySelectorAll('.turntable').forEach(function (tt) {
    tt.addEventListener('click', function () { dispatch(tt); });
    tt.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch(tt); }
    });
  });

  // 返回本页时（含浏览器缓存返回 / 后退）把场景复位
  window.addEventListener('pageshow', reset);
})();
