'use strict';

/* =====================================================================
   AnimacaoMontagem — Three.js r134
   Arquitetura:
     MaterialLibrary  — texturas PBR procedurais
     Ground           — solo, calçada
     Foundation       — laje de fundação
     Walls            — paredes + empenas
     Roof             — telhado duas águas + cumeeira + beiral
     Windows          — janelas com moldura + vidro
     Door             — porta de entrada + degrau
     Chimney          — chaminé decorativa
     Garden           — arbustos, árvore
     Pole             — poste de rua + fiação
     SolarRoofSystem  — trilhos e painéis solares auto-calculados
     HouseBuilder     — orquestra todos os módulos
     SceneManager     — renderer, câmera, luzes
     AnimacaoMontagem — fachada pública
   API: constructor(canvas) · iniciar() · reiniciar() · parar()
   ===================================================================== */

/* ─────────────────────────────────────────────────────────────────────
   CONSTANTES GLOBAIS DA CENA
   Origin (0,0,0) = centro da fundação ao nível do solo.
   Y = cima  |  Z = profundidade (frente = -Z)  |  X = largura
   ───────────────────────────────────────────────────────────────────── */
const CASA = Object.freeze({
  W:  7.2,    // largura (X)
  D:  10.0,   // profundidade (Z)
  H:  3.8,    // altura das paredes
  RA: 2.4,    // altura do cumeeira acima do topo das paredes
  FH: 0.5,    // altura da fundação
  EV: 0.55,   // projeção do beiral
  WT: 0.28,   // espessura das paredes
});

