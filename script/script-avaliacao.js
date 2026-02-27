/**
 * script-avaliacao.js — CABULOSO NEWS
 * Sistema de avaliação de jogadores após cada partida
 *
 * COMO FUNCIONA:
 * 1. Você edita o arquivo `partidas.json` no seu servidor (ou KV do Worker)
 *    e lá define as partidas disponíveis com a escalação do Cruzeiro.
 * 2. Os votos da torcida são salvos no persistent storage do Claude (window.storage)
 *    — funciona automaticamente, sem banco de dados.
 * 3. Cada torcedor pode votar 1x por partida (controle via localStorage do navegador).
 * 4. Comentários somem automaticamente após 72 horas.
 *
 * ARQUIVO partidas.json (coloque no seu servidor ou KV):
 * [
 *   {
 *     "id": "cruzeiro-x-atletico-2026-02-15",
 *     "competicao": "Campeonato Mineiro",
 *     "data": "15/02/2026",
 *     "mandante": "Cruzeiro",
 *     "visitante": "Atlético",
 *     "escudo_mandante": "url",
 *     "escudo_visitante": "url",
 *     "placar": "2 - 1",
 *     "jogadores": [
 *       { "numero": 1, "nome": "Cássio", "posicao": "Goleiro" },
 *       { "numero": 13, "nome": "William", "posicao": "Zagueiro" },
 *       ...
 *     ]
 *   }
 * ]
 */

// ============================================================
// CONFIG
// ============================================================
const CONFIG_AV = {
  // URL do seu JSON de partidas — pode ser no Worker ou um arquivo estático
  partidasUrl: './data/partidas.json',

  // Após quantas horas os comentários somem
  ttlComentariosHoras: 72,

  // Tempo máximo para votar após a partida (em horas)
  janeladeVotacao: 96,

  defaultEscudo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
};

// ============================================================
// ESTADO
// ============================================================
let state = {
  partidas: [],
  partidaSelecionada: null,
  notas: {},       // { nomeJogador: { nota: 4, obs: "..." } }
  avaliacaoEnviada: false,
  posicaoAtual: null,
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

function chaveJaAvaliou(partidaId) {
  return `cabuloso_avaliou_${partidaId}`;
}

function jaAvaliou(partidaId) {
  return !!localStorage.getItem(chaveJaAvaliou(partidaId));
}

function marcarComoAvaliado(partidaId) {
  localStorage.setItem(chaveJaAvaliou(partidaId), Date.now().toString());
}

function estrelasHtml(nota) {
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += i <= nota ? '★' : '☆';
  }
  return s;
}

function apelido() {
  // Gera apelido aleatório de torcedor
  const nomes = [
    'TorcedorCeleste', 'GaloNão', 'MaiorDeMinas', 'RaposaFiel',
    'CabulosoFã', 'EstrelaDeSete', 'AzulEBranco', 'FielTorcedor',
    'MinasÉCruzeiro', 'EstadioMineirão', 'TorcedaFox', 'CruzeiroPuro',
  ];
  return nomes[Math.floor(Math.random() * nomes.length)] + Math.floor(Math.random() * 99 + 1);
}

// ============================================================
// CARREGA PARTIDAS DO JSON
// ============================================================
async function carregarPartidas() {
  try {
    const res = await fetch(CONFIG_AV.partidasUrl);
    if (!res.ok) throw new Error('Arquivo não encontrado');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[Avaliação] Usando partidas de exemplo:', e.message);
    // Partidas de EXEMPLO para você ver o funcionamento antes de criar o JSON
    return getPartidasExemplo();
  }
}

