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
  let acc = 0, prX = 0, prY = 0, strands = [], lvl = null, tLeft = 0, tirones = 0, glow = 0, done = 0, bump = 0, shake = 0;
  const NP = 48, HIT = 0.4, TRAVEL = 7;            // radio de "agarre" del cepillo y recorrido necesario por unidad de resistencia
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

  /* ---------- Pelo ----------
     Cada "hebra" del juego es un mechón: una cadena de 14 puntos con física (Verlet: gravedad, inercia, resorte hacia su forma,
     largo constante). Cada mechón reparte NHILOS cabellos finos, dibujados como cintas que siempre miran a la cámara, todo en UNA malla.
     El sombreado es el de pelo real (Kajiya-Kay): dos reflejos alargados a lo largo de la fibra, raíz más oscura y punta que se afina. */
  const bajo = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;      // celulares modestos: menos cabellos
  const NS = 44, DT = 1 / 60; let NHILOS = (TT.CONFIG && TT.CONFIG.HILOS) || (bajo ? 24 : 40), HN = NHILOS, ema = 0.016, nfr = 0;
  let hairMesh = null, hairAttr = null, hairIdx = 0, uni = null;
  const VERT = `
    attribute vec3 aTan; attribute float aSide, aT, aW, aGlow, aK; attribute vec3 aCol; uniform float uWidth;
    varying vec3 vT, vR, vV, vCol; varying float vSide, vTt, vGlow, vK;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 T = normalize(normalMatrix * aTan), V = normalize(-mv.xyz), R = normalize(cross(T, V));
      float taper = (1.0 - 0.92 * smoothstep(0.80, 1.0, aT)) * mix(0.6, 1.0, smoothstep(0.0, 0.12, aT));
      mv.xyz += R * aSide * uWidth * aW * taper;
      vT = T; vR = R; vV = V; vSide = aSide; vTt = aT; vCol = aCol; vGlow = aGlow; vK = aK;
      gl_Position = projectionMatrix * mv;
    }`;
  const FRAG = `
    uniform vec3 uL1, uL2;
    varying vec3 vT, vR, vV, vCol; varying float vSide, vTt, vGlow, vK;
    float kk(vec3 T, vec3 L, vec3 V, float p){ float tl = dot(T, L), tv = dot(T, V); float c = tl * tv + sqrt(max(0.0, 1.0 - tl * tl)) * sqrt(max(0.0, 1.0 - tv * tv)); return pow(max(0.0, c), p); }
    void main(){
      vec3 T = normalize(vT), V = normalize(vV), R = normalize(vR), L = normalize(uL1), L2 = normalize(uL2);
      vec3 N = normalize(R * vSide + V * sqrt(max(0.0, 1.0 - vSide * vSide)));
      float tl = dot(T, L), diff = sqrt(max(0.0, 1.0 - tl * tl)) * 0.6 + max(0.0, dot(N, L)) * 0.4;
      float root = mix(0.42, 1.0, smoothstep(0.0, 0.32, vTt)), tip = smoothstep(0.78, 1.0, vTt);
      vec3 base = mix(vCol, vCol * 1.2 + vec3(0.04, 0.025, 0.012), tip * 0.5);
      vec3 amb = mix(vec3(0.28, 0.22, 0.32), vec3(0.66, 0.58, 0.70), N.y * 0.5 + 0.5);
      vec3 col = base * (amb * 0.85 + diff * vec3(1.0, 0.96, 0.92) * 0.85) * root * (1.0 - 0.42 * vK);   // dentro del nudo hay sombra propia
      float lit = smoothstep(-0.15, 0.35, dot(N, L));
      float s1 = kk(normalize(T - N * 0.10), L, V, 140.0) * 0.95 * lit;                        // reflejo blanco, fino
      float s2 = kk(normalize(T + N * 0.24), L, V, 38.0) * 0.5 * lit;                          // reflejo teñido, más ancho (cobre)
      float rim = kk(normalize(T + N * 0.05), L2, V, 60.0) * 0.28;                             // contraluz lila
      col += s1 * vec3(1.0, 0.98, 0.96) * root + s2 * vec3(1.0, 0.72, 0.5) * vCol * 2.2 + rim * vec3(0.78, 0.68, 1.0);
      col += vGlow * vec3(1.0, 0.84, 0.5) * (0.12 + 0.6 * s1);
      gl_FragColor = vec4(col, 1.0);
      #include <encodings_fragment>
    }`;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  /* Cortina de pelo: cae desde arriba de la pantalla y tiene varios nudos repartidos a lo largo. Los nudos se agrupan entre mechones vecinos
     (amplitud coherente en x) y cada mechón tiene al menos un nudo, de modo que hay que peinar todo el ancho. */
  const XW = 2.7, YTOP = 2.55;
  const sm = (x) => 1 / (1 + Math.exp(-x));
  function mkStrand(i, n, cfg) {
    const L = rnd(4.05, 4.75), x0 = -XW / 2 + XW * (i + 0.5) / n + rnd(-0.02, 0.02), T = [], S = [], nk = cfg.nudos || 3, knots = [];
    for (let j = 0; j < nk; j++) {                                  // en cada fila de nudos, el mechón se agrupa hacia el centro de su grupo más cercano
      const cl = cfg.clusters[j]; let best = cl[0], bd = 9; cl.forEach((q) => { const d = Math.abs(q.x - x0); if (d < bd) { bd = d; best = q; } });
      knots.push({ t0: cfg.rows[j] + best.dt + best.sl * (x0 - best.x) + rnd(-0.025, 0.025), w: best.w * rnd(0.8, 1.25), a: (1 - 0.4 * Math.min(1, bd / 0.75)) * rnd(0.75, 1), cx: best.x, cz: best.z, pull: best.pull * rnd(0.75, 1.2), r: rnd(0.035, 0.08), ph: best.ph + rnd(-0.9, 0.9), fx: rnd(2.2, 3.6) });
    }
    if (Math.random() < 0.55) knots.push({ t0: rnd(0.12, 0.92), w: rnd(0.02, 0.035), a: rnd(0.45, 0.8), cx: x0, cz: 0, pull: 0, r: rnd(0.04, 0.08), ph: rnd(0, 6.28), fx: rnd(2.6, 3.8) });   // enredo pequeño de un solo mechón
    if (Math.random() < 0.3) knots.splice((Math.random() * nk) | 0, 1);                                                                                               // algunos mechones se saltan un nudo
    for (let k = 0; k < NP; k++) {
      const t = k / (NP - 1); let dx = 0, dy = 0, dz = 0;
      knots.forEach((q) => {
        const z = (t - q.t0) / q.w, d = Math.exp(-z * z), dp = Math.exp(-(z * z) / 5), sg = sm(z * 1.6);
        dx += dp * q.pull * (q.cx - x0) + d * q.r * Math.sin(q.fx * z + q.ph); dz += dp * q.cz + d * q.r * 1.3 * Math.cos(q.fx * z + q.ph); dy += q.a * 0.15 * sg + d * 0.05 * Math.cos(2 * q.fx * z + q.ph);   // el nudo "se come" largo: lo de abajo sube
      });
      S.push(new THREE.Vector3(x0, YTOP - L * t, rnd(-0.03, 0.03)));
      T.push(new THREE.Vector3(x0 + dx, YTOP - L * t + dy, dz));
    }
    const base = new THREE.Color(cfg.PELOS[i % cfg.PELOS.length]).convertSRGBToLinear(), hairs = [];
    for (let h = 0; h < NHILOS; h++) {
      const c = base.clone().multiplyScalar(rnd(0.82, 1.18)); if (Math.random() < 0.14) c.lerp(new THREE.Color('#b9824a').convertSRGBToLinear(), 0.45);          // algunos cabellos con reflejos caramelo
      const fly = Math.random() < 0.12 ? 2.2 : 1;      // algunos cabellos sueltos (frizz)
      hairs.push({ ox: gauss() * fly, oz: gauss() * fly, ph: rnd(0, 6.28), fq: rnd(6, 11), tw: rnd(-7, 7), w: rnd(0.8, 1.25), c, fl: Math.random() < 0.15 ? rnd(2, 3) : 1, lp: Math.random() < 0.5 ? rnd(0.5, 1.6) : 0.2 });
    }
    const pos = new Float32Array(NP * 3), prv = new Float32Array(NP * 3), rest = new Float32Array(NP * 3);
    for (let k = 0; k < NP; k++) { pos[k * 3] = prv[k * 3] = T[k].x; pos[k * 3 + 1] = prv[k * 3 + 1] = T[k].y; pos[k * 3 + 2] = prv[k * 3 + 2] = T[k].z; }
    return { i, T, S, knots, u: 0, res: cfg.res * rnd(0.85, 1.15), pos, prv, rest, hairs, cur: T.map((p) => p.clone()), heat: 0, done: false, sp: XW / n, wa: rnd(0.15, 0.25), wf: rnd(0.8, 1.1), wp: i * 0.42 + rnd(-0.3, 0.3) };
  }
  /* cuánto "nudo" hay en el punto t del mechón (0 a 1) */
  const knotAt = (s, t) => { let w = 0; for (const q of s.knots) { const z = (t - q.t0) / q.w; w += q.a * Math.exp(-z * z); } return Math.min(1, w); };
  /* forma de reposo del mechón: entre el enredo y la caída recta con ondas suaves */
  function setRest(s) {
    const e = ease(s.u);
    for (let k = 0; k < NP; k++) {
      const t = k / (NP - 1), w = s.wa * (0.5 + 0.5 * e) * Math.sin(t * 6.283 * s.wf + s.wp) * (0.3 + 0.7 * t), j = k * 3;
      s.rest[j] = s.T[k].x + (s.S[k].x - s.T[k].x) * e + w; s.rest[j + 1] = s.T[k].y + (s.S[k].y - s.T[k].y) * e; s.rest[j + 2] = s.T[k].z + (s.S[k].z - s.T[k].z) * e + w * 0.6 * Math.cos(t * 5 + s.wp);
    }
  }
  /* física del mechón (Verlet): inercia, resorte hacia la forma de reposo, gravedad, largo de cada tramo constante, raíz fija */
  function simulate(s, dt) {
    const e = ease(s.u), P = s.pos, Q = s.prv, R = s.rest, ks = 260 - 185 * e, g = 1.4 + 10 * e, damp = 0.95 + 0.033 * e, d2 = dt * dt;
    setRest(s);
    for (let k = 1; k < NP; k++) {
      const t = k / (NP - 1), kk = ks * (1 - 0.45 * t * e), j = k * 3, br = (Math.sin(clock * 1.25 + k * 0.45 + s.i) * 0.5 + Math.sin(clock * 2.1 + s.i * 1.7) * 0.3) * 0.9 * e * t;   // brisa suave
      for (let a = 0; a < 3; a++) {
        const v = (P[j + a] - Q[j + a]) * damp; Q[j + a] = P[j + a];
        P[j + a] += v + ((R[j + a] - P[j + a]) * kk - (a === 1 ? g : 0) + (a === 0 ? br : 0)) * d2;
      }
    }
    P[0] = Q[0] = R[0]; P[1] = Q[1] = R[1]; P[2] = Q[2] = R[2];
    for (let it = 0; it < 6; it++) for (let k = 0; k < NP - 1; k++) {
      const a = k * 3, b = a + 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], len = Math.hypot(dx, dy, dz) || 1e-6;
      const L = Math.hypot(R[b] - R[a], R[b + 1] - R[a + 1], R[b + 2] - R[a + 2]), f = (len - L) / len, w = k === 0 ? 1 : 0.5;
      P[b] -= dx * f * w; P[b + 1] -= dy * f * w; P[b + 2] -= dz * f * w; if (k > 0) { P[a] += dx * f * w; P[a + 1] += dy * f * w; P[a + 2] += dz * f * w; }
    }
    for (let k = 0; k < NP; k++) s.cur[k].set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
  }
  const cr = (p0, p1, p2, p3, u) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);

  /* Escribe los cabellos del mechón en la malla compartida */
  function fillHair(s, hOff, glowV) {
    const P = s.pos, e = ease(s.u), pr = fillHair.tmp || (fillHair.tmp = new Float32Array(NS * 3)), kws = fillHair.k || (fillHair.k = new Float32Array(NS)), A = hairAttr;
    for (let h = 0; h < HN; h++) {
      const H = s.hairs[h];
      for (let j = 0; j < NS; j++) {
        const t = j / (NS - 1), f = t * (NP - 1), i1 = Math.min(NP - 2, Math.floor(f)), u = f - i1, i0 = Math.max(0, i1 - 1), i2 = i1 + 1, i3 = Math.min(NP - 1, i1 + 2);
        const k0 = knotAt(s, t), kw = k0 * (1 - e); kws[j] = kw;
        const spread = (0.09 + 0.075 * kw * H.fl) * (1 - e) + (Math.max(0.04, s.sp * 0.8) + (H.fl > 1 ? 0.05 * t : 0)) * e * (0.6 + 0.4 * t) + (H.fl > 1 ? 0.04 * t * (1 - e) : 0), tw = t * H.tw * kw * 2.4 + H.ph, c = Math.cos(tw), sn = Math.sin(tw);
        const ox = (H.ox * c - H.oz * sn) * spread, oz = (H.ox * sn + H.oz * c) * spread * 0.8;
        const lp = kw * H.lp * 0.06, la = t * H.fq * 1.7 + H.ph;                                                            // bucles de cada cabello dentro del nudo
        const rip = Math.sin(t * H.fq + H.ph + clock * 0.5 * e) * (0.006 + 0.012 * e) + Math.cos(la) * lp * 0.5;
        for (let a = 0; a < 3; a++) pr[j * 3 + a] = cr(P[i0 * 3 + a], P[i1 * 3 + a], P[i2 * 3 + a], P[i3 * 3 + a], u) + (a === 0 ? ox + rip : a === 1 ? Math.sin(la) * lp * 0.6 : oz + Math.sin(la) * lp * 0.5);
      }
      for (let j = 0; j < NS; j++) {
        const jp = Math.max(0, j - 1), jn = Math.min(NS - 1, j + 1);
        let tx = pr[jn * 3] - pr[jp * 3], ty = pr[jn * 3 + 1] - pr[jp * 3 + 1], tz = pr[jn * 3 + 2] - pr[jp * 3 + 2]; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
        for (let sd = 0; sd < 2; sd++) {
          const v = (hOff + h) * NS * 2 + j * 2 + sd, v3 = v * 3;
          A.position.array[v3] = pr[j * 3]; A.position.array[v3 + 1] = pr[j * 3 + 1]; A.position.array[v3 + 2] = pr[j * 3 + 2];
          A.aTan.array[v3] = tx; A.aTan.array[v3 + 1] = ty; A.aTan.array[v3 + 2] = tz; A.aGlow.array[v] = glowV; A.aK.array[v] = kws[j];
        }
      }
    }
  }
  function buildHairMesh(list) {
    HN = NHILOS; const nh = list.length * HN, nv = nh * NS * 2, g = new THREE.BufferGeometry(), idx = new Uint32Array(nh * (NS - 1) * 6);
    const attr = { position: new Float32Array(nv * 3), aTan: new Float32Array(nv * 3), aSide: new Float32Array(nv), aT: new Float32Array(nv), aW: new Float32Array(nv), aCol: new Float32Array(nv * 3), aGlow: new Float32Array(nv), aK: new Float32Array(nv) };
    let q = 0;
    list.forEach((s, li) => s.hairs.forEach((H, h) => {
      const hi = li * HN + h;
      for (let j = 0; j < NS; j++) for (let sd = 0; sd < 2; sd++) {
        const v = hi * NS * 2 + j * 2 + sd; attr.aSide[v] = sd ? 1 : -1; attr.aT[v] = j / (NS - 1); attr.aW[v] = H.w; attr.aCol[v * 3] = H.c.r; attr.aCol[v * 3 + 1] = H.c.g; attr.aCol[v * 3 + 2] = H.c.b;
      }
      for (let j = 0; j < NS - 1; j++) { const a = hi * NS * 2 + j * 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], q); q += 6; }
    }));
    const dyn = { position: 3, aTan: 3, aGlow: 1, aK: 1 };
    for (const k in attr) { const at = new THREE.BufferAttribute(attr[k], k === 'position' || k === 'aTan' || k === 'aCol' ? 3 : 1); if (dyn[k]) at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, at); }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    uni = { uWidth: { value: 0.0040 }, uL1: { value: new THREE.Vector3(0.45, 0.7, 0.65) }, uL2: { value: new THREE.Vector3(-0.7, 0.3, -0.6) } };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, side: THREE.DoubleSide }));
    m.frustumCulled = false; hairAttr = g.attributes; return m;
  }
  function clear() { if (hairMesh) { root.remove(hairMesh); hairMesh.geometry.dispose(); hairMesh.material.dispose(); hairMesh = null; } strands = []; }
  const wpos = (s, k) => root.localToWorld(s.cur[k].clone());
  function updateHair() {
    const gl = glow * 0.55 * (0.6 + 0.4 * Math.sin(clock * 8));
    strands.forEach((s, li) => fillHair(s, li * HN, Math.max(gl, 0.5 * s.heat)));
    ['position', 'aTan', 'aGlow', 'aK'].forEach((k) => { hairAttr[k].needsUpdate = true; });
    uni.uWidth.value = 0.0040 * Math.max(0.7, root.scale.x);
  }
  /* empujón lateral a todo el pelo (tirón, victoria) */
  function kick(amount, upTo) { strands.forEach((s) => { const r = rnd(-1, 1); for (let k = 1; k < NP; k++) { const t = k / (NP - 1); s.pos[k * 3] += (r * 0.7 + Math.sin(s.i + k * 0.4) * 0.5) * amount * t; } }); }

  /* Carga un nivel. idle = true: el nudo solo gira (bienvenida y resultados). */
  G.load = function (n, cfg, idle) {
    clear(); lvl = n; tirones = 0; glow = 0; done = 0; tLeft = n.tiempo;
    const nk = n.nudos || 3, rows = [], clusters = [], nc = Math.max(3, Math.round(n.hebras / 3.5));
    for (let j = 0; j < nk; j++) {                                  // filas de nudos escalonadas y, en cada una, grupos repartidos a lo ancho
      rows.push(0.12 + 0.76 * (j + 0.5) / nk + rnd(-0.04, 0.04)); const cl = [];
      for (let c = 0; c < nc; c++) cl.push({ x: -XW / 2 + XW * (c + 0.5) / nc + rnd(-0.3, 0.3), z: rnd(-0.08, 0.12), ph: rnd(0, 6.28), dt: rnd(-0.1, 0.1), sl: rnd(-0.06, 0.06), w: rnd(0.028, 0.055), pull: rnd(0.25, 0.65) });
      clusters.push(cl);
    }
    for (let i = 0; i < n.hebras; i++) strands.push(mkStrand(i, n.hebras, { PELOS: cfg.PELOS, res: n.resistencia, nudos: nk, rows, clusters }));
    hairMesh = buildHairMesh(strands); root.add(hairMesh);
    strands.forEach((s) => { setRest(s); simulate(s, DT); }); updateHair(); root.rotation.y = 0; G.state = idle ? 'idle' : 'ready'; bump = idle ? 0 : 1;   // al cargar un nivel el nudo "salta" al aparecer
  };
  /* Deja todo peinado (para la pantalla de victoria): el pelo cae, se balancea, y salen fuegos artificiales */
  G.comb = function () {
    strands.forEach((s) => { s.u = 1; s.done = true; }); glow = 1; kick(0.2);
    for (let k = 0; k < 7; k++) setTimeout(() => { if (G.state !== 'end' && G.state !== 'idle') return; const p = root.localToWorld(new THREE.Vector3(rnd(-1, 1), rnd(-1.3, 1.3), 0.2)); G.burst(p.x, p.y, p.z + 0.3, 14, 2.6); }, k * 110);
  };
  /* avanza la simulación de forma determinista (para vistas previas y pruebas) */
  G.advance = function (sec) { for (let t = 0; t < sec; t += DT) { clock += DT; strands.forEach((s) => simulate(s, DT)); } updateHair(); renderer.render(scene, camera); };
  G.strands = () => strands;
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
    if (G.state === 'play' && gUp > 0.7 && gUp > gDown * 0.6) { tirones++; shake = RM ? 0 : 1; bump = RM ? 0 : 0.6; kick(0.25); if (G.onOuch) G.onOuch(); }
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
      for (let k = 1; k < NP; k++) { const pk = s.cur[k]; if (Math.hypot(pk.x - b.x, pk.y - b.y) < HIT) { s.pos[k * 3] += dx * 0.55 * f; s.pos[k * 3 + 1] += dy * 0.35 * f; } }   // el cepillo arrastra el pelo
      if (dy < 0) { s.u = Math.min(1, s.u + (-dy) * f / (s.res * TRAVEL)); s.dirty = true; }
      else if (s.u > 0.05 && s.u < 0.97) { s.u = Math.max(0, s.u - dy * 0.05); s.dirty = true; }   // a contrapelo: se vuelve a enredar un poco
      if (s.u >= 1 && !s.done) {                                                                     // hebra liberada: destello, ondeo y nota
        s.done = true; for (let k = 1; k < NP; k++) s.pos[k * 3] += rnd(-0.1, 0.1) * (k / NP); done++; const p = wpos(s, 7); G.burst(p.x, p.y, p.z + 0.3, 12, 1.8);
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
    ema += (dt - ema) * 0.05; if (++nfr === 150 && ema > 0.034 && NHILOS > 24 && !(TT.CONFIG && TT.CONFIG.HILOS)) NHILOS = 24;   // si el celular va lento, los próximos niveles usan menos cabellos
    acc = Math.min(0.1, acc + dt); const rdx = root.position.x - prX, rdy = root.position.y - prY; prX = root.position.x; prY = root.position.y;
    strands.forEach((s) => {
      if (s.heat > 0) s.heat = Math.max(0, s.heat - dt * 2.2);
      for (let k = 1; k < NP; k++) { const w = 0.8 * (k / NP); s.pos[k * 3] -= rdx * w; s.pos[k * 3 + 1] -= rdy * w; s.prv[k * 3] -= rdx * w; s.prv[k * 3 + 1] -= rdy * w; }   // inercia: el pelo se queda atrás cuando el nudo se mueve
      for (let n = 0; n < Math.floor(acc / DT) && n < 3; n++) simulate(s, DT);
    });
    acc -= Math.min(3, Math.floor(acc / DT)) * DT; updateHair();
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