/* ─────────────────────────────────────────────────────────────────────
   Helpers
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

  /* Telha cerâmica arredondada */
  static telha() {
    const tex = MaterialLibrary.#tex('telha', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#7a2d1a';
      ctx.fillRect(0, 0, w, h);
      const cols = 8, rows = 12;
      const tW = w / cols, tH = h / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (tW * 0.5);
        for (let c = 0; c < cols + 1; c++) {
          const x = c * tW - off, y = r * tH;
          const hue = 11 + Math.sin(r * 5 + c * 9) * 5;
          const lit = 28 + Math.sin(r * 2.1 + c * 7.3) * 8;
          const g = ctx.createLinearGradient(x, y, x, y + tH);
          g.addColorStop(0,   `hsl(${hue},65%,${lit + 12}%)`);
          g.addColorStop(0.45,`hsl(${hue},60%,${lit}%)`);
          g.addColorStop(1,   `hsl(${hue},55%,${lit - 10}%)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x + tW * 0.5, y + tH * 0.6, tW * 0.46, tH * 0.54, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      // Sombra difusa para profundidade
      const shadow = ctx.createLinearGradient(0, 0, 0, h);
      shadow.addColorStop(0, 'rgba(0,0,0,0.0)');
      shadow.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, w, h);
    });
    tex.repeat.set(6, 5);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.03, side: THREE.DoubleSide });
  }

  /* Telha para fundo (face interna visível) */
  static telhaBack() {
    const m = MaterialLibrary.telha().clone();
    m.side = THREE.BackSide;
    return m;
  }

  /* Alvenaria rebocada com textura granulada */
  static reboco() {
    const tex = MaterialLibrary.#tex('reboco', 1024, 1024, (ctx, w, h) => {
      // Base creme-areia
      ctx.fillStyle = '#e8dfc8';
      ctx.fillRect(0, 0, w, h);
      // Granulado fino
      for (let i = 0; i < 18000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = Math.random() * 2.5;
        const v = (Math.random() - 0.5) * 30;
        ctx.fillStyle = `rgba(${148 + v | 0},${138 + v | 0},${122 + v | 0},0.18)`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Linhas de rejunte muito sutis (fiadas)
      ctx.strokeStyle = 'rgba(160,148,128,0.25)';
      ctx.lineWidth = 1.5;
      for (let y = 30; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y + (Math.random() - 0.5) * 3);
        ctx.lineTo(w, y + (Math.random() - 0.5) * 3);
        ctx.stroke();
      }
    });
    tex.repeat.set(4, 3);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
  }

  /* Vidro azul-esverdeado translúcido */
  static vidro() {
    return new THREE.MeshStandardMaterial({
      color: 0x8ecce8,
      roughness: 0.03,
      metalness: 0.08,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
    });
  }

  /* Madeira escura para molduras */
  static madeira() {
    const tex = MaterialLibrary.#tex('madeira', 256, 512, (ctx, w, h) => {
      for (let y = 0; y < h; y++) {
        const hue = 23 + Math.sin(y * 0.11) * 5;
        const lit = 20 + Math.sin(y * 0.08) * 9;
        ctx.fillStyle = `hsl(${hue},52%,${lit}%)`;
        ctx.fillRect(0, y, w, 1);
      }
      for (let i = 0; i < 60; i++) {
        const y = Math.random() * h, len = 20 + Math.random() * 80;
        ctx.strokeStyle = `rgba(0,0,0,0.07)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(len, y + (Math.random() - 0.5) * 4);
        ctx.stroke();
      }
    });
    tex.repeat.set(2, 4);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.0 });
  }

  /* Concreto cinza */
  static concreto() {
    const tex = MaterialLibrary.#tex('concreto', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#b8b0a0';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const v = (Math.random() - 0.5) * 28;
        ctx.fillStyle = `rgba(${138 + v | 0},${130 + v | 0},${118 + v | 0},0.22)`;
        ctx.fillRect(x, y, 3, 3);
      }
    });
    tex.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0.0 });
  }

  /* Relva */
  static relva() {
    const tex = MaterialLibrary.#tex('relva', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2a5519';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 12000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const hue = 95 + Math.random() * 38, sat = 35 + Math.random() * 30, lit = 16 + Math.random() * 22;
        ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
        ctx.fillRect(x, y, 2, 2);
      }
    });
    tex.repeat.set(16, 16);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 });
  }

  /* Calçada de pedra */
  static calcada() {
    const tex = MaterialLibrary.#tex('calcada', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#c0b6a4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#9e9382';
      ctx.lineWidth = 2.5;
      const bw = 50, bh = 30;
      for (let row = 0; row * bh < h; row++) {
        const offX = (row % 2) * (bw * 0.5);
        for (let col = -1; col * bw < w + bw; col++) {
          const x = col * bw + offX, y = row * bh;
          const v = (Math.random() - 0.5) * 15;
          ctx.fillStyle = `rgba(${185 + v | 0},${178 + v | 0},${164 + v | 0},1)`;
          ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
          ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
        }
      }
    });
    tex.repeat.set(3, 5);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.0 });
  }

  /* Metal cinza claro (poste, cumeeira) */
  static metal() {
    return new THREE.MeshStandardMaterial({ color: 0xa8bcc8, roughness: 0.22, metalness: 0.9 });
  }

  static metalEscuro() {
    return new THREE.MeshStandardMaterial({ color: 0x4a5a68, roughness: 0.3, metalness: 0.85 });
  }

  static aluminio() {
    return new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.15, metalness: 0.96 });
  }

  /* Placa de quadro elétrico (parede lateral) */
  static marcacaoQuadro() {
    const tex = MaterialLibrary.#tex('quadro_area', 128, 192, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255,200,0,0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,180,0,0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = 'rgba(255,190,0,0.55)';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('QE', w / 2, h / 2 + 7);
    });
    return new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.9, metalness: 0.0,
      transparent: true, opacity: 0.85,
      depthWrite: false,
    });
  }

  static cabo() {
    return new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.72, metalness: 0.1 });
  }

  static dispose() {
    for (const t of MaterialLibrary.#cache.values()) t.dispose();
    MaterialLibrary.#cache.clear();
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Ground — solo plano, calçada e entrada
   ───────────────────────────────────────────────────────────────────── */
class Ground {
  constructor(grp) {
    // Solo
    const campo = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      MaterialLibrary.relva()
    );
    campo.rotation.x = -Math.PI / 2;
    campo.receiveShadow = true;
    grp.add(campo);

    // Calçada dianteira
    const calc = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.06, 6.0),
      MaterialLibrary.calcada()
    );
    calc.position.set(0, 0.03, -CASA.D / 2 - 3.4);
    calc.receiveShadow = true;
    grp.add(calc);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Foundation — laje de concreto
   ───────────────────────────────────────────────────────────────────── */
class Foundation {
  constructor(grp) {
    const { W, D, FH } = CASA;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.35, FH, D + 0.35),
      MaterialLibrary.concreto()
    );
    m.position.y = FH / 2;
    m.castShadow = m.receiveShadow = true;
    grp.add(m);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Walls — paredes principais + empenas triangulares
   Parede lateral direita (x = +W/2) é reservada para o quadro elétrico
   e NÃO recebe janelas.
   ───────────────────────────────────────────────────────────────────── */
class Walls {
  constructor(grp) {
    const { W, H, D, FH, RA, WT } = CASA;
    const mat  = MaterialLibrary.reboco();
    const yMid = FH + H / 2;

    // Parede frontal (Z = -D/2)
    const wFront = new THREE.Mesh(new THREE.BoxGeometry(W, H, WT), mat);
    wFront.position.set(0, yMid, -D / 2);
    wFront.castShadow = wFront.receiveShadow = true;
    grp.add(wFront);

    // Parede traseira (Z = +D/2)
    const wBack = new THREE.Mesh(new THREE.BoxGeometry(W, H, WT), mat);
    wBack.position.set(0, yMid, D / 2);
    wBack.castShadow = wBack.receiveShadow = true;
    grp.add(wBack);

    // Parede lateral esquerda (X = -W/2) — sem janelas, futura área de jardim
    const wLeft = new THREE.Mesh(new THREE.BoxGeometry(WT, H, D), mat);
    wLeft.position.set(-W / 2, yMid, 0);
    wLeft.castShadow = wLeft.receiveShadow = true;
    grp.add(wLeft);

    // Parede lateral DIREITA (X = +W/2) — RESERVADA para quadro elétrico (sem janelas)
    const wRight = new THREE.Mesh(new THREE.BoxGeometry(WT, H, D), mat);
    wRight.position.set(W / 2, yMid, 0);
    wRight.castShadow = wRight.receiveShadow = true;
    grp.add(wRight);

    // Marcação visual do local do quadro elétrico (parede direita)
    const qeMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.8),
      MaterialLibrary.marcacaoQuadro()
    );
    qeMarker.position.set(W / 2 + 0.01, FH + H * 0.55, -D * 0.28);
    qeMarker.rotation.y = Math.PI / 2;
    grp.add(qeMarker);

    // Empenas triangulares nas testeiras (frente e trás)
    for (const [zPos, flip] of [[-D / 2, false], [D / 2, true]]) {
      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0);
      shape.lineTo( W / 2, 0);
      shape.lineTo(0, RA);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: WT, bevelEnabled: false });
      const emp = new THREE.Mesh(geo, mat);
      emp.position.set(0, FH + H, flip ? D / 2 - WT : -D / 2);
      if (flip) emp.rotation.y = Math.PI;
      emp.castShadow = true;
      grp.add(emp);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Roof — duas águas com cumeeira ao longo de Z
   roofY(x): altura exata da superfície do telhado na posição X
   roofPoint(x,z,offset): ponto 3D na superfície + offset normal
   ───────────────────────────────────────────────────────────────────── */
