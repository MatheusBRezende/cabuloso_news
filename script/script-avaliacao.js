/**
 * script-avaliacao.js — CABULOSO NEWS v4
 * Melhorias: timeline com time identificado, toggle do painel,
 * sistema de nota individual melhorado, comunidade compacta
 */

const CONFIG_AV = {
  avaliacaoUrl:       'https://cabuloso-api.cabulosonews92.workers.dev/?type=avaliacao',
  avaliacoesSalvarUrl:'https://cabuloso-api.cabulosonews92.workers.dev/?type=salvar-avaliacao',
  avaliacoesBuscarUrl:'https://cabuloso-api.cabulosonews92.workers.dev/?type=buscar-avaliacoes',
  reagirUrl:          'https://cabuloso-api.cabulosonews92.workers.dev/?type=reagir',
  dadosUrl:           'https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos',
  defaultEscudo:      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
  ttlComentariosHoras: 72,
};

// ============================================================
// FILTRO DE PALAVRÕES
// ============================================================
const PALAVROES_BLOQUEAR = [
  'macaco','macaca','negro burro','viado maldito','traveco','bixa do inferno',
  'vai tomar no cu','vai se foder','sua mae','sua mãe','cu da sua','cu do seu',
];
const PALAVROES_CENSURAR = [
  'merda','porra','caralho','buceta','puta','fdp','filho da puta','vagabundo',
  'vagabunda','arrombado','arrombada','babaca','corno','cornudo','desgraça',
  'bosta','safado','safada','vadia','prostituta','canalha','otário','otária',
  'estúpido','estúpida','cretino','miserável','idiota','imbecil','inútil',
  'lixo','sem vergonha','palhaço','pastelão','pangaré',
];

function bloqueado(txt) { const l=txt.toLowerCase(); return PALAVROES_BLOQUEAR.some(p=>l.includes(p)); }
function censurar(txt) {
  return PALAVROES_CENSURAR.reduce((s,p)=>
    s.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>'*'.repeat(m.length)), txt);
}
function temPalavraoSuave(txt) { const l=txt.toLowerCase(); return PALAVROES_CENSURAR.some(p=>l.includes(p)); }

// ============================================================
// REAÇÕES
// ============================================================
const REACOES = [
  { emoji:'👍', label:'Curti'  },
  { emoji:'❤️', label:'Amei'   },
  { emoji:'🔥', label:'Fogo'   },
  { emoji:'😂', label:'Haha'   },
  { emoji:'😡', label:'Bravo'  },
];

// ============================================================
// ESTADO
// ============================================================
let state = {
  partidas:[],
  partidaSelecionada:null,
  notas:{},
  nota_time: 0,
  avaliacaoEnviada:false,
  escudoCasa:'',
  escudoVis:'',
  nomeCasa:'',
  nomeVis:'',
};

// ============================================================
// POLLING — atualização automática de partidas
// ============================================================
let _pollingInterval = null;
let _pollingIdsAnterior = '';

function getIdsSnapshot(partidas) {
  return partidas.map(p => p.id + '|' + p.encerrada).join(',');
}

async function pollingAvaliacao() {
  try {
    // Adiciona ?_t= para evitar cache do browser/CDN
    const res = await fetch(
      CONFIG_AV.avaliacaoUrl + '&_t=' + Date.now(),
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return;
    const dados = await res.json();
    const lista = Array.isArray(dados) ? dados : (dados?.partida ? [dados] : []);
    if (!lista.length) return;

    const vistos = new Set();
    const novas = [];
    for (let i = 0; i < lista.length; i++) {
      const norm = normalizarJogo(lista[i], i);
      if (!norm) continue;
      if (vistos.has(norm.id)) continue;
      vistos.add(norm.id);
      novas.push(norm);
    }

    const snapshot = getIdsSnapshot(novas);
    if (snapshot === _pollingIdsAnterior) return; // nada mudou

    console.log('[POLLING] Mudança detectada! Atualizando partidas...');
    _pollingIdsAnterior = snapshot;
    state.partidas = novas;
    renderPartidas(novas);

    // Se só tem 1 partida e nenhuma está selecionada, abre automaticamente
    if (novas.length === 1 && !state.partidaSelecionada) {
      await selecionarPartida(novas[0].id);
    }

    // Se a partida atualmente selecionada mudou (ex: encerrou), atualiza o painel
    if (state.partidaSelecionada) {
      const atualizada = novas.find(p => p.id === state.partidaSelecionada.id);
      if (atualizada) {
        state.partidaSelecionada = atualizada;
        renderPlacarInterno(atualizada);
        renderPontuacaoPanel(atualizada);
        renderHorizontalTimeline(atualizada);
        renderEstatisticas(atualizada);
      }
    }
  } catch (e) {
    console.warn('[POLLING] Erro:', e.message);
  }
}

function iniciarPolling() {
  if (_pollingInterval) clearInterval(_pollingInterval);
  // Verifica a cada 30 segundos se há partidas novas ou mudanças
  _pollingInterval = setInterval(pollingAvaliacao, 30000);
  console.log('[POLLING] Iniciado (intervalo: 30s)');
}

// ============================================================
// UTILITÁRIOS
// ============================================================
const $ = id => document.getElementById(id);
function escHtml(t) {
  if (t==null) return '';
  const d=document.createElement('div'); d.textContent=String(t); return d.innerHTML;
}
function showToast(msg, tipo='info') {
  const t=document.createElement('div'); t.className=`toast-av ${tipo}`;
  const icons={success:'fas fa-check-circle',error:'fas fa-times-circle',info:'fas fa-info-circle'};
  t.innerHTML=`<i class="${icons[tipo]||icons.info}"></i> ${escHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.transition='opacity 0.3s';t.style.opacity='0';setTimeout(()=>t.remove(),350);},3500);
}
const jaAvaliou  = id => !!localStorage.getItem(`cabuloso_avaliou_${id}`);
const marcarAval = id => localStorage.setItem(`cabuloso_avaliou_${id}`, Date.now());
const getNome    = ()  => localStorage.getItem('cabuloso_nome')||'';
const salvarNome = n   => localStorage.setItem('cabuloso_nome', n.trim());
const getReacao  = id  => JSON.parse(localStorage.getItem(`rc_${id}`)||'null');
const salvarRea  = (id,e)  => localStorage.setItem(`rc_${id}`, JSON.stringify(e));
const removerRea = id      => localStorage.removeItem(`rc_${id}`);
const estrelasHtml = n  => [1,2,3,4,5].map(i=>i<=n?'★':'☆').join('');
const sanitizeId   = n  => (n||'').replace(/[^a-zA-Z0-9]/g,'_');

// Etiqueta de qualidade para a nota
function getNotaLabel(nota) {
  if (!nota || nota<1) return {txt:'', cls:''};
  if (nota<=2)  return {txt:'Ruim',    cls:'nota-ruim'};
  if (nota<=4)  return {txt:'Regular', cls:'nota-regular'};
  if (nota<=6)  return {txt:'Boa',     cls:'nota-boa'};
  if (nota<=8)  return {txt:'Ótima',   cls:'nota-otima'};
  return              {txt:'Perfeita', cls:'nota-perfeita'};
}

// ============================================================
// CONVERTERS
// ============================================================
function formatarData(d) { return !d?'—': d.length<=5?`${d}/2026`:d; }

function converterPosicao(pos) {
  return {GOL:'Goleiro',LAD:'Lateral',LAE:'Lateral',ZAD:'Zagueiro',ZAE:'Zagueiro',
    VOL:'Volante',MEC:'Meio-Campo',ATA:'Atacante'}[pos]||'Outros';
}

function converterJogadores(esc) {
  const list = [];
  const p = arr => (arr || []).forEach(item => {
    if (!item) return;
    if (typeof item === 'object') {
      list.push({
        numero:  item.numero  || item.num || '?',
        nome:    item.nome    || item.name || '?',
        posicao: converterPosicao(item.posicao || item.position || ''),
        foto:    item.foto    || item.photo || null,
        slug:    item.slug    || null,
      });
      return;
    }
    if (typeof item === 'string') {
      const x = item.split(' - ');
      list.push({
        numero:  x[2]?.trim() || '?',
        nome:    x[0]?.trim() || '?',
        posicao: converterPosicao(x[1]?.trim()),
        foto:    null, slug: null,
      });
    }
  });
  p(esc?.titulares);
  p(esc?.reservas);
  return list;
}

function calcPontos(tipo) {
  return {GOAL:10,YELLOW_CARD:-3,RED_CARD:-5,SUBSTITUTION:0,IMPORTANT:1}[tipo]||0;
}

function getPeriodOrder(minuto) {
  const m=String(minuto||'').toLowerCase();
  if (m.includes('pré')||m.includes('pre')) return 0;
  if (m.includes('1t'))          return 1;
  if (m.includes('intervalo'))   return 2;
  if (m.includes('2t'))          return 3;
  if (m.includes('fim de jogo')) return 4;
  return 5;
}

function extrairMin(minuto) {
  const m=String(minuto||'').match(/(\d+):\d+/); return m?m[1]:null;
}

function limpar(narracao) {
  return (narracao||'')
    .replace(/\.\s*aos \d+:\d+ do (primeiro|segundo) tempo\.?$/i,'')
    .replace(/\s*antes da partida\.?$/i,'').replace(/\s*no intervalo\.?$/i,'')
    .replace(/\.\s*Placar:.*$/i,'')
    .replace(/\s*Placar:.*$/i,'')
    .replace(/^[▶️◽⚽🟨🟥🔄🔹]\s*/u,'').trim();
}

function getIcone(tipo) {
  return {GOAL:'⚽',YELLOW_CARD:'🟨',RED_CARD:'🟥',SUBSTITUTION:'🔄',IMPORTANT:'🔹'}[tipo]||'▶️';
}
function getCor(tipo) {
  return {GOAL:'#22c55e',YELLOW_CARD:'#eab308',RED_CARD:'#ef4444',SUBSTITUTION:'#64748b',IMPORTANT:'#3b82f6'}[tipo]||'#94a3b8';
}

function converterEventos(timeline, nomeCruzeiro) {
  if (!Array.isArray(timeline)) return [];
  const BORING=[
    'jogo segue em andamento','jogo em andamento',
    'mexe o ','mexe o p','jogo retomado','está valendo',
    'pausa aos','+4 aos','+5 aos','+3 aos',
  ];
  const seen=new Set(); const eventos=[];
  const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const normCru = norm(nomeCruzeiro||'');

  // ✅ Identifica se o evento é do Cruzeiro pelo ev.time,
  //    independente de ser mandante ou visitante
  function getLado(ev) {
    if (ev.lado) return ev.lado;
    if (!ev.time || ev.time==='neutro') return 'neutro';
    return norm(ev.time)===normCru ? 'cruzeiro' : 'adversario';
  }

  for (const ev of timeline) {
    if (ev.tipo==='SUMMARY_AUTOMATIC'||ev.tipo==='STANDOUT_PLAYER') continue;
    const ordem=getPeriodOrder(ev.minuto);
    if (ordem===0||ordem===4) continue;
    if (ev.tipo==='NORMAL') {
      const n=(ev.narracao||'').toLowerCase().trim();
      if (!n||BORING.some(b=>n.startsWith(b))) continue;
    }
    const key=`${ev.minuto}|${ev.tipo}|${(ev.narracao||'').substring(0,40)}`;
    if (seen.has(key)) continue; seen.add(key);

    const lado = getLado(ev);
    const isCruzeiro = lado==='cruzeiro';

    let jogador='',jogador_entra='',label='';
    if (ev.tipo==='GOAL') {
      const m=(ev.narracao||'').match(/⚽\s*([A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+)*)/);
      jogador=m?m[1].trim():'';
      label=isCruzeiro?`⚽ GOL DO ${(nomeCruzeiro||'CRUZEIRO').toUpperCase()}!`:'⚽ Gol do adversário';
    } else if (ev.tipo==='YELLOW_CARD'||ev.tipo==='RED_CARD') {
      const m=(ev.narracao||'').match(/(?:para|de)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+)*)/i);
      jogador=m?m[1].trim():'';
      label=ev.titulo||(ev.tipo==='RED_CARD'?'Vermelho!':'Cartão Amarelo');
    } else if (ev.tipo==='SUBSTITUTION') {
      const sai=(ev.narracao||'').match(/sai\s+([^,]+),/i);
      const entra=(ev.narracao||'').match(/entra\s+(.+?)(?:\.|$)/i);
      const sub=(ev.narracao||'').match(/([A-ZÁÉÍÓÚ][a-záéíóú]+(?: [A-ZÁÉÍÓÚ][a-záéíóú]+)*)\s+substitui\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?: [A-ZÁÉÍÓÚ][a-záéíóú]+)*)/i);
      if (sai&&entra){jogador=sai[1].trim();jogador_entra=entra[1].replace(/\.\s*aos.*$/,'').trim();}
      else if (sub){jogador_entra=sub[1].trim();jogador=sub[2].trim();}
      label='Substituição';
    } else if (ev.tipo==='IMPORTANT') {
      const titulo=(ev.titulo||'').replace(/^[🔹▶️◽⚽🟨🟥🔄]\s*/u,'').trim();
      label=titulo&&titulo.length>3?titulo:(limpar(ev.narracao)||'Lance Importante');
    } else {
      label=limpar(ev.narracao)||ev.titulo||'Lance';
    }

    eventos.push({
      minuto:extrairMin(ev.minuto), minuto_raw:ev.minuto, periodo_ordem:ordem,
      tipo:ev.tipo, label, icone:ev.icone||getIcone(ev.tipo), cor:getCor(ev.tipo),
      jogador, jogador_entra, lado, is_cruzeiro: isCruzeiro,
      pontos: isCruzeiro ? calcPontos(ev.tipo) : 0,
      importante:['GOAL','RED_CARD','YELLOW_CARD','SUBSTITUTION','IMPORTANT'].includes(ev.tipo),
      narracao: ev.narracao||'',
    });
  }
  const sorted = eventos.sort((a,b)=>{
    if (a.periodo_ordem!==b.periodo_ordem) return a.periodo_ordem-b.periodo_ordem;
    return (parseInt(a.minuto)||0)-(parseInt(b.minuto)||0);
  });

  // Calcula o placar acumulado no momento de cada gol
  let _gcasa = 0, _gvis = 0;
  for (const ev of sorted) {
    if (ev.tipo === 'GOAL') {
      if (ev.is_cruzeiro) _gcasa++;
      else _gvis++;
      ev.placar_neste_momento = { casa: _gcasa, vis: _gvis };
    }
  }
  return sorted;
}

function calcPontuacao(timeline, nomeCruzeiro) {
  if (!Array.isArray(timeline)) return 0;
  const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const normCru = norm(nomeCruzeiro||'');
  return timeline.filter(ev=>{
    if (ev.lado) return ev.lado==='cruzeiro';
    return ev.time && ev.time!=='neutro' && norm(ev.time)===normCru;
  }).reduce((s,e)=>s+calcPontos(e.tipo),0);
}

// ============================================================
// API — BUSCAR / SALVAR / REAGIR
// ============================================================
async function buscarAvaliacoes(partidaId) {
  try {
    const res = await fetch(
      `${CONFIG_AV.avaliacoesBuscarUrl}&partida=${encodeURIComponent(partidaId)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d)) return d;
    }
  } catch (e) { console.warn('[AV] Worker buscar offline:', e.message); }
  try {
    const s = localStorage.getItem(`aval_${partidaId}`);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

async function salvarAvaliacao(partidaId, avaliacao) {
  let remoto = false;
  try {
    const r = await fetch(CONFIG_AV.avaliacoesSalvarUrl, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({partida_id:partidaId, avaliacao}),
      signal: AbortSignal.timeout(6000),
    });
    remoto = r.ok;
  } catch (e) { console.warn('[AV] Worker salvar offline:', e.message); }
  try {
    const key=`aval_${partidaId}`;
    const ex=JSON.parse(localStorage.getItem(key)||'[]');
    ex.push(avaliacao);
    localStorage.setItem(key, JSON.stringify(ex.slice(-200)));
  } catch {}
  return remoto;
}

