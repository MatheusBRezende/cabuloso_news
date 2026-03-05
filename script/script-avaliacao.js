/**
 * script-avaliacao.js — CABULOSO NEWS v4
 * Melhorias: timeline com time identificado, toggle do painel,
 * sistema de nota individual melhorado, comunidade compacta
 * ✅ CORRIGIDO: estatísticas do boxscore ESPN, fotos, alinhamento casa/visitante
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
    if (snapshot === _pollingIdsAnterior) return;

    console.log('[POLLING] Mudança detectada! Atualizando partidas...');
    _pollingIdsAnterior = snapshot;
    state.partidas = novas;
    renderPartidas(novas);

    if (novas.length === 1 && !state.partidaSelecionada) {
      await selecionarPartida(novas[0].id);
    }

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
  // ✅ FIX v5.9: isReserva=true → posicao_raw "SUB" vira "Reserva" em vez de herdar "MEC" errado
  const p = (arr, isReserva = false) => (arr || []).forEach(item => {
    if (!item) return;
    if (typeof item === 'object') {
      const posRaw = (item.posicao_raw || '').toUpperCase();
      const posicao = (isReserva && posRaw === 'SUB')
        ? 'Reserva'
        : converterPosicao(item.posicao || item.position || '');
      list.push({
        numero:  item.numero  || item.num || '?',
        nome:    item.nome    || item.name || '?',
        posicao,
        // ✅ foto: lê campo foto do parser ESPN (headshot URL)
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
        posicao: isReserva ? 'Reserva' : converterPosicao(x[1]?.trim()),
        foto:    null, slug: null,
      });
    }
  });
  p(esc?.titulares, false);
  p(esc?.reservas, true);
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

  function getLado(ev) {
    if (ev.lado) return ev.lado;
    if (!ev.time || ev.time==='neutro') return 'neutro';
    return norm(ev.time)===normCru ? 'cruzeiro' : 'adversario';
  }

  function getTexto(ev) {
    return (ev.narracao||'').trim() || (ev.titulo||'').trim();
  }

  for (const ev of timeline) {
    if (ev.tipo==='SUMMARY_AUTOMATIC'||ev.tipo==='STANDOUT_PLAYER') continue;
    const ordem=getPeriodOrder(ev.minuto);
    if (ordem===0||ordem===4) continue;
    if (ev.tipo==='NORMAL') {
      const n = getTexto(ev).toLowerCase();
      if (!n||BORING.some(b=>n.startsWith(b))) continue;
    }
    const textoEv = getTexto(ev);
    const key=`${ev.minuto}|${ev.tipo}|${textoEv.substring(0,40)}`;
    if (seen.has(key)) continue; seen.add(key);

    const lado = getLado(ev);
    const isCruzeiro = lado==='cruzeiro';

    let jogador='',jogador_entra='',label='';
    if (ev.tipo==='GOAL') {
      jogador = ev.jogador || '';
      if (!jogador) {
        const m=textoEv.match(/⚽\s*([A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+)*)/);
        jogador=m?m[1].trim():'';
      }
      label=isCruzeiro?`⚽ GOL DO ${(nomeCruzeiro||'CRUZEIRO').toUpperCase()}!`:'⚽ Gol do adversário';
    } else if (ev.tipo==='YELLOW_CARD'||ev.tipo==='RED_CARD') {
      jogador = ev.jogador || '';
      if (!jogador) {
        const m=textoEv.match(/(?:para|de)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõü]+)*)/i);
        jogador=m?m[1].trim():'';
      }
      label=ev.titulo||(ev.tipo==='RED_CARD'?'Vermelho!':'Cartão Amarelo');
    } else if (ev.tipo==='SUBSTITUTION') {
      if (ev.jogador && ev.jogador.includes('➔')) {
        const partes = ev.jogador.split('➔');
        jogador = partes[0].trim();
        jogador_entra = partes[1]?.trim();
      } else {
        const sai=textoEv.match(/sai\s+([^,]+),/i);
        const entra=textoEv.match(/entra\s+(.+?)(?:\.|$)/i);
        const sub=textoEv.match(/([A-ZÁÉÍÓÚ][a-záéíóú]+(?: [A-ZÁÉÍÓÚ][a-záéíóú]+)*)\s+substitui\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?: [A-ZÁÉÍÓÚ][a-záéíóú]+)*)/i);
        if (sai&&entra){jogador=sai[1].trim();jogador_entra=entra[1].replace(/\.\s*aos.*$/,'').trim();}
        else if (sub){jogador_entra=sub[1].trim();jogador=sub[2].trim();}
        else if (ev.jogador){jogador=ev.jogador;}
      }
      label = ev.titulo || 'Substituição';
    } else if (ev.tipo==='IMPORTANT') {
      const titulo=(ev.titulo||'').replace(/^[🔹▶️◽⚽🟨🟥🔄]\s*/u,'').trim();
      label=titulo&&titulo.length>3?titulo:(limpar(textoEv)||'Lance Importante');
    } else {
      label = ev.titulo || limpar(ev.narracao) || 'Lance';
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
    const tcasa = jogo.times.casa;
    const tvis  = jogo.times.visitante;
    if (ehCruzeiro(tcasa)) return { cru: tcasa, adv: tvis, cruEhCasa: true  };
    if (ehCruzeiro(tvis))  return { cru: tvis,  adv: tcasa, cruEhCasa: false };
    return { cru: tcasa, adv: tvis, cruEhCasa: true };
  }

  if (jogo.times?.cruzeiro || jogo.times?.adversario) {
    return { cru: jogo.times.cruzeiro, adv: jogo.times.adversario, cruEhCasa: true };
  }

  return { cru: null, adv: null, cruEhCasa: true };
}

