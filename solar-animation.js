'use strict';

/* =====================================================================
   AnimacaoMontagem — Three.js r134
   Arquitetura: SceneManager · CameraController · ModelLoader · AnimationController
   API pública: constructor(canvas) · iniciar() · reiniciar() · parar()
   ===================================================================== */

/* ─────────────────────────────────────────────────────────────────────
   CONSTANTES GLOBAIS DA CENA
   ───────────────────────────────────────────────────────────────────── */
const CASA = Object.freeze({
  W:  7,     // largura (X)
  D:  10,    // profundidade (Z)
  H:  3.8,   // altura das paredes
  RA: 2.2,   // altura do telhado (ridge)
  FH: 0.5,   // fundação
  EV: 0.45,  // beiral
});

/* ─────────────────────────────────────────────────────────────────────
   MaterialLibrary — texturas PBR procedurais (Canvas 2D)
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
      ctx.fillStyle = '#7a2e1a';
      ctx.fillRect(0, 0, w, h);
      const cols = 6, rows = 8;
      const tW = w / cols, tH = h / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (tW * 0.5);
        for (let c = 0; c < cols + 1; c++) {
          const x = c * tW - off, y = r * tH;
          const hue = 10 + (Math.sin(r * 7 + c * 13) * 5);
          const lit = 28 + (Math.sin(r * 3 + c * 11) * 6);
          const g = ctx.createLinearGradient(x, y, x, y + tH);
          g.addColorStop(0,    `hsl(${hue},65%,${lit + 12}%)`);
          g.addColorStop(0.45, `hsl(${hue},60%,${lit}%)`);
          g.addColorStop(1,    `hsl(${hue},55%,${lit - 8}%)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x + tW * 0.5, y + tH * 0.62, tW * 0.46, tH * 0.54, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    });
    tex.repeat.set(6, 4);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.04 });
  }

  static reboco() {
    const tex = MaterialLibrary.#tex('reboco', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#e8e0d2';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = Math.random() * 2.5;
        const v = Math.random() * 20 - 10;
        ctx.fillStyle = `rgba(${140 + v | 0},${130 + v | 0},${115 + v | 0},0.18)`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    tex.repeat.set(3, 3);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.0 });
  }

  static painel() {
    const tex = MaterialLibrary.#tex('painel', 512, 320, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0a1628');
      bg.addColorStop(1, '#0d1f3c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const cols = 8, rows = 5;
      const cW = (w - 20) / cols, cH = (h - 20) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 10 + c * cW, y = 10 + r * cH;
          const cellBg = ctx.createLinearGradient(x, y, x + cW, y + cH);
          cellBg.addColorStop(0, '#0f2248');
          cellBg.addColorStop(1, '#0a1830');
          ctx.fillStyle = cellBg;
          ctx.fillRect(x + 1.5, y + 1.5, cW - 3, cH - 3);
          const shine = ctx.createLinearGradient(x, y, x + cW * 0.6, y + cH * 0.6);
          shine.addColorStop(0, 'rgba(100,200,255,0.10)');
          shine.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = shine;
          ctx.fillRect(x + 1.5, y + 1.5, cW - 3, cH - 3);
        }
      }
      ctx.strokeStyle = '#8899aa';
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
    });
    return new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.25, metalness: 0.65, color: 0x182844,
    });
  }

  static painelEmissivo() {
    const m = MaterialLibrary.painel();
    m.emissive = new THREE.Color(0x1a3a88);
    m.emissiveIntensity = 0.0;
    return m;
  }

  static metal()      { return new THREE.MeshStandardMaterial({ color: 0xb0c0d0, roughness: 0.18, metalness: 0.92 }); }
  static metalEscuro(){ return new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.28, metalness: 0.88 }); }
  static aluminio()   { return new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.15, metalness: 0.95 }); }
  static inversor()   { return new THREE.MeshStandardMaterial({ color: 0x1e2e1e, roughness: 0.45, metalness: 0.5  }); }
  static cabo()       { return new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.72, metalness: 0.15 }); }

  static relva() {
    const tex = MaterialLibrary.#tex('relva', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2f5a1e';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 8000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const hue = 95 + Math.random() * 35;
        const sat = 40 + Math.random() * 25;
        const lit = 18 + Math.random() * 18;
        ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
        ctx.fillRect(x, y, 2.5, 2.5);
      }
    });
    tex.repeat.set(12, 12);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 });
  }

  static calcada() {
    const tex = MaterialLibrary.#tex('calcada', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c8bfb0';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a89880';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });
    tex.repeat.set(4, 4);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
  }

  static vidro() {
    return new THREE.MeshStandardMaterial({
      color: 0x88ccee, roughness: 0.04, metalness: 0.05,
      transparent: true, opacity: 0.45,
    });
  }

  static madeira() {
    const tex = MaterialLibrary.#tex('madeira', 256, 256, (ctx, w, h) => {
      for (let y = 0; y < h; y++) {
        const hue = 22 + Math.sin(y * 0.15) * 4;
        const lit = 22 + Math.sin(y * 0.08) * 6;
        ctx.fillStyle = `hsl(${hue},50%,${lit}%)`;
        ctx.fillRect(0, y, w, 1);
      }
    });
    tex.repeat.set(2, 3);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.0 });
  }

  static concreto() {
    const tex = MaterialLibrary.#tex('concreto', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c0b8a8';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const v = Math.random() * 30 - 15;
        ctx.fillStyle = `rgba(${140 + v | 0},${132 + v | 0},${118 + v | 0},0.2)`;
        ctx.fillRect(x, y, 3, 3);
      }
    });
    tex.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0.0 });
  }

  static dispose() {
    for (const t of MaterialLibrary.#cache.values()) t.dispose();
    MaterialLibrary.#cache.clear();
  }
}

/* ─────────────────────────────────────────────────────────────────────
   HouseBuilder — monta casa 3D realista
   ───────────────────────────────────────────────────────────────────── */
