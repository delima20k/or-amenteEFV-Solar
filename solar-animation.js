'use strict';

/* =====================================================
   AnimacaoMontagem — Canvas 2D
   Simula a montagem de um sistema fotovoltaico em 5 etapas
   ===================================================== */
class AnimacaoMontagem {
  /* ---- configuração de etapas (duração em ms) ---- */
  static #DURACAO = [0, 1200, 800, 600, 1600, 9999];
  /* etapa 0 = cenário base (sem duração própria)
     etapa 5 = loop infinito de energia */

  #canvas;
  #ctx;
  #W = 0;
  #H = 0;

  #etapa     = 0;
  #progresso = 0;   // 0..1 dentro da etapa atual
  #tsEtapa   = 0;   // timestamp de início da etapa
  #tsUlt     = 0;

  #raf       = null;
  #audioCtx  = null;

  /* geometria (recalculada em resize) */
  #geo = {};

  constructor(canvasEl) {
    this.#canvas = canvasEl;
    this.#ctx    = canvasEl.getContext('2d');
    this.#ajustarTamanho();

    const ro = new ResizeObserver(() => {
      this.#ajustarTamanho();
      this.#desenhar();
    });
    ro.observe(canvasEl.parentElement ?? canvasEl);

    /* inicia após um frame para garantir layout */
    requestAnimationFrame(() => this.iniciar());
  }