class Roof {
  static roofY(xWorld) {
    const { FH, H, RA, W } = CASA;
    return FH + H + RA * (1 - Math.abs(xWorld) / (W / 2));
  }

  static roofPoint(x, z, normalOffset = 0) {
    const { RA, W } = CASA;
    const slope = Math.atan2(RA, W / 2);
    const ny = Math.cos(slope);
    const nx = -Math.sign(x || -0.001) * Math.sin(slope);
    return v3(x + normalOffset * nx, Roof.roofY(x) + normalOffset * ny, z);
  }

  constructor(grp) {
    const { W, D, H, FH, RA, EV } = CASA;

    /* Pontos-chave do telhado */
    const eY  = FH + H;          // nível do beiral (topo da parede)
    const rY  = FH + H + RA;     // nível da cumeeira
    const eXl = -(W / 2 + EV);  // extremo esquerdo (com beiral lateral)
    const eXr =  (W / 2 + EV);  // extremo direito
    const eZf = -(D / 2 + EV);  // Z do beiral dianteiro
    const eZb =  (D / 2 + EV);  // Z do beiral traseiro

    /* Constrói um painel de telhado com BufferGeometry e normais corretas.
       Vértices em ordem CCW vista de fora: p0→p1→p2→p3 */
    const buildPane = (p0, p1, p2, p3) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([
          p0.x, p0.y, p0.z,
          p1.x, p1.y, p1.z,
          p2.x, p2.y, p2.z,
          p3.x, p3.y, p3.z,
        ]), 3
      ));
      geo.setIndex([0, 1, 2,  0, 2, 3]);
      geo.setAttribute('uv', new THREE.BufferAttribute(
        new Float32Array([0, 0,  0, 1,  1, 1,  1, 0]), 2
      ));
      geo.computeVertexNormals();
      return geo;
    };

    /* ── Água ESQUERDA (X < 0)
       Cumeeira em x=0; beiral em x=eXl
       Winding CCW visto de fora (−X): bl-frente → bl-trás → topo-trás → topo-frente
       → normal aponta para cima e para a esquerda (−X) ── */
    const left = new THREE.Mesh(
      buildPane(
        v3(eXl, eY, eZf),  // p0 frente-baixo esq.
        v3(eXl, eY, eZb),  // p1 trás-baixo esq.
        v3(0,   rY, eZb),  // p2 trás-topo (cumeeira)
        v3(0,   rY, eZf),  // p3 frente-topo (cumeeira)
      ),
      MaterialLibrary.telha()
    );
    left.castShadow = left.receiveShadow = true;
    grp.add(left);

    /* ── Água DIREITA (X > 0)
       Cumeeira em x=0; beiral em x=eXr
       Winding CCW visto de fora (+X): frente-baixo → topo-frente → topo-trás → trás-baixo
       → normal aponta para cima e para a direita (+X) ── */
    const right = new THREE.Mesh(
      buildPane(
        v3(eXr, eY, eZf),  // p0 frente-baixo dir.
        v3(0,   rY, eZf),  // p1 frente-topo (cumeeira)
        v3(0,   rY, eZb),  // p2 trás-topo (cumeeira)
        v3(eXr, eY, eZb),  // p3 trás-baixo dir.
      ),
      MaterialLibrary.telha()
    );
    right.castShadow = right.receiveShadow = true;
    grp.add(right);

    /* ── Cumeeira cilíndrica (ao longo de Z) ── */
    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, D + EV * 2 + 0.1, 8),
      MaterialLibrary.metalEscuro()
    );
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(0, rY + 0.05, 0);
    ridge.castShadow = true;
    grp.add(ridge);

    /* ── Tabeiras laterais (cobrem o beiral esq./dir.) ── */
    for (const side of [-1, 1]) {
      const tabeira = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, D + EV * 2 + 0.1),
        MaterialLibrary.madeira()
      );
      tabeira.position.set(side * (W / 2 + EV * 0.5), eY + 0.05, 0);
      tabeira.castShadow = true;
      grp.add(tabeira);
    }

    /* ── Beirais dianteiro e traseiro (ao longo de X, nas empenas) ── */
    for (const sign of [-1, 1]) {
      const beiral = new THREE.Mesh(
        new THREE.BoxGeometry(W + EV * 2 + 0.1, 0.12, 0.2),
        MaterialLibrary.madeira()
      );
      beiral.position.set(0, eY + 0.04, sign * (D / 2 + EV * 0.88));
      grp.add(beiral);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Windows — janela com moldura, vidro, travessas e peitoril
   ───────────────────────────────────────────────────────────────────── */
class Windows {
  constructor(grp) {
    const { W, D, H, FH, WT } = CASA;
    const yWall = FH + H * 0.56;
    const matV  = MaterialLibrary.vidro();
    const matM  = MaterialLibrary.madeira();
    const matC  = MaterialLibrary.concreto();

    const makeWindow = (cx, cy, cz, ry) => {
      const wW = 1.05, wH = 1.1;

      // Moldura externa
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(wW + 0.16, wH + 0.16, WT + 0.06),
        matM
      );
      frame.position.set(cx, cy, cz);
      frame.rotation.y = ry;
      frame.castShadow = true;
      grp.add(frame);

      // Vidro
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(wW - 0.05, wH - 0.05),
        matV
      );
      glass.position.set(cx, cy, cz);
      glass.rotation.y = ry;
      // Offset para sair ligeiramente da moldura
      glass.position.x += Math.sin(ry) * 0.01;
      glass.position.z += Math.cos(ry) * 0.01;
      grp.add(glass);

      // Travessa horizontal central
      const travH = new THREE.Mesh(
        new THREE.BoxGeometry(wW - 0.04, 0.06, 0.06),
        matM
      );
      travH.position.set(cx, cy, cz);
      travH.rotation.y = ry;
      grp.add(travH);

      // Travessa vertical central
      const travV = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, wH - 0.04, 0.06),
        matM
      );
      travV.position.set(cx, cy, cz);
      travV.rotation.y = ry;
      grp.add(travV);

      // Peitoril
      const peitoril = new THREE.Mesh(
        new THREE.BoxGeometry(wW + 0.32, 0.08, 0.18),
        matC
      );
      peitoril.position.set(cx, cy - wH / 2 - 0.02, cz);
      peitoril.rotation.y = ry;
      grp.add(peitoril);
    };

    // Fachada frontal — 2 janelas
    makeWindow(-W / 3.1, yWall, -D / 2 - 0.015, 0);
    makeWindow( W / 3.1, yWall, -D / 2 - 0.015, 0);

    // Fachada traseira — 1 janela central
    makeWindow(0, yWall, D / 2 + 0.015, Math.PI);

    // Parede lateral esquerda — 1 janela (parede direita SEM janela = quadro elétrico)
    makeWindow(-W / 2 - 0.015, yWall, D * 0.1, -Math.PI / 2);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Door — porta de entrada com batente, folha e degrau
   ───────────────────────────────────────────────────────────────────── */
