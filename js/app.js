/* ============================================================
   Desenreda el nudo | flujo: bienvenida, cuenta regresiva, juego, resultado (descuento según puntaje, ranking)
   ============================================================ */
(function () {
  const TT = window.TT, C = TT.CONFIG, G = TT.Game, fx = TT.fx;
  const $ = (s) => document.querySelector(s), esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = TT.store, hoy = () => new Date().toISOString().slice(0, 10);
  let nivel = 0, jugando = false, tocado = false, segPrev = 99;

  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); $('#hud').hidden = id !== 'sGame'; document.body.classList.toggle('in-game', id === 'sGame'); }
  const rj = (k, d) => { try { return JSON.parse(S.get(k)) || d; } catch (e) { return d; } };

  /* ---------- Cupón: lo gana todo jugador, con descuento según puntaje. Un código por celular y día: se conserva el mayor descuento ---------- */
  function cuponHoy() { const c = rj('tt_cupon', null); return c && c.dia === hoy() ? c : null; }
  function genCodigo() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = 'TT-'; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function descuento(p) {
    const D = C.DESCUENTO, f = Math.max(0, Math.min(1, p / D.PUNTAJE_MAX));
    return Math.min(D.MAX, D.MIN + Math.round((D.MAX - D.MIN) * f / D.PASO) * D.PASO);
  }
  const tier = (d) => d >= 35 ? 'oro' : d >= 20 ? 'plata' : 'bronce';
  function darCupon(puntaje) {
    let c = cuponHoy(), nuevo = false, mejoro = false; const d = descuento(puntaje);
    if (!c) { c = { dia: hoy(), codigo: genCodigo(), dto: 0, puntaje: 0, hora: new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) }; nuevo = true; }
    if (d > c.dto || nuevo) { mejoro = !nuevo; c.dto = Math.max(c.dto, d); c.puntaje = puntaje; S.set('tt_cupon', JSON.stringify(c)); TT.track('cupon', { puntaje: puntaje, cupon: c.codigo, dto: c.dto }); }
    return { c, nuevo, mejoro };
  }
  function mejor() { return rj('tt_mejor', { puntaje: 0 }); }

  /* ---------- Inicio ---------- */
  async function iniciar() {
    TT.cam.start($('#cam'));                                     // si no hay cámara, se juega igual sobre el fondo de color (no se espera)
    TT.track('inicio', {});
    nivel = 0; jugarNivel();
  }
  function jugarNivel() {
    const n = C.NIVELES[nivel]; G.load(n, C, false); show('sGame');
    $('#hLv').textContent = n.id; $('#hTm').textContent = n.tiempo; $('#hBar').style.width = '0%';
    $('#hHint').textContent = n.nombre + ': peina de arriba hacia abajo'; $('#hHint').classList.add('on');
    cuenta(3);
  }
  function cuenta(k) {
    const el = $('#hCount'); el.hidden = false; el.textContent = k || '¡Peina!'; if (k) TT.sfx.tick(); else TT.sfx.go(); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    if (k > 0) setTimeout(() => cuenta(k - 1), 750);
    else setTimeout(() => { el.hidden = true; $('#hHint').classList.remove('on'); G.start(); jugando = true; TT.sfx.padStart(); tocado = false; $('#guide').hidden = nivel > 0 || !!S.get('tt_guia'); }, 600);
  }
  G.onTick = (t) => {
    const sg = Math.ceil(t.tLeft); $('#hTm').textContent = sg; $('#hBar').style.width = Math.round(t.prog * 100) + '%'; $('#hTm').parentNode.classList.toggle('low', t.tLeft < 8);
    if (sg !== segPrev) { segPrev = sg; if (sg <= 5 && sg > 0) TT.sfx.low(); }              // cuentan los últimos segundos
  };
  G.onTouch = (d) => {
    if (d) { TT.sfx.swishStart(); if (!tocado) { tocado = true; S.set('tt_guia', '1'); $('#guide').hidden = true; } } else TT.sfx.swishStop();
  };
  G.onStroke = (v, abajo) => TT.sfx.swish(v, abajo);
  G.onStrand = (n, total) => {
    TT.sfx.strand(n); const b = $('.hud-top'); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
    if (navigator.vibrate) navigator.vibrate(14);
  };
  G.onOuch = () => { TT.sfx.ouch(); TT.fx.shake(); const o = $('#hOuch'); o.hidden = false; o.classList.remove('pop'); void o.offsetWidth; o.classList.add('pop'); setTimeout(() => { o.hidden = true; }, 1400); if (navigator.vibrate) navigator.vibrate([30, 40, 60]); };
  G.onEnd = (r) => {
    jugando = false; segPrev = 99; TT.sfx.swishStop(); TT.sfx.padStop(); if (r.ok) TT.sfx.win(); else TT.sfx.lose(); const n = C.NIVELES[nivel];
    TT.track(r.ok ? 'nivel_ok' : 'nivel_fail', { nivel: n.id, puntaje: r.puntaje, seg: r.seg, tirones: r.tirones, avance: Math.round(r.prog * 100) });
    const m = mejor(); if (r.ok && r.puntaje > m.puntaje) S.set('tt_mejor', JSON.stringify({ puntaje: r.puntaje, nivel: n.id }));
    setTimeout(() => resultado(r, n), r.ok ? 1700 : 600);       // en la victoria se alcanza a ver el pelo liso
  };

  /* ---------- Animaciones del resultado ---------- */
  function contar(el, hasta, ms, suf, desde) {
    desde = desde || 0; const t0 = performance.now(); let ult = -1;
    if (fx.reduced || hasta === desde) { el.textContent = hasta + suf; return; }
    (function paso(now) {
      const k = Math.min(1, (now - t0) / ms), v = Math.round(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)));
      el.textContent = v + suf; if (v !== ult) { ult = v; if (k < 1) TT.sfx.count(v); }
      if (k < 1) requestAnimationFrame(paso);
    })(t0);
  }
  function revelar(dto) {                                           // el cupón entra con un giro y un destello; con descuentos altos, confeti
    const cp = $('#resCoupon'); cp.classList.remove('reveal'); void cp.offsetWidth; cp.classList.add('reveal');
    setTimeout(() => { TT.sfx.coupon(); if (dto >= 20) fx.confetti(dto >= 35 ? 170 : 90); }, 500);
  }

  /* ---------- Resultado ---------- */
  async function resultado(r, n) {
    show('sResult'); G.stop();
    contar($('#resScore'), r.puntaje, 900, '');
    const hay = nivel + 1 < C.NIVELES.length, acts = [];
    if (r.ok) $('#resHead').innerHTML = '<span class="ok">¡Nudo deshecho!</span><small>' + esc(n.nombre) + ' · ' + r.seg + ' s · ' + (r.tirones ? r.tirones + ' tirón' + (r.tirones > 1 ? 'es' : '') : 'sin tirones') + '</small>';
    else $('#resHead').innerHTML = '<span class="bad">¡Casi!</span><small>Lograste peinar el ' + Math.round(r.prog * 100) + '% del nudo. Tip: cubre todo el ancho, cada hebra pide su pasada.</small>';
    const k = darCupon(r.puntaje), c = k.c, vence = new Date(Date.now() + C.VIGENCIA_DIAS * 864e5).toLocaleDateString('es-CL');
    $('#resCoupon').hidden = false; $('#resCoupon').dataset.tier = tier(c.dto); $('#cPrem').textContent = 'Tu descuento'; $('#cCode').textContent = c.codigo; contar($('#cDto'), c.dto, 1000, '%', C.DESCUENTO.MIN); revelar(c.dto);
    $('#cInfo').textContent = (C.MODO_PRUEBA ? 'Cupón de ejemplo (modo de prueba). ' : '') + (k.mejoro ? '¡Mejoraste tu descuento! ' : (!k.nuevo && descuento(r.puntaje) < c.dto ? 'Se mantiene tu mejor descuento de hoy. ' : '')) + 'Muéstralo en caja con tu cepillo. Válido hasta el ' + vence + '. Un cupón por persona: si logras más puntaje, se mejora este mismo código.';
    if (r.ok) {
      acts.push(hay ? ['btn', 'Siguiente nivel: ' + C.NIVELES[nivel + 1].nombre, () => { nivel++; jugarNivel(); }] : ['btn', 'Mejorar mi puntaje', () => { nivel = 0; jugarNivel(); }]);
      acts.push(['btn ghost', 'Jugar este nivel otra vez', () => jugarNivel()]);
    } else acts.push(['btn', 'Intentar de nuevo y subir mi descuento', () => jugarNivel()]);
    if (C.CEPILLO_URL) acts.push(['btn ghost', '¿Cuál cepillo es para tu pelo?', () => { TT.track('puente', {}); location.href = C.CEPILLO_URL; }]);
    $('#resActions').innerHTML = ''; acts.forEach((a) => { const b = document.createElement('button'); b.className = a[0]; b.textContent = a[1]; b.addEventListener('click', a[2]); $('#resActions').appendChild(b); });
    // Ranking del día (si hay conexión con la planilla)
    $('#resRank').hidden = true;
    const top = r.ok ? await TT.ranking() : null;
    if (top && top.length) {
      $('#rankList').innerHTML = top.map((x, i) => '<li><b>' + (i + 1) + '</b><span>Nivel ' + esc(x.nivel) + '</span><em>' + esc(x.puntaje) + ' pts</em></li>').join(''); $('#resRank').hidden = false;
    }
  }

  /* ---------- Arranque ---------- */
  try { G.init($('#gl')); G.load({ hebras: 12, resistencia: 1, tiempo: 40 }, C, true); }
  catch (e) { $('#btnStart').disabled = true; $('#btnStart').textContent = 'Tu celular no permite el juego 3D'; }
  $('#tagPrueba').hidden = !C.MODO_PRUEBA;
  $('#btnStart').addEventListener('click', iniciar);
  addEventListener('pointerdown', () => TT.sfx.unlock(), { capture: true });                 // los celulares solo dejan sonar tras un toque
  document.addEventListener('click', (e) => { if (e.target.closest('.btn, .link') && e.target.id !== 'btnSnd') TT.sfx.tap(); });
  const snd = $('#btnSnd'), pintaSnd = () => { snd.classList.toggle('muted', TT.sfx.muted); snd.setAttribute('aria-pressed', String(!TT.sfx.muted)); };
  snd.addEventListener('click', () => { TT.sfx.toggle(); pintaSnd(); }); pintaSnd();
  if (new URLSearchParams(location.search).get('debug')) window.__TT = { G, C, show, jugarNivel, get nivel() { return nivel; } };
})();
