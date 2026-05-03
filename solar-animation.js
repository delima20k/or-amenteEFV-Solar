'use strict';

/* =====================================================================
   AnimacaoMontagem — Three.js r134
   Arquitetura: SceneManager · HouseBuilder
   API pública: constructor(canvas) · iniciar() · reiniciar() · parar()
   ===================================================================== */

/* ─────────────────────────────────────────────────────────────────────
   CONSTANTES GLOBAIS DA CENA
   Todos os valores em metros. Origin (0,0,0) = centro da fundação.
   Eixo Y: vertical (para cima)
   Eixo Z: profundidade da casa (front = -Z, back = +Z)
   Eixo X: largura
   ───────────────────────────────────────────────────────────────────── */
const CASA = Object.freeze({
  W:  7,      // largura (X)
  D:  10,     // profundidade (Z)
  H:  3.8,    // altura das paredes
  RA: 2.2,    // altura adicional do telhado (ridge acima do topo das paredes)
  FH: 0.5,    // altura da fundação
  EV: 0.5,    // projeção do beiral
  WT: 0.25,   // espessura das paredes
});

/* ─────────────────────────────────────────────────────────────────────
   Helpers globais
   ───────────────────────────────────────────────────────────────────── */
function v3(x, y, z) { return new THREE.Vector3(x, y, z); }


/* ─────────────────────────────────────────────────────────────────────
   MaterialLibrary — texturas PBR procedurais via Canvas 2D
   ───────────────────────────────────────────────────────────────────── */
class MaterialLibrary {
  static #cache = new Map();

  static #tex(key, w, h, fn) {
    if (MaterialLibrary.#cache.has(key)) return MaterialLibrary.#cache.get(key);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    MaterialLibrary.#cache.set(key, t);
    return t;
  }

  static telha() {
    const tex = MaterialLibrary.#tex('telha', 512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#8b3520';
      ctx.fillRect(0, 0, w, h);
      const cols = 7, rows = 10;
      const tW = w / cols, tH = h / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (tW * 0.5);
        for (let c = 0; c < cols + 1; c++) {
          const x = c * tW - off, y = r * tH;
          const hue = 12 + Math.sin(r * 7 + c * 13) * 4;
          const lit = 30 + Math.sin(r * 3 + c * 11) * 7;
          const g = ctx.createLinearGradient(x, y, x, y + tH);
          g.addColorStop(0,   `hsl(${hue},62%,${lit + 10}%)`);
          g.addColorStop(0.5, `hsl(${hue},58%,${lit}%)`);
          g.addColorStop(1,   `hsl(${hue},52%,${lit - 9}%)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x + tW * 0.5, y + tH * 0.6, tW * 0.44, tH * 0.52, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    });
    tex.repeat.set(5, 4);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.84, metalness: 0.04, side: THREE.FrontSide });
  }

  static reboco() {
    const tex = MaterialLibrary.#tex('reboco', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#ede5d4'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 2;
        const v = (Math.random() - 0.5) * 22;
        ctx.fillStyle = `rgba(${145 + v | 0},${135 + v | 0},${118 + v | 0},0.16)`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    });
    tex.repeat.set(3, 3);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
  }

  static painel() {
    const tex = MaterialLibrary.#tex('painel', 512, 320, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0a1628'); bg.addColorStop(1, '#0d1f3c');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      const cols = 8, rows = 5, cW = (w - 20) / cols, cH = (h - 20) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 10 + c * cW, y = 10 + r * cH;
          const cb = ctx.createLinearGradient(x, y, x + cW, y + cH);
          cb.addColorStop(0, '#0f2248'); cb.addColorStop(1, '#0a1830');
          ctx.fillStyle = cb; ctx.fillRect(x + 1.5, y + 1.5, cW - 3, cH - 3);
          const sh = ctx.createLinearGradient(x, y, x + cW * 0.6, y + cH * 0.6);
          sh.addColorStop(0, 'rgba(100,200,255,0.10)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sh; ctx.fillRect(x + 1.5, y + 1.5, cW - 3, cH - 3);
        }
      }
      ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 4; ctx.strokeRect(3, 3, w - 6, h - 6);
    });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.65, color: 0x182844 });
  }

  static painelEmissivo() {
    const m = MaterialLibrary.painel();
    m.emissive          = new THREE.Color(0x1a3a88);
    m.emissiveIntensity = 0;
    return m;
  }

  static metal()       { return new THREE.MeshStandardMaterial({ color: 0xb0c0d0, roughness: 0.18, metalness: 0.92 }); }
  static metalEscuro() { return new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.28, metalness: 0.88 }); }
  static aluminio()    { return new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.15, metalness: 0.96 }); }
  static inversor()    { return new THREE.MeshStandardMaterial({ color: 0x1e2e1e, roughness: 0.45, metalness: 0.5  }); }
  static cabo()        { return new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.72, metalness: 0.15 }); }

  static relva() {
    const tex = MaterialLibrary.#tex('relva', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2f5a1e'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const hue = 95 + Math.random() * 35, sat = 38 + Math.random() * 28, lit = 18 + Math.random() * 20;
        ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`; ctx.fillRect(x, y, 2, 2);
      }
    });
    tex.repeat.set(14, 14);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 });
  }

  static calcada() {
    const tex = MaterialLibrary.#tex('calcada', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c8bfb0'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a89880'; ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });
    tex.repeat.set(4, 4);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
  }

  static vidro()    { return new THREE.MeshStandardMaterial({ color: 0x88ccee, roughness: 0.04, metalness: 0.05, transparent: true, opacity: 0.42 }); }

  static madeira() {
    const tex = MaterialLibrary.#tex('madeira', 256, 256, (ctx, w, h) => {
      for (let y = 0; y < h; y++) {
        const hue = 22 + Math.sin(y * 0.14) * 4, lit = 22 + Math.sin(y * 0.09) * 7;
        ctx.fillStyle = `hsl(${hue},50%,${lit}%)`; ctx.fillRect(0, y, w, 1);
      }
    });
    tex.repeat.set(2, 3);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.0 });
  }

  static concreto() {
    const tex = MaterialLibrary.#tex('concreto', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c0b8a8'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        const x = Math.random() * w, y = Math.random() * h, v = (Math.random() - 0.5) * 30;
        ctx.fillStyle = `rgba(${140 + v | 0},${132 + v | 0},${118 + v | 0},0.2)`; ctx.fillRect(x, y, 3, 3);
      }
    });
    tex.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
  }

  static dispose() {
    for (const t of MaterialLibrary.#cache.values()) t.dispose();
    MaterialLibrary.#cache.clear();
  }
}