class Door {
  constructor(grp) {
    const { D, FH, WT } = CASA;
    const matM = MaterialLibrary.madeira();
    const matC = MaterialLibrary.concreto();

    // Batente
    const batente = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 2.22, WT + 0.08),
      matM
    );
    batente.position.set(0, FH + 1.11, -D / 2 - 0.01);
    batente.castShadow = true;
    grp.add(batente);

    // Folha da porta
    const folha = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 2.05, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x3d2408, roughness: 0.75, metalness: 0.0 })
    );
    folha.position.set(0.08, FH + 1.025, -D / 2 - WT * 0.5 - 0.04);
    folha.castShadow = true;
    grp.add(folha);

    // Maçaneta
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      MaterialLibrary.metal()
    );
    knob.position.set(0.42, FH + 1.05, -D / 2 - WT * 0.5 - 0.1);
    grp.add(knob);

    // Degrau de entrada
    const degrau = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.14, 0.42),
      matC
    );
    degrau.position.set(0, FH + 0.07, -D / 2 - 0.3);
    degrau.receiveShadow = true;
    grp.add(degrau);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Chimney — chaminé decorativa com capa metálica
   ───────────────────────────────────────────────────────────────────── */
class Chimney {
  constructor(grp) {
    const { W, D } = CASA;
    const cx = W / 4, cz = D * 0.18;
    const yBase = Roof.roofY(cx) - 0.08;  // roofY agora depende de X

    // Corpo
    const corpo = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 1.7, 0.52),
      MaterialLibrary.concreto()
    );
    corpo.position.set(cx, yBase + 0.85, cz);
    corpo.castShadow = true;
    grp.add(corpo);

    // Tampa
    const tampa = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.1, 0.7),
      MaterialLibrary.metalEscuro()
    );
    tampa.position.set(cx, yBase + 1.72, cz);
    grp.add(tampa);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Garden — arbustos, árvore, canteiro
   ───────────────────────────────────────────────────────────────────── */
