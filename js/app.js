/* ============================================================
   Desenreda el nudo | flujo: bienvenida, cuenta regresiva, juego, 3 niveles seguidos, descuento al completarlos (según puntaje total), ranking
   ============================================================ */
(function () {
  const TT = window.TT, C = TT.CONFIG, G = TT.Game, fx = TT.fx;
  const $ = (s) => document.querySelector(s), esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = TT.store, hoy = () => new Date().toISOString().slice(0, 10);
  let nivel = 0, sc = [0, 0, 0], run = { seg: 0, tir: 0 }, jugando = false, tocado = false, segPrev = 99;

  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); $('#hud').hidden = id !== 'sGame'; document.body.classList.toggle('in-game', id === 'sGame'); }
  const rj = (k, d) => { try { return JSON.parse(S.get(k)) || d; } catch (e) { return d; } };

  /* ---------- Una sola partida por dispositivo ----------
     El estado queda guardado en el celular (localStorage): 'jugando', 'completo' o 'perdio'. Con una partida ya hecha no se puede repetir
     ni mejorar: al volver solo se ve el resultado (y el cupón, si lo ganó). Si cierran o recargan a mitad de la partida, cuenta como abandonada. */
  const LK = 'tt_juego';
  const juego = () => TT.prueba ? null : rj(LK, null), guarda = (o) => { if (!TT.prueba) S.set(LK, JSON.stringify(o)); };   // en el enlace de pruebas no hay bloqueo
  function genCodigo() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = 'TT-'; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function descuento(prom) {
    const D = C.DESCUENTO, f = Math.max(0, Math.min(1, prom / D.PUNTAJE_MAX));
    return Math.min(D.MAX, D.MIN + Math.round((D.MAX - D.MIN) * f / D.PASO) * D.PASO);
  }
  const tier = (d) => d >= 35 ? 'oro' : d >= 20 ? 'plata' : 'bronce';
  const suma = (a) => a.reduce((x, y) => x + y, 0);
  function pExtra(res) { return { resultado: res, nivel: nivel + 1, puntaje: suma(sc), p1: sc[0], p2: sc[1], p3: sc[2], seg: run.seg, tirones: run.tir }; }

  /* ---------- Inicio ---------- */
  async function iniciar() {
    if (juego()) return;                                         // ya jugó en este dispositivo
    TT.cam.start($('#cam'));                                     // si no hay cámara, se juega igual sobre el fondo de color (no se espera)
    TT.track('inicio', {});
    guarda({ estado: 'jugando', sc: [0, 0, 0], nivel: 1, hora: new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) });
    nuevaPartida();
  }
  function nuevaPartida() { nivel = 0; sc = C.NIVELES.map(() => 0); run = { seg: 0, tir: 0 }; jugarNivel(); }
  function jugarNivel() {
    const n = C.NIVELES[nivel]; G.load(n, C, false); show('sGame');
    $('#hLv').textContent = n.id + '/' + C.NIVELES.length; $('#hTm').textContent = n.tiempo; $('#hBar').style.width = '0%';
    $('#hHint').textContent = n.nombre + ': empieza por las puntas y peina hacia abajo'; $('#hHint').classList.add('on');
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
  G.onOuch = (m) => { TT.sfx.ouch(); TT.fx.shake(); const o = $('#hOuch'); o.textContent = m || 'Peina siempre hacia abajo'; o.hidden = false; o.classList.remove('pop'); void o.offsetWidth; o.classList.add('pop'); setTimeout(() => { o.hidden = true; }, 1400); if (navigator.vibrate) navigator.vibrate([30, 40, 60]); };
  G.onEnd = (r) => {
    jugando = false; segPrev = 99; TT.sfx.swishStop(); TT.sfx.padStop(); if (r.ok) TT.sfx.win(); else TT.sfx.lose(); const n = C.NIVELES[nivel];
    TT.track(r.ok ? 'nivel_ok' : 'nivel_fail', { nivel: n.id, puntaje: r.puntaje, seg: r.seg, tirones: r.tirones, avance: Math.round(r.prog * 100) });
    run.tir += r.tirones; if (r.ok) { sc[nivel] = r.puntaje; run.seg += r.seg; }
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
  function puntos() { $('#resRun').innerHTML = C.NIVELES.map((x, i) => '<i class="' + (sc[i] > 0 ? 'ok' : i === nivel && !hecho ? 'now' : '') + '">' + (i + 1) + '</i>').join(''); }
  let hecho = false;
  function cuponVista(c, titulo) {
    const cp = $('#resCoupon'); cp.hidden = false; cp.dataset.tier = tier(c.dto); $('#cPrem').textContent = titulo; $('#cCode').textContent = c.codigo;
  }
  const infoCupon = (c) => (C.MODO_PRUEBA ? 'Cupón de ejemplo (modo de prueba). ' : '') + 'Muéstralo en caja con tu cepillo. Válido hasta el ' + new Date(c.vence).toLocaleDateString('es-CL') + '. Es un solo cupón por persona y no se puede repetir.';
  function pieDePrueba(acts) {                                           // solo en modo de prueba: permite volver a jugar al probar
    if (TT.prueba) acts.push(['btn', 'Jugar otra vez (enlace de pruebas)', () => { TT.track('inicio', {}); guarda({}); nuevaPartida(); }]);
    else if (C.MODO_PRUEBA) acts.push(['link', 'Reiniciar (solo modo de prueba)', () => { S.set(LK, ''); S.set('tt_guia', ''); location.reload(); }]);
  }
  function finalizar(estado, extra) {
    const g = Object.assign(juego() || {}, { estado, sc: sc.slice() }, extra || {}); guarda(g); return g;
  }
  async function resultado(r, n) {
    show('sResult'); G.stop(); hecho = false; puntos();
    const ult = nivel + 1 >= C.NIVELES.length, acts = [], nota = $('#resNote'), cp = $('#resCoupon'), total = suma(sc);
    cp.hidden = true; nota.hidden = true; $('#resRank').hidden = true;
    const dtl = r.ok ? esc(n.nombre) + ' · ' + r.seg + ' s · ' + (r.tirones ? r.tirones + ' falta' + (r.tirones > 1 ? 's' : '') : 'sin faltas') : '';
    if (r.ok && !ult) {                                                   // nivel superado: sigue el siguiente, todavía sin descuento
      finalizar('jugando', { nivel: nivel + 2 });
      $('#resHead').innerHTML = '<span class="ok">¡Nivel ' + n.id + ' superado!</span><small>' + dtl + '</small>';
      $('#resScoreLbl').textContent = 'Puntaje del nivel'; contar($('#resScore'), r.puntaje, 900, '');
      nota.hidden = false; nota.innerHTML = 'Llevas <b>' + total + ' puntos</b>. El descuento se entrega al <b>completar los ' + C.NIVELES.length + ' niveles</b>. No hay segundas oportunidades: ¡sigue!';
      acts.push(['btn', 'Siguiente nivel: ' + C.NIVELES[nivel + 1].nombre, () => { nivel++; jugarNivel(); }]);
    } else if (r.ok) {                                                    // los 3 niveles completos: se entrega el descuento (una sola vez)
      const dto = descuento(total / C.NIVELES.length), c = { codigo: genCodigo(), dto, vence: Date.now() + C.VIGENCIA_DIAS * 864e5 };
      finalizar('completo', { total, dto: c.dto, codigo: c.codigo, vence: c.vence });
      TT.track('cupon', { nivel: C.NIVELES.length, puntaje: total, cupon: c.codigo, dto: c.dto });
      TT.track('partida', Object.assign(pExtra('completo'), { nivel: C.NIVELES.length, dto: c.dto, cupon: c.codigo }));
      hecho = true; puntos();
      $('#resHead').innerHTML = '<span class="ok">¡Completaste los ' + C.NIVELES.length + ' niveles!</span><small>' + dtl + '</small>';
      $('#resScoreLbl').textContent = 'Puntaje total'; contar($('#resScore'), total, 1100, '');
      cuponVista(c, 'Tu descuento'); contar($('#cDto'), c.dto, 1000, '%', C.DESCUENTO.MIN); revelar(c.dto); $('#cInfo').textContent = infoCupon(c);
    } else {                                                              // no superó el nivel: la partida termina, sin descuento y sin repetir
      finalizar('perdio', { total, nivelFalla: n.id }); hecho = true; puntos();
      TT.track('partida', Object.assign(pExtra('fallo'), { dto: 0 }));
      $('#resHead').innerHTML = '<span class="bad">¡Se acabó el tiempo!</span><small>El nudo del nivel ' + n.id + ' se resistió: lograste peinar el ' + Math.round(r.prog * 100) + '%.</small>';
      $('#resScoreLbl').textContent = 'Puntaje acumulado'; contar($('#resScore'), total, 700, '');
      nota.hidden = false; nota.innerHTML = 'El descuento se entrega solo a quienes completan los <b>' + C.NIVELES.length + ' niveles</b>. Cada celular tiene <b>una sola partida</b>, así que no se puede repetir. ¡Gracias por jugar!';
    }
    if (C.CEPILLO_URL && hecho) acts.push(['btn ghost', '¿Cuál cepillo es para tu pelo?', () => { TT.track('puente', {}); location.href = C.CEPILLO_URL; }]);
    if (hecho) pieDePrueba(acts);
    $('#resActions').innerHTML = ''; acts.forEach((a) => { const b = document.createElement('button'); b.className = a[0]; b.textContent = a[1]; b.addEventListener('click', a[2]); $('#resActions').appendChild(b); });
    if (r.ok && ult) {                                                    // ranking del día (si hay conexión con la planilla)
      const top = await TT.ranking();
      if (top && top.length) { $('#rankList').innerHTML = top.map((x, i) => '<li><b>' + (i + 1) + '</b><span>Partida completa</span><em>' + esc(x.puntaje) + ' pts</em></li>').join(''); $('#resRank').hidden = false; }
    }
  }

  /* Al volver con una partida ya jugada: se muestra su resultado y nada más */
  function yaJugo(g) {
    if (g.estado === 'jugando') { g = Object.assign(g, { estado: 'perdio', abandono: true }); guarda(g); sc = g.sc || [0, 0, 0]; nivel = Math.max(0, (g.nivel || 1) - 1); run = { seg: 0, tir: 0 }; TT.track('partida', Object.assign(pExtra('abandono'), { dto: 0 })); }
    sc = g.sc || [0, 0, 0]; hecho = true; nivel = 0; show('sResult'); puntos();
    const acts = [], nota = $('#resNote'), cp = $('#resCoupon');
    $('#resRank').hidden = true; nota.hidden = true; cp.hidden = true;
    $('#resScoreLbl').textContent = g.estado === 'completo' ? 'Puntaje total' : 'Puntaje acumulado'; $('#resScore').textContent = suma(sc);
    if (g.estado === 'completo') {
      $('#resHead').innerHTML = '<span class="ok">¡Ya completaste el juego!</span><small>Jugaste el ' + esc(g.hora || '') + '. Cada celular tiene una sola partida.</small>';
      cuponVista(g, 'Tu descuento'); $('#cDto').textContent = g.dto + '%'; $('#cInfo').textContent = infoCupon(g);
      if (g.vence && Date.now() > g.vence) { nota.hidden = false; nota.textContent = 'Este cupón ya venció.'; }
    } else {
      $('#resHead').innerHTML = '<span class="bad">Ya jugaste</span><small>' + (g.abandono ? 'Tu partida se interrumpió y no se puede reanudar.' : 'No completaste los ' + C.NIVELES.length + ' niveles.') + '</small>';
      nota.hidden = false; nota.innerHTML = 'Cada celular tiene <b>una sola partida</b>, así que no se puede repetir ni mejorar. ¡Gracias por jugar!';
    }
    if (C.CEPILLO_URL) acts.push(['btn ghost', '¿Cuál cepillo es para tu pelo?', () => { TT.track('puente', {}); location.href = C.CEPILLO_URL; }]);
    pieDePrueba(acts);
    $('#resActions').innerHTML = ''; acts.forEach((a) => { const b = document.createElement('button'); b.className = a[0]; b.textContent = a[1]; b.addEventListener('click', a[2]); $('#resActions').appendChild(b); });
  }

  /* ---------- Arranque ---------- */
  try { G.init($('#gl')); G.load({ hebras: 12, resistencia: 1, tiempo: 40 }, C, true); }
  catch (e) { $('#btnStart').disabled = true; $('#btnStart').textContent = 'Tu celular no permite el juego 3D'; }
  $('#tagPrueba').hidden = !(C.MODO_PRUEBA || TT.prueba); if (TT.prueba) $('#tagPrueba').textContent = 'Enlace de pruebas: sin límite de partidas';
  $('#btnStart').addEventListener('click', iniciar);
  { const g = juego(); if (g) yaJugo(g); }                                                   // una sola partida por dispositivo
  addEventListener('pointerdown', () => TT.sfx.unlock(), { capture: true });                 // los celulares solo dejan sonar tras un toque
  document.addEventListener('click', (e) => { if (e.target.closest('.btn, .link') && e.target.id !== 'btnSnd') TT.sfx.tap(); });
  const snd = $('#btnSnd'), pintaSnd = () => { snd.classList.toggle('muted', TT.sfx.muted); snd.setAttribute('aria-pressed', String(!TT.sfx.muted)); };
  snd.addEventListener('click', () => { TT.sfx.toggle(); pintaSnd(); }); pintaSnd();
  if (new URLSearchParams(location.search).get('debug')) window.__TT = { G, C, show, jugarNivel, get nivel() { return nivel; }, get sc() { return sc; } };
})();
