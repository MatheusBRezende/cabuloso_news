/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 2.0 - Totalmente Dinâmica e Integrada com n8n VAR
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
    // Dados do jogo atual vindos do n8n
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
        const data = Array.isArray(rawData) ? rawData[0] : rawData;

        // Se o n8n retornar resultados, entramos no modo Ao Vivo
        if (data.resultados && data.resultados.length > 0) {
            if (state.countdownInterval) {
                clearInterval(state.countdownInterval);
                state.countdownInterval = null;
            }
            state.matchStarted = true;
            
            // Atualiza o estado com os novos dados do placar do n8n
            state.match.home.name = data.placar.home_name;
            state.match.home.logo = data.placar.home_logo;
            state.match.away.name = data.placar.away_name;
            state.match.away.logo = data.placar.away_logo;
            state.match.score.home = data.placar.home;
            state.match.score.away = data.placar.away;
            state.match.status = data.placar.status;

            renderLiveMatch(data.resultados);
        } else {
            if (!state.matchStarted) renderPreMatchState();
        }
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
    }
};

const renderLiveMatch = (lances) => {
    const container = document.getElementById("live-match-container");
    const timeline = document.getElementById("timeline-container");
    if (!container) return;

    // Renderiza o Placar com os logos dinâmicos que o n8n enviou
    container.innerHTML = `
        <div class="live-match-container fade-in">
            <div class="match-header">
                <div class="match-competition"><i class="fas fa-trophy"></i> BRASILEIRÃO</div>
                <div class="match-status ${state.match.status === 'ENCERRADO' ? 'finished' : 'live'}">
                    ${state.match.status === 'AO VIVO' ? '<span class="blink-dot"></span>' : ''} ${state.match.status}
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

    // Renderiza a Timeline usando os campos formatados pelo n8n
    if (timeline) {
        timeline.innerHTML = lances.map(lance => `
            <div class="timeline-item ${lance.is_gol ? 'goal-event' : ''} ${lance.classe}">
                <div class="timeline-time">${lance.tipo_formatado}</div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <img src="${lance.logo_time}" class="timeline-team-logo" onerror="this.style.display='none'">
                        <span class="timeline-type">${lance.icone} ${lance.is_gol ? 'GOOOOL!' : ''}</span>
                    </div>
                    <div class="timeline-desc">${lance.descricao}</div>
                </div>
            </div>
        `).join('');
    }
};

// --- MANTÉM AS FUNÇÕES DE TIMER E AGENDA QUE JÁ FUNCIONAVAM ---

const renderPreMatchState = () => {
    const nextMatch = getNextMatchFromAgenda();
    const container = document.getElementById("live-match-container");
    if (!container || !nextMatch) return;

    container.innerHTML = `
        <div class="live-match-container fade-in">
            <div class="match-header">
                <div class="match-competition">PRÓXIMA PARTIDA</div>
                <div class="match-status waiting">AGUARDANDO</div>
            </div>
            <div class="score-row">
                <div class="team">
                    <img src="${nextMatch.escudo_mandante}" class="team-logo">
                    <div class="team-name">${nextMatch.mandante}</div>
                </div>
                <div class="countdown-wrapper" id="countdown-wrapper">
                    <div class="countdown-label">A BOLA ROLA EM</div>
                    <div style="font-size: 2rem; font-weight:bold;">--:--:--</div>
                </div>
                <div class="team">
                    <img src="${nextMatch.escudo_visitante}" class="team-logo">
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
    if (!state.agendaData) return null;
    const now = new Date();
    return state.agendaData.map(m => {
        try {
            const parts = m.data.split(' ');
            const day = parseInt(parts[0]);
            const months = {jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11};
            const date = new Date();
            date.setDate(day); date.setMonth(months[parts[1].toLowerCase()]);
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