class Garden {
  constructor(grp) {
    const { W, D } = CASA;

    const matFolha  = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const matTronco = MaterialLibrary.madeira();

    // Arbustos no canto frontal
    for (const [x, z, r, col] of [
      [-W / 2 - 0.5, -D / 2 - 0.6, 0.55, 0x2a620e],
      [ W / 2 + 0.5, -D / 2 - 0.6, 0.55, 0x236010],
      [-W / 2 - 0.4,  D / 2 + 0.4, 0.42, 0x1e5c0c],
    ]) {
      const arbusto = new THREE.Mesh(
        new THREE.SphereGeometry(r, 9, 7),
        matFolha(col)
      );
      arbusto.position.set(x, r, z);
      arbusto.castShadow = true;
      grp.add(arbusto);
    }

    // Árvore
    const tronco = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.16, 2.6, 8),
      matTronco
    );
    tronco.position.set(-W / 2 - 2.6, 1.3, -D / 2 + 1.0);
    tronco.castShadow = true;
    grp.add(tronco);

    const copa = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 10, 8),
      matFolha(0x1e5c10)
    );
    copa.position.set(-W / 2 - 2.6, 3.4, -D / 2 + 1.0);
    copa.castShadow = true;
    grp.add(copa);

    // Canteiro ao lado da porta
    const canteiro = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.12, 0.8),
      MaterialLibrary.concreto()
    );
    canteiro.position.set(0.8, 0.06, -D / 2 - 0.5);
    grp.add(canteiro);
    const flor = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9 })
    );
    flor.position.set(0.8, 0.28, -D / 2 - 0.5);
    grp.add(flor);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Pole — poste de rua com luminária e fiação até a casa
   poleTop: Vector3 público para uso futuro (acender a luz)
   ───────────────────────────────────────────────────────────────────── */