async function salvarReacao(partidaId, avaliacaoId, emoji) {
  try {
    await fetch(CONFIG_AV.reagirUrl, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({partida_id:partidaId, avaliacao_id:avaliacaoId, emoji}),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) { console.warn('[AV] Reagir offline:', e.message); }
}

// ============================================================
// IDENTIFICAÇÃO DO CRUZEIRO
// Detecta qual time é o Cruzeiro pelo nome, sigla ou id
// Independente de ser mandante ou visitante
// ============================================================
const CRUZEIRO_TOKENS = ['cruzeiro', 'cru'];

function identificarCruzeiro(jogo) {
  const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const ehCruzeiro = (time) => {
    if (!time) return false;
    const n = norm(time.nome  || '');
    const s = norm(time.sigla || '');
    return CRUZEIRO_TOKENS.some(t => n.includes(t) || s === t);
  };

  if (jogo.times?.casa || jogo.times?.visitante) {
    // Formato novo: { times: { casa: {...}, visitante: {...} } }
    const tcasa = jogo.times.casa;
    const tvis  = jogo.times.visitante;
    if (ehCruzeiro(tcasa)) return { cru: tcasa, adv: tvis, cruEhCasa: true  };
    if (ehCruzeiro(tvis))  return { cru: tvis,  adv: tcasa, cruEhCasa: false };
    // Fallback: assume casa (comportamento antigo, nunca deve chegar aqui)
    return { cru: tcasa, adv: tvis, cruEhCasa: true };
  }

  if (jogo.times?.cruzeiro || jogo.times?.adversario) {
    // Formato antigo: { times: { cruzeiro: {...}, adversario: {...} } }
    return { cru: jogo.times.cruzeiro, adv: jogo.times.adversario, cruEhCasa: true };
  }

  return { cru: null, adv: null, cruEhCasa: true };
}

// ============================================================
// CARREGAR DADOS — suporte multi-partida (worker v5.x)
// ============================================================
function normalizarJogo(jogo, idx) {
  if (!jogo?.partida) return null;

  const { cru, adv, cruEhCasa } = identificarCruzeiro(jogo);

  // ── Nomes e escudos ──────────────────────────────────────
  const nomeCru  = cru?.nome   || jogo.partida?.time_visitante || 'Cruzeiro';
  const nomeAdv  = adv?.nome   || jogo.partida?.time_casa      || 'Adversário';
  const escCru   = cru?.escudos?.png   || CONFIG_AV.defaultEscudo;
  const escAdv   = adv?.escudos?.png   || CONFIG_AV.defaultEscudo;

  // ── Placar ───────────────────────────────────────────────
  let golsCru, golsAdv;
  if (jogo.times?.casa || jogo.times?.visitante) {
    // Formato novo
    golsCru = cruEhCasa ? (jogo.placar?.casa ?? 0) : (jogo.placar?.visitante ?? 0);
    golsAdv = cruEhCasa ? (jogo.placar?.visitante ?? 0) : (jogo.placar?.casa ?? 0);
  } else {
    // Formato antigo
    golsCru = jogo.placar?.cruzeiro  ?? 0;
    golsAdv = jogo.placar?.adversario ?? 0;
  }

  // ── Escalação e estatísticas do Cruzeiro ─────────────────
  let escalacaoCru, statCru, statAdv;
  if (jogo.times?.casa || jogo.times?.visitante) {
    escalacaoCru = cruEhCasa ? jogo.escalacoes?.casa      : jogo.escalacoes?.visitante;
    statCru      = cruEhCasa ? jogo.estatisticas?.casa     : jogo.estatisticas?.visitante;
    statAdv      = cruEhCasa ? jogo.estatisticas?.visitante: jogo.estatisticas?.casa;
  } else {
    escalacaoCru = jogo.escalacao_cruzeiro;
    statCru      = jogo.estatisticas?.cruzeiro;
    statAdv      = jogo.estatisticas?.adversario;
  }

  // ── Display: preserva ordem real da partida (mandante × visitante) ──
  const mandante        = cruEhCasa ? nomeCru  : nomeAdv;
  const visitante       = cruEhCasa ? nomeAdv  : nomeCru;
  const escudoMandante  = cruEhCasa ? escCru   : escAdv;
  const escudoVisitante = cruEhCasa ? escAdv   : escCru;
  const golsMandante    = cruEhCasa ? golsCru  : golsAdv;
  const golsVisitante   = cruEhCasa ? golsAdv  : golsCru;

  return {
    id:               jogo.identificador_unico || `jogo-${idx}-${jogo.partida?.data||Date.now()}`,
    competicao:       jogo.partida?.fase    || 'Partida',
    data:             formatarData(jogo.partida?.data),
    hora:             jogo.partida?.horario || '--',
    local:            jogo.partida?.local   || '',
    mandante,  visitante,
    escudo_mandante: escudoMandante,
    escudo_visitante: escudoVisitante,
    gols_mandante:    golsMandante,
    gols_visitante:   golsVisitante,
    placar_txt:       jogo.placar?.texto || `${mandante} ${golsMandante} x ${golsVisitante} ${visitante}`,
    // ↓ guardamos o nome real do Cruzeiro para usar na lógica de eventos
    nome_cruzeiro:    nomeCru,
    nome_adversario:  nomeAdv,
    encerrada: !!(jogo.partida_encerrada || jogo._encerrada
                  || jogo.status_detalhado?.isEncerrada
                  || jogo.status_detalhado?.status === 'Encerrada'
                  || jogo.status_detalhado?.periodoId === 'POS_JOGO'),
    jogadores:           converterJogadores(escalacaoCru),
    eventos_timeline:    converterEventos(jogo.timeline, nomeCru),
    pontuacao_cruzeiro:  calcPontuacao(jogo.timeline, nomeCru),
    estatisticas:        (statCru||statAdv) ? { cruzeiro: statCru, adversario: statAdv } : null,
    _jogoRaw:            jogo,
  };
}

async function carregarDadosAvaliacao() {
  try {
    // cache: 'no-store' garante que o browser não sirva versão antiga
    const res   = await fetch(
      CONFIG_AV.avaliacaoUrl + '&_t=' + Date.now(),
      { signal: AbortSignal.timeout(8000), cache: 'no-store' }
    );
    if (!res.ok) throw new Error('HTTP '+res.status);
    const dados = await res.json();

    // Worker v5.2 → array; worker v5.1 / n8n direto → objeto único
    const lista = Array.isArray(dados) ? dados : (dados?.partida ? [dados] : []);
    if (!lista.length) return [];

    // Normaliza e deduplica por id
    const vistos = new Set();
    const resultado = [];
    for (let i = 0; i < lista.length; i++) {
      const norm = normalizarJogo(lista[i], i);
      if (!norm) continue;
      if (vistos.has(norm.id)) continue;
      vistos.add(norm.id);
      resultado.push(norm);
    }
    return resultado;
  } catch (e) {
    console.error('[AV] Erro ao carregar dados:', e);
    return [];
  }
}


// ============================================================
// PRÓXIMO JOGO — countdown quando não há partida disponível
// ============================================================
let _countdownInterval = null;

async function buscarProximoJogoEExibir(container) {
  const el = container || $('partidas-lista');
  if (!el) return;
  el.innerHTML = '<div class="loading-av"><div class="spinner-av"></div><span>Buscando próximo jogo...</span></div>';
  try {
    const res  = await fetch(CONFIG_AV.dadosUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw  = await res.json();
    const jogos = raw?.agenda || [];
    const hoje  = new Date();
    const proximo = jogos.find(j => {
      if (!j.data || !j.hora) return false;
      try { return parseDataJogo(j.data, j.hora) > hoje; } catch { return false; }
    });
    if (proximo) {
      renderProximoJogo(proximo, el);
    } else {
      el.innerHTML = renderSemPartidasHtml();
    }
  } catch(e) {
    console.warn('[AV] Agenda offline:', e.message);
    el.innerHTML = renderSemPartidasHtml();
  }
}

function parseDataJogo(data, hora) {
  // data formato "25/02" ou "25/02/2026", hora "20:00"
  const partes = data.split('/');
  const dia  = parseInt(partes[0]);
  const mes  = parseInt(partes[1]) - 1;
  const ano  = partes[2] ? parseInt(partes[2]) : new Date().getFullYear();
  const [h, m] = hora.split(':').map(Number);
  return new Date(ano, mes, dia, h, m, 0);
}

function renderSemPartidasHtml() {
  return `<div class="sem-partidas">
    <i class="fas fa-calendar-times"></i>
    <h3>Nenhuma partida disponível</h3>
    <p>As avaliações serão liberadas após o próximo jogo do Cruzeiro.<br>
       Acompanhe a agenda na aba <a href="resultados.html">Resultados</a>.</p>
  </div>`;
}

function renderProximoJogo(jogo, container) {
  const dt = parseDataJogo(jogo.data, jogo.hora);
  container.innerHTML = `
    <div class="proximo-jogo-card">
      <div class="pjc-topo">
        <span class="pjc-badge"><i class="fas fa-clock"></i> Próximo Jogo</span>
        <span class="pjc-comp">${escHtml(jogo.campeonato || '')}</span>
      </div>
      <div class="pjc-times">
        <div class="pjc-time">
          <img src="${escHtml(jogo.escudo_mandante || CONFIG_AV.defaultEscudo)}"
               alt="${escHtml(jogo.mandante || '')}"
               onerror="this.src='${CONFIG_AV.defaultEscudo}'">
          <span>${escHtml(jogo.mandante || '')}</span>
        </div>
        <div class="pjc-centro">
          <div class="pjc-vs">×</div>
          <div class="pjc-datainfo">
            <i class="far fa-calendar"></i> ${escHtml(jogo.data)} &nbsp;
            <i class="far fa-clock"></i> ${escHtml(jogo.hora)}
          </div>
          ${jogo.estadio ? `<div class="pjc-estadio"><i class="fas fa-map-marker-alt"></i> ${escHtml(jogo.estadio)}</div>` : ''}
        </div>
        <div class="pjc-time">
          <img src="${escHtml(jogo.escudo_visitante || CONFIG_AV.defaultEscudo)}"
               alt="${escHtml(jogo.visitante || '')}"
               onerror="this.src='${CONFIG_AV.defaultEscudo}'">
          <span>${escHtml(jogo.visitante || '')}</span>
        </div>
      </div>
      <div class="pjc-countdown">
        <div class="pjc-cd-bloco"><span class="pjc-cd-num" id="pjcd-d">--</span><span class="pjc-cd-lbl">dias</span></div>
        <span class="pjc-cd-sep">:</span>
        <div class="pjc-cd-bloco"><span class="pjc-cd-num" id="pjcd-h">--</span><span class="pjc-cd-lbl">horas</span></div>
        <span class="pjc-cd-sep">:</span>
        <div class="pjc-cd-bloco"><span class="pjc-cd-num" id="pjcd-m">--</span><span class="pjc-cd-lbl">min</span></div>
        <span class="pjc-cd-sep">:</span>
        <div class="pjc-cd-bloco"><span class="pjc-cd-num" id="pjcd-s">--</span><span class="pjc-cd-lbl">seg</span></div>
      </div>
      <p class="pjc-aviso"><i class="fas fa-star"></i> A avaliação abre após o apito final!</p>
    </div>`;
  iniciarCountdown(dt);
}

function iniciarCountdown(target) {
  if (_countdownInterval) clearInterval(_countdownInterval);
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    const diff = target - new Date();
    if (diff <= 0) {
      clearInterval(_countdownInterval);
      ['pjcd-d','pjcd-h','pjcd-m','pjcd-s'].forEach(id => { const e=$( id); if(e) e.textContent='00'; });
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const set = (id, v) => { const e=$(id); if(e) e.textContent = pad(v); };
    set('pjcd-d', d); set('pjcd-h', h); set('pjcd-m', m); set('pjcd-s', s);
  }
  tick();
  _countdownInterval = setInterval(tick, 1000);
}

// ============================================================
// RENDER — PARTIDAS (novo layout com dois estados)
// ============================================================
function buildCardHtml(p) {
  const av        = jaAvaliou(p.id);
  const encerrada = !!p.encerrada;
  const badgeStatus = encerrada
    ? '<span class="partida-badge-encerrada"><i class="fas fa-flag-checkered"></i> Encerrada</span>'
    : '<span class="partida-badge-live"><i class="fas fa-circle"></i> Ao Vivo</span>';
  return `<div class="partida-card ${av?'selected':''}" data-id="${escHtml(p.id)}" role="button" tabindex="0" aria-label="Partida ${escHtml(p.mandante)} vs ${escHtml(p.visitante)}">
    <div class="partida-card-inner">
      ${av?'<span class="partida-badge-ja">✓ Avaliado</span>':''}
      ${badgeStatus}
      <div class="partida-competicao">${escHtml(p.competicao)}</div>
      <div class="partida-times">
        <div class="partida-time">
          <img src="${escHtml(p.escudo_mandante)}" alt="${escHtml(p.mandante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
          <span>${escHtml(p.mandante)}</span>
        </div>
        <div class="partida-placar">${p.gols_mandante ?? '–'} × ${p.gols_visitante ?? '–'}</div>
        <div class="partida-time">
          <img src="${escHtml(p.escudo_visitante)}" alt="${escHtml(p.visitante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
          <span>${escHtml(p.visitante)}</span>
        </div>
      </div>
      <div class="partida-data"><i class="far fa-calendar"></i> ${escHtml(p.data)} • ${escHtml(p.hora)}</div>
      <div class="partida-card-footer" id="btn-card-${escHtml(p.id)}">
        <i class="fas ${av?'fa-check-circle':'fa-star'}"></i>
        <span>${av?'Ver Avaliações':'Avaliar Partida'}</span>
        <i class="fas fa-chevron-down partida-card-chevron"></i>
      </div>
    </div>
  </div>`;
}

function bindCardEvents(container) {
  container.querySelectorAll('.partida-card').forEach(card => {
    const toggle = () => {
      const id = card.dataset.id; if (!id) return;
      const avSection = $('avaliacao-section');
      const jaAberto  = avSection && avSection.style.display !== 'none' && state.partidaSelecionada?.id === id;
      if (jaAberto) fecharPainelAvaliacao();
      else selecionarPartida(id);
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}

function renderPartidas(partidas) {
  const estadoComJogo = document.getElementById('estado-com-jogo');
  const estadoSemJogo = document.getElementById('estado-sem-jogo');

  if (!partidas.length) {
    if (estadoSemJogo) estadoSemJogo.style.display = 'block';
    if (estadoComJogo) estadoComJogo.style.display  = 'none';
    buscarProximoJogoEExibir($('proximo-jogo-wrapper'));
    return;
  }

  if (estadoComJogo) estadoComJogo.style.display = 'block';
  if (estadoSemJogo) estadoSemJogo.style.display = 'none';

  const el = $('partidas-lista');
  if (el) { el.innerHTML = partidas.map(buildCardHtml).join(''); bindCardEvents(el); }

  // Mostra countdown se todas encerradas
  if (partidas.every(p => p.encerrada)) {
    buscarProximoJogoEExibir($('proximo-jogo-wrapper'));
  }
}
// ============================================================
// FECHAR PAINEL
// ============================================================
function fecharPainelAvaliacao() {
  const av = $('avaliacao-section');
  if (av) av.style.display = 'none';
  const id = state.partidaSelecionada?.id;
  state.partidaSelecionada = null;
  // Restaura visual do footer do card
  if (id) {
    const footer = document.getElementById('btn-card-' + id);
    if (footer) {
      const jAval = jaAvaliou(id);
      footer.innerHTML = `<i class="fas ${jAval ? 'fa-check-circle' : 'fa-star'}"></i><span>${jAval ? 'Ver Avaliações' : 'Avaliar Partida'}</span><i class="fas fa-chevron-down partida-card-chevron"></i>`;
    }
  }
  document.querySelectorAll('.partida-card').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.partida-card-chevron')?.classList.remove('rotated');
  });
  // Esconde FABs, widget de pontuação e fecha painéis laterais
  const fab = $('fab-bar'); if (fab) fab.style.display = 'none';
  const pw = document.getElementById('pontuacao-widget'); if (pw) pw.style.display = 'none';
  fecharSidePanel('stats');
  fecharSidePanel('escalacao');
  fecharChatWidget();
}

// ============================================================
// RENDER — PLACAR
// ============================================================
// ============================================================
// RENDER — PLACAR INTERNO (novo layout wireframe)
// ============================================================
function renderPlacarInterno(partida) {
  const el = document.getElementById('placar-interno');
  if (!el) return;
  const status   = partida.encerrada ? 'Encerrada' : 'Ao Vivo';
  const statusCls= partida.encerrada ? '' : ' live';
  el.innerHTML = `
    <div class="pi-time">
      <img class="pi-escudo" src="${escHtml(partida.escudo_mandante)}" alt="${escHtml(partida.mandante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
      <div class="pi-nome">${escHtml(partida.mandante)}</div>
    </div>
    <div class="pi-placar-central">
      <div class="pi-placar-txt">${partida.gols_mandante} × ${partida.gols_visitante}</div>
      <div class="pi-status${statusCls}">${status}</div>
    </div>
    <div class="pi-time visitante">
      <img class="pi-escudo" src="${escHtml(partida.escudo_visitante)}" alt="${escHtml(partida.visitante)}" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
      <div class="pi-nome">${escHtml(partida.visitante)}</div>
    </div>`;
}

// ============================================================
// RENDER — PONTUAÇÃO AUTOMÁTICA DA PARTIDA
// ============================================================
function renderPontuacaoPanel(partida) {
  // Agora alimenta o widget flutuante (#pontuacao-widget) em vez do slot inline
  const widget = document.getElementById('pontuacao-widget');
  const pwTotal = document.getElementById('pw-total');
  const pwBadge = document.getElementById('pw-badge-cls');
  const pwItems = document.getElementById('pw-items');
  if (!widget || !pwTotal || !pwBadge || !pwItems) return;

  const todos = partida.eventos_timeline || [];

  // Contadores separados para Cruzeiro
  const golsCru   = todos.filter(e => e.is_cruzeiro && e.tipo === 'GOAL').length;
  const golsSof   = todos.filter(e => !e.is_cruzeiro && e.tipo === 'GOAL').length;
  const amCru     = todos.filter(e => e.is_cruzeiro && e.tipo === 'YELLOW_CARD').length;
  const vmCru     = todos.filter(e => e.is_cruzeiro && e.tipo === 'RED_CARD').length;
  const impCru    = todos.filter(e => e.is_cruzeiro && e.tipo === 'IMPORTANT').length;

  const ptGols    = golsCru  * 10;
  const ptSof     = golsSof  * -5;
  const ptAm      = amCru    * -1;
  const ptVm      = vmCru    * -3;
  const ptImp     = impCru   * 1;
  const total     = ptGols + ptSof + ptAm + ptVm + ptImp;

  const cls = getClassificacao(total);
  const sinalTotal = total >= 0 ? '+' : '';

  // Atualiza total com animação de pulso se mudou
  const totalStr = `${sinalTotal}${total}`;
  if (pwTotal.textContent !== totalStr) {
    pwTotal.textContent = totalStr;
    pwTotal.classList.remove('pw-update');
    void pwTotal.offsetWidth; // reflow para reiniciar animação
    pwTotal.classList.add('pw-update');
  }

  // Cor do total
  pwTotal.style.color = total >= 0 ? '#ffd700' : '#f87171';

  // Badge de classificação
  pwBadge.textContent = cls.texto;
  pwBadge.className = `pw-badge ${cls.cls}`;

  // Itens do breakdown
  function pwItem(icone, label, pts, mostrar) {
    if (!mostrar) return '';
    const sinal = pts >= 0 ? '+' : '';
    const cor   = pts >= 0 ? '#86efac' : '#fca5a5';
    return `<div class="pw-item">
      <span class="pw-item-icone">${icone}</span>
      <span class="pw-item-label">${label}</span>
      <span class="pw-item-valor" style="color:${cor}">${sinal}${pts}</span>
    </div>`;
  }

  const linhas = [
    pwItem('⚽', `${golsCru} gol${golsCru!==1?'s':''} marcado${golsCru!==1?'s':''}`, ptGols, golsCru > 0),
    pwItem('🛡️', `${golsSof} gol${golsSof!==1?'s':''} sofrido${golsSof!==1?'s':''}`, ptSof, golsSof > 0),
    pwItem('🟨', `${amCru} amarelo${amCru!==1?'s':''}`, ptAm, amCru > 0),
    pwItem('🟥', `${vmCru} vermelho${vmCru!==1?'s':''}`, ptVm, vmCru > 0),
    pwItem('🔹', `${impCru} lance${impCru!==1?'s':''} importante${impCru!==1?'s':''}`, ptImp, impCru > 0),
  ].filter(Boolean).join('');

  pwItems.innerHTML = linhas || '<div class="pw-item" style="color:rgba(255,255,255,.4);font-size:.8rem">Sem eventos ainda</div>';

  // Mostra o widget
  widget.style.display = 'block';

  // Inicializa toggle (uma única vez)
  const pwToggle  = document.getElementById('pw-toggle');
  const pwBody    = document.getElementById('pw-body');
  const pwChevron = document.getElementById('pw-chevron');
  if (pwToggle && !pwToggle._initialized) {
    pwToggle._initialized = true;
    pwToggle.addEventListener('click', () => {
      const col = pwBody.classList.toggle('pw-collapsed');
      pwChevron.classList.toggle('collapsed', col);
      pwToggle.setAttribute('aria-expanded', !col);
    });
    pwToggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pwToggle.click(); }
    });
  }
}
function renderEscalacao(partida) {
  const slot = document.getElementById('escalacao-slot');
  if (!slot) return;
  slot.innerHTML = ''; // limpa conteúdo anterior

  const jogo = partida._jogoRaw || {};
  const escCasa = jogo.escalacoes?.casa || jogo.escalacao_cruzeiro;
  const escVis  = jogo.escalacoes?.visitante || jogo.escalacao_adversario;
  if (!escCasa && !escVis) { slot.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;font-size:.82rem">Escalação não disponível</div>'; return; }

  function listaJogadores(lista, limite=11) {
    if (!lista || !lista.length) return '<li class="escal-jogador" style="color:#94a3b8">–</li>';
    return lista.slice(0, limite).map(j => `
      <li class="escal-jogador">
        <span class="escal-num">${j.numero||''}</span>
        <span class="escal-pos">${j.posicao||''}</span>
        <span class="escal-nome">${j.nome||j.nome_formatado||''}</span>
      </li>`).join('');
  }

  slot.innerHTML = `
    <div class="escal-body" id="escal-body">
      <div class="escal-grid">
        <div class="escal-time-col">
          <div class="escal-time-header">
            <img src="${escHtml(partida.escudo_mandante)}" alt="" onerror="this.style.display='none'">
            <strong>${escHtml(partida.mandante)}</strong>
          </div>
          ${escCasa?.tecnico ? `<div class="escal-tecnico">Técnico: ${escHtml(escCasa.tecnico)}</div>` : ''}
          <ul class="escal-lista">${listaJogadores(escCasa?.titulares)}</ul>
        </div>
        <div class="escal-time-col">
          <div class="escal-time-header vis">
            <img src="${escHtml(partida.escudo_visitante)}" alt="" onerror="this.style.display='none'">
            <strong>${escHtml(partida.visitante)}</strong>
          </div>
          ${escVis?.tecnico ? `<div class="escal-tecnico">Técnico: ${escHtml(escVis.tecnico)}</div>` : ''}
          <ul class="escal-lista">${listaJogadores(escVis?.titulares)}</ul>
        </div>
      </div>
    </div>`;
}

function renderPlacarCard(partida) {
  const el=$('placar-card'); if(!el) return;
  const statsHtml=partida.estatisticas?(()=>{
    const c=partida.estatisticas.cruzeiro||{}, a=partida.estatisticas.adversario||{};
    const rows=[
      ['Posse',`${c.posse_bola??'—'}%`,`${a.posse_bola??'—'}%`,c.posse_bola,a.posse_bola],
      ['Finalizações',c.finalizacoes??'—',a.finalizacoes??'—',c.finalizacoes,a.finalizacoes],
      ['No Gol',c.finalizacoes_no_gol??'—',a.finalizacoes_no_gol??'—',c.finalizacoes_no_gol,a.finalizacoes_no_gol],
      ['Escanteios',c.escanteios??'—',a.escanteios??'—',c.escanteios,a.escanteios],
      ['Faltas',c.faltas??'—',a.faltas??'—',a.faltas,c.faltas],
    ];
    return `<div class="placar-stats">${rows.map(([nome,vc,va,nc,na])=>{
      const tot=(nc||0)+(na||0); const pct=tot?Math.round(((nc||0)/tot)*100):50;
      return `<div class="stat-row"><span class="stat-val cruzeiro-val">${vc}</span>
        <div class="stat-bars"><div class="stat-bar-fill home" style="width:${pct}%"></div></div>
        <span class="stat-nome">${nome}</span>
        <div class="stat-bars flip"><div class="stat-bar-fill away" style="width:${100-pct}%"></div></div>
        <span class="stat-val adv-val">${va}</span></div>`;
    }).join('')}</div>`;
  })():'';
  el.innerHTML=`
    <div class="placar-main">
      <div class="placar-time">
        <img src="${escHtml(partida.escudo_mandante)}" alt="" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
        <span>${escHtml(partida.mandante)}</span>
      </div>
      <div class="placar-centro">
        <div class="placar-gols">${partida.gols_mandante}<span>×</span>${partida.gols_visitante}</div>
        <div class="placar-comp">${escHtml(partida.competicao)}</div>
        <div class="placar-data-info">${escHtml(partida.data)} • ${escHtml(partida.hora)}</div>
      </div>
      <div class="placar-time">
        <img src="${escHtml(partida.escudo_visitante)}" alt="" onerror="this.src='${CONFIG_AV.defaultEscudo}'">
        <span>${escHtml(partida.visitante)}</span>
      </div>
    </div>${statsHtml}`;
}

// ============================================================
// RENDER — ESTATÍSTICAS DA PARTIDA (painel dedicado)
// ============================================================
function renderEstatisticas(partida) {
  const slot = document.getElementById('estatisticas-slot');
  if (!slot) return;
  slot.innerHTML = ''; // limpa

  const st = partida.estatisticas;
  if (!st) {
    slot.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;font-size:.82rem">Estatísticas não disponíveis</div>';
    return;
  }

  const c = st.cruzeiro || st.casa || {};
  const a = st.adversario || st.visitante || {};
  const nomeCasa = escHtml(partida.mandante);
  const nomeVis  = escHtml(partida.visitante);

  function statRow(label, vc, va, maiorMelhor = true) {
    const nc = typeof vc === 'number' ? vc : parseFloat(vc) || 0;
    const na = typeof va === 'number' ? va : parseFloat(va) || 0;
    const tot = nc + na;
    const pct = tot ? Math.round((nc / tot) * 100) : 50;
    const venceCasa = maiorMelhor ? nc >= na : nc <= na;
    return `<div class="est-row">
      <span class="est-val est-casa ${venceCasa&&tot?'est-winner':''}">${vc ?? '—'}${label==='Posse'?'%':''}</span>
      <div class="est-mid">
        <span class="est-label">${label}</span>
        <div class="est-bar-wrap">
          <div class="est-bar est-bar-casa" style="width:${pct}%"></div>
          <div class="est-bar est-bar-vis" style="width:${100-pct}%"></div>
        </div>
      </div>
      <span class="est-val est-vis ${!venceCasa&&tot?'est-winner':''}">${va ?? '—'}${label==='Posse'?'%':''}</span>
    </div>`;
  }

  const rows = [
    statRow('Posse', c.posse_bola, a.posse_bola),
    statRow('Finalizações', c.finalizacoes, a.finalizacoes),
    statRow('No Gol', c.finalizacoes_no_gol, a.finalizacoes_no_gol),
    statRow('Bloqueadas', c.finalizacoes_bloqueadas, a.finalizacoes_bloqueadas),
    statRow('Escanteios', c.escanteios, a.escanteios),
    statRow('Faltas', c.faltas, a.faltas, false),
    statRow('Passes Certos', c.passes_certos, a.passes_certos),
    statRow('Total de Passes', c.passes_totais, a.passes_totais),
    statRow('Desarmes', c.desarmes, a.desarmes),
    statRow('Amarelos', c.cartoes_amarelos, a.cartoes_amarelos, false),
    statRow('Vermelhos', c.cartoes_vermelhos, a.cartoes_vermelhos, false),
    statRow('Impedimentos', c.impedimentos, a.impedimentos, false),
  ].filter(Boolean).join('');

  slot.innerHTML = `
    <div class="est-times-header">
      <div class="est-time-header">
        <img src="${escHtml(partida.escudo_mandante)}" alt="" onerror="this.style.display='none'">
        <span>${nomeCasa}</span>
      </div>
      <div></div>
      <div class="est-time-header est-time-vis">
        <img src="${escHtml(partida.escudo_visitante)}" alt="" onerror="this.style.display='none'">
        <span>${nomeVis}</span>
      </div>
    </div>
    <div class="est-rows">${rows}</div>`;
}
function getClassificacao(pts) {
  if (pts>=25) return {texto:'Excelente',cls:'excelente'};
  if (pts>=15) return {texto:'Boa',cls:'boa'};
  if (pts>=8)  return {texto:'Regular',cls:'regular'};
  if (pts>=3)  return {texto:'Ruim',cls:'ruim'};
  return           {texto:'Péssima',cls:'pessima'};
}

// Determina cor/classe do chip pelo tipo de evento
function getChipClass(tipo, isCruzeiro) {
  if (tipo==='GOAL') return isCruzeiro ? 'htl-chip-gol-casa' : 'htl-chip-gol-vis';
  if (tipo==='RED_CARD') return isCruzeiro ? 'htl-chip-vm-casa' : 'htl-chip-vm-vis';
  if (tipo==='YELLOW_CARD') return isCruzeiro ? 'htl-chip-am-casa' : 'htl-chip-am-vis';
  if (tipo==='SUBSTITUTION') return isCruzeiro ? 'htl-chip-sub-casa' : 'htl-chip-sub-vis';
  if (tipo==='IMPORTANT') return isCruzeiro ? 'htl-chip-imp-casa' : 'htl-chip-imp-vis';
  return 'htl-chip-normal';
}

// Texto legível para o tooltip do evento
function getDetalheLance(ev, nomeCasa, nomeVis) {
  const time = ev.is_cruzeiro ? nomeCasa : (ev.lado==='adversario' ? nomeVis : '');
  const min  = ev.minuto ? `${ev.minuto}'` : '';

  if (ev.tipo==='GOAL') {
    const quem = ev.jogador ? ` — ${ev.jogador}` : '';
    const timeNome = ev.is_cruzeiro ? nomeCasa : nomeVis;
    return { titulo: `⚽ GOL! ${timeNome}${quem}`, sub: min ? `${min} do jogo` : '' };
  }
  if (ev.tipo==='RED_CARD') {
    const quem = ev.jogador ? ev.jogador : (time||'Jogador');
    return { titulo: `🟥 Vermelho — ${quem}`, sub: time ? `${time}${min?' · '+min:''}` : min };
  }
  if (ev.tipo==='YELLOW_CARD') {
    const quem = ev.jogador ? ev.jogador : (time||'Jogador');
    return { titulo: `🟨 Amarelo — ${quem}`, sub: time ? `${time}${min?' · '+min:''}` : min };
  }
  if (ev.tipo==='SUBSTITUTION') {
    const sai    = ev.jogador       ? `Sai: ${ev.jogador}` : '';
    const entra  = ev.jogador_entra ? `Entra: ${ev.jogador_entra}` : '';
    const timeNome = time || (ev.is_cruzeiro ? nomeCasa : nomeVis);
    return {
      titulo: `🔄 Substituição — ${timeNome}`,
      sub: [sai, entra].filter(Boolean).join(' · ') || (min ? `${min}` : ''),
    };
  }
  if (ev.tipo==='IMPORTANT') {
    return { titulo: `🔹 ${ev.label}`, sub: time ? `${time}${min?' · '+min:''}` : min };
  }
  return { titulo: ev.label || 'Lance', sub: min };
}

function renderHorizontalTimeline(partida) {
  const el=$('timeline-panel'); if(!el) return;
  const todos=partida.eventos_timeline||[];
  if (!todos.length) { el.style.display='none'; return; }
  el.style.display='block';

  state.escudoCasa = partida.escudo_mandante;
  state.escudoVis  = partida.escudo_visitante;
  state.nomeCasa   = partida.mandante;
  state.nomeVis    = partida.visitante;

  // ✅ Para tooltips e labels de eventos usamos nome_cruzeiro/nome_adversario
  // (não mandante/visitante, pois o Cruzeiro pode ser qualquer um dos lados)
  const nomeCruzeiro = partida.nome_cruzeiro || partida.mandante;
  const nomeAdversario = partida.nome_adversario || partida.visitante;
  // Para compatibilidade com getDetalheLance, passamos cruzeiro como "casa" e adversario como "vis"
  const nomeCasa = nomeCruzeiro;
  const nomeVis  = nomeAdversario;

  const golsCru = todos.filter(e=>e.is_cruzeiro&&e.tipo==='GOAL').length;
  const golsAdv = todos.filter(e=>!e.is_cruzeiro&&e.tipo==='GOAL').length;
  const amTotal = todos.filter(e=>e.tipo==='YELLOW_CARD').length;
  const vmTotal = todos.filter(e=>e.tipo==='RED_CARD').length;
  const subs    = todos.filter(e=>e.tipo==='SUBSTITUTION').length;

  // Filtra apenas eventos relevantes (exclui NORMAL genérico)
  const TIPOS_CHIP = ['GOAL','RED_CARD','YELLOW_CARD','SUBSTITUTION','IMPORTANT'];
  const relevantes  = todos.filter(e=>TIPOS_CHIP.includes(e.tipo));

  // Agrupa por período
  const ev1T  = relevantes.filter(e=>e.periodo_ordem===1);
  const evINT = relevantes.filter(e=>e.periodo_ordem===2);
  const ev2T  = relevantes.filter(e=>e.periodo_ordem===3);

  function buildChip(ev) {
    const cls    = getChipClass(ev.tipo, ev.is_cruzeiro);
    const min    = ev.minuto ? `${ev.minuto}'` : '';
    const det    = getDetalheLance(ev, nomeCasa, nomeVis);
    const idx    = todos.indexOf(ev);
    // Lado: casa=esquerda, vis=direita, neutro=centro (sem indicador)
    const ladoCls = ev.is_cruzeiro ? 'htl-lado-casa' : (ev.lado==='adversario' ? 'htl-lado-vis' : '');
    return `<button class="htl-chip ${cls} ${ladoCls}" data-ev="${idx}"
        aria-label="${escHtml(det.titulo)}"
        onclick="abrirDetalheTimeline(${idx})">
      <span class="htl-chip-icone">${ev.icone||'▶️'}</span>
      ${min ? `<span class="htl-chip-min">${min}</span>` : ''}
    </button>`;
  }

  function buildPeriodoFaixa(evs, nome, labelShort) {
    if (!evs.length) return '';
    const chips = evs.map(buildChip).join('');
    return `
      <div class="htl-periodo">
        <div class="htl-periodo-label">${labelShort}</div>
        <div class="htl-faixa">
          <div class="htl-linha"></div>
          <div class="htl-chips">${chips}</div>
        </div>
      </div>`;
  }

  const faixas = [
    buildPeriodoFaixa(ev1T, '1º Tempo', '1T'),
    buildPeriodoFaixa(evINT, 'Intervalo', 'INT'),
    buildPeriodoFaixa(ev2T, '2º Tempo', '2T'),
  ].filter(Boolean).join('');

  // Legenda de times (substituiu o cabeçalho-cabecalho antigo)
  const legenda = `
    <div class="htl-legenda">
      <span class="htl-leg-item htl-leg-casa">
        <img src="${escHtml(partida.escudo_mandante)}" alt="" onerror="this.style.display='none'">
        ${escHtml(partida.mandante)}
      </span>
      <span class="htl-leg-sep"></span>
      <span class="htl-leg-item htl-leg-vis">
        <img src="${escHtml(partida.escudo_visitante)}" alt="" onerror="this.style.display='none'">
        ${escHtml(partida.visitante)}
      </span>
    </div>`;

  // Painel de detalhe (fechado por padrão, abre ao clicar)
  const painelDetalhe = `<div class="htl-detalhe-panel" id="htl-detalhe" style="display:none;"></div>`;

  el.innerHTML=`
    <div class="htl-header htl-header-toggle" id="htl-toggle-btn" role="button" tabindex="0" aria-expanded="true">
      <div class="htl-titulo"><i class="fas fa-stream"></i> Lance a Lance</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <div class="htl-resumo-chips">
          ${golsCru ?`<span class="resumo-chip chip-gol">⚽ ${golsCru} gol${golsCru>1?'s':''}</span>`:''}
          ${golsAdv ?`<span class="resumo-chip chip-gol-adv">⚽ ${golsAdv} sofrido${golsAdv>1?'s':''}</span>`:''}
          ${amTotal ?`<span class="resumo-chip chip-cartao">🟨 ${amTotal}</span>`:''}
          ${vmTotal ?`<span class="resumo-chip chip-vermelho">🟥 ${vmTotal}</span>`:''}
          ${subs    ?`<span class="resumo-chip chip-sub">🔄 ${subs}</span>`:''}
        </div>
        <span class="htl-toggle-chevron"><i class="fas fa-chevron-up"></i></span>
      </div>
    </div>
    <div class="htl-body" id="htl-body">
      ${legenda}
      <div class="htl-periodos">${faixas}</div>
      ${painelDetalhe}
    </div>
  `;

  // ✅ Guarda nome_cruzeiro e nome_adversario para uso nos tooltips (não mandante/visitante)
  el._eventos    = todos;
  el._nomeCasa   = nomeCruzeiro;   // cruzeiro = "casa" na lógica de is_cruzeiro
  el._nomeVis    = nomeAdversario;
  el._escudoCasa = partida.escudo_mandante;
  el._escudoVis  = partida.escudo_visitante;

  // Toggle collapsar timeline
  const htlToggle = document.getElementById('htl-toggle-btn');
  const htlBody   = document.getElementById('htl-body');
  if (htlToggle && htlBody) {
    const toggleTimeline = () => {
      const collapsed = htlBody.classList.toggle('htl-collapsed');
      const icon = htlToggle.querySelector('.htl-toggle-chevron i');
      if (icon) icon.className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      htlToggle.setAttribute('aria-expanded', !collapsed);
    };
    htlToggle.addEventListener('click', toggleTimeline);
    htlToggle.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') toggleTimeline(); });
  }
}

// Abre painel de detalhe ao clicar num chip
function abrirDetalheTimeline(idx) {
  const panel = document.getElementById('htl-detalhe');
  const tpEl  = $('timeline-panel');
  if (!panel || !tpEl) return;

  const todos    = tpEl._eventos || [];
  const nomeCasa = tpEl._nomeCasa || '';
  const nomeVis  = tpEl._nomeVis  || '';
  const ev = todos[idx];
  if (!ev) return;

  // Toggle: fecha se já está aberto para o mesmo evento
  if (panel.dataset.openIdx === String(idx) && panel.style.display !== 'none') {
    panel.style.display='none';
    panel.dataset.openIdx='';
    document.querySelectorAll('.htl-chip').forEach(c=>c.classList.remove('htl-chip-ativo'));
    return;
  }

  document.querySelectorAll('.htl-chip').forEach(c=>c.classList.remove('htl-chip-ativo'));
  document.querySelector(`.htl-chip[data-ev="${idx}"]`)?.classList.add('htl-chip-ativo');
  panel.dataset.openIdx = String(idx);

  const det     = getDetalheLance(ev, nomeCasa, nomeVis);
  const min     = ev.minuto ? `${ev.minuto}'` : '';
  const isCasa  = ev.is_cruzeiro;
  const isVis   = ev.lado==='adversario';
  const escudo  = isCasa ? tpEl._escudoCasa : (isVis ? tpEl._escudoVis : '');
  const timeNome = isCasa ? nomeCasa : (isVis ? nomeVis : '');

  // Texto da narração (limpo, sem timestamps e sem placar embutido)
  const narracaoCompleta = ev.narracao
    ? limpar(ev.narracao)
    : '';
  const descricaoExtra = narracaoCompleta && narracaoCompleta !== det.titulo.replace(/^[⚽🟨🟥🔄🔹]\s*/u,'')
    ? `<p class="htl-det-narracao">${escHtml(narracaoCompleta)}</p>` : '';

  // Para gols, mostra o placar calculado (correto) em vez do que veio na narração
  const placarGolHtml = (ev.tipo === 'GOAL' && ev.placar_neste_momento)
    ? `<p class="htl-det-placar">⚽ Placar: ${escHtml(tpEl._nomeCasa)} ${ev.placar_neste_momento.casa} × ${ev.placar_neste_momento.vis} ${escHtml(tpEl._nomeVis)}</p>`
    : '';

  // Cor de destaque por tipo
  const corMap = {
    GOAL: isCasa ? '#003399' : '#dc2626',
    RED_CARD: '#dc2626', YELLOW_CARD: '#d97706',
    SUBSTITUTION: '#475569', IMPORTANT: '#1d4ed8',
  };
  const cor = corMap[ev.tipo] || '#475569';

  panel.style.display='block';
  panel.innerHTML=`
    <div class="htl-det-inner" style="border-left-color:${cor}">
      <div class="htl-det-topo">
        ${escudo ? `<img src="${escHtml(escudo)}" alt="" class="htl-det-escudo" onerror="this.style.display='none'">` : ''}
        <div class="htl-det-info">
          <strong>${escHtml(det.titulo)}</strong>
          ${det.sub ? `<span>${escHtml(det.sub)}</span>` : ''}
        </div>
        ${min ? `<span class="htl-det-min" style="color:${cor}">${min}</span>` : ''}
        <button class="htl-det-fechar" onclick="abrirDetalheTimeline(${idx})">✕</button>
      </div>
      ${descricaoExtra}
      ${placarGolHtml}
    </div>`;
}

// ============================================================
// RENDER — JOGADORES com nota 1-10 via slider
// ============================================================
function scrollToPosicao(pos) {
  const g=document.querySelector(`.grupo-pos[data-pos="${pos}"]`);
  if(g) $('carrossel-track')?.scrollTo({left:g.offsetLeft-20,behavior:'smooth'});
}

function atualizarSliderGradient(slider) {
  const val = +slider.value;
  const pct = (val/10)*100;
  slider.style.background=`linear-gradient(90deg, #003399 ${pct}%, #e2e8f0 ${pct}%)`;
}

function criarCardJogador(jogador) {
  const card=document.createElement('div'); card.className='jogador-card'; card.dataset.nome=jogador.nome;
  const notaId=`nota-display-${sanitizeId(jogador.nome)}`;

  card.innerHTML=`
    <div class="jogador-numero">${jogador.numero||'?'}</div>
    <div class="jogador-avatar">${
      jogador.foto
        ? `<img src="${escHtml(jogador.foto)}" alt="" onerror="this.parentNode.textContent='${(jogador.nome||'?').charAt(0).toUpperCase()}'" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : (jogador.nome||'?').charAt(0).toUpperCase()
    }</div>
    <div class="jogador-info-col">
      <div class="jogador-nome">${escHtml(jogador.nome)}</div>
      <div class="jogador-posicao-label">${escHtml(jogador.posicao)}</div>
    </div>
    <div class="nota-system">
      <div class="nota-stars nota-stars-main" id="nota-stars-${sanitizeId(jogador.nome)}">
        ${[1,2,3,4,5].map(n=>`<span class="nota-star nota-star-lg" data-n="${n}" title="${n*2}/10">★</span>`).join('')}
      </div>
      <div class="nota-badge-wrap">
        <span class="nota-badge sem-nota" id="${notaId}">—</span>
        <span class="nota-label" id="nota-lbl-${sanitizeId(jogador.nome)}"></span>
      </div>
    </div>
    <button class="obs-toggle"><i class="fas fa-comment" style="font-size:.6rem"></i> + obs</button>
    <div class="obs-mini"><textarea maxlength="100" placeholder="${escHtml(jogador.nome.split(' ')[0])}..." rows="2"></textarea></div>`;

  // ✅ Usa jaAvaliou() diretamente para não depender do estado global desatualizado
  const jaAvaliadoNestaPartida = jaAvaliou(state.partidaSelecionada?.id || '');
  if(jaAvaliadoNestaPartida){card.style.pointerEvents='none';card.style.opacity='0.7';return card;}

  const badgeEl   = card.querySelector('.nota-badge');
  const lblEl     = card.querySelector('.nota-label');
  const starsEl   = card.querySelector('.nota-stars-main');

  function setNota(val) {
    const n = +val;
    state.notas[jogador.nome] = {...(state.notas[jogador.nome]||{}), nota: n||undefined};

    if (!n) {
      badgeEl.textContent='—'; badgeEl.className='nota-badge sem-nota';
      lblEl.textContent=''; lblEl.className='nota-label';
      starsEl.querySelectorAll('.nota-star').forEach(s=>s.classList.remove('ativa'));
      card.classList.remove('avaliado'); return;
    }

    // Atualiza badge
    badgeEl.textContent=n; badgeEl.className='nota-badge changed';
    setTimeout(()=>badgeEl.classList.remove('changed'),250);

    // Atualiza label
    const {txt,cls}=getNotaLabel(n);
    lblEl.textContent=txt; lblEl.className=`nota-label ${cls}`;

    // Atualiza estrelas (1 estrela = 2 pontos)
    const estrelas = Math.ceil(n/2);
    starsEl.querySelectorAll('.nota-star').forEach(s=>{
      const sN=+s.dataset.n;
      s.classList.toggle('ativa', sN<=estrelas);
      if (sN===estrelas) { s.classList.add('lit'); setTimeout(()=>s.classList.remove('lit'),220); }
    });

    card.classList.add('avaliado');
  }

  // Estrelas clicáveis (1 estrela = 2 pontos)
  starsEl.querySelectorAll('.nota-star').forEach(star=>{
    star.addEventListener('click',()=>{
      const n = +star.dataset.n * 2; // 1★=2, 2★=4, 3★=6, 4★=8, 5★=10
      // Clique na mesma nota deseleciona
      const atual = state.notas[jogador.nome]?.nota;
      setNota(atual === n ? 0 : n);
    });
    star.addEventListener('mouseenter',()=>{
      const n=+star.dataset.n;
      starsEl.querySelectorAll('.nota-star').forEach(s=>s.style.color=+s.dataset.n<=n?'#ffd700':'');
    });
    star.addEventListener('mouseleave',()=>{
      starsEl.querySelectorAll('.nota-star').forEach(s=>s.style.color='');
    });
  });

  const tog=card.querySelector('.obs-toggle'), mini=card.querySelector('.obs-mini');
  if(tog&&mini){
    tog.addEventListener('click',e=>{e.stopPropagation();const ab=mini.classList.toggle('visible');tog.innerHTML=ab?'<i class="fas fa-comment" style="font-size:.6rem"></i> − obs':'<i class="fas fa-comment" style="font-size:.6rem"></i> + obs';});
    mini.querySelector('textarea')?.addEventListener('input',e=>{if(!state.notas[jogador.nome])state.notas[jogador.nome]={};state.notas[jogador.nome].obs=e.target.value;});
  }
  return card;
}

function renderJogadores(partida) {
  const track=$('carrossel-track'), navEl=$('posicoes-nav'); if(!track||!navEl) return;
  const posicoes={};
  (partida.jogadores||[]).forEach(j=>{const p=j.posicao||'Outros';if(!posicoes[p])posicoes[p]=[];posicoes[p].push(j);});
  const ORDEM=['Goleiro','Lateral','Zagueiro','Volante','Meio-Campo','Meia','Atacante','Outros'];
  const posOrd=Object.keys(posicoes).sort((a,b)=>{
    const ia=ORDEM.findIndex(o=>a.toLowerCase().includes(o.toLowerCase()));
    const ib=ORDEM.findIndex(o=>b.toLowerCase().includes(o.toLowerCase()));
    return (ia===-1?99:ia)-(ib===-1?99:ib);
  });
  // Adiciona botão "Todos" no início
  const todasPos = ['Todos', ...posOrd];
  navEl.innerHTML = todasPos.map(p =>
    `<button class="posicao-btn" data-pos="${escHtml(p)}">${escHtml(p)}</button>`
  ).join('');

  function filtrarPosicao(posAtiva) {
    navEl.querySelectorAll('.posicao-btn').forEach(b => b.classList.remove('active'));
    navEl.querySelector(`[data-pos="${CSS.escape(posAtiva)}"]`)?.classList.add('active');
    track.querySelectorAll('.grupo-pos').forEach(g => {
      if (posAtiva === 'Todos') {
        g.style.display = '';
      } else {
        g.style.display = g.dataset.pos === posAtiva ? '' : 'none';
      }
    });
    // No desktop, scroll para o grupo
    if (window.innerWidth > 768 && posAtiva !== 'Todos') {
      scrollToPosicao(posAtiva);
    }
  }

  navEl.querySelectorAll('.posicao-btn').forEach(btn => {
    btn.addEventListener('click', () => filtrarPosicao(btn.dataset.pos));
  });

  track.innerHTML='';
  posOrd.forEach(pos=>{
    const g=document.createElement('div'); g.className='grupo-pos'; g.dataset.pos=pos;
    g.style.cssText='display:flex;gap:12px;align-items:flex-start;flex-shrink:0;';
    const sep=document.createElement('div');
    sep.style.cssText=`writing-mode:vertical-rl;text-orientation:mixed;font-family:'Oswald',sans-serif;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;align-self:center;padding:8px 4px;border-left:2px solid #e2e8f0;min-height:80px;display:flex;align-items:center;`;
    sep.textContent=pos; g.appendChild(sep);
    posicoes[pos].forEach(j=>g.appendChild(criarCardJogador(j)));
    track.appendChild(g);
  });

  // Começa com "Todos" ativo
  filtrarPosicao('Todos');

  $('arrow-left')&&($('arrow-left').onclick=()=>track.scrollBy({left:-200,behavior:'smooth'}));
  $('arrow-right')&&($('arrow-right').onclick=()=>track.scrollBy({left:200,behavior:'smooth'}));
}

