/* Efectos de pantalla: confeti metálico (lila, rosa, cobre y dorado) y sacudón. Se desactivan con "reducir movimiento". */
(function () {
  const TT = (window.TT = window.TT || {}), fx = (TT.fx = {});
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, COL = ['#b7a2e6', '#f1c5d5', '#e9a37a', '#d9b46a', '#ffffff', '#8468d6'];
  let cv, cx, parts = [], raf = 0, last = 0;
  fx.reduced = RM;
  function size() { cv.width = innerWidth * Math.min(2, devicePixelRatio || 1); cv.height = innerHeight * Math.min(2, devicePixelRatio || 1); }
  fx.confetti = function (n, x, y) {
    if (RM) return; cv = cv || document.getElementById('fx'); if (!cv) return; cx = cx || cv.getContext('2d'); size();
    const k = cv.width / innerWidth; x = (x == null ? 0.5 : x) * cv.width; y = (y == null ? 0.38 : y) * cv.height;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = (4 + Math.random() * 9) * k;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, w: (5 + Math.random() * 7) * k, h: (3 + Math.random() * 5) * k, c: COL[i % COL.length], life: 1, ph: Math.random() * 6 });
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  };
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * 60; last = now; cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 40);
    parts.forEach((p) => {
      p.vy += 0.28 * dt * (cv.width / innerWidth); p.vx *= 0.99; p.vy *= 0.992; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= 0.0035 * dt; p.ph += 0.15 * dt;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.scale(1, Math.cos(p.ph)); cx.globalAlpha = Math.min(1, p.life * 2); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(step); else { raf = 0; cx.clearRect(0, 0, cv.width, cv.height); }
  }
  fx.shake = function () { if (RM) return; document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 450); };
})();