class Pole {
  poleTop = new THREE.Vector3();

  constructor(grp) {
    const { W, D } = CASA;
    const px = W / 2 + 5.8, pz = -D * 0.38;

    // Haste principal
    const haste = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.12, 7.2, 8),
      MaterialLibrary.metal()
    );
    haste.position.set(px, 3.6, pz);
    haste.castShadow = true;
    grp.add(haste);

    // Braço
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1.3, 6),
      MaterialLibrary.metal()
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(px - 0.65, 7.35, pz);
    grp.add(arm);

    // Globo da luminária
    const globo = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfffbe0,
        emissive: new THREE.Color(0xffe080),
        emissiveIntensity: 0,
        roughness: 0.1,
        metalness: 0.0,
        transparent: true,
        opacity: 0.85,
      })
    );
    globo.position.set(px - 1.3, 7.28, pz);
    grp.add(globo);

    // Capota
    const capota = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.18, 0.25, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    capota.position.set(px - 1.3, 7.5, pz);
    grp.add(capota);

    this.poleTop.set(px - 1.3, 7.35, pz);

    // Fiação do poste até a casa
    const wc = new THREE.CatmullRomCurve3([
      v3(px - 1.3, 7.28, pz),
      v3(W / 2 + 3.2, 6.5, pz * 0.7),
      v3(W / 2 + 0.15, 5.8, 0),
    ]);
    grp.add(new THREE.Mesh(
      new THREE.TubeGeometry(wc, 28, 0.02, 5, false),
      MaterialLibrary.cabo()
    ));

    // Base de concreto do poste
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.2, 8),
      MaterialLibrary.concreto()
    );
    base.position.set(px, 0.1, pz);
    grp.add(base);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   SolarRoofSystem — trilhos de alumínio + painéis fotovoltaicos
   roofY(x)  = FH + H + RA*(1 - |x|/(W/2))       (nunca Y fixo)
   roofPoint(x,z,off=0.05) = {x, y:roofY(x)+off, z}  (offset só em Y)
   Layout: MARGIN=0.2, PANEL_W=1.1, PANEL_H=2.0, SPACING=0.1
   Água esq: x ∈ [-3.4, 0]  → 2 cols × 4 rows = 8 painéis
   Água dir: x ∈ [0, +3.4]  → 2 cols × 4 rows = 8 painéis
   Total: 16 painéis
   Orientação: setFromAxisAngle(Z, ±slope) — sem lookAt (evita inversão)
   DEBUG=true → esferas vermelhas + linhas verdes de validação
   ───────────────────────────────────────────────────────────────────── */
class SolarRoofSystem {
  static #MARGIN  = 0.2;
  static #PANEL_W = 1.1;
  static #PANEL_H = 2.0;
  static #SPACING = 0.1;
  static #OFFSET  = 0.05;
  static #DEBUG   = true;   // desativar após validação visual

