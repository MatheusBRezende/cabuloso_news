// ===================== CONFIGURAÇÕES GLOBAIS =====================

async function loadColorThief() {
  if (typeof ColorThief === 'undefined') {
    await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js');
    colorThiefLoaded = true;
  }
}
// ===================== VARIÁVEIS GLOBAIS =====================
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
let apiKey = null;
let jogoAoVivo = {};
let placarAtual = { casa: 0, visitante: 0 };
let jogoEncerradoGlobal = false;
let intervaloAtualizacao;
let coresTimes = {};
let colorThiefLoaded = false;

// ===================== INICIALIZAÇÃO =====================
document.addEventListener("DOMContentLoaded", async () => {
  await fetchAPIKey();

  // Recupera dados do jogo primeiro
  const urlParams = new URLSearchParams(window.location.search);
  const jogoSalvo = localStorage.getItem("jogoAoVivo");
  jogoAoVivo = {
    timeCasa: urlParams.get("timeCasa") || (jogoSalvo ? JSON.parse(jogoSalvo).timeCasa : "Time Casa"),
    timeVisitante: urlParams.get("timeVisitante") || (jogoSalvo ? JSON.parse(jogoSalvo).timeVisitante : "Time Visitante"),
    escudoCasa: urlParams.get("escudoCasa") || (jogoSalvo ? JSON.parse(jogoSalvo).escudoCasa : ""),
    escudoVisitante: urlParams.get("escudoVisitante") || (jogoSalvo ? JSON.parse(jogoSalvo).escudoVisitante : ""),
    campeonato: urlParams.get("campeonato") || (jogoSalvo ? JSON.parse(jogoSalvo).campeonato : ""),
  };


  // Atualização automática (mais lenta em mobile)
  const INTERVALO_PADRAO = window.innerWidth <= 600 ? 60000 : 30000;
  intervaloAtualizacao = setInterval(atualizarTudo, INTERVALO_PADRAO);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && intervaloAtualizacao) {
      clearInterval(intervaloAtualizacao);
      intervaloAtualizacao = null;
    } else if (!document.hidden && !intervaloAtualizacao && !jogoEncerradoGlobal) {
      intervaloAtualizacao = setInterval(atualizarTudo, INTERVALO_PADRAO);
    }
  });

    if (jogoAoVivo.escudoCasa) {
    coresTimes.timeCasa = await extrairCoresDoEscudo(jogoAoVivo.escudoCasa, 'casa');
  }
  if (jogoAoVivo.escudoVisitante) {
    coresTimes.timeVisitante = await extrairCoresDoEscudo(jogoAoVivo.escudoVisitante, 'visitante');
  }
});

async function atualizarTudo() {
  if (jogoEncerradoGlobal) return;
  await Promise.all([
    carregarDadosDaESPN(jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante, jogoAoVivo.escudoCasa, jogoAoVivo.escudoVisitante),
    carregarEstatisticasESPN(jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante)
  ]);
}

// ===================== FUNÇÕES AUXILIARES =====================
function carregarScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function fetchAPIKey() {
  try {
    const response = await fetch("/api/chave-google");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const data = await response.json();
    if (!data.apiKey) throw new Error("Chave da API não encontrada");
    apiKey = data.apiKey;
    return true;
  } catch (error) {
    console.error("Falha ao carregar chave:", error);
    return false;
  }
}

function atualizarInformacoesJogo(jogo) {
  const escudoCasa = document.getElementById("escudo-casa");
  const escudoVisitante = document.getElementById("escudo-visitante");
  if (escudoCasa) escudoCasa.src = jogo.escudoCasa || obterEscudoTime(jogo.timeCasa);
  if (escudoVisitante) escudoVisitante.src = jogo.escudoVisitante || obterEscudoTime(jogo.timeVisitante);

  const nomeCasa = document.getElementById("nome-time-casa");
  const nomeVisitante = document.getElementById("nome-time-visitante");
  if (nomeCasa) nomeCasa.textContent = jogo.timeCasa || "Time Mandante";
  if (nomeVisitante) nomeVisitante.textContent = jogo.timeVisitante || "Time Visitante";

  const titulo = document.getElementById("titulo-jogo");
  const tituloPagina = document.getElementById("titulo-pagina");
  const campeonato = document.getElementById("campeonato-badge");

  if (titulo) titulo.textContent = `${jogo.timeCasa} vs ${jogo.timeVisitante}`;
  if (tituloPagina) tituloPagina.textContent = `Minuto a Minuto | ${jogo.timeCasa} vs ${jogo.timeVisitante}`;
  if (campeonato) campeonato.textContent = jogo.campeonato;
}

