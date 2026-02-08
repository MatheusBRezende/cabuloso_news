const LiveMatchDetector = (() => {
  const CONFIG = {
    // API que traz a agenda completa
    webhookUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=jogos",
    checkInterval: 60000, // 1 minuto (ideal para não pesar)
    minutoAMinutoUrl: "../minuto-a-minuto.html",
    storageKey: "cabuloso_live_match_dismissed",
  };

  let checkIntervalId = null;
  let currentLiveMatch = null;
  let modalShown = false;

  /**
   * Verifica a agenda e decide se deve monitorar o jogo
   */
  const startMonitoringIfGameIsToday = async () => {
    try {
      const response = await fetch(`${CONFIG.webhookUrl}&t=${Date.now()}`, {
        cache: "no-cache"
      });
      
      if (!response.ok) return;
      const data = await response.json();
      const responseData = Array.isArray(data) ? data[0] : data;

      if (!responseData || !Array.isArray(responseData.agenda)) return;

      // 1. Pega a data de hoje (DD/MM/AAAA)
      const hoje = new Date().toLocaleDateString('pt-BR');

      // 2. Procura se tem jogo do Cruzeiro hoje
      const jogoHoje = responseData.agenda.find(j => j.data === hoje);

      if (jogoHoje) {
        console.log("⚽ Jogo detectado para hoje! Iniciando monitoramento...");
        
        // Configura os dados do jogo atual
        currentLiveMatch = {
          mandante: jogoHoje.mandante,
          visitante: jogoHoje.visitante,
          placar_mandante: 0,
          placar_visitante: 0,
          tempo: "HOJE ÀS " + jogoHoje.hora,
          campeonato: jogoHoje.campeonato
        };

        // Adiciona os indicadores visuais nos cards da página
        addLiveIndicators(currentLiveMatch);

        // Inicia o loop de checagem (opcional, caso queira atualizar placar)
        startCheckLoop();
        
        // Mostra o modal de convite
        showModal(currentLiveMatch);
      } else {
        console.log("📅 Sem jogos para hoje. Detector em modo de espera.");
      }
    } catch (err) {
      console.error("Erro ao processar agenda:", err);
    }
  };

  const startCheckLoop = () => {
    if (checkIntervalId) clearInterval(checkIntervalId);
    checkIntervalId = setInterval(async () => {
        // Aqui você poderia chamar uma API de placar em tempo real se tiver
        console.log("Checando status do jogo de hoje...");
    }, CONFIG.checkInterval);
  };

  /**
   * Injeta os Estilos CSS
   */
  const injectStyles = () => {
    if (document.getElementById("live-match-detector-styles")) return;
    const styles = document.createElement("style");
    styles.id = "live-match-detector-styles";
    styles.textContent = `
      .live-match-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; display: none; align-items: center; justify-content: center; animation: fadeIn 0.3s ease; }
      .live-match-modal.active { display: flex; }
      .live-modal-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); }
      .live-modal-content { position: relative; background: white; border-radius: 1rem; max-width: 500px; width: 90%; padding: 2rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
      .live-badge-pulse { display: inline-flex; align-items: center; gap: 0.5rem; background: #ef4444; color: white; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: 700; animation: pulse 2s infinite; margin-bottom: 1rem; }
      .live-modal-score { font-size: 2.5rem; font-weight: 800; color: #003399; margin: 1rem 0; display: block; }
      .live-modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
      .btn-live { flex: 1; padding: 1rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; border: none; transition: 0.3s; text-decoration: none; }
      .btn-primary { background: #003399; color: white; }
      .btn-secondary { background: #f3f4f6; color: #6b7280; }
      .live-indicator { position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; animation: pulse 2s infinite; }
      @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    `;
    document.head.appendChild(styles);
  };

  const createModal = () => {
    if (document.getElementById("liveMatchModal")) return;
    const modal = document.createElement("div");
    modal.id = "liveMatchModal";
    modal.className = "live-match-modal";
    modal.innerHTML = `
      <div class="live-modal-overlay"></div>
      <div class="live-modal-content">
        <div class="live-badge-pulse">● AO VIVO</div>
        <h2 style="color:#1f2937">JOGO DO CRUZEIRO!</h2>
        <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 10px;">
          <div style="font-weight: 700; font-size: 1.1rem;" id="liveMatchTeams"></div>
          <span class="live-modal-score" id="liveScore">VS</span>
          <div id="liveMatchTime" style="color: #6b7280; font-size: 0.9rem;"></div>
        </div>
        <p style="color: #6b7280; margin-bottom: 20px;">Acompanhe todos os lances em tempo real no nosso minuto a minuto!</p>
        <div class="live-modal-actions">
          <a href="${CONFIG.minutoAMinutoUrl}" class="btn-live btn-primary">ASSISTIR AGORA</a>
          <button class="btn-live btn-secondary" id="closeLiveModal">MAIS TARDE</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("closeLiveModal").addEventListener("click", hideModal);
  };

  const showModal = (match) => {
    if (sessionStorage.getItem(CONFIG.storageKey)) return;
    
    document.getElementById("liveMatchTeams").textContent = `${match.mandante} x ${match.visitante}`;
    document.getElementById("liveMatchTime").textContent = match.tempo;
    document.getElementById("liveMatchModal").classList.add("active");
    modalShown = true;
  };

  const hideModal = () => {
    document.getElementById("liveMatchModal").classList.remove("active");
    sessionStorage.setItem(CONFIG.storageKey, "true");
  };

  const addLiveIndicators = (match) => {
    const cards = document.querySelectorAll(".next-match");
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (text.includes(match.mandante.toLowerCase()) || text.includes(match.visitante.toLowerCase())) {
        card.style.position = "relative";
        if (!card.querySelector(".live-indicator")) {
          const badge = document.createElement("div");
          badge.className = "live-indicator";
          badge.innerHTML = "● AO VIVO";
          card.appendChild(badge);
        }
      }
    });
  };

  return {
    init: () => {
      injectStyles();
      createModal();
      startMonitoringIfGameIsToday();
      
      // Se o usuário mudar de aba e voltar, checamos se o jogo começou
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && !modalShown) startMonitoringIfGameIsToday();
      });
    }
  };
})();

// Inicialização
LiveMatchDetector.init();