/* ─────────────────────────────────────────────────────────────────────
   HouseBuilder — casa 3D com geometria matematicamente consistente.
   HouseBuilder.roofY(z)          → altitude Y da superfície do telhado em z
   HouseBuilder.roofPoint(x,z,n)  → ponto 3D na superfície + offset normal n
   ───────────────────────────────────────────────────────────────────── */
class HouseBuilder {
  #scene;
  #grp;

  roof1Center = new THREE.Vector3();
  roof2Center = new THREE.Vector3();
  poleTop     = new THREE.Vector3();

  constructor(scene) {
    this.#scene = scene;
    this.#grp   = new THREE.Group();
    scene.add(this.#grp);
  }

  /* altitude Y exata da superfície do telhado para uma coordenada Z */
  static roofY(zWorld) {
    const { FH, H, RA, D } = CASA;
    return FH + H + RA * (1 - Math.abs(zWorld) / (D / 2));
  }

  /* ponto 3D na superfície do telhado + deslocamento ao longo da normal */
  static roofPoint(x, z, normalOffset = 0) {
    const { RA, D } = CASA;
    const slope = Math.atan2(RA, D / 2);
    const ny = Math.cos(slope);
    const nz = -Math.sign(z || -0.001) * Math.sin(slope);
    return v3(x, HouseBuilder.roofY(z) + normalOffset * ny, z + normalOffset * nz);
  }

  build() {
    const { FH, H, RA, D } = CASA;

    this.#solo();
    this.#fundacao();
    this.#paredes();
    this.#telhado();
    this.#aberturas();
    this.#chamine();
    this.#jardim();
    this.#poste();

    this.roof1Center.set(0, FH + H + RA * 0.5, -D / 4);
    this.roof2Center.set(0, FH + H + RA * 0.5,  D / 4);
  }

  #solo() {
    const campo = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), MaterialLibrary.relva());
    campo.rotation.x = -Math.PI / 2; campo.receiveShadow = true;
    this.#grp.add(campo);
    const calc = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 5.5), MaterialLibrary.calcada());
    calc.position.set(0, 0.04, -CASA.D / 2 - 3.2); calc.receiveShadow = true;
    this.#grp.add(calc);
  }

  #fundacao() {
    const { W, D, FH } = CASA;
    const m = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, FH, D + 0.3), MaterialLibrary.concreto());
    m.position.y = FH / 2; m.castShadow = m.receiveShadow = true;
    this.#grp.add(m);
  }

  #paredes() {
    const { W, H, D, FH, RA, WT } = CASA;
    const mat  = MaterialLibrary.reboco();
    const yMid = FH + H / 2;

    for (const [w, h, d, x, y, z] of [
      [W,  H, WT, 0,      yMid, -D / 2],
      [W,  H, WT, 0,      yMid,  D / 2],
      [WT, H, D, -W / 2,  yMid,  0],
      [WT, H, D,  W / 2,  yMid,  0],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
      this.#grp.add(m);
    }

    for (const [zPos, flip] of [[-D / 2, false], [D / 2, true]]) {
      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(0, RA); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: WT, bevelEnabled: false });
      const m   = new THREE.Mesh(geo, mat);
      m.position.set(0, FH + H, flip ? D / 2 - WT : -D / 2);
      if (flip) m.rotation.y = Math.PI;
      m.castShadow = true; this.#grp.add(m);
    }
  }

  #telhado() {
    const { W, D, H, FH, RA, EV } = CASA;
    const slope = Math.atan2(RA, D / 2);
    const sLen  = Math.hypot(RA, D / 2) + EV;
    const mat   = MaterialLibrary.telha();

    for (const sign of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W + EV * 2, sLen, 1, 8), mat.clone());
      /*
        Agua de frente (sign=-1): inclina para baixo em -Z
          rotation.x = +(PI/2 - slope)  → face voltada para cima/frente
        Água de trás (sign=+1): inclina para baixo em +Z
          rotation.x = -(PI/2 - slope)  → face voltada para cima/trás
      */
      m.rotation.x  = sign > 0 ? -(Math.PI / 2 - slope) : (Math.PI / 2 - slope);
      const yCenter = FH + H + RA / 2;
      const zOff    = sign * (sLen / 2 * Math.cos(slope));
      m.position.set(0, yCenter, zOff);
      m.castShadow = m.receiveShadow = true;
      this.#grp.add(m);
    }

    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W + EV * 2, 8), MaterialLibrary.metalEscuro());
    ridge.rotation.z = Math.PI / 2; ridge.position.set(0, FH + H + RA + 0.02, 0);
    ridge.castShadow = true; this.#grp.add(ridge);

    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(WT * 0.6, WT * 0.6, D + EV * 2), MaterialLibrary.madeira());
      b.position.set(side * (W / 2 + EV * 0.5), FH + H + RA * 0.05, 0);
      b.castShadow = true; this.#grp.add(b);
    }
  }

  #aberturas() {
    const { W, D, H, FH, WT } = CASA;
    const yWall = FH + H * 0.55;
    const matV  = MaterialLibrary.vidro();
    const matM  = MaterialLibrary.madeira();

    const janela = (x, z, ry) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, WT + 0.04), matM);
      frame.position.set(x, yWall, z); frame.rotation.y = ry;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.04), matV);
      glass.position.set(x, yWall, z); glass.rotation.y = ry;
      const th = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.04), matM);
      th.position.copy(glass.position);
      const tv = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.86, 0.04), matM);
      tv.position.copy(glass.position);
      this.#grp.add(frame, glass, th, tv);
    };

    janela(-W / 3.2, -D / 2 - 0.01, 0);
    janela( W / 3.2, -D / 2 - 0.01, 0);
    janela(-W / 3.2,  D / 2 + 0.01, Math.PI);

    const pFrame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.1, WT + 0.04), matM);
    pFrame.position.set(0, FH + 1.05, -D / 2 - 0.01);
    const pDoor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.95, 0.05), matM);
    pDoor.position.set(0.1, FH + 0.975, -D / 2 - WT * 0.5 - 0.02);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.4), MaterialLibrary.concreto());
    step.position.set(0, FH + 0.06, -D / 2 - 0.25);
    this.#grp.add(pFrame, pDoor, step);
  }

  #chamine() {
    const { W, D } = CASA;
    const cx = W / 4, cz = D / 5;
    const yBase = HouseBuilder.roofY(cz) - 0.1;
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), MaterialLibrary.concreto());
    corpo.position.set(cx, yBase + 0.8, cz); corpo.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.66), MaterialLibrary.metalEscuro());
    cap.position.set(cx, yBase + 1.65, cz);
    this.#grp.add(corpo, cap);
  }

  #jardim() {
    const { W, D } = CASA;
    const matB = new THREE.MeshStandardMaterial({ color: 0x2a6018, roughness: 0.9 });
    for (const [x, z, r] of [
      [-W / 2 - 0.55, -D / 2 - 0.55, 0.52],
      [ W / 2 + 0.55, -D / 2 - 0.55, 0.52],
      [-W / 2 - 0.45,  D / 2 + 0.35, 0.4 ],
    ]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), matB);
      b.position.set(x, r, z); b.castShadow = true; this.#grp.add(b);
    }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 8), MaterialLibrary.madeira());
    trunk.position.set(-W / 2 - 2.4, 1.2, -D / 2 + 0.8); trunk.castShadow = true; this.#grp.add(trunk);
    const copa = new THREE.Mesh(new THREE.SphereGeometry(1.25, 9, 7),
      new THREE.MeshStandardMaterial({ color: 0x1e5c10, roughness: 0.95 }));
    copa.position.set(-W / 2 - 2.4, 3.2, -D / 2 + 0.8); copa.castShadow = true; this.#grp.add(copa);
  }

  #poste() {
    const { W, D } = CASA;
    const px = W / 2 + 5.5, pz = -D * 0.4;
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 7, 8), MaterialLibrary.metal());
    haste.position.set(px, 3.5, pz); haste.castShadow = true; this.#grp.add(haste);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), MaterialLibrary.metal());
    arm.rotation.z = Math.PI / 2; arm.position.set(px - 0.6, 7.15, pz); this.#grp.add(arm);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
    shade.position.set(px - 1.2, 7.0, pz); this.#grp.add(shade);
    this.poleTop.set(px - 1.2, 7.1, pz);
    const wc = new THREE.CatmullRomCurve3([
      v3(px, 7, pz), v3(W / 2 + 3, 6.2, pz * 0.6), v3(W / 2 + 0.15, 5.6, 0),
    ]);
    this.#grp.add(new THREE.Mesh(new THREE.TubeGeometry(wc, 24, 0.018, 5, false), MaterialLibrary.cabo()));
  }

}

