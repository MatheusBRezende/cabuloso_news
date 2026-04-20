/**
 * ============================================================
 *  CABULOSO NEWS — Animações de Futebol
 *  Versão: 1.0
 *  Como usar: <script src="./script/animacoes-futebol.js"></script>
 *  Coloque ANTES do script-avaliacao.min.js no seu HTML.
 *
 *  Para disparar manualmente (ex: no seu JS ao renderizar timeline):
 *    CabulosoAnim.gol({ jogador: "Gabigol", minuto: "32" })
 *    CabulosoAnim.cartaoAmarelo({ jogador: "Ramiro", minuto: "45" })
 *    CabulosoAnim.cartaoVermelho({ jogador: "Zé Ivaldo", minuto: "67" })
 *    CabulosoAnim.var({ minuto: "71" })
 *    CabulosoAnim.falta({ minuto: "18" })
 *    CabulosoAnim.escanteio({ minuto: "55" })
 *    CabulosoAnim.prorrogacao()
 *    CabulosoAnim.penalti({ jogador: "Kaio Jorge", minuto: "82" })
 *    CabulosoAnim.fimDeJogo({ placar: "2 x 1" })
 *
 *  INTEGRAÇÃO AUTOMÁTICA COM TIMELINE:
 *  O script observa o DOM e detecta eventos da timeline do
 *  Cabuloso News automaticamente. Sem configuração extra.
 * ============================================================
 */

