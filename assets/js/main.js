/* 主题切换 + 小交互 + 入场接住 */
(function () {
  var html = document.documentElement;
  var saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    html.setAttribute('data-theme', 'dark');
  }
  var btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', function () {
    var dark = html.getAttribute('data-theme') === 'dark';
    if (dark) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', dark ? 'light' : 'dark');
  });
})();

/* 入场接住：只有「刚从书架打开一本书」过来时才启用（desk.js 打的标记）。
 * 先用纸色把整页盖住（颜色和被离开的那一帧完全一致），等这一页排完版再掀开，
 * 于是整个过程里屏幕始终是纸色，不会出现白块，也不会硬蹦出内容。
 * 兜底：1.2s 内无论如何掀开，脚本坏了也不会把页面永久遮住。 */
(function () {
  var html = document.documentElement;
  var came = false;
  try {
    came = sessionStorage.getItem('fromShelf') === '1';
    sessionStorage.removeItem('fromShelf');
  } catch (e) {}
  if (!came) return;

  html.classList.add('book-boot');

  var done = false;
  function lift() {
    if (done) return;
    done = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        html.classList.remove('book-boot');
        document.body.classList.add('book-ready');
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lift);
  } else {
    lift();
  }
  setTimeout(lift, 1200);
})();
