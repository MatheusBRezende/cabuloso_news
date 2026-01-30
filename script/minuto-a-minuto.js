
/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 2.3 - Logs otimizados
 */

const CONFIG = {
    webhookUrl: "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook-test/placar-ao-vivo",
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
    },
    logsEnabled: true, // Controle para logs
    agendaLoaded: false
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
        if (!response.ok) {
            if (state.logsEnabled) console.log('Webhook não disponível');
            return;
        }

        const rawData = await response.json();
        
        // CORREÇÃO: Extrai o primeiro objeto do array se necessário
        let data = rawData;
        if (Array.isArray(rawData) && rawData.length > 0) {
            data = rawData[0];
        }
        
        // DEBUG: Log para verificar a estrutura dos dados
        if (state.logsEnabled) {
            console.log('📥 Dados recebidos:', data);
            console.log('Placar:', data?.placar);
            console.log('Resultados:', data?.resultados);
        }

        // VALIDAÇÃO CORRIGIDA: Verifica se existe a estrutura completa
        if (!data || !data.placar || !data.resultados) {
            if (state.logsEnabled) console.log('⚠️ Dados incompletos ou inválidos');
            if (!state.matchStarted) renderPreMatchState();
            return;
        }

        // Se chegou aqui, o jogo começou
        if (state.countdownInterval) {
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
        }
        
        if (!state.matchStarted && state.logsEnabled) {
            console.log('✅ Jogo ao vivo detectado!');
        }
        
        state.matchStarted = true;
        
        // Atualiza o estado
        state.match.home.name = data.placar.home_name || "Mandante";
        state.match.home.logo = data.placar.home_logo || "assets/logo.png";
        state.match.away.name = data.placar.away_name || "Cruzeiro";
        state.match.away.logo = data.placar.away_logo || "https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/cruzeiro.png";
        state.match.score.home = data.placar.home ?? 0;
        state.match.score.away = data.placar.away ?? 0;
        state.match.status = data.placar.status || "AO VIVO";

        renderLiveMatch(data.resultados);

    } catch (error) {
        if (state.logsEnabled) console.error("Erro ao processar dados:", error.message);
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
            const tipoFormatado = lance.minuto || lance.tipo_formatado || lance.lance_tipo || "Lance";
            const icone = lance.icone || "📝";
            const classe = lance.classe || "lance-normal";
            
            // O filtro já foi feito no n8n, então apenas exibe
            return `
                <div class="timeline-item ${lance.is_gol ? 'goal-event' : ''} ${classe}">
                    <div class="timeline-time">${tipoFormatado}</div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-type">${icone}</span>
                        </div>
                        <div class="timeline-desc">${lance.descricao}</div>
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
        container.innerHTML = `
            <div class="live-match-container">
                <div style="padding:40px; text-align:center;">
                    Aguardando definição do próximo jogo...
                </div>
            </div>`;
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
                    <img src="${nextMatch.escudo_mandante || 'assets/logo.png'}" class="team-logo" 
                         onerror="this.src='assets/logo.png'">
                    <div class="team-name">${nextMatch.mandante}</div>
                </div>
                <div class="countdown-wrapper" id="countdown-wrapper">
                    <div class="countdown-label">A BOLA ROLA EM</div>
                    <div style="font-size: 2rem; font-weight:bold; margin-top: 10px;">--:--:--</div>
                </div>
                <div class="team">
                    <img src="${nextMatch.escudo_visitante || 'assets/logo.png'}" class="team-logo"
                         onerror="this.src='assets/logo.png'">
                    <div class="team-name">${nextMatch.visitante}</div>
                </div>
            </div>
        </div>
    `;
    
    startCountdown(nextMatch.dateObj);
};

const startCountdown = (targetDate) => {
    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
    }
    
    const update = () => {
        const now = new Date();
        const diff = targetDate - now;
        const wrapper = document.getElementById("countdown-wrapper");
        
        if (!wrapper) {
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
            return;
        }
        
        if (diff <= 0) {
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
            wrapper.innerHTML = `
                <div class="countdown-label">JOGO COMEÇOU!</div>
                <div style="font-size: 1.5rem; font-weight:bold; color: #ef4444; margin-top: 10px;">
                    AO VIVO
                </div>
            `;
            return;
        }
        
        const totalSeconds = Math.floor(diff / 1000);
        
        // Calcula dias, horas, minutos, segundos
        const dias = Math.floor(totalSeconds / 86400);
        const horas = Math.floor((totalSeconds % 86400) / 3600);
        const minutos = Math.floor((totalSeconds % 3600) / 60);
        const segundos = totalSeconds % 60;
        
        // Formatação com zero à esquerda
        const format = (num) => num.toString().padStart(2, '0');
        
        // Mostra contador
        if (dias > 0) {
            wrapper.innerHTML = `
                <div class="countdown-label">A BOLA ROLA EM</div>
                <div class="countdown-grid">
                    <div class="countdown-unit">
                        <span class="countdown-value">${dias}</span>
                        <span class="countdown-text">DIAS</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(horas)}</span>
                        <span class="countdown-text">HRS</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(minutos)}</span>
                        <span class="countdown-text">MIN</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(segundos)}</span>
                        <span class="countdown-text">SEG</span>
                    </div>
                </div>
            `;
        } else {
            wrapper.innerHTML = `
                <div class="countdown-label">A BOLA ROLA EM</div>
                <div class="countdown-grid">
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(horas)}</span>
                        <span class="countdown-text">HORAS</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(minutos)}</span>
                        <span class="countdown-text">MIN</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(segundos)}</span>
                        <span class="countdown-text">SEG</span>
                    </div>
                </div>
            `;
        }
    };
    
    state.countdownInterval = setInterval(update, 1000);
    update();
};