class SceneManager {
  #canvas;
  renderer = null;
  scene    = null;
  camera   = null;

  constructor(canvasEl) {
    this.#canvas = canvasEl;
    this.#init();
  }

  #init() {
    const W = this.#canvas.clientWidth  || 480;
    const H = this.#canvas.clientHeight || 320;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.#canvas, antialias: true, alpha: false });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog        = new THREE.FogExp2(0xaad4f0, 0.016);

    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 300);
    this.camera.position.set(0, 12, -22);
    this.camera.lookAt(0, CASA.FH + CASA.H * 0.5, 0);

    this.#setupLights();

    const ro = new ResizeObserver(() => this.#onResize());
    ro.observe(this.#canvas.parentElement ?? this.#canvas);
  }

  #setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffeedd, 0.5));

    const sun = new THREE.DirectionalLight(0xFFF5E0, 2.4);
    sun.position.set(14, 30, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left   = -22;
    sun.shadow.camera.right  =  22;
    sun.shadow.camera.top    =  22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.bias          = -0.0008;
    sun.shadow.normalBias    =  0.018;
    this.scene.add(sun);

    this.scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3a6b28, 0.5));

    const fill = new THREE.DirectionalLight(0xcce8ff, 0.38);
    fill.position.set(-10, 8, 15);
    this.scene.add(fill);
  }

  #onResize() {
    const W = this.#canvas.clientWidth  || 480;
    const H = this.#canvas.clientHeight || 320;
    this.renderer.setSize(W, H);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

/* ─────────────────────────────────────────────────────────────────────
   AnimacaoMontagem — fachada pública
   API: constructor(canvas) · iniciar() · reiniciar() · parar()
   ───────────────────────────────────────────────────────────────────── */
class AnimacaoMontagem {
  #sm  = null;
  #raf = null;

  constructor(canvasEl) {
    if (typeof THREE === 'undefined') {
      console.warn('AnimacaoMontagem: Three.js nao encontrado.');
      return;
    }
    this.#sm = new SceneManager(canvasEl);
    const house = new HouseBuilder(this.#sm.scene);
    house.build();
    requestAnimationFrame(() => this.iniciar());
  }

  iniciar() {
    if (!this.#sm) return;
    this.parar();
    this.#sm.render();
  }

  reiniciar() { this.iniciar(); }

  parar() {
    if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = null; }
  }
}