class HouseBuilder {
  #scene;
  #group;

  roof1Center = new THREE.Vector3();
  roof2Center = new THREE.Vector3();
  quadroPos   = new THREE.Vector3();
  poleTop     = new THREE.Vector3();
  luzJanela1  = null;
  luzJanela2  = null;
  luzPoste    = null;
  caboParede  = null;

  constructor(scene) {
    this.#scene = scene;
    this.#group = new THREE.Group();
    scene.add(this.#group);
  }

  build() {
    this.#solo();
    this.#fundacao();
    this.#paredes();
    this.#telhado();
    this.#beiral();
    this.#aberturas();
    this.#chamine();
    this.#jardim();
    this.#poste();
    this.#quadroEletrico();
    this.#luzes();
    this.#calcularRefs();
    this.#caboParede();
  }

  #solo() {
    const g = new THREE.Group();
    const campo = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), MaterialLibrary.relva());
    campo.rotation.x = -Math.PI / 2;
    campo.receiveShadow = true;
    g.add(campo);
    const calc = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 6), MaterialLibrary.calcada());
    calc.position.set(0, 0.04, -CASA.D / 2 - 3.5);
    calc.receiveShadow = true;
    g.add(calc);
    this.#group.add(g);
  }

  #fundacao() {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(CASA.W + 0.4, CASA.FH, CASA.D + 0.4),
      MaterialLibrary.concreto()
    );
    m.position.y = CASA.FH / 2;
    m.castShadow = m.receiveShadow = true;
    this.#group.add(m);
  }

  #paredes() {
    const mat  = MaterialLibrary.reboco();
    const yMid = CASA.FH + CASA.H / 2;
    const T    = 0.28;
    const { W, H, D, FH, RA } = CASA;

    for (const [w, h, d, x, y, z] of [
      [W, H, T,  0,       yMid, -D / 2],
      [W, H, T,  0,       yMid,  D / 2],
      [T, H, D, -W / 2,   yMid,  0],
      [T, H, D,  W / 2,   yMid,  0],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      this.#group.add(m);
    }

    /* gables triangulares com extrusão */
    for (const [zPos, ry] of [[-D / 2, 0], [D / 2, Math.PI]]) {
      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0);
      shape.lineTo( W / 2, 0);
      shape.lineTo(0, RA);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
      const m   = new THREE.Mesh(geo, mat);
      m.position.set(0, FH + H, zPos - (ry ? -T : 0));
      m.rotation.y = ry;
      m.castShadow = true;
      this.#group.add(m);
    }
  }

  #telhado() {
    const { W, D, H, FH, RA, EV } = CASA;
    const mat    = MaterialLibrary.telha();
    const slope  = Math.atan2(RA, D / 2);
    const sLen   = Math.hypot(RA, D / 2) + EV + 0.1;

    for (const sign of [-1, 1]) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(W + EV * 2, sLen, 1, 8),
        mat
      );
      m.rotation.x = sign * slope - Math.PI / 2;
      m.position.set(0, FH + H + RA / 2, sign * (D / 4 + EV * 0.3));
      m.castShadow = m.receiveShadow = true;
      this.#group.add(m);
    }

    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, D + EV * 2, 8),
      MaterialLibrary.metalEscuro()
    );
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, FH + H + RA, 0);
    ridge.castShadow = true;
    this.#group.add(ridge);
  }

  #beiral() {
    const { W, D, FH, H, EV } = CASA;
    const mat = MaterialLibrary.concreto();
    for (const z of [-D / 2, D / 2]) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(W + EV * 2, 0.08, EV + 0.1),
        mat
      );
      b.position.set(0, FH + H, z + (z < 0 ? -EV * 0.5 : EV * 0.5));
      b.castShadow = true;
      this.#group.add(b);
    }
  }

  #aberturas() {
    const { W, D, H, FH } = CASA;
    const yWall = FH + H / 2;
    const matV  = MaterialLibrary.vidro();
    const matM  = MaterialLibrary.madeira();

    const janela = (x, z, ry) => {
      const outer = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.1), matM);
      outer.position.set(x, yWall + 0.2, z);
      outer.rotation.y = ry;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), matV);
      glass.position.set(x, yWall + 0.2, z + (ry === 0 ? -0.06 : 0.06));
      glass.rotation.y = ry;
      const bH = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), matM);
      bH.position.copy(glass.position);
      const bV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), matM);
      bV.position.copy(glass.position);
      this.#group.add(outer, glass, bH, bV);
    };

    janela(-W / 3, -D / 2 - 0.01, 0);
    janela( W / 3, -D / 2 - 0.01, 0);
    janela(-W / 3,  D / 2 + 0.01, Math.PI);

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), matM);
    doorFrame.position.set(0, FH + 1.1, -D / 2 - 0.02);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.06), matM);
    door.position.set(0.08, FH + 1.0, -D / 2 - 0.08);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.45), MaterialLibrary.concreto());
    step.position.set(0, FH + 0.07, -D / 2 - 0.28);
    this.#group.add(doorFrame, door, step);
  }

  #chamine() {
    const { W, D, FH, H, RA } = CASA;
    const mat  = MaterialLibrary.concreto();
    const cx   = W / 4, cz = D / 6;
    const cH   = H * 0.65 + RA * 0.6;
    const yBot = FH + H * 0.6;

    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.55, cH, 0.55), mat);
    corpo.position.set(cx, yBot + cH / 2, cz);
    corpo.castShadow = true;
    this.#group.add(corpo);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), MaterialLibrary.metalEscuro());
    cap.position.set(cx, FH + H + RA * 0.9, cz);
    this.#group.add(cap);
  }

  #jardim() {
    const { W, D } = CASA;
    const matB = new THREE.MeshStandardMaterial({ color: 0x2a6018, roughness: 0.9 });

    for (const [x, z, r] of [
      [-W / 2 - 0.6, -D / 2 - 0.6, 0.55],
      [ W / 2 + 0.6, -D / 2 - 0.6, 0.55],
      [-W / 2 - 0.5,  D / 2 + 0.4, 0.42],
    ]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), matB);
      bush.position.set(x, r, z);
      bush.castShadow = true;
      this.#group.add(bush);
    }

    /* árvore */
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 2.5, 8), MaterialLibrary.madeira());
    trunk.position.set(-W / 2 - 2.5, 1.25, -D / 2 + 1);
    trunk.castShadow = true;
    this.#group.add(trunk);

    const copa = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 9, 7),
      new THREE.MeshStandardMaterial({ color: 0x1e5c10, roughness: 0.95 })
    );
    copa.position.set(-W / 2 - 2.5, 3.3, -D / 2 + 1);
    copa.castShadow = true;
    this.#group.add(copa);
  }

  #poste() {
    const { W, D } = CASA;
    const px = W / 2 + 5, pz = -D * 0.45;

    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 7, 8), MaterialLibrary.metal());
    haste.position.set(px, 3.5, pz);
    haste.castShadow = true;
    this.#group.add(haste);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), MaterialLibrary.metal());
    arm.rotation.z = Math.PI / 2;
    arm.position.set(px - 0.6, 7.15, pz);
    this.#group.add(arm);

    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.14, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a })
    );
    shade.position.set(px - 1.2, 7.0, pz);
    this.#group.add(shade);

    this.poleTop.set(px - 1.2, 7.1, pz);

    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, 7, pz),
      new THREE.Vector3(W / 2 + 2, 6.5, pz * 0.5),
      new THREE.Vector3(W / 2 + 0.1, 5.5, 0),
    ]);
    this.#group.add(new THREE.Mesh(
      new THREE.TubeGeometry(wireCurve, 24, 0.018, 5, false),
      MaterialLibrary.cabo()
    ));
  }

  #quadroEletrico() {
    const { W, D, FH, H } = CASA;
    const qx = W / 2 + 0.02, qy = FH + H * 0.45, qz = D * 0.32;

    const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.15), MaterialLibrary.metalEscuro());
    caixa.position.set(qx, qy, qz);
    caixa.rotation.y = -Math.PI / 2;
    caixa.scale.set(0, 0, 0);
    caixa.name = 'quadro';
    this.#group.add(caixa);

    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x002200, emissiveIntensity: 0 })
    );
    led.position.set(qx - 0.01, qy + 0.15, qz);
    led.rotation.y = -Math.PI / 2;
    led.name = 'quadro-led';
    this.#group.add(led);

    const disj = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.22, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xdd1111, emissive: 0x330000 })
    );
    disj.position.set(qx - 0.01, qy - 0.08, qz + 0.06);
    disj.rotation.y = -Math.PI / 2;
    disj.scale.set(0, 0, 0);
    disj.name = 'disjuntor';
    this.#group.add(disj);

    this.quadroPos.set(qx, qy, qz);
  }

  #luzes() {
    const { W, D, FH, H } = CASA;

    this.luzJanela1 = new THREE.PointLight(0xFFE080, 0, 6);
    this.luzJanela1.position.set(-W / 3, FH + H * 0.65, -D / 2 + 0.8);
    this.#scene.add(this.luzJanela1);

    this.luzJanela2 = new THREE.PointLight(0xFFE080, 0, 6);
    this.luzJanela2.position.set(W / 3, FH + H * 0.65, -D / 2 + 0.8);
    this.#scene.add(this.luzJanela2);

    this.luzPoste = new THREE.SpotLight(0xFFF8CC, 0, 18, Math.PI / 6, 0.35);
    this.luzPoste.position.copy(this.poleTop);
    this.luzPoste.target.position.set(this.poleTop.x - 3, 0, this.poleTop.z);
    this.#scene.add(this.luzPoste, this.luzPoste.target);
  }

  #calcularRefs() {
    const { D, FH, H, RA } = CASA;
    this.roof1Center.set(0, FH + H + RA * 0.45, -D / 4);
    this.roof2Center.set(0, FH + H + RA * 0.45,  D / 4);
  }

  #caboParede() {
    const { W, D, FH, H } = CASA;
    const qPos = this.quadroPos;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(W / 2 - 0.01, FH + H * 0.48, -(D / 2 - 0.4)),
      new THREE.Vector3(W / 2 + 0.03, FH + H + 0.1,  -(D / 2 - 0.4) * 0.5),
      new THREE.Vector3(W / 2 + 0.03, FH + H * 0.72,   qPos.z * 0.5),
      new THREE.Vector3(qPos.x,       qPos.y + 0.2,     qPos.z),
    ]);
    const geo = new THREE.TubeGeometry(curve, 40, 0.022, 6, false);
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, MaterialLibrary.cabo());
    mesh.castShadow = true;
    this.#group.add(mesh);
    this.caboParede = { mesh, curve, totalCount: geo.index.count };
  }

  animarCaboParede(p) {
    if (!this.caboParede) return;
    this.caboParede.mesh.geometry.setDrawRange(0, Math.round(p * this.caboParede.totalCount));
  }
}

