/* 首页书桌：点书脊 → 抽出 → 转到眼前 → 掀开封面 → 溶进纸里 → 进入翻页书
 *
 * 上一版的问题：最后一步会把米白纸推近到铺满整个屏幕、停住 380ms，紧接着
 * window.location.href 整页跳转 —— 浏览器卸载到新页渲染之间那段，正好是一整屏白。
 *
 * 这一版的三条硬约束：
 *   1. 不再「推近铺满」。收尾只轻轻凑近一点点，同时整本书淡出。
 *   2. 底色从书桌色起步、收尾渐变到纸色（= 落地页底色），过程中绝不出现新的浅色块。
 *   3. 最后一帧是纯纸色；落地页用同一块纸色遮罩接住，露出来的过程才逐步显示内容。
 *      → 即便中间浏览器闪一下，闪的也是纸色，不再是白的。
 *
 * 节奏（约 1.14s）：
 *   0ms    底色升起 + 轻微压暗（书像被聚光灯从桌面上拎起来）
 *   30ms   抽出：从书脊原位撑成整本书，边转正边到眼前（.5s）
 *   480ms  掀封面（3D .44s），露出内页
 *   680ms  内页上的书名浮出
 *   820ms  收尾：凑近一点 + 整本书淡出（.26s）+ 底色归一到纸色（.3s）
 *   1140ms 跳转 —— 这一刻必须已经是「书没了 + 纯纸色」，否则跳过去会硬切一下
 */
(function () {
  var overlay = document.getElementById('flipOverlay');
  var flyBook = document.getElementById('flyBook');
  var flyCover = document.getElementById('flyCoverFace');
  var flyTitle = document.getElementById('flyPageTitle');
  if (!overlay || !flyBook) return;

  var busy = false;
  var timers = [];

  var T_PULL = 30;    // 起飞（让底色先起来）
  var T_OPEN = 480;   // 掀封面
  var T_SETTLE = 820; // 收尾：掀完后顺势凑近 + 溶进纸色
  var T_GO = 1140;    // 跳转（比上面的收尾动画多留 20ms，确保已是纯纸色）

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
  }

  function go(href) {
    try { sessionStorage.setItem('fromShelf', '1'); } catch (e) {}
    window.location.href = href;
  }

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function openBook(spine) {
    if (busy) return;
    busy = true;

    var href = spine.getAttribute('data-href');
    var label = spine.getAttribute('data-label') || '';
    var r = spine.getBoundingClientRect();

    // 系统里关掉了动画偏好：直接过去，不做过场
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { go(href); return; }

    // 封面沿用这本书的纸质底色与斑驳；CD 盒是半透明塑料，直接抄会太淡，给实底色
    if (spine.classList.contains('cd')) {
      flyCover.style.backgroundImage =
        'linear-gradient(135deg, #cdd6da, #b6c2c8 55%, #9daeb6)';
    } else {
      flyCover.style.backgroundImage = getComputedStyle(spine).backgroundImage;
    }
    flyTitle.textContent = label;

    // 1) 起点：严丝合缝压在书脊上（连当前的倾斜角都抄过来），
    //    看上去就是把这本书从书堆里抽出来
    overlay.className = 'flip-overlay';
    flyBook.className = 'fly-book';
    flyBook.style.transition = 'none';
    flyBook.style.opacity = '';
    flyBook.style.left = r.left + 'px';
    flyBook.style.top = r.top + 'px';
    flyBook.style.width = r.width + 'px';
    flyBook.style.height = r.height + 'px';
    var tilt = getComputedStyle(spine).transform;
    flyBook.style.transform = 'perspective(1200px) ' +
      (tilt && tilt !== 'none' ? tilt + ' ' : '') + 'rotateY(-9deg)';

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');

    // 2) 抽出并转到眼前：偏一点 Y 轴的老板正
    at(T_PULL, function () {
      var tw = Math.min(430, window.innerWidth * 0.58);
      var th = Math.min(580, window.innerHeight * 0.72);
      flyBook.style.transition = '';
      flyBook.classList.add('moving');
      flyBook.style.left = Math.round((window.innerWidth - tw) / 2) + 'px';
      flyBook.style.top = Math.round((window.innerHeight - th) / 2) + 'px';
      flyBook.style.width = Math.round(tw) + 'px';
      flyBook.style.height = Math.round(th) + 'px';
      flyBook.style.transform = 'perspective(1200px) rotate(0deg) rotateY(0deg)';
    });

    // 3) 掀开封面
    at(T_OPEN, function () { flyBook.classList.add('opening'); });

    // 4) 收尾：轻轻凑近 + 整本书溶掉，底色同时归一到纸色
    at(T_SETTLE, function () {
      flyBook.classList.remove('moving');
      flyBook.classList.add('settling');
      flyBook.style.transform = 'scale(1.05)';
      overlay.classList.add('settling');
    });

    // 5) 落地
    at(T_GO, function () { go(href); });
  }

  // 书脊：点击 / 键盘可达
  document.querySelectorAll('.spine').forEach(function (sp) {
    sp.addEventListener('click', function () { openBook(sp); });
    sp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(sp); }
    });
  });

  // 返回本页时（含浏览器缓存返回 / 后退）把场景复位
  window.addEventListener('pageshow', reset);
})();