function getPartidasExemplo() {
  return [
    {
      id: 'cruzeiro-x-pousoa-alegre-2026-03-01',
      competicao: 'Campeonato Mineiro - Semifinal',
      data: '01/03/2026',
      hora: '16:30',
      mandante: 'Cruzeiro',
      visitante: 'Pouso Alegre',
      escudo_mandante: CONFIG_AV.defaultEscudo,
      escudo_visitante: CONFIG_AV.defaultEscudo,
      placar: '? - ?',
      jogadores: [
        { numero: 1,  nome: 'Cássio',         posicao: 'Goleiro' },
        { numero: 2,  nome: 'William',         posicao: 'Lateral' },
        { numero: 4,  nome: 'João Marcelo',    posicao: 'Zagueiro' },
        { numero: 5,  nome: 'Villalba',        posicao: 'Zagueiro' },
        { numero: 6,  nome: 'Kaiki',           posicao: 'Lateral' },
        { numero: 8,  nome: 'Lucas Silva',     posicao: 'Meio-Campo' },
        { numero: 10, nome: 'Matheus Pereira', posicao: 'Meio-Campo' },
        { numero: 27, nome: 'Fabrício Bruno',  posicao: 'Meio-Campo' },
        { numero: 11, nome: 'Gabigol',         posicao: 'Atacante' },
        { numero: 9,  nome: 'Kaio Jorge',      posicao: 'Atacante' },
        { numero: 7,  nome: 'Wanderson',       posicao: 'Atacante' },
      ],
    },
  ];
}

// ============================================================
// RENDER: LISTA DE PARTIDAS
// ============================================================
function renderPartidas(partidas) {
  const el = $('partidas-lista');
  if (!el) return;

  if (partidas.length === 0) {
    el.innerHTML = `
      <div class="sem-partidas">
        <i class="fas fa-futbol"></i>
        <h3>Nenhuma partida disponível</h3>
        <p>Assim que o próximo jogo acontecer, a avaliação será liberada aqui!</p>
      </div>`;
    return;
  }

  el.innerHTML = partidas.map((p) => {
    const avaliou = jaAvaliou(p.id);
    return `
      <div class="partida-card ${avaliou ? 'selected' : ''}" data-id="${escHtml(p.id)}" role="button" tabindex="0" aria-label="Avaliar partida ${escHtml(p.mandante)} x ${escHtml(p.visitante)}">
        ${avaliou ? '<span class="partida-badge-ja">✓ Avaliado</span>' : ''}
        <div class="partida-competicao">
          <i class="fas fa-trophy"></i> ${escHtml(p.competicao)}
        </div>
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
        </div>
        <button class="btn-avaliar-card ${avaliou ? 'ja-avaliou' : ''}" data-id="${escHtml(p.id)}">
          <i class="fas ${avaliou ? 'fa-check' : 'fa-star'}"></i>
          ${avaliou ? 'Ver Avaliações' : 'Avaliar Jogadores'}
        </button>
      </div>`;
  }).join('');

  // Eventos
  el.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const id = el.dataset.id;
      if (id) selecionarPartida(id);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') selecionarPartida(el.dataset.id);
    });
  });
}

