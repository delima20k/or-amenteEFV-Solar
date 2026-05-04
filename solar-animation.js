'use strict';

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
class EasingFunctions {
  static outCubic(t)   { return 1 - Math.pow(1 - t, 3); }
  static outBounce(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1)        return n1 * t * t;
    if (t < 2 / d1)        return n1 * (t -= 1.5  / d1) * t + 0.75;
    if (t < 2.5 / d1)      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
  static inOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
  static clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
}

class GeometryUtils {
  static lerp(a, b, t)   { return a + (b - a) * t; }
  static lerpPt(p, q, t) { return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; }
  /** Interpolação bilinear em quad [tl, tr, br, bl]. u/v ∈ [0,1] */
  static quadPt(quad, u, v) {
    const [tl, tr, br, bl] = quad;
    const top = GeometryUtils.lerpPt(tl, tr, u);
    const bot = GeometryUtils.lerpPt(bl, br, u);
    return GeometryUtils.lerpPt(top, bot, v);
  }
}

/* ============================================================
   SOUND FX — Web Audio API (click de encaixe)
   ============================================================ */
class SoundFX {
  static #ctx = null;

  static #ac() {
    if (!this.#ctx) {
      try { this.#ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { /* sem áudio */ }
    }
    return this.#ctx;
  }

  static snap() {
    const ac = this.#ac();
    if (!ac) return;
    try {
      const dur  = 0.06;
      const buf  = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const data = buf.getChannelData(0);
      const tau  = ac.sampleRate * 0.007;
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / tau);
      }
      const src  = ac.createBufferSource();
      const gain = ac.createGain();
      src.buffer = buf;
      gain.gain.setValueAtTime(0.18, ac.currentTime);
      src.connect(gain);
      gain.connect(ac.destination);
      src.start();
    } catch { /* silent */ }
  }
}

/* ============================================================
   ROOF SCENE — fundo estático (casa + telhado)
   ============================================================ */
class RoofScene {
  #ctx; #w; #h;
  /** Quad [TL, TR, BR, BL] da face do telhado onde os painéis serão montados */
  #quad;

  constructor(ctx, w, h) {
    this.#ctx  = ctx;
    this.#w    = w;
    this.#h    = h;
    this.#quad = this.#buildQuad();
  }

