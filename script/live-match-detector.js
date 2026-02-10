// live-match-detector.js - VERSÃO FINAL COMPATÍVEL
// Usa window.cabulosoCacheModule para obter as funções

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
      
      checkInterval: 60000, // 1 minuto
      minutoAMinutoUrl: "./minuto-a-minuto.html",
      storageKey: "cabuloso_live_match_dismissed",
    };

    let checkIntervalId = null;
    let currentLiveMatch = null;
    let modalShown = false;

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

          // Adiciona os indicadores visuais
          addLiveIndicators(currentLiveMatch);

          // Inicia o loop de checagem
          startCheckLoop();
          
          // Mostra o modal de convite
          showModal(currentLiveMatch);
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
        .btn-live { flex: 1; padding: 1rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; border: none; transition: 0.3s; text-decoration: none; display: block; text-align: center; }
        .btn-primary { background: #003399; color: white; }
        .btn-primary:hover { background: #002266; }
        .btn-secondary { background: #f3f4f6; color: #6b7280; }
        .btn-secondary:hover { background: #e5e7eb; }
        .live-indicator { position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; animation: pulse 2s infinite; z-index: 10; }
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
          <h2 style="color:#1f2937; margin-bottom:10px;">JOGO DO CRUZEIRO!</h2>
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
      
      // Event listeners
      document.getElementById("closeLiveModal").addEventListener("click", hideModal);
      document.querySelector(".live-modal-overlay").addEventListener("click", hideModal);
    };

    const showModal = (match) => {
      if (sessionStorage.getItem(CONFIG.storageKey)) {
        console.log("ℹ️ Modal já foi mostrado nesta sessão");
        return;
      }
      
      const teamsElement = document.getElementById("liveMatchTeams");
      const timeElement = document.getElementById("liveMatchTime");
      const modalElement = document.getElementById("liveMatchModal");
      
      if (teamsElement) teamsElement.textContent = `${match.mandante} x ${match.visitante}`;
      if (timeElement) timeElement.textContent = match.tempo;
      if (modalElement) modalElement.classList.add("active");
      
      modalShown = true;
      console.log("📢 Modal de jogo ao vivo exibido");
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
        console.log("🎯 Inicializando Live Match Detector...");
        
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
        if (currentLiveMatch) showModal(currentLiveMatch);
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