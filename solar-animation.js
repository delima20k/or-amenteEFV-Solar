'use strict';

/* =====================================================================
   AnimacaoMontagem — Canvas 2D
   Etapas:
     1  Estrutura metálica (1200ms)
     2  Cabos painéis→inversor (800ms)
     3  Inversor drop-in (600ms)
     4  Placas caindo em cascata (1600ms)
     5  Energia placas→inversor, 1500ms de "calor" antes de pan
     6  Câmera desce pela parede seguindo fio (1400ms)
     7  Quadro elétrico aparece (800ms)
     8  Disjuntor liga + luz acende (900ms)
     9  Cena final — loop, sem reinício automático
   ===================================================================== */
class AnimacaoMontagem {
  /* duração em ms por etapa (índice = número da etapa) */
  static #DUR = [0, 1200, 800, 600, 1600, 1500, 1400, 800, 900, Infinity];

  /* ---- campos privados ---- */
  #canvas; #ctx;
  #W = 0; #H = 0;

  #etapa     = 0;
  #progresso = 0;
  #tsEtapa   = 0;
  #tsUlt     = 0;
  #tsGlobal  = 0;

  #raf      = null;
  #audioCtx = null;

  /* câmera: offset Y aplicado a todo o desenho */
  #camY     = 0;
  #camYAlvo = 0;

  #geo = {};

  constructor(canvasEl) {
    this.#canvas = canvasEl;
    this.#ctx    = canvasEl.getContext('2d');
    this.#ajustarTamanho();

    const ro = new ResizeObserver(() => { this.#ajustarTamanho(); this.#desenhar(); });
    ro.observe(canvasEl.parentElement ?? canvasEl);

    requestAnimationFrame(() => this.iniciar());
  }

  /* ------------------------------------------------------------------ */
  iniciar() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#etapa     = 1;
    this.#progresso = 0;
    this.#camY      = 0;
    this.#camYAlvo  = 0;
    const now = performance.now();
    this.#tsEtapa  = now;
    this.#tsUlt    = now;
    this.#tsGlobal = now;
    this.#raf = requestAnimationFrame(ts => this.#loop(ts));
  }

  reiniciar() { this.iniciar(); }
  parar()     { if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = null; } }

  /* ================================================================
     LOOP
  ================================================================ */
  #loop(ts) {
    const dt = Math.min(ts - this.#tsUlt, 50);
    this.#tsUlt   = ts;
    this.#tsGlobal = ts;

    const dur = AnimacaoMontagem.#DUR[this.#etapa] ?? Infinity;

    if (isFinite(dur)) {
      this.#progresso = Math.min((ts - this.#tsEtapa) / dur, 1);
    } else {
      this.#progresso = ((ts - this.#tsEtapa) % 2000) / 2000;
    }

    /* suaviza câmera */
    this.#camY += (this.#camYAlvo - this.#camY) * Math.min(dt * 0.006, 1);

    this.#desenhar();

    if (isFinite(dur) && this.#progresso >= 1) {
      this.#avancarEtapa(ts);
    }

    this.#raf = requestAnimationFrame(t => this.#loop(t));
  }

  #avancarEtapa(ts) {
    this.#etapa++;
    this.#tsEtapa   = ts;
    this.#progresso = 0;