  #buildQuad() {
    const w = this.#w, h = this.#h;
    return [
      { x: w * 0.28, y: h * 0.16 },   // TL — cumeeira esquerda
      { x: w * 0.89, y: h * 0.27 },   // TR — cumeeira direita
      { x: w * 0.89, y: h * 0.56 },   // BR — calha direita
      { x: w * 0.28, y: h * 0.45 },   // BL — calha esquerda
    ];
  }

  get quad()       { return this.#quad; }
  point(u, v)      { return GeometryUtils.quadPt(this.#quad, u, v); }

  draw() {
    const ctx = this.#ctx, w = this.#w, h = this.#h;

    /* --- Céu --- */
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.78);
    sky.addColorStop(0, '#04091a');
    sky.addColorStop(1, '#0d2240');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    /* Estrelas */
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [su, sv] of [
      [0.06,0.04],[0.21,0.07],[0.40,0.02],[0.57,0.09],[0.74,0.04],
      [0.87,0.07],[0.14,0.12],[0.65,0.11],[0.93,0.13],[0.32,0.05],
    ]) {
      ctx.beginPath();
      ctx.arc(su * w, sv * h, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Lua */
    ctx.save();
    ctx.beginPath();
    ctx.arc(w * 0.10, h * 0.08, h * 0.025, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,240,180,0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(255,240,150,0.4)';
    ctx.fill();
    ctx.restore();

    /* --- Solo --- */
    const ground = ctx.createLinearGradient(0, h * 0.78, 0, h);
    ground.addColorStop(0, '#0a160a');
    ground.addColorStop(1, '#050b05');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);

    /* --- Parede lateral esquerda (profundidade 3D) --- */
    ctx.fillStyle = '#0e1c2c';
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.78);
    ctx.lineTo(w * 0.05, h * 0.49);
    ctx.lineTo(w * 0.28, h * 0.45);   // BL do quad
    ctx.lineTo(w * 0.28, h * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a3050';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    /* --- Parede frontal --- */
    const wallGrad = ctx.createLinearGradient(w * 0.28, h * 0.45, w * 0.28, h * 0.78);
    wallGrad.addColorStop(0, '#172030');
    wallGrad.addColorStop(1, '#111828');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(w * 0.28, h * 0.45, w * 0.61, h * 0.33);
    ctx.strokeStyle = '#1e3050';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(w * 0.28, h * 0.45, w * 0.61, h * 0.33);

    /* --- Face esquerda do telhado (triângulo de profundidade) --- */
    ctx.fillStyle = '#0a1620';
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.49);
    ctx.lineTo(w * 0.28, h * 0.16);   // TL quad
    ctx.lineTo(w * 0.28, h * 0.45);   // BL quad
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#152232';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    /* --- Face do telhado (onde os painéis serão montados) --- */
    const [tl, tr, br, bl] = this.#quad;
    const roofGrad = ctx.createLinearGradient(tl.x, tl.y, br.x, br.y);
    roofGrad.addColorStop(0, '#183050');
    roofGrad.addColorStop(1, '#0c1e38');
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#223848';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* --- Cumeeira --- */
    ctx.save();
    ctx.strokeStyle = '#2a4870';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.49);
    ctx.lineTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.stroke();
    ctx.restore();

    /* --- Janelas --- */
    this.#drawWindow(w * 0.37, h * 0.52, w * 0.10, h * 0.09);
    this.#drawWindow(w * 0.60, h * 0.52, w * 0.10, h * 0.09);

    /* --- Porta --- */
    ctx.fillStyle = '#0a1420';
    ctx.fillRect(w * 0.74, h * 0.60, w * 0.07, h * 0.18);
    ctx.strokeStyle = '#1a2e48';
    ctx.lineWidth = 1;
    ctx.strokeRect(w * 0.74, h * 0.60, w * 0.07, h * 0.18);
    /* maçaneta */
    ctx.fillStyle = '#3a6090';
    ctx.beginPath();
    ctx.arc(w * 0.776, h * 0.69, h * 0.008, 0, Math.PI * 2);
    ctx.fill();
  }

  #drawWindow(x, y, ww, wh) {
    const ctx = this.#ctx;
    /* Luz quente dentro */
    ctx.fillStyle = 'rgba(255,210,80,0.10)';
    ctx.fillRect(x, y, ww, wh);
    ctx.strokeStyle = '#1e3050';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, ww, wh);
    /* Divisórias */
    ctx.beginPath();
    ctx.moveTo(x + ww / 2, y);    ctx.lineTo(x + ww / 2, y + wh);
    ctx.moveTo(x, y + wh / 2);    ctx.lineTo(x + ww, y + wh / 2);
    ctx.stroke();
  }
}

/* ============================================================
   STRUCTURE ANIMATION — Fase 1 (trilhos metálicos)
   ============================================================ */
class StructureAnimation {
  #ctx; #scene;
  #progress = 0;
  static #RAIL_VS = [0.12, 0.50, 0.88];

  constructor(ctx, scene) {
    this.#ctx   = ctx;
    this.#scene = scene;
  }

