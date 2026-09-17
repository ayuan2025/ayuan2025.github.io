/* reader.js — 通用书籍阅读器（所有分类共用）
 * 交互：翻页 / 键盘 / 滑动 / 点击半区 / 目录跳转
 * 排版：探针逐段测量 → 贪心分面（装不下自动续排下一面）
 * 卷曲：Canvas 逐帧绘制纸张弯折形变 + 折痕阴影 + 纸面高光（叠在 DOM 页面之上）
 * 数据：window.BOOK = { kind: 'poem'|'prose', items: [{t,d,g,u,s|p}] }
 */
(function () {
  var DATA = window.BOOK;
  var book = document.getElementById('book');
  if (!book || !DATA) return;

  var inner = document.getElementById('bookInner');
  var indicator = document.getElementById('pageIndicator');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var isPoem = DATA.kind === 'poem';

  var faces = [], nSheets = 0, flipped = 0, view = 0, probe = null;
  var DUR = 900, animating = false;

  function isMobile() { return window.innerWidth <= 720; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function el(h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; }

  /* ---------- 排版 ---------- */
  function makeProbe() {
    if (!probe) {
      probe = document.createElement('div');
      // 借用真实页面的类：拿到与真实渲染一致的 padding；桌面端宽度对齐半页，
      // 否则探针行宽是真实纸面的两倍，实测高度只有真实的一半 → 每面塞双倍内容 → 末行被页脚裁切
      // 移动极简模式借用 .simple-page（与真实页面同 padding 同高度）
      probe.className = isMobile() ? 'simple-page probe' : 'page-face leaf-front probe';
      probe.setAttribute('aria-hidden', 'true');
      if (!isMobile()) probe.style.width = '50%';
      else probe.style.height = inner.getBoundingClientRect().height + 'px'; // 与真实 .simple-page（height:100%）严格同高
      inner.appendChild(probe);
    }
    return probe;
  }
  function stanzaHtml(st) {
    return '<p class="stanza">' + st.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</p>';
  }
  // cont=true 表示这是被分页切断的续段，不再首行缩进
  function paraHtml(t, cont) { return '<p class="para' + (cont ? ' cont' : '') + '">' + esc(t) + '</p>'; }
  function bodyCls() { return 'poem-body' + (isPoem ? '' : ' prose-body'); }
  function headHTML(item) {
    return '<header class="p-head"><h2>' + esc(item.t) + '</h2>'
      + (item.g ? '<p class="p-sub">' + esc(item.g) + '</p>' : '') + '</header>';
  }
  // 页脚只留页码与「单独打开」，不再显示日期
  function footHTML(no, item, isFirst) {
    return '<footer class="leaf-foot"><span>' + no + '</span>'
      + (isFirst ? '<a href="' + item.u + '" title="单独打开">⧉</a>' : '<span></span>')
      + '</footer>';
  }
  var MUSIC_H = 110;   // 与 build.js 保持一致：播放器固定占位高度，不实测（避免 iframe 真实加载）
  function musicHtml(id) {
    return '<div class="poem-music">'
      + '<iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width="330" height="86" '
      + 'loading="lazy" title="歌曲版" '
      + 'src="https://music.163.com/outchain/player?type=2&amp;id=' + id + '&amp;auto=0&amp;height=66"></iframe>'
      + '</div>';
  }
  function blocksOf(item) {
    var list = isPoem
      ? (item.s || []).map(function (st) { return { lines: st, html: stanzaHtml(st), multi: true }; })
      : (item.p || []).map(function (t) { return { lines: [t], html: paraHtml(t), multi: false }; });
    // 带歌曲的篇目：播放器排在正文末尾，作为固定高度块参与分页
    if (item.m) list.push({ lines: [''], html: musicHtml(item.m), multi: false, fixed: MUSIC_H });
    return list;
  }

  /* 真实结构下测量可用高度：head + body(flex:1) + foot 一起放进探针，
   * body 分到的高度就是精确可用高度（自动含纸面 padding、页眉页脚、页脚边距），
   * 不再用 faceH - head - foot - 常数 这种会算漏的估算。 */
  function mount(p, item, withHead) {
    p.innerHTML = (withHead ? headHTML(item) : '')
      + '<div class="' + bodyCls() + '"></div>'
      + footHTML(1, item, withHead);
    return p.querySelector('.poem-body');
  }
  function availOf(pb) {
    var cs = getComputedStyle(pb);
    var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    return Math.max(60, pb.clientHeight - padY - 5);
  }

  function layout() {
    var p = makeProbe();
    var item0 = DATA.items[0] || { t: '占位标题', g: '占位', u: '#' };
    var availFirst = availOf(mount(p, item0, true));
    var availCont = availOf(mount(p, item0, false));
    var list = [];

    DATA.items.forEach(function (item, ii) {
      var avail = availFirst, part = 0, cur = [], curH = 0;
      function flush() {
        if (!cur.length) return;
        list.push({ itemIdx: ii, part: part, bodyHtml: cur.join(''), isFirst: part === 0 });
        part++; cur = []; curH = 0; avail = availCont;
      }
      var pb = mount(p, item, true);
      var blocks = blocksOf(item);
      /* 小节序号（（一）/（二）/Ⅰ/Ⅱ 这类单行块）不允许孤悬页尾：
       * 装入后必须前瞻——内文块整块放不下时拆它的前几行（至少两行）跟在序号后面，
       * 连两行都放不下就把序号块也推到下一面，绝不能只有序号没有内文。 */
      var MARKER_RE = /^[（(][一二三四五六七八九十百零ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ\d]{1,4}[)）]$/;
      for (var bi = 0; bi < blocks.length; bi++) {
        var b = blocks[bi];
        if (b.fixed) {   // 播放器等固定高度块：不实测、不拆行
          if (curH + b.fixed > avail && cur.length) flush();
          cur.push(b.html); curH += b.fixed;
          continue;
        }
        var e = el(b.html);
        pb.appendChild(e);
        // 用小数高度而非 offsetHeight：后者取整，多块累加会攒出好几像素的误差
        var h = e.getBoundingClientRect().height;
        var cs = getComputedStyle(e);
        var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        var lineH = b.multi ? Math.max(1, Math.round((h - padY) / Math.max(1, b.lines.length))) : 0;
        pb.removeChild(e);

        if (h <= avail) {
          if (curH + h > avail && cur.length) flush();
          cur.push(b.html); curH += h;
          /* 序号块前瞻：内文必须跟着进来 */
          if (b.multi && b.lines.length === 1 && MARKER_RE.test(b.lines[0])) {
            var nb = blocks[bi + 1];
            if (nb && !nb.fixed) {
              var ne = el(nb.html); pb.appendChild(ne);
              var nh = ne.getBoundingClientRect().height;
              var ncs = getComputedStyle(ne);
              var npadY = (parseFloat(ncs.paddingTop) || 0) + (parseFloat(ncs.paddingBottom) || 0);
              pb.removeChild(ne);
              if (curH + nh > avail) {
                var moved = false;
                if (nb.multi && nb.lines.length > 2) {
                  var nLineH = Math.max(1, Math.round((nh - npadY) / Math.max(1, nb.lines.length)));
                  var k = Math.min(nb.lines.length - 1, Math.floor((avail - curH - npadY) / nLineH));
                  if (k >= 2) {
                    var chunk = nb.lines.slice(0, k);
                    var ce = el(stanzaHtml(chunk)); pb.appendChild(ce);
                    var chh = ce.getBoundingClientRect().height; pb.removeChild(ce);
                    while (curH + chh > avail && chunk.length > 2) {
                      chunk.pop();
                      ce = el(stanzaHtml(chunk)); pb.appendChild(ce);
                      chh = ce.getBoundingClientRect().height; pb.removeChild(ce);
                    }
                    if (curH + chh <= avail) {
                      cur.push(stanzaHtml(chunk)); curH += chh;
                      var rest = nb.lines.slice(chunk.length);
                      blocks[bi + 1] = { lines: rest, html: stanzaHtml(rest), multi: true };
                      moved = true;
                    }
                  }
                }
                if (!moved) {
                  // 剩余空间连两行内文都放不下 → 序号块跟着内容一起挪到下一面
                  cur.pop(); curH -= h;
                  flush();
                  cur.push(b.html); curH += h;
                }
              }
            }
          }
          continue;
        }
        // 超高块：按行/按字符拆，每一片都实测高度后再决定放哪一面
        if (b.multi) {
          var per = Math.max(1, Math.floor((avail - padY) / lineH));
          for (var i = 0; i < b.lines.length;) {
            var chunk = b.lines.slice(i, i + per);
            var ce = el(stanzaHtml(chunk));
            pb.appendChild(ce);
            var ch = ce.getBoundingClientRect().height;
            pb.removeChild(ce);
            // 实测装不下就逐行回退，别把超高的片硬塞进纸面
            while (ch > avail - curH && chunk.length > 1) {
              chunk.pop();
              ce = el(stanzaHtml(chunk));
              pb.appendChild(ce);
              ch = ce.getBoundingClientRect().height;
              pb.removeChild(ce);
            }
            if (curH + ch > avail && cur.length) flush();
            cur.push(stanzaHtml(chunk)); curH += ch;
            i += chunk.length;
          }
        } else {
          // 长段落：先估算每行字数，再逐片实测，避免按字数估算把末行挤出纸面
          var text = b.lines[0];
          var lineEl = el('<p class="para">占</p>');
          pb.appendChild(lineEl);
          var single = lineEl.getBoundingClientRect().height;
          pb.removeChild(lineEl);
          var sample = text.slice(0, 200);
          var se = el(paraHtml(sample));
          pb.appendChild(se);
          var sh0 = se.getBoundingClientRect().height;
          pb.removeChild(se);
          var lineH = Math.max(1, single - padY);
          var rows = Math.max(1, Math.round((sh0 - padY) / lineH));
          var perLine = Math.max(6, Math.ceil(sample.length / rows));

          var pos = 0, first = true, guard = 0;
          while (pos < text.length && guard++ < 4000) {
            var room = avail - curH;
            if (room < single) {
              if (!cur.length) { cur.push(paraHtml(text.slice(pos), !first)); break; }
              flush(); continue;
            }
            // 关键：扣掉段落自身的上下 padding 再算能放几行，否则每片都会高出约一个 padding
            var canRows = Math.max(1, Math.floor((room - padY) / lineH));
            var take = Math.max(1, canRows * perLine);
            if (pos + take >= text.length) take = text.length - pos;

            // 估算的每行字数可能偏多 → 逐行回退实测，直到真正装得下
            var ge, gh = 0, t = take;
            for (var k = 0; k < 8; k++) {
              ge = el(paraHtml(text.slice(pos, pos + t), !first));
              pb.appendChild(ge);
              gh = ge.getBoundingClientRect().height;
              pb.removeChild(ge);
              if (gh <= room) break;
              // 按实测超出的行数一次削减到位，避免逐行回退退化成几十次重排测量
              var over = Math.max(1, Math.ceil((gh - room) / lineH));
              var nt = t - over * perLine;
              if (nt < 1) nt = 1;
              if (nt >= t) { nt = Math.max(1, t - 1); }
              t = nt;
            }
            if (gh > room && cur.length) { flush(); continue; }  // 单片就超页 → 挪到新页重排
            cur.push(paraHtml(text.slice(pos, pos + t), !first)); curH += gh;
            pos += t; first = false;
          }
        }
      }
      flush();
    });
    list.forEach(function (f, i) { f.pageNo = i + 1; });
    faces = list;
    try { window.__faces = faces; } catch (e2) {}   // 调试/验收钩子：暴露分面结果
  }

  function faceHTML(f) {
    var item = DATA.items[f.itemIdx];
    var head = f.isFirst ? headHTML(item) : '';
    return head + '<div class="' + bodyCls() + '">' + f.bodyHtml + '</div>' + footHTML(f.pageNo, item, f.isFirst);
  }

  /* ---------- 卷曲层 ---------- */
  /* 手机翻页卡顿的根因：旧版每帧都 curlCv.width = ...（每帧重建整块位图，
   * dpr=3 时约 1170×2100，每秒 60 次）并按全分辨率画渐变。现改为：
   *   1. 尺寸缓存 —— 只有真变了才重建画布
   *   2. 卷曲层 DPR 封顶 —— 它只画软渐变，1.5x/2x 肉眼无差，像素量降 4 倍
   */
  var curlCv = null, curlCtx = null, curlDpr = 1, curlW = 0, curlH = 0;
  function ensureCurlCanvas() {
    if (!curlCv) {
      curlCv = document.createElement('canvas');
      curlCv.className = 'curl-layer';
      book.appendChild(curlCv);
      curlCtx = curlCv.getContext('2d');
    }
    var r = book.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2);
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w !== curlW || h !== curlH || dpr !== curlDpr) {
      curlDpr = dpr;
      curlW = w; curlH = h;
      curlCv.width = Math.round(curlW * curlDpr);
      curlCv.height = Math.round(curlH * curlDpr);
      curlCv.style.width = curlW + 'px';
      curlCv.style.height = curlH + 'px';
    }
    return r;
  }

  /* 绘制卷曲形变：progress 0(未翻)→1(翻过)，dir 1=向右翻
   * 只画纸面弯折的"卷曲带"与光影，页面内容仍由 DOM 承载，二者叠加即得卷曲观感 */
  function drawCurl(progress, dir) {
    var r = ensureCurlCanvas();
    var W = r.width, H = r.height;
    var ctx = curlCtx;
    ctx.setTransform(curlDpr, 0, 0, curlDpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (progress <= 0.001 || progress >= 0.999) { curlCv.style.opacity = 0; return; }
    curlCv.style.opacity = 1;

    var strength = Math.sin(Math.PI * progress);      // 中段最强
    var half = isMobile() ? W : W / 2;                 // 单页宽度
    var baseX = isMobile() ? 0 : half;                 // 书脊处
    // 卷曲带中心：随进度从右向左扫
    var cx = dir > 0
      ? baseX + half * (1 - progress)
      : baseX + half * progress;
    var bandW = half * (0.16 + 0.16 * strength);       // 卷曲带宽度
    var outdent = H * 0.035 * strength;                // 上下缘外凸

    // ---- 卷曲带：纸张弯折的暗部 + 高光 ----
    var g = ctx.createLinearGradient(cx - bandW, 0, cx + bandW, 0);
    g.addColorStop(0.00, 'rgba(0,0,0,0)');
    g.addColorStop(0.30, 'rgba(0,0,0,' + (0.055 * strength).toFixed(3) + ')');
    g.addColorStop(0.52, 'rgba(255,255,255,' + (0.30 * strength).toFixed(3) + ')');
    g.addColorStop(0.64, 'rgba(0,0,0,' + (0.14 * strength).toFixed(3) + ')');
    g.addColorStop(0.86, 'rgba(0,0,0,' + (0.34 * strength).toFixed(3) + ')');
    g.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;

    // 卷曲带形状：右缘为弯弧
    ctx.beginPath();
    var topY = -outdent, botY = H + outdent;
    if (dir > 0) {
      ctx.moveTo(cx - bandW, topY);
      ctx.lineTo(cx + bandW * 0.35, topY);
      ctx.bezierCurveTo(cx + bandW * 0.75, H * 0.30, cx + bandW * 0.75, H * 0.70, cx + bandW * 0.35, botY);
      ctx.lineTo(cx - bandW, botY);
      ctx.bezierCurveTo(cx - bandW * 0.62, H * 0.68, cx - bandW * 0.62, H * 0.32, cx - bandW, topY);
    } else {
      ctx.moveTo(cx - bandW * 0.35, topY);
      ctx.lineTo(cx + bandW, topY);
      ctx.bezierCurveTo(cx + bandW * 0.62, H * 0.32, cx + bandW * 0.62, H * 0.68, cx + bandW, botY);
      ctx.lineTo(cx - bandW * 0.35, botY);
      ctx.bezierCurveTo(cx - bandW * 0.75, H * 0.70, cx - bandW * 0.75, H * 0.30, cx - bandW * 0.35, topY);
    }
    ctx.closePath();
    ctx.fill();

    // ---- 折痕线（纸的弯折棱） ----
    ctx.beginPath();
    var edgeX = dir > 0 ? cx + bandW * 0.35 : cx - bandW * 0.35;
    ctx.moveTo(edgeX, topY);
    ctx.bezierCurveTo(edgeX + (dir > 0 ? bandW * 0.4 : -bandW * 0.4), H * 0.3, edgeX + (dir > 0 ? bandW * 0.4 : -bandW * 0.4), H * 0.7, edgeX, botY);
    ctx.strokeStyle = 'rgba(0,0,0,' + (0.10 * strength).toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ---- 投影：翻动时落在下方纸面上的阴影 ----
    var sg = ctx.createLinearGradient(cx, 0, cx + (dir > 0 ? -bandW * 2.2 : bandW * 2.2), 0);
    sg.addColorStop(0, 'rgba(0,0,0,' + (0.20 * strength).toFixed(3) + ')');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.beginPath();
    if (dir > 0) ctx.rect(0, 0, cx, H); else ctx.rect(cx, 0, W - cx, H);
    ctx.clip();
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------- 状态 ---------- */
  function flippedCount() { return isMobile() ? Math.ceil(view / 2) : flipped; }
  function curFaceIdx() { return isMobile() ? view : 2 * flipped; }
  function atStart() { return isMobile() ? view <= 0 : flipped <= 0; }
  function atEnd() { return isMobile() ? view >= DATA.items.length - 1 : flipped >= nSheets; }

  function render() {
    prevBtn.disabled = atStart();
    nextBtn.disabled = atEnd();
    if (isMobile()) {
      // 移动极简模式：整首诗一页直出（view = 诗号），超出部分容器内竖向滚动
      var page = document.getElementById('simplePage');
      if (page) {
        if (!(view >= 0 && view < DATA.items.length)) view = 0;
        var item = DATA.items[view];
        var body = blocksOf(item).map(function (b) { return b.html; }).join('');
        page.innerHTML = headHTML(item) + '<div class="' + bodyCls() + '">' + body + '</div>' + footHTML(view + 1, item, true);
        page.scrollTop = 0; // 换诗回顶部
      }
      indicator.textContent = (view + 1) + ' / ' + DATA.items.length;
      return;
    }
    var leaves = inner.querySelectorAll('.leaf');
    var fl = flippedCount();
    for (var i = 0; i < leaves.length; i++) {
      leaves[i].classList.toggle('flipped', i < fl);
      leaves[i].style.zIndex = i < fl ? 10 + i : 10 + (nSheets - i);
    }
    var idxs = [2 * flipped - 1, 2 * flipped].filter(function (i) { return i >= 0 && i < faces.length; });
    indicator.textContent = idxs.map(function (i) {
      var f = faces[i];
      return (f.itemIdx + 1) + (f.part > 0 ? '·续' : '');
    }).join('–') + ' / ' + DATA.items.length;
    if (curlCv) curlCv.style.opacity = 0;
  }

  /* ---------- 翻页 ---------- */
  function go(dir) {
    if (animating || (dir > 0 ? atEnd() : atStart())) return;
    if (isMobile()) {
      // 移动极简模式：翻页 = 换一首诗，零动画开销
      view = Math.max(0, Math.min(DATA.items.length - 1, view + dir));
      render();
      return;
    }
    flipSound();
    animating = true;

    var leaf = dir > 0 ? flipped : flipped - 1;
    var leafEl = inner.querySelectorAll('.leaf')[leaf];
    var cssDur = (DUR / 1000).toFixed(2) + 's';
    if (leafEl) {
      leafEl.style.transition = 'transform ' + cssDur + ' cubic-bezier(.42,.05,.28,1)';
      leafEl.classList.add('turning');
      // 强制重排后触发翻转
      void leafEl.offsetWidth;
      leafEl.classList.add('flipped');
      book.classList.add(dir > 0 ? 'turning-next' : 'turning-prev');
    }

    var t0 = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - t0) / DUR);
      drawCurl(dir > 0 ? t : t, dir);
      if (t < 1) requestAnimationFrame(step);
      else {
        animating = false;
        if (isMobile()) view = Math.max(0, Math.min(faces.length - 1, view + dir));
        else flipped = Math.max(0, Math.min(nSheets, flipped + dir));
        if (leafEl) { leafEl.classList.remove('turning'); leafEl.style.transition = ''; }
        book.classList.remove('turning-next', 'turning-prev');
        render();
      }
    })(t0);
  }

  /* ---------- 声音：柔和沙沙 ---------- */
  var audioCtx = null;
  function flipSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var dur = 0.4;
      var buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) {
        var t = i / d.length;
        var env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.03)), 1.5);
        d[i] = (Math.random() * 2 - 1) * env * (0.6 + 0.4 * Math.sin(t * 15));
      }
      var src = audioCtx.createBufferSource(); src.buffer = buf;
      var f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.4;
      f.frequency.setValueAtTime(2600, audioCtx.currentTime);
      f.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + dur);
      var g = audioCtx.createGain(); g.gain.value = 0.12;
      src.connect(f); f.connect(g); g.connect(audioCtx.destination);
      src.start();
    } catch (e) { }
  }

  /* ---------- 目录 ---------- */
  var tocOverlay = document.getElementById('tocOverlay'), tocList = document.getElementById('tocList'), tocBuilt = false;
  function buildToc() {
    if (tocBuilt) return;
    tocList.innerHTML = DATA.items.map(function (p, i) {
      return '<li><button data-item="' + i + '"><span class="toc-no">' + (i + 1) + '</span>'
        + '<span class="toc-title">' + esc(p.t) + '</span><time>' + esc(p.d) + '</time></button></li>';
    }).join('');
    tocBuilt = true;
  }
  function faceOfItem(pi) { for (var i = 0; i < faces.length; i++) if (faces[i].itemIdx === pi) return i; return 0; }
  function openToc() {
    buildToc();
    var curItem = isMobile() ? view : (faces[curFaceIdx()] ? faces[curFaceIdx()].itemIdx : 0);
    var btns = tocList.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('current', Number(btns[i].getAttribute('data-item')) === curItem);
    var cb = tocList.querySelector('button.current');
    if (cb) cb.scrollIntoView({ block: 'center' });
    tocOverlay.hidden = false;
  }
  function closeToc() { tocOverlay.hidden = true; }
  if (document.getElementById('tocBtn')) {
    document.getElementById('tocBtn').addEventListener('click', openToc);
    document.getElementById('tocClose').addEventListener('click', closeToc);
    tocOverlay.addEventListener('click', function (e) {
      if (e.target === tocOverlay) { closeToc(); return; }
      var btn = e.target.closest('button[data-item]');
      if (btn) {
        var pi = Number(btn.getAttribute('data-item'));
        // 桌面：目标面为奇数下标（某张纸的背面）时 floor 会让它落在下一张纸，可见右页变成上一首的末面 → 必须 ceil
        if (isMobile()) view = pi; else flipped = Math.ceil(faceOfItem(pi) / 2);
        closeToc(); render();
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeToc(); });
  }

  /* ---------- 事件 ---------- */
  prevBtn.addEventListener('click', function () { go(-1); });
  nextBtn.addEventListener('click', function () { go(1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
  });
  var sx = null, sy = null;
  book.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  book.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
    sx = sy = null;
  }, { passive: true });
  book.addEventListener('click', function (e) {
    if (e.target.closest('a') || isMobile()) return;
    var sel = window.getSelection();
    if (sel && String(sel).length) return;
    var r = book.getBoundingClientRect();
    go((e.clientX - r.left) > r.width / 2 ? 1 : -1);
  });

  /* ---------- 重建 ---------- */
  var rebuildTimer = null;
  function rebuild() {
    if (isMobile()) {
      // 移动极简模式：一首诗 = 一整页，超长上下滚动。
      // 不跑分面排版（探针测量偶发 0 高度曾导致整页空白），也不建 3D 书页。
      if (!(view >= 0 && view < DATA.items.length)) view = 0;
      book.classList.add('simple');
      inner.innerHTML = '<div class="simple-page" id="simplePage"></div>';
      render();
      return;
    }
    var cur = faces[curFaceIdx()], keep = cur ? cur.itemIdx : 0;
    layout();
    nSheets = Math.ceil(faces.length / 2);
    if (isMobile()) {
      // 移动极简模式：抛弃 3D 书页结构，只保留一个单页容器（翻页 = 重填内容）
      book.classList.add('simple');
      inner.innerHTML = '<div class="simple-page" id="simplePage"></div>';
    } else {
      book.classList.remove('simple');
      var html = '';
      for (var k = 0; k < nSheets; k++) {
        var fr = faces[2 * k], bk = faces[2 * k + 1];
        html += '<section class="leaf" data-idx="' + k + '">'
          + '<div class="leaf-front page-face">' + faceHTML(fr) + '</div>'
          + '<div class="leaf-back page-face">' + (bk ? faceHTML(bk) : '<div class="face-empty">—</div>') + '</div>'
          + '</section>';
      }
      inner.innerHTML = html;
    }
    probe = null;
    var target = 0;
    for (var i = 0; i < faces.length; i++) if (faces[i].itemIdx === keep) { target = i; break; }
    // 与目录跳转同理：奇数下标的目标面要 ceil，否则恢复位置后可见的是上一首末面
    if (isMobile()) view = target; else flipped = Math.ceil(target / 2);
    render();
    if (window.__onRebuilt) window.__onRebuilt(faces);
  }
  window.addEventListener('resize', function () { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 250); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { rebuild(); });

  rebuild();
})();
