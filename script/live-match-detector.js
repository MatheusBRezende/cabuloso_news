// live-match-detector.js - VERSÃO MELHORADA
// Detecção 5min antes + Escudos + Design Moderno

(function() {
  'use strict';

  // Espera o cache.js carregar
  function waitForCache(callback) {
    if (window.cabulosoCacheModule && window.cabulosoCacheModule.getFromCache) {
      callback();
    } else {
      setTimeout(() => waitForCache(callback), 100);
    }
  }

  const LiveMatchDetector = (() => {
    const CONFIG = {
      webhookUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=jogos",
      webhookUrlConsolidado: "https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos",
      
      checkInterval: 30000, // 30 segundos (mais frequente)
      minutoAMinutoUrl: "./minuto-a-minuto.html",
      storageKey: "cabuloso_live_match_dismissed",
      minutosAntes: 5, // Mostrar 5 minutos antes
    };

    let checkIntervalId = null;
    let currentLiveMatch = null;
    let modalShown = false;

    /**
     * Converte hora "HH:MM" para minutos desde meia-noite
     */
    const horaParaMinutos = (horaStr) => {
      const [h, m] = horaStr.split(':').map(Number);
      return h * 60 + m;
    };

    /**
     * Verifica se está próximo do horário do jogo (5min antes ou durante)
     */
    const isProximoOuDurante = (horaJogo) => {
      const agora = new Date();
      const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
      const minutosJogo = horaParaMinutos(horaJogo);
      
      // Considera até 3 horas depois do início (jogo pode estar rolando)
      const diferenca = minutosAgora - minutosJogo;
      
      return diferenca >= -CONFIG.minutosAntes && diferenca <= 180;
    };

    /**
     * OTIMIZADO: Tenta reutilizar cache antes de fazer requisição
     */
    const startMonitoringIfGameIsToday = async () => {
      try {
        let agenda = null;

        // Obtém a função do cache global
        const { getFromCache } = window.cabulosoCacheModule;

        // 1. TENTA REUTILIZAR CACHE DO ENDPOINT CONSOLIDADO
        const CACHE_KEY = "master_data_v3";
        const cachedData = getFromCache(CACHE_KEY);

        if (cachedData && cachedData.agenda) {
          console.log("📦 Live Detector: Reutilizando agenda do cache");
          agenda = cachedData.agenda;
        } else {
          // 2. SE NÃO TEM CACHE, BUSCA DO WORKER
          console.log("🌐 Live Detector: Buscando agenda do Worker");
          const response = await fetch(`${CONFIG.webhookUrl}&t=${Date.now()}`, {
            cache: "no-cache"
          });
          
          if (!response.ok) return;
          const data = await response.json();
          const responseData = Array.isArray(data) ? data[0] : data;

          if (!responseData || !Array.isArray(responseData.agenda)) return;
          
          agenda = responseData.agenda;
        }

        // 3. VERIFICA SE HÁ JOGO HOJE
        const hoje = new Date().toLocaleDateString('pt-BR');
        const jogoHoje = agenda.find(j => j.data === hoje);

        if (jogoHoje) {
          console.log("⚽ Jogo detectado para hoje às", jogoHoje.hora);
          
          // Verifica se está próximo do horário
          if (isProximoOuDurante(jogoHoje.hora)) {
            console.log("🔥 JOGO ESTÁ PRÓXIMO! (5min antes ou rolando)");
            
            // Configura os dados do jogo atual
            // Usa hora_exibida se disponivel (simulacao), senao usa hora normal
            const horaParaExibir = jogoHoje.hora_exibida || jogoHoje.hora;
            currentLiveMatch = {
              mandante: jogoHoje.mandante,
              visitante: jogoHoje.visitante,
              escudo_mandante: jogoHoje.escudo_mandante,
              escudo_visitante: jogoHoje.escudo_visitante,
              placar_mandante: 0,
              placar_visitante: 0,
              tempo: "HOJE ÀS " + horaParaExibir,
              campeonato: jogoHoje.campeonato,
              estadio: jogoHoje.estadio,
              hora: horaParaExibir
            };

            // Adiciona os indicadores visuais
            addLiveIndicators(currentLiveMatch);

            // Inicia o loop de checagem
            startCheckLoop();
            
            // Mostra o modal de convite
            showModal(currentLiveMatch);
          } else {
            console.log(`⏰ Jogo ainda não está próximo. Horário: ${jogoHoje.hora}`);
            
            // Agenda checagem periódica
            if (!checkIntervalId) {
              startCheckLoop();
            }
          }
        } else {
          console.log("📅 Sem jogos para hoje. Detector em modo de espera.");
        }
      } catch (err) {
        console.error("❌ Erro ao processar agenda:", err);
      }
    };

    /**
     * Loop de checagem
     */
    const startCheckLoop = () => {
      if (checkIntervalId) clearInterval(checkIntervalId);
      checkIntervalId = setInterval(async () => {
        console.log("🔍 Checando status do jogo de hoje...");
        await startMonitoringIfGameIsToday();
      }, CONFIG.checkInterval);
    };

    /**
     * Injeta os Estilos CSS - DESIGN MELHORADO
     */
    const injectStyles = () => {
      if (document.getElementById("live-match-detector-styles")) return;
      const styles = document.createElement("style");
      styles.id = "live-match-detector-styles";
      styles.textContent = `
        /* Modal Principal */
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
          animation: fadeIn 0.4s ease; 
        }
        .live-match-modal.active { display: flex; }
        
        .live-modal-overlay { 
          position: absolute; 
          top: 0; 
          left: 0; 
          right: 0; 
          bottom: 0; 
          background: rgba(0, 0, 0, 0.85); 
          backdrop-filter: blur(8px); 
        }
        
        /* Card do Modal */
        .live-modal-content { 
          position: relative; 
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 1.5rem; 
          max-width: 550px; 
          width: 90%; 
          padding: 2.5rem 2rem; 
          box-shadow: 0 25px 80px rgba(0,0,0,0.4); 
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        /* Badge "AO VIVO" */
        .live-badge-pulse { 
          display: inline-flex; 
          align-items: center; 
          gap: 0.5rem; 
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white; 
          padding: 0.6rem 1.2rem; 
          border-radius: 9999px; 
          font-weight: 800; 
          font-size: 0.9rem;
          letter-spacing: 0.5px;
          animation: pulse 2s infinite; 
          margin-bottom: 1rem;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }
        
        /* Título */
        .live-modal-title {
          color: #003399;
          font-size: 1.8rem;
          font-weight: 800;
          margin-bottom: 1.5rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* Container da Partida */
        .match-container {
          margin: 2rem 0;
          padding: 2rem 1.5rem;
          background: white;
          border-radius: 1.2rem;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
          border: 2px solid #f1f5f9;
        }
        
        /* Confronto (Times + Escudos) */
        .match-teams {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .team-box {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.8rem;
        }
        
        .team-logo {
          width: 70px;
          height: 70px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
          transition: transform 0.3s ease;
        }
        
        .team-logo:hover {
          transform: scale(1.1);
        }
        
        .team-name {
          font-weight: 700;
          font-size: 1.1rem;
          color: #1f2937;
          text-align: center;
          line-height: 1.2;
        }
        
        .vs-divider {
          font-size: 1.5rem;
          font-weight: 800;
          color: #94a3b8;
          padding: 0 0.5rem;
        }
        
        /* Informações do Jogo */
        .match-info {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 2px dashed #e2e8f0;
        }
        
        .match-time {
          font-size: 1.3rem;
          font-weight: 800;
          color: #ef4444;
          margin-bottom: 0.5rem;
        }
        
        .match-details {
          font-size: 0.95rem;
          color: #64748b;
          line-height: 1.6;
        }
        
        .match-details strong {
          color: #475569;
          font-weight: 600;
        }
        
        /* Descrição */
        .live-modal-description {
          color: #64748b;
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        
        /* Botões de Ação */
        .live-modal-actions { 
          display: flex; 
          gap: 1rem; 
          margin-top: 2rem;
        }
        
        .btn-live { 
          flex: 1; 
          padding: 1rem 1.5rem; 
          border-radius: 0.8rem; 
          font-weight: 700; 
          font-size: 1rem;
          cursor: pointer; 
          border: none; 
          transition: all 0.3s ease; 
          text-decoration: none; 
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .btn-primary { 
          background: linear-gradient(135deg, #003399 0%, #002266 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(0, 51, 153, 0.3);
        }
        
        .btn-primary:hover { 
          background: linear-gradient(135deg, #002266 0%, #001144 100%);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 51, 153, 0.4);
        }
        
        .btn-secondary { 
          background: #f1f5f9;
          color: #64748b;
          border: 2px solid #e2e8f0;
        }
        
        .btn-secondary:hover { 
          background: #e2e8f0;
          color: #475569;
          border-color: #cbd5e1;
        }
        
        /* Indicador "AO VIVO" nos Cards */
        .live-indicator { 
          position: absolute; 
          top: 10px; 
          right: 10px; 
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white; 
          padding: 6px 12px; 
          border-radius: 20px; 
          font-size: 11px; 
          font-weight: 800; 
          animation: pulse 2s infinite; 
          z-index: 10;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
          letter-spacing: 0.5px;
        }
        
        /* Animações */
        @keyframes pulse { 
          0%, 100% { opacity: 1; transform: scale(1); } 
          50% { opacity: 0.7; transform: scale(0.98); } 
        }
        
        @keyframes fadeIn { 
          from { opacity: 0; transform: scale(0.95); } 
          to { opacity: 1; transform: scale(1); } 
        }
        
        /* Responsivo */
        @media (max-width: 640px) {
          .live-modal-content {
            padding: 2rem 1.5rem;
          }
          
          .team-logo {
            width: 55px;
            height: 55px;
          }
          
          .team-name {
            font-size: 0.95rem;
          }
          
          .live-modal-title {
            font-size: 1.5rem;
          }
          
          .live-modal-actions {
            flex-direction: column;
          }
          
          .btn-live {
            width: 100%;
          }
        }
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
          <h2 class="live-modal-title">JOGO DO CRUZEIRO!</h2>
          
          <div class="match-container">
            <div class="match-teams">
              <div class="team-box">
                <img id="logoMandante" class="team-logo" src="" alt="Mandante">
                <div class="team-name" id="nameMandante"></div>
              </div>
              
              <div class="vs-divider">VS</div>
              
              <div class="team-box">
                <img id="logoVisitante" class="team-logo" src="" alt="Visitante">
                <div class="team-name" id="nameVisitante"></div>
              </div>
            </div>
            
            <div class="match-info">
              <div class="match-time" id="liveMatchTime"></div>
              <div class="match-details">
                <strong id="liveCampeonato"></strong><br>
                <span id="liveEstadio"></span>
              </div>
            </div>
          </div>
          
          <p class="live-modal-description">
            🔥 A partida está prestes a começar! Acompanhe todos os lances em tempo real no nosso minuto a minuto.
          </p>
          
          <div class="live-modal-actions">
            <a href="${CONFIG.minutoAMinutoUrl}" class="btn-live btn-primary">
              ▶ ASSISTIR AGORA
            </a>
            <button class="btn-live btn-secondary" id="closeLiveModal">
              MAIS TARDE
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Event listeners
      document.getElementById("closeLiveModal").addEventListener("click", hideModal);
      document.querySelector(".live-modal-overlay").addEventListener("click", hideModal);
    };

    const showModal = (match) => {
      if (sessionStorage.getItem(CONFIG.storageKey)) {
        console.log("ℹ️ Modal já foi mostrado nesta sessão");
        return;
      }
      
      // Preenche os dados do modal
      const logoMandante = document.getElementById("logoMandante");
      const logoVisitante = document.getElementById("logoVisitante");
      const nameMandante = document.getElementById("nameMandante");
      const nameVisitante = document.getElementById("nameVisitante");
      const timeElement = document.getElementById("liveMatchTime");
      const campeonatoElement = document.getElementById("liveCampeonato");
      const estadioElement = document.getElementById("liveEstadio");
      const modalElement = document.getElementById("liveMatchModal");
      
      if (logoMandante) logoMandante.src = match.escudo_mandante || '';
      if (logoVisitante) logoVisitante.src = match.escudo_visitante || '';
      if (nameMandante) nameMandante.textContent = match.mandante;
      if (nameVisitante) nameVisitante.textContent = match.visitante;
      if (timeElement) timeElement.textContent = match.hora;
      if (campeonatoElement) campeonatoElement.textContent = match.campeonato;
      if (estadioElement) estadioElement.textContent = match.estadio || 'Estádio a definir';
      if (modalElement) modalElement.classList.add("active");
      
      modalShown = true;
      console.log("📢 Modal de jogo ao vivo exibido (5min antes)");
    };

    const hideModal = () => {
      const modalElement = document.getElementById("liveMatchModal");
      if (modalElement) modalElement.classList.remove("active");
      
      sessionStorage.setItem(CONFIG.storageKey, "true");
      console.log("✅ Modal fechado pelo usuário");
    };

    const addLiveIndicators = (match) => {
      const cards = document.querySelectorAll(".next-match, .match-item");
      let indicatorsAdded = 0;
      
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const hasMandante = match.mandante && text.includes(match.mandante.toLowerCase());
        const hasVisitante = match.visitante && text.includes(match.visitante.toLowerCase());
        
        if (hasMandante || hasVisitante) {
          card.style.position = "relative";
          
          if (!card.querySelector(".live-indicator")) {
            const badge = document.createElement("div");
            badge.className = "live-indicator";
            badge.innerHTML = "● AO VIVO";
            card.appendChild(badge);
            indicatorsAdded++;
          }
        }
      });
      
      if (indicatorsAdded > 0) {
        console.log(`✅ ${indicatorsAdded} indicadores "AO VIVO" adicionados`);
      }
    };

    // Expõe hideModal globalmente para o onclick do overlay
    window.hideModal = hideModal;

    return {
      init: () => {
        console.log("🎯 Inicializando Live Match Detector (Versão Melhorada)...");
        
        injectStyles();
        createModal();
        startMonitoringIfGameIsToday();
        
        // Se o usuário mudar de aba e voltar, checa novamente
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden && !modalShown) {
            console.log("👁️ Página voltou ao foco, checando jogo...");
            startMonitoringIfGameIsToday();
          }
        });
        
        console.log("✅ Live Match Detector iniciado");
      },
      
      // Expõe métodos para debug
      refresh: startMonitoringIfGameIsToday,
      showModalDebug: () => {
        if (currentLiveMatch) {
          sessionStorage.removeItem(CONFIG.storageKey);
          showModal(currentLiveMatch);
        } else {
          console.warn("⚠️ Nenhum jogo detectado para hoje");
        }
      }
    };
  })();

  // Inicialização - Espera o cache carregar primeiro
  waitForCache(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', LiveMatchDetector.init);
    } else {
      LiveMatchDetector.init();
    }
  });

  // Expõe globalmente para debug
  window.LiveMatchDetector = LiveMatchDetector;

  console.log("💡 Dica: Use LiveMatchDetector.showModalDebug() para testar o modal");

})();