function processarEventos(dados, timeCasa, timeVisitante) {
  if (jogoEncerradoGlobal) return;
  const eventosAgrupados = {};
  let jogoEncerrado = false;
  let emIntervalo = false;
  let placarConfirmado = null;

  // Regex para placar
  const padraoGol = /^(\d{1,3}'\+\d+'|\d{1,3}')?\s*(?:Fim do (?:Jogo|segundo tempo|primeiro tempo|Intervalo),?\s*)?([^,0-9]+?)\s*(\d+)\s*,\s*([^,0-9]+?)\s*(\d+)/i;
  const extrairNumeroTempo = (tempoStr) => {
    if (!tempoStr) return 0;
    const match = tempoStr.match(/(\d+)'/);
    return match ? parseInt(match[1]) : 0;
  };

  for (const linha of dados.slice(1)) {
    const texto = linha[0]?.trim();
    if (!texto) continue;
    const tempoMatch = texto.match(/^(\d{1,3}'\+\d+'|\d{1,3}')/);
    const tempo = tempoMatch?.[0] || "-";
    const descricao = tempo === "-" ? texto : texto.replace(tempo, "").trim();

    if (/Fim do primeiro tempo|Intervalo/i.test(texto)) emIntervalo = true;
    else if (/Início do segundo tempo/i.test(texto)) emIntervalo = false;
    if (/Fim do Jogo|Fim do segundo tempo/i.test(texto)) {
      jogoEncerrado = true;
      emIntervalo = false;
      const placarMatch = texto.match(/(.+?)\s*(\d+)\s*,\s*(.+?)\s*(\d+)/i);
      if (placarMatch) {
        const time1 = placarMatch[1].trim();
        const gols1 = parseInt(placarMatch[2]);
        const time2 = placarMatch[3].trim();
        const gols2 = parseInt(placarMatch[4]);
        placarAtual = {
          casa: time1.toLowerCase().includes(timeCasa.toLowerCase()) ? gols1 : gols2,
          visitante: time2.toLowerCase().includes(timeVisitante.toLowerCase()) ? gols2 : gols1,
        };
        atualizarPlacar(placarAtual.casa, placarAtual.visitante);
      }
    }
    atualizarStatusJogo(jogoEncerrado, emIntervalo);

    if (descricao.startsWith("Gol!")) {
      try {
        const placarMatch = descricao.match(padraoGol);
        if (placarMatch) {
          const time1 = placarMatch[2].trim();
          const gols1 = parseInt(placarMatch[3]);
          const time2 = placarMatch[4].trim();
          const gols2 = parseInt(placarMatch[5]);
          let golsCasa, golsVisitante;
          if (time1.toLowerCase().includes(timeCasa.toLowerCase()) || timeCasa.toLowerCase().includes(time1.toLowerCase())) {
            golsCasa = gols1;
            golsVisitante = gols2;
          } else if (time2.toLowerCase().includes(timeCasa.toLowerCase()) || timeCasa.toLowerCase().includes(time2.toLowerCase())) {
            golsCasa = gols2;
            golsVisitante = gols1;
          } else {
            golsCasa = gols1;
            golsVisitante = gols2;
          }
          const novoPlacar = {
            casa: golsCasa,
            visitante: golsVisitante,
            tempo,
            tempoNumerico: extrairNumeroTempo(tempo),
          };
          if ((!placarConfirmado || novoPlacar.tempoNumerico > placarConfirmado.tempoNumerico) && !jogoEncerrado) {
            placarConfirmado = novoPlacar;
            placarAtual = { casa: golsCasa, visitante: golsVisitante };
            atualizarPlacar(placarAtual.casa, placarAtual.visitante);
            let timeFezGol = null;
            if (golsCasa > (placarConfirmado?.casa ?? 0)) timeFezGol = "casa";
            else if (golsVisitante > (placarConfirmado?.visitante ?? 0)) timeFezGol = "visitante";
            if (timeFezGol) mostrarAnimacaoGol(timeFezGol);
          }
        }
      } catch (error) {
        console.error("Erro ao processar gol:", error, "Texto:", descricao);
      }
    }

    const times = [];
    const timeMatches = descricao.matchAll(new RegExp(`(${escapeRegExp(timeCasa)}|${escapeRegExp(timeVisitante)})`, "gi"));
    for (const match of timeMatches) {
      if (match[0] && !times.includes(match[0])) times.push(match[0]);
    }
    const tipoEvento = determinarTipoEvento(descricao);
    if (!eventosAgrupados[tempo]) eventosAgrupados[tempo] = { tempo, eventos: [] };
    eventosAgrupados[tempo].eventos.push({ descricao, times, tipoEvento });
  }

  if (placarConfirmado) {
    placarAtual = { casa: placarConfirmado.casa, visitante: placarConfirmado.visitante };
    atualizarPlacar(placarAtual.casa, placarAtual.visitante);
  }
  jogoEncerradoGlobal = jogoEncerrado;
  atualizarStatusJogo(jogoEncerrado);
  return Object.values(eventosAgrupados);
}

function atualizarStatusJogo(encerrado, emIntervalo = false) {
  const statusElement = document.getElementById("status-jogo");
  if (!statusElement) return;
  
  // Limpa classes anteriores
  statusElement.className = "status-badge";
  
  if (encerrado) {
    statusElement.textContent = "Encerrado";
    statusElement.classList.add("status-encerrado");
    jogoEncerradoGlobal = true;
    
    // Atualiza o botão de atualização
    const btnAtualizar = document.getElementById("atualizar-dados");
    if (btnAtualizar) {
      btnAtualizar.textContent = "Ver Resumo";
      btnAtualizar.onclick = () => {
        window.location.href = `resultados.html?timeCasa=${jogoAoVivo.timeCasa}&timeVisitante=${jogoAoVivo.timeVisitante}`;
      };
    }
    
    // Para a atualização automática
    if (intervaloAtualizacao) {
      clearInterval(intervaloAtualizacao);
      intervaloAtualizacao = null;
    }
  } else if (emIntervalo) {
    statusElement.textContent = "Intervalo";
    statusElement.classList.add("status-intervalo");
  } else {
    // Só mostra "Ao vivo" se o jogo não estiver encerrado
    if (!jogoEncerradoGlobal) {
      statusElement.textContent = "Ao vivo";
      statusElement.classList.add("status-ao-vivo");
    }
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function determinarTipoEvento(descricao) {
  const desc = descricao.toLowerCase();
  if (desc.includes("gol")) return "gol";
  if (desc.includes("escanteio")) return "escanteio";
  if (desc.includes("chute") || desc.includes("finalização")) return "chute";
  if (desc.includes("falta")) return "falta";
  if (desc.includes("amarelo")) return "amarelo";
  if (desc.includes("vermelho")) return "vermelho";
  if (desc.includes("substituição") || desc.includes("substituicao")) return "substituicao";
  if (desc.includes("início") || desc.includes("início do jogo") || desc.includes("inicia") || desc.includes("começa")) return "inicio";
  if (desc.includes("intervalo")) return "intervalo";
  if (desc.includes("fim de jogo") || desc.includes("termina") || desc.includes("final de jogo")) return "fim";
  if (desc.includes("impedimento")) return "impedimento";
  if (desc.includes("defesa")) return "defesa";
  if (desc.includes("pênalti") || desc.includes("penalti")) return "penalti";
  return "padrao";
}

function atualizarPlacar(golsCasa, golsVisitante) {
  if (golsCasa < 0 || golsVisitante < 0) return;
  
  const casaElement = document.getElementById("gols-casa");
  const visitanteElement = document.getElementById("gols-visitante");
  
  if (casaElement && visitanteElement) {
    // Remove classes de cor padrão para priorizar as cores dinâmicas
    casaElement.className = "";
    visitanteElement.className = "";
    
    const golCasa = golsCasa > parseInt(casaElement.textContent);
    const golVisitante = golsVisitante > parseInt(visitanteElement.textContent);
    
    casaElement.textContent = golsCasa;
    visitanteElement.textContent = golsVisitante;
    
    if (golCasa && coresTimes.timeCasa) {
      casaElement.style.color = coresTimes.timeCasa.primary;
      animarPlacar(casaElement, 'casa');
    }
    
    if (golVisitante && coresTimes.timeVisitante) {
      visitanteElement.style.color = coresTimes.timeVisitante.primary;
      animarPlacar(visitanteElement, 'visitante');
    }
  }
}

// ===================== FUNÇÕES DE CORES DINÂMICAS =====================

async function extrairCoresDominantes(imagemUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imagemUrl;

    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Analisa apenas 9 pontos estratégicos da imagem para melhor performance
      const pontos = [
        {x: 10, y: 10},           // Canto superior esquerdo
        {x: img.width/2, y: 10},   // Topo centro
        {x: img.width-10, y: 10},  // Canto superior direito
        {x: 10, y: img.height/2},  // Meio esquerdo
        {x: img.width/2, y: img.height/2}, // Centro
        {x: img.width-10, y: img.height/2}, // Meio direito
        {x: 10, y: img.height-10}, // Canto inferior esquerdo
        {x: img.width/2, y: img.height-10}, // Fundo centro
        {x: img.width-10, y: img.height-10} // Canto inferior direito
      ];

      const cores = pontos.map(ponto => {
        const pixel = ctx.getImageData(ponto.x, ponto.y, 1, 1).data;
        return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      });

      // Filtra cores muito claras ou muito escuras (fundo branco/preto)
      const coresFiltradas = cores.filter(cor => {
        const [r, g, b] = cor.match(/\d+/g).map(Number);
        const luminosidade = (r * 299 + g * 587 + b * 114) / 1000;
        return luminosidade > 30 && luminosidade < 230;
      });

      // Se não encontrou cores válidas, usa as primeiras
      const coresParaAnalise = coresFiltradas.length > 0 ? coresFiltradas : cores;
      
      // Conta a frequência de cada cor
      const contagem = {};
      coresParaAnalise.forEach(cor => {
        contagem[cor] = (contagem[cor] || 0) + 1;
      });

      // Ordena por frequência
      const coresOrdenadas = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
      
      // Pega as 2 cores mais frequentes
      const primary = coresOrdenadas[0] || '#003399'; // Fallback
      const secondary = coresOrdenadas[1] || '#FFFFFF'; // Fallback

      resolve({ primary, secondary });
    };

    img.onerror = function() {
      resolve({ primary: '#003399', secondary: '#FFFFFF' }); // Fallback
    };
  });
}

// Modifique a função extrairCoresDoEscudo
async function extrairCoresDoEscudo(imagemUrl, time) {
  const nomeTime = time === 'casa' ? jogoAoVivo.timeCasa : jogoAoVivo.timeVisitante;
  const storageKey = `coresTimes_${nomeTime}`;
  
  // Verifica se já temos as cores salvas
  const coresSalvas = localStorage.getItem(storageKey);
  if (coresSalvas) {
    return JSON.parse(coresSalvas);
  }

  // Tratamento especial para times conhecidos
  const timeLower = nomeTime?.toLowerCase() || '';
  
  if (timeLower.includes('cruzeiro')) {
    const cores = { primary: '#0055A8', secondary: '#FFFFFF' };
    localStorage.setItem(storageKey, JSON.stringify(cores));
    return cores;
  }

  // Extração de cores da imagem
  const cores = await extrairCoresDominantes(imagemUrl);
  localStorage.setItem(storageKey, JSON.stringify(cores));
  return cores;
}

function getColorBrightness(hexColor) {
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000; // Fórmula de luminosidade
}

async function mostrarAnimacaoGol(time) {
  const timeKey = time === "casa" ? "timeCasa" : "timeVisitante";
  const escudoKey = time === "casa" ? "escudoCasa" : "escudoVisitante";
  const golKey = `gol_${time}_${placarAtual[time]}`;
  if (localStorage.getItem(golKey)) return;
  
  localStorage.setItem(golKey, "true");
  
  if (!coresTimes[timeKey]) {
    coresTimes[timeKey] = await extrairCoresDoEscudo(jogoAoVivo[escudoKey], time);
  }

  const { primary, secondary } = coresTimes[timeKey];
  const animationId = `goal-lottie-${time}`;
  const container = document.getElementById(animationId);

  if (!container) {
    console.error("Container de animação não encontrado:", animationId);
    return;
  }

  container.innerHTML = '';
  container.style.display = "block";

  // Animação de gol
  container.innerHTML = `
    <div class="goal-celebration">
      <div class="goal-text" style="color:${secondary}">GOL!</div>
      <div class="goal-explosion" style="
        background:radial-gradient(circle, ${primary} 0%, transparent 70%);
      "></div>
      <div class="confetti-container">
        ${Array(25).fill().map((_, i) => 
          `<div class="confetti" style="
            --rotate: ${Math.random() * 360}deg;
            --x: ${Math.random() * 100}vw;
            --delay: ${Math.random() * 0.5}s;
            --duration: ${0.5 + Math.random() * 1}s;
            background: ${i % 2 === 0 ? primary : secondary};
          "></div>`
        ).join('')}
      </div>
      <div class="shockwave" style="
        background:radial-gradient(circle, transparent 0%, ${primary} 30%, transparent 60%);
      "></div>
    </div>
  `;

  // Remove após 3 segundos
  setTimeout(() => {
    container.style.display = "none";
    container.innerHTML = "";
  }, 3000);
}

async function animarPlacar(elemento, time) {
  const timeKey = time === "casa" ? "timeCasa" : "timeVisitante";
  const escudoKey = time === "casa" ? "escudoCasa" : "escudoVisitante";
  
  if (!coresTimes[timeKey]) {
    coresTimes[timeKey] = await extrairCoresDoEscudo(jogoAoVivo[escudoKey], time);
  }

  const { primary, secondary } = coresTimes[timeKey];
  
  // Efeito de pulso
  elemento.style.animation = 'none';
  void elemento.offsetWidth;
  elemento.style.animation = `pulseColor 0.8s ease-out`;
  elemento.style.color = primary;
  
  // Cria partículas
  criarParticulas(elemento, primary, secondary);
}

function criarParticulas(elemento, cor1, cor2) {
  const particulas = document.createElement('div');
  particulas.className = 'placar-particulas';
  
  particulas.innerHTML = Array(15).fill().map((_, i) => {
    const cor = i % 2 === 0 ? cor1 : cor2;
    const size = Math.random() * 8 + 4;
    return `<span style="
      --size: ${size}px;
      --delay: ${Math.random() * 0.5}s;
      --distance: ${Math.random() * 40 + 20}px;
      --angle: ${Math.random() * 360}deg;
      background: ${cor};
      box-shadow: 0 0 ${size}px ${cor};
    "></span>`;
  }).join('');
  
  elemento.appendChild(particulas);
  
  setTimeout(() => particulas.remove(), 1000);
}

