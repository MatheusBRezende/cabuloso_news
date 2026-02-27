/**
 * script-avaliacao.js — CABULOSO NEWS
 * Sistema de avaliação de jogadores após cada partida
 * + Timeline de eventos ao vivo (sistema de pontos)
 */

// ============================================================
// CONFIG
// ============================================================
const CONFIG_AV = {
  partidasUrl: './data/partidas.json',
  ttlComentariosHoras: 72,
  janeladeVotacao: 96,
  defaultEscudo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
  workerUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/?type=ao-vivo',
  timelineEventosVisiveis: 6,
};

// ============================================================
// ESTADO
// ============================================================
let state = {
  partidas: [],
  partidaSelecionada: null,
  notas: {},
  avaliacaoEnviada: false,
  posicaoAtual: null,
  timelineExpandida: false,
  timelineInterval: null,
};

// ============================================================
// UTILITÁRIOS
// ============================================================
const $ = (id) => document.getElementById(id);
const escHtml = (t) => {
  if (!t) return '';
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
};

function showToast(msg, tipo = 'info') {
  const t = document.createElement('div');
  t.className = `toast-av ${tipo}`;
  const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', info: 'fas fa-info-circle' };
  t.innerHTML = `<i class="${icons[tipo] || icons.info}"></i> ${escHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'none';
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 350);
  }, 3500);
}

function chaveJaAvaliou(partidaId) { return `cabuloso_avaliou_${partidaId}`; }
function jaAvaliou(partidaId)      { return !!localStorage.getItem(chaveJaAvaliou(partidaId)); }
function marcarComoAvaliado(id)    { localStorage.setItem(chaveJaAvaliou(id), Date.now().toString()); }

function estrelasHtml(nota) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= nota ? '★' : '☆';
  return s;
}

function apelido() {
  const nomes = ['TorcedorCeleste','GaloNão','MaiorDeMinas','RaposaFiel','CabulosoFã',
                 'EstrelaDeSete','AzulEBranco','FielTorcedor','MinasÉCruzeiro','EstadioMineirão','CruzeiroPuro'];
  return nomes[Math.floor(Math.random() * nomes.length)] + Math.floor(Math.random() * 99 + 1);
}

// ============================================================
// CARREGA PARTIDAS
// ============================================================
async function carregarPartidas() {
  try {
    const res = await fetch(CONFIG_AV.partidasUrl);
    if (!res.ok) throw new Error('Arquivo não encontrado');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[Avaliação] Usando partidas de exemplo:', e.message);
    return getPartidasExemplo();
  }
}

function getPartidasExemplo() {
  return [{
    id: 'cruzeiro-x-pouso-alegre-2026-03-01',
    competicao: 'Campeonato Mineiro - Semifinal',
    data: '01/03/2026', hora: '16:30',
    mandante: 'Cruzeiro', visitante: 'Pouso Alegre',
    escudo_mandante: CONFIG_AV.defaultEscudo,
    escudo_visitante: CONFIG_AV.defaultEscudo,
    placar: '2 - 0',
    jogadores: [
      { numero: 1,  nome: 'Cássio',         posicao: 'Goleiro'     },
      { numero: 2,  nome: 'William',         posicao: 'Lateral'     },
      { numero: 4,  nome: 'João Marcelo',    posicao: 'Zagueiro'    },
      { numero: 5,  nome: 'Villalba',        posicao: 'Zagueiro'    },
      { numero: 6,  nome: 'Kaiki',           posicao: 'Lateral'     },
      { numero: 8,  nome: 'Lucas Silva',     posicao: 'Meio-Campo'  },
      { numero: 10, nome: 'Matheus Pereira', posicao: 'Meio-Campo'  },
      { numero: 27, nome: 'Fabrício Bruno',  posicao: 'Meio-Campo'  },
      { numero: 11, nome: 'Gabigol',         posicao: 'Atacante'    },
      { numero: 9,  nome: 'Kaio Jorge',      posicao: 'Atacante'    },
      { numero: 7,  nome: 'Wanderson',       posicao: 'Atacante'    },
    ],
    eventos_timeline: [
      { minuto:'23', tipo:'GOAL',        label:'Gol',            icone:'⚽', cor:'#22c55e', jogador:'Gabigol',        is_cruzeiro:true,  pontos:10, periodo:'1T' },
      { minuto:'31', tipo:'YELLOW_CARD', label:'Cartão Amarelo', icone:'🟨', cor:'#eab308', jogador:'Villalba',       is_cruzeiro:true,  pontos:-1, periodo:'1T' },
      { minuto:'45', tipo:'SUBSTITUTION',label:'Substituição',   icone:'🔄', cor:'#64748b', jogador:'Fabrício Bruno', jogador_entra:'Kaio Jorge', is_cruzeiro:true, pontos:0, periodo:'1T' },
      { minuto:'67', tipo:'GOAL',        label:'Gol',            icone:'⚽', cor:'#22c55e', jogador:'Matheus Pereira',is_cruzeiro:true,  pontos:10, periodo:'2T' },
      { minuto:'78', tipo:'YELLOW_CARD', label:'Cartão Amarelo', icone:'🟨', cor:'#eab308', jogador:'Luan',           is_cruzeiro:false, pontos:0,  periodo:'2T' },
    ],
    pontuacao_cruzeiro: 19,
    jogo_ao_vivo: false,
  }];
}

// ============================================================
// RENDER: LISTA DE PARTIDAS
// ============================================================
function renderPartidas(partidas) {
  const el = $('partidas-lista');
  if (!el) return;

  if (partidas.length === 0) {
    el.innerHTML = `<div class="sem-partidas"><i class="fas fa-futbol"></i><h3>Nenhuma partida disponível</h3><p>Assim que o próximo jogo acontecer, a avaliação será liberada aqui!</p></div>`;
    return;
  }

  el.innerHTML = partidas.map((p) => {
    const avaliou    = jaAvaliou(p.id);
    const temTimeline = p.eventos_timeline && p.eventos_timeline.length > 0;
    const aoVivo     = p.jogo_ao_vivo;
    return `
      <div class="partida-card ${avaliou ? 'selected' : ''}" data-id="${escHtml(p.id)}" role="button" tabindex="0" aria-label="Avaliar ${escHtml(p.mandante)} x ${escHtml(p.visitante)}">
        ${avaliou ? '<span class="partida-badge-ja">✓ Avaliado</span>' : ''}
        ${aoVivo  ? '<span class="partida-badge-aovivo">● AO VIVO</span>' : ''}
        <div class="partida-competicao"><i class="fas fa-trophy"></i> ${escHtml(p.competicao)}</div>
        <div class="partida-times">
          <div class="partida-time">
            <img src="${escHtml(p.escudo_mandante || CONFIG_AV.defaultEscudo)}" alt="${escHtml(p.mandante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
            <span>${escHtml(p.mandante)}</span>
          </div>
          <div class="partida-placar">${escHtml(p.placar || 'x')}</div>
          <div class="partida-time">
            <img src="${escHtml(p.escudo_visitante || CONFIG_AV.defaultEscudo)}" alt="${escHtml(p.visitante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
            <span>${escHtml(p.visitante)}</span>
          </div>
        </div>
        <div class="partida-data">
          <i class="far fa-calendar"></i> ${escHtml(p.data)} ${p.hora ? '• ' + escHtml(p.hora) : ''}
          ${temTimeline ? `<span class="partida-pts-badge">⚡ ${p.pontuacao_cruzeiro || 0} pts</span>` : ''}
        </div>
        <button class="btn-avaliar-card ${avaliou ? 'ja-avaliou' : ''}" data-id="${escHtml(p.id)}">
          <i class="fas ${avaliou ? 'fa-check' : 'fa-star'}"></i>
          ${avaliou ? 'Ver Avaliações' : 'Avaliar Jogadores'}
        </button>
      </div>`;
  }).join('');

  el.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', () => { if (el.dataset.id) selecionarPartida(el.dataset.id); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') selecionarPartida(el.dataset.id); });
  });
}

// ============================================================
// SELECIONA PARTIDA
// ============================================================
function selecionarPartida(id) {
  const partida = state.partidas.find((p) => p.id === id);
  if (!partida) return;

  state.partidaSelecionada = partida;
  state.notas = {};
  state.avaliacaoEnviada = jaAvaliou(id);
  state.timelineExpandida = false;

  if (state.timelineInterval) { clearInterval(state.timelineInterval); state.timelineInterval = null; }

  $('avaliacao-section').style.display = 'block';
  setTimeout(() => $('avaliacao-section').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

  document.querySelectorAll('.partida-card').forEach((c) => c.classList.remove('selected'));
  document.querySelector(`.partida-card[data-id="${id}"]`)?.classList.add('selected');

  renderPlacarCard(partida);
  renderTimeline(partida);            // render imediato com dados estáticos
  fetchEAtualizarTimeline(partida);   // depois tenta ao vivo
  renderJogadores(partida);
  carregarComunidade(id);

  const msg = $('ja-avaliou-msg');
  if (msg) msg.style.display = state.avaliacaoEnviada ? 'flex' : 'none';
  const submitArea = $('submit-area');
  const obsContainer = $('observacao-geral-container');
  if (submitArea) submitArea.style.display = state.avaliacaoEnviada ? 'none' : 'block';
  if (obsContainer) obsContainer.style.display = state.avaliacaoEnviada ? 'none' : 'block';
}

// ============================================================
// RENDER: PLACAR CARD
// ============================================================
function renderPlacarCard(p) {
  const el = $('placar-card');
  if (!el) return;
  el.innerHTML = `
    <div class="placar-card-times">
      <div class="placar-card-time">
        <img src="${escHtml(p.escudo_mandante || CONFIG_AV.defaultEscudo)}" alt="${escHtml(p.mandante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
        <span>${escHtml(p.mandante)}</span>
      </div>
      <div class="placar-card-score">${escHtml(p.placar || 'x')}</div>
      <div class="placar-card-time">
        <img src="${escHtml(p.escudo_visitante || CONFIG_AV.defaultEscudo)}" alt="${escHtml(p.visitante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
        <span>${escHtml(p.visitante)}</span>
      </div>
    </div>
    <div class="placar-card-info">
      <div class="placar-card-comp"><i class="fas fa-trophy"></i> ${escHtml(p.competicao)}</div>
      <div class="placar-card-data"><i class="far fa-calendar"></i> ${escHtml(p.data)} ${p.hora ? '• ' + escHtml(p.hora) : ''}</div>
    </div>`;
}

// ============================================================
// TIMELINE: BUSCA AO VIVO
// Lê o formato do PARSER TRV2 V6 do n8n
// ============================================================
async function fetchTimelineDoWorker(partida) {
  try {
    const res  = await fetch(CONFIG_AV.workerUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();

    // Sem jogo ao vivo
    if (data?.error === 'no_live_match' || !data?.placar) return null;

    // Confere se é a mesma partida (compara nomes dos times)
    const casaNome = (data.partida?.time_casa || data.placar?.texto || '').toLowerCase();
    const visNome  = (data.partida?.time_visitante || '').toLowerCase();
    const mand     = (partida.mandante  || '').toLowerCase();
    const vis      = (partida.visitante || '').toLowerCase();

    const palavraMand = mand.split(' ')[0];
    const palavraVis  = vis.split(' ')[0];
    const mesmoJogo   =
      casaNome.includes(palavraMand) || casaNome.includes(palavraVis) ||
      visNome.includes(palavraMand)  || visNome.includes(palavraVis)  ||
      palavraMand === 'cruzeiro'     || palavraVis  === 'cruzeiro';

    if (!mesmoJogo) return null;

    // ── Converte timeline do parser V6 para o formato que renderTimeline() espera ──
    // Parser V6:  { tipo, minuto, titulo, narracao, lado, icone }
    // Script espera: { minuto, tipo, label, icone, cor, jogador, jogador_entra, is_cruzeiro, pontos, periodo }
    const CORES = {
      GOAL:         '#22c55e',
      YELLOW_CARD:  '#eab308',
      RED_CARD:     '#ef4444',
      SUBSTITUTION: '#64748b',
      IMPORTANT:    '#3b82f6',
      NORMAL:       '#94a3b8',
    };

    const PONTOS = {
      GOAL:         10,
      YELLOW_CARD:  -1,
      RED_CARD:     -3,
      SUBSTITUTION:  0,
      IMPORTANT:     1,
      NORMAL:        0,
    };

    const LABELS = {
      GOAL:         'Gol',
      YELLOW_CARD:  'Cartão Amarelo',
      RED_CARD:     'Cartão Vermelho',
      SUBSTITUTION: 'Substituição',
      IMPORTANT:    'Lance Importante',
      NORMAL:       'Lance',
    };

    // Filtra só eventos relevantes (descarta NORMAL e SUMMARY_AUTOMATIC de rotina)
    const tiposRelevantes = ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'IMPORTANT'];

    const timelineRaw = data.timeline || [];
    const eventos_timeline = timelineRaw
      .filter(ev => tiposRelevantes.includes(ev.tipo) && ev.narracao)
      .map(ev => {
        const isCruzeiro = ev.lado === 'cruzeiro';

        // Extrai jogador da narração para substituições (formato "sai X, entra Y")
        let jogador      = '';
        let jogador_entra = '';
        if (ev.tipo === 'SUBSTITUTION') {
          // narracao: "Mudança no Cruzeiro: sai Lucas Romero, entra Japa."
          const mSai   = ev.narracao.match(/sai ([^,]+),/i);
          const mEntra = ev.narracao.match(/entra ([^.]+)/i);
          jogador       = mSai   ? mSai[1].trim()   : '';
          jogador_entra = mEntra ? mEntra[1].trim()  : '';
        } else if (ev.tipo === 'GOAL') {
          // narracao começa com o nome do jogador ou frase
          const mGol = ev.narracao.match(/^[^!]+!?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+(?: [A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+)*)/);
          jogador = mGol ? mGol[1] : '';
          // fallback: pega da narração "GOOOOL DA RAPOSA! NomeJogador..."
          if (!jogador) {
            const mFallback = ev.narracao.match(/!\s+([A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+)/);
            jogador = mFallback ? mFallback[1] : '';
          }
        } else {
          // Para cartões, pega primeiro nome próprio da narração
          const mNome = ev.narracao.match(/para ([A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+(?: [A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+)*)/i);
          jogador = mNome ? mNome[1] : '';
        }

        // Extrai período do minuto (ex: "2T 43:05'" → periodo="2T", minuto="43")
        const mMin    = (ev.minuto || '').match(/^([^0-9]*)(\d+)/);
        const periodo = mMin ? mMin[1].trim() : '';
        const minuto  = mMin ? mMin[2] : (ev.minuto || '?');

        return {
          minuto,
          periodo,
          tipo:          ev.tipo,
          label:         LABELS[ev.tipo] || ev.tipo,
          icone:         ev.icone || '▶️',
          cor:           CORES[ev.tipo]  || '#94a3b8',
          jogador,
          jogador_entra,
          is_cruzeiro:   isCruzeiro,
          pontos:        isCruzeiro ? (PONTOS[ev.tipo] ?? 0) : 0,
          narracao:      ev.narracao,  // narração original do parser para exibição
        };
      });

    // Calcula pontuação somando pontos dos eventos do Cruzeiro
    const pontuacao_cruzeiro = eventos_timeline.reduce((acc, ev) => acc + (ev.pontos || 0), 0);

    // Status ao vivo
    const statusBruto = (data.placar?.status || '').toLowerCase();
    const encerrado   = ['encerrado','fim','final','end'].some(s => statusBruto.includes(s));
    const jogo_ao_vivo = !encerrado;

    // Placar formatado para o card
    const placar_live = data.placar?.texto
      ? data.placar.texto
      : `${data.placar?.cruzeiro ?? 0} - ${data.placar?.adversario ?? 0}`;

    return {
      eventos_timeline,
      pontuacao_cruzeiro,
      jogo_ao_vivo,
      placar_live,
      resumo: data.resumo_da_partida || '',
      estatisticas: data.estatisticas || null,
    };
  } catch (e) {
    console.warn('[Timeline] Erro ao buscar worker:', e.message);
    return null;
  }
}

async function fetchEAtualizarTimeline(partida) {
  const live = await fetchTimelineDoWorker(partida);
  if (!live) return;

  // Atualiza placar visualmente
  if (live.placar_live && partida.placar !== live.placar_live) {
    partida.placar = live.placar_live;
    renderPlacarCard(partida);
  }

  renderTimeline({ ...partida, ...live });

  // Se ao vivo, auto-refresh a cada 45s
  if (live.jogo_ao_vivo && !state.timelineInterval) {
    state.timelineInterval = setInterval(async () => {
      if (!state.partidaSelecionada || state.partidaSelecionada.id !== partida.id) {
        clearInterval(state.timelineInterval); state.timelineInterval = null; return;
      }
      const novo = await fetchTimelineDoWorker(partida);
      if (novo) {
        if (novo.placar_live && partida.placar !== novo.placar_live) {
          partida.placar = novo.placar_live;
          renderPlacarCard(partida);
        }
        renderTimeline({ ...partida, ...novo });
        if (!novo.jogo_ao_vivo) { clearInterval(state.timelineInterval); state.timelineInterval = null; }
      }
    }, 45000);
  }
}

// ============================================================
// TIMELINE: RENDER
// ============================================================
function getClassificacao(pts) {
  if (pts >= 25) return { texto: 'Excelente', cls: 'excelente', cor: '#22c55e' };
  if (pts >= 15) return { texto: 'Boa',       cls: 'boa',       cor: '#84cc16' };
  if (pts >= 8)  return { texto: 'Regular',   cls: 'regular',   cor: '#eab308' };
  if (pts >= 3)  return { texto: 'Ruim',      cls: 'ruim',      cor: '#f97316' };
  return           { texto: 'Péssima',   cls: 'pessima',   cor: '#ef4444' };
}

function renderTimeline(partida) {
  const el = $('timeline-panel');
  if (!el) return;

  const eventos   = partida.eventos_timeline || [];
  const pontuacao = partida.pontuacao_cruzeiro ?? 0;
  const aoVivo    = partida.jogo_ao_vivo ?? false;

  if (eventos.length === 0) { el.style.display = 'none'; return; }

  el.style.display = 'block';

  const classif  = getClassificacao(pontuacao);
  const barraW   = Math.min(100, pontuacao * 2);
  const temMais  = eventos.length > CONFIG_AV.timelineEventosVisiveis;

  const golsCru  = eventos.filter(e => e.is_cruzeiro && e.tipo.includes('GOAL')).length;
  const cartoesC = eventos.filter(e => e.is_cruzeiro && e.tipo.includes('CARD')).length;
  const subs     = eventos.filter(e => e.tipo === 'SUBSTITUTION').length;

  el.innerHTML = `
    <div class="timeline-header">
      <div class="timeline-titulo">
        <i class="fas fa-bolt"></i>
        Performance do Cruzeiro
        ${aoVivo ? '<span class="timeline-aovivo-badge">● AO VIVO</span>' : ''}
      </div>
      <div class="timeline-pontuacao">
        <span class="pontuacao-valor">${pontuacao}</span>
        <span class="pontuacao-label">pts</span>
        <span class="pontuacao-classe ${classif.cls}">${classif.texto}</span>
      </div>
    </div>

    <div class="timeline-resumo">
      ${golsCru  > 0 ? `<span class="resumo-chip chip-gol">⚽ ${golsCru} gol${golsCru > 1 ? 's' : ''}</span>` : ''}
      ${cartoesC > 0 ? `<span class="resumo-chip chip-cartao">🟨 ${cartoesC} cartão${cartoesC > 1 ? 'ões' : ''}</span>` : ''}
      ${subs     > 0 ? `<span class="resumo-chip chip-sub">🔄 ${subs} sub${subs > 1 ? 's' : ''}</span>` : ''}
      <span class="resumo-chip chip-total">${eventos.length} evento${eventos.length > 1 ? 's' : ''}</span>
    </div>

    <div class="timeline-barra-container">
      <div class="timeline-barra-fill" style="width:${barraW}%; background:${classif.cor}"></div>
    </div>

    <div class="timeline-eventos" id="timeline-eventos">
      ${eventos.map((ev, i) => renderEventoHtml(ev, i, eventos.length)).join('')}
    </div>

    ${temMais ? `
      <button class="timeline-toggle-btn" id="timeline-toggle-btn" type="button">
        <i class="fas fa-chevron-down" id="timeline-icon"></i>
        <span id="timeline-texto">Ver todos os ${eventos.length} eventos</span>
      </button>` : ''}
  `;

  aplicarVisibilidade(state.timelineExpandida, eventos.length);

  $('timeline-toggle-btn')?.addEventListener('click', () => {
    state.timelineExpandida = !state.timelineExpandida;
    aplicarVisibilidade(state.timelineExpandida, eventos.length);
    const icon  = $('timeline-icon');
    const texto = $('timeline-texto');
    if (icon)  icon.className    = state.timelineExpandida ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    if (texto) texto.textContent = state.timelineExpandida ? 'Recolher' : `Ver todos os ${eventos.length} eventos`;
  });
}

function renderEventoHtml(ev, index, total) {
  const isCru    = ev.is_cruzeiro;
  const isUltimo = index === total - 1;

  const pontosHtml = ev.pontos !== 0
    ? `<span class="evento-pontos ${ev.pontos > 0 ? 'positivo' : 'negativo'}">${ev.pontos > 0 ? '+' : ''}${ev.pontos}</span>`
    : '';

  const nomeBase   = ev.jogador ? escHtml(ev.jogador) : '';
  const entraHtml  = ev.jogador_entra ? ` <span class="evento-entra">↗ ${escHtml(ev.jogador_entra)}</span>` : '';
  const jogHtml    = nomeBase ? `<div class="evento-linha-jogador"><span class="evento-jogador">${nomeBase}${entraHtml}</span></div>` : '';
  const perHtml    = ev.periodo ? `<span class="evento-periodo">${escHtml(ev.periodo)}</span>` : '';

  // Narração original do parser V6 (se existir)
  const narracaoHtml = ev.narracao
    ? `<div class="evento-narracao">${escHtml(ev.narracao)}</div>`
    : '';

  return `
    <div class="timeline-evento ${isCru ? 'cruzeiro' : 'adversario'}" data-index="${index}">
      <div class="evento-minuto">${escHtml(String(ev.minuto)) || '?'}'</div>
      <div class="evento-linha">
        <div class="evento-dot" style="background:${ev.cor}"></div>
        ${!isUltimo ? '<div class="evento-fio"></div>' : ''}
      </div>
      <div class="evento-conteudo">
        <div class="evento-linha-principal">
          <span class="evento-icone">${ev.icone}</span>
          <span class="evento-label">${escHtml(ev.label)}</span>
          ${pontosHtml}
          ${perHtml}
        </div>
        ${jogHtml}
        ${narracaoHtml}
      </div>
    </div>`;
}

function aplicarVisibilidade(expandida, total) {
  const els      = document.querySelectorAll('.timeline-evento');
  const visiveis = CONFIG_AV.timelineEventosVisiveis;
  els.forEach((el, i) => {
    // Quando recolhido, mostra apenas os ÚLTIMOS N eventos (os mais recentes)
    el.style.display = (expandida || (total - i) <= visiveis) ? '' : 'none';
  });
}

// ============================================================
// RENDER: CARROSSEL DE JOGADORES
// ============================================================
function renderJogadores(partida) {
  const track = $('carrossel-track');
  const navEl = $('posicoes-nav');
  if (!track || !navEl) return;

  const jogadores = partida.jogadores || [];
  const posicoes  = {};

  jogadores.forEach((j) => {
    const pos = j.posicao || 'Outros';
    if (!posicoes[pos]) posicoes[pos] = [];
    posicoes[pos].push(j);
  });

  const ordem = ['Goleiro','Lateral','Zagueiro','Volante','Meio-Campo','Meia','Atacante','Outros'];
  const posicoesOrdenadas = Object.keys(posicoes).sort((a, b) => {
    const ia = ordem.findIndex((o) => a.toLowerCase().includes(o.toLowerCase()));
    const ib = ordem.findIndex((o) => b.toLowerCase().includes(o.toLowerCase()));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  navEl.innerHTML = posicoesOrdenadas.map((pos) =>
    `<button class="posicao-btn" data-pos="${escHtml(pos)}">${escHtml(pos)}</button>`
  ).join('');

  navEl.querySelectorAll('.posicao-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      navEl.querySelectorAll('.posicao-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scrollToPosicao(btn.dataset.pos);
    });
  });

  track.innerHTML = '';

  posicoesOrdenadas.forEach((pos) => {
    const grupo = document.createElement('div');
    grupo.className  = 'grupo-pos';
    grupo.dataset.pos = pos;
    grupo.style.cssText = 'display:flex; gap:12px; align-items:flex-start; flex-shrink:0;';

    const sep = document.createElement('div');
    sep.style.cssText = `writing-mode:vertical-rl; text-orientation:mixed; font-family:'Oswald',sans-serif;
      font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#94a3b8;
      align-self:center; padding:8px 4px; border-left:2px solid #e2e8f0; min-height:80px;
      display:flex; align-items:center;`;
    sep.textContent = pos;
    grupo.appendChild(sep);

    posicoes[pos].forEach((jogador) => grupo.appendChild(criarCardJogador(jogador)));
    track.appendChild(grupo);
  });

  if (navEl.firstElementChild) navEl.firstElementChild.classList.add('active');

  $('arrow-left') && ($('arrow-left').onclick = () => track.scrollBy({ left: -200, behavior: 'smooth' }));
  $('arrow-right') && ($('arrow-right').onclick = () => track.scrollBy({ left: 200, behavior: 'smooth' }));
}

function scrollToPosicao(pos) {
  const grupo = document.querySelector(`.grupo-pos[data-pos="${pos}"]`);
  if (grupo) $('carrossel-track').scrollTo({ left: grupo.offsetLeft - 20, behavior: 'smooth' });
}

function criarCardJogador(jogador) {
  const card = document.createElement('div');
  card.className  = 'jogador-card';
  card.dataset.nome = jogador.nome;

  card.innerHTML = `
    <div class="jogador-numero">${jogador.numero || '?'}</div>
    <div class="jogador-avatar">${(jogador.nome || '?').charAt(0).toUpperCase()}</div>
    <div class="jogador-nome">${escHtml(jogador.nome)}</div>
    <div class="jogador-posicao-label">${escHtml(jogador.posicao)}</div>
    <div class="estrelas-inline">
      ${[1,2,3,4,5].map((n) => `<button class="estrela-btn" data-nota="${n}" aria-label="${n} estrelas">★</button>`).join('')}
    </div>
    <div class="nota-display" id="nota-display-${sanitizeId(jogador.nome)}">Sem nota</div>
    <button class="obs-toggle">+ Observação</button>
    <div class="obs-mini">
      <textarea maxlength="100" placeholder="Breve observação sobre ${escHtml(jogador.nome.split(' ')[0])}..." rows="2"></textarea>
    </div>`;

  if (state.avaliacaoEnviada) {
    card.style.pointerEvents = 'none'; card.style.opacity = '0.7';
    return card;
  }

  const estrelas = card.querySelectorAll('.estrela-btn');
  estrelas.forEach((btn) => {
    btn.addEventListener('mouseenter', () => highlightEstrelas(card, +btn.dataset.nota, true));
    btn.addEventListener('mouseleave', () => highlightEstrelas(card, state.notas[jogador.nome]?.nota || 0, false));
    btn.addEventListener('click', () => {
      const nota = +btn.dataset.nota;
      state.notas[jogador.nome] = { ...state.notas[jogador.nome], nota };
      highlightEstrelas(card, nota, false);
      const display = $(`nota-display-${sanitizeId(jogador.nome)}`);
      if (display) display.textContent = `${nota}/5 ${estrelasHtml(nota)}`;
      card.classList.add('avaliado');
      btn.style.transform = 'scale(1.4)';
      setTimeout(() => { btn.style.transform = ''; }, 200);
    });
  });

  const obsToggle = card.querySelector('.obs-toggle');
  const obsMini   = card.querySelector('.obs-mini');
  if (obsToggle && obsMini) {
    obsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const aberto = obsMini.classList.toggle('visible');
      obsToggle.textContent = aberto ? '− Observação' : '+ Observação';
    });
    obsMini.querySelector('textarea')?.addEventListener('input', (e) => {
      if (!state.notas[jogador.nome]) state.notas[jogador.nome] = {};
      state.notas[jogador.nome].obs = e.target.value;
    });
  }
  return card;
}

function highlightEstrelas(card, nota, isHover) {
  card.querySelectorAll('.estrela-btn').forEach((btn) => {
    const n = +btn.dataset.nota;
    btn.classList.remove('ativa','hover');
    if (n <= nota) btn.classList.add(isHover ? 'hover' : 'ativa');
  });
}

function sanitizeId(nome) { return (nome || '').replace(/[^a-zA-Z0-9]/g, '_'); }

// ============================================================
// SUBMIT
// ============================================================
async function enviarAvaliacao() {
  const partida = state.partidaSelecionada;
  if (!partida) return;
  if (jaAvaliou(partida.id)) { showToast('Você já avaliou esta partida!', 'info'); return; }

  const jogadores    = partida.jogadores || [];
  const totalNotados = Object.values(state.notas).filter((n) => n.nota).length;
  if (totalNotados < Math.ceil(jogadores.length / 2)) {
    showToast(`Avalie pelo menos ${Math.ceil(jogadores.length / 2)} jogadores antes de enviar!`, 'error'); return;
  }

  const btn = $('btn-submit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }

  try {
    const obsGeral = $('observacao-geral-input')?.value?.trim() || '';
    const agora    = Date.now();
    const avaliacao = { id: `av_${partida.id}_${agora}`, nick: apelido(), ts: agora, obs: obsGeral, notas: state.notas };

    const chave     = `aval_${partida.id}`;
    let existentes  = [];
    try { const raw = await window.storage.get(chave, true); existentes = raw ? JSON.parse(raw.value) : []; } catch(e) {}

    const limite = agora - (CONFIG_AV.ttlComentariosHoras * 3600 * 1000);
    existentes   = existentes.filter((a) => a.ts > limite);
    existentes.push(avaliacao);
    await window.storage.set(chave, JSON.stringify(existentes), true);

    marcarComoAvaliado(partida.id);
    state.avaliacaoEnviada = true;
    showToast('Avaliação enviada! Obrigado, torcedor! ⭐', 'success');

    $('ja-avaliou-msg') && ($('ja-avaliou-msg').style.display = 'flex');
    $('submit-area')    && ($('submit-area').style.display    = 'none');
    $('observacao-geral-container') && ($('observacao-geral-container').style.display = 'none');
    document.querySelectorAll('.jogador-card').forEach((c) => { c.style.pointerEvents = 'none'; c.style.opacity = '0.75'; });
    renderPartidas(state.partidas);
    await carregarComunidade(partida.id);

  } catch (e) {
    console.error('[Avaliação] Erro ao enviar:', e);
    showToast('Erro ao enviar avaliação. Tente novamente!', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Avaliação'; }
  }
}

// ============================================================
// COMUNIDADE
// ============================================================
async function carregarComunidade(partidaId) {
  const comentariosEl = $('comentarios-lista');
  const badgeEl       = $('total-avaliacoes-badge');

  if (comentariosEl) comentariosEl.innerHTML = `<div class="loading-av"><div class="spinner-av"></div><span>Carregando avaliações...</span></div>`;

  try {
    let avaliacoes = [];
    try { const raw = await window.storage.get(`aval_${partidaId}`, true); avaliacoes = raw ? JSON.parse(raw.value) : []; } catch(e) {}
    const limite = Date.now() - (CONFIG_AV.ttlComentariosHoras * 3600 * 1000);
    avaliacoes = avaliacoes.filter((a) => a.ts > limite);
    if (badgeEl) badgeEl.textContent = `${avaliacoes.length} avaliação${avaliacoes.length !== 1 ? 'ões' : ''}`;
    renderMedias(avaliacoes);
    renderComentarios(avaliacoes);
  } catch (e) {
    if (comentariosEl) comentariosEl.innerHTML = '<div class="sem-comentarios"><i class="fas fa-exclamation-circle"></i><p>Erro ao carregar avaliações.</p></div>';
  }
}

function renderMedias(avaliacoes) {
  const el = $('medias-grid');
  if (!el || !state.partidaSelecionada) return;
  const jogadores = state.partidaSelecionada.jogadores || [];

  if (avaliacoes.length === 0) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#94a3b8;font-size:0.88rem;padding:16px 0;">Seja o primeiro a avaliar!</div>';
    return;
  }

  el.innerHTML = jogadores.map((j) => {
    const notas = avaliacoes.map((a) => a.notas?.[j.nome]?.nota).filter((n) => n && n > 0);
    if (notas.length === 0) return `<div class="media-item"><div class="media-nome">${escHtml(j.nome.split(' ').slice(0,2).join(' '))}</div><div class="media-nota" style="color:#94a3b8">-</div><div class="media-votos">sem votos</div></div>`;
    const media = notas.reduce((a,b) => a+b, 0) / notas.length;
    return `<div class="media-item"><div class="media-nome">${escHtml(j.nome.split(' ').slice(0,2).join(' '))}</div><div class="media-nota">${media.toFixed(1)}</div><div class="media-estrelas">${estrelasHtml(Math.round(media))}</div><div class="media-votos">${notas.length} voto${notas.length !== 1 ? 's' : ''}</div></div>`;
  }).join('');
}

function renderComentarios(avaliacoes) {
  const el = $('comentarios-lista');
  if (!el) return;
  const com = avaliacoes.filter((a) => a.obs && a.obs.length > 0);
  if (com.length === 0) { el.innerHTML = `<div class="sem-comentarios"><i class="fas fa-comment-slash"></i><p>Nenhum comentário ainda.</p></div>`; return; }
  el.innerHTML = [...com].sort((a,b) => b.ts - a.ts).map((av) => {
    const data = new Date(av.ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const top  = Object.entries(av.notas || {}).filter(([,v]) => v.nota).sort(([,a],[,b]) => b.nota - a.nota).slice(0,3);
    const chips = top.map(([n,v]) => `<span class="nota-chip"><span class="estrela-chip">★</span> ${escHtml(n.split(' ')[0])} ${v.nota}/5</span>`).join('');
    return `<div class="comentario-card"><div class="comentario-header"><div class="comentario-user"><div class="comentario-avatar">${av.nick.charAt(0).toUpperCase()}</div><span class="comentario-nome">${escHtml(av.nick)}</span></div><span class="comentario-data">${data}</span></div>${av.obs ? `<p class="comentario-texto">${escHtml(av.obs)}</p>` : ''}${chips ? `<div class="comentario-notas">${chips}</div>` : ''}</div>`;
  }).join('');
}

// ============================================================
// CHAR COUNT
// ============================================================
function initCharCount() {
  const textarea = $('observacao-geral-input');
  const counter  = $('char-count');
  if (!textarea || !counter) return;
  textarea.addEventListener('input', () => { counter.textContent = textarea.value.length; });
}

// ============================================================
// WIDGET AO VIVO
// ============================================================
window.iniciarWidgetAoVivo = async function () {
  const GE = 'https://ge.globo.com/futebol/times/cruzeiro/agenda-de-jogos-do-cruzeiro/#/proximos-jogos';
  try {
    const res = await fetch(CONFIG_AV.workerUrl, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (res.status === 404 || data?.error === 'no_live_match') { atualizarBotaoAoVivo(false, GE); return; }
    atualizarBotaoAoVivo(true, GE, data);
  } catch (e) { atualizarBotaoAoVivo(false, GE); }
};

function atualizarBotaoAoVivo(aoVivo, url) {
  document.querySelectorAll('a[href="minuto-a-minuto.html"], .nav-link-aovivo, #btn-aovivo').forEach((el) => {
    el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer';
    if (aoVivo && !el.querySelector('.pulse-badge')) {
      const badge = document.createElement('span');
      badge.className = 'pulse-badge';
      badge.textContent = '● AO VIVO';
      badge.style.cssText = 'background:#ef4444;color:white;font-size:0.6rem;font-weight:700;padding:2px 6px;border-radius:999px;margin-left:6px;animation:pulseBadge 1.2s ease-in-out infinite;';
      el.appendChild(badge);
    }
  });
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const menuToggle = $('menuToggle');
  const navMenu    = $('nav-menu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
      menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('active'));
    });
  }

  $('btn-submit')?.addEventListener('click', enviarAvaliacao);
  initCharCount();

  if (!window.storage) {
    console.warn('[Avaliação] window.storage não disponível.');
    showToast('Sistema de avaliação indisponível neste ambiente.', 'error');
  }

  state.partidas = await carregarPartidas();
  renderPartidas(state.partidas);

  if (typeof window.iniciarWidgetAoVivo === 'function') window.iniciarWidgetAoVivo();
});