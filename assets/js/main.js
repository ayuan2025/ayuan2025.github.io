/* 主题切换 + 小交互 */
(function () {
  var saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  var btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', function () {
    var el = document.documentElement;
    var dark = el.getAttribute('data-theme') === 'dark';
    if (dark) el.removeAttribute('data-theme'); else el.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', dark ? 'light' : 'dark');
  });
})();