// ===================== EXIBIÇÃO DOS EVENTOS =====================
function exibirEventos(eventosAgrupados) {
  const container = document.getElementById("narrativa-jogo");
  if (!container) return;

  // Verificar se os eventos são os mesmos para evitar renderização desnecessária
  const eventosStr = JSON.stringify(eventosAgrupados);
  if (container._ultimosEventos === eventosStr) return;
  container._ultimosEventos = eventosStr;

  // Oculta o loading
  const loadingElement = container.querySelector(".loading-narrativa");
  if (loadingElement) loadingElement.style.display = "none";

  // Garante que o título exista
  if (!container.querySelector(".narrativa-titulo")) {
    const titulo = document.createElement("h2");
    titulo.className = "narrativa-titulo";
    titulo.innerHTML = '<i class="fas fa-scroll"></i> Minuto a Minuto';
    container.prepend(titulo);
  }

  // Renderizar apenas os últimos 20 eventos para performance
  const eventosParaRenderizar = eventosAgrupados.slice(-20);
  
  // Cria o HTML dos eventos
  const eventosHTML = eventosParaRenderizar.map(grupo => `
    <div class="grupo-tempo" data-tempo="${grupo.tempo}">
      <span class="tempo-evento">${grupo.tempo}</span>
      <div class="eventos-container">
        ${grupo.eventos.map(evento => `
          <div class="evento-jogo">
            <div class="evento-content ${evento.tipoEvento !== "padrao" ? "evento-" + evento.tipoEvento : ""}">
              <div class="evento-header">
                ${getEventIcon(evento.tipoEvento)}
                <p class="evento-descricao">${formatarDescricao(evento.descricao) || ""}</p>
              </div>
              ${evento.times.length > 0 ? `
                <div class="evento-footer">
                  ${evento.times.map(time => `<span class="time-badge">${time}</span>`).join("")}
                </div>
              ` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  // Adiciona os eventos ao container
  const eventosContainer = document.createElement("div");
  eventosContainer.className = "eventos-wrapper";
  eventosContainer.innerHTML = eventosHTML;

  // Substitui o conteúdo existente
  const existingWrapper = container.querySelector(".eventos-wrapper");
  if (existingWrapper) {
    container.replaceChild(eventosContainer, existingWrapper);
  } else {
    container.appendChild(eventosContainer);
  }

  // Scroll para o final
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 50);
}

function formatarDescricao(descricao) {
  return descricao.replace(/\$\$([^$]+)\$\$/g, '<span class="time-destaque">$1</span>');
}

function getEventIcon(tipoEvento) {
  const icons = {
    gol: '<i class="fas fa-futbol evento-icone"></i>',
    escanteio: '<i class="fas fa-flag-checkered evento-icone"></i>',
    chute: '<i class="fas fa-bullseye evento-icone"></i>',
    substituicao: '<i class="fas fa-exchange-alt evento-icone"></i>',
    inicio: '<i class="fas fa-play-circle evento-icone"></i>',
    intervalo: '<i class="fas fa-pause-circle evento-icone"></i>',
    fim: '<i class="fas fa-stop-circle evento-icone"></i>',
    impedimento: '<i class="fas fa-ban evento-icone"></i>',
    defesa: '<i class="fas fa-hand-paper evento-icone"></i>',
    penalti: '<i class="fas fa-crosshairs evento-icone"></i>',
    padrao: '<i class="fas fa-circle evento-icone padrao"></i>',
  };
  return icons[tipoEvento] || icons["padrao"];
}

// ===================== CARREGAMENTO DE DADOS =====================

async function carregarDadosDaESPN(timeCasa, timeVisitante, escudoCasa, escudoVisitante) {
  if (jogoEncerradoGlobal) return;

  const loadingNarrativa = document.querySelector(".loading-narrativa");
  const containerNarrativa = document.getElementById("narrativa-jogo");
  
  try {
    // Mostrar loading apenas se não houver dados ainda
    if (!containerNarrativa.querySelector(".grupo-tempo") && loadingNarrativa) {
      loadingNarrativa.style.display = "flex";
    }
    if (containerNarrativa) containerNarrativa.style.opacity = "0.7";

    // Usar jogoID fixo para testes
    const jogoId = '732696';
    
    // Verificar cache em memória primeiro
    if (window._cachedComentarios && window._cachedComentarios.timestamp > Date.now() - CACHE_DURATION) {
      const eventos = processarComentariosESPN(window._cachedComentarios.data, timeCasa, timeVisitante);
      exibirEventos(eventos);
      return;
    }

    // Carregar minuto a minuto
    const response = await fetch(`/api/espn/minuto-a-minuto/${jogoId}`, {
      headers: {
        'Cache-Control': 'no-cache' // Força verificação com servidor
      }
    });

    const comentarios = await response.json();

    if (!comentarios || comentarios.length === 0) {
      throw new Error("Nenhum comentário encontrado para este jogo");
    }

    // Armazenar em cache em memória
    window._cachedComentarios = {
      data: comentarios,
      timestamp: Date.now()
    };

    // Processar os comentários para o formato esperado
    const eventos = processarComentariosESPN(comentarios, timeCasa, timeVisitante);
    exibirEventos(eventos);

    if (containerNarrativa) containerNarrativa.style.opacity = "1";
  } catch (error) {
    console.error("Falha ao carregar dados da ESPN:", error);
    if (containerNarrativa) {
      containerNarrativa.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar dados: ${error.message}</p>
          <button onclick="location.reload()">
            <i class="fas fa-sync-alt"></i> Tentar novamente
          </button>
        </div>
      `;
    }
  } finally {
    if (loadingNarrativa) loadingNarrativa.style.display = "none";
  }
}

function processarComentariosESPN(comentarios, timeCasa, timeVisitante) {
  const eventosAgrupados = {};
  const regexTempo = /^(\d{1,3}'\+\d+'|\d{1,3}')/;
  let jogoEncerrado = false;
  let encontrouFimDoJogo = false;

  // Pré-compilar regex para melhor performance
  const regexTimeCasa = new RegExp(timeCasa, "i");
  const regexTimeVisitante = new RegExp(timeVisitante, "i");
  const regexFimJogo = /Fim do Jogo|Fim do segundo tempo/i;

  // Processa todos os comentários
  for (let i = 0; i < comentarios.length; i++) {
    const comentario = comentarios[i];
    
    // Verifica se é o fim do jogo
    if (regexFimJogo.test(comentario)) {
      jogoEncerrado = true;
      encontrouFimDoJogo = true;
    }

    // Ignora todos os comentários após encontrar "Fim do Jogo"
    if (encontrouFimDoJogo) break;

    // Extrai o tempo do comentário
    const tempoMatch = comentario.match(regexTempo);
    const tempo = tempoMatch ? tempoMatch[0] : "-";
    const descricao = tempoMatch ? comentario.replace(tempoMatch[0], "").trim() : comentario;

    // Determina o tipo de evento
    const tipoEvento = determinarTipoEvento(descricao);

    // Identifica times mencionados
    const times = [];
    if (regexTimeCasa.test(descricao)) times.push(timeCasa);
    if (regexTimeVisitante.test(descricao)) times.push(timeVisitante);

    // Agrupa por tempo
    if (!eventosAgrupados[tempo]) {
      eventosAgrupados[tempo] = { tempo, eventos: [] };
    }

    eventosAgrupados[tempo].eventos.push({
      descricao,
      times,
      tipoEvento
    });
  }

  // Atualiza o status global do jogo
  if (jogoEncerrado) {
    jogoEncerradoGlobal = true;
    atualizarStatusJogo(true);
  }

  return Object.values(eventosAgrupados);
}

async function carregarEstatisticasESPN(timeCasa, timeVisitante) {
  const loadingEstatisticas = document.querySelector(".loading-estatisticas");
  const containerEstatisticas = document.getElementById("match-container");

  try {
    if (loadingEstatisticas) loadingEstatisticas.style.display = "flex";
    if (containerEstatisticas) containerEstatisticas.style.opacity = "0.7";

    // Usar jogoID fixo para testes (substitua pelo ID real quando necessário)
    const jogoId = '732696';
    
    // Carregar estatísticas do endpoint de teste
    const response = await fetch(`/api/espn/estatisticas/${jogoId}`);
    const estatisticas = await response.json();

    if (!estatisticas) {
      throw new Error("Não foi possível carregar as estatísticas");
    }

    // Mapeamento de ícones para estatísticas
    const statIcons = {
      "Cartões Amarelos": '<i class="fas fa-square yellow-card"></i>',
      "Cartões Vermelhos": '<i class="fas fa-square red-card"></i>',
      Escanteios: '<i class="fas fa-flag"></i>',
      "Posse de Bola (%)": '<i class="fas fa-futbol"></i>',
      "Chutes a Gol": '<i class="fas fa-bullseye"></i>',
      "Chutes para Fora": '<i class="fas fa-times-circle"></i>',
      Defesas: '<i class="fas fa-hand-paper"></i>',
      Faltas: '<i class="fas fa-exclamation-triangle"></i>',
    };

    // Renderizar estatísticas
    containerEstatisticas.innerHTML = `
      <div class="match-header">
        <div class="team home-team">
          <img src="${jogoAoVivo?.escudoCasa || obterEscudoTime(timeCasa)}" alt="${timeCasa}" width="60" height="60">
          <h2>${timeCasa}</h2>
        </div>

        <div class="team away-team">
          <img src="${jogoAoVivo?.escudoVisitante || obterEscudoTime(timeVisitante)}" alt="${timeVisitante}" width="60" height="60">
          <h2>${timeVisitante}</h2>
        </div>
      </div>
      <table class="stats-table">
        <thead>
          <tr>
            <th>ESTATÍSTICAS</th>
            <th>CASA</th>
            <th>VISITANTE</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries({
            "Cartões Amarelos": estatisticas.cartoesAmarelos || { casa: 0, visitante: 0 },
            "Cartões Vermelhos": estatisticas.cartoesVermelhos || { casa: 0, visitante: 0 },
            Escanteios: estatisticas.escanteios || { casa: 0, visitante: 0 },
            "Posse de Bola (%)": estatisticas.posse || { casa: 0, visitante: 0 },
            "Chutes a Gol": estatisticas.chutesNoGol || { casa: 0, visitante: 0 },
            "Chutes para Fora": estatisticas.chutes || { casa: 0, visitante: 0 },
            Defesas: estatisticas.defesas || { casa: 0, visitante: 0 },
            Faltas: estatisticas.faltas || { casa: 0, visitante: 0 },
          })
            .map(
              ([name, values]) => `
            <tr>
              <td>${statIcons[name] || ""} ${name}</td>
              <td class="home-stat">${values.casa}</td>
              <td class="away-stat">${values.visitante}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;

    if (loadingEstatisticas) loadingEstatisticas.style.display = "none";
    if (containerEstatisticas) containerEstatisticas.style.opacity = "1";
  } catch (error) {
    console.error("Erro ao carregar estatísticas:", error);
    if (containerEstatisticas) {
      containerEstatisticas.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar estatísticas: ${error.message}</p>
          <button onclick="location.reload()">
            <i class="fas fa-sync-alt"></i> Tentar novamente
          </button>
        </div>
      `;
    }
  }
}

function mostrarMensagemSemJogo() {
  const container = document.getElementById("narrativa-jogo");
  if (!container) return;

  container.innerHTML = `
    <div class="nenhum-jogo">
      <i class="fas fa-futbol"></i>
      <h3>Nenhum jogo ao vivo no momento</h3>
      <p>Quando houver uma partida em andamento, você poderá acompanhar aqui minuto a minuto.</p>
      <button id="btn-atualizar-jogo" class="btn-atualizar">
        <i class="fas fa-sync-alt"></i> Verificar novamente
      </button>
    </div>
  `;

  document.getElementById("btn-atualizar-jogo")?.addEventListener("click", async () => {
    try {
      const response = await fetch('/api/espn/jogo-ao-vivo');
      const data = await response.json();
      
      if (data.jogoId) {
        await atualizarTudo();
      } else {
        mostrarMensagemSemJogo();
      }
    } catch (error) {
      console.error("Erro ao verificar jogo:", error);
      mostrarMensagemSemJogo();
    }
  });
}
// ===================== ESCUDOS DOS TIMES =====================
function obterEscudoTime(nomeTime) {
  if (!nomeTime || nomeTime.trim() === "")
    return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
  const escudos = {
    Flamengo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/50px-Flamengo-RJ_%28BRA%29.png",
    Palmeiras: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/50px-Palmeiras_logo.svg.png",
    "Red Bull Bragantino": "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
    Cruzeiro: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
    Fluminense: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/50px-FFC_crest.svg.png",
    Internacional: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/50px-SC_Internacional_Brazil_Logo.svg.png",
    Bahia: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
    "São Paulo": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/50px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
    Botafogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/50px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
    Ceará: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/50px-Cear%C3%A1_Sporting_Club_logo.svg.png",
    Vasco: "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
    Corinthians: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
    Juventude: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/50px-EC_Juventude.svg.png",
    Mirassol: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
    Fortaleza: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/50px-Fortaleza_EC_2018.png",
    Vitória: "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
    "Atlético-MG": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/50px-Atletico_mineiro_galo.png",
    Grêmio: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/50px-Gremio_logo.svg.png",
    Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
    Sport: "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
    "Vila Nova": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/50px-Vila_Nova_Logo_Oficial.svg.png",
    "Mushuc Runa": "https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
    Palestino: "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
    "Unión (Santa Fe)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/50px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
  };
  const nomeLower = nomeTime.toLowerCase().trim();
  for (const [key, value] of Object.entries(escudos)) {
    if (key.toLowerCase() === nomeLower) return value;
  }
  for (const [key, value] of Object.entries(escudos)) {
    if (key.toLowerCase().includes(nomeLower) || nomeLower.includes(key.toLowerCase())) {
      return value;
    }
  }
  return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
}

// ===================== EVENTOS DO DOM =====================
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const container = document.getElementById("narrativa-jogo");
  if (container) {
    container.addEventListener("scroll", () => {
      atualizarBotaoDescer(container);
    });
  }
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
    
    // Fechar menu quando um link é clicado
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
  }
});

function atualizarBotaoDescer(container) {
  const btnDescer = document.getElementById("btn-descer");
  if (!btnDescer) return;

  const isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 10;
  
  if (!isAtBottom) {
    btnDescer.style.display = "flex";
    btnDescer.classList.add("pulse");
  } else {
    btnDescer.style.display = "none";
    btnDescer.classList.remove("pulse");
  }

  btnDescer.onclick = () => {
    container.scrollTop = container.scrollHeight;
    btnDescer.style.display = "none";
    btnDescer.classList.remove("pulse");
  };
}