  /* ---- público ---- */
  iniciar() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#etapa     = 1;
    this.#progresso = 0;
    this.#tsEtapa   = performance.now();
    this.#tsUlt     = this.#tsEtapa;
    this.#raf = requestAnimationFrame(ts => this.#loop(ts));
  }

  reiniciar() {
    this.iniciar();
  }

  parar() {
    if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = null; }
  }

  /* ================================================================
     LOOP PRINCIPAL
  ================================================================ */
  #loop(ts) {
    const dt = Math.min(ts - this.#tsUlt, 50);
    this.#tsUlt = ts;

    const duracao = AnimacaoMontagem.#DURACAO[this.#etapa] ?? 9999;

    if (this.#etapa < 5) {
      this.#progresso = Math.min((ts - this.#tsEtapa) / duracao, 1);
    } else {
      /* etapa 5 — loop eterno, usar ts como clock */
      this.#progresso = (ts % 2000) / 2000;
    }

    this.#desenhar();

    if (this.#etapa < 5 && this.#progresso >= 1) {
      this.#etapa++;
      this.#tsEtapa = ts;
      this.#progresso = 0;
      if (this.#etapa === 4) {
        /* dispara sons escalonados para cada placa */
        for (let i = 0; i < 6; i++) {
          setTimeout(() => this.#tocarSom(), i * 220 + 100);
        }
      }
    }

    this.#raf = requestAnimationFrame(t => this.#loop(t));
  }

  /* ================================================================
     DESENHO PRINCIPAL
  ================================================================ */
  #desenhar() {
    const { ctx, #W: W, #H: H } = this;
    ctx.clearRect(0, 0, W, H);

    this.#desenharCenario();

    switch (this.#etapa) {
      case 1: this.#etapa1_estrutura(); break;
      case 2: this.#etapa1_estrutura(); this.#etapa2_cabos(); break;
      case 3: this.#etapa1_estrutura(); this.#etapa2_cabos(); this.#etapa3_inversor(); break;
      case 4: this.#etapa1_estrutura(); this.#etapa2_cabos(); this.#etapa3_inversor(); this.#etapa4_placas(); break;
      case 5: this.#etapa1_estrutura(); this.#etapa2_cabos(); this.#etapa3_inversor(); this.#etapa4_placas(true); this.#etapa5_energia(); break;
    }
  }

  get ctx() { return this.#ctx; }

  /* ================================================================
     CENÁRIO BASE — céu + chão + casa + telhado
  ================================================================ */
  #desenharCenario() {
    const ctx = this.#ctx;
    const { W, H, g } = this.#geo;

    /* --- CÉU --- */
    const ceu = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    ceu.addColorStop(0,   '#0a0e1a');
    ceu.addColorStop(0.5, '#0d1b35');
    ceu.addColorStop(1,   '#1a2744');
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, W, H * 0.72);

    /* estrelas */
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [sx, sy] of g.estrelas) {
      ctx.beginPath();
      ctx.arc(sx, sy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    /* --- SOL --- */
    const solGrad = ctx.createRadialGradient(g.solX, g.solY, 0, g.solX, g.solY, g.solR);
    solGrad.addColorStop(0,   '#fff8e1');
    solGrad.addColorStop(0.4, '#FFE066');
    solGrad.addColorStop(1,   'rgba(255,184,0,0)');
    ctx.fillStyle = solGrad;
    ctx.beginPath();
    ctx.arc(g.solX, g.solY, g.solR, 0, Math.PI * 2);
    ctx.fill();

    /* --- CHÃO / GRAMA --- */
    const gramGrad = ctx.createLinearGradient(0, H * 0.72, 0, H);
    gramGrad.addColorStop(0, '#2d5a27');
    gramGrad.addColorStop(1, '#1a3a16');
    ctx.fillStyle = gramGrad;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    /* linha de horizonte */
    ctx.strokeStyle = '#3d7a35';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    ctx.lineTo(W, H * 0.72);
    ctx.stroke();

    /* --- PAREDE DA CASA --- */
    const paredeGrad = ctx.createLinearGradient(g.casaX, g.casaYtopo, g.casaX + g.casaW, g.casaYtopo);
    paredeGrad.addColorStop(0, '#e8e0d0');
    paredeGrad.addColorStop(0.5, '#f5f0e8');
    paredeGrad.addColorStop(1, '#d4ccc0');
    ctx.fillStyle = paredeGrad;
    ctx.fillRect(g.casaX, g.casaYtopo, g.casaW, g.casaH);
    ctx.strokeStyle = '#bbb4a8';
    ctx.lineWidth = 1;
    ctx.strokeRect(g.casaX, g.casaYtopo, g.casaW, g.casaH);

    /* janela */
    ctx.fillStyle = '#6ea8c8';
    ctx.fillRect(g.janelaX, g.janelaY, g.janelaW, g.janelaH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(g.janelaX, g.janelaY, g.janelaW, g.janelaH);
    /* cruzes da janela */
    ctx.beginPath();
    ctx.moveTo(g.janelaX + g.janelaW / 2, g.janelaY);
    ctx.lineTo(g.janelaX + g.janelaW / 2, g.janelaY + g.janelaH);
    ctx.moveTo(g.janelaX, g.janelaY + g.janelaH / 2);
    ctx.lineTo(g.janelaX + g.janelaW, g.janelaY + g.janelaH / 2);
    ctx.stroke();

    /* --- TELHADO --- */
    const telGrad = ctx.createLinearGradient(g.telhaX, g.telhaApice, g.telhaX + g.telhaW, g.telhaYbase);
    telGrad.addColorStop(0, '#6b4f12');
    telGrad.addColorStop(0.5, '#8B6914');
    telGrad.addColorStop(1, '#5a4010');
    ctx.fillStyle = telGrad;
    ctx.beginPath();
    ctx.moveTo(g.telhaX, g.telhaYbase);
    ctx.lineTo(g.telhaX + g.telhaW / 2, g.telhaApice);
    ctx.lineTo(g.telhaX + g.telhaW, g.telhaYbase);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a3508';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* linhas de telha */
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 5; i++) {
      const fy = g.telhaYbase - (g.telhaYbase - g.telhaApice) * (i / 5);
      const fw = g.telhaW * (1 - i / 5);
      const fx = g.telhaX + g.telhaW / 2 - fw / 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fw, fy);
      ctx.stroke();
    }
  }

  /* ================================================================
     ETAPA 1 — ESTRUTURA METÁLICA
  ================================================================ */
  #etapa1_estrutura(finalizado = false) {
    const ctx = this.#ctx;
    const { g } = this.#geo;
    const p = finalizado ? 1 : this.#easeOutBack(this.#progresso);

    const trilhos = g.trilhos;
    const alturaTotal = g.painelH * 3 + g.gapY * 2 + 10;
    const alturaVis = alturaTotal * p;

    ctx.save();
    /* clip cresce de baixo para cima a partir do topo do telhado */
    ctx.beginPath();
    ctx.rect(
      g.painelX - 12,
      g.telhaYbase - alturaVis,
      g.painelW * g.colunas + 24 + g.gapX * (g.colunas - 1),
      alturaVis + 4
    );
    ctx.clip();

    /* trilhos horizontais */
    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let r = 0; r < 4; r++) {
      const y = g.telhaYbase - 5 - r * (g.painelH + g.gapY);
      ctx.beginPath();
      ctx.moveTo(g.painelX - 10, y);
      ctx.lineTo(g.painelX + g.painelW * g.colunas + g.gapX * (g.colunas - 1) + 10, y);
      ctx.stroke();
    }

    /* trilhos verticais */
    ctx.strokeStyle = '#8a9ab0';
    ctx.lineWidth = 3;
    for (let c = 0; c < g.colunas; c++) {
      const x = g.painelX + c * (g.painelW + g.gapX) + g.painelW / 2;
      ctx.beginPath();
      ctx.moveTo(x, g.telhaYbase - 5);
      ctx.lineTo(x, g.telhaYbase - alturaTotal - 5);
      ctx.stroke();
    }

    /* parafusos */
    ctx.fillStyle = '#c8d0e0';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < g.colunas; c++) {
        const bx = g.painelX + c * (g.painelW + g.gapX) + g.painelW / 2;
        const by = g.telhaYbase - 5 - r * (g.painelH + g.gapY);
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#90a0b0';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /* ================================================================
     ETAPA 2 — CABOS
  ================================================================ */
  #etapa2_cabos(finalizado = false) {
    const ctx = this.#ctx;
    const { g } = this.#geo;
    const p = finalizado ? 1 : this.#progresso;

    const cabos = g.cabos;
    const totalLen = cabos.reduce((s, c) => s + c.len, 0);
    const visLen = totalLen * p;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap   = 'round';

    let acum = 0;
    for (const cabo of cabos) {
      const restante = Math.max(0, Math.min(cabo.len, visLen - acum));
      if (restante <= 0) { acum += cabo.len; continue; }

      const frac = restante / cabo.len;
      const endX = cabo.x1 + (cabo.x2 - cabo.x1) * frac;
      const endY = cabo.y1 + (cabo.y2 - cabo.y1) * frac;

      ctx.strokeStyle = cabo.cor;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cabo.x1, cabo.y1);
      /* curva leve para cabos */
      const cpX = (cabo.x1 + endX) / 2 + 8;
      const cpY = (cabo.y1 + endY) / 2 + 12;
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
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
    const { g } = this.#geo;
    const p = finalizado ? 1 : this.#easeOutBounce(this.#progresso);

    const { invX, invY, invW, invH } = g;
    /* cai de cima */
    const startY = invY - g.H * 0.18;
    const drawY  = startY + (invY - startY) * p;

    /* sombra */
    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 4;

    /* caixa */
    const inv = ctx.createLinearGradient(invX, drawY, invX + invW, drawY + invH);
    inv.addColorStop(0, '#2a3545');
    inv.addColorStop(0.5, '#3a4a60');
    inv.addColorStop(1, '#1e2a38');
    ctx.fillStyle = inv;
    ctx.beginPath();
    ctx.roundRect(invX, drawY, invW, invH, 5);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    /* borda dourada */
    ctx.strokeStyle = 'rgba(255,184,0,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(invX, drawY, invW, invH, 5);
    ctx.stroke();

    /* LED verde */
    ctx.fillStyle = '#00ff80';
    ctx.shadowColor = '#00ff80';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(invX + 10, drawY + invH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    /* label */
    ctx.fillStyle   = '#FFB800';
    ctx.font        = `bold ${Math.max(8, g.W * 0.018)}px 'Segoe UI', sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('INVERSOR', invX + invW / 2, drawY + invH / 2);
  }

  /* ================================================================
     ETAPA 4 — PLACAS CAINDO
  ================================================================ */
  #etapa4_placas(finalizado = false) {
    const ctx  = this.#ctx;
    const { g } = this.#geo;
    const p    = this.#progresso;

    for (let i = 0; i < g.colunas * g.linhas; i++) {
      /* cada placa tem delay escalonado */
      const delay  = i * 0.13;
      const durFrac = 1 - delay;
      if (durFrac <= 0) continue;

      const pLocal = finalizado ? 1 : Math.max(0, Math.min((p - delay) / durFrac, 1));
      const t       = this.#easeOutBounce(pLocal);

      const col = i % g.colunas;
      const lin = Math.floor(i / g.colunas);
      const targetX = g.painelX + col * (g.painelW + g.gapX);
      const targetY = g.telhaYbase - 10 - lin * (g.painelH + g.gapY) - g.painelH;

      const startY = targetY - g.H * 0.35;
      const drawY  = startY + (targetY - startY) * t;

      this.#desenharPlaca(targetX, drawY, g.painelW, g.painelH, pLocal);
    }
  }

  /* ================================================================
     ETAPA 5 — ENERGIA / LOOP
  ================================================================ */
  #etapa5_energia() {
    const ctx  = this.#ctx;
    const { g } = this.#geo;
    const p    = this.#progresso; /* 0..1 cíclico */

    /* pulso de halo sobre as placas */
    const haloAlpha = 0.12 + 0.08 * Math.sin(p * Math.PI * 2);
    ctx.fillStyle = `rgba(255,184,0,${haloAlpha})`;
    const painelRight = g.painelX + g.colunas * (g.painelW + g.gapX) - g.gapX;
    const painelTop   = g.telhaYbase - 10 - (g.linhas - 1) * (g.painelH + g.gapY) - g.painelH;
    ctx.fillRect(g.painelX - 4, painelTop - 4,
                 painelRight - g.painelX + 8,
                 g.telhaYbase - painelTop + 4);

    /* raios de energia — uma linha por coluna para o inversor */
    const invCX = g.invX + g.invW / 2;
    const invCY = g.invY + g.invH / 2;

    for (let c = 0; c < g.colunas; c++) {
      const px = g.painelX + c * (g.painelW + g.gapX) + g.painelW / 2;
      const py = g.telhaYbase - 8;

      /* partícula animada ao longo da linha */
      const fase  = (p + c * 0.3) % 1;
      const partX = px + (invCX - px) * fase;
      const partY = py + (invCY - py) * fase;

      ctx.strokeStyle = `rgba(255,220,0,${0.25 + 0.15 * Math.sin(p * Math.PI * 4)})`;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -p * 20;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(invCX, invCY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      /* partícula ponto */
      ctx.fillStyle = '#FFE066';
      ctx.shadowColor = '#FFB800';
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(partX, partY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.shadowColor = 'transparent';
    }
  }

  /* ================================================================
     HELPERS — desenhar uma placa individual
  ================================================================ */
  #desenharPlaca(x, y, w, h, opacidade = 1) {
    const ctx = this.#ctx;
    ctx.globalAlpha = opacidade;

    /* fundo da placa */
    const pg = ctx.createLinearGradient(x, y, x + w, y + h);
    pg.addColorStop(0, '#0a2040');
    pg.addColorStop(0.45, '#0d2d55');
    pg.addColorStop(1, '#07192e');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 2);
    ctx.fill();

    /* células da placa (grid) */
    const cols = 4, rows = 3;
    const cw = (w - 4) / cols;
    const ch = (h - 4) / rows;
    ctx.strokeStyle = 'rgba(0,180,216,0.3)';
    ctx.lineWidth   = 0.5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x + 2 + c * cw;
        const cy = y + 2 + r * ch;
        ctx.strokeRect(cx, cy, cw, ch);
        /* reflexo diagonal */
        const rg = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
        rg.addColorStop(0, 'rgba(255,255,255,0.04)');
        rg.addColorStop(0.5, 'rgba(0,180,216,0.06)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(cx, cy, cw, ch);
      }
    }

    /* borda metálica */
    ctx.strokeStyle = '#3a5070';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  /* ================================================================
     SOM — oscillator sintético (Web Audio API)
  ================================================================ */
  #tocarSom() {
    try {
      if (!this.#audioCtx) {
        this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx  = this.#audioCtx;
      const gain = ctx.createGain();
      const osc  = ctx.createOscillator();

      osc.type      = 'sine';
      osc.frequency.setValueAtTime(820, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch { /* silencia erros de autoplay policy */ }
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

    /* dimensões proporcionais */
    const casaW    = W * 0.72;
    const casaX    = (W - casaW) / 2;
    const casaH    = H * 0.32;
    const casaYtopo = H * 0.40;

    const telhaW   = casaW + W * 0.05;
    const telhaX   = casaX - W * 0.025;
    const telhaYbase = casaYtopo + 2;
    const telhaApice = telhaYbase - H * 0.18;

    /* área de painéis — lado direito do telhado inclinado */
    const colunas  = 3;
    const linhas   = 2;
    const painelW  = W * 0.10;
    const painelH  = painelW * 0.6;
    const gapX     = W * 0.012;
    const gapY     = W * 0.01;

    /* posicionar painéis sobre o telhado direito */
    const painelAreaW = colunas * painelW + (colunas - 1) * gapX;
    const painelX = casaX + casaW * 0.52 - painelAreaW / 2;

    /* inversor */
    const invW = W * 0.14;
    const invH = H * 0.055;
    const invX = casaX + casaW / 2 - invW / 2;
    const invY = casaYtopo + casaH * 0.15;

    /* cabos: cada painel para o inversor */
    const cabos = [];
    for (let c = 0; c < colunas; c++) {
      const px = painelX + c * (painelW + gapX) + painelW / 2;
      const py = telhaYbase - 10 - (linhas - 1) * (painelH + gapY) - painelH;
      const len = Math.hypot(px - (invX + invW / 2), py - (invY + invH));
      cabos.push({ x1: px, y1: py, x2: invX + invW / 2, y2: invY + invH, len, cor: c % 2 === 0 ? '#c0392b' : '#2c3e50' });
    }

    /* estrelas aleatórias mas determinísticas */
    const estrelas = [];
    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    for (let i = 0; i < 60; i++) {
      estrelas.push([rand() * W, rand() * H * 0.55]);
    }

    this.#geo = {
      W, H,
      casaX, casaYtopo, casaW, casaH,
      janelaX: casaX + casaW * 0.15, janelaY: casaYtopo + casaH * 0.25,
      janelaW: casaW * 0.22, janelaH: casaH * 0.3,
      telhaX, telhaYbase, telhaApice, telhaW,
      colunas, linhas, painelW, painelH, painelX, gapX, gapY,
      invX, invY, invW, invH,
      cabos,
      solX: W * 0.82, solY: H * 0.14, solR: Math.min(W, H) * 0.07,
      estrelas,
    };
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
    if (t < 1 / d1)          return n1 * t * t;
    if (t < 2 / d1)          return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1)        return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}