// ============================================================
// SELECIONA PARTIDA E MONTA PAINEL
// ============================================================
function selecionarPartida(id) {
  const partida = state.partidas.find((p) => p.id === id);
  if (!partida) return;

  state.partidaSelecionada = partida;
  state.notas = {};
  state.avaliacaoEnviada = jaAvaliou(id);

  // Scroll suave
  $('avaliacao-section').style.display = 'block';
  setTimeout(() => {
    $('avaliacao-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);

  // Destaca card selecionado
  document.querySelectorAll('.partida-card').forEach((c) => c.classList.remove('selected'));
  const card = document.querySelector(`.partida-card[data-id="${id}"]`);
  if (card) card.classList.add('selected');

  renderPlacarCard(partida);
  renderJogadores(partida);
  carregarComunidade(id);

  // Mensagem já avaliou
  const msg = $('ja-avaliou-msg');
  if (msg) msg.style.display = state.avaliacaoEnviada ? 'flex' : 'none';

  // Esconde submit se já avaliou
  const submitArea = $('submit-area');
  const obsContainer = $('observacao-geral-container');
  if (submitArea) submitArea.style.display = state.avaliacaoEnviada ? 'none' : 'block';
  if (obsContainer) obsContainer.style.display = state.avaliacaoEnviada ? 'none' : 'block';
}

// ============================================================
// RENDER: PLACAR NO TOPO
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
// RENDER: CARROSSEL DE JOGADORES
// ============================================================
function renderJogadores(partida) {
  const track = $('carrossel-track');
  const navEl = $('posicoes-nav');
  if (!track || !navEl) return;

  const jogadores = partida.jogadores || [];

  // Agrupa por posição
  const posicoes = {};
  jogadores.forEach((j) => {
    const pos = j.posicao || 'Outros';
    if (!posicoes[pos]) posicoes[pos] = [];
    posicoes[pos].push(j);
  });

  const ordem = ['Goleiro', 'Lateral', 'Zagueiro', 'Volante', 'Meio-Campo', 'Meia', 'Atacante', 'Outros'];
  const posicoesOrdenadas = Object.keys(posicoes).sort((a, b) => {
    const ia = ordem.findIndex((o) => a.toLowerCase().includes(o.toLowerCase()));
    const ib = ordem.findIndex((o) => b.toLowerCase().includes(o.toLowerCase()));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // NAV de posições
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

  // Monta todos os cards
  track.innerHTML = '';

  posicoesOrdenadas.forEach((pos) => {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-pos';
    grupo.dataset.pos = pos;
    grupo.style.cssText = 'display:flex; gap:12px; align-items:flex-start; flex-shrink:0;';

    // Separador de posição
    const sep = document.createElement('div');
    sep.style.cssText = `
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-family: 'Oswald', sans-serif;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #94a3b8;
      align-self: center;
      padding: 8px 4px;
      border-left: 2px solid #e2e8f0;
      min-height: 80px;
      display: flex;
      align-items: center;
    `;
    sep.textContent = pos;
    grupo.appendChild(sep);

    posicoes[pos].forEach((jogador) => {
      grupo.appendChild(criarCardJogador(jogador));
    });

    track.appendChild(grupo);
  });

  // Ativa primeiro botão de posição
  if (navEl.firstElementChild) navEl.firstElementChild.classList.add('active');

  // Arrows
  const arrowL = $('arrow-left');
  const arrowR = $('arrow-right');
  if (arrowL) arrowL.onclick = () => track.scrollBy({ left: -200, behavior: 'smooth' });
  if (arrowR) arrowR.onclick = () => track.scrollBy({ left: 200, behavior: 'smooth' });
}

function scrollToPosicao(pos) {
  const grupo = document.querySelector(`.grupo-pos[data-pos="${pos}"]`);
  if (grupo) {
    const track = $('carrossel-track');
    track.scrollTo({ left: grupo.offsetLeft - 20, behavior: 'smooth' });
  }
}

function criarCardJogador(jogador) {
  const card = document.createElement('div');
  card.className = 'jogador-card';
  card.dataset.nome = jogador.nome;

  const inicial = jogador.nome ? jogador.nome.charAt(0).toUpperCase() : '?';

  card.innerHTML = `
    <div class="jogador-numero">${jogador.numero || '?'}</div>
    <div class="jogador-avatar">${inicial}</div>
    <div class="jogador-nome">${escHtml(jogador.nome)}</div>
    <div class="jogador-posicao-label">${escHtml(jogador.posicao)}</div>
    <div class="estrelas-inline" data-jogador="${escHtml(jogador.nome)}">
      ${[1,2,3,4,5].map((n) =>
        `<button class="estrela-btn" data-nota="${n}" aria-label="${n} estrelas">★</button>`
      ).join('')}
    </div>
    <div class="nota-display" id="nota-display-${sanitizeId(jogador.nome)}">Sem nota</div>
    <button class="obs-toggle" id="obs-toggle-${sanitizeId(jogador.nome)}">+ Observação</button>
    <div class="obs-mini" id="obs-mini-${sanitizeId(jogador.nome)}">
      <textarea maxlength="100" placeholder="Breve observação sobre ${escHtml(jogador.nome.split(' ')[0])}..." rows="2"></textarea>
    </div>
  `;

  // Se já avaliou, desativa
  if (state.avaliacaoEnviada) {
    card.style.pointerEvents = 'none';
    card.style.opacity = '0.7';
    return card;
  }

  // Estrelas hover + clique
  const estrelas = card.querySelectorAll('.estrela-btn');
  estrelas.forEach((btn) => {
    btn.addEventListener('mouseenter', () => highlightEstrelas(card, +btn.dataset.nota, true));
    btn.addEventListener('mouseleave', () => {
      const notaAtual = state.notas[jogador.nome]?.nota || 0;
      highlightEstrelas(card, notaAtual, false);
    });
    btn.addEventListener('click', () => {
      const nota = +btn.dataset.nota;
      const nomeAnterior = state.notas[jogador.nome];
      state.notas[jogador.nome] = { ...state.notas[jogador.nome], nota };
      highlightEstrelas(card, nota, false);

      const display = $(`nota-display-${sanitizeId(jogador.nome)}`);
      if (display) display.textContent = `${nota}/5 ${estrelasHtml(nota)}`;

      card.classList.add('avaliado');

      // Pequena animação de confirmação
      btn.style.transform = 'scale(1.4)';
      setTimeout(() => { btn.style.transform = ''; }, 200);
    });
  });

  // Toggle obs
  const obsToggle = card.querySelector('.obs-toggle');
  const obsMini = card.querySelector('.obs-mini');
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
    btn.classList.remove('ativa', 'hover');
    if (n <= nota) btn.classList.add(isHover ? 'hover' : 'ativa');
  });
}

function sanitizeId(nome) {
  return (nome || '').replace(/[^a-zA-Z0-9]/g, '_');
}

// ============================================================
// SUBMIT AVALIAÇÃO
// ============================================================
async function enviarAvaliacao() {
  const partida = state.partidaSelecionada;
  if (!partida) return;

  if (jaAvaliou(partida.id)) {
    showToast('Você já avaliou esta partida!', 'info');
    return;
  }

  const jogadores = partida.jogadores || [];
  const totalNotados = Object.values(state.notas).filter((n) => n.nota).length;

  if (totalNotados < Math.ceil(jogadores.length / 2)) {
    showToast(`Avalie pelo menos ${Math.ceil(jogadores.length / 2)} jogadores antes de enviar!`, 'error');
    return;
  }

  const btn = $('btn-submit');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    const obsGeral = $('observacao-geral-input')?.value?.trim() || '';
    const nickname = apelido();
    const agora = Date.now();

    // Monta payload da avaliação
    const avaliacao = {
      id: `av_${partida.id}_${agora}`,
      nick: nickname,
      ts: agora,
      obs: obsGeral,
      notas: state.notas,
    };

    // Chave do storage (por partida)
    const chaveStorage = `aval_${partida.id}`;

    // Lê avaliações existentes
    let existentes = [];
    try {
      const raw = await window.storage.get(chaveStorage, true); // shared = true
      existentes = raw ? JSON.parse(raw.value) : [];
    } catch (e) {
      existentes = [];
    }

    // Remove avaliações com mais de 72h
    const limite = agora - (CONFIG_AV.ttlComentariosHoras * 3600 * 1000);
    existentes = existentes.filter((a) => a.ts > limite);

    // Adiciona nova
    existentes.push(avaliacao);

    // Salva (shared = true para todos verem)
    await window.storage.set(chaveStorage, JSON.stringify(existentes), true);

    // Marca localmente como avaliado
    marcarComoAvaliado(partida.id);
    state.avaliacaoEnviada = true;

    showToast('Avaliação enviada! Obrigado, torcedor! ⭐', 'success');

    // Atualiza UI
    const msg = $('ja-avaliou-msg');
    if (msg) msg.style.display = 'flex';
    const submitArea = $('submit-area');
    if (submitArea) submitArea.style.display = 'none';
    const obsContainer = $('observacao-geral-container');
    if (obsContainer) obsContainer.style.display = 'none';

    // Desativa cards
    document.querySelectorAll('.jogador-card').forEach((c) => {
      c.style.pointerEvents = 'none';
      c.style.opacity = '0.75';
    });

    // Atualiza badge no seletor
    renderPartidas(state.partidas);

    // Recarrega comunidade
    await carregarComunidade(partida.id);

  } catch (e) {
    console.error('[Avaliação] Erro ao enviar:', e);
    showToast('Erro ao enviar avaliação. Tente novamente!', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Avaliação';
    }
  }
}

// ============================================================
// COMUNIDADE: carrega e exibe avaliações
// ============================================================
async function carregarComunidade(partidaId) {
  const mediasEl = $('medias-grid');
  const comentariosEl = $('comentarios-lista');
  const badgeEl = $('total-avaliacoes-badge');

  if (comentariosEl) {
    comentariosEl.innerHTML = `
      <div class="loading-av">
        <div class="spinner-av"></div>
        <span>Carregando avaliações da torcida...</span>
      </div>`;
  }

  try {
    const chaveStorage = `aval_${partidaId}`;
    let avaliacoes = [];

    try {
      const raw = await window.storage.get(chaveStorage, true);
      avaliacoes = raw ? JSON.parse(raw.value) : [];
    } catch (e) {
      avaliacoes = [];
    }

    // Filtra TTL
    const agora = Date.now();
    const limite = agora - (CONFIG_AV.ttlComentariosHoras * 3600 * 1000);
    avaliacoes = avaliacoes.filter((a) => a.ts > limite);

    if (badgeEl) badgeEl.textContent = `${avaliacoes.length} avaliação${avaliacoes.length !== 1 ? 'ões' : ''}`;

    renderMedias(avaliacoes);
    renderComentarios(avaliacoes);

  } catch (e) {
    console.error('[Avaliação] Erro ao carregar comunidade:', e);
    if (comentariosEl) {
      comentariosEl.innerHTML = '<div class="sem-comentarios"><i class="fas fa-exclamation-circle"></i><p>Erro ao carregar avaliações.</p></div>';
    }
  }
}

// ============================================================
// RENDER: MÉDIAS POR JOGADOR
// ============================================================
function renderMedias(avaliacoes) {
  const el = $('medias-grid');
  if (!el || !state.partidaSelecionada) return;

  const jogadores = state.partidaSelecionada.jogadores || [];

  if (avaliacoes.length === 0) {
    el.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:0.88rem; padding:16px 0;">Seja o primeiro a avaliar!</div>';
    return;
  }

  // Calcula média por jogador
  el.innerHTML = jogadores.map((j) => {
    const notasJog = avaliacoes
      .map((a) => a.notas?.[j.nome]?.nota)
      .filter((n) => n && n > 0);

    if (notasJog.length === 0) {
      return `
        <div class="media-item">
          <div class="media-nome">${escHtml(j.nome.split(' ').slice(0, 2).join(' '))}</div>
          <div class="media-nota" style="color:#94a3b8">-</div>
          <div class="media-votos">sem votos</div>
        </div>`;
    }

    const media = notasJog.reduce((a, b) => a + b, 0) / notasJog.length;
    const mediaFmt = media.toFixed(1);
    const notaInteira = Math.round(media);

    return `
      <div class="media-item">
        <div class="media-nome">${escHtml(j.nome.split(' ').slice(0, 2).join(' '))}</div>
        <div class="media-nota">${mediaFmt}</div>
        <div class="media-estrelas">${estrelasHtml(notaInteira)}</div>
        <div class="media-votos">${notasJog.length} voto${notasJog.length !== 1 ? 's' : ''}</div>
      </div>`;
  }).join('');
}

// ============================================================
// RENDER: COMENTÁRIOS
// ============================================================
function renderComentarios(avaliacoes) {
  const el = $('comentarios-lista');
  if (!el) return;

  // Filtra só quem tem comentário
  const comComent = avaliacoes.filter((a) => a.obs && a.obs.length > 0);

  if (comComent.length === 0) {
    el.innerHTML = `
      <div class="sem-comentarios">
        <i class="fas fa-comment-slash"></i>
        <p>Nenhum comentário ainda. Seja o primeiro!</p>
      </div>`;
    return;
  }

  // Ordena por mais recente
  const ordenados = [...comComent].sort((a, b) => b.ts - a.ts);

  el.innerHTML = ordenados.map((av) => {
    const data = new Date(av.ts);
    const dataFmt = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    // Top 3 notas do avaliador
    const topNotas = Object.entries(av.notas || {})
      .filter(([, v]) => v.nota)
      .sort(([, a], [, b]) => b.nota - a.nota)
      .slice(0, 3);

    const chipsHtml = topNotas.map(([nome, v]) =>
      `<span class="nota-chip"><span class="estrela-chip">★</span> ${escHtml(nome.split(' ')[0])} ${v.nota}/5</span>`
    ).join('');

    return `
      <div class="comentario-card">
        <div class="comentario-header">
          <div class="comentario-user">
            <div class="comentario-avatar">${av.nick.charAt(0).toUpperCase()}</div>
            <span class="comentario-nome">${escHtml(av.nick)}</span>
          </div>
          <span class="comentario-data">${dataFmt}</span>
        </div>
        ${av.obs ? `<p class="comentario-texto">${escHtml(av.obs)}</p>` : ''}
        ${chipsHtml ? `<div class="comentario-notas">${chipsHtml}</div>` : ''}
      </div>`;
  }).join('');
}

// ============================================================
// CONTADOR DE CARACTERES
// ============================================================
function initCharCount() {
  const textarea = $('observacao-geral-input');
  const counter = $('char-count');
  if (!textarea || !counter) return;
  textarea.addEventListener('input', () => {
    counter.textContent = textarea.value.length;
  });
}

// ============================================================
// WIDGET AO VIVO — redireciona para GE quando há jogo
// Usado no index.html e competicao.html (chamada externa)
// ============================================================
window.iniciarWidgetAoVivo = async function () {
  const WORKER_URL = 'https://cabuloso-api.cabulosonews92.workers.dev/?type=ao-vivo';
  const GE_AGENDA_URL = 'https://ge.globo.com/futebol/times/cruzeiro/agenda-de-jogos-do-cruzeiro/#/proximos-jogos';

  try {
    const res = await fetch(WORKER_URL, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    if (res.status === 404 || data?.error === 'no_live_match') {
      // Sem jogo ao vivo — muda o botão para link da agenda
      atualizarBotaoAoVivo(false, GE_AGENDA_URL);
      return;
    }

    // Há jogo ao vivo!
    atualizarBotaoAoVivo(true, GE_AGENDA_URL, data);

  } catch (e) {
    atualizarBotaoAoVivo(false, GE_AGENDA_URL);
  }
};

function atualizarBotaoAoVivo(aoVivo, url, dados = null) {
  // Atualiza todos os links "Ao Vivo" do menu e widgets
  document.querySelectorAll('a[href="minuto-a-minuto.html"], .nav-link-aovivo, #btn-aovivo').forEach((el) => {
    el.href = url;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';

    if (aoVivo) {
      el.classList.add('ao-vivo-ativo');
      // Adiciona badge pulsante se não tiver
      if (!el.querySelector('.pulse-badge')) {
        const badge = document.createElement('span');
        badge.className = 'pulse-badge';
        badge.textContent = '● AO VIVO';
        badge.style.cssText = `
          background: #ef4444;
          color: white;
          font-size: 0.6rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 999px;
          margin-left: 6px;
          animation: pulseBadge 1.2s ease-in-out infinite;
        `;
        el.appendChild(badge);
      }
    }
  });
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Menu mobile
  const menuToggle = $('menuToggle');
  const navMenu = $('nav-menu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
      menuToggle.setAttribute('aria-expanded', navMenu.classList.contains('active'));
    });
  }

  // Submit
  const btnSubmit = $('btn-submit');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', enviarAvaliacao);
  }

  // Char count
  initCharCount();

  // Verifica se storage está disponível
  if (!window.storage) {
    console.warn('[Avaliação] window.storage não disponível — avaliações não serão salvas.');
    showToast('Sistema de avaliação indisponível neste ambiente.', 'error');
  }

  // Carrega partidas
  const elLista = $('partidas-lista');
  state.partidas = await carregarPartidas();
  renderPartidas(state.partidas);

  // Widget ao vivo (se função disponível)
  if (typeof window.iniciarWidgetAoVivo === 'function') {
    window.iniciarWidgetAoVivo();
  }
});