// ============================================================
// CARREGAR DADOS — suporte multi-partida
// ============================================================
function normalizarJogo(jogo, idx) {
  if (!jogo?.partida) return null;

  const { cru, adv, cruEhCasa } = identificarCruzeiro(jogo);

  const nomeCru  = cru?.nome   || jogo.partida?.time_visitante || 'Cruzeiro';
  const nomeAdv  = adv?.nome   || jogo.partida?.time_casa      || 'Adversário';
  const escCru   = cru?.escudo || cru?.escudos?.png || CONFIG_AV.defaultEscudo;
  const escAdv   = adv?.escudo || adv?.escudos?.png || CONFIG_AV.defaultEscudo;

  let golsCru, golsAdv;
  if (jogo.times?.casa || jogo.times?.visitante) {
    golsCru = cruEhCasa ? (jogo.placar?.casa ?? 0) : (jogo.placar?.visitante ?? 0);
    golsAdv = cruEhCasa ? (jogo.placar?.visitante ?? 0) : (jogo.placar?.casa ?? 0);
  } else {
    golsCru = jogo.placar?.cruzeiro  ?? 0;
    golsAdv = jogo.placar?.adversario ?? 0;
  }

  let escalacaoCru, statCru, statAdv;
  if (jogo.times?.casa || jogo.times?.visitante) {
    escalacaoCru = cruEhCasa ? jogo.escalacoes?.casa      : jogo.escalacoes?.visitante;
    // ✅ CORREÇÃO: estatisticas agora indexadas por casa/visitante (vindas do ESPN boxscore)
    statCru      = cruEhCasa ? jogo.estatisticas?.casa     : jogo.estatisticas?.visitante;
    statAdv      = cruEhCasa ? jogo.estatisticas?.visitante: jogo.estatisticas?.casa;
  } else {
    escalacaoCru = jogo.escalacao_cruzeiro;
    statCru      = jogo.estatisticas?.cruzeiro;
    statAdv      = jogo.estatisticas?.adversario;
  }

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
    nome_cruzeiro:    nomeCru,
    nome_adversario:  nomeAdv,
    encerrada: !!(jogo.partida_encerrada || jogo._encerrada
                  || jogo.status_detalhado?.isEncerrada
                  || jogo.status_detalhado?.status === 'Encerrada'
                  || jogo.status_detalhado?.periodoId === 'POS_JOGO'),
    jogadores:           converterJogadores(escalacaoCru),
    eventos_timeline:    converterEventos(jogo.timeline, nomeCru),
    pontuacao_cruzeiro:  calcPontuacao(jogo.timeline, nomeCru),
    // ✅ Estatísticas armazenadas como cruzeiro/adversario para cálculos internos
    estatisticas:        (statCru||statAdv) ? { cruzeiro: statCru, adversario: statAdv } : null,
    // ✅ Também guarda se Cruzeiro é mandante, para alinhar barras no render
    _cruEhMandante:      cruEhCasa,
    _jogoRaw:            jogo,
  };
}

