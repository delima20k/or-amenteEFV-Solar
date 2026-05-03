'use strict';

/* =====================================================================
   AnimacaoMontagem — Three.js r134
   Arquitetura: SceneManager · CameraController · ModelLoader · AnimationController
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
function clamp01(t)  { return Math.max(0, Math.min(1, t)); }

function easeOutBack(t) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
  quadroPos   = new THREE.Vector3();
  poleTop     = new THREE.Vector3();
  luzJanela1  = null;
  luzJanela2  = null;
  luzPoste    = null;
  luzQuadro   = null;
  caboParede  = null;
  slopeAngle  = 0;
  roofNormal  = [new THREE.Vector3(), new THREE.Vector3()];

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
    this.slopeAngle = Math.atan2(RA, D / 2);
    const s = this.slopeAngle;
    this.roofNormal[0].set(0,  Math.cos(s), -Math.sin(s));
    this.roofNormal[1].set(0,  Math.cos(s),  Math.sin(s));

    this.#solo();
    this.#fundacao();
    this.#paredes();
    this.#telhado();
    this.#aberturas();
    this.#chamine();
    this.#jardim();
    this.#poste();
    this.#quadroEletrico();
    this.#luzes();
    this.#buildCaboParede();

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

  #quadroEletrico() {
    const { W, D, FH, H, WT } = CASA;
    const qx = W / 2 + WT / 2 + 0.01;
    const qy = FH + H * 0.50;
    const qz = D * 0.28;

    /* ── Caixa principal ─────────────────────────────────────────────── */
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.62), MaterialLibrary.metalEscuro());
    caixa.position.set(qx, qy, qz); caixa.scale.set(0, 0, 0); caixa.name = 'quadro';
    this.#grp.add(caixa);

    /* tampa frontal levemente saliente */
    const tampa = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.92, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.4, metalness: 0.7 }));
    tampa.position.set(qx + 0.07, qy, qz); tampa.scale.set(0, 0, 0); tampa.name = 'quadro-tampa';
    this.#grp.add(tampa);

    /* ── Trilho DIN ──────────────────────────────────────────────────── */
    const trilho = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 }));
    trilho.position.set(qx + 0.065, qy + 0.08, qz); trilho.scale.set(0, 0, 0); trilho.name = 'trilho-din';
    this.#grp.add(trilho);

    /* ── 4 Disjuntores sobre o trilho ────────────────────────────────── */
    const dCores = [0xdd2222, 0x2244cc, 0x22aa44, 0x2244cc];
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.22, 0.08),
        new THREE.MeshStandardMaterial({ color: dCores[i], roughness: 0.5, metalness: 0.2,
          emissive: new THREE.Color(0x000000), emissiveIntensity: 0 }));
      d.position.set(qx + 0.065, qy + 0.08, qz - 0.17 + i * 0.115);
      d.scale.set(0, 0, 0); d.name = `disj-${i}`;
      this.#grp.add(d);
    }

    /* ── Chave Geral (DR) — maior, no topo ───────────────────────────── */
    const chave = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.30, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.55 }));
    chave.position.set(qx + 0.065, qy + 0.37, qz); chave.scale.set(0, 0, 0); chave.name = 'chave-geral';
    this.#grp.add(chave);

    /* alavanca da chave — rota na animação (off → on) */
    const alavanca = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.13, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xff2222, roughness: 0.3 }));
    alavanca.position.set(qx + 0.073, qy + 0.44, qz); alavanca.scale.set(0, 0, 0); alavanca.name = 'chave-alavanca';
    this.#grp.add(alavanca);

    /* ── LED de status esférico (vermelho → verde) ───────────────────── */
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(0x880000), emissiveIntensity: 0 }));
    led.position.set(qx + 0.075, qy + 0.30, qz + 0.24); led.name = 'quadro-led';
    this.#grp.add(led);

    /* ── Medidor / LCD ───────────────────────────────────────────────── */
    const medidor = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.10, 0.20),
      new THREE.MeshStandardMaterial({ color: 0x001100, emissive: new THREE.Color(0x003300), emissiveIntensity: 0 }));
    medidor.position.set(qx + 0.075, qy - 0.22, qz); medidor.scale.set(0, 0, 0); medidor.name = 'medidor';
    this.#grp.add(medidor);

    /* luz interna do quadro — acende junto com as luzes da casa */
    this.luzQuadro = new THREE.PointLight(0x44FF88, 0, 2.8);
    this.luzQuadro.position.set(qx + 0.3, qy + 0.1, qz);
    this.#scene.add(this.luzQuadro);

    this.quadroPos.set(qx, qy, qz);
  }

  #luzes() {
    const { W, D, FH, H } = CASA;
    this.luzJanela1 = new THREE.PointLight(0xFFE080, 0, 5.5);
    this.luzJanela1.position.set(-W / 3.2, FH + H * 0.62, -D / 2 + 0.8);
    this.#scene.add(this.luzJanela1);
    this.luzJanela2 = new THREE.PointLight(0xFFE080, 0, 5.5);
    this.luzJanela2.position.set( W / 3.2, FH + H * 0.62, -D / 2 + 0.8);
    this.#scene.add(this.luzJanela2);
    this.luzPoste = new THREE.SpotLight(0xFFF8CC, 0, 18, Math.PI / 6, 0.35);
    this.luzPoste.position.copy(this.poleTop);
    this.luzPoste.target.position.set(this.poleTop.x - 3, 0, this.poleTop.z);
    this.#scene.add(this.luzPoste, this.luzPoste.target);
  }

  #buildCaboParede() {
    const { W, D, FH, H, WT } = CASA;
    const qPos = this.quadroPos;
    const xExt = W / 2 + WT / 2 + 0.04;
    /* pontos que definem o percurso exato pela face exterior da parede direita */
    const pts = [
      v3(xExt, FH + H + 0.08, -D * 0.22),
      v3(xExt, FH + H * 0.80,  D * 0.00),
      v3(xExt, FH + H * 0.60,  qPos.z * 0.55),
      v3(xExt, qPos.y + 0.02,  qPos.z),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo   = new THREE.TubeGeometry(curve, 64, 0.022, 6, false);
    geo.setDrawRange(0, 0);
    const mesh  = new THREE.Mesh(geo, MaterialLibrary.cabo());
    mesh.castShadow = true;
    this.#grp.add(mesh);

    /* abraçadeiras metálicas nos pontos de dobra — aparecem junto com o cabo */
    const matAbr       = MaterialLibrary.metalEscuro();
    const abracadeiras = pts.map(pt => {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.055), matAbr);
      a.position.copy(pt); a.visible = false;
      this.#grp.add(a); return a;
    });

    /* luz que percorre o cabo durante o acionamento elétrico */
    const flowLight = new THREE.PointLight(0xFF7700, 0, 3.5);
    this.#scene.add(flowLight);

    this.caboParede = { mesh, curve, totalCount: geo.index.count, abracadeiras, flowLight };
  }

  animarCaboParede(p) {
    if (!this.caboParede) return;
    const pC = clamp01(p);
    this.caboParede.mesh.geometry.setDrawRange(0, Math.round(pC * this.caboParede.totalCount));
    /* abraçadeiras aparecem conforme o cabo chega em cada ponto de dobra */
    const n = this.caboParede.abracadeiras.length;
    for (let i = 0; i < n; i++) {
      this.caboParede.abracadeiras[i].visible = pC >= (i + 1) / (n + 1);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   SolarInstaller — trilhos, cabos, inversores e painéis por água.
   Todos os objetos usam HouseBuilder.roofPoint() como fonte de verdade.
   ───────────────────────────────────────────────────────────────────── */
class SolarInstaller {
  #scene;
  #side;
  #grp;
  #slopeAngle;
  #normal;

  #trilhos    = [];
  #cabos      = [];
  #inversores = [];
  #paineis    = [];
  #curves     = [];

  static COLS = 3;
  static ROWS = 2;

  constructor(scene, side, houseRef) {
    this.#scene      = scene;
    this.#side       = side;
    this.#grp        = new THREE.Group();
    this.#slopeAngle = houseRef.slopeAngle;
    this.#normal     = houseRef.roofNormal[side === 'front' ? 0 : 1].clone();
    scene.add(this.#grp);
  }

  #sz()      { return this.#side === 'front' ? -1 : 1; }
  #zCenter() { return this.#sz() * CASA.D / 4; }

  build() {
    this.#buildTrilhos();
    this.#buildCabos();
    this.#buildInversores();
    this.#buildPaineis();
  }

  #buildTrilhos() {
    const { W, D } = CASA;
    const COLS = SolarInstaller.COLS;
    const ROWS = SolarInstaller.ROWS;
    const mat  = MaterialLibrary.aluminio();
    const pH   = (D * 0.32) / ROWS - 0.05;
    const step = (W - 1.2) / (COLS - 1);

    for (let c = 0; c < COLS; c++) {
      const x  = -W / 2 + 0.6 + c * step;
      const zT = this.#sz() * (D / 4 + (ROWS / 2) * (pH + 0.06) * 0.55);
      const zB = this.#sz() * (D / 4 - (ROWS / 2) * (pH + 0.06) * 0.55);
      const pA = HouseBuilder.roofPoint(x, zT, 0.04);
      const pM = HouseBuilder.roofPoint(x, this.#zCenter(), 0.04);
      const pB = HouseBuilder.roofPoint(x, zB, 0.04);
      const curve = new THREE.CatmullRomCurve3([pA, pM, pB]);
      const geo   = new THREE.TubeGeometry(curve, 20, 0.025, 6, false);
      const mesh  = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.scale.y = 0;  /* escala Y=0 → cresce para 1 durante animação */
      this.#trilhos.push(mesh);
      this.#grp.add(mesh);
    }
  }

  #buildCabos() {
    const { W, D } = CASA;

    for (const rowFrac of [0.3, 0.7]) {
      const zC  = this.#sz() * (D * rowFrac * 0.45);
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const x = -W / 2 + 0.3 + i * ((W - 0.6) / 8);
        pts.push(HouseBuilder.roofPoint(x, zC, 0.06));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      this.#curves.push(curve);
      const geo   = new THREE.TubeGeometry(curve, 40, 0.018, 5, false);
      geo.setDrawRange(0, 0);
      const mesh  = new THREE.Mesh(geo, MaterialLibrary.cabo());
      this.#cabos.push({ mesh, totalCount: geo.index.count });
      this.#grp.add(mesh);
    }

    const { FH, H } = CASA;
    const xDrop = W / 2 - 0.3;
    const zDrop = this.#sz() * (D / 2 - 0.35);
    const zInv  = this.#sz() * (D / 2 - 0.38);
    const dropCurve = new THREE.CatmullRomCurve3([
      HouseBuilder.roofPoint(xDrop, this.#zCenter(), 0.06),
      v3(xDrop, FH + H * 0.82, zDrop * 0.85),
      v3(W / 2 - 0.28, FH + H * 0.52, zInv),
    ]);
    this.#curves.push(dropCurve);
    const dropGeo = new THREE.TubeGeometry(dropCurve, 24, 0.018, 5, false);
    dropGeo.setDrawRange(0, 0);
    const dropMesh = new THREE.Mesh(dropGeo, MaterialLibrary.cabo());
    this.#cabos.push({ mesh: dropMesh, totalCount: dropGeo.index.count });
    this.#grp.add(dropMesh);
  }

  #buildInversores() {
    const { W, D, FH, H } = CASA;
    const invX = W / 2 - 0.01;
    const invZ = this.#sz() * (D / 2 - 0.38);
    const invY = FH + H * 0.46;

    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.34), MaterialLibrary.inversor());
    corpo.position.set(invX, invY, invZ); corpo.rotation.y = -Math.PI / 2; corpo.scale.y = 0;
    corpo.name = `inversor-${this.#side}`;
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x00aa44, emissive: 0x003311, emissiveIntensity: 0.8 }));
    lcd.position.set(invX + 0.09, invY + 0.1, invZ); lcd.rotation.y = Math.PI / 2;
    this.#inversores.push({ corpo, lcd });
    this.#grp.add(corpo, lcd);
  }

  #buildPaineis() {
    const { W, D } = CASA;
    const COLS = SolarInstaller.COLS;
    const ROWS = SolarInstaller.ROWS;
    const pW   = (W - 1.3) / COLS - 0.06;
    const pH   = (D * 0.32) / ROWS - 0.05;
    const mat  = MaterialLibrary.painelEmissivo();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const xC   = -W / 2 + 0.65 + (c + 0.5) * ((W - 1.3) / COLS);
        const zOff = (r - (ROWS - 1) / 2) * (pH + 0.06);
        const zC   = this.#sz() * (D / 4) + this.#sz() * zOff;
        const alvo = HouseBuilder.roofPoint(xC, zC, 0.03);

        const panel = new THREE.Mesh(new THREE.BoxGeometry(pW, 0.04, pH), mat.clone());
        panel.rotation.x = this.#sz() > 0
          ? -(Math.PI / 2 - this.#slopeAngle)
          :  (Math.PI / 2 - this.#slopeAngle);
        panel.position.copy(alvo).add(v3(0, 10, 0));
        panel.castShadow = panel.receiveShadow = true;

        this.#paineis.push({ mesh: panel, alvo, delay: (c + r * COLS) / (COLS * ROWS) });
        this.#grp.add(panel);
      }
    }
  }

  /* ── Animadores ── */

  animarTrilhos(p) {
    const t = easeOutBack(clamp01(p));
    for (const m of this.#trilhos) m.scale.y = t;
  }

  animarCabos(p) {
    for (const c of this.#cabos)
      c.mesh.geometry.setDrawRange(0, Math.round(clamp01(p) * c.totalCount));
  }

  animarInversores(p) {
    const t = easeOutBack(clamp01(p));
    for (const inv of this.#inversores) inv.corpo.scale.y = t;
  }

  animarPaineis(p) {
    const N = this.#paineis.length;
    for (const item of this.#paineis) {
      const local = clamp01((p - item.delay) / (1 - item.delay / (N + 0.01)));
      if (local <= 0) continue;
      const spring = Math.exp(-5 * local * 2) * Math.cos(9 * local * 2);
      item.mesh.position.x = item.alvo.x;
      item.mesh.position.y = item.alvo.y + (1 - easeInOut(local)) * 10 + spring * 0.25;
      item.mesh.position.z = item.alvo.z;
    }
  }

  ativarEmissivo(intensity) {
    for (const item of this.#paineis) item.mesh.material.emissiveIntensity = intensity;
  }

  getCurves() { return [...this.#curves]; }
}

/* ─────────────────────────────────────────────────────────────────────
   EnergyFlow — orbs de energia percorrendo os cabos
   ───────────────────────────────────────────────────────────────────── */
class EnergyFlow {
  #scene;
  #curves    = [];
  #caboCurve = null;
  #flowLight = null;
  #orbs      = [];

  constructor(scene) { this.#scene = scene; }

  addCurves(curves) { for (const c of curves) this.#curves.push(c); }

  /* registra a curva + luz do cabo da parede para o fluxo elétrico */
  addCaboCurve(caboParedeRef) {
    this.#caboCurve = caboParedeRef.curve;
    this.#flowLight = caboParedeRef.flowLight;
  }

  build() {
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xFF9900, 0, 2.5);
      this.#scene.add(light);
      this.#orbs.push({ light, offset: i / 4 });
    }
  }

  tick(p) {
    if (!this.#curves.length) return;
    const n = this.#curves.length;
    for (const orb of this.#orbs) {
      const t      = (p + orb.offset) % 1;
      const idx    = Math.min(Math.floor(t * n), n - 1);
      const localT = (t * n) % 1;
      const pos    = this.#curves[idx].getPoint(localT);
      orb.light.position.copy(pos);
      orb.light.intensity = 2.5 * Math.sin(t * Math.PI);
    }
  }

  reset() {
    for (const orb of this.#orbs) orb.light.intensity = 0;
    if (this.#flowLight) this.#flowLight.intensity = 0;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   SoundController — efeitos sonoros via Web Audio API
   ───────────────────────────────────────────────────────────────────── */
class SoundController {
  #ctx = null;

  #getCtx() {
    if (!this.#ctx) this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
    return this.#ctx;
  }

  #beep(freq, endFreq, gain, duration) {
    try {
      const ctx = this.#getCtx();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
      vol.gain.setValueAtTime(gain, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(vol); vol.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration);
    } catch (_) { /* browser pode bloquear */ }
  }

  tocarEncaixe()  { this.#beep(820,  440, 0.12, 0.18); }
  tocarEletrico() { this.#beep(120,   80, 0.08, 0.35); }
  tocarLuz()      { this.#beep(1200, 600, 0.06, 0.22); }

  dispose() { this.#ctx?.close(); this.#ctx = null; }
}

/* ─────────────────────────────────────────────────────────────────────
   ModelLoader — orquestra HouseBuilder + dois SolarInstaller
   ───────────────────────────────────────────────────────────────────── */
class ModelLoader {
  #scene;
  house  = null;
  solar1 = null;
  solar2 = null;

  constructor(scene) { this.#scene = scene; }

  load() {
    this.house  = new HouseBuilder(this.#scene);
    this.house.build();
    this.solar1 = new SolarInstaller(this.#scene, 'front', this.house);
    this.solar1.build();
    this.solar2 = new SolarInstaller(this.#scene, 'back',  this.house);
    this.solar2.build();
  }
}

/* ─────────────────────────────────────────────────────────────────────
   CameraController — lerp acumulativo, sem saltos entre estágios
   ───────────────────────────────────────────────────────────────────── */
class CameraController {
  #camera;
  #pos;
  #tgt;
  #targetPos;
  #targetTgt;
  #orbitAngle = 0;
  #orbiting   = false;
  #smooth     = 0.06;

  constructor(camera) {
    this.#camera    = camera;
    this.#pos       = camera.position.clone();
    this.#tgt       = v3(0, 4, 0);
    this.#targetPos = this.#pos.clone();
    this.#targetTgt = this.#tgt.clone();
  }

  goTo(pos, look, smooth = 0.06) {
    this.#targetPos.copy(pos);
    this.#targetTgt.copy(look);
    this.#smooth   = smooth;
    this.#orbiting = false;
  }

  startOrbit() {
    this.#orbitAngle = Math.atan2(this.#pos.z, this.#pos.x);
    this.#orbiting   = true;
  }

  /* câmera acompanha um ponto 3D em movimento — usado para seguir o cabo descendo */
  followPoint(pt, dx = 1.8, dy = 0.4) {
    this.#targetPos.set(pt.x + dx, pt.y + dy, pt.z + 0.15);
    this.#targetTgt.copy(pt);
    this.#smooth   = 0.12;
    this.#orbiting = false;
  }

  /* câmera acompanha um ponto 3D móvel — usado para seguir o cabo descendo */
  followPoint(pt, dx = 1.8, dy = 0.4) {
    this.#targetPos.set(pt.x + dx, pt.y + dy, pt.z + 0.15);
    this.#targetTgt.copy(pt);
    this.#smooth   = 0.12;
    this.#orbiting = false;
  }

  update(dt) {
    if (this.#orbiting) {
      this.#orbitAngle += dt * 0.00022;
      const R = 20, H = 12;
      this.#targetPos.set(
        R * Math.cos(this.#orbitAngle),
        H + Math.sin(this.#orbitAngle * 0.35) * 1.2,
        R * Math.sin(this.#orbitAngle)
      );
      const { FH, H: CH, RA } = CASA;
      this.#targetTgt.set(0, FH + CH * 0.5 + RA * 0.2, 0);
    }
    this.#pos.lerp(this.#targetPos, this.#smooth);
    this.#tgt.lerp(this.#targetTgt, this.#smooth);
    this.#camera.position.copy(this.#pos);
    this.#camera.lookAt(this.#tgt);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   AnimationController — 22 estágios cinematográficos
   ───────────────────────────────────────────────────────────────────── */
class AnimationController {
  static #STAGES = [
    { dur: 2200 }, { dur: 1500 }, { dur: 1200 }, { dur:  800 }, { dur: 2800 }, //  0-4
    { dur: 1000 }, { dur: 1800 }, { dur: 1500 }, { dur: 1200 }, { dur:  800 }, //  5-9
    { dur: 2800 }, { dur: 1000 }, { dur: 2200 }, { dur: 1000 }, { dur: 2400 }, // 10-14
    { dur:  900 }, { dur: 1000 }, { dur: 1200 }, { dur: 1000 }, { dur: 2000 }, // 15-19
    { dur: 1200 }, { dur: 1600 }, { dur: 2200 }, { dur: Infinity },            // 20-23
  ];

  #models;
  #cam;
  #scene;
  #ef;
  #sound;
  #stageCallbacks = new Map();
  #stage          = 0;
  #t              = 0;
  #elapsed        = 0;
  #glow1          = null;
  #glow2          = null;
  #wp             = null;

  constructor(scene, models, cam, ef, sound) {
    this.#scene  = scene;
    this.#models = models;
    this.#cam    = cam;
    this.#ef     = ef   ?? null;
    this.#sound  = sound ?? null;
    this.#criarGlows();
    this.#configurarWaypoints();
  }

  onStageEnter(stage, fn) { this.#stageCallbacks.set(stage, fn); }

  #criarGlows() {
    const { FH, H, RA, D } = CASA;
    this.#glow1 = new THREE.PointLight(0xFFDD55, 0, 8);
    this.#glow1.position.set(0, FH + H + RA * 0.55, -D / 4);
    this.#scene.add(this.#glow1);
    this.#glow2 = new THREE.PointLight(0xFFDD55, 0, 8);
    this.#glow2.position.set(0, FH + H + RA * 0.55,  D / 4);
    this.#scene.add(this.#glow2);
  }

  #configurarWaypoints() {
    const { W, D, FH, H, RA, WT } = CASA;
    const h     = this.#models.house;
    const r1    = h.roof1Center.clone();
    const r2    = h.roof2Center.clone();
    const q     = h.quadroPos.clone();
    const ridge = v3(0, FH + H + RA + 0.3, 0);
    const wS    = W / 2 + 3.8;

    /* posição do topo da parede direita onde o cabo sai do beiral */
    const xExt  = W / 2 + WT / 2 + 0.18;
    const topoP = v3(xExt, FH + H + 0.5, -D * 0.22);

    this.#wp = {
      0:  { pos: v3(0, 26, -22),                                look: v3(0, FH + H, 0),        smooth: 0.04 },
      1:  { pos: v3(-4, 13, -15),                               look: r1,                       smooth: 0.07 },
      2:  { pos: v3(-2, 11, -13),                               look: r1,                       smooth: 0.07 },
      3:  { pos: v3(wS - 1, FH + H, -D * 0.4),                  look: r1,                       smooth: 0.08 },
      4:  { pos: v3(wS - 1, FH + H * 1.1, -D * 0.4),            look: r1,                       smooth: 0.07 },
      5:  { pos: v3(wS - 1, FH + H * 1.1, -D * 0.4),            look: r1,                       smooth: 0.05 },
      6:  { pos: v3(-2, 12, 0),                                  look: ridge,                    smooth: 0.06 },
      7:  { pos: v3(-4, 13, 15),                                 look: r2,                       smooth: 0.07 },
      8:  { pos: v3(-2, 11, 13),                                 look: r2,                       smooth: 0.07 },
      9:  { pos: v3(wS - 1, FH + H, D * 0.4),                   look: r2,                       smooth: 0.08 },
      10: { pos: v3(wS - 1, FH + H * 1.1, D * 0.4),             look: r2,                       smooth: 0.07 },
      11: { pos: v3(wS - 1, FH + H * 1.1, D * 0.4),             look: r2,                       smooth: 0.05 },
      /* 12: energy-telhado — câmera lateral para ver os dois lados */
      12: { pos: v3(wS - 0.5, FH + H * 1.2, 0),                 look: ridge,                    smooth: 0.05 },
      /* 13: câmera sobe ao topo da parede onde o cabo começa a descer */
      13: { pos: v3(xExt + 1.8, FH + H + 0.8, -D * 0.22 + 0.2), look: topoP,                    smooth: 0.08 },
      /* 14: DINÂMICO — controlado por followPoint() no dispatch */
      /* 15: câmera chega no quadro */
      15: { pos: v3(W / 2 + 2.2, FH + H * 0.5, q.z),            look: q,                        smooth: 0.09 },
      /* 16: quadro abre — câmera bem perto */
      16: { pos: v3(W / 2 + 1.6, q.y + 0.15, q.z + 0.2),        look: q,                        smooth: 0.09 },
      /* 17: disjuntor liga */
      17: { pos: v3(W / 2 + 1.4, q.y + 0.25, q.z + 0.15),       look: q,                        smooth: 0.08 },
      /* 18: luzes acendem — câmera recua levemente */
      18: { pos: v3(W / 2 + 2.5, FH + H * 0.6, q.z + 0.5),      look: q,                        smooth: 0.07 },
      /* 19: órbita — startOrbit() via callback */
      19: { pos: v3(0, 26, -22),                                 look: v3(0, FH + H * 0.6, 0),  smooth: 0.04 },
      /* 20: emissivo pulsa */
      20: { pos: v3(-3, 14, -14),                                look: r1,                       smooth: 0.06 },
      /* 21: wide-shot */
      21: { pos: v3(0, 11, -22),                                 look: v3(0, FH + H * 0.5, 0),  smooth: 0.05 },
      /* 22: branding */
      22: { pos: v3(0, 11, -22),                                 look: v3(0, FH + H * 0.5, 0),  smooth: 0.04 },
    };
  }

  reset() { this.#stage = 0; this.#t = 0; this.#elapsed = 0; }

  tick(dt) {
    const dur = AnimationController.#STAGES[this.#stage]?.dur ?? Infinity;
    if (isFinite(dur)) {
      this.#elapsed += dt;
      this.#t = Math.min(this.#elapsed / dur, 1);
    }

    const wp = this.#wp?.[this.#stage];
    if (wp) this.#cam.goTo(wp.pos, wp.look, wp.smooth);
    this.#cam.update(dt);
    this.#dispatch();

    if (isFinite(dur) && this.#elapsed >= dur) {
      const next = this.#stage + 1;
      this.#stage   = next;
      this.#elapsed = 0;
      this.#t       = 0;
      this.#stageCallbacks.get(next)?.();
    }
  }

  #dispatch() {
    const s = this.#models, p = this.#t;

    switch (this.#stage) {
      case 0:  break;

      /* ── Água 1 (frente) ──────────────────────────────────────────── */
      case 1:  s.solar1.animarTrilhos(p); break;
      case 2:  s.solar1.animarCabos(p); break;
      case 3:  s.solar1.animarInversores(p); break;
      case 4:  s.solar1.animarPaineis(p); break;
      case 5:
        this.#glow1.intensity = (Math.sin(p * Math.PI * 3) * 0.5 + 0.5) * 2.2;
        s.solar1.ativarEmissivo(Math.sin(p * Math.PI) * 0.65);
        break;
      case 6:
        this.#glow1.intensity = Math.max(0, 1.8 - p * 3.5);
        break;

      /* ── Água 2 (fundo) ───────────────────────────────────────────── */
      case 7:  s.solar2.animarTrilhos(p); break;
      case 8:  s.solar2.animarCabos(p); break;
      case 9:  s.solar2.animarInversores(p); break;
      case 10: s.solar2.animarPaineis(p); break;
      case 11:
        this.#glow2.intensity = (Math.sin(p * Math.PI * 3) * 0.5 + 0.5) * 2.2;
        s.solar2.ativarEmissivo(Math.sin(p * Math.PI) * 0.65);
        break;

      /* ── 12: Energy Flow pelo telhado — ambas as águas ────────────── */
      case 12:
        this.#glow2.intensity = Math.max(0, 1.8 - p * 3.5);
        s.solar1.ativarEmissivo(0.5 + Math.sin(p * Math.PI * 5) * 0.35);
        s.solar2.ativarEmissivo(0.5 + Math.sin(p * Math.PI * 5 + 0.5) * 0.35);
        this.#ef?.tickTelhado(p);
        this.#glow1.intensity = 0.8 + Math.sin(p * Math.PI * 4) * 0.5;
        break;

      /* ── 13: Câmera sobe ao topo da parede ───────────────────────── */
      case 13:
        this.#ef?.reset();
        this.#glow1.intensity = Math.max(0, 1.2 - p * 2);
        break;

      /* ── 14: Cabo desce — câmera acompanha em tempo real ─────────── */
      case 14: {
        s.house.animarCaboParede(p);
        const cabo = s.house.caboParede;
        if (cabo?.curve) {
          const pt = cabo.curve.getPoint(easeInOut(clamp01(p)));
          this.#cam.followPoint(pt, 1.8, 0.35);
        }
        break;
      }

      /* ── 15: Câmera chega no quadro (waypoint estático) ──────────── */
      case 15: break;

      /* ── 16: Quadro elétrico abre com todos os componentes ─────────── */
      case 16: {
        for (const nome of ['quadro', 'quadro-tampa', 'trilho-din', 'chave-geral', 'chave-alavanca', 'medidor']) {
          const obj = this.#scene.getObjectByName(nome);
          if (obj) { const sc = easeOutBack(clamp01(p)); obj.scale.set(sc, sc, sc); }
        }
        for (let i = 0; i < 4; i++) {
          const d = this.#scene.getObjectByName(`disj-${i}`);
          if (d) { const sc = easeOutBack(clamp01((p - i * 0.18) / 0.4)); d.scale.set(sc, sc, sc); }
        }
        const led16 = this.#scene.getObjectByName('quadro-led');
        if (led16) {
          led16.material.emissive.setHex(0x880000);
          led16.material.emissiveIntensity = (Math.sin(p * Math.PI * 6) * 0.5 + 0.5) * 1.2;
        }
        break;
      }

      /* ── 17: Disjuntor liga — fluxo luminoso pelo cabo ───────────── */
      case 17: {
        const alavanc = this.#scene.getObjectByName('chave-alavanca');
        if (alavanc) alavanc.rotation.z = -easeInOut(p) * Math.PI * 0.45;
        this.#ef?.tickCabo(p);
        for (let i = 0; i < 4; i++) {
          const d     = this.#scene.getObjectByName(`disj-${i}`);
          const local = clamp01((p - i * 0.15) / 0.45);
          if (d) { d.material.emissive.setHex(0x00cc44); d.material.emissiveIntensity = easeInOut(local) * 0.9; }
        }
        const led17 = this.#scene.getObjectByName('quadro-led');
        if (led17) {
          const g = easeInOut(p);
          led17.material.emissive.setRGB(0.53 * (1 - g), 0.53 * g * 2, 0.27 * g);
          led17.material.emissiveIntensity = 1.5 + Math.sin(p * Math.PI * 3) * 0.5;
        }
        const med = this.#scene.getObjectByName('medidor');
        if (med) med.material.emissiveIntensity = easeInOut(p) * 1.8;
        break;
      }

      /* ── 18: Luzes da casa acendem ───────────────────────────────── */
      case 18: {
        const il = easeInOut(p) * 2.2;
        const h  = s.house;
        if (h.luzJanela1) h.luzJanela1.intensity = il;
        if (h.luzJanela2) h.luzJanela2.intensity = il;
        if (h.luzPoste)   h.luzPoste.intensity   = easeInOut(p) * 2.8;
        if (h.luzQuadro)  h.luzQuadro.intensity  = easeInOut(p) * 1.4;
        const led18 = this.#scene.getObjectByName('quadro-led');
        if (led18) { led18.material.emissive.setHex(0x00FF44); led18.material.emissiveIntensity = 1.8; }
        break;
      }

      /* ── 19: Órbita (startOrbit via callback) ────────────────────── */
      case 19: break;

      /* ── 20: Emissivo pulsa — plano geral ────────────────────────── */
      case 20:
        s.solar1.ativarEmissivo(0.55 + Math.sin(p * Math.PI * 4) * 0.35);
        s.solar2.ativarEmissivo(0.55 + Math.sin(p * Math.PI * 4 + 0.6) * 0.35);
        this.#glow1.intensity = 0.8 + Math.sin(p * Math.PI * 3) * 0.4;
        this.#glow2.intensity = 0.8 + Math.sin(p * Math.PI * 3 + 0.8) * 0.4;
        break;

      /* ── 21: Wide-shot final ─────────────────────────────────────── */
      case 21: break;

      /* ── 22: Branding ────────────────────────────────────────────── */
      case 22: break;

      /* ── 23: Estático ────────────────────────────────────────────── */
      case 23: break;
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   SceneManager — renderer, scene, câmera, iluminação e resize
   ───────────────────────────────────────────────────────────────────── */
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
    this.camera.position.set(0, 26, -22);

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
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

/* ─────────────────────────────────────────────────────────────────────
   AnimacaoMontagem — fachada pública
   API: constructor(canvas) · iniciar() · reiniciar() · parar()
   ───────────────────────────────────────────────────────────────────── */
class AnimacaoMontagem {
  #sm         = null;
  #ml         = null;
  #cc         = null;
  #ac         = null;
  #ef         = null;
  #sound      = null;
  #raf        = null;
  #tsUlt      = 0;
  #brandingEl = null;

  constructor(canvasEl) {
    if (typeof THREE === 'undefined') {
      console.warn('AnimacaoMontagem: Three.js não encontrado.');
      return;
    }
    this.#sm = new SceneManager(canvasEl);
    this.#ml = new ModelLoader(this.#sm.scene);
    this.#ml.load();
    this.#cc = new CameraController(this.#sm.camera);
    this.#ef = new EnergyFlow(this.#sm.scene);
    this.#ef.addCurves(this.#ml.solar1.getCurves());
    this.#ef.addCurves(this.#ml.solar2.getCurves());
    this.#ef.build();
    if (this.#ml.house.caboParede) this.#ef.addCaboCurve(this.#ml.house.caboParede);
    this.#sound = new SoundController();
    this.#ac = new AnimationController(this.#sm.scene, this.#ml, this.#cc, this.#ef, this.#sound);
    this.#bindCallbacks(canvasEl);
    requestAnimationFrame(() => this.iniciar());
  }

  #bindCallbacks(canvasEl) {
    this.#ac.onStageEnter(4,  () => this.#sound.tocarEncaixe());
    this.#ac.onStageEnter(10, () => this.#sound.tocarEncaixe());
    this.#ac.onStageEnter(14, () => this.#sound.tocarEletrico());
    this.#ac.onStageEnter(17, () => this.#sound.tocarEletrico());
    this.#ac.onStageEnter(19, () => this.#cc.startOrbit());
    this.#ac.onStageEnter(22, () => this.#mostrarBranding(canvasEl));
    this.#ac.onStageEnter(23, () => { this.#sm.render(); this.parar(); });
  }

  #mostrarBranding(canvasEl) {
    const container = canvasEl.parentElement;
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'anim-branding';
    el.innerHTML =
      '<div class="anim-branding__logo">EFV Solar</div>' +
      '<div class="anim-branding__tagline">Iluminando o seu futuro</div>' +
      '<button class="anim-branding__btn" type="button">Fa\u00e7a seu or\u00e7amento</button>';
    el.querySelector('.anim-branding__btn').addEventListener('click', () => {
      document.getElementById('btn-novo-orcamento')?.click();
    });
    container.appendChild(el);
    this.#brandingEl = el;
    void el.offsetWidth;
    el.classList.add('anim-branding--visivel');
    this.#sound.tocarLuz();
  }

  #removerBranding() {
    if (this.#brandingEl) { this.#brandingEl.remove(); this.#brandingEl = null; }
  }

  iniciar() {
    if (!this.#sm) return;
    this.parar();
    this.#removerBranding();
    this.#ef?.reset();
    this.#ac.reset();
    this.#tsUlt = performance.now();
    this.#raf   = requestAnimationFrame(ts => this.#loop(ts));
  }

  reiniciar() { this.iniciar(); }

  parar() {
    if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = null; }
  }

  #loop(ts) {
    const dt = Math.min(ts - this.#tsUlt, 50);
    this.#tsUlt = ts;
    this.#ac.tick(dt);
    this.#sm.render();
    this.#raf = requestAnimationFrame(t => this.#loop(t));
  }
}
