
const LiveMatchDetector = (() => {
  const CONFIG = {
    checkInterval: 5000, 
    webhookUrl: 'https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo',
    minutoAMinutoUrl: '../minuto-a-minuto.html', // CORRIGIDO: adicionado ./
    countdownSeconds: 10,
    storageKey: 'cabuloso_live_match_dismissed',

    testMode: false, // Mude para true para testar
    testMatchData: {
      mandante: 'Cruzeiro',
      visitante: 'Atlético-MG',
      placar_mandante: 2,
      placar_visitante: 1,
      tempo: '2º TEMPO - 78\'',
      campeonato: 'Brasileirão Série A',
      status: 'AO_VIVO'
    }
  };

  let checkIntervalId = null;
  let countdownIntervalId = null;
  let currentLiveMatch = null;
  let modalShown = false;

  /**
   * Verifica se há jogo ao vivo via webhook
   */
  const checkLiveMatch = async () => {
    try {
      const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`, { 
        cache: 'no-cache',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log('Webhook retornou status:', response.status);
        return null;
      }

      // Pega o texto da resposta primeiro
      const text = await response.text();
      
      // Se vazio, retorna null
      if (!text || text.trim() === '') {
        console.log('Webhook retornou vazio');
        return null;
      }

      // Tenta fazer parse do JSON
      let data;
      try {
        data = JSON.parse(text);
        console.log('Dados recebidos do webhook:', data);
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON:', parseError);
        console.log('Resposta recebida:', text.substring(0, 200));
        return null;
      }
      
      // Verifica se é array e pega primeiro item
      const matchData = Array.isArray(data) && data.length > 0 ? data[0] : data;
      
      // Se não tem dados válidos
      if (!matchData || typeof matchData !== 'object') {
        console.log('Dados do webhook inválidos');
        return null;
      }
      
      // LOG EXTRA: Verifica todas as chaves disponíveis
      console.log('Chaves disponíveis:', Object.keys(matchData));
      
      // CORREÇÃO: Verifica estrutura dos dados
      // Primeiro, tenta usar a estrutura do n8n (com placar e resultados)
      if (matchData.placar) {
        console.log('Usando estrutura placar/resultados');
        const tempo = matchData.placar.status || '';
        const isLive = tempo && 
                      !tempo.includes('Fim') && 
                      !tempo.includes('Encerrado') && 
                      !tempo.includes('FINAL') &&
                      tempo !== '';
        
        if (isLive) {
          console.log('✅ Jogo ao vivo detectado (estrutura placar):', 
            matchData.placar.home_name, 'vs', matchData.placar.away_name);
          return {
            mandante: matchData.placar.home_name || 'Time Casa',
            visitante: matchData.placar.away_name || 'Time Fora',
            placar_mandante: matchData.placar.home || 0,
            placar_visitante: matchData.placar.away || 0,
            tempo: tempo,
            campeonato: matchData.placar.campeonato || 'Campeonato',
            status: tempo.includes('Intervalo') ? 'INTERVALO' : 'AO_VIVO'
          };
        }
      }
      
      // Se não encontrou na estrutura placar, tenta estrutura alternativa
      const tempoAlt = matchData['Tempo_Jogo'] || matchData.status || '';
      const isLiveAlt = tempoAlt && 
                       !tempoAlt.includes('Fim') && 
                       !tempoAlt.includes('Encerrado') && 
                       !tempoAlt.includes('FINAL') &&
                       tempoAlt !== '';
      
      if (isLiveAlt) {
        console.log('✅ Jogo ao vivo detectado (estrutura alternativa):', 
          matchData.Casa || matchData.mandante, 'vs', matchData.Fora || matchData.visitante);
        return {
          mandante: matchData.Casa || matchData.mandante || 'Time Casa',
          visitante: matchData.Fora || matchData.visitante || 'Time Fora',
          placar_mandante: matchData['Gols Casa'] || matchData.placar_mandante || 0,
          placar_visitante: matchData['Gols fora'] || matchData.placar_visitante || 0,
          tempo: tempoAlt,
          campeonato: matchData.Campeonato || matchData.campeonato || 'Campeonato',
          status: tempoAlt.includes('Intervalo') ? 'INTERVALO' : 'AO_VIVO'
        };
      }

      console.log('Jogo não está ao vivo (Status/Tempo:', tempoAlt, ')');
      return null;
    } catch (error) {
      console.error('❌ Erro ao verificar jogo ao vivo:', error.message);
      return null;
    }
  };

  /**
   * Cria o CSS do modal e ícone ao vivo
   */
  const injectStyles = () => {
    if (document.getElementById('live-match-detector-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'live-match-detector-styles';
    styles.textContent = `
      /* ========================================
         MODAL DE JOGO AO VIVO
         ======================================== */
      .live-match-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: none;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      }

      .live-match-modal.active {
        display: flex;
      }

      .live-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
      }

      .live-modal-content {
        position: relative;
        background: white;
        border-radius: 1rem;
        max-width: 500px;
        width: 90%;
        padding: 2rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.4s ease;
      }

      .live-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }

      .live-badge-pulse {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background: #ef4444;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 9999px;
        font-weight: 700;
        font-size: 0.875rem;
        animation: pulse 2s infinite;
      }

      .live-dot {
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
        animation: blink 1.5s infinite;
      }

      .live-modal-close {
        background: rgba(0, 0, 0, 0.05);
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        color: #6b7280;
      }

      .live-modal-close:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #1f2937;
      }

      .live-modal-icon {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #003399, #001f5c);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
      }

      .live-modal-icon i {
        font-size: 2.5rem;
        color: #ffd700;
      }

      .live-modal-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1f2937;
        text-align: center;
        margin-bottom: 1rem;
      }

      .live-modal-match {
        background: linear-gradient(135deg, rgba(0, 51, 153, 0.05), rgba(255, 215, 0, 0.05));
        padding: 1.5rem;
        border-radius: 0.75rem;
        margin-bottom: 1rem;
        border: 1px solid rgba(0, 51, 153, 0.1);
      }

      .live-modal-teams {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .live-modal-team-name {
        font-weight: 600;
        color: #1f2937;
        font-size: 1rem;
        text-align: center;
        flex: 1;
      }

      .live-modal-score {
        font-size: 2rem;
        font-weight: 700;
        color: #003399;
        font-family: 'Poppins', sans-serif;
        margin: 0 1rem;
      }

      .live-modal-time {
        text-align: center;
        color: #6b7280;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .live-modal-text {
        text-align: center;
        color: #6b7280;
        margin-bottom: 1.5rem;
        line-height: 1.6;
      }

      .live-modal-countdown {
        font-size: 3rem;
        font-weight: 700;
        color: #003399;
        text-align: center;
        margin-bottom: 1.5rem;
        font-family: 'Poppins', sans-serif;
      }

      .live-modal-actions {
        display: flex;
        gap: 1rem;
      }

      .live-modal-actions .btn {
        flex: 1;
        padding: 0.875rem 1.5rem;
        border-radius: 0.5rem;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: none;
      }

      .live-modal-actions .btn-primary {
        background: #003399;
        color: white;
      }

      .live-modal-actions .btn-primary:hover {
        background: #001f5c;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 51, 153, 0.3);
      }

      .live-modal-actions .btn-secondary {
        background: #f3f4f6;
        color: #6b7280;
      }

      .live-modal-actions .btn-secondary:hover {
        background: #e5e7eb;
      }

      /* ========================================
         ÍCONE AO VIVO NOS PRÓXIMOS JOGOS
         ======================================== */
      .live-indicator {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #ef4444;
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-weight: 700;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        animation: pulse 2s infinite;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        z-index: 10;
      }

      .live-indicator-dot {
        width: 6px;
        height: 6px;
        background: white;
        border-radius: 50%;
        animation: blink 1.5s infinite;
      }

      .live-indicator-text {
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Botão "Assistir Ao Vivo" nos cards */
      .watch-live-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background: #ef4444;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        transition: all 0.2s;
        margin-top: 0.5rem;
        border: none;
        cursor: pointer;
      }

      .watch-live-btn:hover {
        background: #dc2626;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      }

      /* ========================================
         ANIMAÇÕES
         ======================================== */
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.8;
        }
      }

      @keyframes blink {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      /* ========================================
         RESPONSIVO
         ======================================== */
      @media (max-width: 640px) {
        .live-modal-content {
          padding: 1.5rem;
        }

        .live-modal-title {
          font-size: 1.25rem;
        }

        .live-modal-score {
          font-size: 1.5rem;
        }

        .live-modal-countdown {
          font-size: 2rem;
        }

        .live-modal-actions {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(styles);
  };

  /**
   * Cria o HTML do modal
   */
  const createModal = () => {
    if (document.getElementById('liveMatchModal')) return;

    const modalHTML = `
      <div class="live-match-modal" id="liveMatchModal">
        <div class="live-modal-overlay"></div>
        <div class="live-modal-content">
          <div class="live-modal-header">
            <div class="live-badge-pulse">
              <span class="live-dot"></span>
              <span class="live-text">AO VIVO</span>
            </div>
            <button class="live-modal-close" id="liveModalClose" aria-label="Fechar">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="live-modal-icon">
            <i class="fas fa-futbol"></i>
          </div>
          
          <h2 class="live-modal-title">Jogo do Cruzeiro está acontecendo!</h2>
          
          <div class="live-modal-match" id="liveModalMatchInfo">
            <div class="live-modal-teams">
              <span class="live-modal-team-name" id="liveTeam1">Time Casa</span>
              <span class="live-modal-score" id="liveScore">0 - 0</span>
              <span class="live-modal-team-name" id="liveTeam2">Time Fora</span>
            </div>
            <div class="live-modal-time" id="liveTime">1º TEMPO - 0'</div>
          </div>
          
          <p class="live-modal-text">
            Acompanhe todos os lances em tempo real na página Minuto a Minuto!
          </p>
          
          <div class="live-modal-countdown" id="liveModalCountdown">10</div>
          
          <div class="live-modal-actions">
            <button class="btn btn-primary" id="liveGoNowBtn">
              <i class="fas fa-play-circle"></i>
              Assistir Agora
            </button>
            <button class="btn btn-secondary" id="liveCancelBtn">
              <i class="fas fa-times"></i>
              Fechar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupModalEvents();
  };

  /**
   * Configura eventos do modal
   */
  const setupModalEvents = () => {
    const modal = document.getElementById('liveMatchModal');
    const closeBtn = document.getElementById('liveModalClose');
    const goNowBtn = document.getElementById('liveGoNowBtn');
    const cancelBtn = document.getElementById('liveCancelBtn');
    const overlay = modal?.querySelector('.live-modal-overlay');

    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    if (goNowBtn) goNowBtn.addEventListener('click', redirectToLive);
    if (overlay) overlay.addEventListener('click', hideModal);
  };

  /**
   * Mostra o modal com contagem regressiva
   */
  const showModal = (matchData) => {
    // Verifica se o usuário já dispensou o modal nesta sessão
    const dismissed = sessionStorage.getItem(CONFIG.storageKey);
    if (dismissed === 'true') {
      console.log('Modal já foi dispensado pelo usuário');
      return;
    }

    const modal = document.getElementById('liveMatchModal');
    const team1 = document.getElementById('liveTeam1');
    const team2 = document.getElementById('liveTeam2');
    const score = document.getElementById('liveScore');
    const time = document.getElementById('liveTime');
    const countdown = document.getElementById('liveModalCountdown');

    if (!modal) {
      console.error('Modal não encontrado no DOM');
      return;
    }

    // Atualiza informações do jogo
    if (team1) team1.textContent = matchData.mandante;
    if (team2) team2.textContent = matchData.visitante;
    if (score) score.textContent = `${matchData.placar_mandante} - ${matchData.placar_visitante}`;
    if (time) time.textContent = matchData.tempo;

    console.log('Mostrando modal para:', matchData.mandante, 'vs', matchData.visitante);

    // Inicia contagem regressiva
    let count = CONFIG.countdownSeconds;
    if (countdown) countdown.textContent = count;

    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
    }

    countdownIntervalId = setInterval(() => {
      count--;
      if (countdown) countdown.textContent = count;

      if (count <= 0) {
        clearInterval(countdownIntervalId);
        redirectToLive();
      }
    }, 1000);

    // Mostra modal
    modal.classList.add('active');
    modalShown = true;
    
    // Adiciona listener para tecla ESC
    document.addEventListener('keydown', handleEscKey);
  };

  /**
   * Manipula tecla ESC para fechar modal
   */
  const handleEscKey = (e) => {
    if (e.key === 'Escape') {
      hideModal();
    }
  };

  /**
   * Esconde o modal
   */
  const hideModal = () => {
    const modal = document.getElementById('liveMatchModal');
    if (modal) {
      modal.classList.remove('active');
    }

    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }

    // Marca que o usuário dispensou o modal
    sessionStorage.setItem(CONFIG.storageKey, 'true');
    modalShown = false;
    
    // Remove listener da tecla ESC
    document.removeEventListener('keydown', handleEscKey);
  };

  /**
   * Redireciona para a página ao vivo
   */
  const redirectToLive = () => {
    console.log('Redirecionando para:', CONFIG.minutoAMinutoUrl);
    window.location.href = CONFIG.minutoAMinutoUrl;
  };

  /**
   * Adiciona ícone "AO VIVO" nos cards de próximos jogos
   */
  const addLiveIndicators = (matchData) => {
    // Procura por cards de próximos jogos
    const matchCards = document.querySelectorAll('.next-match, .match-item, .horizontal-match-card, .match-card');
    
    if (matchCards.length === 0) {
      console.log('Nenhum card de jogo encontrado para adicionar indicador');
      return;
    }

    matchCards.forEach(card => {
      // Verifica se o card corresponde ao jogo ao vivo
      const cardText = card.textContent.toLowerCase();
      const mandante = matchData.mandante.toLowerCase();
      const visitante = matchData.visitante.toLowerCase();

      if (cardText.includes(mandante) && cardText.includes(visitante)) {
        console.log('Adicionando indicador ao vivo no card:', mandante, 'vs', visitante);
        
        // Remove indicador antigo se existir
        const oldIndicator = card.querySelector('.live-indicator');
        if (oldIndicator) oldIndicator.remove();

        // Adiciona novo indicador
        const indicator = document.createElement('div');
        indicator.className = 'live-indicator';
        indicator.innerHTML = `
          <span class="live-indicator-dot"></span>
          <span class="live-indicator-text">Ao Vivo</span>
        `;

        // Posiciona o card como relativo
        card.style.position = 'relative';
        card.appendChild(indicator);

        // Adiciona botão "Assistir Ao Vivo"
        const existingBtn = card.querySelector('.watch-live-btn');
        if (!existingBtn) {
          const watchBtn = document.createElement('a');
          watchBtn.href = CONFIG.minutoAMinutoUrl;
          watchBtn.className = 'watch-live-btn';
          watchBtn.innerHTML = `
            <i class="fas fa-play-circle"></i>
            Assistir Ao Vivo
          `;
          card.appendChild(watchBtn);
        }
      }
    });
  };

  /**
   * Remove indicadores ao vivo quando jogo termina
   */
  const removeLiveIndicators = () => {
    const indicators = document.querySelectorAll('.live-indicator');
    indicators.forEach(ind => ind.remove());

    const watchBtns = document.querySelectorAll('.watch-live-btn');
    watchBtns.forEach(btn => btn.remove());
  };

  /**
   * Loop principal de verificação
   */
  const startChecking = async () => {
    // MODO DE TESTE - Retorna dados simulados
    if (CONFIG.testMode) {
      console.log('🧪 MODO DE TESTE ATIVADO - Simulando jogo ao vivo');
      const liveMatch = CONFIG.testMatchData;
      currentLiveMatch = liveMatch;
      
      if (!modalShown) {
        showModal(liveMatch);
      }
      addLiveIndicators(liveMatch);
      return;
    }

    // Modo normal - verifica webhook
    const liveMatch = await checkLiveMatch();

    if (liveMatch) {
      console.log('Jogo ao vivo detectado:', liveMatch);
      currentLiveMatch = liveMatch;

      // Mostra modal apenas uma vez
      if (!modalShown) {
        showModal(liveMatch);
      }

      // Adiciona indicadores nos cards
      addLiveIndicators(liveMatch);
    } else {
      console.log('Nenhum jogo ao vivo detectado');
      // Remove indicadores se não há mais jogo ao vivo
      if (currentLiveMatch) {
        console.log('Removendo indicadores - jogo terminou');
        removeLiveIndicators();
        currentLiveMatch = null;
        modalShown = false;
      }
    }
  };

  /**
   * Inicializa o detector
   */
  const init = () => {
    console.log('LiveMatchDetector inicializando...');
    
    // Limpa sessionStorage para teste (remova em produção)
    // sessionStorage.removeItem(CONFIG.storageKey);
    
    // Injeta estilos
    injectStyles();

    // Cria modal
    createModal();

    // Primeira verificação
    startChecking();

    // Configura intervalo de verificação
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
    }
    
    checkIntervalId = setInterval(startChecking, CONFIG.checkInterval);
    console.log('LiveMatchDetector iniciado com intervalo de', CONFIG.checkInterval, 'ms');
  };

  /**
   * Para o detector
   */
  const stop = () => {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }

    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }

    hideModal();
  };

  // Interface pública
  return {
    init,
    stop,
    checkNow: startChecking,
    // DEBUG: expõe função para teste
    debug: () => ({ currentLiveMatch, modalShown })
  };
})();

// Auto-inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LiveMatchDetector.init());
} else {
  LiveMatchDetector.init();
}