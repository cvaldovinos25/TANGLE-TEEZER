/* ============================================================
   Desenreda el nudo | juego 3D (three.js) sobre la cámara
   Un nudo de hebras (curvas de Lissajous) se "peina" con el dedo: al pasar de arriba hacia abajo cada hebra
   se endereza hacia su posición final (interpolación entre la forma enredada y la recta). Subir el dedo es un tirón.
   ============================================================ */
(function () {
  const TT = window.TT, THREE = window.THREE;
  const G = (TT.Game = { state: 'idle', onTick: null, onEnd: null, onOuch: null });
  let renderer, scene, camera, root, brush, canvas, raf = 0, last = 0, clock = 0;
  let strands = [], lvl = null, tLeft = 0, tirones = 0, glow = 0;
  const NP = 14, HIT = 0.4, TRAVEL = 2.6;            // radio de "agarre" del cepillo y recorrido necesario por unidad de resistencia
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tmp = new THREE.Vector3();
  const rnd = (a, b) => a + Math.random() * (b - a), ease = (u) => u * u * (3 - 2 * u);
  let down = false, gDown = 0, gUp = 0, prev = null;

  G.init = function (cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
    scene.add(new THREE.HemisphereLight(0xfff4ee, 0xb7a2e6, 1));
    const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(2, 4, 5); scene.add(dl);
    root = new THREE.Group(); root.position.y = 0.15; scene.add(root);
    brush = TT.makeBrush(THREE, { color: '#b7a2e6', acento: '#e3c4f2', escala: 0.55 }); brush.visible = false; brush.rotation.x = -0.35; scene.add(brush);
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
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: col, roughness: 0.38, metalness: 0.12, emissive: col, emissiveIntensity: 0 }));
    root.add(mesh);
    return { T, S, u: 0, res: cfg.res * rnd(0.85, 1.15), mesh, cur: T.map((p) => p.clone()), dirty: true };
  }
  function rebuild(s) {
    const e = ease(s.u);
    for (let k = 0; k < s.T.length; k++) s.cur[k].copy(s.T[k]).lerp(s.S[k], e);
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s.cur, false, 'catmullrom', 0.5), 40, 0.02, 5, false);
    s.mesh.geometry.dispose(); s.mesh.geometry = geo; s.dirty = false;
  }
  function clear() { strands.forEach((s) => { s.mesh.geometry.dispose(); s.mesh.material.dispose(); root.remove(s.mesh); }); strands = []; }

  /* Carga un nivel. idle = true: el nudo solo gira (bienvenida y resultados). */
  G.load = function (n, cfg, idle) {
    clear(); lvl = n; tirones = 0; glow = 0; tLeft = n.tiempo;
    for (let i = 0; i < n.hebras; i++) strands.push(mkStrand(i, n.hebras, { PELOS: cfg.PELOS, res: n.resistencia }));
    strands.forEach(rebuild); root.rotation.y = 0; G.state = idle ? 'idle' : 'ready';
  };
  /* Deja todo peinado (para la pantalla de victoria) */
  G.comb = function () { strands.forEach((s) => { s.u = 1; s.dirty = true; }); glow = 1; };
  G.start = function () { tLeft = lvl.tiempo; tirones = 0; G.state = 'play'; root.rotation.y = 0; };
  G.stop = function () { G.state = 'idle'; brush.visible = false; down = false; };
  G.progress = () => strands.length ? strands.reduce((a, s) => a + s.u, 0) / strands.length : 0;

  /* ---------- Dedo ---------- */
  function world(e) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    return ray.ray.intersectPlane(plane, tmp) ? { x: tmp.x, y: tmp.y - root.position.y } : null;
  }
  function onDown(e) { if (G.state !== 'play') return; down = true; gDown = gUp = 0; prev = world(e); brush.visible = true; place(prev); }
  function place(p) { if (p) brush.position.set(p.x, p.y + root.position.y, 0.5); }
  function onMove(e) {
    if (!down || G.state !== 'play') return;
    const p = world(e); if (!p) return; place(p);
    if (prev) {
      const dx = p.x - prev.x, dy = p.y - prev.y; brush.rotation.z = Math.max(-0.5, Math.min(0.5, -dx * 1.5));
      if (Math.abs(dx) + Math.abs(dy) > 0.004) comb(prev, p, dx, dy);
    }
    prev = p;
  }
  function onUp() {
    if (!down) return; down = false; brush.visible = false;
    if (G.state === 'play' && gUp > 0.7 && gUp > gDown * 0.6) { tirones++; if (G.onOuch) G.onOuch(); }
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
      hit = true; const f = 1 - 0.5 * d / HIT;
      if (dy < 0) { s.u = Math.min(1, s.u + (-dy) * f / (s.res * TRAVEL)); s.dirty = true; }
      else if (s.u > 0.05 && s.u < 0.97) { s.u = Math.max(0, s.u - dy * 0.05); s.dirty = true; }   // a contrapelo: se vuelve a enredar un poco
    }
    if (hit) { if (dy < 0) gDown += -dy; else gUp += dy; if (dy < 0 && navigator.vibrate && Math.random() < 0.15) navigator.vibrate(6); }
  }

  /* ---------- Bucle ---------- */
  function loop(now) {
    raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (G.state === 'play') {
      tLeft -= dt; const prog = G.progress();
      if (G.onTick) G.onTick({ tLeft: Math.max(0, tLeft), prog, tirones });
      if (prog >= 0.985) finish(true); else if (tLeft <= 0) finish(false);
    } else if (G.state === 'idle') root.rotation.y = Math.sin(clock * 0.6) * 0.3;
    const play = G.state !== 'idle', ty = play ? 0.15 : 1.55, ts = play ? 1 : 0.7;   // en bienvenida y resultados el nudo queda arriba y más chico
    root.position.y += (ty - root.position.y) * Math.min(1, dt * 5); root.scale.setScalar(root.scale.x + (ts - root.scale.x) * Math.min(1, dt * 5));
    if (glow > 0) { glow = Math.max(0, glow - dt * 0.6); strands.forEach((s) => { s.mesh.material.emissiveIntensity = 0.5 * glow * (0.6 + 0.4 * Math.sin(clock * 8)); }); }
    strands.forEach((s) => { if (s.dirty) rebuild(s); });
    renderer.render(scene, camera);
  }
  function finish(ok) {
    const prog = G.progress(), frac = Math.max(0, tLeft) / lvl.tiempo, limp = Math.max(0, 1 - tirones / 8);
    G.state = 'end'; brush.visible = false; down = false;
    if (ok) G.comb();
    const res = { ok, prog, tirones, seg: Math.round(lvl.tiempo - Math.max(0, tLeft)), puntaje: ok ? Math.round(700 * frac + 300 * limp) : Math.round(prog * 300) };
    if (G.onEnd) G.onEnd(res);
  }
})();