async function carregarDadosAvaliacao() {
  try {
    const res   = await fetch(
      CONFIG_AV.avaliacaoUrl + '&_t=' + Date.now(),
      { signal: AbortSignal.timeout(8000), cache: 'no-store' }
    );
    if (!res.ok) throw new Error('HTTP '+res.status);
    const dados = await res.json();

    const lista = Array.isArray(dados) ? dados : (dados?.partida ? [dados] : []);
    if (!lista.length) return [];

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
      ['pjcd-d','pjcd-h','pjcd-m','pjcd-s'].forEach(id => { const e=$(id); if(e) e.textContent='00'; });
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
// RENDER — PARTIDAS
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
  const fab = $('fab-bar'); if (fab) fab.style.display = 'none';
  const pw = document.getElementById('pontuacao-widget'); if (pw) pw.style.display = 'none';
  fecharSidePanel('stats');
  fecharSidePanel('escalacao');
  fecharChatWidget();
}

// ============================================================
// RENDER — PLACAR INTERNO
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
  const widget = document.getElementById('pontuacao-widget');
  const pwTotal = document.getElementById('pw-total');
  const pwBadge = document.getElementById('pw-badge-cls');
  const pwItems = document.getElementById('pw-items');
  if (!widget || !pwTotal || !pwBadge || !pwItems) return;

  const todos = partida.eventos_timeline || [];

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

  const totalStr = `${sinalTotal}${total}`;
  if (pwTotal.textContent !== totalStr) {
    pwTotal.textContent = totalStr;
    pwTotal.classList.remove('pw-update');
    void pwTotal.offsetWidth;
    pwTotal.classList.add('pw-update');
  }

  pwTotal.style.color = total >= 0 ? '#ffd700' : '#f87171';
  pwBadge.textContent = cls.texto;
  pwBadge.className = `pw-badge ${cls.cls}`;

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

  if (window.innerWidth > 768) {
    widget.style.display = 'block';
  } else {
    widget.style.display = 'none';
  }

  const pwToggle  = document.getElementById('pw-toggle');
  const pwBody    = document.getElementById('pw-body');
  const pwChevron = document.getElementById('pw-chevron');
  if (pwToggle && !pwToggle._initialized) {
    pwToggle._initialized = true;
    pwToggle.addEventListener('click', () => {
      const col = pwBody.classList.toggle('collapsed');
      pwChevron.classList.toggle('rotated', col);
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
  slot.innerHTML = '';

  const jogo = partida._jogoRaw || {};
  const escCasa = jogo.escalacoes?.casa || jogo.escalacao_cruzeiro;
  const escVis  = jogo.escalacoes?.visitante || jogo.escalacao_adversario;
  if (!escCasa && !escVis) {
    slot.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;font-size:.82rem">Escalação não disponível</div>';
    return;
  }

  function listaJogadores(lista, limite=11) {
    const normalizada = (lista||[]).map(j => {
      if (typeof j === 'string') {
        const x = j.split(' - ');
        return { nome: x[0]?.trim()||'', posicao: converterPosicao(x[1]?.trim()||''), numero: x[2]?.trim()||'' };
      }
      return { nome: j.nome||j.nome_formatado||'', posicao: j.posicao||'', numero: j.numero||j.num||'' };
    });
    if (!normalizada.length) return '<li class="escal-jogador" style="color:#94a3b8">–</li>';
    return normalizada.slice(0, limite).map(j => `
      <li class="escal-jogador">
        <span class="escal-num">${j.numero||''}</span>
        <span class="escal-pos">${j.posicao||''}</span>
        <span class="escal-nome">${j.nome||''}</span>
      </li>`).join('');
  }

  const getTitulares = (esc) => esc?.titulares?.length ? esc.titulares : (esc?.titulares_simplificado || []);

  slot.innerHTML = `
    <div class="escal-body" id="escal-body">
      <div class="escal-grid">
        <div class="escal-time-col">
          <div class="escal-time-header">
            <img src="${escHtml(partida.escudo_mandante)}" alt="" onerror="this.style.display='none'">
            <strong>${escHtml(partida.mandante)}</strong>
          </div>
          ${escCasa?.tecnico ? `<div class="escal-tecnico">Técnico: ${escHtml(escCasa.tecnico)}</div>` : ''}
          <ul class="escal-lista">${listaJogadores(getTitulares(escCasa))}</ul>
        </div>
        <div class="escal-time-col">
          <div class="escal-time-header vis">
            <img src="${escHtml(partida.escudo_visitante)}" alt="" onerror="this.style.display='none'">
            <strong>${escHtml(partida.visitante)}</strong>
          </div>
          ${escVis?.tecnico ? `<div class="escal-tecnico">Técnico: ${escHtml(escVis.tecnico)}</div>` : ''}
          <ul class="escal-lista">${listaJogadores(getTitulares(escVis))}</ul>
        </div>
      </div>
    </div>`;
}

function renderPlacarCard(partida) {
  const el=$('placar-card'); if(!el) return;
  // ✅ CORREÇÃO: alinha estatísticas com o lado correto do placar-card
  const cruEhMandante = partida._cruEhMandante !== false;
  const statsHtml=partida.estatisticas?(()=>{
    const st = partida.estatisticas;
    const c = cruEhMandante ? (st.cruzeiro||{}) : (st.adversario||{});
    const a = cruEhMandante ? (st.adversario||{}) : (st.cruzeiro||{});
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
// ✅ CORRIGIDO: alinha dados de stats com lado visual correto
// ============================================================
function renderEstatisticas(partida) {
  const slot = document.getElementById('estatisticas-slot');
  if (!slot) return;
  slot.innerHTML = '';

  const st = partida.estatisticas;
  if (!st) {
    slot.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;font-size:.82rem">Estatísticas não disponíveis</div>';
    return;
  }

  // ✅ CORREÇÃO PRINCIPAL: verifica se Cruzeiro é mandante ou visitante
  // para colocar os dados do lado correto (esquerda = mandante, direita = visitante)
  const cruEhMandante = partida._cruEhMandante !== false;
  const c = cruEhMandante
    ? (st.cruzeiro   || st.casa      || {})
    : (st.adversario || st.visitante || {});
  const a = cruEhMandante
    ? (st.adversario || st.visitante || {})
    : (st.cruzeiro   || st.casa      || {});

  const nomeCasa = escHtml(partida.mandante);
  const nomeVis  = escHtml(partida.visitante);

  function statRow(label, vc, va, maiorMelhor = true) {
    const nc = typeof vc === 'number' ? vc : parseFloat(vc) || 0;
    const na = typeof va === 'number' ? va : parseFloat(va) || 0;
    const tot = nc + na;
    const pct = tot ? Math.round((nc / tot) * 100) : 50;
    const venceCasa = maiorMelhor ? nc >= na : nc <= na;
    // Só mostra a linha se ao menos um lado tem valor
    if (vc === null && va === null) return '';
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
    statRow('Posse',          c.posse_bola,             a.posse_bola),
    statRow('Finalizações',   c.finalizacoes,            a.finalizacoes),
    statRow('No Gol',         c.finalizacoes_no_gol,     a.finalizacoes_no_gol),
    statRow('Bloqueadas',     c.finalizacoes_bloqueadas, a.finalizacoes_bloqueadas),
    statRow('Escanteios',     c.escanteios,              a.escanteios),
    statRow('Faltas',         c.faltas,                  a.faltas,         false),
    statRow('Passes Certos',  c.passes_certos,           a.passes_certos),
    statRow('Total de Passes',c.passes_totais,           a.passes_totais),
    statRow('Desarmes',       c.desarmes,                a.desarmes),
    statRow('Defesas',        c.defesas_goleiro,         a.defesas_goleiro),
    statRow('Amarelos',       c.cartoes_amarelos,        a.cartoes_amarelos, false),
    statRow('Vermelhos',      c.cartoes_vermelhos,       a.cartoes_vermelhos, false),
    statRow('Impedimentos',   c.impedimentos,            a.impedimentos,    false),
  ].filter(Boolean).join('');

  if (!rows) {
    slot.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;font-size:.82rem">Estatísticas não disponíveis</div>';
    return;
  }

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

function getChipClass(tipo, isCruzeiro) {
  if (tipo==='GOAL') return isCruzeiro ? 'htl-chip-gol-casa' : 'htl-chip-gol-vis';
  if (tipo==='RED_CARD') return isCruzeiro ? 'htl-chip-vm-casa' : 'htl-chip-vm-vis';
  if (tipo==='YELLOW_CARD') return isCruzeiro ? 'htl-chip-am-casa' : 'htl-chip-am-vis';
  if (tipo==='SUBSTITUTION') return isCruzeiro ? 'htl-chip-sub-casa' : 'htl-chip-sub-vis';
  if (tipo==='IMPORTANT') return isCruzeiro ? 'htl-chip-imp-casa' : 'htl-chip-imp-vis';
  return 'htl-chip-normal';
}

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

// ============================================================
// CLASSIFICAR LANCE — mapeia texto/emoji de lances_detalhados
// para tipo, ícone, tamanho de chip e cor
// ============================================================
function classificarLance(texto) {
  const t = texto || '';
  if (/⚽/.test(t) && /[Gg]o+l/.test(t))                   return { tipo:'GOAL',         icone:'⚽', tam:'xl', cor:'#22c55e' };
  if (/🟥/.test(t) || /[Cc]art[aã]o vermelho/.test(t))     return { tipo:'RED_CARD',      icone:'🟥', tam:'xl', cor:'#ef4444' };
  if (/🟨/.test(t) || /[Cc]art[aã]o amarelo/.test(t))      return { tipo:'YELLOW_CARD',   icone:'🟨', tam:'md', cor:'#eab308' };
  if (/🔄/.test(t) || /[Ss]ubstitui[cç][aã]o|[Ee]ntra.*[Ss]ai/.test(t)) return { tipo:'SUB', icone:'🔄', tam:'md', cor:'#64748b' };
  if (/🧤/.test(t) || /[Dd]efesa de/.test(t))              return { tipo:'SAVE',          icone:'🧤', tam:'md', cor:'#3b82f6' };
  if (/VAR/.test(t))                                        return { tipo:'VAR',           icone:'📺', tam:'md', cor:'#8b5cf6' };
  if (/🛡️/.test(t) || /[Cc]hute bloqueado/.test(t))        return { tipo:'BLOCKED',       icone:'🛡️', tam:'sm', cor:'#6366f1' };
  if (/💨/.test(t) || /[Ff]inaliza[cç][aã]o.*saiu/.test(t))return { tipo:'SHOT',          icone:'💨', tam:'sm', cor:'#94a3b8' };
  if (/🚩/.test(t) && /[Ee]scanteio/.test(t))              return { tipo:'CORNER',        icone:'🚩', tam:'sm', cor:'#0ea5e9' };
  if (/[Ii]mpedimento/.test(t))                             return { tipo:'OFFSIDE',       icone:'🔺', tam:'sm', cor:'#f97316' };
  if (/⏸️/.test(t) || /les[aã]o|[Pp]ausa na partida/.test(t)) return { tipo:'INJURY',    icone:'⏸️', tam:'sm', cor:'#f59e0b' };
  if (/▶️/.test(t) || /[Jj]ogo retomado/.test(t))          return { tipo:'RESUME',        icone:'▶️', tam:'xs', cor:'#475569' };
  if (/📋/.test(t) || /[Tt]imes anunciados/.test(t))        return { tipo:'LINEUP',        icone:'📋', tam:'xs', cor:'#475569' };
  if (/🏁/.test(t))                                         return { tipo:'PERIOD_START',  icone:'🏁', tam:'xs', cor:'#64748b' };
  if (/[Ff]alta/.test(t))                                   return { tipo:'FOUL',          icone:'⚠️', tam:'xs', cor:'#475569' };
  return                                                     { tipo:'NORMAL',               icone:'·',  tam:'xs', cor:'#334155' };
}

// Agrupa lances_detalhados em períodos detectando marcadores de texto
function agruparLancesPorPeriodo(lances) {
  const grupos = { PRE:[], '1T':[], INT:[], '2T':[], '3T':[] };
  let periodo = '1T';
  for (const l of lances) {
    const t = l.texto || '';
    if (/📋|[Tt]imes anunciados|[Aa]quecendo/.test(t))      periodo = 'PRE';
    else if (/🏁.*[Pp]rimeiro|[Cc]ome[cç]a o primeiro/.test(t)) periodo = '1T';
    else if (/[Ii]ntervalo|[Ff]im do primeiro|[Pp]rimeiro tempo encerrado/.test(t)) periodo = 'INT';
    else if (/🏁.*[Ss]egundo|[Cc]ome[cç]a o segundo/.test(t)) periodo = '2T';
    else if (/[Pp]r[oó]rroga[cç][aã]o|[Ee]xtra [Tt]ime/.test(t)) periodo = '3T';
    grupos[periodo].push(l);
  }
  return grupos;
}

// ============================================================
// RENDER — TIMELINE HORIZONTAL (v5.9 — usa lances_detalhados)
// Chips de 4 tamanhos conforme importância do lance:
//   xl → gol, vermelho  |  md → amarelo, sub, defesa, VAR
//   sm → escanteio, impedimento, bloqueio, lesão
//   xs → falta, retomada, normal (pequenos pontos discretos)
// ============================================================
function renderHorizontalTimeline(partida) {
  const el = $('timeline-panel');
  if (!el) return;

  const lancesBrutos = partida._jogoRaw?.lances_detalhados || [];
  const todosEv      = partida.eventos_timeline || [];

  // Precisa de pelo menos uma fonte de dados
  if (!lancesBrutos.length && !todosEv.length) { el.style.display='none'; return; }
  el.style.display = 'block';

  state.escudoCasa = partida.escudo_mandante;
  state.escudoVis  = partida.escudo_visitante;
  state.nomeCasa   = partida.mandante;
  state.nomeVis    = partida.visitante;

  const nomeCasa = partida.nome_cruzeiro  || partida.mandante;
  const nomeVis  = partida.nome_adversario || partida.visitante;

  // ── Resumo no header (baseado em eventos_timeline estruturados) ──
  const golsCru = todosEv.filter(e=>e.is_cruzeiro&&e.tipo==='GOAL').length;
  const golsAdv = todosEv.filter(e=>!e.is_cruzeiro&&e.tipo==='GOAL').length;
  const amTotal = todosEv.filter(e=>e.tipo==='YELLOW_CARD').length;
  const vmTotal = todosEv.filter(e=>e.tipo==='RED_CARD').length;
  const subs    = todosEv.filter(e=>e.tipo==='SUBSTITUTION').length;

  // ── Monta lista unificada de chips a partir de lances_detalhados ──
  // Cada item: { texto, minuto, _cls (classificarLance result), _idx }
  const lancesValidos = lancesBrutos
    .filter(l => l.texto?.trim())
    .map((l, i) => ({ ...l, _cls: classificarLance(l.texto), _idx: i }));

  // Se não tiver lances_detalhados, fallback para eventos_timeline (comportamento antigo)
  const usarLancesDetalhados = lancesValidos.length > 0;

  // Tamanhos gerenciados por CSS: .htl-ld-xl / md / sm / xs

  function buildChipLD(l) {
    const cls     = l._cls;
    const tam     = cls.tam;
    const min     = l.minuto ? `<span class="htl-ld-min">${escHtml(l.minuto)}</span>` : '';
    const naoTrad = l._traduzido === false ? '<span class="htl-ld-en">EN</span>' : '';
    const label   = escHtml(l.texto.substring(0, 80));
    return `<button class="htl-ld-chip htl-ld-${tam} htl-ld-${cls.tipo}" data-ld="${l._idx}" aria-label="${label}" title="${label}"
        onclick="abrirDetalheLD(${l._idx})">
      <span>${cls.icone}</span>${min}${naoTrad}
    </button>`;
  }

  // Fallback: chip antigo para eventos_timeline
  function buildChipEv(ev) {
    const cls    = getChipClass(ev.tipo, ev.is_cruzeiro);
    const det    = getDetalheLance(ev, nomeCasa, nomeVis);
    const idx    = todosEv.indexOf(ev);
    const ladoCls = ev.is_cruzeiro ? 'htl-lado-casa' : (ev.lado==='adversario' ? 'htl-lado-vis' : '');
    const min    = ev.minuto ? `<span class="htl-chip-min">${ev.minuto}'</span>` : '';
    return `<button class="htl-chip ${cls} ${ladoCls}" data-ev="${idx}" aria-label="${escHtml(det.titulo)}" onclick="abrirDetalheTimeline(${idx})">
      <span class="htl-chip-icone">${ev.icone||'▶️'}</span>${min}
    </button>`;
  }

  // ── Monta faixas por período ──
  let faixas = '';

  if (usarLancesDetalhados) {
    const grupos = agruparLancesPorPeriodo(lancesValidos);
    const periodos = [
      { key:'PRE', label:'Pré' },
      { key:'1T',  label:'1T'  },
      { key:'INT', label:'INT' },
      { key:'2T',  label:'2T'  },
      { key:'3T',  label:'Prorr' },
    ];
    for (const { key, label } of periodos) {
      const itens = grupos[key] || [];
      if (!itens.length) continue;
      const chips = itens.map(buildChipLD).join('');
      faixas += `
        <div class="htl-periodo">
          <div class="htl-periodo-label">${label}</div>
          <div class="htl-faixa">
            <div class="htl-linha"></div>
            <div class="htl-chips" style="flex-wrap:wrap;gap:4px;">${chips}</div>
          </div>
        </div>`;
    }
  } else {
    // Fallback com eventos_timeline
    const TIPOS = ['GOAL','RED_CARD','YELLOW_CARD','SUBSTITUTION','IMPORTANT'];
    const rel  = todosEv.filter(e=>TIPOS.includes(e.tipo));
    const ev1T = rel.filter(e=>e.periodo_ordem===1);
    const evINT= rel.filter(e=>e.periodo_ordem===2);
    const ev2T = rel.filter(e=>e.periodo_ordem===3);
    const mkFaixa = (evs, lbl) => {
      if (!evs.length) return '';
      return `<div class="htl-periodo">
        <div class="htl-periodo-label">${lbl}</div>
        <div class="htl-faixa">
          <div class="htl-linha"></div>
          <div class="htl-chips">${evs.map(buildChipEv).join('')}</div>
        </div>
      </div>`;
    };
    faixas = mkFaixa(ev1T,'1T') + mkFaixa(evINT,'INT') + mkFaixa(ev2T,'2T');
  }

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

  el.innerHTML = `
    <div class="htl-header htl-header-toggle" id="htl-toggle-btn" role="button" tabindex="0" aria-expanded="true">
      <div class="htl-titulo"><i class="fas fa-stream"></i> Lance a Lance</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <div class="htl-resumo-chips">
          ${golsCru  ? `<span class="resumo-chip chip-gol">⚽ ${golsCru} gol${golsCru>1?'s':''}</span>` : ''}
          ${golsAdv  ? `<span class="resumo-chip chip-gol-adv">⚽ ${golsAdv} sofrido${golsAdv>1?'s':''}</span>` : ''}
          ${amTotal  ? `<span class="resumo-chip chip-cartao">🟨 ${amTotal}</span>` : ''}
          ${vmTotal  ? `<span class="resumo-chip chip-vermelho">🟥 ${vmTotal}</span>` : ''}
          ${subs     ? `<span class="resumo-chip chip-sub">🔄 ${subs}</span>` : ''}
          ${usarLancesDetalhados ? `<span class="resumo-chip chip-total">${lancesValidos.length} lances</span>` : ''}
        </div>
        <span class="htl-toggle-chevron"><i class="fas fa-chevron-up"></i></span>
      </div>
    </div>
    <div class="htl-body" id="htl-body">
      ${legenda}
      <div class="htl-periodos">${faixas}</div>
      <div class="htl-detalhe-panel" id="htl-detalhe" style="display:none;"></div>
    </div>`;

  // Armazena dados para painel de detalhe
  el._eventos     = todosEv;
  el._lances      = lancesValidos;
  el._nomeCasa    = nomeCasa;
  el._nomeVis     = nomeVis;
  el._escudoCasa  = partida.escudo_mandante;
  el._escudoVis   = partida.escudo_visitante;

  const htlToggle = document.getElementById('htl-toggle-btn');
  const htlBody   = document.getElementById('htl-body');
  if (htlToggle && htlBody) {
    const toggle = () => {
      const col = htlBody.classList.toggle('htl-collapsed');
      const icon = htlToggle.querySelector('.htl-toggle-chevron i');
      if (icon) icon.className = col ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      htlToggle.setAttribute('aria-expanded', !col);
    };
    htlToggle.addEventListener('click', toggle);
    htlToggle.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') toggle(); });
  }
}

// ── Detalhe para lances_detalhados (novo) ──
function abrirDetalheLD(idx) {
  const panel = document.getElementById('htl-detalhe');
  const tpEl  = $('timeline-panel');
  if (!panel || !tpEl) return;

  const lances = tpEl._lances || [];
  const l = lances.find(x => x._idx === idx);
  if (!l) return;

  // Toggle: fechar se já aberto
  if (panel.dataset.openLd === String(idx) && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.openLd = '';
    tpEl.querySelectorAll('[data-ld]').forEach(c => c.classList.remove('ativo'));
    return;
  }

  // Ativar chip clicado
  tpEl.querySelectorAll('[data-ld]').forEach(c => c.classList.remove('ativo'));
  tpEl.querySelector(`[data-ld="${idx}"]`)?.classList.add('ativo');
  panel.dataset.openLd = String(idx);

  const naoTrad = l._traduzido === false
    ? `<span class="htl-ld-en" style="font-size:.7rem;padding:1px 6px;margin-left:6px">EN — não traduzido</span>` : '';

  // Usar cor do CSS do tipo para border-left
  const corMap = {
    GOAL:'#003399', RED_CARD:'#ef4444', YELLOW_CARD:'#ca8a04',
    SUB:'#64748b', SAVE:'#3b82f6', VAR:'#8b5cf6',
    BLOCKED:'#6366f1', SHOT:'#94a3b8', CORNER:'#0284c7',
    OFFSIDE:'#ea580c', INJURY:'#d97706',
  };
  const cor = corMap[l._cls.tipo] || '#94a3b8';

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="htl-det-inner" style="border-left-color:${cor}">
      <div class="htl-det-topo">
        <span class="htl-chip-icone">${l._cls.icone}</span>
        <div class="htl-det-info">
          <strong>${escHtml(l.texto)}${naoTrad}</strong>
        </div>
        ${l.minuto ? `<span class="htl-det-min" style="color:${cor}">${escHtml(l.minuto)}</span>` : ''}
        <button class="htl-det-fechar" onclick="abrirDetalheLD(${idx})">✕</button>
      </div>
    </div>`;
}

// ── Detalhe para eventos_timeline (fallback — mantido compatível) ──
function abrirDetalheTimeline(idx) {
  const panel = document.getElementById('htl-detalhe');
  const tpEl  = $('timeline-panel');
  if (!panel || !tpEl) return;

  const todos    = tpEl._eventos || [];
  const nomeCasa = tpEl._nomeCasa || '';
  const nomeVis  = tpEl._nomeVis  || '';
  const ev = todos[idx];
  if (!ev) return;

  if (panel.dataset.openIdx === String(idx) && panel.style.display !== 'none') {
    panel.style.display='none'; panel.dataset.openIdx='';
    document.querySelectorAll('.htl-chip').forEach(c=>c.classList.remove('htl-chip-ativo'));
    return;
  }

  document.querySelectorAll('.htl-chip').forEach(c=>c.classList.remove('htl-chip-ativo'));
  document.querySelector(`.htl-chip[data-ev="${idx}"]`)?.classList.add('htl-chip-ativo');
  panel.dataset.openIdx = String(idx);

  const det  = getDetalheLance(ev, nomeCasa, nomeVis);
  const min  = ev.minuto ? `${ev.minuto}'` : '';
  const isCasa = ev.is_cruzeiro;
  const isVis  = ev.lado==='adversario';
  const escudo = isCasa ? tpEl._escudoCasa : (isVis ? tpEl._escudoVis : '');

  const narracaoCompleta = ev.narracao ? limpar(ev.narracao) : '';
  const descricaoExtra = narracaoCompleta && narracaoCompleta !== det.titulo.replace(/^[⚽🟨🟥🔄🔹]\s*/u,'')
    ? `<p class="htl-det-narracao">${escHtml(narracaoCompleta)}</p>` : '';
  const placarGolHtml = (ev.tipo==='GOAL' && ev.placar_neste_momento)
    ? `<p class="htl-det-placar">⚽ Placar: ${escHtml(tpEl._nomeCasa)} ${ev.placar_neste_momento.casa} × ${ev.placar_neste_momento.vis} ${escHtml(tpEl._nomeVis)}</p>` : '';

  const corMap = { GOAL: isCasa?'#003399':'#dc2626', RED_CARD:'#dc2626', YELLOW_CARD:'#d97706', SUBSTITUTION:'#475569', IMPORTANT:'#1d4ed8' };
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
      ${descricaoExtra}${placarGolHtml}
    </div>`;
}

// ============================================================
// FIX v5.9: PROXY DE FOTOS ESPN
// ESPN bloqueia hotlink de outros domínios — roteamos via worker
// ============================================================
function proxyFotoUrl(url) {
  if (!url) return null;
  if (!url.includes('espncdn.com')) return url;
  return `https://cabuloso-api.cabulosonews92.workers.dev/?type=proxy-img&url=${encodeURIComponent(url)}`;
}

// ============================================================
// FIX v5.9: RENDER — LANCES DETALHADOS (play-by-play textual)
// O campo lances_detalhados existia no JSON mas nunca era renderizado
// ============================================================
  // renderLancesDetalhados removed — lances agora na timeline horizontal (v5.9)


// ============================================================
// RENDER — JOGADORES com nota 1-10 via estrelas
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

  // ✅ FIX v5.9: foto roteada via proxy do worker (ESPN bloqueia hotlink direto)
  const fotoSrc = proxyFotoUrl(jogador.foto);
  const fotoHtml = fotoSrc
    ? `<img src="${escHtml(fotoSrc)}" alt="${escHtml(jogador.nome)}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
         loading="lazy"
         style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">
       <span style="display:none;width:100%;height:100%;border-radius:50%;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;">${(jogador.nome||'?').charAt(0).toUpperCase()}</span>`
    : (jogador.nome||'?').charAt(0).toUpperCase();

  card.innerHTML=`
    <div class="jogador-numero">${jogador.numero||'?'}</div>
    <div class="jogador-avatar">${fotoHtml}</div>
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

    badgeEl.textContent=n; badgeEl.className='nota-badge changed';
    setTimeout(()=>badgeEl.classList.remove('changed'),250);

    const {txt,cls}=getNotaLabel(n);
    lblEl.textContent=txt; lblEl.className=`nota-label ${cls}`;

    const estrelas = Math.ceil(n/2);
    starsEl.querySelectorAll('.nota-star').forEach(s=>{
      const sN=+s.dataset.n;
      s.classList.toggle('ativa', sN<=estrelas);
      if (sN===estrelas) { s.classList.add('lit'); setTimeout(()=>s.classList.remove('lit'),220); }
    });

    card.classList.add('avaliado');
  }

  starsEl.querySelectorAll('.nota-star').forEach(star=>{
    star.addEventListener('click',()=>{
      const n = +star.dataset.n * 2;
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

  filtrarPosicao('Todos');

  $('arrow-left')&&($('arrow-left').onclick=()=>track.scrollBy({left:-200,behavior:'smooth'}));
  $('arrow-right')&&($('arrow-right').onclick=()=>track.scrollBy({left:200,behavior:'smooth'}));
}

// ============================================================
// PAINÉIS LATERAIS FLUTUANTES
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
    const partidaId = partida.id;
    body.innerHTML = comentarios.map(av => {
      const data  = new Date(av.ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      const cidx  = av.nick.charCodeAt(0) % avatarColors.length;
      const ntChip = av.nota_time
        ? `<span class="nota-chip nota-chip-time" style="margin-right:4px"><i class="fas fa-shield-alt"></i> Time ${av.nota_time}/10</span>`
        : '';
      const reacoes = av.reacoes || {'👍':0,'❤️':0,'🔥':0,'😂':0,'😡':0};
      const minhaReacao = getReacao(av.id);
      const reacoesHtml = REACOES.map((r, ri) => {
        const cnt = reacoes[r.emoji] || 0;
        const ativa = minhaReacao === r.emoji ? 'ativa' : '';
        return `<button class="reacao-btn ${ativa}" data-avid="${escHtml(av.id)}" data-emoji="${escHtml(r.emoji)}" data-ri="${ri}" data-pid="${escHtml(partidaId)}" title="${escHtml(r.label)}">${r.emoji}<span class="reacao-count">${cnt||''}</span></button>`;
      }).join('');
      return `<div class="chat-comentario">
        <div class="chat-avatar" style="background:${avatarColors[cidx]}">${av.nick.charAt(0).toUpperCase()}</div>
        <div class="chat-balao">
          <div class="chat-nick">${escHtml(av.nick)} <span class="chat-data">${data}</span></div>
          <p class="chat-texto">${escHtml(av.obs)}</p>
          ${ntChip ? `<div style="margin-top:4px">${ntChip}</div>` : ''}
          <div class="comentario-reacoes" style="margin-top:6px">${reacoesHtml}</div>
        </div>
      </div>`;
    }).join('');
    body.querySelectorAll('.reacao-btn').forEach(btn => btn.addEventListener('click', () => reagirComentario(btn)));
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
      star.classList.add('pop'); setTimeout(() => star.classList.remove('pop'), 220);
    });
    star.addEventListener('mouseenter', () => highlight(+star.dataset.n));
    star.addEventListener('mouseleave', () => highlight(state.nota_time / 2));
  });
}

// ============================================================
// TOGGLE da seção de jogadores
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
// ENVIO DA AVALIAÇÃO
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

    const notasTime = avaliacoes.map(a => a.nota_time).filter(n => n > 0);
    const ntcEl = document.getElementById('nota-time-comunidade');
    const ntcValor = document.getElementById('ntc-valor');
    const ntcEst = document.getElementById('ntc-estrelas');
    const ntcVotos = document.getElementById('ntc-votos');
    if (ntcEl && ntcValor && ntcEst && ntcVotos) {
      if (notasTime.length) {
        const media = notasTime.reduce((a,b)=>a+b,0) / notasTime.length;
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

  const card = btn.closest('.comentario-card, .chat-comentario');
  const getCountSpan = (em) => {
    const ri = REACOES.findIndex(r=>r.emoji===em);
    if (ri < 0) return null;
    return card
      ? card.querySelector(`.reacao-count:nth-of-type(${ri + 1}), [id$="-${ri}"]`)
        ?? card.querySelectorAll('.reacao-count')[ri] ?? null
      : document.getElementById(`rc-${sanitizeId(avId)}-${ri}`);
  };
  const getPrevBtn = (em) => {
    return card
      ? card.querySelector(`.reacao-btn[data-emoji="${em}"]`)
      : document.querySelector(`.reacao-btn[data-avid="${avId}"][data-emoji="${em}"]`);
  };

  const anterior=getReacao(avId);
  if(anterior===emoji){
    removerRea(avId); btn.classList.remove('ativa');
    const c=getCountSpan(emoji);
    if(c){const n=Math.max(0,(parseInt(c.textContent)||1)-1);c.textContent=n||'';}
    await salvarReacao(pid,avId,null);
  } else {
    if(anterior){
      const pb=getPrevBtn(anterior);
      if(pb){ pb.classList.remove('ativa'); const pc=getCountSpan(anterior); if(pc){const n=Math.max(0,(parseInt(pc.textContent)||1)-1);pc.textContent=n||'';} }
    }
    salvarRea(avId,emoji); btn.classList.add('ativa');
    const c=getCountSpan(emoji);
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
  state.partidaSelecionada=partida; state.notas={}; state.nota_time=0;
  state.avaliacaoEnviada = jaAvaliou(id);
  const av=$('avaliacao-section');
  if(av){av.style.display='block';setTimeout(()=>av.scrollIntoView({behavior:'smooth',block:'start'}),100);}
  const pc=$('placar-card'); if(pc) pc.style.display='none';
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
  const fab = $('fab-bar'); if (fab) fab.style.display = 'flex';
  const fabStats = $('fab-stats');
  const fabEsc   = $('fab-escalacao');
  const fabChat  = $('fab-chat');
  if (fabStats && !fabStats._bound) { fabStats._bound=true; fabStats.addEventListener('click', () => toggleSidePanel('stats')); }
  if (fabEsc   && !fabEsc._bound)   { fabEsc._bound=true;   fabEsc.addEventListener('click',   () => toggleSidePanel('escalacao')); }
  if (fabChat  && !fabChat._bound)  { fabChat._bound=true;  fabChat.addEventListener('click',  () => toggleChatWidget()); }
  initFabPontuacao();
  initNotaTimeStars();
  renderPlacarInterno(partida);
  renderPontuacaoPanel(partida);
  renderHorizontalTimeline(partida);
  renderEstatisticas(partida);
  renderEscalacao(partida);
  renderJogadores(partida);

  const section = document.querySelector('.jogadores-section');
  if (section) {
    section.classList.remove('collapsed');
    const chevron = section.querySelector('.toggle-chevron');
    if (chevron) chevron.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
  initToggleJogadores();
  iniciarBotaoEsconder(id);

  const accToggle = document.querySelector('.medias-accordion-toggle');
  if (accToggle && !accToggle._initialized) {
    accToggle._initialized = true;
    const body = document.querySelector('.medias-accordion-body');
    accToggle.addEventListener('click', ()=>{
      const open = body.classList.toggle('open');
      accToggle.classList.toggle('open', open);
    });
  }

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
    const el=$(elId); if(!el) return;
    if (elId==='ja-avaliou-msg' && el.style.display==='none') return;
    if (oculta) el.dataset.escondido='1', el.style.opacity='0.15', el.style.pointerEvents='none';
    else delete el.dataset.escondido, el.style.opacity='', el.style.pointerEvents='';
  });
  const sa=$('submit-area');
  if(sa&&!state.avaliacaoEnviada){
    if(oculta) sa.style.display='none';
    else sa.style.display='block';
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
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
  _pollingIdsAnterior = getIdsSnapshot(state.partidas);
  renderPartidas(state.partidas);
  if(state.partidas.length===1) await selecionarPartida(state.partidas[0].id);
  iniciarPolling();
});

// ============================================================
// FAB PONTUAÇÃO — botão mobile + modal bottom sheet
// ============================================================
function initFabPontuacao() {
  const fabBar = $('fab-bar');
  if (!fabBar) return;
  if (window.innerWidth > 768) return;

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

  pmTotal.textContent = `${sinal}${total}`;
  pmTotal.style.color = total >= 0 ? '#ffd700' : '#f87171';
  pmBadge.textContent = cls.texto;
  pmBadge.className   = `pontuacao-modal-badge ${cls.cls}`;

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