  update(t) { this.#progress = t; }

  draw() {
    if (this.#progress <= 0) return;
    const ctx = this.#ctx;

    StructureAnimation.#RAIL_VS.forEach((v, i) => {
      const delay = i * 0.22;
      const railT = EasingFunctions.outCubic(
        EasingFunctions.clamp((this.#progress - delay) / (1 - delay * 0.7), 0, 1)
      );
      if (railT <= 0) return;

      const from = this.#scene.point(0, v);
      const to   = this.#scene.point(railT, v);

      /* Rail com brilho */
      ctx.save();
      ctx.shadowBlur  = 8;
      ctx.shadowColor = '#70aadd';
      ctx.strokeStyle = '#5090c0';
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();

      /* Suportes (brackets) ao longo do trilho */
      if (railT > 0.1) {
        const count = 5;
        for (let b = 0; b < count; b++) {
          const bu = (b + 0.5) / count;
          if (bu > railT) break;
          const bp = this.#scene.point(bu, v);
          const ba = EasingFunctions.clamp((railT - bu) * 12, 0, 1);
          ctx.fillStyle = `rgba(100,180,255,${ba * 0.85})`;
          ctx.fillRect(bp.x - 3, bp.y - 2, 6, 4);
        }
      }
    });
  }
}

/* ============================================================
   CABLE ANIMATION — Fase 2 (cabeamento)
   ============================================================ */
class CableAnimation {
  #ctx; #scene; #h;
  #progress = 0;

  constructor(ctx, scene, h) {
    this.#ctx   = ctx;
    this.#scene = scene;
    this.#h     = h;
  }

  update(t) { this.#progress = t; }

  draw() {
    if (this.#progress <= 0) return;
    const ctx = this.#ctx;
    const t   = EasingFunctions.outCubic(this.#progress);

    /* Cabos horizontais na calha (v=0.93), vermelho e preto com stagger */
    const cables = [
      { color: '#bb2222', offset: -4, start: 0    },
      { color: '#1a1a1a', offset: +4, start: 0.15 },
    ];
    for (const c of cables) {
      const lt = EasingFunctions.clamp((t - c.start) / (1 - c.start * 0.8), 0, 1);
      if (lt <= 0) continue;
      const from = this.#scene.point(0.03, 0.93);
      const end  = this.#scene.point(0.94, 0.93);
      const to   = GeometryUtils.lerpPt(from, end, lt);
      ctx.save();
      ctx.shadowBlur  = 5;
      ctx.shadowColor = c.color;
      ctx.strokeStyle = c.color;
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + c.offset);
      ctx.lineTo(to.x,   to.y   + c.offset);
      ctx.stroke();
      ctx.restore();
    }

    /* Cabo descendo verticalmente até o inversor */
    if (t > 0.68) {
      const vt       = EasingFunctions.outCubic((t - 0.68) / 0.32);
      const startPt  = this.#scene.point(0.93, 0.93);
      const dropLen  = this.#h * 0.65 - startPt.y;

      for (const [color, ox] of [['#bb2222', -3], ['#1a1a1a', +3]]) {
        ctx.save();
        ctx.shadowBlur  = 4;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(startPt.x + ox, startPt.y);
        ctx.lineTo(startPt.x + ox, startPt.y + vt * dropLen);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

/* ============================================================
   INVERTER ANIMATION — Fase 3 (inversor)
   ============================================================ */
class InverterAnimation {
  #ctx; #w; #h;
  #progress = 0;

  constructor(ctx, w, h) {
    this.#ctx = ctx;
    this.#w   = w;
    this.#h   = h;
  }

  update(t) { this.#progress = t; }

  draw() {
    if (this.#progress <= 0) return;
    const ctx = this.#ctx;
    const t   = EasingFunctions.outCubic(this.#progress);
    const w   = this.#w, h = this.#h;

    const iw  = w * 0.09, ih = h * 0.11;
    const ix  = w * 0.835 - iw / 2;
    const iy  = h * 0.60 + (1 - t) * h * 0.12;

    ctx.globalAlpha = t;

    /* Sombra */
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ix + 4, iy + 4, iw, ih);

    /* Corpo */
    const grad = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
    grad.addColorStop(0, '#1e3a62');
    grad.addColorStop(1, '#0e2040');
    ctx.fillStyle = grad;
    ctx.fillRect(ix, iy, iw, ih);

    /* Display LED */
    const ledA = EasingFunctions.clamp((t - 0.45) / 0.55, 0, 1);
    ctx.fillStyle = `rgba(0,190,255,${ledA * 0.75})`;
    ctx.fillRect(ix + iw * 0.12, iy + ih * 0.12, iw * 0.76, ih * 0.38);

    /* Texto */
    if (t > 0.72) {
      const tA = (t - 0.72) / 0.28;
      ctx.fillStyle    = `rgba(160,230,255,${tA})`;
      ctx.font         = `bold ${Math.max(8, Math.floor(h * 0.022))}px monospace`;
      ctx.textAlign    = 'center';
      ctx.fillText('INV', ix + iw / 2, iy + ih * 0.83);
    }

    /* Borda */
    ctx.strokeStyle = '#3a80bf';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(ix, iy, iw, ih);

    ctx.globalAlpha = 1;
  }
}

/* ============================================================
   PANEL ANIMATION — Fases 4 e 5 (painéis + energia)
   ============================================================ */
class PanelAnimation {
  #ctx; #scene;
  #panels = [];
  #snapped = new Set();   // IDs de painéis que já tocaram som

  static #COLS = 3;
  static #ROWS = 2;

  constructor(ctx, scene) {
    this.#ctx   = ctx;
    this.#scene = scene;
    this.#buildPanels();
  }

  #buildPanels() {
    const cols = PanelAnimation.#COLS, rows = PanelAnimation.#ROWS;
    const gap  = 0.038;
    const uMin = gap, uMax = 1 - gap;
    const vMin = gap + 0.03, vMax = 1 - gap;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const u0 = GeometryUtils.lerp(uMin, uMax, c / cols);
        const u1 = GeometryUtils.lerp(uMin, uMax, (c + 1) / cols);
        const v0 = GeometryUtils.lerp(vMin, vMax, r / rows);
        const v1 = GeometryUtils.lerp(vMin, vMax, (r + 1) / rows);

        this.#panels.push({
          idx,
          corners: [
            this.#scene.point(u0, v0), // TL
            this.#scene.point(u1, v0), // TR
            this.#scene.point(u1, v1), // BR
            this.#scene.point(u0, v1), // BL
          ],
          delay:  idx * 0.13,
          drop:   0,
          energy: 0,
        });
      }
    }
  }

  update(t) {
    for (const p of this.#panels) {
      const lt = EasingFunctions.clamp((t - p.delay) / Math.max(0.01, 1 - p.delay * 0.8), 0, 1);
      p.drop = lt;
      if (lt >= 1 && !this.#snapped.has(p.idx)) {
        this.#snapped.add(p.idx);
        SoundFX.snap();
      }
    }
  }

  updateEnergy(t) {
    for (const [i, p] of this.#panels.entries()) {
      p.energy = EasingFunctions.clamp(t - i * 0.09, 0, 1);
    }
  }

  reset() {
    this.#snapped.clear();
    for (const p of this.#panels) { p.drop = 0; p.energy = 0; }
  }

  draw() {
    for (const p of this.#panels) {
      if (p.drop <= 0) continue;
      const bounced = EasingFunctions.outBounce(p.drop);
      /* Inicia 280px acima + leve escalonamento por índice */
      const startOff = -280 - p.idx * 15;
      const offsetY  = GeometryUtils.lerp(startOff, 0, bounced);
      const pts      = p.corners.map(pt => ({ x: pt.x, y: pt.y + offsetY }));
      this.#drawPanel(pts, p.energy, p.drop >= 1);
    }
  }

  #drawPanel(pts, energy, settled) {
    const ctx = this.#ctx;
    ctx.save();

    /* Sombra após encaixar */
    if (settled) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x + 4, p.y + 5) : ctx.lineTo(p.x + 4, p.y + 5));
      ctx.closePath();
      ctx.fill();
    }

    /* Corpo do painel */
    const [tl, tr, br, bl] = pts;
    const grad = ctx.createLinearGradient(tl.x, tl.y, br.x, br.y);
    grad.addColorStop(0,   '#0b2240');
    grad.addColorStop(0.5, '#153860');
    grad.addColorStop(1,   '#0b2240');
    ctx.fillStyle = grad;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();

    /* Grade de células (3 colunas × 4 linhas) */
    ctx.strokeStyle = 'rgba(25, 70, 130, 0.65)';
    ctx.lineWidth   = 0.5;
    for (let i = 1; i < 3; i++) {
      const f  = i / 3;
      const t0 = GeometryUtils.lerpPt(tl, tr, f);
      const t1 = GeometryUtils.lerpPt(bl, br, f);
      ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const f  = i / 4;
      const t0 = GeometryUtils.lerpPt(tl, bl, f);
      const t1 = GeometryUtils.lerpPt(tr, br, f);
      ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke();
    }

    /* Frame + glow de energia */
    const r = Math.round(GeometryUtils.lerp(55, 255, energy));
    const g = Math.round(GeometryUtils.lerp(130, 220, energy));
    if (energy > 0) {
      ctx.shadowBlur  = 16 * energy;
      ctx.shadowColor = '#50a8ff';
    }
    ctx.strokeStyle = `rgba(${r},${g},255,0.9)`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
}

/* ============================================================
   PHASE LABEL — indicador da fase atual
   ============================================================ */
class PhaseLabel {
  #ctx; #w; #h;
  #current = '';
  #alpha   = 0;
  #timer   = 0;

  static #SHOW_DURATION = 2.5;

  constructor(ctx, w, h) {
    this.#ctx = ctx;
    this.#w   = w;
    this.#h   = h;
  }

  set(text) {
    if (text === this.#current) return;
    this.#current = text;
    this.#timer   = 0;
  }

  update(dt) {
    this.#timer = Math.min(this.#timer + dt, PhaseLabel.#SHOW_DURATION + 0.5);
    const t = this.#timer;
    if (t < 0.3)                                        this.#alpha = t / 0.3;
    else if (t < PhaseLabel.#SHOW_DURATION)             this.#alpha = 1;
    else if (t < PhaseLabel.#SHOW_DURATION + 0.5)       this.#alpha = 1 - (t - PhaseLabel.#SHOW_DURATION) / 0.5;
    else                                                this.#alpha = 0;
  }

  draw(isActive) {
    if (!this.#current || this.#alpha <= 0) return;
    const ctx  = this.#ctx, w = this.#w, h = this.#h;
    const size = Math.max(11, Math.floor(h * 0.038));
    ctx.save();
    ctx.globalAlpha = this.#alpha;
    ctx.font        = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign   = 'left';
    const color     = isActive ? 'rgba(60,220,100,0.95)' : 'rgba(100,200,255,0.9)';
    if (isActive) { ctx.shadowBlur = 10; ctx.shadowColor = '#30d060'; }
    ctx.fillStyle   = color;
    ctx.fillText(`● ${this.#current}`, w * 0.04, h * 0.95);
    ctx.restore();
  }
}

/* ============================================================
   ENERGY FLOW ANIMATION — Fase 6 (partículas no cabo AC)
   ============================================================ */
class EnergyFlowAnimation {
  #ctx; #scene; #w; #h;
  #progress = 0;
  #time     = 0;
  #path     = null;
  #totalLen = 0;

  constructor(ctx, scene, w, h) {
    this.#ctx   = ctx;
    this.#scene = scene;
    this.#w     = w;
    this.#h     = h;
    this.#buildPath();
  }

  /** Waypoints: saída calha → drop → inversor → quadro elétrico */
  #buildPath() {
    const w = this.#w, h = this.#h;
    this.#path = [
      this.#scene.point(0.50, 0.93),
      this.#scene.point(0.94, 0.93),
      { x: w * 0.835, y: h * 0.60  },
      { x: w * 0.835, y: h * 0.655 },
      { x: w * 0.58,  y: h * 0.655 },
      { x: w * 0.50,  y: h * 0.655 },
    ];
    this.#totalLen = this.#calcLen(this.#path.length - 1);
  }

  #calcLen(upToIdx) {
    let len = 0;
    for (let i = 1; i <= upToIdx; i++) {
      const dx = this.#path[i].x - this.#path[i - 1].x;
      const dy = this.#path[i].y - this.#path[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  #pointAt(frac) {
    let target = frac * this.#totalLen;
    for (let i = 1; i < this.#path.length; i++) {
      const dx  = this.#path[i].x - this.#path[i - 1].x;
      const dy  = this.#path[i].y - this.#path[i - 1].y;
      const seg = Math.sqrt(dx * dx + dy * dy);
      if (target <= seg) {
        const t = seg > 0 ? target / seg : 0;
        return { x: this.#path[i - 1].x + dx * t, y: this.#path[i - 1].y + dy * t };
      }
      target -= seg;
    }
    return { ...this.#path[this.#path.length - 1] };
  }

  update(t)    { this.#progress = t; }
  tick(dt)     { this.#time += dt; }
  reset()      { this.#progress = 0; this.#time = 0; }

  draw() {
    if (this.#progress <= 0) return;
    const t = EasingFunctions.outCubic(this.#progress);
    this.#drawCable(t);
    this.#drawParticles(t);
  }

  #drawCable(t) {
    const ctx    = this.#ctx;
    const maxD   = t * this.#totalLen;
    let traveled = 0;
    ctx.save();
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#ff9900';
    ctx.strokeStyle = '#ff7700';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.#path[0].x, this.#path[0].y);
    for (let i = 1; i < this.#path.length; i++) {
      const dx  = this.#path[i].x - this.#path[i - 1].x;
      const dy  = this.#path[i].y - this.#path[i - 1].y;
      const seg = Math.sqrt(dx * dx + dy * dy);
      if (traveled + seg <= maxD) {
        ctx.lineTo(this.#path[i].x, this.#path[i].y);
        traveled += seg;
      } else {
        const f = seg > 0 ? (maxD - traveled) / seg : 0;
        ctx.lineTo(this.#path[i - 1].x + dx * f, this.#path[i - 1].y + dy * f);
        break;
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  #drawParticles(revealT) {
    const ctx = this.#ctx;
    const N   = 5;
    const spd = 0.55;   // ciclos por segundo
    for (let i = 0; i < N; i++) {
      const frac = ((this.#time * spd + i / N) % 1);
      if (frac > revealT) continue;
      const pos = this.#pointAt(frac);
      const brightness = 0.6 + 0.4 * Math.sin(this.#time * 8 + i * 1.3);
      ctx.save();
      ctx.shadowBlur  = 16;
      ctx.shadowColor = '#ffe040';
      ctx.fillStyle   = `rgba(255,225,60,${brightness})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/* ============================================================
   CAMERA CONTROLLER — Fase 7 (pan para parede / quadro)
   ============================================================ */
class CameraController {
  #w; #h;
  #progress = 0;
  static #FOCUS_UX = 0.50;
  static #FOCUS_UY = 0.67;
  static #ZOOM_MAX = 1.68;

  constructor(w, h) { this.#w = w; this.#h = h; }

  update(t) { this.#progress = EasingFunctions.inOutCubic(t); }
  reset()   { this.#progress = 0; }

  applyTransform(ctx) {
    if (this.#progress <= 0) return;
    const t  = this.#progress;
    const w  = this.#w, h = this.#h;
    const fx = w * CameraController.#FOCUS_UX;
    const fy = h * CameraController.#FOCUS_UY;
    const zoom = GeometryUtils.lerp(1, CameraController.#ZOOM_MAX, t);
    const cx   = GeometryUtils.lerp(w / 2, fx, t);
    const cy   = GeometryUtils.lerp(h / 2, fy, t);
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
  }
}

/* ============================================================
   ELECTRICAL PANEL ANIMATION — Fase 7/8 (quadro + disjuntores)
   ============================================================ */
class ElectricalPanelAnimation {
  #ctx; #w; #h;
  #showProgress    = 0;
  #breakerProgress = 0;

  constructor(ctx, w, h) { this.#ctx = ctx; this.#w = w; this.#h = h; }

  updateShow(t)     { this.#showProgress    = EasingFunctions.outCubic(t); }
  updateBreakers(t) { this.#breakerProgress = t; }
  reset() { this.#showProgress = 0; this.#breakerProgress = 0; }

  draw() {
    if (this.#showProgress <= 0) return;
    const ctx = this.#ctx, w = this.#w, h = this.#h;
    const t   = this.#showProgress;
    const pw  = w * 0.115, ph = h * 0.175;
    const px  = w * 0.443;
    const py  = h * 0.535 + (1 - t) * h * 0.10;

    ctx.save();
    ctx.globalAlpha = t;

    /* Sombra */
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(px + 5, py + 6, pw, ph);

    /* Corpo */
    const bg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    bg.addColorStop(0, '#1c2b3e');
    bg.addColorStop(1, '#0e1820');
    ctx.fillStyle = bg;
    ctx.fillRect(px, py, pw, ph);

    /* Etiqueta */
    ctx.fillStyle = `rgba(150,185,230,${t * 0.75})`;
    ctx.font      = `bold ${Math.max(7, Math.floor(h * 0.017))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('Q.E.', px + pw / 2, py + ph * 0.12);

    /* 3 disjuntores */
    const numB   = 3;
    const bw = pw * 0.20, bh = ph * 0.33;
    const bGap = pw / (numB + 1);
    for (let i = 0; i < numB; i++) {
      const bx    = px + bGap * (i + 1) - bw / 2;
      const by    = py + ph * 0.20;
      const delay = i / numB;
      const bt    = EasingFunctions.clamp(
        (this.#breakerProgress - delay) / Math.max(0.01, 1 - delay * 0.7), 0, 1
      );
      this.#drawBreaker(ctx, bx, by, bw, bh, bt, h);
    }

    /* Chave geral */
    this.#drawMainSwitch(ctx, px + pw * 0.5, py + ph * 0.83, pw * 0.34, ph * 0.11, this.#breakerProgress, h);

    /* Borda */
    ctx.strokeStyle = '#3a5878';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(px, py, pw, ph);

    ctx.restore();
  }

  #drawBreaker(ctx, x, y, bw, bh, activated, h) {
    ctx.fillStyle = activated > 0.5 ? 'rgba(12,35,18,1)' : 'rgba(22,20,35,1)';
    ctx.fillRect(x, y, bw, bh);

    /* Alavanca */
    const leverY = activated > 0.5 ? y + bh * 0.18 : y + bh * 0.58;
    ctx.fillStyle = activated > 0.5 ? '#50cc50' : '#cc3030';
    ctx.fillRect(x + bw * 0.2, leverY, bw * 0.6, bh * 0.22);

    /* LED */
    if (activated > 0) {
      ctx.save();
      ctx.shadowBlur  = 10 * activated;
      ctx.shadowColor = '#30ff50';
      ctx.fillStyle   = `rgba(50,220,70,${activated})`;
      ctx.beginPath();
      ctx.arc(x + bw / 2, y + bh * 0.88, Math.max(1.5, bw * 0.20), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#243244';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(x, y, bw, bh);
  }

  #drawMainSwitch(ctx, cx, cy, sw, sh, t, h) {
    const on = EasingFunctions.clamp(t * 1.6, 0, 1);
    ctx.fillStyle = on > 0.5 ? '#122818' : '#261616';
    ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
    if (on > 0) {
      ctx.save();
      ctx.shadowBlur  = 14 * on;
      ctx.shadowColor = '#00ff90';
      ctx.fillStyle   = `rgba(0,230,120,${on})`;
      ctx.beginPath();
      ctx.arc(cx + sw * 0.28, cy, Math.max(2, sh * 0.32), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#2e4460';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(cx - sw / 2, cy - sh / 2, sw, sh);
  }
}

/* ============================================================
   WINDOW GLOW ANIMATION — Fase 9 (janelas acendem)
   ============================================================ */
class WindowGlowAnimation {
  #ctx; #w; #h;
  #progress = 0;
  #time     = 0;

  static #WINDOWS = [
    { ux: 0.37, uy: 0.52, uw: 0.10, uh: 0.09 },
    { ux: 0.60, uy: 0.52, uw: 0.10, uh: 0.09 },
  ];

  constructor(ctx, w, h) { this.#ctx = ctx; this.#w = w; this.#h = h; }

  update(t)  { this.#progress = t; }
  tick(dt)   { this.#time += dt; }
  reset()    { this.#progress = 0; this.#time = 0; }

  draw() {
    if (this.#progress <= 0) return;
    const ctx = this.#ctx, w = this.#w, h = this.#h;
    const t   = EasingFunctions.outCubic(this.#progress);
    const pulse = 0.82 + 0.18 * Math.sin(this.#time * 3.2);

    for (const [i, win] of WindowGlowAnimation.#WINDOWS.entries()) {
      const delay = i * 0.28;
      const wt    = EasingFunctions.outCubic(
        EasingFunctions.clamp((t - delay) / Math.max(0.01, 1 - delay * 0.7), 0, 1)
      );
      if (wt <= 0) continue;

      const wx = w * win.ux, wy = h * win.uy;
      const ww = w * win.uw, wh = h * win.uh;
      const alpha = wt * pulse;

      ctx.save();
      ctx.shadowBlur  = 22 * wt;
      ctx.shadowColor = 'rgba(255,195,50,0.85)';

      const grd = ctx.createRadialGradient(
        wx + ww / 2, wy + wh / 2, 0,
        wx + ww / 2, wy + wh / 2, Math.max(ww, wh)
      );
      grd.addColorStop(0, `rgba(255,225,80,${alpha * 0.70})`);
      grd.addColorStop(1, `rgba(255,150,20,${alpha * 0.12})`);
      ctx.fillStyle = grd;
      ctx.fillRect(wx, wy, ww, wh);

      /* Halo externo */
      ctx.fillStyle = `rgba(255,185,40,${alpha * 0.10})`;
      ctx.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
      ctx.restore();
    }
  }
}

/* ============================================================
   ANIMATION CONTROLLER — orquestra todas as fases
   ============================================================ */
class AnimationController {
  #canvas; #ctx;
  #w = 0; #h = 0;
  #elapsed = 0;
  #lastTs  = 0;
  #rafId   = null;

  #scene;
  #structure;
  #cables;
  #inverter;
  #panels;
  #label;
  #energyFlow;
  #camera;
  #electricPanel;
  #windowGlow;
  #slowMode = false;

  /**
   * Timeline: segundo em que cada fase COMEÇA
   * Duração de cada fase (usada para calcular t 0→1)
   */
  static #TL = { p1: 0.2, p2: 2.0, p3: 3.8, p4: 5.2, p5: 8.4, p6: 10.5, p7: 12.0, p8: 14.2, p9: 15.8 };
  static #DU = { p1: 1.6, p2: 1.5, p3: 1.3, p4: 2.8, p5: 2.5, p6: 2.2,  p7: 2.2,  p8: 2.2,  p9: 2.5  };

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx    = canvas.getContext('2d');
    this.#setup();
    this.#rafId  = requestAnimationFrame(ts => this.#loop(ts));
  }

  #setup() {
    const dpr  = window.devicePixelRatio || 1;
    const rect  = this.#canvas.getBoundingClientRect();
    this.#w     = Math.round(rect.width  || this.#canvas.offsetWidth  || 400);
    this.#h     = Math.round(rect.height || this.#canvas.offsetHeight || 320);
    this.#canvas.width  = this.#w * dpr;
    this.#canvas.height = this.#h * dpr;
    this.#ctx.scale(dpr, dpr);
    this.#build();
  }

  #build() {
    const ctx = this.#ctx, w = this.#w, h = this.#h;
    this.#scene         = new RoofScene(ctx, w, h);
    this.#structure     = new StructureAnimation(ctx, this.#scene);
    this.#cables        = new CableAnimation(ctx, this.#scene, h);
    this.#inverter      = new InverterAnimation(ctx, w, h);
    this.#panels        = new PanelAnimation(ctx, this.#scene);
    this.#label         = new PhaseLabel(ctx, w, h);
    this.#energyFlow    = new EnergyFlowAnimation(ctx, this.#scene, w, h);
    this.#camera        = new CameraController(w, h);
    this.#electricPanel = new ElectricalPanelAnimation(ctx, w, h);
    this.#windowGlow    = new WindowGlowAnimation(ctx, w, h);
  }

  #loop(ts) {
    const rawDt = this.#lastTs > 0
      ? Math.min((ts - this.#lastTs) / 1000, 0.05)
      : 0;
    this.#lastTs  = ts;
    const dt = this.#slowMode ? rawDt * 0.06 : rawDt;
    this.#elapsed += dt;

    this.#update(dt);
    this.#draw();
    this.#rafId = requestAnimationFrame(t => this.#loop(t));
  }

  #phaseT(start, dur) {
    return EasingFunctions.clamp((this.#elapsed - start) / dur, 0, 1);
  }

  #update(dt) {
    const tl = AnimationController.#TL, du = AnimationController.#DU;
    const e  = this.#elapsed;

    this.#structure.update(this.#phaseT(tl.p1, du.p1));
    this.#cables.update(this.#phaseT(tl.p2, du.p2));
    this.#inverter.update(this.#phaseT(tl.p3, du.p3));
    this.#panels.update(this.#phaseT(tl.p4, du.p4));
    this.#panels.updateEnergy(this.#phaseT(tl.p5, du.p5));
    this.#energyFlow.update(this.#phaseT(tl.p6, du.p6));
    this.#energyFlow.tick(dt);
    this.#camera.update(this.#phaseT(tl.p7, du.p7));
    this.#electricPanel.updateShow(this.#phaseT(tl.p7, du.p7));
    this.#electricPanel.updateBreakers(this.#phaseT(tl.p8, du.p8));
    this.#windowGlow.update(this.#phaseT(tl.p9, du.p9));
    this.#windowGlow.tick(dt);

    /* Determina label da fase atual */
    let label = '', isActive = false;
    if      (e >= tl.p9) { label = 'Sistema em Operação ✓'; isActive = true; }
    else if (e >= tl.p8) { label = 'Disjuntor Ativado ⚡';   isActive = true; }
    else if (e >= tl.p7) { label = 'Quadro Elétrico'; }
    else if (e >= tl.p6) { label = 'Fluxo de Energia'; }
    else if (e >= tl.p5) { label = 'Sistema Ativo ⚡';       isActive = true; }
    else if (e >= tl.p4) { label = 'Painéis Solares'; }
    else if (e >= tl.p3) { label = 'Inversor'; }
    else if (e >= tl.p2) { label = 'Cabeamento'; }
    else if (e >= tl.p1) { label = 'Estrutura Metálica'; }

    this.#label.set(label);
    this.#label.update(dt);
  }

  #draw() {
    const ctx = this.#ctx, w = this.#w, h = this.#h;
    ctx.clearRect(0, 0, w, h);

    /* Aplicar transformação de câmera (pan p/ parede) */
    ctx.save();
    this.#camera.applyTransform(ctx);

    this.#scene.draw();
    this.#structure.draw();
    this.#cables.draw();
    this.#inverter.draw();
    this.#panels.draw();
    this.#energyFlow.draw();
    this.#electricPanel.draw();
    this.#windowGlow.draw();

    ctx.restore();

    /* HUD — sempre em screen space */
    const tl = AnimationController.#TL;
    const isActive = this.#elapsed >= tl.p5;
    this.#label.draw(isActive);
  }

  /** Coloca em modo lento (sheet aberta — animação continua em background) */
  pausar()   { this.#slowMode = true;  this.#canvas.classList.add('home-canvas--slow'); }

  /** Retoma velocidade normal */
  retomar()  { this.#slowMode = false; this.#canvas.classList.remove('home-canvas--slow'); }

  /** Reinicia a animação do zero */
  reiniciar() {
    this.#slowMode = false;
    this.#canvas.classList.remove('home-canvas--slow');
    this.#elapsed = 0;
    this.#lastTs  = 0;
    this.#panels.reset();
    this.#energyFlow.reset();
    this.#camera.reset();
    this.#electricPanel.reset();
    this.#windowGlow.reset();
  }

  /** Para o loop RAF e libera recursos */
  destroy() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }
}
