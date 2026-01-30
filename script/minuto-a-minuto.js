/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 2.1 - Blindagem contra campos indefinidos
 */

const CONFIG = {
    webhookUrl: "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo",
    agendaUrl: "backend/agenda_cruzeiro.json",
    updateInterval: 10000,
};

const state = {
    matchStarted: false,
    agendaData: null,
    countdownInterval: null,
    match: {
        home: { name: "Mandante", logo: "" },
        away: { name: "Visitante", logo: "" },
        score: { home: 0, away: 0 },
        status: "AO VIVO"
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    loadAgenda();
    fetchLiveData();
    setInterval(fetchLiveData, CONFIG.updateInterval);
});

const fetchLiveData = async () => {
    try {
        const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`);
        if (!response.ok) return;

        const rawData = await response.json();
        // n8n geralmente retorna um array, pegamos o primeiro item
        const data = Array.isArray(rawData) ? rawData[0] : rawData;

        // VALIDAÇÃO: Se não houver placar ou resultados, mantemos o estado de espera
        if (!data || !data.placar || !data.resultados || data.resultados.length === 0) {
            if (!state.matchStarted) renderPreMatchState();
            return;
        }

        // Se chegou aqui, o jogo começou
        if (state.countdownInterval) {
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
        }
        state.matchStarted = true;
        
        // Atualiza o estado com fallbacks para evitar o erro de 'undefined'
        state.match.home.name = data.placar.home_name || "Mandante";
        state.match.home.logo = data.placar.home_logo || "assets/logo.png";
        state.match.away.name = data.placar.away_name || "Cruzeiro";
        state.match.away.logo = data.placar.away_logo || "https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/cruzeiro.png";
        state.match.score.home = data.placar.home ?? 0;
        state.match.score.away = data.placar.away ?? 0;
        state.match.status = data.placar.status || "AO VIVO";

        renderLiveMatch(data.resultados);

    } catch (error) {
        console.error("Erro ao processar dados do jogo:", error);
    }
};

const renderLiveMatch = (lances) => {
    const container = document.getElementById("live-match-container");
    const timeline = document.getElementById("timeline-container");
    if (!container) return;

    container.innerHTML = `
        <div class="live-match-container fade-in">
            <div class="match-header">
                <div class="match-competition"><i class="fas fa-trophy"></i> BRASILEIRÃO</div>
                <div class="match-status ${state.match.status.toLowerCase().includes('encerrado') ? 'finished' : 'live'}">
                    ${state.match.status.toUpperCase() === 'AO VIVO' ? '<span class="blink-dot"></span>' : ''} ${state.match.status}
                </div>
            </div>
            
            <div class="score-row">
                <div class="team">
                    <img src="${state.match.home.logo}" class="team-logo" onerror="this.src='assets/logo.png'">
                    <div class="team-name">${state.match.home.name}</div>
                </div>

                <div class="score-container">
                    <div class="score">${state.match.score.home} <span>x</span> ${state.match.score.away}</div>
                    <div class="match-time">Tempo Real</div>
                </div>

                <div class="team">
                    <img src="${state.match.away.logo}" class="team-logo" onerror="this.src='assets/logo.png'">
                    <div class="team-name">${state.match.away.name}</div>
                </div>
            </div>
        </div>
    `;

    if (timeline) {
        timeline.innerHTML = lances.map(lance => {
            // Prevenção de erro: verifica se os campos existem antes de usar toLowerCase()
            const tipoFormatado = lance.tipo_formatado || lance.lance_tipo || "Lance";
            const icone = lance.icone || "📝";
            const classe = lance.classe || "lance-normal";
            
            return `
                <div class="timeline-item ${lance.is_gol ? 'goal-event' : ''} ${classe}">
                    <div class="timeline-time">${tipoFormatado}</div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <img src="${lance.logo_time || ''}" class="timeline-team-logo" onerror="this.style.display='none'">
                            <span class="timeline-type">${icone} ${lance.is_gol ? 'GOOOOL!' : ''}</span>
                        </div>
                        <div class="timeline-desc">${lance.descricao || lance.lance_descricao || ""}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
};

// --- FUNÇÕES DE AGENDA E CRONÔMETRO ---

const renderPreMatchState = () => {
    const nextMatch = getNextMatchFromAgenda();
    const container = document.getElementById("live-match-container");
    if (!container) return;

    if (!nextMatch) {
        container.innerHTML = `<div class="live-match-container"><div style="padding:40px; text-align:center;">Aguardando definição do próximo jogo...</div></div>`;
        return;
    }

    container.innerHTML = `
        <div class="live-match-container fade-in">
            <div class="match-header">
                <div class="match-competition">PRÓXIMA PARTIDA</div>
                <div class="match-status waiting">AGUARDANDO</div>
            </div>
            <div class="score-row">
                <div class="team">
                    <img src="${nextMatch.escudo_mandante || 'assets/logo.png'}" class="team-logo">
                    <div class="team-name">${nextMatch.mandante}</div>
                </div>
                <div class="countdown-wrapper" id="countdown-wrapper">
                    <div class="countdown-label">A BOLA ROLA EM</div>
                    <div style="font-size: 2rem; font-weight:bold;">--:--:--</div>
                </div>
                <div class="team">
                    <img src="${nextMatch.escudo_visitante || 'assets/logo.png'}" class="team-logo">
                    <div class="team-name">${nextMatch.visitante}</div>
                </div>
            </div>
        </div>
    `;
    startCountdown(nextMatch.dateObj);
};

const startCountdown = (targetDate) => {
    if (state.countdownInterval) clearInterval(state.countdownInterval);
    const update = () => {
        const diff = targetDate - new Date();
        const wrapper = document.getElementById("countdown-wrapper");
        if (diff <= 0 || !wrapper) { clearInterval(state.countdownInterval); return; }
        
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        wrapper.innerHTML = `
            <div class="countdown-grid">
                <div class="countdown-unit"><span class="countdown-value">${d}</span><span class="countdown-text">DIAS</span></div>
                <div class="countdown-unit"><span class="countdown-value">${h}</span><span class="countdown-text">HRS</span></div>
                <div class="countdown-unit"><span class="countdown-value">${m}</span><span class="countdown-text">MIN</span></div>
                <div class="countdown-unit"><span class="countdown-value">${s}</span><span class="countdown-text">SEG</span></div>
            </div>`;
    };
    state.countdownInterval = setInterval(update, 1000);
    update();
};

const loadAgenda = async () => {
    try {
        const response = await fetch(`${CONFIG.agendaUrl}?v=${Date.now()}`);
        if (response.ok) {
            state.agendaData = await response.json();
            if (!state.matchStarted) renderPreMatchState(); 
        }
    } catch (e) {}
};

const getNextMatchFromAgenda = () => {
    if (!state.agendaData || !Array.isArray(state.agendaData)) return null;
    const now = new Date();
    const months = {jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11};
    
    return state.agendaData.map(m => {
        try {
            const parts = m.data.split(' ');
            const day = parseInt(parts[0]);
            const month = months[parts[1].toLowerCase().replace('.', '')];
            const date = new Date();
            date.setDate(day); date.setMonth(month);
            date.setHours(m.hora.split(':')[0]); date.setMinutes(m.hora.split(':')[1]);
            if (date < new Date(now.getTime() - 86400000)) date.setFullYear(date.getFullYear() + 1);
            return { ...m, dateObj: date };
        } catch(e) { return null; }
    }).filter(m => m && m.dateObj > now).sort((a,b) => a.dateObj - b.dateObj)[0];
};

const initNavigation = () => {
    const toggle = document.getElementById("menuToggle");
    const nav = document.getElementById("nav-menu");
    if (toggle && nav) toggle.addEventListener("click", () => nav.classList.toggle("active"));
};