// ============================================================
// PAINÉIS LATERAIS FLUTUANTES — Stats (esquerda) / Escalação (direita)
// ============================================================
function toggleSidePanel(tipo) {
  const panelId   = tipo === 'stats' ? 'panel-stats' : 'panel-escalacao';
  const overlayId = tipo === 'stats' ? 'overlay-stats' : 'overlay-escalacao';
  const fabId     = tipo === 'stats' ? 'fab-stats' : 'fab-escalacao';
  const panel     = $(panelId);
  const overlay   = $(overlayId);
  const fab       = $(fabId);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  // Fecha o outro painel se aberto
  const outro = tipo === 'stats' ? 'escalacao' : 'stats';
  fecharSidePanel(outro);
  if (isOpen) {
    fecharSidePanel(tipo);
  } else {
    panel.classList.add('open');
    if (overlay) overlay.classList.add('active');
    if (fab) fab.classList.add('fab-active');
    document.body.classList.add('side-panel-open');
  }
}

function fecharSidePanel(tipo) {
  const panelId   = tipo === 'stats' ? 'panel-stats' : 'panel-escalacao';
  const overlayId = tipo === 'stats' ? 'overlay-stats' : 'overlay-escalacao';
  const fabId     = tipo === 'stats' ? 'fab-stats' : 'fab-escalacao';
  const panel     = $(panelId);
  const overlay   = $(overlayId);
  const fab       = $(fabId);
  if (panel)   panel.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  if (fab)     fab.classList.remove('fab-active');
  // Remove body lock apenas se nenhum painel estiver aberto
  if (!$('panel-stats')?.classList.contains('open') &&
      !$('panel-escalacao')?.classList.contains('open')) {
    document.body.classList.remove('side-panel-open');
  }
}

