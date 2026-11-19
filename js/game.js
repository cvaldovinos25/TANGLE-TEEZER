/* ============================================================
   Desenreda el nudo | juego 3D (three.js) sobre la cámara
   Un nudo de hebras (curvas de Lissajous) se "peina" con el dedo: al pasar de arriba hacia abajo cada hebra
   se endereza hacia su posición final (interpolación entre la forma enredada y la recta). Subir el dedo es un tirón.
   Efectos: chispas que siguen al cepillo, brillo donde pasa el dedo, destello y ondeo al liberar cada hebra,
   fuegos artificiales al ganar, sacudón al tirar. Todo sin imágenes (partículas dibujadas por código).
   ============================================================ */
(function () {
  const TT = window.TT, THREE = window.THREE;
  const G = (TT.Game = { state: 'idle', onTick: null, onEnd: null, onOuch: null, onStrand: null, onTouch: null, onStroke: null });
  let renderer, scene, camera, root, brush, canvas, raf = 0, last = 0, clock = 0;
  let strands = [], lvl = null, tLeft = 0, tirones = 0, glow = 0, done = 0, bump = 0, shake = 0;
  const NP = 14, HIT = 0.4, TRAVEL = 2.6;            // radio de "agarre" del cepillo y recorrido necesario por unidad de resistencia
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tmp = new THREE.Vector3();
  const rnd = (a, b) => a + Math.random() * (b - a), ease = (u) => u * u * (3 - 2 * u), RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let down = false, gDown = 0, gUp = 0, prev = null, ptr = null, tPrev = 0, lastMove = 0;
  const target = new THREE.Vector3();

  /* ---------- Partículas (chispas) ---------- */
  const PN = 200, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pBase = new Float32Array(PN * 3), pLife = new Float32Array(PN);
  let pi = 0, pts, PAL = [];
  function spriteTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 6); x.lineTo(32, 58); x.moveTo(6, 32); x.lineTo(58, 32); x.stroke();   // destello en cruz
    return new THREE.CanvasTexture(c);
  }
  function initParticles() {
    PAL = ['#f3d98f', '#f1c5d5', '#b7a2e6', '#ffffff', '#e9a37a'].map((h) => new THREE.Color(h));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    for (let i = 0; i < PN; i++) pPos[i * 3 + 2] = -99;
    pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.2, map: spriteTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    pts.frustumCulled = false; scene.add(pts);
  }
  /* n chispas en (x, y, z) del mundo con velocidad spd */
  G.burst = function (x, y, z, n, spd) {
    if (!pts) return; if (RM) n = Math.ceil(n / 4);
    for (let k = 0; k < n; k++) {
      const i = pi++ % PN, a = rnd(0, 6.283), e = rnd(-0.5, 1), s = spd * rnd(0.4, 1), c = PAL[(Math.random() * PAL.length) | 0];
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = Math.cos(a) * s; pVel[i * 3 + 1] = Math.sin(a) * s * (0.6 + e * 0.4) + spd * 0.25; pVel[i * 3 + 2] = rnd(-0.3, 0.3) * s;
      pBase[i * 3] = c.r; pBase[i * 3 + 1] = c.g; pBase[i * 3 + 2] = c.b; pLife[i] = rnd(0.7, 1);
    }
  };
  function updParticles(dt) {
    let any = false;
    for (let i = 0; i < PN; i++) {
      if (pLife[i] > 0) {
        any = true; pLife[i] -= dt * 1.3; const j = i * 3;
        pVel[j + 1] -= 3 * dt; pVel[j] *= 0.985; pVel[j + 2] *= 0.985; pPos[j] += pVel[j] * dt; pPos[j + 1] += pVel[j + 1] * dt; pPos[j + 2] += pVel[j + 2] * dt;
        const l = Math.max(0, pLife[i]); pCol[j] = pBase[j] * l; pCol[j + 1] = pBase[j + 1] * l; pCol[j + 2] = pBase[j + 2] * l; if (pLife[i] <= 0) pPos[j + 2] = -99;
      }
    }
    if (any) { pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true; }
  }

  G.init = function (cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
    scene.add(new THREE.HemisphereLight(0xfff4ee, 0xb7a2e6, 1));
    const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(2, 4, 5); scene.add(dl);
    root = new THREE.Group(); root.position.y = 0.15; scene.add(root);
    brush = TT.makeBrush(THREE, { color: '#b7a2e6', acento: '#e3c4f2', escala: 0.55 }); brush.visible = false; brush.rotation.x = -0.35; scene.add(brush);
    initParticles();
    addEventListener('resize', resize); resize();
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    last = performance.now(); raf = requestAnimationFrame(loop);
  };
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = Math.max(6, 1.45 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)); camera.updateProjectionMatrix();
  }

  /* ---------- Hebras ---------- */
  function mkStrand(i, n, cfg) {
    const ph = [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)], fr = [rnd(2, 4), rnd(2, 4), rnd(2, 4)], amp = rnd(0.5, 0.85), cen = [rnd(-0.15, 0.15), rnd(-0.15, 0.15), rnd(-0.1, 0.1)];
    const T = [], S = [], x0 = -0.95 + 1.9 * (i + 0.5) / n + rnd(-0.03, 0.03), L = rnd(3.0, 3.4);
    for (let k = 0; k < NP; k++) {
      const t = k / (NP - 1) * Math.PI * 1.7;
      T.push(new THREE.Vector3(cen[0] + amp * Math.sin(fr[0] * t + ph[0]), cen[1] + amp * Math.cos(fr[1] * t + ph[1]), cen[2] + amp * 0.7 * Math.sin(fr[2] * t + ph[2])));
      S.push(new THREE.Vector3(x0 + Math.sin(k * 1.3 + i) * 0.022, L / 2 - L * k / (NP - 1), rnd(-0.05, 0.05)));
    }
    const col = new THREE.Color(cfg.PELOS[i % cfg.PELOS.length]);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: col, roughness: 0.38, metalness: 0.12, emissive: new THREE.Color('#f3d98f'), emissiveIntensity: 0 }));
    root.add(mesh);
    return { i, T, S, u: 0, res: cfg.res * rnd(0.85, 1.15), mesh, cur: T.map((p) => p.clone()), dirty: true, heat: 0, wave: 0, done: false };
  }
  function rebuild(s) {
    const e = ease(s.u);
    for (let k = 0; k < s.T.length; k++) {
      s.cur[k].copy(s.T[k]).lerp(s.S[k], e);
      if (s.wave > 0) s.cur[k].x += s.wave * Math.sin(clock * 8 + s.i * 0.7 - k * 0.55) * 0.07 * (k / (NP - 1));   // ondeo del pelo recién liso
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s.cur, false, 'catmullrom', 0.5), 40, 0.02, 5, false);
    s.mesh.geometry.dispose(); s.mesh.geometry = geo; s.dirty = false;
  }
  function clear() { strands.forEach((s) => { s.mesh.geometry.dispose(); s.mesh.material.dispose(); root.remove(s.mesh); }); strands = []; }
  const wpos = (s, k) => root.localToWorld(s.cur[k].clone());

  /* Carga un nivel. idle = true: el nudo solo gira (bienvenida y resultados). */
  G.load = function (n, cfg, idle) {
    clear(); lvl = n; tirones = 0; glow = 0; done = 0; tLeft = n.tiempo;
    for (let i = 0; i < n.hebras; i++) strands.push(mkStrand(i, n.hebras, { PELOS: cfg.PELOS, res: n.resistencia }));
    strands.forEach(rebuild); root.rotation.y = 0; G.state = idle ? 'idle' : 'ready'; bump = idle ? 0 : 1;   // al cargar un nivel el nudo "salta" al aparecer
  };
  /* Deja todo peinado (para la pantalla de victoria), con ondeo y fuegos artificiales */
  G.comb = function () {
    strands.forEach((s) => { s.u = 1; s.dirty = true; s.done = true; s.wave = 1; }); glow = 1;
    for (let k = 0; k < 7; k++) setTimeout(() => { if (G.state !== 'end' && G.state !== 'idle') return; const p = root.localToWorld(new THREE.Vector3(rnd(-1, 1), rnd(-1.3, 1.3), 0.2)); G.burst(p.x, p.y, p.z + 0.3, 14, 2.6); }, k * 110);
  };
  G.start = function () { tLeft = lvl.tiempo; tirones = 0; done = 0; G.state = 'play'; root.rotation.y = 0; bump = 1; };
  G.stop = function () { G.state = 'idle'; brush.visible = false; down = false; ptr = null; if (G.onTouch) G.onTouch(false); };
  G.progress = () => strands.length ? strands.reduce((a, s) => a + s.u, 0) / strands.length : 0;

  /* ---------- Dedo ---------- */
  function world(e) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    return ray.ray.intersectPlane(plane, tmp) ? { x: tmp.x, y: tmp.y - root.position.y } : null;
  }
  function onDown(e) {
    if (G.state !== 'play' || down) return;                 // un solo dedo a la vez
    down = true; ptr = e.pointerId; gDown = gUp = 0; prev = world(e); tPrev = performance.now(); brush.visible = true; place(prev, true);
    if (G.onTouch) G.onTouch(true);
  }
  function place(p, snap) { if (!p) return; target.set(p.x, p.y + root.position.y, 0.5); if (snap) brush.position.copy(target); }
  function onMove(e) {
    if (!down || G.state !== 'play' || e.pointerId !== ptr) return;
    const p = world(e); if (!p) return; place(p);
    if (prev) {
      const dx = p.x - prev.x, dy = p.y - prev.y, now = performance.now(), dist = Math.hypot(dx, dy);
      brush.rotation.z = Math.max(-0.5, Math.min(0.5, -dx * 1.5));
      if (dist > 0.004) {
        comb(prev, p, dx, dy);
        if (G.onStroke) G.onStroke(dist / Math.max(0.008, (now - tPrev) / 1000), dy <= 0);
        if (Math.random() < 0.55) G.burst(p.x + rnd(-0.08, 0.08), p.y + root.position.y + rnd(-0.1, 0.05), 0.55, 1, 0.5);   // estela de chispas
        tPrev = now; lastMove = now;
      }
    }
    prev = p;
  }
  function onUp(e) {
    if (!down || (e && e.pointerId !== undefined && e.pointerId !== ptr)) return; down = false; ptr = null; brush.visible = false;
    if (G.onTouch) G.onTouch(false);
    if (G.state === 'play' && gUp > 0.7 && gUp > gDown * 0.6) { tirones++; shake = RM ? 0 : 1; bump = RM ? 0 : 0.6; if (G.onOuch) G.onOuch(); }
  }
  function distSeg(a, b, p) {
    const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1e-9;
    let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
  }
  function comb(a, b, dx, dy) {
    let hit = false;
    for (const s of strands) {
      if (s.u >= 1) continue;
      let d = 9; for (const p of s.cur) d = Math.min(d, distSeg(a, b, p)); if (d > HIT) continue;
      hit = true; s.heat = 1; const f = 1 - 0.5 * d / HIT;
      if (dy < 0) { s.u = Math.min(1, s.u + (-dy) * f / (s.res * TRAVEL)); s.dirty = true; }
      else if (s.u > 0.05 && s.u < 0.97) { s.u = Math.max(0, s.u - dy * 0.05); s.dirty = true; }   // a contrapelo: se vuelve a enredar un poco
      if (s.u >= 1 && !s.done) {                                                                     // hebra liberada: destello, ondeo y nota
        s.done = true; s.wave = 0.7; done++; const p = wpos(s, 7); G.burst(p.x, p.y, p.z + 0.3, 12, 1.8);
        if (G.onStrand) G.onStrand(done, strands.length);
      }
    }
    if (hit) { if (dy < 0) gDown += -dy; else gUp += dy; if (dy < 0 && navigator.vibrate && Math.random() < 0.15) navigator.vibrate(6); }
  }

  /* ---------- Bucle ---------- */
  function loop(now) {
    raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (G.state === 'play') {
      tLeft -= dt; const prog = G.progress();
      if (G.onTick) G.onTick({ tLeft: Math.max(0, tLeft), prog, tirones });
      if (down && now - lastMove > 90 && G.onStroke) G.onStroke(0, true);                         // dedo quieto: el "shh" se apaga
      if (prog >= 0.985) finish(true); else if (tLeft <= 0) finish(false);
    } else if (G.state === 'idle') { root.rotation.y = Math.sin(clock * 0.6) * 0.3; root.rotation.z = Math.sin(clock * 0.9) * 0.04; }
    if (G.state !== 'idle') root.rotation.z *= 0.9;
    const play = G.state !== 'idle', ty = play ? 0.15 : 1.55 + (RM ? 0 : Math.sin(clock * 1.3) * 0.05), ts = play ? 1 : 0.7;   // en bienvenida y resultados el nudo queda arriba, más chico y "flotando"
    bump = Math.max(0, bump - dt * 1.8); shake = Math.max(0, shake - dt * 3);
    root.position.y += (ty - root.position.y) * Math.min(1, dt * 5); root.position.x = Math.sin(clock * 70) * 0.07 * shake;
    root.scale.setScalar(root.scale.x + (ts * (1 + 0.1 * bump * Math.sin(bump * 11)) - root.scale.x) * Math.min(1, dt * 14));
    brush.position.lerp(target, Math.min(1, dt * 24));                                               // el cepillo sigue al dedo con suavidad
    if (glow > 0) glow = Math.max(0, glow - dt * 0.6);
    strands.forEach((s) => {
      if (s.heat > 0) s.heat = Math.max(0, s.heat - dt * 2.2);
      if (s.wave > 0) { s.wave = Math.max(0, s.wave - dt * 0.55); s.dirty = true; }
      s.mesh.material.emissiveIntensity = Math.max(0.55 * glow * (0.6 + 0.4 * Math.sin(clock * 8)), 0.45 * s.heat);   // brillan donde pasa el cepillo
      if (s.dirty) rebuild(s);
    });
    updParticles(dt);
    renderer.render(scene, camera);
  }
  function finish(ok) {
    const prog = G.progress(), frac = Math.max(0, tLeft) / lvl.tiempo, limp = Math.max(0, 1 - tirones / 8);
    G.state = 'end'; brush.visible = false; down = false; ptr = null; if (G.onTouch) G.onTouch(false);
    if (ok) G.comb();
    const res = { ok, prog, tirones, seg: Math.round(lvl.tiempo - Math.max(0, tLeft)), puntaje: ok ? Math.round(700 * frac + 300 * limp) : Math.round(prog * 300) };
    if (G.onEnd) G.onEnd(res);
  }
})();