const loadAgenda = async () => {
    if (state.agendaLoaded) return;
    
    try {
        const response = await fetch(`${CONFIG.agendaUrl}?v=${Date.now()}`);
        if (response.ok) {
            state.agendaData = await response.json();
            state.agendaLoaded = true;
            
            if (state.logsEnabled) {
                console.log('📅 Agenda carregada com sucesso');
                console.log(`📊 Total de jogos: ${state.agendaData.length}`);
            }
            
            if (!state.matchStarted) renderPreMatchState();
        }
    } catch (e) {
        if (state.logsEnabled) console.error('Erro ao carregar agenda:', e.message);
    }
};

const getNextMatchFromAgenda = () => {
    if (!state.agendaData || !Array.isArray(state.agendaData)) {
        return null;
    }
    
    const now = new Date();
    const meses = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    };
    
    // Filtra jogos com hora definida
    const matchesWithTime = state.agendaData.filter(match => 
        match.hora && match.hora !== 'A definir' && match.hora !== 'undefined'
    );
    
    if (matchesWithTime.length === 0) {
        if (state.logsEnabled) console.log('⚠️ Nenhum jogo com hora definida');
        return null;
    }
    
    const parsedMatches = matchesWithTime.map(m => {
        try {
            // Parse da data (ex: "qui., 29 jan.")
            const dateStr = m.data.trim();
            const parts = dateStr.split(' ');
            
            // Remove pontos e vírgulas
            const dayStr = parts[1].replace(/[,.]/g, '');
            const monthStr = parts[2].replace(/[,.]/g, '').toLowerCase();
            
            const day = parseInt(dayStr);
            const month = meses[monthStr];
            
            if (isNaN(day) || month === undefined) {
                return null;
            }
            
            // Parse da hora (ex: "20:00")
            const [hours, minutes] = m.hora.split(':').map(num => parseInt(num));
            
            if (isNaN(hours) || isNaN(minutes)) {
                return null;
            }
            
            // Cria data
            let date = new Date();
            date.setDate(day);
            date.setMonth(month);
            date.setHours(hours);
            date.setMinutes(minutes);
            date.setSeconds(0);
            date.setMilliseconds(0);
            
            // Se a data já passou neste ano, assume próximo ano
            if (date < now) {
                date.setFullYear(date.getFullYear() + 1);
            }
            
            return { 
                ...m, 
                dateObj: date
            };
            
        } catch (e) {
            return null;
        }
    }).filter(m => m !== null);
    
    // Ordena por data mais próxima
    parsedMatches.sort((a, b) => a.dateObj - b.dateObj);
    
    // Retorna o mais próximo
    const nextMatch = parsedMatches[0];
    
    if (nextMatch && state.logsEnabled && !state.matchStarted) {
        console.log(`🎯 Próximo jogo: ${nextMatch.mandante} vs ${nextMatch.visitante}`);
        console.log(`⏰ Data: ${nextMatch.dateObj.toLocaleDateString()} ${nextMatch.hora}`);
        console.log(`🏆 Campeonato: ${nextMatch.campeonato}`);
    }
    
    return nextMatch;
};

const initNavigation = () => {
    const toggle = document.getElementById("menuToggle");
    const nav = document.getElementById("nav-menu");
    if (toggle && nav) toggle.addEventListener("click", () => nav.classList.toggle("active"));
    
    // Desativa logs após 5 segundos para não poluir console
    setTimeout(() => {
        state.logsEnabled = false;
    }, 5000);
};

// Função para ativar/desativar logs manualmente (opcional)
window.toggleLogs = () => {
    state.logsEnabled = !state.logsEnabled;
    console.log(`Logs ${state.logsEnabled ? 'ativados' : 'desativados'}`);
};