/* ─────────────────────────────────────────────────────────────────────
   SolarInstaller — trilhos, cabos, inversores e painéis por água
   ───────────────────────────────────────────────────────────────────── */
class SolarInstaller {
  #scene;
  #side;
  #group;

  #trilhos    = [];
  #cabos      = [];
  #inversores = [];
  #paineis    = [];
  #curves     = [];

  static COLS = 3;
  static ROWS = 2;

  constructor(scene, side) {
    this.#scene = scene;
    this.#side  = side;
    this.#group = new THREE.Group();
    scene.add(this.#group);
  }

  #sz()    { return this.#side === 'front' ? -1 : 1; }
  #slope() { return Math.atan2(CASA.RA, CASA.D / 2); }
  #baseY() { return CASA.FH + CASA.H + CASA.RA * 0.5; }
  #baseZ() { return this.#sz() * CASA.D / 4; }

  build() {
    this.#buildTrilhos();
    this.#buildCabos();
    this.#buildInversores();
    this.#buildPaineis();
  }

  #buildTrilhos() {
    const { W } = CASA;
    const mat  = MaterialLibrary.aluminio();
    const cols = SolarInstaller.COLS;
    const step = (W - 1.2) / (cols - 1);
    const rLen = CASA.D * 0.38;

    for (let c = 0; c < cols; c++) {
      const x    = -W / 2 + 0.6 + c * step;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, rLen), mat);
      mesh.position.set(x, this.#baseY(), this.#baseZ());
      mesh.rotation.x = this.#sz() * this.#slope();
      mesh.scale.set(0, 1, 1);
      mesh.castShadow = true;
      this.#trilhos.push(mesh);
      this.#group.add(mesh);
    }
  }

  #buildCabos() {
    const { W, FH, H } = CASA;
    const bY = this.#baseY(), bZ = this.#baseZ();

    for (const offset of [-0.08, 0.08]) {
      const p0 = new THREE.Vector3(-W / 2 + 0.3, bY + offset * 0.3, bZ);
      const pM = new THREE.Vector3(0,             bY + 0.18,         bZ);
      const p1 = new THREE.Vector3( W / 2 - 0.3, bY + offset * 0.3, bZ);
      const curve = new THREE.QuadraticBezierCurve3(p0, pM, p1);
      this.#curves.push(curve);
      const geo   = new THREE.TubeGeometry(curve, 32, 0.018, 5, false);
      geo.setDrawRange(0, 0);
      const mesh  = new THREE.Mesh(geo, MaterialLibrary.cabo());
      this.#cabos.push({ mesh, totalCount: geo.index.count });
      this.#group.add(mesh);
    }

    const invX = W / 2 - 0.35;
    const invZ = this.#sz() * (CASA.D / 2 - 0.4);
    const dropCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(W / 2 - 0.3, bY, bZ),
      new THREE.Vector3(invX, FH + H * 0.75, invZ * 0.8),
      new THREE.Vector3(invX, FH + H * 0.5,  invZ),
    ]);
    this.#curves.push(dropCurve);
    const dropGeo  = new THREE.TubeGeometry(dropCurve, 24, 0.018, 5, false);
    dropGeo.setDrawRange(0, 0);
    this.#cabos.push({ mesh: new THREE.Mesh(dropGeo, MaterialLibrary.cabo()), totalCount: dropGeo.index.count });
    this.#group.add(this.#cabos[this.#cabos.length - 1].mesh);
  }

  #buildInversores() {
    const { W, D, FH, H } = CASA;
    const invX = W / 2 - 0.01;
    const invZ = this.#sz() * (D / 2 - 0.4);
    const invY = FH + H * 0.48;

    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.36), MaterialLibrary.inversor());
    corpo.position.set(invX, invY, invZ);
    corpo.rotation.y = -Math.PI / 2;
    corpo.scale.y = 0;
    corpo.name = `inversor-${this.#side}`;

    const lcd = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x00aa44, emissive: 0x003311, emissiveIntensity: 0.8 })
    );
    lcd.position.set(invX + 0.09, invY + 0.1, invZ);
    lcd.rotation.y = Math.PI / 2;

    this.#inversores.push({ corpo, lcd });
    this.#group.add(corpo, lcd);
  }

  #buildPaineis() {
    const { W } = CASA;
    const cols  = SolarInstaller.COLS;
    const rows  = SolarInstaller.ROWS;
    const slope = this.#slope();
    const pW    = (W - 1.4) / cols - 0.06;
    const pH    = CASA.D * 0.34 / rows - 0.06;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x       = -W / 2 + 0.7 + (c + 0.5) * ((W - 1.4) / cols);
        const zOffset = (r - (rows - 1) / 2) * (pH + 0.06);
        const alvoY   = this.#baseY() + 0.05;
        const alvoZ   = this.#baseZ() + this.#sz() * zOffset * Math.cos(slope);

        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(pW, 0.04, pH),
          MaterialLibrary.painelEmissivo()
        );
        panel.rotation.x = this.#sz() * (slope - Math.PI / 2);
        panel.position.set(x, alvoY + 8, alvoZ);
        panel.castShadow = true;
        panel.receiveShadow = true;

        this.#paineis.push({
          mesh:  panel,
          alvoY,
          delay: (c + r * cols) / (cols * rows),
        });
        this.#group.add(panel);
      }
    }
  }

  /* ── Animadores ── */

  animarTrilhos(p) {
    const t = SolarInstaller.#easeOutBack(Math.min(p, 1));
    for (const m of this.#trilhos) m.scale.x = t;
  }

  animarCabos(p) {
    for (const c of this.#cabos) {
      c.mesh.geometry.setDrawRange(0, Math.round(p * c.totalCount));
    }
  }

  animarInversores(p) {
    const t = SolarInstaller.#easeOutBack(Math.min(p, 1));
    for (const inv of this.#inversores) inv.corpo.scale.y = t;
  }

  animarPaineis(p) {
    for (const item of this.#paineis) {
      const local = Math.max(0, Math.min(1, (p - item.delay) / (1 - item.delay / this.#paineis.length + 0.01)));
      if (local <= 0) continue;

      /* spring physics: y = alvo + (1-easeIn) * 8 + bounce */
      const t       = local;
      const omega   = 10;
      const damping = 0.5;
      const spring  = Math.exp(-damping * omega * t * 2.5) * Math.cos(omega * t * 2.5);
      item.mesh.position.y = item.alvoY + (1 - SolarInstaller.#easeInCubic(t)) * 8 + spring * 0.3;
    }
  }

  ativarEmissivo(intensity) {
    for (const item of this.#paineis) {
      item.mesh.material.emissiveIntensity = intensity;
    }
  }

  getCurves() { return [...this.#curves]; }

  static #easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  static #easeInCubic(t) { return t * t * t; }
}

/* ─────────────────────────────────────────────────────────────────────
   EnergyFlow — orbs de energia percorrendo os cabos do sistema solar
   ───────────────────────────────────────────────────────────────────── */
class EnergyFlow {
  #scene;
  #curves = [];
  #orbs   = [];

  constructor(scene) { this.#scene = scene; }

  addCurves(curves) {
    for (const c of curves) this.#curves.push(c);
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
  }
}

/* ─────────────────────────────────────────────────────────────────────
   ModelLoader — orquestra HouseBuilder + SolarInstaller
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
    this.solar1 = new SolarInstaller(this.#scene, 'front');
    this.solar1.build();
    this.solar2 = new SolarInstaller(this.#scene, 'back');
    this.solar2.build();
  }
}

/* ─────────────────────────────────────────────────────────────────────
   CameraController — waypoints drone cinematográficos
   ───────────────────────────────────────────────────────────────────── */
class CameraController {
  #camera;
  #wp = {};
  #orbitAngle = 0;

  constructor(camera) { this.#camera = camera; }

  configure(house) {
    const { W, D, FH, H, RA } = CASA;
    const ridge = new THREE.Vector3(0, FH + H + RA, 0);
    const r1    = house.roof1Center.clone();
    const r2    = house.roof2Center.clone();
    const qPos  = house.quadroPos.clone();
    const walR  = new THREE.Vector3(W / 2 + 3.5, FH + H * 0.5, 0);

    this.#wp = {
      0:  { from: v3(0, 22, 2),                     to: v3(4, 14, -14),                         look: ridge  },
      1:  { from: v3(4, 14, -14),                    to: v3(-1, 11, -13),                        look: r1     },
      2:  { from: v3(-1, 11, -13),                   to: v3(0, 10, -12),                         look: r1     },
      3:  { from: v3(0, 10, -12),                    to: v3(walR.x+1, walR.y+2, -D*0.4),         look: r1     },
      4:  { from: v3(walR.x+1, walR.y+2, -D*0.4),   to: v3(walR.x,   walR.y+1, -D*0.4),         look: r1     },
      5:  { from: v3(walR.x,   walR.y+1, -D*0.4),   to: v3(walR.x,   walR.y+1, -D*0.4),         look: r1     },
      6:  { from: v3(walR.x,   walR.y+1, -D*0.4),   to: v3(-1, 11, 13),                         look: r2     },
      7:  { from: v3(-1, 11, 13),                    to: v3(0, 10, 12),                          look: r2     },
      8:  { from: v3(0, 10, 12),                     to: v3(walR.x+1, walR.y+2, D*0.4),          look: r2     },
      9:  { from: v3(walR.x+1, walR.y+2, D*0.4),    to: v3(walR.x,   walR.y+1, D*0.4),          look: r2     },
      10: { from: v3(walR.x,   walR.y+1, D*0.4),    to: v3(walR.x,   walR.y+1, D*0.4),          look: r2     },
      11: { from: v3(walR.x,   walR.y+1, D*0.4),    to: v3(W/2+2, FH+H*0.5, D*0.35),            look: qPos   },
      12: { from: v3(W/2+2, FH+H*0.5, D*0.35),      to: v3(W/2+1.4, FH+H*0.45, D*0.32),         look: qPos   },
      13: { from: v3(W/2+1.4, FH+H*0.45, D*0.32),   to: v3(W/2+1.4, FH+H*0.45, D*0.32),         look: qPos   },
      /* ── seqüncia fluxo de energia ── */
      15: { from: v3(walR.x-2, walR.y+2, 0),          to: v3(walR.x-2, walR.y+2, 0),               look: v3(0, FH+H+RA*0.5, 0)     },
      16: { from: v3(walR.x-2, walR.y+2, 0),          to: v3(walR.x+0.5, walR.y+1.5, -D*0.2),      look: r1                        },
      17: { from: v3(W/2+2.5, FH+H+RA*0.3, D*0.28),   to: v3(W/2+2.5, FH+H*0.38, D*0.32),         look: qPos                      },
      18: { from: v3(W/2+2.5, FH+H*0.38, D*0.32),     to: v3(0, 9, -20),                           look: v3(0, FH+H*0.5, 0)        },
      19: { from: v3(0, 9, -20),                       to: v3(0, 9, -20),                           look: v3(0, FH+H*0.5, 0)        },
    };
  }

  update(stage, t) {
    const wp = this.#wp[stage];
    if (!wp) return;
    const ease = CameraController.#easeInOut(Math.min(t, 1));
    this.#camera.position.lerpVectors(wp.from, wp.to, ease);
    this.#camera.lookAt(wp.look);
  }

  orbit(dt) {
    this.#orbitAngle += dt * 0.00028;
    const R = 18, H = 11;
    this.#camera.position.set(
      R * Math.cos(this.#orbitAngle),
      H + Math.sin(this.#orbitAngle * 0.4) * 1.5,
      R * Math.sin(this.#orbitAngle)
    );
    const { FH, H: CH, RA } = CASA;
    this.#camera.lookAt(0, FH + CH * 0.5 + RA * 0.3, 0);
  }

  startOrbit(fromPos) {
    this.#orbitAngle = Math.atan2(fromPos.z, fromPos.x);
  }

  static #easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}

/* helper Vector3 */
function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

/* ─────────────────────────────────────────────────────────────────────
   AnimationController — máquina de estados com delta time
   ───────────────────────────────────────────────────────────────────── */
class AnimationController {
  static #STAGES = [
    { dur: 2000 },  //  0  drone-entrada
    { dur: 1400 },  //  1  trilhos-1
    { dur: 1000 },  //  2  cabos-1
    { dur:  700 },  //  3  inversores-1
    { dur: 2500 },  //  4  paineis-1
    { dur: 1000 },  //  5  glow-1
    { dur: 2000 },  //  6  pan-agua-2
    { dur: 1400 },  //  7  trilhos-2
    { dur: 1000 },  //  8  cabos-2
    { dur:  700 },  //  9  inversores-2
    { dur: 2500 },  // 10  paineis-2
    { dur: 1500 },  // 11  cam-quadro
    { dur:  900 },  // 12  quadro-abre
    { dur:  900 },  // 13  luzes-on
    { dur: 1800 },  // 14  orbita-curta
    { dur: 1200 },  // 15  emissivo-fluxo
    { dur: 1500 },  // 16  energy-orbs
    { dur: 1800 },  // 17  cabo-parede
    { dur: 1500 },  // 18  wide-shot
    { dur: 2000 },  // 19  branding
    { dur: Infinity }, // 20  estatico
  ];

  #models;
  #cam;
  #scene;
  #energyFlow     = null;
  #sound          = null;
  #stageCallbacks = new Map();
  #stage   = 0;
  #t       = 0;
  #elapsed = 0;
  #glow1   = null;
  #glow2   = null;

  constructor(scene, models, cam, energyFlow, sound) {
    this.#scene      = scene;
    this.#models     = models;
    this.#cam        = cam;
    this.#energyFlow = energyFlow ?? null;
    this.#sound      = sound ?? null;
    this.#criarGlows();
  }

  onStageEnter(stage, fn) { this.#stageCallbacks.set(stage, fn); }

  #criarGlows() {
    const { FH, H, RA, D } = CASA;
    this.#glow1 = new THREE.PointLight(0xFFDD55, 0, 8);
    this.#glow1.position.set(0, FH + H + RA * 0.55, -D / 4);
    this.#scene.add(this.#glow1);

    this.#glow2 = new THREE.PointLight(0xFFDD55, 0, 8);
    this.#glow2.position.set(0, FH + H + RA * 0.55, D / 4);
    this.#scene.add(this.#glow2);
  }

  reset() { this.#stage = 0; this.#t = 0; this.#elapsed = 0; }

  tick(dt) {
    const dur = AnimationController.#STAGES[this.#stage]?.dur ?? Infinity;
    if (isFinite(dur)) {
      this.#elapsed += dt;
      this.#t = Math.min(this.#elapsed / dur, 1);
    }
    this.#dispatch(dt);
    if (isFinite(dur) && this.#elapsed >= dur) {
      const next = this.#stage + 1;
      this.#stage   = next;
      this.#elapsed = 0;
      this.#t       = 0;
      this.#stageCallbacks.get(next)?.();
    }
  }

  #dispatch(dt) {
    const s = this.#models;
    const p = this.#t;

    switch (this.#stage) {
      case 0:  this.#cam.update(0, p); break;
      case 1:  this.#cam.update(1, p); s.solar1.animarTrilhos(p); break;
      case 2:  this.#cam.update(2, p); s.solar1.animarCabos(p); break;
      case 3:  this.#cam.update(3, p); s.solar1.animarInversores(p); break;
      case 4:  this.#cam.update(4, p); s.solar1.animarPaineis(p); break;

      case 5:
        this.#cam.update(5, 1);
        this.#glow1.intensity = (Math.sin(p * Math.PI * 3) * 0.5 + 0.5) * 2;
        s.solar1.ativarEmissivo(Math.sin(p * Math.PI) * 0.6);
        break;

      case 6:
        this.#cam.update(6, p);
        this.#glow1.intensity = Math.max(0, 1.5 - p * 3);
        break;

      case 7:  this.#cam.update(7, p); s.solar2.animarTrilhos(p); break;
      case 8:  this.#cam.update(8, p); s.solar2.animarCabos(p); break;
      case 9:  this.#cam.update(9, p); s.solar2.animarInversores(p); break;
      case 10: this.#cam.update(10, p); s.solar2.animarPaineis(p); break;

      case 11:
        this.#cam.update(11, p);
        this.#glow2.intensity = (Math.sin(p * Math.PI * 2) * 0.4 + 0.4) * 2;
        s.solar2.ativarEmissivo(Math.sin(p * Math.PI) * 0.6);
        break;

      case 12: {
        this.#cam.update(12, p);
        const quadro = this.#scene.getObjectByName('quadro');
        const disj   = this.#scene.getObjectByName('disjuntor');
        if (quadro) { const sc = AnimationController.#easeOutBack(p);                    quadro.scale.set(sc, sc, sc); }
        if (disj)   { const sc = AnimationController.#easeOutBack(Math.max(0, (p-0.5)*2)); disj.scale.set(sc, sc, sc); }
        break;
      }

      case 13: {
        this.#cam.update(13, 1);
        const disj = this.#scene.getObjectByName('disjuntor');
        if (disj) disj.rotation.z = -p * Math.PI * 0.35;
        const i = AnimationController.#easeInOut(p) * 2;
        const h = s.house;
        if (h.luzJanela1) h.luzJanela1.intensity = i;
        if (h.luzJanela2) h.luzJanela2.intensity = i;
        if (h.luzPoste)   h.luzPoste.intensity   = AnimationController.#easeInOut(p) * 2.5;
        const led = this.#scene.getObjectByName('quadro-led');
        if (led) led.material.emissiveIntensity = p * 1.5;
        break;
      }

      case 14:
        this.#cam.orbit(dt);
        break;

      case 15:
        this.#cam.update(15, p);
        this.#models.solar1.ativarEmissivo(0.6 + Math.sin(p * Math.PI * 4) * 0.4);
        this.#models.solar2.ativarEmissivo(0.6 + Math.sin(p * Math.PI * 4 + 0.5) * 0.4);
        this.#glow1.intensity = 1.0 + Math.sin(p * Math.PI * 3) * 0.5;
        this.#glow2.intensity = 1.0 + Math.sin(p * Math.PI * 3 + 0.8) * 0.5;
        break;

      case 16:
        this.#cam.update(16, p);
        this.#energyFlow?.tick(p);
        this.#models.solar1.ativarEmissivo(0.7);
        this.#models.solar2.ativarEmissivo(0.7);
        break;

      case 17:
        this.#cam.update(17, p);
        this.#models.house.animarCaboParede(p);
        this.#energyFlow?.reset();
        break;

      case 18:
        this.#cam.update(18, p);
        this.#glow1.intensity = Math.max(0, 1.5 - p * 1.8);
        this.#glow2.intensity = Math.max(0, 1.5 - p * 1.8);
        break;

      case 19:
        this.#cam.update(19, p);
        break;

      case 20:
        /* cena estática — loop para via callback */
        break;
    }
  }

  static #easeOutBack(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  static #easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   SoundController — efeitos sonoros via Web Audio API
   ───────────────────────────────────────────────────────────────────── */
class SoundController {
  #ctx = null;

  #getCtx() {
    if (!this.#ctx) {
      this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
    return this.#ctx;
  }

  #beep(freq, endFreq, gain, duration) {
    try {
      const ctx = this.#getCtx();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type  = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
      vol.gain.setValueAtTime(gain, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) { /* bloqueado pelo browser — silencioso */ }
  }

  tocarEncaixe()  { this.#beep(820, 440, 0.12, 0.18); }
  tocarEletrico() { this.#beep(120,  80, 0.08, 0.35); }
  tocarLuz()      { this.#beep(1200, 600, 0.06, 0.22); }

  dispose() { this.#ctx?.close(); this.#ctx = null; }
}

/* ─────────────────────────────────────────────────────────────────────
   SceneManager — renderer, scene, câmera, luzes globais, resize
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
    this.renderer.shadowMap.enabled   = true;
    this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog        = new THREE.FogExp2(0xaad4f0, 0.018);

    this.camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 300);
    this.camera.position.set(0, 22, 2);

    this.#setupLights();

    const ro = new ResizeObserver(() => this.#onResize());
    ro.observe(this.#canvas.parentElement ?? this.#canvas);
  }

  #setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffeedd, 0.45));

    const sun = new THREE.DirectionalLight(0xFFF5E0, 2.2);
    sun.position.set(14, 28, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left   = -20;
    sun.shadow.camera.right  =  20;
    sun.shadow.camera.top    =  20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias          = -0.001;
    sun.shadow.normalBias    =  0.02;
    this.scene.add(sun);

    this.scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3a6b28, 0.55));

    const fill = new THREE.DirectionalLight(0xcce8ff, 0.4);
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
   AnimacaoMontagem — fachada pública (API inalterada)
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
    this.#cc.configure(this.#ml.house);
    this.#ef = new EnergyFlow(this.#sm.scene);
    this.#ef.addCurves(this.#ml.solar1.getCurves());
    this.#ef.addCurves(this.#ml.solar2.getCurves());
    this.#ef.build();
    this.#sound = new SoundController();
    this.#ac = new AnimationController(this.#sm.scene, this.#ml, this.#cc, this.#ef, this.#sound);
    this.#bindCallbacks(canvasEl);
    requestAnimationFrame(() => this.iniciar());
  }

  #bindCallbacks(canvasEl) {
    this.#ac.onStageEnter(4,  () => this.#sound.tocarEncaixe());
    this.#ac.onStageEnter(10, () => this.#sound.tocarEncaixe());
    this.#ac.onStageEnter(14, () => this.#cc.startOrbit(this.#sm.camera.position));
    this.#ac.onStageEnter(17, () => this.#sound.tocarEletrico());
    this.#ac.onStageEnter(19, () => this.#mostrarBranding(canvasEl));
    this.#ac.onStageEnter(20, () => { this.#sm.render(); this.parar(); });
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
    void el.offsetWidth; /* força reflow para CSS transition funcionar */
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
    this.#raf = requestAnimationFrame(ts => this.#loop(ts));
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