  /* Y na superfície do telhado para |x| ≤ W/2 */
  static #roofY(x) {
    const { FH, H, RA, W } = CASA;
    return FH + H + RA * (1 - Math.abs(x) / (W / 2));
  }

  /* Ponto sobre o telhado — offset só em Y (spec) */
  static #roofPoint(x, z, offset = 0.05) {
    return new THREE.Vector3(x, SolarRoofSystem.#roofY(x) + offset, z);
  }

  /* Quaternion que alinha a face do painel ao slope da água (sem lookAt) */
  static #slopeQuat(side) {
    const { RA, W } = CASA;
    const angle = Math.atan2(RA, W / 2);          // ≈ 33.7°
    const axis  = new THREE.Vector3(0, 0, 1);     // roda em torno de Z
    return new THREE.Quaternion().setFromAxisAngle(axis, side * angle);
  }

  /* Helper: cilindro entre dois pontos 3D */
  static #cyl(p1, p2, r, mat) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 1e-4) return null;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
    m.position.addVectors(p1, p2).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    return m;
  }

  /* Textura canvas dos painéis fotovoltaicos */
  static #panelMat() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#101828';
    ctx.fillRect(0, 0, 512, 512);
    const COLS = 6, ROWS = 6;
    const cw = 512 / COLS - 3, ch = 512 / ROWS - 3;
    for (let r = 0; r < ROWS; r++) {
      for (let cl = 0; cl < COLS; cl++) {
        const cx = cl * (512 / COLS) + 1.5, cy = r * (512 / ROWS) + 1.5;
        const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
        g.addColorStop(0, '#1e3464'); g.addColorStop(0.5, '#162a58'); g.addColorStop(1, '#0e1e44');
        ctx.fillStyle = g;
        ctx.fillRect(cx, cy, cw, ch);
        ctx.strokeStyle = '#0a1020'; ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, cw, ch);
      }
    }
    ctx.strokeStyle = 'rgba(60,90,140,0.9)'; ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, 510, 510);
    return new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(c), roughness: 0.12, metalness: 0.52, side: THREE.DoubleSide,
    });
  }

  #buildSide(grp, side) {
    const M  = SolarRoofSystem.#MARGIN;
    const PW = SolarRoofSystem.#PANEL_W;
    const PH = SolarRoofSystem.#PANEL_H;
    const SP = SolarRoofSystem.#SPACING;
    const OF = SolarRoofSystem.#OFFSET;
    const { W, D, EV } = CASA;

    // Limites X desta água — cada água independente (corrige bug cols cruzando)
    const xMin = side === -1 ? -(W / 2 - M) : M;       // -3.4 ou +0.2
    const xMax = side === -1 ? -M            : W / 2 - M; // -0.2 ou +3.4
    const zMin = -(D / 2 + EV) + M;                     // -5.35
    const zMax =  (D / 2 + EV) - M;                     // +5.35

    const xRange = xMax - xMin;   // 3.2
    const zRange = zMax - zMin;   // 10.7

    const cols = Math.floor(xRange / (PW + SP));         // 2
    const rows = Math.floor(zRange / (PH + SP));         // 5

    // Posições X centradas na área útil da água
    const totalW = cols * PW + (cols - 1) * SP;
    const xStart = (xMin + xMax) / 2 - totalW / 2 + PW / 2;
    const panelXs = Array.from({ length: cols }, (_, i) => xStart + i * (PW + SP));

    // Posições Z centradas
    const totalH = rows * PH + (rows - 1) * SP;
    const zStart = -totalH / 2 + PH / 2;
    const panelZs = Array.from({ length: rows }, (_, i) => zStart + i * (PH + SP));

    const quat     = SolarRoofSystem.#slopeQuat(side);
    const panelMat = SolarRoofSystem.#panelMat();
    const railMat  = MaterialLibrary.aluminio();

    // Painéis + moldura (quaternion direto, sem lookAt)
    for (const x of panelXs) {
      for (const z of panelZs) {
        const pos = SolarRoofSystem.#roofPoint(x, z, OF);

        const panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), panelMat);
        panel.position.copy(pos);
        panel.quaternion.copy(quat);
        panel.castShadow = true;
        grp.add(panel);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.04, 0.02, PH + 0.04), railMat);
        frame.position.copy(pos);
        frame.quaternion.copy(quat);
        frame.castShadow = true;
        grp.add(frame);
      }
    }

    // 3 trilhos horizontais (Z fixo, percorrem X)
    const railZs = [
      panelZs[0] - PH / 2 - SP / 2,
      0,
      panelZs[rows - 1] + PH / 2 + SP / 2,
    ];
    for (const z of railZs) {
      const m = SolarRoofSystem.#cyl(
        SolarRoofSystem.#roofPoint(xMin, z, OF * 0.6),
        SolarRoofSystem.#roofPoint(xMax, z, OF * 0.6),
        0.025, railMat
      );
      if (m) grp.add(m);
    }

    // 4 trilhos verticais (X fixo, percorrem Z)
    const railXs = [xMin, ...panelXs.map(x => x + PW / 2 + SP / 2).slice(0, cols - 1), xMax];
    for (const x of railXs) {
      const m = SolarRoofSystem.#cyl(
        SolarRoofSystem.#roofPoint(x, zMin, OF * 0.6),
        SolarRoofSystem.#roofPoint(x, zMax, OF * 0.6),
        0.025, railMat
      );
      if (m) grp.add(m);
    }

    // DEBUG visual — esferas vermelhas nos centros + linhas verdes dos trilhos
    if (SolarRoofSystem.#DEBUG) {
      const sphGeo = new THREE.SphereGeometry(0.06, 6, 6);
      const dbgM   = new THREE.MeshBasicMaterial({ color: 0xff2200 });
      const lineM  = new THREE.LineBasicMaterial({ color: 0x00ff88 });
      for (const x of panelXs) {
        for (const z of panelZs) {
          const s = new THREE.Mesh(sphGeo, dbgM);
          s.position.copy(SolarRoofSystem.#roofPoint(x, z, 0.15));
          grp.add(s);
        }
      }
      for (const z of railZs) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          SolarRoofSystem.#roofPoint(xMin, z, 0.15),
          SolarRoofSystem.#roofPoint(xMax, z, 0.15),
        ]);
        grp.add(new THREE.Line(geo, lineM));
      }
      for (const x of railXs) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          SolarRoofSystem.#roofPoint(x, zMin, 0.15),
          SolarRoofSystem.#roofPoint(x, zMax, 0.15),
        ]);
        grp.add(new THREE.Line(geo, lineM));
      }
    }
  }

  constructor(grp) {
    for (const side of [-1, 1]) this.#buildSide(grp, side);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   HouseBuilder — orquestra todos os módulos da casa
   ───────────────────────────────────────────────────────────────────── */
class HouseBuilder {
  #scene;
  #grp;

  constructor(scene) {
    this.#scene = scene;
    this.#grp   = new THREE.Group();
    scene.add(this.#grp);
  }

  build() {
    new Ground(this.#grp);
    new Foundation(this.#grp);
    new Walls(this.#grp);
    new Roof(this.#grp);
    new Windows(this.#grp);
    new Door(this.#grp);
    new Chimney(this.#grp);
    new Garden(this.#grp);
    new Pole(this.#grp);
    new SolarRoofSystem(this.#grp);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   SceneManager — renderer WebGL, câmera, luzes e resize
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
    this.renderer.toneMappingExposure  = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog        = new THREE.FogExp2(0xb0d4f0, 0.014);

    this.camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 300);
    // Posição que revela fachada frontal e lateral direita (onde fica o quadro elétrico)
    this.camera.position.set(-10, 10, -20);
    this.camera.lookAt(0, CASA.FH + CASA.H * 0.5, 0);

    this.#setupLights();

    const ro = new ResizeObserver(() => this.#onResize());
    ro.observe(this.#canvas.parentElement ?? this.#canvas);
  }

  #setupLights() {
    // Luz ambiente quente
    this.scene.add(new THREE.AmbientLight(0xffe8cc, 0.55));

    // Sol principal — vem de noroeste alto
    const sun = new THREE.DirectionalLight(0xFFF0D0, 2.6);
    sun.position.set(-14, 28, -16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left   = -24;
    sun.shadow.camera.right  =  24;
    sun.shadow.camera.top    =  24;
    sun.shadow.camera.bottom = -24;
    sun.shadow.camera.near   =  1;
    sun.shadow.camera.far    = 80;
    sun.shadow.bias          = -0.0006;
    sun.shadow.normalBias    =  0.02;
    this.scene.add(sun);

    // Céu hemisférico
    this.scene.add(new THREE.HemisphereLight(0x88CCFF, 0x3a6b28, 0.52));

    // Luz de preenchimento no lado direito (ilumina parede do quadro)
    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.45);
    fill.position.set(16, 10, 8);
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
