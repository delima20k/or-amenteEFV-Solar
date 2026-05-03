'use strict';

/* =====================================================================
   AnimacaoMontagem â€” Three.js r134 (UMD global THREE)
   Casa procedural 3D com duas Ã¡guas de telhado.
   CÃ¢mera tipo drone acompanha a instalaÃ§Ã£o dos painÃ©is solares.

   EstÃ¡gios:
     0  Drone posiciona sobre Ã¡gua 1                  (1500 ms)
     1  Trilhos surgem na Ã¡gua 1                      (1200 ms)
     2  Cabo cresce painÃ©is â†’ inversor                (800  ms)
     3  Inversor cai na parede                        (600  ms)
     4  PainÃ©is caem em cascata â€” Ã¡gua 1              (2000 ms)
     5  Glow â€” PointLight pulsa                       (1000 ms)
     6  Pan cÃ¢mera para Ã¡gua 2                        (1800 ms)
     7  InstalaÃ§Ã£o completa Ã¡gua 2                    (5200 ms)
     8  CÃ¢mera segue fio descendo                     (1400 ms)
     9  Quadro elÃ©trico aparece                       (800  ms)
    10  Disjuntor â†’ janelas + poste ON                (900  ms)
    11  Ã“rbita final (loop)                           (âˆž)
   ===================================================================== */

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   MaterialFactory â€” texturas procedurais via Canvas
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
class MaterialFactory {
  static #tex(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  static telha() {
    const tex = MaterialFactory.#tex(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#8B3A2A';
      ctx.fillRect(0, 0, w, h);
      const rows = 5, tileW = w / 4, tileH = h / rows;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (tileW / 2);
        for (let c = 0; c < 6; c++) {
          const x = c * tileW - offset, y = r * tileH;
          const grad = ctx.createLinearGradient(x, y, x, y + tileH);
          grad.addColorStop(0, '#C8502A');
          grad.addColorStop(0.4, '#A83820');
          grad.addColorStop(1, '#7A2A18');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(x + tileW / 2, y + tileH * 0.6, tileW * 0.48, tileH * 0.52, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    });
    tex.repeat.set(4, 3);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
  }

  static tijolo() {
    const tex = MaterialFactory.#tex(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#b5552a';
      ctx.fillRect(0, 0, w, h);
      const bW = 64, bH = 32;
      for (let row = 0; row * bH < h + bH; row++) {
        const off = (row % 2) * (bW / 2);
        for (let col = -1; col * bW < w + bW; col++) {
          const x = col * bW + off, y = row * bH;
          ctx.fillStyle = `hsl(${15 + Math.random() * 10},55%,${38 + Math.random() * 8}%)`;
          ctx.fillRect(x + 2, y + 2, bW - 4, bH - 4);
        }
      }
      ctx.strokeStyle = '#8B6050'; ctx.lineWidth = 2;
      for (let y = 0; y < h; y += bH) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let row = 0; row * bH < h; row++) {
        const off = (row % 2) * (bW / 2);
        for (let x = off; x < w + bW; x += bW) { ctx.beginPath(); ctx.moveTo(x, row * bH); ctx.lineTo(x, (row + 1) * bH); ctx.stroke(); }
      }
    });
    tex.repeat.set(3, 2);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
  }

  static painel() {
    const tex = MaterialFactory.#tex(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#0d1b3e'; ctx.fillRect(0, 0, w, h);
      const cols = 6, rows = 4;
      const cw = (w - 16) / cols, ch = (h - 16) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 8 + c * cw, y = 8 + r * ch;
          ctx.fillStyle = '#11234d'; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          const shine = ctx.createLinearGradient(x, y, x + cw, y + ch);
          shine.addColorStop(0, 'rgba(120,200,255,0.12)'); shine.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = shine; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        }
      }
      ctx.strokeStyle = '#1a3a70'; ctx.lineWidth = 2; ctx.strokeRect(4, 4, w - 8, h - 8);
    });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.6, color: 0x1a2a5e });
  }

  static metal() {
    return new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.2, metalness: 0.9 });
  }

  static metalEscuro() {
    return new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.3, metalness: 0.85 });
  }

  static relva() {
    const tex = MaterialFactory.#tex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#3a6b28'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = `hsl(${100 + Math.random() * 30},${45 + Math.random() * 20}%,${25 + Math.random() * 15}%)`;
        ctx.fillRect(x, y, 3, 3);
      }
    });
    tex.repeat.set(8, 8);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 });
  }

  static parede() {
    return new THREE.MeshStandardMaterial({ color: 0xF5F0E8, roughness: 0.85, metalness: 0.0 });
  }

  static vidro() {
    return new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.1, metalness: 0.1,
      transparent: true, opacity: 0.55 });
  }

  static madeira() {
    return new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.8, metalness: 0.0 });
  }

  static inversor() {
    return new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.5, metalness: 0.4 });
  }

  static cabo() {
    return new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.2 });
  }

  static concreto() {
    return new THREE.MeshStandardMaterial({ color: 0xccbfb0, roughness: 0.95, metalness: 0.0 });
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   CenarioBuilder â€” monta casa e ambiente 3D
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
class CenarioBuilder {
  #scene;

  /* ReferÃªncias para o CameraRig e SolarArrayBuilder */
  roof1Mid   = new THREE.Vector3();
  roof2Mid   = new THREE.Vector3();
  quadroPos  = new THREE.Vector3();
  poleTop    = new THREE.Vector3();

  luzJanela1 = null;
  luzJanela2 = null;
  luzPoste   = null;

  static CW = 6;
  static CD = 8;
  static CH = 3.5;
  static RA = 1.8;

  constructor(scene) {
    this.#scene = scene;
  }

  construir() {
    this.#solo();
    this.#fundacao();
    this.#paredes();
    this.#telhado();
    this.#aberturas();
    this.#jardim();
    this.#poste();
    this.#quadro();
    this.#luzes();

    const { CW, CD, CH, RA } = CenarioBuilder;
    this.roof1Mid.set(0, CH + RA * 0.5, -CD * 0.25);
    this.roof2Mid.set(0, CH + RA * 0.5,  CD * 0.25);
    this.quadroPos.set(CW / 2 - 0.05, CH * 0.5, CD * 0.3);
    this.poleTop.set(CW / 2 + 4, 5.5, -CD * 0.5);
  }

  #solo() {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), MaterialFactory.relva());
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.#scene.add(mesh);
  }

  #fundacao() {
    const { CW, CD } = CenarioBuilder;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.3, 0.4, CD + 0.3), MaterialFactory.concreto());
    mesh.position.y = 0.2;
    mesh.receiveShadow = true;
    this.#scene.add(mesh);
  }

  #paredes() {
    const { CW, CD, CH, RA } = CenarioBuilder;
    const base = CH / 2 + 0.4;
    const mat  = MaterialFactory.parede();

    const defs = [
      { w: CW, h: CH, d: 0.25, x: 0,       y: base, z: -CD / 2 },
      { w: CW, h: CH, d: 0.25, x: 0,       y: base, z:  CD / 2 },
      { w: 0.25, h: CH, d: CD, x: -CW / 2, y: base, z: 0 },
      { w: 0.25, h: CH, d: CD, x:  CW / 2, y: base, z: 0 },
    ];

    for (const def of defs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), mat);
      m.position.set(def.x, def.y, def.z);
      m.castShadow = m.receiveShadow = true;
      this.#scene.add(m);
    }

    /* Gables triangulares */
    for (const zPos of [-CD / 2, CD / 2]) {
      const shape = new THREE.Shape();
      shape.moveTo(-CW / 2, 0); shape.lineTo(CW / 2, 0); shape.lineTo(0, RA); shape.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      m.position.set(0, CH + 0.4, zPos);
      m.castShadow = true;
      this.#scene.add(m);
    }
  }

  #telhado() {
    const { CW, CD, CH, RA } = CenarioBuilder;
    const yBase = CH + 0.4;
    const slope = Math.atan2(RA, CD / 2);
    const len   = Math.sqrt((CD / 2) ** 2 + RA ** 2) + 0.2;
    const mat   = MaterialFactory.telha();

    for (const sign of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CW + 0.3, len, 1, 6), mat);
      mesh.rotation.x = sign * slope - Math.PI / 2;
      mesh.position.set(0, yBase + RA / 2, sign * (-CD / 4));
      mesh.castShadow = mesh.receiveShadow = true;
      this.#scene.add(mesh);
    }

    /* Cumeeira */
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, CD + 0.3, 8), MaterialFactory.metalEscuro());
    k.rotation.x = Math.PI / 2;
    k.position.set(0, yBase + RA, 0);
    k.castShadow = true;
    this.#scene.add(k);
  }

  #aberturas() {
    const { CW, CD, CH } = CenarioBuilder;
    const yBase = CH + 0.4;
    const matJan = MaterialFactory.vidro();
    const matMad = MaterialFactory.madeira();

    /* Janelas */
    for (const [x, z, ry] of [[-CW / 4, -CD / 2 - 0.01, 0], [CW / 4, -CD / 2 - 0.01, 0], [-CW / 4, CD / 2 + 0.01, Math.PI]]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.08), matMad);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), matJan);
      frame.position.set(x, yBase - CH * 0.3, z); frame.rotation.y = ry;
      glass.position.set(x, yBase - CH * 0.3, z + (ry === 0 ? -0.05 : 0.05)); glass.rotation.y = ry;
      this.#scene.add(frame, glass);
    }

    /* Porta */
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.1), matMad);
    frame.position.set(0, yBase - CH * 0.5 + 1.05 - 0.4, -CD / 2 - 0.01);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.06), matMad);
    door.position.set(0, yBase - CH * 0.5 + 0.95 - 0.4, -CD / 2 - 0.06);
    this.#scene.add(frame, door);
  }

  #jardim() {
    const { CW, CD } = CenarioBuilder;
    const path = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 3), MaterialFactory.concreto());
    path.position.set(0, 0.42, -CD / 2 - 2);
    this.#scene.add(path);

    for (const [x, z] of [[-CW / 2 - 0.5, -CD / 2 - 0.5], [CW / 2 + 0.5, -CD / 2 - 0.5]]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5),
        new THREE.MeshStandardMaterial({ color: 0x2d6e20, roughness: 0.9 }));
      bush.position.set(x, 0.8, z); bush.castShadow = true;
      this.#scene.add(bush);
    }
  }

  #poste() {
    const { CW, CD } = CenarioBuilder;
    const px = CW / 2 + 4, pz = -CD * 0.5;
    const mat = MaterialFactory.metal();

    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), mat);
    haste.position.set(px, 3, pz); haste.castShadow = true;
    this.#scene.add(haste);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444 }));
    head.position.set(px, 6.15, pz);
    this.#scene.add(head);

    this.poleTop.set(px, 6.3, pz);

    /* Fio do poste atÃ© a casa */
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, 5.5, pz),
      new THREE.Vector3(CW / 2 + 1.5, 5.2, pz),
      new THREE.Vector3(CW / 2, 4.5, 0),
    ]);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.02, 5, false), MaterialFactory.cabo());
    this.#scene.add(wire);
  }

  #quadro() {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.12), MaterialFactory.metalEscuro());
    mesh.position.copy(this.quadroPos);
    mesh.rotation.y = -Math.PI / 2;
    mesh.scale.set(0, 0, 0);
    mesh.name = 'quadro';
    this.#scene.add(mesh);

    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x330000 }));
    btn.position.set(this.quadroPos.x - 0.08, this.quadroPos.y, this.quadroPos.z + 0.07);
    btn.rotation.y = -Math.PI / 2;
    btn.scale.set(0, 0, 0);
    btn.name = 'disjuntor';
    this.#scene.add(btn);
  }

  #luzes() {
    const { CW, CD, CH } = CenarioBuilder;

    this.luzJanela1 = new THREE.PointLight(0xFFE4A0, 0, 5);
    this.luzJanela1.position.set(-CW / 4, CH, -CD / 2 + 0.5);
    this.#scene.add(this.luzJanela1);

    this.luzJanela2 = new THREE.PointLight(0xFFE4A0, 0, 5);
    this.luzJanela2.position.set(CW / 4, CH, -CD / 2 + 0.5);
    this.#scene.add(this.luzJanela2);

    this.luzPoste = new THREE.SpotLight(0xFFF5CC, 0, 14, Math.PI / 5, 0.4);
    this.luzPoste.position.copy(this.poleTop);
    this.luzPoste.target.position.set(this.poleTop.x - 2, 0, this.poleTop.z);
    this.#scene.add(this.luzPoste, this.luzPoste.target);
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SolarArrayBuilder â€” trilhos, cabo, inversor, painÃ©is por Ã¡gua
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
class SolarArrayBuilder {
  #scene; #side;
  #paineis  = [];
  #trilhos  = [];
  #caboMesh = null;
  #inversorMesh = null;
  #caboFio  = null;