    if (this.#etapa === 4) {
      for (let i = 0; i < 6; i++) setTimeout(() => this.#tocarSom(820, 440, 0.18, 0.13), i * 220 + 80);
    }
    if (this.#etapa === 6) {
      this.#camYAlvo = -this.#geo.panDelta;
    }
    if (this.#etapa === 8) {
      setTimeout(() => this.#tocarSom(200, 60, 0.25, 0.08), 400);
      setTimeout(() => this.#tocarSom(1200, 800, 0.1, 0.06), 430);
    }
  }

  /* ================================================================
     DESENHO PRINCIPAL
  ================================================================ */
  #desenhar() {
    const ctx = this.#ctx;
    const { W, H } = this.#geo;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, this.#camY);

    this.#desenharCenario();

    if (this.#etapa >= 1) this.#etapa1_estrutura(this.#etapa > 1);
    if (this.#etapa >= 2) this.#etapa2_cabos(this.#etapa > 2);
    if (this.#etapa >= 3) this.#etapa3_inversor(this.#etapa > 3);
    if (this.#etapa >= 4) this.#etapa4_placas(this.#etapa > 4);
    if (this.#etapa >= 5) this.#etapa5_energia();
    if (this.#etapa >= 6) this.#etapa6_fioParede();
    if (this.#etapa >= 7) this.#etapa7_quadroAbre();
    if (this.#etapa >= 8) this.#etapa8_disjuntor();
    if (this.#etapa >= 9) this.#etapa9_final();

    ctx.restore();
  }

  get ctx() { return this.#ctx; }

  /* ================================================================
     CENÁRIO BASE — casa 3D com telhado realista
  ================================================================ */
  #desenharCenario() {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const { W, H } = g;

    /* ===== CÉU ===== */
    const ceu = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    ceu.addColorStop(0,   '#0a0e1a');
    ceu.addColorStop(0.5, '#0d1b35');
    ceu.addColorStop(1,   '#1a2744');
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, W, H * 0.72);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [sx, sy] of g.estrelas) {
      ctx.beginPath(); ctx.arc(sx, sy, 0.9, 0, Math.PI * 2); ctx.fill();
    }

    /* ===== SOL ===== */
    const solGrad = ctx.createRadialGradient(g.solX, g.solY, 0, g.solX, g.solY, g.solR);
    solGrad.addColorStop(0,   '#fff8e1');
    solGrad.addColorStop(0.4, '#FFE066');
    solGrad.addColorStop(1,   'rgba(255,184,0,0)');
    ctx.fillStyle = solGrad;
    ctx.beginPath(); ctx.arc(g.solX, g.solY, g.solR, 0, Math.PI * 2); ctx.fill();

    /* ===== CHÃO ===== */
    const gram = ctx.createLinearGradient(0, H * 0.72, 0, H + g.panDelta + 20);
    gram.addColorStop(0, '#2d5a27'); gram.addColorStop(1, '#1a3a16');
    ctx.fillStyle = gram;
    ctx.fillRect(0, H * 0.72, W, H * 0.28 + g.panDelta + 20);
    ctx.strokeStyle = '#3d7a35'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.lineTo(W, H * 0.72); ctx.stroke();

    /* Sombra projetada da casa no chão */
    const sombraGrd = ctx.createLinearGradient(
      0, g.casaYtopo + g.casaH, 0, g.casaYtopo + g.casaH + H * 0.04);
    sombraGrd.addColorStop(0, 'rgba(0,0,0,0.22)');
    sombraGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sombraGrd;
    ctx.fillRect(g.casaX + g.profX, g.casaYtopo + g.casaH,
                 g.casaW + g.profX, H * 0.04);

    /* ===== CASA — FACE LATERAL DIREITA (profundidade 3D) ===== */
    const { profX, profY, casaX, casaYtopo, casaW, casaH, panDelta } = g;
    const sideWallGrd = ctx.createLinearGradient(
      casaX + casaW, casaYtopo, casaX + casaW + profX, casaYtopo - profY);
    sideWallGrd.addColorStop(0, '#bfb7a6');
    sideWallGrd.addColorStop(1, '#908880');
    ctx.fillStyle = sideWallGrd;
    ctx.beginPath();
    ctx.moveTo(casaX + casaW,         casaYtopo);
    ctx.lineTo(casaX + casaW + profX, casaYtopo - profY);
    ctx.lineTo(casaX + casaW + profX, casaYtopo - profY + casaH + panDelta + 20);
    ctx.lineTo(casaX + casaW,         casaYtopo + casaH + panDelta + 20);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();

    /* ===== CASA — FACE FRONTAL ===== */
    const paredeGrd = ctx.createLinearGradient(casaX, casaYtopo, casaX + casaW, casaYtopo);
    paredeGrd.addColorStop(0,   '#e8e0d0');
    paredeGrd.addColorStop(0.5, '#f5f0e8');
    paredeGrd.addColorStop(1,   '#d4ccc0');
    ctx.fillStyle = paredeGrd;
    ctx.fillRect(casaX, casaYtopo, casaW, casaH + panDelta + 20);

    /* Textura tijolo — linhas horizontais + verticais alternadas */
    const brickH = Math.max(6, casaH / 9);
    const brickW = casaW / 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.7;
    for (let r = 0; r <= 9; r++) {
      const by = casaYtopo + r * brickH;
      ctx.beginPath(); ctx.moveTo(casaX, by); ctx.lineTo(casaX + casaW, by); ctx.stroke();
      const off = (r % 2) * (brickW / 2);
      for (let c = 1; c <= 6; c++) {
        const bx = casaX + c * brickW - off;
        if (bx > casaX + 2 && bx < casaX + casaW - 2) {
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + brickH); ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = '#bbb4a8'; ctx.lineWidth = 1;
    ctx.strokeRect(casaX, casaYtopo, casaW, casaH + panDelta + 20);

    /* ===== JANELA ===== */
    const { janelaX, janelaY, janelaW: jW, janelaH: jH } = g;
    /* Sombra */
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#6ea8c8';
    ctx.fillRect(janelaX, janelaY, jW, jH);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(janelaX, janelaY, jW, jH);
    /* Divisórias */
    ctx.beginPath();
    ctx.moveTo(janelaX + jW / 2, janelaY); ctx.lineTo(janelaX + jW / 2, janelaY + jH);
    ctx.moveTo(janelaX, janelaY + jH / 2); ctx.lineTo(janelaX + jW, janelaY + jH / 2);
    ctx.stroke();
    /* Reflexo diagonal */
    const reflGrd = ctx.createLinearGradient(
      janelaX, janelaY, janelaX + jW * 0.42, janelaY + jH * 0.42);
    reflGrd.addColorStop(0, 'rgba(255,255,255,0.3)');
    reflGrd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = reflGrd;
    ctx.fillRect(janelaX, janelaY, jW, jH);
    /* Peitoril */
    ctx.fillStyle = '#cec5b5';
    ctx.fillRect(janelaX - 3, janelaY + jH, jW + 6, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.8;
    ctx.strokeRect(janelaX - 3, janelaY + jH, jW + 6, 4);

    /* ===== PORTA ===== */
    const { doorX, doorY, doorW: dW, doorH: dH } = g;
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    const portaGrd = ctx.createLinearGradient(doorX, doorY, doorX + dW, doorY);
    portaGrd.addColorStop(0,   '#8B6520');
    portaGrd.addColorStop(0.5, '#a07830');
    portaGrd.addColorStop(1,   '#7a5818');
    ctx.fillStyle = portaGrd;
    ctx.beginPath();
    ctx.moveTo(doorX, doorY + dH);
    ctx.lineTo(doorX, doorY + dH * 0.28);
    ctx.arc(doorX + dW / 2, doorY + dH * 0.28, dW / 2, Math.PI, 0, false);
    ctx.lineTo(doorX + dW, doorY + dH);
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#5a3c0a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(doorX, doorY + dH);
    ctx.lineTo(doorX, doorY + dH * 0.28);
    ctx.arc(doorX + dW / 2, doorY + dH * 0.28, dW / 2, Math.PI, 0, false);
    ctx.lineTo(doorX + dW, doorY + dH);
    ctx.closePath(); ctx.stroke();
    /* Linha central */
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(doorX + dW / 2, doorY + dH * 0.28);
    ctx.lineTo(doorX + dW / 2, doorY + dH); ctx.stroke();
    /* Maçaneta dourada */
    ctx.fillStyle = '#FFB800';
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(doorX + dW * 0.72, doorY + dH * 0.58, Math.max(2, dW * 0.1), 0, Math.PI * 2);
    ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    /* Soleira */
    ctx.fillStyle = '#b0a898';
    ctx.fillRect(doorX - 4, doorY + dH, dW + 8, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.8;
    ctx.strokeRect(doorX - 4, doorY + dH, dW + 8, 5);

    /* ===== TELHADO — FACE LATERAL DIREITA ===== */
    const { telhaX, telhaYbase, telhaApice, telhaW } = g;
    const sideRoofGrd = ctx.createLinearGradient(
      telhaX + telhaW, telhaYbase, telhaX + telhaW + profX, telhaYbase - profY);
    sideRoofGrd.addColorStop(0, '#5a3e0c');
    sideRoofGrd.addColorStop(1, '#3a2808');
    ctx.fillStyle = sideRoofGrd;
    ctx.beginPath();
    ctx.moveTo(telhaX + telhaW,               telhaYbase);
    ctx.lineTo(telhaX + telhaW + profX,       telhaYbase - profY);
    ctx.lineTo(telhaX + telhaW / 2 + profX,   telhaApice - profY);
    ctx.lineTo(telhaX + telhaW / 2,           telhaApice);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a2a06'; ctx.lineWidth = 1; ctx.stroke();

    /* ===== TELHADO — FACE FRONTAL ===== */
    const telGrd = ctx.createLinearGradient(telhaX, telhaApice, telhaX + telhaW, telhaYbase);
    telGrd.addColorStop(0,   '#6b4f12');
    telGrd.addColorStop(0.4, '#8B6914');
    telGrd.addColorStop(1,   '#5a4010');
    ctx.fillStyle = telGrd;
    ctx.beginPath();
    ctx.moveTo(telhaX, telhaYbase);
    ctx.lineTo(telhaX + telhaW / 2, telhaApice);
    ctx.lineTo(telhaX + telhaW, telhaYbase);
    ctx.closePath(); ctx.fill();

    /* Fileiras de telhas cerâmicas (clipped no triângulo) */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(telhaX, telhaYbase);
    ctx.lineTo(telhaX + telhaW / 2, telhaApice);
    ctx.lineTo(telhaX + telhaW, telhaYbase);
    ctx.closePath(); ctx.clip();
    const nFileiras = 10;
    const filH = (telhaYbase - telhaApice) / nFileiras;
    for (let r = 0; r < nFileiras; r++) {
      const ty  = telhaYbase - r * filH;
      const t   = r / nFileiras;
      const rw  = telhaW * (1 - t) + 4;
      const rx  = telhaX + telhaW / 2 - rw / 2;
      /* Convexidade: destaque no topo de cada fileira */
      const hGrd = ctx.createLinearGradient(0, ty - filH, 0, ty);
      hGrd.addColorStop(0,    'rgba(255,255,255,0.18)');
      hGrd.addColorStop(0.35, 'rgba(255,255,255,0.06)');
      hGrd.addColorStop(1,    'rgba(0,0,0,0.04)');
      ctx.fillStyle = hGrd; ctx.fillRect(rx, ty - filH, rw, filH);
      /* Separador horizontal */
      ctx.strokeStyle = 'rgba(0,0,0,0.24)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(rx, ty); ctx.lineTo(rx + rw, ty); ctx.stroke();
      /* Separadores verticais (telhas individuais ~14px) */
      const tileW  = Math.max(8, rw / Math.round(Math.max(1, rw / 14)));
      const nTiles = Math.round(Math.max(1, rw / tileW));
      const off    = (r % 2) * (tileW * 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.7;
      for (let i = 1; i <= nTiles; i++) {
        const tx2 = rx + i * tileW - off;
        if (tx2 > rx + 1 && tx2 < rx + rw - 1) {
          ctx.beginPath(); ctx.moveTo(tx2, ty - filH); ctx.lineTo(tx2, ty); ctx.stroke();
        }
      }
    }
    ctx.restore();

    /* Contorno do telhado */
    ctx.strokeStyle = '#4a3508'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(telhaX, telhaYbase);
    ctx.lineTo(telhaX + telhaW / 2, telhaApice);
    ctx.lineTo(telhaX + telhaW, telhaYbase);
    ctx.closePath(); ctx.stroke();

    /* ===== BEIRAL ===== */
    ctx.fillStyle = '#4a3508';
    ctx.fillRect(telhaX - 2, telhaYbase - 3, telhaW + 4, 5);
    const eaveShadow = ctx.createLinearGradient(0, telhaYbase + 2, 0, telhaYbase + 14);
    eaveShadow.addColorStop(0, 'rgba(0,0,0,0.25)');
    eaveShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eaveShadow;
    ctx.fillRect(telhaX - 2, telhaYbase + 2, telhaW + 4, 12);

    /* ===== CALHA ===== */
    ctx.fillStyle = '#80888e';
    ctx.beginPath();
    ctx.ellipse(telhaX + telhaW / 2, telhaYbase + 4,
                telhaW / 2 + 4, 4, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#60686e'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(telhaX + telhaW / 2, telhaYbase + 4,
                telhaW / 2 + 4, 4, 0, 0, Math.PI);
    ctx.stroke();

    /* ===== CUMEEIRA ===== */
    const ridgeGrd = ctx.createLinearGradient(
      telhaX + telhaW / 2 - 9, telhaApice,
      telhaX + telhaW / 2 + 9, telhaApice);
    ridgeGrd.addColorStop(0,   '#a87010');
    ridgeGrd.addColorStop(0.5, '#FFD040');
    ridgeGrd.addColorStop(1,   '#a87010');
    ctx.fillStyle = ridgeGrd;
    ctx.beginPath();
    ctx.roundRect(telhaX + telhaW / 2 - 9, telhaApice - 5, 18, 10, 5);
    ctx.fill();
    ctx.strokeStyle = '#7a5010'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(telhaX + telhaW / 2 - 9, telhaApice - 5, 18, 10, 5);
    ctx.stroke();
  }

  /* ================================================================
     ETAPA 1 — ESTRUTURA METÁLICA
  ================================================================ */
  #etapa1_estrutura(finalizado = false) {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const p   = finalizado ? 1 : this.#easeOutBack(this.#progresso);

    const alturaTotal = g.painelH * 3 + g.gapY * 2 + 10;
    const alturaVis   = alturaTotal * p;

    ctx.save();
    ctx.beginPath();
    ctx.rect(g.painelX - 12, g.telhaYbase - alturaVis,
             g.painelW * g.colunas + 24 + g.gapX * (g.colunas - 1), alturaVis + 4);
    ctx.clip();

    ctx.strokeStyle = '#b0b8c8'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let r = 0; r < 4; r++) {
      const y = g.telhaYbase - 5 - r * (g.painelH + g.gapY);
      ctx.beginPath();
      ctx.moveTo(g.painelX - 10, y);
      ctx.lineTo(g.painelX + g.painelW * g.colunas + g.gapX * (g.colunas - 1) + 10, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8a9ab0'; ctx.lineWidth = 3;
    for (let c = 0; c < g.colunas; c++) {
      const x = g.painelX + c * (g.painelW + g.gapX) + g.painelW / 2;
      ctx.beginPath(); ctx.moveTo(x, g.telhaYbase - 5); ctx.lineTo(x, g.telhaYbase - alturaTotal - 5); ctx.stroke();
    }
    ctx.fillStyle = '#c8d0e0';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < g.colunas; c++) {
        const bx = g.painelX + c * (g.painelW + g.gapX) + g.painelW / 2;
        const by = g.telhaYbase - 5 - r * (g.painelH + g.gapY);
        ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#90a0b0'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ================================================================
     ETAPA 2 — CABOS PAINÉIS → INVERSOR
  ================================================================ */
  #etapa2_cabos(finalizado = false) {
    const ctx   = this.#ctx;
    const g     = this.#geo;
    const p     = finalizado ? 1 : this.#progresso;
    const cabos = g.cabos;
    const totalLen = cabos.reduce((s, c) => s + c.len, 0);
    const visLen   = totalLen * p;

    ctx.save(); ctx.lineWidth = 2; ctx.lineCap = 'round';
    let acum = 0;
    for (const cabo of cabos) {
      const rest = Math.max(0, Math.min(cabo.len, visLen - acum));
      if (rest <= 0) { acum += cabo.len; continue; }
      const frac = rest / cabo.len;
      const endX = cabo.x1 + (cabo.x2 - cabo.x1) * frac;
      const endY = cabo.y1 + (cabo.y2 - cabo.y1) * frac;
      ctx.strokeStyle = cabo.cor; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cabo.x1, cabo.y1);
      ctx.quadraticCurveTo((cabo.x1 + endX) / 2 + 8, (cabo.y1 + endY) / 2 + 12, endX, endY);
      ctx.stroke();
      acum += cabo.len;
    }
    ctx.restore();
  }

  /* ================================================================
     ETAPA 3 — INVERSOR
  ================================================================ */
  #etapa3_inversor(finalizado = false) {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const p   = finalizado ? 1 : this.#easeOutBounce(this.#progresso);
    const { invX, invY, invW, invH } = g;
    const startY = invY - g.H * 0.18;
    const drawY  = startY + (invY - startY) * p;

    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    const inv = ctx.createLinearGradient(invX, drawY, invX + invW, drawY + invH);
    inv.addColorStop(0, '#2a3545'); inv.addColorStop(0.5, '#3a4a60'); inv.addColorStop(1, '#1e2a38');
    ctx.fillStyle = inv;
    ctx.beginPath(); ctx.roundRect(invX, drawY, invW, invH, 5); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,184,0,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(invX, drawY, invW, invH, 5); ctx.stroke();
    ctx.fillStyle = '#00ff80'; ctx.shadowColor = '#00ff80'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(invX + 10, drawY + invH / 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FFB800';
    ctx.font = `bold ${Math.max(8, g.W * 0.018)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('INVERSOR', invX + invW / 2, drawY + invH / 2);
  }

  /* ================================================================
     ETAPA 4 — PLACAS CAINDO
  ================================================================ */
  #etapa4_placas(finalizado = false) {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const p   = this.#progresso;

    for (let i = 0; i < g.colunas * g.linhas; i++) {
      const delay   = i * 0.13;
      const durFrac = 1 - delay;
      if (durFrac <= 0) continue;
      const pLocal = finalizado ? 1 : Math.max(0, Math.min((p - delay) / durFrac, 1));
      const t = this.#easeOutBounce(pLocal);
      const col = i % g.colunas;
      const lin = Math.floor(i / g.colunas);
      const targetX = g.painelX + col * (g.painelW + g.gapX);
      const targetY = g.telhaYbase - 10 - lin * (g.painelH + g.gapY) - g.painelH;
      const drawY   = (targetY - g.H * 0.35) + (targetY - (targetY - g.H * 0.35)) * t;
      this.#desenharPlaca(targetX, drawY, g.painelW, g.painelH, pLocal);
    }
  }

  /* ================================================================
     ETAPA 5 — ENERGIA PLACAS → INVERSOR
  ================================================================ */
  #etapa5_energia() {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const t   = (this.#tsGlobal % 2000) / 2000;

    const haloAlpha = 0.12 + 0.08 * Math.sin(t * Math.PI * 2);
    const painelRight = g.painelX + g.colunas * (g.painelW + g.gapX) - g.gapX;
    const painelTop   = g.telhaYbase - 10 - (g.linhas - 1) * (g.painelH + g.gapY) - g.painelH;
    ctx.fillStyle = `rgba(255,184,0,${haloAlpha})`;
    ctx.fillRect(g.painelX - 4, painelTop - 4, painelRight - g.painelX + 8, g.telhaYbase - painelTop + 4);

    const invCX = g.invX + g.invW / 2;
    const invCY = g.invY + g.invH / 2;
    for (let c = 0; c < g.colunas; c++) {
      const px   = g.painelX + c * (g.painelW + g.gapX) + g.painelW / 2;
      const py   = g.telhaYbase - 8;
      const fase = (t + c * 0.3) % 1;
      const partX = px + (invCX - px) * fase;
      const partY = py + (invCY - py) * fase;

      ctx.strokeStyle    = `rgba(255,220,0,${0.3 + 0.15 * Math.sin(t * Math.PI * 4)})`;
      ctx.lineWidth      = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(invCX, invCY); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;

      ctx.fillStyle = '#FFE066'; ctx.shadowColor = '#FFB800'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(partX, partY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }
  }

  /* ================================================================
     ETAPA 6 — FIO DESCENDO PELA PAREDE
  ================================================================ */
  #etapa6_fioParede() {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const p   = this.#etapa === 6 ? this.#easeInOut(this.#progresso) : 1;

    const x1 = g.invX + g.invW * 0.5;
    const y1 = g.invY + g.invH;
    const x2 = g.qeX + g.qeW * 0.5;
    const y2 = g.qeY;

    const endX = x1 + (x2 - x1) * p;
    const endY = y1 + (y2 - y1) * p;

    /* fio físico */
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1, y1 + (endY - y1) * 0.5, endX, endY - (endY - y1) * 0.4, endX, endY);
    ctx.stroke();

    /* segundo fio (neutro) */
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1 + 4, y1);
    ctx.bezierCurveTo(x1 + 4, y1 + (endY - y1) * 0.5, endX + 4, endY - (endY - y1) * 0.4, endX + 4, endY);
    ctx.stroke();

    /* partículas de fluxo no fio (etapas seguintes) */
    if (this.#etapa >= 7) {
      const tf = (this.#tsGlobal % 1200) / 1200;
      for (let s = 0; s < 4; s++) {
        const fase  = (tf + s * 0.25) % 1;
        const fx    = x1 + (x2 - x1) * fase;
        const fy    = y1 + (y2 - y1) * fase;
        const alpha = Math.sin(fase * Math.PI);
        ctx.fillStyle   = `rgba(255,230,50,${alpha * 0.9})`;
        ctx.shadowColor = '#FFB800'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      }
    }
  }

  /* ================================================================
     ETAPA 7 — QUADRO ELÉTRICO ABRE
  ================================================================ */
  #etapa7_quadroAbre() {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const p   = this.#etapa === 7 ? this.#easeOutBounce(this.#progresso) : 1;
    const { qeX, qeY, qeW, qeH } = g;

    /* caixa base */
    const qGrad = ctx.createLinearGradient(qeX, qeY, qeX + qeW, qeY + qeH);
    qGrad.addColorStop(0, '#2a2a35'); qGrad.addColorStop(0.5, '#3a3a4a'); qGrad.addColorStop(1, '#1e1e28');
    ctx.fillStyle = qGrad;
    ctx.beginPath(); ctx.roundRect(qeX, qeY, qeW, qeH, 4); ctx.fill();
    ctx.strokeStyle = '#555568'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(qeX, qeY, qeW, qeH, 4); ctx.stroke();

    /* label */
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.max(7, g.W * 0.013)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('QUADRO', qeX + qeW / 2, qeY + 4);

    /* tampa abrindo para a direita */
    const tampaX = qeX + qeW * p;
    const tampaH = qeH * 0.6;
    const tampaY = qeY + (qeH - tampaH) / 2;
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.roundRect(tampaX, tampaY, qeW * 0.14, tampaH, 3); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(tampaX, tampaY, qeW * 0.14, tampaH, 3); ctx.stroke();

    /* disjuntores aparecem com a tampa */
    this.#desenharDisjuntores(p, 0);
  }

  /* ================================================================
     ETAPA 8 — DISJUNTOR LIGA + LUZ ACENDE
  ================================================================ */
  #etapa8_disjuntor() {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const p   = this.#etapa === 8 ? this.#easeInOut(this.#progresso) : 1;

    /* quadro base (já desenhado em etapa7, mas precisa estar aqui pois é o topo da pilha) */
    const { qeX, qeY, qeW, qeH } = g;
    const qGrad = ctx.createLinearGradient(qeX, qeY, qeX + qeW, qeY + qeH);
    qGrad.addColorStop(0, '#2a2a35'); qGrad.addColorStop(0.5, '#3a3a4a'); qGrad.addColorStop(1, '#1e1e28');
    ctx.fillStyle = qGrad;
    ctx.beginPath(); ctx.roundRect(qeX, qeY, qeW, qeH, 4); ctx.fill();
    ctx.strokeStyle = '#555568'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(qeX, qeY, qeW, qeH, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.max(7, g.W * 0.013)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('QUADRO', qeX + qeW / 2, qeY + 4);

    this.#desenharDisjuntores(1, p);

    /* janela acendendo */
    if (p > 0) {
      ctx.fillStyle = `rgba(255,240,100,${p * 0.65})`;
      ctx.fillRect(g.janelaX, g.janelaY, g.janelaW, g.janelaH);
      const rg = ctx.createRadialGradient(
        g.janelaX + g.janelaW / 2, g.janelaY + g.janelaH / 2, 0,
        g.janelaX + g.janelaW / 2, g.janelaY + g.janelaH / 2,
        Math.max(g.janelaW, g.janelaH) * 2
      );
      rg.addColorStop(0,   `rgba(255,240,100,${p * 0.45})`);
      rg.addColorStop(1,   'rgba(255,240,100,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(g.janelaX + g.janelaW / 2, g.janelaY + g.janelaH / 2,
              Math.max(g.janelaW, g.janelaH) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ================================================================
     ETAPA 9 — CENA FINAL (loop estável, sem reinício)
  ================================================================ */
  #etapa9_final() {
    const ctx = this.#ctx;
    const g   = this.#geo;
    const t   = (this.#tsGlobal % 2000) / 2000;

    /* quadro base */
    const { qeX, qeY, qeW, qeH } = g;
    const qGrad = ctx.createLinearGradient(qeX, qeY, qeX + qeW, qeY + qeH);
    qGrad.addColorStop(0, '#2a2a35'); qGrad.addColorStop(0.5, '#3a3a4a'); qGrad.addColorStop(1, '#1e1e28');
    ctx.fillStyle = qGrad;
    ctx.beginPath(); ctx.roundRect(qeX, qeY, qeW, qeH, 4); ctx.fill();
    ctx.strokeStyle = '#555568'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(qeX, qeY, qeW, qeH, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.max(7, g.W * 0.013)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('QUADRO', qeX + qeW / 2, qeY + 4);

    this.#desenharDisjuntores(1, 1);

    /* janela pulsando suavemente */
    const brilho = 0.45 + 0.2 * Math.sin(t * Math.PI * 2);
    ctx.fillStyle = `rgba(255,240,100,${brilho})`;
    ctx.fillRect(g.janelaX, g.janelaY, g.janelaW, g.janelaH);
    const rg = ctx.createRadialGradient(
      g.janelaX + g.janelaW / 2, g.janelaY + g.janelaH / 2, 0,
      g.janelaX + g.janelaW / 2, g.janelaY + g.janelaH / 2,
      Math.max(g.janelaW, g.janelaH) * 2.2
    );
    rg.addColorStop(0,   `rgba(255,240,100,${brilho * 0.4})`);
    rg.addColorStop(1,   'rgba(255,240,100,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(g.janelaX + g.janelaW / 2, g.janelaY + g.janelaH / 2,
            Math.max(g.janelaW, g.janelaH) * 2.2, 0, Math.PI * 2);
    ctx.fill();

    /* LED inversor pulsando */
    const ledAlpha = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    ctx.fillStyle   = `rgba(0,255,128,${ledAlpha})`;
    ctx.shadowColor = '#00ff80'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(g.invX + 10, g.invY + g.invH / 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

    /* texto de conclusão — fade-in */
    const elapsed   = this.#tsGlobal - this.#tsEtapa;
    const textAlpha = Math.min(1, elapsed / 700);
    if (textAlpha > 0) {
      ctx.globalAlpha  = textAlpha;
      ctx.fillStyle    = '#FFB800';
      ctx.font         = `bold ${Math.max(11, g.W * 0.026)}px 'Segoe UI', sans-serif`;
      ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor  = 'rgba(255,184,0,0.5)'; ctx.shadowBlur = 14;
      ctx.fillText('✓ Sistema Energizado', g.W / 2, qeY + qeH + g.H * 0.055);
      ctx.shadowBlur   = 0; ctx.shadowColor = 'transparent';
      ctx.globalAlpha  = 1;
    }
  }

  /* ================================================================
     HELPER — disjuntores dentro do quadro
     apareceu 0..1, ligado 0..1
  ================================================================ */
  #desenharDisjuntores(apareceu = 1, ligado = 0) {
    if (apareceu <= 0) return;
    const ctx = this.#ctx;
    const g   = this.#geo;
    const { qeX, qeY, qeW, qeH } = g;

    ctx.globalAlpha = apareceu;

    const qtd = 3;
    const dw  = qeW * 0.18;
    const dh  = qeH * 0.40;
    const gap = (qeW - qtd * dw) / (qtd + 1);

    for (let i = 0; i < qtd; i++) {
      const dx = qeX + gap + i * (dw + gap);
      const dy = qeY + qeH * 0.26;

      ctx.fillStyle = '#1e1e28';
      ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, 2); ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, 2); ctx.stroke();

      /* alavanca */
      const angOff = -0.4, angOn = 0.4;
      const ang  = angOff + (angOn - angOff) * ligado;
      const cx   = dx + dw / 2;
      const cy   = dy + dh * 0.5;
      const alen = dh * 0.3;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.strokeStyle = ligado > 0.5 ? '#00ff80' : '#888';
      ctx.lineWidth   = Math.max(2, dw * 0.28);
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(0, -alen); ctx.lineTo(0, alen); ctx.stroke();
      ctx.restore();

      /* LED status */
      const ledColor  = ligado > 0.5 ? `rgba(0,255,80,${ligado})` : 'rgba(255,60,60,0.6)';
      ctx.fillStyle   = ledColor;
      ctx.shadowColor = ligado > 0.5 ? '#00ff80' : 'transparent';
      ctx.shadowBlur  = ligado > 0.5 ? 6 : 0;
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh * 0.88, dw * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }

    ctx.globalAlpha = 1;
  }

  /* ================================================================
     HELPER — placa individual
  ================================================================ */
  #desenharPlaca(x, y, w, h, opacidade = 1) {
    const ctx = this.#ctx;
    ctx.globalAlpha = opacidade;
    const pg = ctx.createLinearGradient(x, y, x + w, y + h);
    pg.addColorStop(0, '#0a2040'); pg.addColorStop(0.45, '#0d2d55'); pg.addColorStop(1, '#07192e');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
    const cols = 4, rows = 3;
    const cw = (w - 4) / cols, ch = (h - 4) / rows;
    ctx.strokeStyle = 'rgba(0,180,216,0.3)'; ctx.lineWidth = 0.5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x + 2 + c * cw, cy = y + 2 + r * ch;
        ctx.strokeRect(cx, cy, cw, ch);
        const rg = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
        rg.addColorStop(0, 'rgba(255,255,255,0.04)');
        rg.addColorStop(0.5, 'rgba(0,180,216,0.06)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg; ctx.fillRect(cx, cy, cw, ch);
      }
    }
    ctx.strokeStyle = '#3a5070'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ================================================================
     SOM sintético — Web Audio API
  ================================================================ */
  #tocarSom(freqStart = 820, freqEnd = 440, gainVal = 0.18, durSec = 0.13) {
    try {
      if (!this.#audioCtx) this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const actx = this.#audioCtx;
      const gain = actx.createGain();
      const osc  = actx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, actx.currentTime + durSec);
      gain.gain.setValueAtTime(gainVal, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + durSec + 0.02);
      osc.connect(gain); gain.connect(actx.destination);
      osc.start(); osc.stop(actx.currentTime + durSec + 0.03);
    } catch { /* autoplay policy */ }
  }

  /* ================================================================
     GEOMETRIA — recalculada no resize
  ================================================================ */
  #ajustarTamanho() {
    const parent = this.#canvas.parentElement ?? this.#canvas;
    const W = parent.clientWidth  || 400;
    const H = parent.clientHeight || 500;

    this.#canvas.width  = W;
    this.#canvas.height = H;
    this.#W = W;
    this.#H = H;

    const casaW     = W * 0.72;
    const casaX     = (W - casaW) / 2;
    const casaH     = H * 0.32;
    const casaYtopo = H * 0.40;

    const telhaW     = casaW + W * 0.05;
    const telhaX     = casaX - W * 0.025;
    const telhaYbase = casaYtopo + 2;
    const telhaApice = telhaYbase - H * 0.18;

    const colunas = 3, linhas = 2;
    const painelW = W * 0.10;
    const painelH = painelW * 0.6;
    const gapX    = W * 0.012;
    const gapY    = W * 0.01;
    const painelX = casaX + casaW * 0.52 - (colunas * painelW + (colunas - 1) * gapX) / 2;

    const invW = W * 0.14;
    const invH = H * 0.055;
    const invX = casaX + casaW / 2 - invW / 2;
    const invY = casaYtopo + casaH * 0.15;

    /* janela */
    const janelaX = casaX + casaW * 0.15;
    const janelaY = casaYtopo + casaH * 0.25;
    const janelaW = casaW * 0.22;
    const janelaH = casaH * 0.3;

    /* quadro elétrico: lado direito da parede, abaixo da janela */
    const qeW = W * 0.16;
    const qeH = H * 0.095;
    const qeX = janelaX + janelaW + W * 0.025;
    const qeY = janelaY + janelaH * 0.4;

    /* pan: desce para revelar o quadro no centro inferior */
    const panDelta = Math.max(0, (qeY + qeH + H * 0.06) - H * 0.82);

    const cabos = [];
    for (let c = 0; c < colunas; c++) {
      const px  = painelX + c * (painelW + gapX) + painelW / 2;
      const py  = telhaYbase - 10 - (linhas - 1) * (painelH + gapY) - painelH;
      const len = Math.hypot(px - (invX + invW / 2), py - (invY + invH));
      cabos.push({ x1: px, y1: py, x2: invX + invW / 2, y2: invY + invH, len, cor: c % 2 === 0 ? '#c0392b' : '#2c3e50' });
    }

    const estrelas = [];
    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    for (let i = 0; i < 60; i++) estrelas.push([rand() * W, rand() * H * 0.55]);

    this.#geo = {
      W, H,
      casaX, casaYtopo, casaW, casaH,
      janelaX, janelaY, janelaW, janelaH,
      telhaX, telhaYbase, telhaApice, telhaW,
      colunas, linhas, painelW, painelH, painelX, gapX, gapY,
      invX, invY, invW, invH,
      qeX, qeY, qeW, qeH,
      panDelta,
      cabos,
      solX: W * 0.82, solY: H * 0.14, solR: Math.min(W, H) * 0.07,
      estrelas,
      /* perspectiva 3D */
      profX: W * 0.028, profY: W * 0.016,
      /* porta */
      doorW: casaW * 0.17,
      doorH: casaH * 0.52,
      doorX: casaX + casaW * 0.18,
      doorY: casaYtopo + casaH - casaH * 0.52,
    };

    if (this.#etapa >= 6) this.#camYAlvo = -panDelta;
  }

  /* ================================================================
     EASING
  ================================================================ */
  #easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  #easeOutBounce(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1)   return n1 * t * t;
    if (t < 2 / d1)   return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }

  #easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}
