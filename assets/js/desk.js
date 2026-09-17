/* 首页书桌：点书脊 → 抽出 → 移到眼前 → 掀开封面 → 推近铺满 → 进入翻页书
 * 节奏（总约 1.2s）：
 *   0ms    从书脊原位起飞（尺寸=书脊）
 *   460ms  到中央、转正 → 封面开始掀（3D rotateY）
 *   860ms  整本书推近放大，铺满屏幕
 *   1240ms 跳转
 */
(function () {
  var overlay = document.getElementById('flipOverlay');
  var flyBook = document.getElementById('flyBook');
  var flyCover = document.getElementById('flyCoverFace');
  var flyTitle = document.getElementById('flyPageTitle');
  if (!overlay || !flyBook) return;

  var busy = false;
  var T_FLY = 460;    // 起飞到中央
  var T_OPEN = 400;   // 到位后多久开始掀封面
  var T_ZOOM = 400;   // 掀开后多久开始推近
  var T_GO = 380;     // 推近后多久跳转

  function openBook(spine) {
    if (busy) return;
    busy = true;

    var href = spine.getAttribute('data-href');
    var label = spine.getAttribute('data-label') || '';
    var r = spine.getBoundingClientRect();

    // 1) 起点：就落在书脊原来的位置和尺寸上，看上去像把这本书抽出来
    flyBook.className = 'fly-book';
    flyBook.style.transition = 'none';
    flyBook.style.left = r.left + 'px';
    flyBook.style.top = r.top + 'px';
    flyBook.style.width = r.width + 'px';
    flyBook.style.height = r.height + 'px';
    flyBook.style.transform = 'rotate(-1.5deg)';
    // 封面沿用这本书的纸质底色与斑驳
    flyCover.style.backgroundImage = getComputedStyle(spine).backgroundImage;
    flyTitle.textContent = label;

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');

    // 2) 起飞：移到屏幕中央并转正
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var tw = Math.min(440, window.innerWidth * 0.6);
        var th = Math.min(600, window.innerHeight * 0.7);
        flyBook.classList.add('moving');
        flyBook.style.left = (window.innerWidth - tw) / 2 + 'px';
        flyBook.style.top = (window.innerHeight - th) / 2 + 'px';
        flyBook.style.width = tw + 'px';
        flyBook.style.height = th + 'px';
        flyBook.style.transform = 'rotate(0deg)';

        // 3) 掀开封面
        setTimeout(function () {
          flyBook.classList.add('opening');

          // 4) 推近：整本书放大到铺满屏幕（不再是白块突然长出来）
          setTimeout(function () {
            var z = Math.max(window.innerWidth / tw, window.innerHeight / th) * 1.08;
            flyBook.classList.remove('moving');
            flyBook.classList.add('zooming');
            flyBook.style.transform = 'scale(' + z.toFixed(3) + ')';
          }, T_ZOOM);

          // 5) 跳转
          setTimeout(function () {
            window.location.href = href;
          }, T_ZOOM + T_GO);
        }, T_FLY + T_OPEN);
      });
    });
  }

  // 书脊：点击 / 键盘可达
  document.querySelectorAll('.spine').forEach(function (sp) {
    sp.addEventListener('click', function () { openBook(sp); });
    sp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(sp); }
    });
  });

  // 返回本页时重置状态（含浏览器缓存返回）
  window.addEventListener('pageshow', function () {
    busy = false;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    flyBook.className = 'fly-book';
    flyBook.style.transition = 'none';
    flyBook.style.transform = '';
  });
})();
