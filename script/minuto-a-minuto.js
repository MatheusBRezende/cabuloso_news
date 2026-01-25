/**
 * Cabuloso News - Minuto a Minuto
 * Acompanhamento ao vivo dos jogos do Cruzeiro
 */

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
    webhookUrl: 'https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo',
    agendaUrl: './backend/agenda_cruzeiro.json',
    updateInterval: 10000, 
    redirectCountdown: 5, 
    defaultTeamLogo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
    checkLiveInterval: 60000 
};

// ============================================
// ESTADO DA APLICAÇÃO
// ============================================
const state = {
    currentMatch: null,
    matchData: null,
    agendaData: null,
    lastGoalCount: 0,
    goalAnimation: null,
    isModalShown: false,
    redirectTimer: null,
    liveUpdateInterval: null,
    lastUpdateTime: null
};

// ============================================
// INICIALIZAÇÃO DA PÁGINA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    setupGoalAnimation();
    loadAgendaData();
    checkForLiveMatches();
    
    // Verifica jogos ao vivo periodicamente
    setInterval(checkForLiveMatches, CONFIG.checkLiveInterval);
    
    // Verifica se há redirecionamento pendente
    checkRedirectFromStorage();
});

// ============================================
// NAVEGAÇÃO MOBILE
// ============================================
const initNavigation = () => {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('nav-menu');

    if (!menuToggle || !navMenu) return;

    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        const isExpanded = navMenu.classList.contains('active');
        menuToggle.setAttribute('aria-expanded', isExpanded);
    });

    // Fecha o menu ao clicar em um link
    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
        });
    });
};