  static PAINEIS = 6;

  constructor(scene, side) {
    this.#scene = scene;
    this.#side  = side;
  }

  #signZ() { return this.#side === 'front' ? -1 : 1; }

  #slopeAngle() {
    const { CD, RA } = CenarioBuilder;
    return Math.atan2(RA, CD / 2);
  }

  #basePos() {
    const { CH, RA, CD } = CenarioBuilder;
    return { y: CH + 0.4 + RA / 2, z: this.#signZ() * CD / 4 };
  }

  criarTrilhos() {
    const { CW, CD } = CenarioBuilder;
    const mat  = MaterialFactory.metal();
    const { y, z } = this.#basePos();
    const slope = this.#slopeAngle();

    for (let i = 0; i < 4; i++) {
      const x = -CW / 2 + 0.8 + i * (CW - 1.6) / 3;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, CD * 0.45, 6), mat);
      rail.position.set(x, y, z);
      rail.rotation.x = this.#signZ() * slope;
      rail.scale.y = 0;
      rail.castShadow = true;
      this.#trilhos.push(rail);
      this.#scene.add(rail);
    }
  }

  criarInversor() {
    const { CW, CH } = CenarioBuilder;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.15), MaterialFactory.inversor());
    mesh.position.set(CW / 2 - 0.3, CH + 1.5, this.#signZ() * CenarioBuilder.CD * 0.4);
    mesh.rotation.y = -Math.PI / 2;
    mesh.scale.y = 0;
    mesh.name = `inversor-${this.#side}`;
    this.#inversorMesh = mesh;
    this.#scene.add(mesh);
  }

  criarCabo() {
    const { CW, CH } = CenarioBuilder;
    const { y, z } = this.#basePos();
    const p0 = new THREE.Vector3(0, y, z);
    const p1 = new THREE.Vector3(CW / 2 - 0.3, CH + 1.8, this.#signZ() * CenarioBuilder.CD * 0.4);
    this.#caboFio = new THREE.CatmullRomCurve3([p0, p0.clone().lerp(p1, 0.4), p1]);
    this.#caboMesh = new THREE.Mesh(
      new THREE.TubeGeometry(this.#caboFio, 20, 0.018, 5, false),
      MaterialFactory.cabo()
    );
    this.#caboMesh.scale.set(0, 0, 0);
    this.#scene.add(this.#caboMesh);
  }

  criarPaineis() {
    const { CW } = CenarioBuilder;
    const n = SolarArrayBuilder.PAINEIS;
    const mat = MaterialFactory.painel();
    const { y, z } = this.#basePos();
    const slope = this.#slopeAngle();

    for (let i = 0; i < n; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 1.65), mat);
      const x = -CW / 2 + 0.6 + i * ((CW - 1.0) / (n - 1));
      panel.position.set(x, y + 0.12, z);
      panel.rotation.x = this.#signZ() * (slope - Math.PI / 2);
      panel.position.y += 6;  /* comeÃ§a fora da tela */
      panel.castShadow = true;
      panel.name = `painel-${this.#side}-${i}`;
      this.#paineis.push({ mesh: panel, alvoY: y + 0.12 });
      this.#scene.add(panel);
    }
  }

  /* ---- Animadores ---- */
  animarTrilhos(p)   { const t = this.#ease(p); for (const r of this.#trilhos) r.scale.y = t; }
  animarCabo(p)      { this.#caboMesh.scale.set(p, p, p); }
  animarInversor(p)  { this.#inversorMesh.scale.y = this.#ease(p); }

  animarPaineis(p) {
    const n = this.#paineis.length;
    for (let i = 0; i < n; i++) {
      const delay  = i / n;
      const local  = Math.max(0, Math.min(1, (p - delay) / (1 - delay / n)));
      const item   = this.#paineis[i];
      item.mesh.position.y = item.alvoY + (1 - this.#ease(local)) * 6;
    }
  }

  getCaboFio()      { return this.#caboFio; }
  getInversorPos()  { return this.#inversorMesh ? this.#inversorMesh.position.clone() : new THREE.Vector3(); }

  #ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   CameraRig â€” trajetÃ³rias cinematogrÃ¡ficas por estÃ¡gio
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
class CameraRig {
  #camera;
  #cfg = {};

  constructor(camera) { this.#camera = camera; }

  definirTargets(cenario) {
    const { CW, CD, CH, RA } = CenarioBuilder;
    const ridge   = new THREE.Vector3(0, CH + RA, 0);
    const r1mid   = cenario.roof1Mid.clone();
    const r2mid   = cenario.roof2Mid.clone();
    const qPos    = cenario.quadroPos.clone();
    const walR    = new THREE.Vector3(CW / 2 + 3, CH, 0);

    this.#cfg = {
      0:  { from: new THREE.Vector3(0, 18, -5),               to: new THREE.Vector3(0, 12, -10),               look: ridge  },
      1:  { from: new THREE.Vector3(0, 12, -10),              to: new THREE.Vector3(-2, 10, -10),              look: r1mid  },
      2:  { from: new THREE.Vector3(-2, 10, -10),             to: new THREE.Vector3(-1, 9, -10),               look: r1mid  },
      3:  { from: new THREE.Vector3(-1, 9, -10),              to: new THREE.Vector3(walR.x + 1, walR.y + 2, -CD * 0.4), look: walR },
      4:  { from: new THREE.Vector3(walR.x + 1, walR.y + 2, -CD * 0.4), to: new THREE.Vector3(walR.x, walR.y + 1, -CD * 0.4), look: r1mid },
      5:  { from: new THREE.Vector3(walR.x, walR.y + 1, -CD * 0.4), to: new THREE.Vector3(walR.x, walR.y + 1, -CD * 0.4), look: r1mid },
      6:  { from: new THREE.Vector3(walR.x, walR.y + 1, -CD * 0.4), to: new THREE.Vector3(-2, 10, 10),         look: r2mid  },
      7:  { from: new THREE.Vector3(-2, 10, 10),              to: new THREE.Vector3(CW / 2 + 2, CH * 0.5, CD * 0.38), look: qPos },
      8:  { from: new THREE.Vector3(CW / 2 + 2, CH * 0.5, CD * 0.38), to: new THREE.Vector3(CW / 2 + 1.5, CH * 0.4, CD * 0.35), look: qPos },
      9:  { from: new THREE.Vector3(CW / 2 + 1.5, CH * 0.4, CD * 0.35), to: new THREE.Vector3(CW / 2 + 1.5, CH * 0.4, CD * 0.35), look: qPos },
      10: { from: new THREE.Vector3(CW / 2 + 1.5, CH * 0.4, CD * 0.35), to: new THREE.Vector3(CW / 2 + 1.5, CH * 0.4, CD * 0.35), look: qPos },
    };
  }

  atualizar(estagio, progresso) {
    const cfg = this.#cfg[estagio];
    if (!cfg) return;
    const t   = this.#ease(Math.min(progresso, 1));
    const pos = new THREE.Vector3().lerpVectors(cfg.from, cfg.to, t);
    this.#camera.position.copy(pos);
    this.#camera.lookAt(cfg.look);
  }

  orbitar(t) {
    const R = 14, H = 10, angle = t * Math.PI * 2;
    this.#camera.position.set(R * Math.cos(angle), H, R * Math.sin(angle));
    const { CH, RA } = CenarioBuilder;
    this.#camera.lookAt(0, CH + RA * 0.3, 0);
  }

  #ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   AnimacaoMontagem â€” API pÃºblica (idÃªntica Ã  versÃ£o Canvas 2D)
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
class AnimacaoMontagem {
  static #DUR = [0, 1500, 1200, 800, 600, 2000, 1000, 1800, 5200, 1400, 800, 900, Infinity];

  #canvas;
  #renderer = null;
  #scene    = null;
  #camera   = null;
  #cenario  = null;
  #array1   = null;
  #array2   = null;
  #rig      = null;

  #estagio   = 0;
  #progresso = 0;
  #tsEstagio = 0;
  #tsUlt     = 0;
  #raf       = null;

  #luzGlow1 = null;
  #luzGlow2 = null;
  #orbitaT  = 0;

  constructor(canvasEl) {
    this.#canvas = canvasEl;
    if (typeof THREE === 'undefined') {
      console.warn('AnimacaoMontagem: Three.js nÃ£o carregado.');
      return;
    }
    this.#inicializarThree();
    requestAnimationFrame(() => this.iniciar());
  }

  #inicializarThree() {
    const W = this.#canvas.clientWidth  || 400;
    const H = this.#canvas.clientHeight || 300;

    this.#renderer = new THREE.WebGLRenderer({ canvas: this.#canvas, antialias: true, alpha: true });
    this.#renderer.setSize(W, H);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

    this.#scene  = new THREE.Scene();
    this.#scene.background = new THREE.Color(0x87CEEB);
    this.#scene.fog        = new THREE.Fog(0x87CEEB, 30, 60);

    this.#camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    this.#camera.position.set(0, 18, -5);

    /* IluminaÃ§Ã£o global */
    this.#scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const sun = new THREE.DirectionalLight(0xFFF8E0, 1.3);
    sun.position.set(10, 20, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -15;
    sun.shadow.camera.right = sun.shadow.camera.top   =  15;
    this.#scene.add(sun);

    this.#scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3a6b28, 0.4));

    /* Glows dos painÃ©is */
    const { CH, RA, CD } = CenarioBuilder;
    this.#luzGlow1 = new THREE.PointLight(0xFFDD66, 0, 6);
    this.#luzGlow1.position.set(0, CH + RA * 0.5, -CD * 0.25);
    this.#scene.add(this.#luzGlow1);

    this.#luzGlow2 = new THREE.PointLight(0xFFDD66, 0, 6);
    this.#luzGlow2.position.set(0, CH + RA * 0.5, CD * 0.25);
    this.#scene.add(this.#luzGlow2);

    /* CenÃ¡rio */
    this.#cenario = new CenarioBuilder(this.#scene);
    this.#cenario.construir();

    /* Arrays solares */
    this.#array1 = new SolarArrayBuilder(this.#scene, 'front');
    this.#array1.criarTrilhos();
    this.#array1.criarInversor();
    this.#array1.criarCabo();
    this.#array1.criarPaineis();

    this.#array2 = new SolarArrayBuilder(this.#scene, 'back');
    this.#array2.criarTrilhos();
    this.#array2.criarInversor();
    this.#array2.criarCabo();
    this.#array2.criarPaineis();

    /* Rig cÃ¢mera */
    this.#rig = new CameraRig(this.#camera);
    this.#rig.definirTargets(this.#cenario);

    const ro = new ResizeObserver(() => this.#onResize());
    ro.observe(this.#canvas.parentElement ?? this.#canvas);
  }

  #onResize() {
    if (!this.#renderer) return;
    const W = this.#canvas.clientWidth  || 400;
    const H = this.#canvas.clientHeight || 300;
    this.#renderer.setSize(W, H);
    this.#camera.aspect = W / H;
    this.#camera.updateProjectionMatrix();
  }

  /* â”€â”€ API pÃºblica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  iniciar() {
    if (!this.#renderer) return;
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#estagio   = 0;
    this.#progresso = 0;
    this.#orbitaT   = 0;
    const now = performance.now();
    this.#tsEstagio = now;
    this.#tsUlt     = now;
    this.#raf = requestAnimationFrame(ts => this.#loop(ts));
  }

  reiniciar() { this.iniciar(); }

  parar() { if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = null; } }

  /* â”€â”€ Loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  #loop(ts) {
    const dt = Math.min(ts - this.#tsUlt, 50);
    this.#tsUlt = ts;

    const dur = AnimacaoMontagem.#DUR[this.#estagio] ?? Infinity;
    if (isFinite(dur)) {
      this.#progresso = Math.min((ts - this.#tsEstagio) / dur, 1);
    } else {
      this.#orbitaT += dt * 0.00005;
    }

    this.#atualizar(dt);
    this.#renderer.render(this.#scene, this.#camera);

    if (isFinite(dur) && this.#progresso >= 1) {
      this.#estagio++;
      this.#tsEstagio = ts;
      this.#progresso = 0;
    }

    this.#raf = requestAnimationFrame(t => this.#loop(t));
  }

  /* â”€â”€ LÃ³gica por estÃ¡gio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  #atualizar() {
    const p = this.#progresso;

    switch (this.#estagio) {
      case 0:
        this.#rig.atualizar(0, p);
        break;

      case 1:
        this.#rig.atualizar(1, p);
        this.#array1.animarTrilhos(p);
        break;

      case 2:
        this.#rig.atualizar(2, p);
        this.#array1.animarCabo(p);
        break;

      case 3:
        this.#rig.atualizar(3, p);
        this.#array1.animarInversor(p);
        break;

      case 4:
        this.#rig.atualizar(4, p);
        this.#array1.animarPaineis(p);
        break;

      case 5:
        this.#rig.atualizar(5, p);
        this.#luzGlow1.intensity = Math.sin(p * Math.PI * 2) * 1.2 + 0.6;
        break;

      case 6:
        this.#rig.atualizar(6, p);
        this.#luzGlow1.intensity = Math.max(0, 1 - p * 2);
        break;

      case 7:
        this.#rig.atualizar(7, p);
        this.#array2.animarTrilhos(Math.min(p / 0.23, 1));
        this.#array2.animarCabo(Math.min(Math.max((p - 0.23) / 0.15, 0), 1));
        this.#array2.animarInversor(Math.min(Math.max((p - 0.38) / 0.12, 0), 1));
        this.#array2.animarPaineis(Math.min(Math.max((p - 0.50) / 0.50, 0), 1));
        if (p > 0.85) this.#luzGlow2.intensity = Math.sin((p - 0.85) / 0.15 * Math.PI) * 1.2;
        break;

      case 8:
        this.#rig.atualizar(8, p);
        break;

      case 9:
        this.#rig.atualizar(9, p);
        this.#animarQuadro(p);
        break;

      case 10:
        this.#rig.atualizar(10, 1);
        this.#animarDisjuntor(p);
        break;

      case 11:
        this.#rig.orbitar(this.#orbitaT);
        break;
    }
  }

  #animarQuadro(p) {
    const quadro = this.#scene.getObjectByName('quadro');
    if (quadro) { const s = this.#ease(p); quadro.scale.set(s, s, s); }
    const disj  = this.#scene.getObjectByName('disjuntor');
    if (disj)  { const s = this.#ease(Math.max(0, (p - 0.5) * 2)); disj.scale.set(s, s, s); }
  }

  #animarDisjuntor(p) {
    const disj = this.#scene.getObjectByName('disjuntor');
    if (disj) disj.rotation.z = p * Math.PI * 0.4;

    const i = this.#ease(p) * 1.8;
    if (this.#cenario.luzJanela1) this.#cenario.luzJanela1.intensity = i;
    if (this.#cenario.luzJanela2) this.#cenario.luzJanela2.intensity = i;
    if (this.#cenario.luzPoste)   this.#cenario.luzPoste.intensity   = this.#ease(p) * 2;
  }

  #ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
}