// ============================================================
// WIDGET DE CHAT FLUTUANTE
// ============================================================
function toggleChatWidget() {
  const widget  = $('chat-widget');
  const overlay = $('overlay-chat');
  const fab     = $('fab-chat');
  if (!widget) return;
  const isOpen = widget.classList.contains('open');
  if (isOpen) {
    fecharChatWidget();
  } else {
    widget.classList.add('open');
    if (overlay) overlay.classList.add('active');
    if (fab)     fab.classList.add('fab-active');
    renderChatWidget();
  }
}

function fecharChatWidget() {
  const widget  = $('chat-widget');
  const overlay = $('overlay-chat');
  const fab     = $('fab-chat');
  if (widget)  widget.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  if (fab)     fab.classList.remove('fab-active');
}

async function renderChatWidget() {
  const body     = $('chat-widget-body');
  const badgeEl  = $('chat-badge');
  if (!body) return;
  const partida = state.partidaSelecionada;
  if (!partida) {
    body.innerHTML = '<div class="sem-comentarios"><i class="fas fa-futbol"></i><p>Selecione uma partida primeiro.</p></div>';
    return;
  }
  body.innerHTML = '<div class="loading-av"><div class="spinner-av"></div><span>Carregando comentários...</span></div>';
  try {
    let avaliacoes = await buscarAvaliacoes(partida.id);
    const limite = Date.now() - (CONFIG_AV.ttlComentariosHoras * 3600000);
    avaliacoes = avaliacoes.filter(a => a.ts > limite);
    const comentarios = avaliacoes.filter(a => a.obs?.trim()).sort((a,b) => b.ts - a.ts);
    if (badgeEl) badgeEl.textContent = comentarios.length;
    if (!comentarios.length) {
      body.innerHTML = '<div class="sem-comentarios"><i class="fas fa-comment-slash"></i><p>Nenhum comentário ainda. Seja o primeiro!</p></div>';
      return;
    }
    const avatarColors = ['#003399','#1a4db8','#e74c3c','#27ae60','#f39c12','#8e44ad','#16a085'];
    body.innerHTML = comentarios.map(av => {
      const data  = new Date(av.ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      const cidx  = av.nick.charCodeAt(0) % avatarColors.length;
      const ntChip = av.nota_time
        ? `<span class="nota-chip nota-chip-time" style="margin-right:4px"><i class="fas fa-shield-alt"></i> Time ${av.nota_time}/10</span>`
        : '';
      return `<div class="chat-comentario">
        <div class="chat-avatar" style="background:${avatarColors[cidx]}">${av.nick.charAt(0).toUpperCase()}</div>
        <div class="chat-balao">
          <div class="chat-nick">${escHtml(av.nick)} <span class="chat-data">${data}</span></div>
          <p class="chat-texto">${escHtml(av.obs)}</p>
          ${ntChip ? `<div style="margin-top:4px">${ntChip}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    body.innerHTML = '<div class="sem-comentarios"><i class="fas fa-exclamation-circle"></i><p>Erro ao carregar.</p></div>';
  }
}

// ============================================================
// NOTA DO TIME — estrelas interativas
// ============================================================
function initNotaTimeStars() {
  const wrap    = document.getElementById('nota-time-stars');
  const valorEl = document.getElementById('nota-time-valor');
  const lblEl   = document.getElementById('nota-time-lbl');
  if (!wrap || !valorEl || !lblEl) return;

  state.nota_time = 0;
  valorEl.textContent = '—';
  valorEl.className   = 'nota-time-valor';
  lblEl.textContent   = '/10 · Clique para avaliar';
  wrap.querySelectorAll('.nt-star').forEach(s => { s.classList.remove('ativa','semi'); });

  // ✅ Usa jaAvaliou() diretamente para garantir estado correto ao trocar de partida
  const jaAvaliadoAqui = jaAvaliou(state.partidaSelecionada?.id || '');
  if (jaAvaliadoAqui) {
    wrap.style.pointerEvents = 'none';
    wrap.style.opacity = '0.6';
    return;
  }
  wrap.style.pointerEvents = '';
  wrap.style.opacity = '';

  function updateDisplay(n) {
    if (!n) { valorEl.textContent='—'; valorEl.className='nota-time-valor'; lblEl.textContent='/10 · Clique para avaliar'; return; }
    const { txt, cls } = getNotaLabel(n);
    valorEl.textContent = n;
    valorEl.className   = `nota-time-valor ntv-${cls}`;
    lblEl.textContent   = `/10 · ${txt}`;
  }

  function highlight(upTo) {
    wrap.querySelectorAll('.nt-star').forEach(s => {
      s.classList.toggle('hover', +s.dataset.n <= upTo);
    });
  }

  wrap.querySelectorAll('.nt-star').forEach(star => {
    star.addEventListener('click', () => {
      const n = +star.dataset.n * 2;
      state.nota_time = state.nota_time === n ? 0 : n;
      wrap.querySelectorAll('.nt-star').forEach(s => {
        s.classList.toggle('ativa', +s.dataset.n <= (state.nota_time / 2));
      });
      updateDisplay(state.nota_time);
      // micro-animação
      star.classList.add('pop'); setTimeout(() => star.classList.remove('pop'), 220);
    });
    star.addEventListener('mouseenter', () => highlight(+star.dataset.n));
    star.addEventListener('mouseleave', () => highlight(state.nota_time / 2));
  });
}

// ============================================================
// TOGGLE da seção "Avaliar Partida"
// ============================================================
function initToggleJogadores() {
  const section = document.querySelector('.jogadores-section');
  const toggle  = document.querySelector('.jogadores-section-toggle');
  if (!section || !toggle) return;

  toggle.addEventListener('click', ()=>{
    const collapsed = section.classList.toggle('collapsed');
    const chevron = toggle.querySelector('.toggle-chevron');
    if (chevron) chevron.innerHTML = collapsed
      ? '<i class="fas fa-chevron-right"></i>'
      : '<i class="fas fa-chevron-down"></i>';
  });
}

// ============================================================
// ENVIO
// ============================================================
async function enviarAvaliacao() {
  const partida=state.partidaSelecionada;
  if(!partida){showToast('Selecione uma partida primeiro!','error');return;}
  if(jaAvaliou(partida.id)){showToast('Você já avaliou esta partida!','info');return;}
  const totalNotados=Object.values(state.notas).filter(n=>n?.nota).length;
  const minimo=Math.ceil((partida.jogadores||[]).length/2);
  if(totalNotados<minimo){showToast(`Avalie pelo menos ${minimo} jogadores!`,'error');return;}
  if(!state.nota_time){showToast('Dê uma nota para a performance do time!','error');const w=document.getElementById('nota-time-wrap');if(w){w.classList.add('nota-time-shake');setTimeout(()=>w.classList.remove('nota-time-shake'),600);}return;}

  const nomeInput=$('comentario-nome-input');
  const nomeDigitado=nomeInput?.value?.trim()||getNome()||'Torcedor Anônimo';
  const btn=$('btn-submit');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Enviando...';}

  try {
    let obsRaw=$('observacao-geral-input')?.value?.trim()||'';
    let nomeUsado=nomeDigitado;
    if(bloqueado(nomeUsado)) nomeUsado='Torcedor';
    salvarNome(nomeUsado);
    if(bloqueado(obsRaw)){
      showToast('Seu comentário contém linguagem inadequada.','error');
      if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> Enviar Avaliação';}
      return;
    }
    const obs=temPalavraoSuave(obsRaw)?censurar(obsRaw):obsRaw;
    if(obs!==obsRaw&&obs) showToast('Algumas palavras foram censuradas automaticamente.','info');

    const avaliacao={
      id:`av_${partida.id}_${Date.now()}`, nick:nomeUsado, ts:Date.now(), obs,
      notas:state.notas, nota_time: state.nota_time,
      reacoes:{'👍':0,'❤️':0,'🔥':0,'😂':0,'😡':0},
    };

    const remoto=await salvarAvaliacao(partida.id,avaliacao);
    marcarAval(partida.id); state.avaliacaoEnviada=true;
    showToast(remoto?'⭐ Avaliação enviada para toda a torcida!':'⭐ Avaliação salva (modo offline)!','success');
    $('ja-avaliou-msg')&&($('ja-avaliou-msg').style.display='flex');
    $('submit-area')&&($('submit-area').style.display='none');
    $('observacao-geral-container')&&($('observacao-geral-container').style.display='none');
    document.querySelectorAll('.jogador-card').forEach(c=>{c.style.pointerEvents='none';c.style.opacity='0.75';});
    await carregarComunidade(partida.id);
    renderPartidas(state.partidas);
  } catch(e) {
    console.error('[AV] Erro envio:',e);
    showToast('Erro ao enviar. Tente novamente!','error');
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> Enviar Avaliação';}
  }
}

// ============================================================
// COMUNIDADE — compacta com accordion
// ============================================================
async function carregarComunidade(partidaId) {
  const badgeEl=$('total-avaliacoes-badge'), mediasGrid=$('medias-grid');
  const comentariosEl=document.querySelector('.comentarios-lista');
  if(!comentariosEl||!badgeEl||!mediasGrid) return;

  comentariosEl.innerHTML=`<div class="loading-av"><div class="spinner-av"></div><span>Carregando...</span></div>`;

  try {
    let avaliacoes=await buscarAvaliacoes(partidaId);
    const limite=Date.now()-(CONFIG_AV.ttlComentariosHoras*3600000);
    avaliacoes=avaliacoes.filter(a=>a.ts>limite);
    badgeEl.textContent=`${avaliacoes.length} avaliação${avaliacoes.length!==1?'ões':''}`;

    // Média da nota_time da torcida
    const notasTime = avaliacoes.map(a => a.nota_time).filter(n => n > 0);
    const ntcEl = document.getElementById('nota-time-comunidade');
    const ntcValor = document.getElementById('ntc-valor');
    const ntcEst = document.getElementById('ntc-estrelas');
    const ntcVotos = document.getElementById('ntc-votos');
    if (ntcEl && ntcValor && ntcEst && ntcVotos) {
      if (notasTime.length) {
        const media = notasTime.reduce((a,b)=>a+b,0) / notasTime.length;
        const cls = getClassificacao(media * 2);
        ntcValor.textContent = media.toFixed(1);
        ntcValor.className = `ntc-valor ntv-${getNotaLabel(media).cls}`;
        ntcEst.innerHTML = [1,2,3,4,5].map(i=>i<=Math.round(media/2)?'<span class="ntc-star ativa">★</span>':'<span class="ntc-star">★</span>').join('');
        ntcVotos.textContent = `${notasTime.length} voto${notasTime.length!==1?'s':''}`;
        ntcEl.style.display = 'flex';
      } else {
        ntcEl.style.display = 'none';
      }
    }
    const jogadores=state.partidaSelecionada?.jogadores||[];
    if(!avaliacoes.length){
      mediasGrid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:12px;font-size:.82rem;">Seja o primeiro a avaliar!</div>';
    } else {
      mediasGrid.innerHTML=jogadores.map(j=>{
        const notas=avaliacoes.map(a=>a.notas?.[j.nome]?.nota).filter(n=>n>0);
        if(!notas.length) return `<div class="media-item"><div class="media-nome">${escHtml(j.nome.split(' ').slice(0,2).join(' '))}</div><div class="media-nota" style="color:#94a3b8">—</div><div class="media-votos">sem votos</div></div>`;
        const media=notas.reduce((a,b)=>a+b,0)/notas.length;
        return `<div class="media-item"><div class="media-nome">${escHtml(j.nome.split(' ').slice(0,2).join(' '))}</div><div class="media-nota">${media.toFixed(1)}</div><div class="media-estrelas">${estrelasHtml(Math.round(media/2))}</div><div class="media-votos">${notas.length} voto${notas.length!==1?'s':''}</div></div>`;
      }).join('');
    }

    const comentarios=avaliacoes.filter(a=>a.obs?.trim());
    if(!comentarios.length){
      comentariosEl.innerHTML='<div class="sem-comentarios"><i class="fas fa-comment-slash"></i><p>Nenhum comentário ainda. Seja o primeiro!</p></div>';
      return;
    }

    const avatarColors=['#003399','#1a4db8','#e74c3c','#27ae60','#f39c12','#8e44ad','#16a085'];
    comentariosEl.innerHTML=comentarios.sort((a,b)=>b.ts-a.ts).map(av=>{
      const data=new Date(av.ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      const top=Object.entries(av.notas||{}).filter(([,v])=>v?.nota).sort(([,a],[,b])=>b.nota-a.nota).slice(0,3);
      const chips=top.map(([n,v])=>`<span class="nota-chip"><span class="estrela-chip">★</span> ${escHtml(n.split(' ')[0])} ${v.nota}/10</span>`).join('');
      const notaTimeChip = av.nota_time
        ? `<span class="nota-chip nota-chip-time"><i class="fas fa-shield-alt"></i> Time ${av.nota_time}/10</span>`
        : '';
      const reacoes=av.reacoes||{'👍':0,'❤️':0,'🔥':0,'😂':0,'😡':0};
      const minhaReacao=getReacao(av.id);
      const reacoesHtml=REACOES.map((r,ri)=>{
        const cnt=reacoes[r.emoji]||0;
        const ativa=minhaReacao===r.emoji?'ativa':'';
        return `<button class="reacao-btn ${ativa}" data-avid="${escHtml(av.id)}" data-emoji="${escHtml(r.emoji)}" data-ri="${ri}" data-pid="${escHtml(partidaId)}" title="${escHtml(r.label)}">
          ${r.emoji}<span class="reacao-count" id="rc-${sanitizeId(av.id)}-${ri}">${cnt||''}</span></button>`;
      }).join('');
      const colorIdx=av.nick.charCodeAt(0)%avatarColors.length;
      return `<div class="comentario-card">
        <div class="comentario-header">
          <div class="comentario-user">
            <div class="comentario-avatar" style="background:${avatarColors[colorIdx]}">${av.nick.charAt(0).toUpperCase()}</div>
            <div class="comentario-user-info"><span class="comentario-nome">${escHtml(av.nick)}</span><span class="comentario-data">${data}</span></div>
          </div>
        </div>
        ${av.obs?`<p class="comentario-texto">${escHtml(av.obs)}</p>`:''}
        ${(notaTimeChip||chips)?`<div class="comentario-notas">${notaTimeChip}${chips}</div>`:''}
        <div class="comentario-reacoes">${reacoesHtml}</div>
      </div>`;
    }).join('');

    comentariosEl.querySelectorAll('.reacao-btn').forEach(btn=>btn.addEventListener('click',()=>reagirComentario(btn)));
  } catch(e){
    console.error('[AV] Erro comunidade:',e);
    comentariosEl.innerHTML='<div class="sem-comentarios"><i class="fas fa-exclamation-circle"></i><p>Erro ao carregar.</p></div>';
  }
}

async function reagirComentario(btn) {
  const avId=btn.dataset.avid, emoji=btn.dataset.emoji, pid=btn.dataset.pid;
  if(!avId||!emoji||!pid) return;
  const getCountSpan = (id, em) => {
    const ri = REACOES.findIndex(r=>r.emoji===em);
    return ri>=0 ? document.getElementById(`rc-${sanitizeId(id)}-${ri}`) : null;
  };
  const anterior=getReacao(avId);
  if(anterior===emoji){
    removerRea(avId); btn.classList.remove('ativa');
    const c=getCountSpan(avId,emoji);
    if(c){const n=Math.max(0,(parseInt(c.textContent)||1)-1);c.textContent=n||'';}
    await salvarReacao(pid,avId,null);
  } else {
    if(anterior){
      const pb=document.querySelector(`.reacao-btn[data-avid="${avId}"][data-emoji="${anterior}"]`);
      if(pb){ pb.classList.remove('ativa'); const pc=getCountSpan(avId,anterior); if(pc){const n=Math.max(0,(parseInt(pc.textContent)||1)-1);pc.textContent=n||'';} }
    }
    salvarRea(avId,emoji); btn.classList.add('ativa');
    const c=getCountSpan(avId,emoji);
    if(c){c.textContent=(parseInt(c.textContent)||0)+1;}
    btn.style.transform='scale(1.3)'; setTimeout(()=>btn.style.transform='',180);
    await salvarReacao(pid,avId,emoji);
  }
}

// ============================================================
// SELEÇÃO DE PARTIDA
// ============================================================
async function selecionarPartida(id) {
  const partida=state.partidas.find(p=>p.id===id); if(!partida) return;
  // ✅ Sempre relê o localStorage ao trocar de partida — garante estado limpo
  state.partidaSelecionada=partida; state.notas={}; state.nota_time=0;
  state.avaliacaoEnviada = jaAvaliou(id);  // relê do localStorage, não confia no estado global
  const av=$('avaliacao-section');
  if(av){av.style.display='block';setTimeout(()=>av.scrollIntoView({behavior:'smooth',block:'start'}),100);}
  // Remove placar-card duplicado (já mostrado nas tabs)
  const pc=$('placar-card'); if(pc) pc.style.display='none';
  // Atualiza visual de todos os cards
  document.querySelectorAll('.partida-card').forEach(c => {
    const isThis = c.dataset.id === id;
    c.classList.toggle('selected', isThis);
    c.querySelector('.partida-card-chevron')?.classList.toggle('rotated', isThis);
    if (isThis) {
      const footer = document.getElementById('btn-card-' + id);
      if (footer) {
        const jAval = jaAvaliou(id);
        footer.innerHTML = `<i class="fas ${jAval ? 'fa-check-circle' : 'fa-star'}"></i><span>${jAval ? 'Ver Avaliações' : 'Fechar'}</span><i class="fas fa-chevron-up partida-card-chevron rotated"></i>`;
      }
    }
  });
  // Mostra FABs
  const fab = $('fab-bar'); if (fab) fab.style.display = 'flex';
  // Bind FABs (apenas uma vez)
  const fabStats = $('fab-stats');
  const fabEsc   = $('fab-escalacao');
  const fabChat  = $('fab-chat');
  if (fabStats && !fabStats._bound) { fabStats._bound=true; fabStats.addEventListener('click', () => toggleSidePanel('stats')); }
  if (fabEsc   && !fabEsc._bound)   { fabEsc._bound=true;   fabEsc.addEventListener('click',   () => toggleSidePanel('escalacao')); }
  if (fabChat  && !fabChat._bound)  { fabChat._bound=true;  fabChat.addEventListener('click',  () => toggleChatWidget()); }
  // Botão de pontuação no FAB (mobile)
  initFabPontuacao();
  // Reset nota_time UI
  initNotaTimeStars();
  renderPlacarInterno(partida);
  renderPontuacaoPanel(partida);
  renderHorizontalTimeline(partida);
  renderEstatisticas(partida);
  renderEscalacao(partida);
  renderJogadores(partida);

  // Garante que o toggle esteja inicializado e expandido
  const section = document.querySelector('.jogadores-section');
  if (section) {
    section.classList.remove('collapsed');
    const chevron = section.querySelector('.toggle-chevron');
    if (chevron) chevron.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
  initToggleJogadores();

  // Botão Esconder partida
  iniciarBotaoEsconder(id);

  // Accordion de médias — inicializa
  const accToggle = document.querySelector('.medias-accordion-toggle');
  if (accToggle && !accToggle._initialized) {
    accToggle._initialized = true;
    const body = document.querySelector('.medias-accordion-body');
    accToggle.addEventListener('click', ()=>{
      const open = body.classList.toggle('open');
      accToggle.classList.toggle('open', open);
    });
  }

  // Toggle comunidade section
  const comToggle = document.getElementById('comunidade-toggle-btn');
  const comBody   = document.getElementById('comunidade-body');
  if (comToggle && comBody && !comToggle._initialized) {
    comToggle._initialized = true;
    comToggle.addEventListener('click', () => {
      const col = comBody.classList.toggle('com-collapsed');
      const icon = comToggle.querySelector('.com-toggle-chevron i');
      if (icon) icon.className = col ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      comToggle.setAttribute('aria-expanded', !col);
    });
  }

  $('ja-avaliou-msg')&&($('ja-avaliou-msg').style.display=state.avaliacaoEnviada?'flex':'none');
  $('submit-area')&&($('submit-area').style.display=state.avaliacaoEnviada?'none':'block');
  $('observacao-geral-container')&&($('observacao-geral-container').style.display=state.avaliacaoEnviada?'none':'block');
  const ni=$('comentario-nome-input'); if(ni&&getNome()) ni.value=getNome();
  await carregarComunidade(id);
}

// ============================================================
// BOTÃO ESCONDER PARTIDA
// ============================================================
const OCULTAS_KEY = 'cabuloso_partidas_ocultas';
function getOcultas()  { try { return JSON.parse(localStorage.getItem(OCULTAS_KEY)||'[]'); } catch { return []; } }
function setOcultas(arr) { localStorage.setItem(OCULTAS_KEY, JSON.stringify(arr)); }
function isOculta(id) { return getOcultas().includes(id); }

function iniciarBotaoEsconder(id) {
  // Inicializa toggle do header "Dados da Partida"
  const dadosToggle = document.getElementById('dados-header-toggle');
  const dadosBody   = document.getElementById('dados-body');
  if (dadosToggle && dadosBody && !dadosToggle._initialized) {
    dadosToggle._initialized = true;
    dadosToggle.addEventListener('click', e => {
      if (e.target.closest('#btn-esconder-partida')) return;
      const col = dadosBody.classList.toggle('collapsed');
      dadosToggle.setAttribute('aria-expanded', !col);
    });
  }

  let btn = $('btn-esconder-partida');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-esconder-partida';
    btn.className = 'btn-esconder-partida';
    const av = $('avaliacao-section');
    if (av) av.insertAdjacentElement('afterbegin', btn);
  }
  const oculta = isOculta(id);
  btn.innerHTML = oculta
    ? '<i class="fas fa-eye"></i> Mostrar dados'
    : '<i class="fas fa-eye-slash"></i> Esconder esta partida';
  btn.onclick = () => toggleOcultarPartida(id, btn);
  aplicarEstadoOculto(id);
}

function toggleOcultarPartida(id, btn) {
  const arr = getOcultas();
  const idx = arr.indexOf(id);
  if (idx>=0) arr.splice(idx,1);
  else arr.push(id);
  setOcultas(arr);
  const oculta = arr.includes(id);
  btn.innerHTML = oculta
    ? '<i class="fas fa-eye"></i> Mostrar dados'
    : '<i class="fas fa-eye-slash"></i> Esconder esta partida';
  aplicarEstadoOculto(id);
}

function aplicarEstadoOculto(id) {
  const oculta = isOculta(id);
  const els = ['timeline-panel','jogadores-section','comunidade-section','ja-avaliou-msg'];
  els.forEach(elId=>{
    const el=$( elId); if(!el) return;
    // Não esconde ja-avaliou se houver mensagem de confirmação
    if (elId==='ja-avaliou-msg' && el.style.display==='none') return;
    if (oculta) el.dataset.escondido='1', el.style.opacity='0.15', el.style.pointerEvents='none';
    else delete el.dataset.escondido, el.style.opacity='', el.style.pointerEvents='';
  });
  // Submit area separado
  const sa=$('submit-area');
  if(sa&&!state.avaliacaoEnviada){
    if(oculta) sa.style.display='none';
    else sa.style.display='block';
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

// Função utilitária para o admin resetar a partida via console ou botão externo
// Uso: resetarPartidaKV('cabuloso2026')
window.resetarPartidaKV = async function(adminKey) {
  if (!adminKey) { console.error('[RESET] Informe a chave admin'); return; }
  try {
    const res = await fetch(
      'https://cabuloso-api.cabulosonews92.workers.dev/?type=reset-partida',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({}),
      }
    );
    const data = await res.json();
    console.log('[RESET] Resposta:', data);
    if (data.ok) {
      showToast('✅ KV resetado! Recarregando partidas...', 'success');
      // Força recarregamento imediato
      setTimeout(async () => {
        state.partidas = await carregarDadosAvaliacao();
        _pollingIdsAnterior = getIdsSnapshot(state.partidas);
        renderPartidas(state.partidas);
        if (state.partidas.length === 1) await selecionarPartida(state.partidas[0].id);
      }, 800);
    }
  } catch (e) {
    console.error('[RESET] Erro:', e);
  }
};

document.addEventListener('DOMContentLoaded',async()=>{
  const mt=$('menuToggle'),nm=$('nav-menu');
  if(mt&&nm) mt.addEventListener('click',()=>{mt.classList.toggle('active');nm.classList.toggle('active');mt.setAttribute('aria-expanded',nm.classList.contains('active'));});
  $('btn-submit')?.addEventListener('click',enviarAvaliacao);
  const ta=$('observacao-geral-input'),ct=$('char-count');
  if(ta&&ct) ta.addEventListener('input',()=>ct.textContent=ta.value.length);
  state.partidas=await carregarDadosAvaliacao();
  _pollingIdsAnterior = getIdsSnapshot(state.partidas); // salva snapshot inicial
  renderPartidas(state.partidas);
  if(state.partidas.length===1) await selecionarPartida(state.partidas[0].id);
  iniciarPolling(); // inicia verificação automática de mudanças
});
// ============================================================
// FAB PONTUAÇÃO — botão mobile + modal bottom sheet
// ============================================================
function initFabPontuacao() {
  const fabBar = $('fab-bar');
  if (!fabBar) return;

  // Só injetar em mobile
  if (window.innerWidth > 768) return;

  // Cria o botão se ainda não existir
  let fabPts = document.getElementById('fab-pontuacao');
  if (!fabPts) {
    fabPts = document.createElement('button');
    fabPts.id = 'fab-pontuacao';
    fabPts.className = 'fab-btn';
    fabPts.style.background = 'linear-gradient(135deg, #ffd700, #f59e0b)';
    fabPts.style.color = '#001533';
    fabPts.setAttribute('aria-label', 'Pontuação da partida');
    fabPts.innerHTML = '<i class="fas fa-star-half-alt"></i><span>Pontuação</span>';
    fabBar.insertBefore(fabPts, fabBar.firstChild);
  }

  if (!fabPts._bound) {
    fabPts._bound = true;
    fabPts.addEventListener('click', abrirModalPontuacao);
  }

  // Cria o modal se ainda não existir
  if (!document.getElementById('pontuacao-modal-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'pontuacao-modal-overlay';
    overlay.className = 'pontuacao-modal-overlay';
    overlay.innerHTML = `
      <div class="pontuacao-modal" id="pontuacao-modal">
        <div class="pontuacao-modal-header">
          <span class="pontuacao-modal-titulo"><i class="fas fa-star-half-alt"></i> Pontuação da Partida</span>
          <button class="pontuacao-modal-close" id="pontuacao-modal-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="pontuacao-modal-total-row">
          <span class="pontuacao-modal-num" id="pm-total">—</span>
          <div class="pontuacao-modal-info">
            <span class="pontuacao-modal-badge" id="pm-badge">—</span>
            <span class="pontuacao-modal-lbl">pontos totais</span>
          </div>
        </div>
        <div class="pontuacao-modal-items" id="pm-items"></div>
        <div class="pontuacao-modal-regra">
          <i class="fas fa-info-circle"></i>
          ⚽ <b>+10</b> por gol &nbsp;·&nbsp; 🛡️ <b>−5</b> gol sofrido &nbsp;·&nbsp; 🟨 <b>−1</b> amarelo &nbsp;·&nbsp; 🟥 <b>−3</b> vermelho
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fecharModalPontuacao();
    });
    document.getElementById('pontuacao-modal-close')
      .addEventListener('click', fecharModalPontuacao);
  }
}

function abrirModalPontuacao() {
  const pmTotal = document.getElementById('pm-total');
  const pmBadge = document.getElementById('pm-badge');
  const pmItems = document.getElementById('pm-items');
  if (!pmTotal || !pmItems) return;

  // Recalcula direto do state — não depende do widget oculto
  const partida = state.partidaSelecionada;
  const todos   = partida?.eventos_timeline || [];

  const golsCru = todos.filter(e => e.is_cruzeiro && e.tipo === 'GOAL').length;
  const golsSof = todos.filter(e => !e.is_cruzeiro && e.tipo === 'GOAL').length;
  const amCru   = todos.filter(e => e.is_cruzeiro && e.tipo === 'YELLOW_CARD').length;
  const vmCru   = todos.filter(e => e.is_cruzeiro && e.tipo === 'RED_CARD').length;
  const impCru  = todos.filter(e => e.is_cruzeiro && e.tipo === 'IMPORTANT').length;

  const ptGols = golsCru * 10;
  const ptSof  = golsSof * -5;
  const ptAm   = amCru   * -1;
  const ptVm   = vmCru   * -3;
  const ptImp  = impCru  *  1;
  const total  = ptGols + ptSof + ptAm + ptVm + ptImp;

  const cls   = getClassificacao(total);
  const sinal = total >= 0 ? '+' : '';

  // Total
  pmTotal.textContent = `${sinal}${total}`;
  pmTotal.style.color = total >= 0 ? '#ffd700' : '#f87171';

  // Badge
  pmBadge.textContent = cls.texto;
  pmBadge.className   = `pontuacao-modal-badge ${cls.cls}`;

  // Itens
  function item(icone, label, pts, mostrar) {
    if (!mostrar) return '';
    const s = pts >= 0 ? '+' : '';
    const c = pts >= 0 ? '#86efac' : '#fca5a5';
    return `<div class="pontuacao-modal-item">
      <span class="pontuacao-modal-item-icone">${icone}</span>
      <span class="pontuacao-modal-item-label">${label}</span>
      <span class="pontuacao-modal-item-valor" style="color:${c}">${s}${pts}</span>
    </div>`;
  }

  const linhas = [
    item('⚽', `${golsCru} gol${golsCru !== 1 ? 's' : ''} marcado${golsCru !== 1 ? 's' : ''}`, ptGols, golsCru > 0),
    item('🛡️', `${golsSof} gol${golsSof !== 1 ? 's' : ''} sofrido${golsSof !== 1 ? 's' : ''}`, ptSof,  golsSof > 0),
    item('🟨', `${amCru} cartão${amCru !== 1 ? 'ões' : ''} amarelo${amCru !== 1 ? 's' : ''}`,  ptAm,   amCru > 0),
    item('🟥', `${vmCru} cartão${vmCru !== 1 ? 'ões' : ''} vermelho${vmCru !== 1 ? 's' : ''}`, ptVm,   vmCru > 0),
    item('🔹', `${impCru} lance${impCru !== 1 ? 's' : ''} importante${impCru !== 1 ? 's' : ''}`, ptImp, impCru > 0),
  ].filter(Boolean).join('');

  pmItems.innerHTML = linhas ||
    '<div style="color:rgba(255,255,255,.5);font-size:.85rem;padding:8px 0">Sem eventos registrados ainda</div>';

  const overlay = document.getElementById('pontuacao-modal-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharModalPontuacao() {
  const overlay = document.getElementById('pontuacao-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}