// ============================================
// CARREGAR DADOS DA AGENDA
// ============================================
const loadAgendaData = async () => {
    try {
        const response = await fetch(CONFIG.agendaUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Erro ao carregar agenda');
        
        const data = await response.json();
        state.agendaData = Array.isArray(data) ? data : (data.dados_completos || []);
        
        // Verifica se há algum jogo em andamento
        checkForLiveMatches();
    } catch (error) {
        console.error('Erro ao carregar agenda:', error);
        showNoMatchMessage('Erro ao carregar agenda de jogos.');
    }
};

// ============================================
// VERIFICAR JOGOS AO VIVO
// ============================================
const checkForLiveMatches = () => {
    if (!state.agendaData || state.agendaData.length === 0) {
        showNoMatchMessage('Carregando agenda de jogos...');
        return;
    }

    const now = new Date();
    let foundLiveMatch = false;

    // Procura por jogos que estão acontecendo agora
    state.agendaData.forEach(jogo => {
        if (!jogo.data || !jogo.hora || jogo.hora === 'A definir') return;
        
        try {
            // Converter data do formato "dom., 25 jan."
            const dateParts = jogo.data.split(' ');
            if (dateParts.length < 3) return;
            
            const day = parseInt(dateParts[1]);
            const monthName = dateParts[2].replace('.', '').toLowerCase();
            
            // Mapear mês para número
            const months = {
                'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
            };
            
            const month = months[monthName];
            if (month === undefined) return;
            
            // Converter hora
            const [hour, minute] = jogo.hora.split(':').map(num => parseInt(num));
            if (isNaN(hour) || isNaN(minute)) return;
            
            // Criar data do jogo (assumindo ano atual)
            const matchDate = new Date(now.getFullYear(), month, day, hour, minute);
            
            // Adicionar 2 horas para duração do jogo
            const matchEnd = new Date(matchDate.getTime() + (2 * 60 * 60 * 1000));
            
            // Verificar se o jogo está acontecendo agora
            if (now >= matchDate && now <= matchEnd) {
                foundLiveMatch = true;
                state.currentMatch = jogo;
                
                // Iniciar atualização ao vivo
                startLiveUpdates();
                
                // Mostrar o placar
                renderLiveMatch(jogo);
                
                // Verificar se precisa mostrar modal de redirecionamento
                if (!state.isModalShown) {
                    const timeSinceStart = now.getTime() - matchDate.getTime();
                    // Mostrar modal se o jogo começou há menos de 5 minutos
                    if (timeSinceStart < 5 * 60 * 1000) {
                        showRedirectModal(jogo);
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao processar data do jogo:', error, jogo);
        }
    });

    if (!foundLiveMatch) {
        // Verifica se há próximo jogo
        const nextMatch = findNextMatch();
        if (nextMatch) {
            renderUpcomingMatch(nextMatch);
        } else {
            showNoMatchMessage('Não há jogos ao vivo no momento. Próximo jogo em breve.');
        }
    }
};

// ============================================
// ENCONTRAR PRÓXIMO JOGO
// ============================================
const findNextMatch = () => {
    if (!state.agendaData) return null;
    
    const now = new Date();
    let closestMatch = null;
    let closestTime = Infinity;

    state.agendaData.forEach(jogo => {
        if (!jogo.data || !jogo.hora || jogo.hora === 'A definir') return;
        
        try {
            const dateParts = jogo.data.split(' ');
            if (dateParts.length < 3) return;
            
            const day = parseInt(dateParts[1]);
            const monthName = dateParts[2].replace('.', '').toLowerCase();
            
            const months = {
                'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
            };
            
            const month = months[monthName];
            if (month === undefined) return;
            
            const [hour, minute] = jogo.hora.split(':').map(num => parseInt(num));
            if (isNaN(hour) || isNaN(minute)) return;
            
            const matchDate = new Date(now.getFullYear(), month, day, hour, minute);
            
            // Se o jogo for no futuro
            if (matchDate > now) {
                const timeDiff = matchDate.getTime() - now.getTime();
                if (timeDiff < closestTime) {
                    closestTime = timeDiff;
                    closestMatch = { ...jogo, matchDate };
                }
            }
        } catch (error) {
            console.error('Erro ao processar data do próximo jogo:', error);
        }
    });

    return closestMatch;
};

// ============================================
// MOSTRAR MENSAGEM SEM JOGO
// ============================================
const showNoMatchMessage = (message = 'Não há jogos ao vivo no momento.') => {
    const container = document.getElementById('live-match-container');
    const timeline = document.getElementById('timeline');
    
    if (container) {
        container.innerHTML = `
            <div class="no-match-message">
                <div class="no-match-icon">
                    <i class="fas fa-futbol"></i>
                </div>
                <h2 class="no-match-title">Nenhum Jogo ao Vivo</h2>
                <p class="no-match-text">${message}</p>
                <button class="btn btn-primary" onclick="loadAgendaData()">
                    <i class="fas fa-sync-alt"></i>
                    Atualizar
                </button>
            </div>
        `;
    }
    
    if (timeline) {
        timeline.innerHTML = `
            <div class="no-events-message">
                <i class="fas fa-clock"></i>
                <p>Nenhum jogo em andamento no momento.</p>
            </div>
        `;
    }
    
    // Atualizar status
    const statusIndicator = document.getElementById('match-status-indicator');
    if (statusIndicator) {
        statusIndicator.textContent = 'SEM JOGO';
        statusIndicator.className = 'match-status waiting';
    }
    
    // Parar atualizações ao vivo
    stopLiveUpdates();
};

// ============================================
// RENDERIZAR JOGO AO VIVO
// ============================================
const renderLiveMatch = (jogo) => {
    const container = document.getElementById('live-match-container');
    if (!container) return;

    const isCruzeiroHome = jogo.mandante.toLowerCase().includes('cruzeiro');
    const isCruzeiroAway = jogo.visitante.toLowerCase().includes('cruzeiro');
    
    container.innerHTML = `
        <div class="live-match-container">
            <div class="match-header">
                <div class="match-info-row">
                    <div class="match-competition">
                        <i class="fas fa-trophy"></i>
                        <span>${escapeHtml(jogo.campeonato)}</span>
                    </div>
                    <div class="match-status live" id="current-match-status">AO VIVO</div>
                </div>
                <div class="match-stadium">
                    <i class="fas fa-location-dot"></i>
                    <span>${escapeHtml(jogo.estadio || 'Estádio a definir')}</span>
                </div>
            </div>
            
            <div class="score-row">
                <div class="team ${isCruzeiroHome ? 'team-cruzeiro' : ''}">
                    <img src="${escapeHtml(jogo.escudo_mandante || CONFIG.defaultTeamLogo)}" 
                         alt="${escapeHtml(jogo.mandante)}" 
                         class="team-logo"
                         onerror="this.src='${CONFIG.defaultTeamLogo}'">
                    <div class="team-name">${escapeHtml(jogo.mandante)}</div>
                </div>
                
                <div class="score-container">
                    <div class="score" id="current-score">0 - 0</div>
                    <div class="match-time" id="match-time">1º TEMPO - 0'</div>
                </div>
                
                <div class="team ${isCruzeiroAway ? 'team-cruzeiro' : ''}">
                    <img src="${escapeHtml(jogo.escudo_visitante || CONFIG.defaultTeamLogo)}" 
                         alt="${escapeHtml(jogo.visitante)}" 
                         class="team-logo"
                         onerror="this.src='${CONFIG.defaultTeamLogo}'">
                    <div class="team-name">${escapeHtml(jogo.visitante)}</div>
                </div>
            </div>
            
            <div class="stats-container">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-title">Posse de Bola</div>
                        <div class="stat-bars">
                            <div class="stat-value" id="possession-home">50%</div>
                            <div class="stat-bar-container">
                                <div class="stat-bar" id="possession-bar-home" style="width: 50%"></div>
                            </div>
                            <div class="stat-value" id="possession-away">50%</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-title">Escanteios</div>
                        <div class="stat-bars">
                            <div class="stat-value" id="corners-home">0</div>
                            <div class="stat-bar-container">
                                <div class="stat-bar" id="corners-bar-home" style="width: 0%"></div>
                            </div>
                            <div class="stat-value" id="corners-away">0</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-title">Finalizações</div>
                        <div class="stat-bars">
                            <div class="stat-value" id="shots-home">0</div>
                            <div class="stat-bar-container">
                                <div class="stat-bar" id="shots-bar-home" style="width: 0%"></div>
                            </div>
                            <div class="stat-value" id="shots-away">0</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Atualizar status
    const statusIndicator = document.getElementById('match-status-indicator');
    if (statusIndicator) {
        statusIndicator.textContent = 'AO VIVO';
        statusIndicator.className = 'match-status live';
    }
};

// ============================================
// RENDERIZAR PRÓXIMO JOGO
// ============================================
const renderUpcomingMatch = (jogo) => {
    const container = document.getElementById('live-match-container');
    if (!container) return;

    const isCruzeiroHome = jogo.mandante.toLowerCase().includes('cruzeiro');
    const isCruzeiroAway = jogo.visitante.toLowerCase().includes('cruzeiro');
    
    // Calcular tempo até o jogo
    const now = new Date();
    const timeDiff = jogo.matchDate.getTime() - now.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeUntil = '';
    if (hours > 0) {
        timeUntil = `${hours}h ${minutes}m`;
    } else {
        timeUntil = `${minutes} minutos`;
    }
    
    container.innerHTML = `
        <div class="live-match-container">
            <div class="match-header">
                <div class="match-info-row">
                    <div class="match-competition">
                        <i class="fas fa-trophy"></i>
                        <span>${escapeHtml(jogo.campeonato)}</span>
                    </div>
                    <div class="match-status upcoming">PRÓXIMO</div>
                </div>
                <div class="match-stadium">
                    <i class="fas fa-location-dot"></i>
                    <span>${escapeHtml(jogo.estadio || 'Estádio a definir')}</span>
                </div>
            </div>
            
            <div class="score-row">
                <div class="team ${isCruzeiroHome ? 'team-cruzeiro' : ''}">
                    <img src="${escapeHtml(jogo.escudo_mandante || CONFIG.defaultTeamLogo)}" 
                         alt="${escapeHtml(jogo.mandante)}" 
                         class="team-logo"
                         onerror="this.src='${CONFIG.defaultTeamLogo}'">
                    <div class="team-name">${escapeHtml(jogo.mandante)}</div>
                </div>
                
                <div class="score-container">
                    <div class="score">X - X</div>
                    <div class="match-time">Começa em ${timeUntil}</div>
                </div>
                
                <div class="team ${isCruzeiroAway ? 'team-cruzeiro' : ''}">
                    <img src="${escapeHtml(jogo.escudo_visitante || CONFIG.defaultTeamLogo)}" 
                         alt="${escapeHtml(jogo.visitante)}" 
                         class="team-logo"
                         onerror="this.src='${CONFIG.defaultTeamLogo}'">
                    <div class="team-name">${escapeHtml(jogo.visitante)}</div>
                </div>
            </div>
            
            <div class="stats-container" style="text-align: center; padding: var(--space-6);">
                <p style="color: var(--gray-600); margin-bottom: var(--space-4);">
                    <i class="fas fa-clock"></i> Este jogo começará em ${timeUntil}
                </p>
                <button class="btn btn-primary" onclick="setReminder('${jogo.data}', '${jogo.hora}')">
                    <i class="fas fa-bell"></i>
                    Lembrar-me
                </button>
            </div>
        </div>
    `;
    
    // Atualizar status
    const statusIndicator = document.getElementById('match-status-indicator');
    if (statusIndicator) {
        statusIndicator.textContent = 'AGUARDANDO';
        statusIndicator.className = 'match-status waiting';
    }
    
    // Limpar timeline
    const timeline = document.getElementById('timeline');
    if (timeline) {
        timeline.innerHTML = `
            <div class="no-events-message">
                <i class="fas fa-clock"></i>
                <p>Jogo ainda não começou. Volte mais tarde para acompanhar minuto a minuto.</p>
            </div>
        `;
    }
};

// ============================================
// ATUALIZAÇÕES AO VIVO
// ============================================
const startLiveUpdates = () => {
    // Limpar intervalo anterior
    if (state.liveUpdateInterval) {
        clearInterval(state.liveUpdateInterval);
    }
    
    // Iniciar novo intervalo
    state.liveUpdateInterval = setInterval(fetchLiveData, CONFIG.updateInterval);
    
    // Primeira atualização imediata
    fetchLiveData();
};

const stopLiveUpdates = () => {
    if (state.liveUpdateInterval) {
        clearInterval(state.liveUpdateInterval);
        state.liveUpdateInterval = null;
    }
};

const fetchLiveData = async () => {
    if (!state.currentMatch) return;
    
    try {
        const response = await fetch(CONFIG.webhookUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Erro ao buscar dados ao vivo');
        
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            const liveData = data[0];
            updateMatchData(liveData);
            updateTimeline(liveData);
            state.lastUpdateTime = new Date();
        }
    } catch (error) {
        console.error('Erro ao buscar dados ao vivo:', error);
        // Usar dados simulados para demonstração
        updateWithMockData();
    }
};

// ============================================
// ATUALIZAR DADOS DO JOGO
// ============================================
const updateMatchData = (liveData) => {
    // Atualizar placar
    const scoreElement = document.getElementById('current-score');
    if (scoreElement && liveData['Gols Casa'] !== undefined && liveData['Gols fora'] !== undefined) {
        const homeScore = parseInt(liveData['Gols Casa']) || 0;
        const awayScore = parseInt(liveData['Gols fora']) || 0;
        scoreElement.textContent = `${homeScore} - ${awayScore}`;
        
        // Verificar se houve gol
        const totalGoals = homeScore + awayScore;
        if (totalGoals > state.lastGoalCount) {
            playGoalAnimation();
            state.lastGoalCount = totalGoals;
        }
    }
    
    // Atualizar tempo
    const timeElement = document.getElementById('match-time');
    if (timeElement && liveData['Tempo_Jogo']) {
        timeElement.textContent = liveData['Tempo_Jogo'];
    }
    
    // Atualizar estatísticas
    updateStatistics(liveData);
    
    // Atualizar status
    updateMatchStatus(liveData);
};

const updateStatistics = (liveData) => {
    // Posse de bola
    const possessionHome = parseInt(liveData.Posse_Casa) || 50;
    const possessionAway = 100 - possessionHome;
    
    const possessionHomeElement = document.getElementById('possession-home');
    const possessionAwayElement = document.getElementById('possession-away');
    const possessionBarHome = document.getElementById('possession-bar-home');
    
    if (possessionHomeElement) possessionHomeElement.textContent = `${possessionHome}%`;
    if (possessionAwayElement) possessionAwayElement.textContent = `${possessionAway}%`;
    if (possessionBarHome) possessionBarHome.style.width = `${possessionHome}%`;
    
    // Escanteios
    const cornersHome = parseInt(liveData.Escanteios_Casa) || 0;
    const cornersAway = parseInt(liveData.Escanteios_Fora) || 0;
    const totalCorners = cornersHome + cornersAway;
    const cornersPercentage = totalCorners > 0 ? Math.round((cornersHome / totalCorners) * 100) : 0;
    
    const cornersHomeElement = document.getElementById('corners-home');
    const cornersAwayElement = document.getElementById('corners-away');
    const cornersBarHome = document.getElementById('corners-bar-home');
    
    if (cornersHomeElement) cornersHomeElement.textContent = cornersHome;
    if (cornersAwayElement) cornersAwayElement.textContent = cornersAway;
    if (cornersBarHome) cornersBarHome.style.width = `${cornersPercentage}%`;
    
    // Finalizações
    const shotsHome = parseInt(liveData.Finalizacoes_Casa) || 0;
    const shotsAway = parseInt(liveData.Finalizacoes_Fora) || 0;
    const totalShots = shotsHome + shotsAway;
    const shotsPercentage = totalShots > 0 ? Math.round((shotsHome / totalShots) * 100) : 0;
    
    const shotsHomeElement = document.getElementById('shots-home');
    const shotsAwayElement = document.getElementById('shots-away');
    const shotsBarHome = document.getElementById('shots-bar-home');
    
    if (shotsHomeElement) shotsHomeElement.textContent = shotsHome;
    if (shotsAwayElement) shotsAwayElement.textContent = shotsAway;
    if (shotsBarHome) shotsBarHome.style.width = `${shotsPercentage}%`;
};

const updateMatchStatus = (liveData) => {
    const statusElement = document.getElementById('current-match-status');
    const globalStatusElement = document.getElementById('match-status-indicator');
    
    if (!statusElement || !globalStatusElement) return;
    
    const tempo = liveData['Tempo_Jogo'] || '';
    
    if (tempo.includes('Intervalo') || tempo.includes('Intervalo')) {
        statusElement.textContent = 'INTERVALO';
        statusElement.className = 'match-status half-time';
        globalStatusElement.textContent = 'INTERVALO';
        globalStatusElement.className = 'match-status half-time';
    } else if (tempo.includes('Fim') || tempo.includes('Encerrado')) {
        statusElement.textContent = 'FINALIZADO';
        statusElement.className = 'match-status finished';
        globalStatusElement.textContent = 'FINALIZADO';
        globalStatusElement.className = 'match-status finished';
        stopLiveUpdates();
    } else if (tempo.includes('Acréscimo')) {
        statusElement.textContent = 'ACRÉSCIMO';
        statusElement.className = 'match-status live';
        globalStatusElement.textContent = 'ACRÉSCIMO';
        globalStatusElement.className = 'match-status live';
    } else {
        statusElement.textContent = 'AO VIVO';
        statusElement.className = 'match-status live';
        globalStatusElement.textContent = 'AO VIVO';
        globalStatusElement.className = 'match-status live';
    }
};

// ============================================
// ATUALIZAR TIMELINE
// ============================================
const updateTimeline = (liveData) => {
    const timeline = document.getElementById('timeline-container'); // Verifique se o ID está correto no HTML
    if (!timeline || !Array.isArray(liveData)) return;

    timeline.innerHTML = ''; 

    liveData.forEach(lance => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="time">${lance.lance_minuto}</div>
            <div class="content">
                <strong>${lance.lance_tipo}</strong>
                <p>${lance.lance_descricao}</p>
            </div>
        `;
        timeline.appendChild(item);
    });
};

// ============================================
// ANIMAÇÃO DE GOL
// ============================================
const setupGoalAnimation = () => {
    state.goalAnimation = lottie.loadAnimation({
        container: document.getElementById('goal-animation-lottie'),
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: 'https://assets5.lottiefiles.com/packages/lf20_kdx2qcps.json' // Animação de gol
    });
    
    // Esconder animação quando terminar
    state.goalAnimation.addEventListener('complete', () => {
        setTimeout(() => {
            document.getElementById('goal-animation').classList.remove('active');
        }, 1000);
    });
};

const playGoalAnimation = () => {
    const animation = document.getElementById('goal-animation');
    if (animation && state.goalAnimation) {
        animation.classList.add('active');
        state.goalAnimation.goToAndPlay(0);
        
        // Som de gol (opcional)
        try {
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3');
            audio.volume = 0.3;
            audio.play().catch(e => console.log('Áudio não pode ser reproduzido:', e));
        } catch (e) {
            console.log('Erro ao reproduzir áudio:', e);
        }
    }
};

// ============================================
// MODAL DE REDIRECIONAMENTO
// ============================================
const showRedirectModal = (jogo) => {
    const modal = document.getElementById('redirectModal');
    const title = document.getElementById('modalMatchTitle');
    const info = document.getElementById('modalMatchInfo');
    const countdown = document.getElementById('modalCountdown');
    
    if (!modal || !title || !info || !countdown) return;
    
    state.isModalShown = true;
    
    // Configurar informações do jogo
    title.textContent = `${jogo.mandante} vs ${jogo.visitante}`;
    info.textContent = `O jogo do ${jogo.campeonato} está acontecendo agora!`;
    
    // Configurar contagem regressiva
    let count = CONFIG.redirectCountdown;
    countdown.textContent = count;
    
    state.redirectTimer = setInterval(() => {
        count--;
        countdown.textContent = count;
        
        if (count <= 0) {
            clearInterval(state.redirectTimer);
            redirectToLivePage();
        }
    }, 1000);
    
    // Mostrar modal
    modal.classList.add('active');
    
    // Configurar botões
    document.getElementById('goNowBtn').onclick = redirectToLivePage;
    document.getElementById('cancelBtn').onclick = closeRedirectModal;
    
    // Salvar no localStorage que o modal foi mostrado
    localStorage.setItem('cabuloso_redirect_shown', 'true');
    localStorage.setItem('cabuloso_redirect_match', JSON.stringify({
        match: `${jogo.mandante} vs ${jogo.visitante}`,
        timestamp: new Date().getTime()
    }));
};

const closeRedirectModal = () => {
    const modal = document.getElementById('redirectModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    if (state.redirectTimer) {
        clearInterval(state.redirectTimer);
        state.redirectTimer = null;
    }
    
    state.isModalShown = false;
};

const redirectToLivePage = () => {
    // Redirecionar para a página atual (já estamos nela)
    // Em um cenário real, você pode redirecionar para uma URL específica
    closeRedirectModal();
    
    // Rolar para o topo do placar
    const liveMatch = document.getElementById('live-match-container');
    if (liveMatch) {
        liveMatch.scrollIntoView({ behavior: 'smooth' });
    }
};

const checkRedirectFromStorage = () => {
    const wasShown = localStorage.getItem('cabuloso_redirect_shown');
    if (wasShown === 'true') {
        // Limpar após 24 horas
        const matchData = localStorage.getItem('cabuloso_redirect_match');
        if (matchData) {
            const data = JSON.parse(matchData);
            const now = new Date().getTime();
            const oneDay = 24 * 60 * 60 * 1000;
            
            if (now - data.timestamp > oneDay) {
                localStorage.removeItem('cabuloso_redirect_shown');
                localStorage.removeItem('cabuloso_redirect_match');
            }
        }
    }
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// Função para definir lembrete (simulada)
const setReminder = (date, time) => {
    alert(`Lembrete definido para: ${date} às ${time}\n\nVocê será notificado quando o jogo começar.`);
};

// Dados simulados para demonstração
const updateWithMockData = () => {
    if (!state.currentMatch) return;
    
    const mockData = {
        'Gols Casa': Math.floor(Math.random() * 3),
        'Gols fora': Math.floor(Math.random() * 3),
        'Tempo_Jogo': `${Math.floor(Math.random() * 45)}'`,
        'Posse_Casa': Math.floor(Math.random() * 30 + 35),
        'Escanteios_Casa': Math.floor(Math.random() * 8),
        'Escanteios_Fora': Math.floor(Math.random() * 8),
        'Finalizacoes_Casa': Math.floor(Math.random() * 12),
        'Finalizacoes_Fora': Math.floor(Math.random() * 12),
        'Lances_Texto': [
            'Cruzeiro ataca pelo lado direito',
            'Escanteio para o Cruzeiro',
            'Defesa afasta a bola',
            'Falta marcada a favor do Cruzeiro'
        ],
        'Lances_Minutos': ['15', '23', '28', '35']
    };
    
    updateMatchData(mockData);
    updateTimeline(mockData);
    
    // Atualizar último tempo
    state.lastUpdateTime = new Date();
    
    // Mostrar indicador de atualização
    const statusIndicator = document.getElementById('match-status-indicator');
    if (statusIndicator) {
        const originalText = statusIndicator.textContent;
        statusIndicator.textContent = 'ATUALIZANDO...';
        
        setTimeout(() => {
            statusIndicator.textContent = originalText;
        }, 1000);
    }
};


// ============================================
// EXPORTAÇÃO DE FUNÇÕES PARA USO GLOBAL
// ============================================
// Torna as funções disponíveis globalmente para uso em onclick
window.loadAgendaData = loadAgendaData;
window.setReminder = setReminder;
window.checkForLiveMatches = checkForLiveMatches;