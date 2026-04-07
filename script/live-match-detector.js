// live-match-detector.js - Versão Mobile-Otimizada
(function () {
  'use strict';

  const CONFIG = {
    pageAvaliacao: '../avaliacao.html',
    defaultEscudo:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
    DATA_WAIT_TIMEOUT: 3000,
    UPDATE_INTERVAL: 60000,
    LIVE_UPDATE_INTERVAL: 15000, // Mais frequente em live (15s)
  };

  // ─── ESTILOS MOBILE-FIRST ───────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Base do widget - mobile first */
    .cabuloso-live-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: var(--font-main, 'Nunito', sans-serif);
    }

    .cabuloso-live-bar.visible {
      transform: translateY(0);
    }

    /* Barra compacta (minimizada) */
    .live-bar-compact {
      background: linear-gradient(135deg, #003399 0%, #001f5c 100%);
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
      border-top: 2px solid #ffd700;
    }

    .live-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .live-dot {
      width: 10px;
      height: 10px;
      background: #dc2626;
      border-radius: 50%;
      animation: pulse 1.2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }

    .live-text {
      font-weight: 800;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .compact-score {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
    }

    .compact-teams {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .compact-teams img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }

    .compact-result {
      font-size: 18px;
      font-weight: 800;
      background: rgba(255,255,255,0.2);
      padding: 4px 10px;
      border-radius: 20px;
    }

    .expand-icon {
      font-size: 14px;
      transition: transform 0.2s;
    }

    /* Painel expandido */
    .live-bar-expanded {
      background: white;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
    }

    .cabuloso-live-bar.expanded .live-bar-expanded {
      max-height: 400px;
    }

    .cabuloso-live-bar.expanded .expand-icon {
      transform: rotate(180deg);
    }

    .expanded-content {
      padding: 16px;
      border-top: 1px solid #e2e8f0;
    }

    /* Placar completo */
    .full-scoreboard {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }

    .full-team {
      flex: 1;
      text-align: center;
    }

    .full-team img {
      width: 48px;
      height: 48px;
      object-fit: contain;
      margin-bottom: 8px;
    }

    .full-team-name {
      font-weight: 700;
      color: #1e293b;
      font-size: 14px;
    }

    .full-score {
      font-family: 'Oswald', monospace;
      font-size: 32px;
      font-weight: 800;
      color: #003399;
      background: #f1f5f9;
      padding: 8px 16px;
      border-radius: 12px;
      min-width: 80px;
      text-align: center;
    }

    /* Info da partida */
    .match-info {
      text-align: center;
      margin-bottom: 16px;
      padding: 8px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .competition-name {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }

    .match-minute {
      font-size: 13px;
      font-weight: 700;
      color: #dc2626;
      margin-top: 4px;
    }

    /* Estatísticas rápidas */
    .quick-stats {
      display: flex;
      justify-content: space-around;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .stat-item {
      text-align: center;
      flex: 1;
      min-width: 60px;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 800;
      color: #003399;
    }

    .stat-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
    }

    /* Botão de ação */
    .action-buttons {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }

    .action-btn {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: transform 0.1s;
      text-align: center;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .action-btn:active {
      transform: scale(0.97);
    }

    .btn-primary {
      background: linear-gradient(135deg, #ffd700 0%, #ffe44d 100%);
      color: #001f5c;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #003399;
      border: 1px solid #e2e8f0;
    }

    /* Próximo jogo (modo futuro) */
    .next-match-banner {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-top: 2px solid #ffd700;
    }

    .next-match-banner .compact-teams {
      color: #1e293b;
    }

    .countdown-timer {
      font-family: 'Oswald', monospace;
      font-size: 20px;
      font-weight: 700;
      color: #003399;
      text-align: center;
      margin-top: 12px;
    }

    /* Fechar button */
    .close-bar {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      opacity: 0.7;
    }

    .close-bar:hover {
      opacity: 1;
    }

    /* Desktop adjustments */
    @media (min-width: 768px) {
      .cabuloso-live-bar {
        bottom: 20px;
        left: auto;
        right: 20px;
        width: 380px;
        border-radius: 16px;
        transform: translateY(0) scale(0.95);
        opacity: 0;
        transition: all 0.3s;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      }

      .cabuloso-live-bar.visible {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      .live-bar-compact {
        border-radius: 16px 16px 0 0;
      }

      .cabuloso-live-bar.expanded .live-bar-expanded {
        border-radius: 0 0 16px 16px;
      }
    }

    @media (max-width: 767px) {
      .compact-teams span {
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .stat-value {
        font-size: 14px;
      }
    }
  `;
  document.head.appendChild(style);

  // ─── HTML DO WIDGET ────────────────────────────────────────────────────
  const widgetHtml = `
    <div class="cabuloso-live-bar" id="cabulosoLiveBar">
      <div class="live-bar-compact" id="liveBarCompact">
        <div class="live-indicator">
          <span class="live-dot"></span>
          <span class="live-text" id="liveStatusText">AO VIVO</span>
        </div>
        <div class="compact-score" id="compactScore">
          <!-- Preenchido via JS -->
        </div>
        <i class="fas fa-chevron-up expand-icon"></i>
      </div>
      <div class="live-bar-expanded">
        <div class="expanded-content" id="expandedContent">
          <!-- Conteúdo expandido via JS -->
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', widgetHtml);

  // ─── ELEMENTOS ─────────────────────────────────────────────────────────
  const bar = document.getElementById('cabulosoLiveBar');
  const compactBtn = document.getElementById('liveBarCompact');
  const liveStatusText = document.getElementById('liveStatusText');
  const compactScore = document.getElementById('compactScore');

  let updateInterval = null;
  let currentDataType = null; // 'live', 'future', 'finished'
  let currentData = null;

  // ─── TOGGLE EXPANDIR ───────────────────────────────────────────────────
  compactBtn.addEventListener('click', (e) => {
    if (e.target.closest('.close-bar')) return;
    bar.classList.toggle('expanded');
  });

  // Fechar com gesto de swipe down em mobile
  let touchStartY = 0;
  bar.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  });
  
  bar.addEventListener('touchmove', (e) => {
    if (!bar.classList.contains('expanded')) return;
    const deltaY = e.touches[0].clientY - touchStartY;
    if (deltaY > 50) {
      bar.classList.remove('expanded');
    }
  });

  // ─── UTILITÁRIOS ───────────────────────────────────────────────────────
  function parseDate(dataStr, horaStr) {
    if (!dataStr || !horaStr || horaStr === 'A definir') return null;
    const [d, m, y] = dataStr.split('/');
    return new Date(`${y}-${m}-${d}T${horaStr}:00`);
  }

  function formatTimeRemaining(targetDate) {
    const diff = targetDate - Date.now();
    if (diff <= 0) return '00:00:00';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ─── RENDERIZAÇÃO ──────────────────────────────────────────────────────
  function renderLive(data) {
    currentDataType = 'live';
    bar.classList.add('visible');
    liveStatusText.innerHTML = '<span class="live-dot"></span> AO VIVO';
    
    // Compact view
    compactScore.innerHTML = `
      <div class="compact-teams">
        <img src="${data.escudo_mandante || CONFIG.defaultEscudo}" alt="${data.mandante}" onerror="this.src='${CONFIG.defaultEscudo}'">
        <span>${data.mandante?.substring(0, 15)}</span>
      </div>
      <span class="compact-result">${data.placar_mandante ?? 0} - ${data.placar_visitante ?? 0}</span>
      <div class="compact-teams">
        <span>${data.visitante?.substring(0, 15)}</span>
        <img src="${data.escudo_visitante || CONFIG.defaultEscudo}" alt="${data.visitante}" onerror="this.src='${CONFIG.defaultEscudo}'">
      </div>
    `;

    // Expanded view
    const expandedHtml = `
      <div class="full-scoreboard">
        <div class="full-team">
          <img src="${data.escudo_mandante || CONFIG.defaultEscudo}" onerror="this.src='${CONFIG.defaultEscudo}'">
          <div class="full-team-name">${data.mandante || '---'}</div>
        </div>
        <div class="full-score">${data.placar_mandante ?? 0} - ${data.placar_visitante ?? 0}</div>
        <div class="full-team">
          <img src="${data.escudo_visitante || CONFIG.defaultEscudo}" onerror="this.src='${CONFIG.defaultEscudo}'">
          <div class="full-team-name">${data.visitante || '---'}</div>
        </div>
      </div>
      <div class="match-info">
        <div class="competition-name">${data.campeonato || 'Partida'}</div>
        <div class="match-minute">⚽ PARTIDA EM ANDAMENTO</div>
      </div>
      <div class="quick-stats">
        <div class="stat-item">
          <div class="stat-value">${data.posse_mandante ?? '—'}%</div>
          <div class="stat-label">Posse</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.finalizacoes_mandante ?? '—'}</div>
          <div class="stat-label">Finalizações</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.escanteios_mandante ?? '—'}</div>
          <div class="stat-label">Escanteios</div>
        </div>
      </div>
      <div class="action-buttons">
        <a href="${CONFIG.pageAvaliacao}" class="action-btn btn-primary">
          <i class="fas fa-star"></i> Avaliar Jogadores
        </a>
        <button class="action-btn btn-secondary" id="closeLiveBarBtn">
          <i class="fas fa-times"></i> Fechar
        </button>
      </div>
    `;
    
    document.getElementById('expandedContent').innerHTML = expandedHtml;
    document.getElementById('closeLiveBarBtn')?.addEventListener('click', () => {
      bar.classList.remove('visible');
    });
  }

  function renderFuture(data) {
    currentDataType = 'future';
    bar.classList.add('visible');
    liveStatusText.innerHTML = '📅 PRÓXIMO JOGO';
    
    const targetDate = parseDate(data.data, data.hora);
    
    compactScore.innerHTML = `
      <div class="compact-teams">
        <img src="${data.escudo_mandante || CONFIG.defaultEscudo}" onerror="this.src='${CONFIG.defaultEscudo}'">
        <span>${data.mandante?.substring(0, 12)}</span>
      </div>
      <span class="compact-result">VS</span>
      <div class="compact-teams">
        <span>${data.visitante?.substring(0, 12)}</span>
        <img src="${data.escudo_visitante || CONFIG.defaultEscudo}" onerror="this.src='${CONFIG.defaultEscudo}'">
      </div>
    `;

    // Função para atualizar countdown
    const updateCountdown = () => {
      if (!targetDate) return;
      const remaining = formatTimeRemaining(targetDate);
      const countdownEl = document.getElementById('countdownDisplay');
      if (countdownEl) countdownEl.textContent = remaining;
      
      // Se acabou o tempo, recarregar
      if (targetDate <= Date.now()) {
        if (updateInterval) clearInterval(updateInterval);
        fetchAndRender();
      }
    };

    const expandedHtml = `
      <div class="full-scoreboard">
        <div class="full-team">
          <img src="${data.escudo_mandante || CONFIG.defaultEscudo}" onerror="this.src='${CONFIG.defaultEscudo}'">
          <div class="full-team-name">${data.mandante || '---'}</div>
        </div>
        <div class="full-score">VS</div>
        <div class="full-team">
          <img src="${data.escudo_visitante || CONFIG.defaultEscudo}" onerror="this.src='${CONFIG.defaultEscudo}'">
          <div class="full-team-name">${data.visitante || '---'}</div>
        </div>
      </div>
      <div class="match-info">
        <div class="competition-name">${data.campeonato || 'Partida'}</div>
        <div class="match-minute">📅 ${data.data || '--/--'} às ${data.hora || '--:--'}</div>
      </div>
      <div class="countdown-timer" id="countdownDisplay">${targetDate ? formatTimeRemaining(targetDate) : '--:--:--'}</div>
      <div class="action-buttons">
        <button class="action-btn btn-secondary" id="closeFutureBarBtn">
          <i class="fas fa-times"></i> Fechar
        </button>
      </div>
    `;
    
    document.getElementById('expandedContent').innerHTML = expandedHtml;
    
    if (targetDate) {
      const timer = setInterval(updateCountdown, 1000);
      setTimeout(() => {
        if (currentDataType === 'future') clearInterval(timer);
      }, 24 * 60 * 60 * 1000);
    }
    
    document.getElementById('closeFutureBarBtn')?.addEventListener('click', () => {
      bar.classList.remove('visible');
    });
  }

  function renderFinished(data) {
    // Para jogos finalizados, mostra apenas se o usuário interagir
    // Não exibe automaticamente para não poluir
    currentDataType = 'finished';
    bar.classList.remove('visible');
  }

  function showNoGame() {
    bar.classList.remove('visible');
  }

  // ─── LÓGICA PRINCIPAL ──────────────────────────────────────────────────
  function processAndRender(data) {
    if (!data) return;

    const agenda = data.agenda || [];
    const resultados = data.resultados || [];
    
    if (!agenda.length && !resultados.length) {
      showNoGame();
      return;
    }

    const agora = new Date();
    let partida = null;
    let tipo = null;

    // 1. Ao vivo
    partida = resultados.find((r) => r.ao_vivo === true);
    if (partida) {
      tipo = 'live';
    } else {
      // 2. Próximo jogo (próximas 48h ou próximo)
      const futuros = agenda
        .filter((j) => {
          if (!j.data || !j.hora || j.hora === 'A definir') return false;
          const d = parseDate(j.data, j.hora);
          return d && d >= agora;
        })
        .sort((a, b) => parseDate(a.data, a.hora) - parseDate(b.data, b.hora));

      if (futuros.length) {
        partida = futuros[0];
        tipo = 'future';
      } else {
        tipo = 'none';
      }
    }

    if (tipo === 'live') {
      renderLive(partida);
      // Update mais frequente
      if (updateInterval) clearInterval(updateInterval);
      updateInterval = setInterval(fetchAndRender, CONFIG.LIVE_UPDATE_INTERVAL);
    } else if (tipo === 'future') {
      renderFuture(partida);
      if (updateInterval) clearInterval(updateInterval);
      updateInterval = setInterval(fetchAndRender, CONFIG.UPDATE_INTERVAL);
    } else {
      showNoGame();
    }

    currentData = partida;
  }

  // ─── API FETCH ─────────────────────────────────────────────────────────
  let dataReceived = false;
  let fallbackTimer = null;

  async function fetchAndRender() {
    try {
      const res = await fetch(
        'https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos'
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();
      if (Array.isArray(data) && data.length > 0) data = data[0];
      processAndRender(data);
    } catch (err) {
      console.error('❌ Widget: erro ao buscar dados:', err);
    }
  }

  // ─── EVENTOS GLOBAIS ───────────────────────────────────────────────────
  function init() {
    fallbackTimer = setTimeout(() => {
      if (!dataReceived) fetchAndRender();
    }, CONFIG.DATA_WAIT_TIMEOUT);

    window.addEventListener('cabuloso:data', (e) => {
      dataReceived = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      processAndRender(e.detail);
    });

    // Update periódico como fallback
    setInterval(() => {
      if (!dataReceived) fetchAndRender();
    }, CONFIG.UPDATE_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();