(function () {
    "use strict";
  
    /* ──────────────────────────────────────────────────────────
       1. INJETAR CSS
    ────────────────────────────────────────────────────────── */
    const CSS = `
    /* ===== OVERLAY BASE ===== */
    #cn-anim-overlay {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99999;
      overflow: hidden;
    }
  
    /* ===== CARD PRINCIPAL ===== */
    .cn-anim-card {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0.4);
      opacity: 0;
      min-width: 280px;
      max-width: 420px;
      border-radius: 20px;
      padding: 28px 32px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      transition: none;
      will-change: transform, opacity;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.08),
        0 20px 60px rgba(0,0,0,0.55),
        0 4px 16px rgba(0,0,0,0.4);
    }
  
    /* Entrada */
    @keyframes cnCardIn {
      0%   { transform: translate(-50%,-50%) scale(0.3) rotateX(20deg); opacity:0; }
      55%  { transform: translate(-50%,-50%) scale(1.06) rotateX(-2deg); opacity:1; }
      80%  { transform: translate(-50%,-50%) scale(0.97) rotateX(1deg);  opacity:1; }
      100% { transform: translate(-50%,-50%) scale(1)    rotateX(0deg);  opacity:1; }
    }
    /* Saída */
    @keyframes cnCardOut {
      0%   { transform: translate(-50%,-50%) scale(1);    opacity:1; }
      100% { transform: translate(-50%,-50%) scale(0.8) translateY(-30px); opacity:0; }
    }
    .cn-anim-card.entering { animation: cnCardIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .cn-anim-card.leaving  { animation: cnCardOut 0.4s ease-in forwards; }
  
    /* ===== FUNDO ESCURECIDO ===== */
    .cn-anim-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0);
      transition: background 0.3s ease;
    }
    .cn-anim-backdrop.show { background: rgba(0,15,40,0.72); }
  
    /* ===== ÍCONE PRINCIPAL ===== */
    .cn-anim-icon {
      font-size: 64px;
      line-height: 1;
      display: block;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
    }
    @keyframes cnIconPulse {
      0%,100% { transform: scale(1); }
      50%      { transform: scale(1.12); }
    }
    .cn-anim-icon.pulse { animation: cnIconPulse 0.7s ease-in-out 2; }
  
    /* ===== TÍTULO ===== */
    .cn-anim-titulo {
      font-family: 'Oswald', sans-serif;
      font-size: 2.2rem;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      line-height: 1;
      text-shadow: 0 2px 12px rgba(0,0,0,0.5);
    }
    @keyframes cnTituloSlide {
      0%   { transform: translateY(16px); opacity:0; }
      100% { transform: translateY(0);    opacity:1; }
    }
    .cn-anim-titulo { animation: cnTituloSlide 0.4s ease-out 0.15s both; }
  
    /* ===== JOGADOR ===== */
    .cn-anim-jogador {
      font-family: 'Nunito', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      opacity: 0.95;
      animation: cnTituloSlide 0.4s ease-out 0.28s both;
    }
  
    /* ===== MINUTO ===== */
    .cn-anim-minuto {
      font-family: 'Oswald', sans-serif;
      font-size: 0.85rem;
      letter-spacing: 2px;
      opacity: 0.65;
      animation: cnTituloSlide 0.4s ease-out 0.38s both;
    }
  
    /* ===== SUBTÍTULO ===== */
    .cn-anim-sub {
      font-family: 'Nunito', sans-serif;
      font-size: 0.88rem;
      font-weight: 600;
      letter-spacing: 1px;
      opacity: 0.75;
      animation: cnTituloSlide 0.4s ease-out 0.42s both;
    }
  
    /* ───── TEMAS ───── */
  
    /* GOL — verde com brilho */
    .cn-anim-card.cn-gol {
      background: linear-gradient(145deg, #064e2a 0%, #0d6e3a 50%, #15803d 100%);
      border: 2px solid rgba(74,222,128,0.5);
    }
    .cn-anim-card.cn-gol .cn-anim-titulo { color: #4ade80; }
    .cn-anim-card.cn-gol .cn-anim-jogador { color: #fff; }
    .cn-anim-card.cn-gol .cn-anim-minuto,
    .cn-anim-card.cn-gol .cn-anim-sub { color: #bbf7d0; }
  
    /* CARTÃO AMARELO */
    .cn-anim-card.cn-amarelo {
      background: linear-gradient(145deg, #422006 0%, #713f12 50%, #92400e 100%);
      border: 2px solid rgba(250,204,21,0.6);
    }
    .cn-anim-card.cn-amarelo .cn-anim-titulo { color: #fde047; }
    .cn-anim-card.cn-amarelo .cn-anim-jogador { color: #fff; }
    .cn-anim-card.cn-amarelo .cn-anim-minuto,
    .cn-anim-card.cn-amarelo .cn-anim-sub { color: #fef08a; }
  
    /* CARTÃO VERMELHO */
    .cn-anim-card.cn-vermelho {
      background: linear-gradient(145deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%);
      border: 2px solid rgba(248,113,113,0.6);
    }
    .cn-anim-card.cn-vermelho .cn-anim-titulo { color: #f87171; }
    .cn-anim-card.cn-vermelho .cn-anim-jogador { color: #fff; }
    .cn-anim-card.cn-vermelho .cn-anim-minuto,
    .cn-anim-card.cn-vermelho .cn-anim-sub { color: #fecaca; }
  
    /* VAR — roxo tecnológico */
    .cn-anim-card.cn-var {
      background: linear-gradient(145deg, #1e0442 0%, #2e1065 50%, #4c1d95 100%);
      border: 2px solid rgba(167,139,250,0.5);
    }
    .cn-anim-card.cn-var .cn-anim-titulo { color: #c4b5fd; }
    .cn-anim-card.cn-var .cn-anim-jogador { color: #fff; }
    .cn-anim-card.cn-var .cn-anim-minuto,
    .cn-anim-card.cn-var .cn-anim-sub { color: #ddd6fe; }
  
    /* FALTA — âmbar */
    .cn-anim-card.cn-falta {
      background: linear-gradient(145deg, #292524 0%, #44403c 50%, #57534e 100%);
      border: 2px solid rgba(251,191,36,0.5);
    }
    .cn-anim-card.cn-falta .cn-anim-titulo { color: #fbbf24; }
    .cn-anim-card.cn-falta .cn-anim-jogador { color: #fff; }
    .cn-anim-card.cn-falta .cn-anim-minuto,
    .cn-anim-card.cn-falta .cn-anim-sub { color: #fde68a; }
  
    /* ESCANTEIO — azul ceu */
    .cn-anim-card.cn-escanteio {
      background: linear-gradient(145deg, #082f49 0%, #0c4a6e 50%, #075985 100%);
      border: 2px solid rgba(56,189,248,0.5);
    }
    .cn-anim-card.cn-escanteio .cn-anim-titulo { color: #38bdf8; }
    .cn-anim-card.cn-escanteio .cn-anim-jogador,
    .cn-anim-card.cn-escanteio .cn-anim-minuto,
    .cn-anim-card.cn-escanteio .cn-anim-sub { color: #e0f2fe; }
  
    /* PÊNALTI — laranja */
    .cn-anim-card.cn-penalti {
      background: linear-gradient(145deg, #431407 0%, #7c2d12 50%, #9a3412 100%);
      border: 2px solid rgba(251,146,60,0.6);
    }
    .cn-anim-card.cn-penalti .cn-anim-titulo { color: #fb923c; }
    .cn-anim-card.cn-penalti .cn-anim-jogador { color: #fff; }
    .cn-anim-card.cn-penalti .cn-anim-minuto,
    .cn-anim-card.cn-penalti .cn-anim-sub { color: #fed7aa; }
  
    /* FIM DE JOGO — azul Cruzeiro */
    .cn-anim-card.cn-fimjogo {
      background: linear-gradient(145deg, #001533 0%, #002b80 50%, #003399 100%);
      border: 2px solid rgba(255,215,0,0.6);
    }
    .cn-anim-card.cn-fimjogo .cn-anim-titulo { color: #ffd700; }
    .cn-anim-card.cn-fimjogo .cn-anim-jogador { color: #fff; }
    .cn-anim-card.cn-fimjogo .cn-anim-minuto,
    .cn-anim-card.cn-fimjogo .cn-anim-sub { color: #fef9c3; }
  
    /* PRORROGAÇÃO */
    .cn-anim-card.cn-prorrogacao {
      background: linear-gradient(145deg, #0a0a1a 0%, #1a1a3e 50%, #1e3a8a 100%);
      border: 2px solid rgba(147,197,253,0.5);
    }
    .cn-anim-card.cn-prorrogacao .cn-anim-titulo { color: #93c5fd; }
    .cn-anim-card.cn-prorrogacao .cn-anim-jogador,
    .cn-anim-card.cn-prorrogacao .cn-anim-minuto,
    .cn-anim-card.cn-prorrogacao .cn-anim-sub { color: #dbeafe; }
  
    /* ===== PARTÍCULAS / CONFETTI ===== */
    .cn-particle {
      position: absolute;
      border-radius: 3px;
      pointer-events: none;
      will-change: transform, opacity;
    }
    @keyframes cnParticle {
      0%   { opacity: 1; transform: translate(0,0) rotate(0deg) scale(1); }
      100% { opacity: 0; transform: var(--px-end) rotate(var(--px-rot)) scale(0.3); }
    }
  
    /* ===== ONDAS (pulse ring) ===== */
    .cn-ring {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      pointer-events: none;
    }
    @keyframes cnRingExpand {
      0%   { width:60px; height:60px; opacity:.8; }
      100% { width:280px; height:280px; opacity:0; }
    }
  
    /* ===== BARRA LATERAL — linha colorida que vem da esquerda ===== */
    .cn-stripe {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 6px;
      border-radius: 20px 0 0 20px;
    }
  
    /* ===== CARD RETÂNGULO DO CARTÃO ===== */
    .cn-card-rect {
      width: 52px;
      height: 72px;
      border-radius: 6px;
      display: inline-block;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    }
    @keyframes cnCardFlip {
      0%   { transform: rotateY(90deg) scale(0.6); }
      55%  { transform: rotateY(-8deg) scale(1.08); }
      80%  { transform: rotateY(4deg)  scale(0.98); }
      100% { transform: rotateY(0deg)  scale(1); }
    }
    .cn-card-rect { animation: cnCardFlip 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    @keyframes cnShake {
      0%,100% { transform: translateX(0) rotateY(0deg); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px); }
      60%     { transform: translateX(-5px); }
      80%     { transform: translateX(5px); }
    }
    .cn-card-rect.shake { animation: cnCardFlip 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards,
                                     cnShake 0.5s ease-out 0.45s; }
  
    /* ===== TELA DO VAR ===== */
    .cn-var-screen {
      width: 120px;
      height: 76px;
      background: #050510;
      border-radius: 8px;
      border: 2px solid #5b21b6;
      position: relative;
      overflow: hidden;
      margin-bottom: 4px;
      box-shadow: 0 0 20px rgba(139,92,246,0.5);
    }
    .cn-var-scanline {
      position: absolute;
      left: 0; right: 0;
      height: 2px;
      background: rgba(167,139,250,0.9);
      box-shadow: 0 0 8px rgba(167,139,250,0.8);
    }
    @keyframes cnScan { 0%,100% { top:8%; } 50% { top:82%; } }
    .cn-var-scanline { animation: cnScan 1.2s linear infinite; }
    .cn-var-grid {
      position: absolute; inset: 0;
      background:
        repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(100,60,200,.07) 11px, rgba(100,60,200,.07) 12px),
        repeating-linear-gradient(90deg, transparent, transparent 15px, rgba(100,60,200,.07) 15px, rgba(100,60,200,.07) 16px);
    }
    .cn-var-label {
      position: absolute;
      top: 8px; left: 0; right: 0;
      text-align: center;
      color: #a78bfa;
      font-size: 10px;
      letter-spacing: 2.5px;
      font-family: monospace;
    }
    @keyframes cnVarBlink { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .cn-var-label { animation: cnVarBlink 1s ease-in-out infinite; }
    .cn-var-corner {
      position: absolute;
      width: 12px; height: 12px;
      border-color: #7c3aed;
      border-style: solid;
      opacity: 0.8;
    }
    .cn-var-corner.tl { top:4px; left:4px; border-width:2px 0 0 2px; }
    .cn-var-corner.tr { top:4px; right:4px; border-width:2px 2px 0 0; }
    .cn-var-corner.bl { bottom:4px; left:4px; border-width:0 0 2px 2px; }
    .cn-var-corner.br { bottom:4px; right:4px; border-width:0 2px 2px 0; }
  
    /* ===== APITO / ONDA FALTA ===== */
    .cn-whistle-wrap {
      position: relative;
      width: 80px; height: 80px;
      display: flex; align-items: center; justify-content: center;
    }
    .cn-wave-ring {
      position: absolute;
      border-radius: 50%;
      border: 2px solid rgba(251,191,36,0.6);
      animation: cnWaveRing 1.1s ease-out infinite;
    }
    .cn-wave-ring:nth-child(2) { animation-delay: 0.35s; }
    .cn-wave-ring:nth-child(3) { animation-delay: 0.7s; }
    @keyframes cnWaveRing {
      0%   { width:24px; height:24px; opacity:.8; }
      100% { width:90px; height:90px; opacity:0; }
    }
    .cn-whistle-icon {
      font-size: 36px;
      position: relative; z-index: 1;
    }
    @keyframes cnWhistleBlow {
      0%,100% { transform: rotate(0deg) scale(1); }
      25%     { transform: rotate(-10deg) scale(1.1); }
      75%     { transform: rotate(10deg) scale(1.05); }
    }
    .cn-whistle-icon { animation: cnWhistleBlow 0.6s ease-in-out infinite; }
  
    /* ===== BOLA QUICANDO (escanteio) ===== */
    .cn-corner-ball {
      font-size: 28px;
      animation: cnBallArc 0.7s ease-out both;
    }
    @keyframes cnBallArc {
      0%   { transform: translate(-30px, 30px) scale(0.5) rotate(0deg); opacity:0; }
      60%  { opacity:1; }
      100% { transform: translate(0,0) scale(1) rotate(360deg); opacity:1; }
    }
    `;
  
    const styleEl = document.createElement("style");
    styleEl.id = "cn-anim-styles";
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
  
    /* ──────────────────────────────────────────────────────────
       2. CRIAR OVERLAY NO DOM
    ────────────────────────────────────────────────────────── */
    let overlay, backdrop;
  
    function ensureOverlay() {
      if (document.getElementById("cn-anim-overlay")) return;
      overlay = document.createElement("div");
      overlay.id = "cn-anim-overlay";
  
      backdrop = document.createElement("div");
      backdrop.className = "cn-anim-backdrop";
      overlay.appendChild(backdrop);
  
      document.body.appendChild(overlay);
    }
  
    /* ──────────────────────────────────────────────────────────
       3. UTILITÁRIOS
    ────────────────────────────────────────────────────────── */
    let currentCard = null;
    let hideTimer = null;
  
    function minutoLabel(min) {
      if (!min && min !== 0) return "";
      return `${min}'`;
    }
  
    function escapeHtml(str) {
      if (!str) return "";
      const el = document.createElement("span");
      el.textContent = String(str);
      return el.innerHTML;
    }
  
    /* ──────────────────────────────────────────────────────────
       4. MOTOR DE RENDERIZAÇÃO
    ────────────────────────────────────────────────────────── */
    function mostrar(opts) {
      ensureOverlay();
      overlay = document.getElementById("cn-anim-overlay");
      backdrop = overlay.querySelector(".cn-anim-backdrop");
  
      // Remove card anterior imediatamente se houver
      if (currentCard) {
        currentCard.remove();
        currentCard = null;
      }
      if (hideTimer) clearTimeout(hideTimer);
  
      // Backdrop
      requestAnimationFrame(() => backdrop.classList.add("show"));
  
      // Monta HTML interno
      const card = document.createElement("div");
      card.className = `cn-anim-card ${opts.tema}`;
  
      // Stripe lateral
      const stripe = document.createElement("div");
      stripe.className = "cn-stripe";
      stripe.style.background = opts.cor;
      card.appendChild(stripe);
  
      // Conteúdo
      card.innerHTML += opts.html;
  
      overlay.appendChild(card);
      currentCard = card;
  
      // Trigger animação de entrada
      requestAnimationFrame(() => {
        requestAnimationFrame(() => card.classList.add("entering"));
      });
  
      // Partículas
      if (opts.particulas) spawnParticulas(opts.cor, opts.particulas);
      if (opts.rings) spawnRings(opts.cor, opts.rings);
  
      // Auto-hide
      const duracao = opts.duracao || 3800;
      hideTimer = setTimeout(() => fechar(), duracao);
    }
  
    function fechar() {
      if (!currentCard) return;
      currentCard.classList.remove("entering");
      currentCard.classList.add("leaving");
  
      const card = currentCard;
      setTimeout(() => {
        card.remove();
        if (backdrop) backdrop.classList.remove("show");
      }, 420);
  
      currentCard = null;
      hideTimer = null;
  
      // Limpa partículas e rings
      overlay && overlay.querySelectorAll(".cn-particle, .cn-ring").forEach(el => el.remove());
    }
  
    /* ──────────────────────────────────────────────────────────
       5. PARTÍCULAS
    ────────────────────────────────────────────────────────── */
    function spawnParticulas(corBase, qtd) {
      const cores = [corBase, "#ffffff", "#ffd700", "#a3e635", "#86efac"];
      const shapes = ["4px", "6px", "8px", "3px"];
  
      for (let i = 0; i < qtd; i++) {
        const p = document.createElement("div");
        p.className = "cn-particle";
  
        const left = 20 + Math.random() * 60; // concentra no centro
        const top = 30 + Math.random() * 40;
        const dx = (Math.random() - 0.5) * 300;
        const dy = -80 - Math.random() * 220;
        const rot = Math.random() * 720 - 360;
        const dur = 0.9 + Math.random() * 0.8;
        const delay = Math.random() * 0.3;
        const size = shapes[Math.floor(Math.random() * shapes.length)];
        const cor = cores[Math.floor(Math.random() * cores.length)];
  
        p.style.cssText = `
          left: ${left}%;
          top: ${top}%;
          width: ${size};
          height: ${size};
          background: ${cor};
          --px-end: translate(${dx}px, ${dy}px);
          --px-rot: ${rot}deg;
          animation: cnParticle ${dur}s ease-out ${delay}s both;
          border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
          opacity: 0;
        `;
  
        overlay.appendChild(p);
        setTimeout(() => p.remove(), (dur + delay + 0.1) * 1000);
      }
    }
  
    function spawnRings(cor, qtd) {
      for (let i = 0; i < qtd; i++) {
        const r = document.createElement("div");
        r.className = "cn-ring";
        r.style.cssText = `
          border: 2px solid ${cor};
          opacity: 0;
          animation: cnRingExpand ${0.7 + i * 0.25}s ease-out ${i * 0.15}s both;
          box-shadow: 0 0 12px ${cor}55;
        `;
        overlay.appendChild(r);
        setTimeout(() => r.remove(), (0.7 + i * 0.25 + i * 0.15 + 0.1) * 1000);
      }
    }
  
    /* ──────────────────────────────────────────────────────────
       6. ANIMAÇÕES PÚBLICAS
    ────────────────────────────────────────────────────────── */
  
    /** GOL 🥅 */
    function animGol(opts = {}) {
      const jogador = opts.jogador ? escapeHtml(opts.jogador) : null;
      const min = minutoLabel(opts.minuto);
      const tipo = opts.penalti ? "⚽ PÊNALTI" : "GOL!";
  
      const html = `
        <span class="cn-anim-icon pulse">⚽</span>
        <div class="cn-anim-titulo">${tipo}</div>
        ${jogador ? `<div class="cn-anim-jogador">👤 ${jogador}</div>` : ""}
        ${min ? `<div class="cn-anim-minuto">⏱ ${min}</div>` : ""}
        <div class="cn-anim-sub">Cruzeiro marca!</div>
      `;
  
      mostrar({
        tema: "cn-gol",
        cor: "#4ade80",
        html,
        particulas: 48,
        rings: 3,
        duracao: 4200,
      });
    }
  
    /** CARTÃO AMARELO 🟨 */
    function animCartaoAmarelo(opts = {}) {
      const jogador = opts.jogador ? escapeHtml(opts.jogador) : null;
      const min = minutoLabel(opts.minuto);
  
      const html = `
        <div class="cn-card-rect" style="background:linear-gradient(145deg,#ca8a04,#eab308);"></div>
        <div class="cn-anim-titulo">Amarelo!</div>
        ${jogador ? `<div class="cn-anim-jogador">👤 ${jogador}</div>` : ""}
        ${min ? `<div class="cn-anim-minuto">⏱ ${min}</div>` : ""}
        <div class="cn-anim-sub">Cartão Amarelo</div>
      `;
  
      mostrar({
        tema: "cn-amarelo",
        cor: "#fde047",
        html,
        rings: 2,
        duracao: 3500,
      });
    }
  
    /** CARTÃO VERMELHO 🟥 */
    function animCartaoVermelho(opts = {}) {
      const jogador = opts.jogador ? escapeHtml(opts.jogador) : null;
      const min = minutoLabel(opts.minuto);
      const duplo = opts.duplo ? "2º Amarelo → " : "";
  
      const html = `
        <div class="cn-card-rect shake" style="background:linear-gradient(145deg,#b91c1c,#dc2626);"></div>
        <div class="cn-anim-titulo">Expulso!</div>
        ${jogador ? `<div class="cn-anim-jogador">👤 ${jogador}</div>` : ""}
        ${min ? `<div class="cn-anim-minuto">⏱ ${min}</div>` : ""}
        <div class="cn-anim-sub">${duplo}Cartão Vermelho</div>
      `;
  
      mostrar({
        tema: "cn-vermelho",
        cor: "#f87171",
        html,
        rings: 2,
        duracao: 4000,
      });
    }
  
    /** VAR 📺 */
    function animVar(opts = {}) {
      const min = minutoLabel(opts.minuto);
      const motivo = opts.motivo ? escapeHtml(opts.motivo) : "Checando o lance...";
  
      const html = `
        <div class="cn-var-screen">
          <div class="cn-var-grid"></div>
          <div class="cn-var-scanline"></div>
          <div class="cn-var-corner tl"></div>
          <div class="cn-var-corner tr"></div>
          <div class="cn-var-corner bl"></div>
          <div class="cn-var-corner br"></div>
          <div class="cn-var-label">▶ REVISANDO</div>
        </div>
        <div class="cn-anim-titulo">VAR</div>
        ${min ? `<div class="cn-anim-minuto">⏱ ${min}</div>` : ""}
        <div class="cn-anim-sub">${motivo}</div>
      `;
  
      mostrar({
        tema: "cn-var",
        cor: "#a78bfa",
        html,
        rings: 2,
        duracao: 4500,
      });
    }
  
    /** FALTA ⚠️ */
    function animFalta(opts = {}) {
      const jogador = opts.jogador ? escapeHtml(opts.jogador) : null;
      const min = minutoLabel(opts.minuto);
  
      const html = `
        <div class="cn-whistle-wrap">
          <div class="cn-wave-ring"></div>
          <div class="cn-wave-ring"></div>
          <div class="cn-wave-ring"></div>
          <div class="cn-whistle-icon">📢</div>
        </div>
        <div class="cn-anim-titulo">Falta!</div>
        ${jogador ? `<div class="cn-anim-jogador">👤 ${jogador}</div>` : ""}
        ${min ? `<div class="cn-anim-minuto">⏱ ${min}</div>` : ""}
        <div class="cn-anim-sub">Infração marcada</div>
      `;
  
      mostrar({
        tema: "cn-falta",
        cor: "#fbbf24",
        html,
        duracao: 3000,
      });
    }
  
    /** ESCANTEIO 🚩 */
    function animEscanteio(opts = {}) {
      const min = minutoLabel(opts.minuto);
  
      const html = `
        <div class="cn-corner-ball">⚽</div>
        <div class="cn-anim-titulo">Escanteio</div>
        ${min ? `<div class="cn-anim-minuto">⏱ ${min}</div>` : ""}
        <div class="cn-anim-sub">Cobrança marcada</div>
      `;
  
      mostrar({
        tema: "cn-escanteio",
        cor: "#38bdf8",
        html,
        duracao: 2800,
      });
    }
  
    /** PÊNALTI 🎯 */
    function animPenalti(opts = {}) {
      const jogador = opts.jogador ? escapeHtml(opts.jogador) : null;
      const min = minutoLabel(opts.minuto);
  
      const html = `
        <span class="cn-anim-icon pulse">🎯</span>
        <div class="cn-anim-titulo">Pênalti!</div>
        ${jogador ? `<div class="cn-anim-jogador">👤 ${jogador}</div>` : ""}
        ${min ? `<div class="cn-anim-minuto">⏱ ${min}</div>` : ""}
        <div class="cn-anim-sub">Cobrança marcada</div>
      `;
  
      mostrar({
        tema: "cn-penalti",
        cor: "#fb923c",
        html,
        rings: 2,
        duracao: 3500,
      });
    }
  
    /** FIM DE JOGO 🏁 */
    function animFimDeJogo(opts = {}) {
      const placar = opts.placar ? escapeHtml(opts.placar) : null;
  
      const html = `
        <span class="cn-anim-icon">🏁</span>
        <div class="cn-anim-titulo">Fim de Jogo!</div>
        ${placar ? `<div class="cn-anim-jogador">${placar}</div>` : ""}
        <div class="cn-anim-sub">Apita o árbitro!</div>
      `;
  
      mostrar({
        tema: "cn-fimjogo",
        cor: "#ffd700",
        html,
        particulas: 30,
        rings: 3,
        duracao: 5000,
      });
    }
  
    /** PRORROGAÇÃO ⏰ */
    function animProrrogacao() {
      const html = `
        <span class="cn-anim-icon pulse">⏰</span>
        <div class="cn-anim-titulo">Prorrogação!</div>
        <div class="cn-anim-sub">Mais 30 minutos de emoção</div>
      `;
  
      mostrar({
        tema: "cn-prorrogacao",
        cor: "#93c5fd",
        html,
        rings: 3,
        duracao: 4000,
      });
    }
  
    /* ──────────────────────────────────────────────────────────
       7. INTEGRAÇÃO AUTOMÁTICA COM A TIMELINE DO CABULOSO NEWS
       
       Observa o DOM: quando um novo elemento da timeline aparecer
       com os atributos data-tipo e data-jogador, dispara a animação.
    ────────────────────────────────────────────────────────── */
    const _vistos = new Set();
  
    function processarEvento(el) {
      const id = el.dataset.animId || el.getAttribute("data-event-id") || null;
      if (id && _vistos.has(id)) return;
      if (id) _vistos.add(id);
  
      const tipo = (el.dataset.tipo || el.dataset.eventType || "").toUpperCase();
      const jogador = el.dataset.jogador || el.dataset.player || el.dataset.playerName || "";
      const minuto = el.dataset.minuto || el.dataset.minute || "";
      const duplo = el.dataset.duplo === "true" || el.dataset.doubleYellow === "true";
  
      switch (tipo) {
        case "GOAL":
        case "GOL":
          animGol({ jogador, minuto });
          break;
        case "YELLOW_CARD":
        case "CARTAO_AMARELO":
          animCartaoAmarelo({ jogador, minuto });
          break;
        case "RED_CARD":
        case "CARTAO_VERMELHO":
          animCartaoVermelho({ jogador, minuto, duplo });
          break;
        case "YELLOW_RED_CARD":
          animCartaoVermelho({ jogador, minuto, duplo: true });
          break;
        case "VAR":
          animVar({ minuto });
          break;
        case "FOUL":
        case "FREE_KICK":
        case "FALTA":
          animFalta({ jogador, minuto });
          break;
        case "CORNER":
        case "ESCANTEIO":
          animEscanteio({ minuto });
          break;
        case "PENALTY":
        case "PENALTI":
          animPenalti({ jogador, minuto });
          break;
        case "FULL_TIME":
        case "FIM_JOGO":
          animFimDeJogo({});
          break;
      }
    }
  
    function observarTimeline() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
  
            // Elemento direto com data-tipo
            if (node.dataset && node.dataset.tipo) {
              processarEvento(node);
            }
  
            // Descendentes com data-tipo (ex: li dentro de ul adicionado)
            node.querySelectorAll &&
              node.querySelectorAll("[data-tipo],[data-event-type]").forEach(processarEvento);
          });
        });
      });
  
      observer.observe(document.body, { childList: true, subtree: true });
    }
  
    /* ──────────────────────────────────────────────────────────
       8. HOOK NA FUNÇÃO renderHorizontalTimeline DO CABULOSO
       
       Se o seu script-avaliacao.min.js definir renderHorizontalTimeline
       no escopo global, interceptamos para disparar animações
       sempre que novos eventos chegarem via polling.
    ────────────────────────────────────────────────────────── */
    const _ultimosEventos = new Map(); // tipo+minuto+jogador → true
  
    function checarEventosNovos(partida) {
      if (!partida) return;
      const eventos = partida.eventos_timeline || [];
  
      eventos.forEach((ev) => {
        const tipo = (ev.tipo || "").toUpperCase();
        // só anima eventos importantes
        const importantes = ["GOAL", "YELLOW_CARD", "RED_CARD", "YELLOW_RED_CARD", "VAR", "PENALTY", "FULL_TIME"];
        if (!importantes.includes(tipo)) return;
  
        const chave = `${tipo}|${ev.minuto || ""}|${ev.jogador || ""}`;
        if (_ultimosEventos.has(chave)) return;
        _ultimosEventos.set(chave, true);
  
        const jogador = ev.jogador || "";
        const minuto = ev.minuto || ev.minutoInt || "";
  
        switch (tipo) {
          case "GOAL":
            animGol({ jogador, minuto });
            break;
          case "YELLOW_CARD":
            animCartaoAmarelo({ jogador, minuto });
            break;
          case "RED_CARD":
            animCartaoVermelho({ jogador, minuto });
            break;
          case "YELLOW_RED_CARD":
            animCartaoVermelho({ jogador, minuto, duplo: true });
            break;
          case "VAR":
            animVar({ minuto });
            break;
          case "PENALTY":
            animPenalti({ jogador, minuto });
            break;
          case "FULL_TIME":
            animFimDeJogo({});
            break;
        }
      });
    }
  
    /* Intercepta renderHorizontalTimeline se existir ou quando for definida */
    function hookTimeline() {
      if (typeof window.renderHorizontalTimeline === "function") {
        const original = window.renderHorizontalTimeline;
        window.renderHorizontalTimeline = function (partida) {
          const result = original.apply(this, arguments);
          try { checarEventosNovos(partida); } catch (e) {}
          return result;
        };
      }
    }
  
    /* Também hookeia renderPosJogo / renderPlacarInterno */
    function hookPolling() {
      ["renderPosJogo", "renderPlacarInterno", "renderPontuacaoPanel"].forEach((fn) => {
        if (typeof window[fn] === "function") {
          const orig = window[fn];
          window[fn] = function (partida) {
            const r = orig.apply(this, arguments);
            try { checarEventosNovos(partida); } catch (e) {}
            return r;
          };
        }
      });
    }
  
    /* ──────────────────────────────────────────────────────────
       9. INICIALIZAÇÃO
    ────────────────────────────────────────────────────────── */
    function init() {
      ensureOverlay();
      observarTimeline();
      hookTimeline();
      hookPolling();
  
      // Tenta hookar depois que o outro script carregou
      setTimeout(() => {
        hookTimeline();
        hookPolling();
      }, 1500);
  
      console.log("[CabulosoAnim] ✅ Animações de futebol carregadas!");
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  
    /* ──────────────────────────────────────────────────────────
       10. API PÚBLICA
    ────────────────────────────────────────────────────────── */
    window.CabulosoAnim = {
      gol: animGol,
      cartaoAmarelo: animCartaoAmarelo,
      cartaoVermelho: animCartaoVermelho,
      var: animVar,
      falta: animFalta,
      escanteio: animEscanteio,
      penalti: animPenalti,
      fimDeJogo: animFimDeJogo,
      prorrogacao: animProrrogacao,
      fechar: fechar,
  
      /** Processa um evento bruto no formato do seu worker */
      processarEvento: function (ev) {
        checarEventosNovos({ eventos_timeline: [ev] });
      },
  
      /** Reseta controle de eventos vistos (útil ao trocar de partida) */
      resetar: function () {
        _ultimosEventos.clear();
        _vistos.clear();
        fechar();
      },
    };
  })();