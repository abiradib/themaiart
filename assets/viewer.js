// Absented catalogue — slide page behaviour: keyboard, swipe, zoom.
(function () {
  var body = document.body;
  var prev = body.dataset.prev;
  var next = body.dataset.next;
  var zoom = document.getElementById('zoom');
  var scroller = zoom && zoom.querySelector('.zoom-scroll');
  var slideBtn = document.querySelector('.slide-btn');
  var details = document.getElementById('text-details');

  function go(href) { if (href) window.location.href = href; }
  function pinchZoomed() { return window.visualViewport && window.visualViewport.scale > 1.01; }

  // Open the readable text by default on phones, where slide text is small.
  if (details && window.matchMedia('(max-width: 1100px) and (orientation: portrait)').matches) {
    details.open = true;
  }

  // ---- zoom overlay
  function openZoom(cx, cy) {
    if (!zoom) return;
    zoom.hidden = false;
    body.classList.add('zoom-open');
    var img = scroller.querySelector('img');
    var center = function () {
      var w = img.offsetWidth, h = img.offsetHeight;
      scroller.scrollLeft = Math.max(0, w * cx - scroller.clientWidth / 2);
      scroller.scrollTop = Math.max(0, h * cy - scroller.clientHeight / 2);
    };
    if (img.complete) center(); else img.addEventListener('load', center, { once: true });
    zoom.querySelector('.zoom-close').focus();
  }
  function closeZoom() {
    if (!zoom || zoom.hidden) return;
    zoom.hidden = true;
    body.classList.remove('zoom-open');
    slideBtn && slideBtn.focus();
  }
  if (slideBtn) {
    slideBtn.addEventListener('click', function (e) {
      var r = slideBtn.getBoundingClientRect();
      var cx = e.clientX ? (e.clientX - r.left) / r.width : 0.5;
      var cy = e.clientY ? (e.clientY - r.top) / r.height : 0.5;
      openZoom(cx, cy);
    });
  }
  if (zoom) {
    zoom.querySelector('.zoom-close').addEventListener('click', closeZoom);
    var moved = false, sx = 0, sy = 0;
    scroller.addEventListener('pointerdown', function (e) { moved = false; sx = e.clientX; sy = e.clientY; });
    scroller.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 8) moved = true; });
    scroller.addEventListener('click', function () { if (!moved) closeZoom(); });
  }

  // ---- keyboard
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (zoom && !zoom.hidden) { if (e.key === 'Escape') closeZoom(); return; }
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(next); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(prev); }
    else if (e.key === 'Escape') { go('../index.html'); }
  });

  // ---- swipe (only on the page itself, not while pinch-zoomed or in the zoom overlay)
  var stage = document.querySelector('.stage');
  var tx = 0, ty = 0, tt = 0, tracking = false;
  if (stage) {
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || pinchZoomed()) { tracking = false; return; }
      tracking = true; tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now();
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - tx, dy = t.clientY - ty;
      if (Date.now() - tt < 800 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        go(dx < 0 ? next : prev);
      }
    }, { passive: true });
  }
})();
