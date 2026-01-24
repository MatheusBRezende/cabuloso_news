// ===================== CONFIGURAÇÕES GLOBAIS =====================
const CONFIG = {
  planilhaId: "1Gb4nJXfxEDPFhseyZtKs1X3--lTsti1_ZTwPLk9MnBs",
  nomeAba: "minutoaminuto",
  intervaloPadrao: window.innerWidth <= 10000,
  coresPadrao: {
    casa: { primary: '#003399', secondary: '#ffffff' },
    visitante: { primary: '#cc0000', secondary: '#ffffff' }
  }
};

async function loadColorThief() {
  if (typeof ColorThief === 'undefined') {
    await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js');
    colorThiefLoaded = true;
  }
}
// ===================== VARIÁVEIS GLOBAIS =====================
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
  const config = {
    planilhaId: "1Gb4nJXfxEDPFhseyZtKs1X3--lTsti1_ZTwPLk9MnBs",
    nomeAba: "minutoaminuto",
    nomeAbaEstatisticas: "minutoaminuto",
  };

  
  // Recupera dados do jogo
  const urlParams = new URLSearchParams(window.location.search);
  const jogoSalvo = localStorage.getItem("jogoAoVivo");
  jogoAoVivo = {
    timeCasa: urlParams.get("timeCasa") || (jogoSalvo ? JSON.parse(jogoSalvo).timeCasa : "Time Casa"),
    timeVisitante: urlParams.get("timeVisitante") || (jogoSalvo ? JSON.parse(jogoSalvo).timeVisitante : "Time Visitante"),
    escudoCasa: urlParams.get("escudoCasa") || 
               (jogoSalvo ? JSON.parse(jogoSalvo).escudoCasa : obterEscudoTime(urlParams.get("timeCasa"))),
    escudoVisitante: urlParams.get("escudoVisitante") || 
                   (jogoSalvo ? JSON.parse(jogoSalvo).escudoVisitante : obterEscudoTime(urlParams.get("timeVisitante"))),
    campeonato: urlParams.get("campeonato") || (jogoSalvo ? JSON.parse(jogoSalvo).campeonato : "Campeonato"),
    planilhaId: CONFIG.planilhaId,
  };

  Object.keys(jogoAoVivo).forEach((key) => {
    if (jogoAoVivo[key] === null || jogoAoVivo[key] === undefined) {
      jogoAoVivo[key] = "";
    }
  });

  localStorage.setItem("jogoAoVivo", JSON.stringify(jogoAoVivo));
  atualizarInformacoesJogo(jogoAoVivo);


  // Botão de atualização manual
  const btnAtualizar = document.getElementById("atualizar-dados");
  if (btnAtualizar) {
    btnAtualizar.addEventListener("click", async () => {
      btnAtualizar.classList.add("pulsing");
      btnAtualizar.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Atualizando...';
      try {
        await Promise.all([
          carregarDadosDaPlanilha(config.planilhaId, apiKey, config.nomeAba, jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante, jogoAoVivo.escudoCasa, jogoAoVivo.escudoVisitante),
          carregarEstatisticas(config.planilhaId, apiKey, config.nomeAbaEstatisticas, jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante),
        ]);
      } catch (error) {
        console.error("Erro ao atualizar:", error);
      } finally {
        btnAtualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados';
        setTimeout(() => btnAtualizar.classList.remove("pulsing"), 1000);
      }
    });
  }

  // Carrega dados inicialmente
  try {
    await Promise.all([
      carregarDadosDaPlanilha(config.planilhaId, apiKey, config.nomeAba, jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante, jogoAoVivo.escudoCasa, jogoAoVivo.escudoVisitante),
      carregarEstatisticas(config.planilhaId, apiKey, config.nomeAbaEstatisticas, jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante),
    ]);
  } catch (error) {
    console.error("Erro no carregamento inicial:", error);
  }

  // Atualização automática (mais lenta em mobile)
  const INTERVALO_PADRAO = 10000; // 1 minuto para todos os dispositivos
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
  if (jogoEncerradoGlobal) {
    clearInterval(intervaloAtualizacao);
    return;
  }

  // Verificar conexão antes de atualizar
  if (!navigator.onLine) {
    console.log("Sem conexão - pulando atualização");
    return;
  }

  try {
    console.log("Iniciando atualização automática...");
    await Promise.all([
      carregarDadosDaPlanilha(jogoAoVivo.planilhaId, apiKey, "minutoaminuto", 
                             jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante, 
                             jogoAoVivo.escudoCasa, jogoAoVivo.escudoVisitante),
      carregarEstatisticas(jogoAoVivo.planilhaId, apiKey, "minutoaminuto", 
                         jogoAoVivo.timeCasa, jogoAoVivo.timeVisitante)
    ]);
    console.log("Atualização automática concluída com sucesso");
  } catch (error) {
    console.error("Erro na atualização automática:", error);
    // Se falhar, tentar novamente em 30 segundos
    clearInterval(intervaloAtualizacao);
    intervaloAtualizacao = setInterval(atualizarTudo, 30000);
  }
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
  if (encerrado) {
    statusElement.textContent = "Encerrado";
    statusElement.className = "status-badge status-encerrado";
    const btnAtualizar = document.getElementById("atualizar-dados");
    if (btnAtualizar) btnAtualizar.style.display = "none";
    if (intervaloAtualizacao) clearInterval(intervaloAtualizacao);
  } else if (emIntervalo) {
    statusElement.textContent = "Intervalo";
    statusElement.className = "status-badge status-intervalo";
  } else {
    statusElement.textContent = "Ao vivo";
    statusElement.className = "status-badge status-ao-vivo";
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

async function extrairCoresDoEscudo(imagemUrl, time) {
  
  const nomeTime = time === 'casa' ? jogoAoVivo.timeCasa : jogoAoVivo.timeVisitante;
  
  
  if (!nomeTime) {
    return time === 'casa' ? CONFIG.coresPadrao.casa : CONFIG.coresPadrao.visitante;
  }

  // Tratamento especial para times conhecidos
  const timeLower = nomeTime.toLowerCase();
  
  if (timeLower.includes('cruzeiro')) {
    return { primary: '#0055A8', secondary: '#FFFFFF' };
  }

  
  if (!document.getElementById('auto-colors')?.checked) {
    return time === 'casa' ? CONFIG.coresPadrao.casa : CONFIG.coresPadrao.visitante;
  }

  // Extração de cores da imagem
  return await extrairCoresDominantes(imagemUrl);
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
  
  // Verifica se já existem eventos carregados
  const isUpdate = container.querySelector(".grupo-tempo") !== null;
  const eventosOrdenados = [...eventosAgrupados].reverse();
  const eventosAnteriores = container.querySelectorAll(".grupo-tempo").length;

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

  // Cria o HTML dos eventos
  const eventosHTML = eventosOrdenados.map(grupo => `
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

  // Só atualiza se mudou
  if (container._ultimoEventosHTML === eventosHTML) return;
  container._ultimoEventosHTML = eventosHTML;

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

  // Verifica se há novos eventos
  const eventosAtuais = container.querySelectorAll(".grupo-tempo");
  const eventosNovos = eventosAtuais.length - eventosAnteriores;

  // Scroll para o final se houver novos eventos
  if (isUpdate && eventosNovos > 0) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
      
      // Mostra notificação de novos eventos (opcional)
      if (eventosNovos > 0 && !document.querySelector(".novo-indicador")) {
        const indicador = document.createElement("div");
        indicador.className = "novo-indicador";
        indicador.textContent = `${eventosNovos} novo${eventosNovos > 1 ? "s" : ""} lance${eventosNovos > 1 ? "s" : ""}`;
        container.appendChild(indicador);
        setTimeout(() => indicador.remove(), 5000);
      }
    }, 100);
  }

  // Atualiza o botão de descer
  atualizarBotaoDescer(container);
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
async function carregarDadosDaPlanilha(planilhaId, apiKey, nomeAba, timeCasa, timeVisitante, escudoCasa, escudoVisitante) {
  const loadingNarrativa = document.querySelector(".loading-narrativa");
  const containerNarrativa = document.getElementById("narrativa-jogo");
  if (jogoEncerradoGlobal) {
    if (loadingNarrativa) loadingNarrativa.style.display = "none";
    if (containerNarrativa) containerNarrativa.style.opacity = "1";
    return;
  }
  try {
    if (loadingNarrativa) loadingNarrativa.style.display = "flex";
    if (containerNarrativa) containerNarrativa.style.opacity = "0.7";
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${planilhaId}/values/${nomeAba}?key=${apiKey}`
    );
    if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
    const data = await response.json();
    if (!data.values || data.values.length === 0) throw new Error("Planilha vazia ou sem dados");
    const dadosString = JSON.stringify(data.values);
    if (carregarDadosDaPlanilha._ultimoDados === dadosString) {
      if (containerNarrativa) containerNarrativa.style.opacity = "1";
      if (loadingNarrativa) loadingNarrativa.style.display = "none";
      return;
    }
    carregarDadosDaPlanilha._ultimoDados = dadosString;
    const eventos = processarEventos(data.values, timeCasa, timeVisitante);
    exibirEventos(eventos);
    if (containerNarrativa) containerNarrativa.style.opacity = "1";
  } catch (error) {
    console.error("Falha ao carregar dados:", error);
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

async function carregarEstatisticas(planilhaId, apiKey, nomeAba, timeCasa, timeVisitante) {
  const loadingEstatisticas = document.querySelector(".loading-estatisticas");
  const containerEstatisticas = document.getElementById("match-container");
  try {
    if (loadingEstatisticas) loadingEstatisticas.style.display = "flex";
    if (containerEstatisticas) containerEstatisticas.style.opacity = "0.7";
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${planilhaId}/values/${nomeAba}!C2:J3?key=${apiKey}`
    );
    if (!response.ok) throw new Error(`Erro ao buscar dados: ${response.status}`);
    const data = await response.json();
    const statsData = data.values;
    if (!statsData || statsData.length <= 1) throw new Error("Dados insuficientes na planilha de estatísticas");
    const getValue = (row, col) => statsData[row]?.[col] || "0";
    const getNumericValue = (row, col) => {
      const raw = getValue(row, col).replace(",", ".").replace(/[^\d.]/g, "");
      return parseFloat(raw) || 0;
    };
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
    const stats = {
      posse: { home: getNumericValue(0, 0), away: getNumericValue(1, 0) },
      chutesNoGol: { home: getNumericValue(0, 1), away: getNumericValue(1, 1) },
      chutes: { home: getNumericValue(0, 2), away: getNumericValue(1, 2) },
      faltas: { home: getNumericValue(0, 3), away: getNumericValue(1, 3) },
      cartoesAmarelos: { home: getNumericValue(0, 4), away: getNumericValue(1, 4) },
      cartoesVermelhos: { home: getNumericValue(0, 5), away: getNumericValue(1, 5) },
      escanteios: { home: getNumericValue(0, 6), away: getNumericValue(1, 6) },
      defesas: { home: getNumericValue(0, 7), away: getNumericValue(1, 7) },
    };
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
            "Cartões Amarelos": stats.cartoesAmarelos,
            "Cartões Vermelhos": stats.cartoesVermelhos,
            Escanteios: stats.escanteios,
            "Posse de Bola (%)": stats.posse,
            "Chutes a Gol": stats.chutesNoGol,
            "Chutes para Fora": stats.chutes,
            Defesas: stats.defesas,
            Faltas: stats.faltas,
          })
            .map(
              ([name, values]) => `
            <tr>
              <td>${statIcons[name] || ""} ${name}</td>
              <td class="home-stat">${values.home}</td>
              <td class="away-stat">${values.away}</td>
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

// ===================== ESCUDOS DOS TIMES =====================
function obterEscudoTime(nomeTime) {
  if (!nomeTime || nomeTime.trim() === "") {
    return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
  }
  const escudos = {
  Flamengo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/50px-Flamengo-RJ_%28BRA%29.png",
  Palmeiras: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/50px-Palmeiras_logo.svg.png",
  "Red Bull Bragantino": "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
  Cruzeiro:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  Fluminense: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/50px-FFC_crest.svg.png",
  Internacional:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/50px-SC_Internacional_Brazil_Logo.svg.png",
  Bahia: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
  "São Paulo":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/50px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
  Botafogo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/50px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
  Ceará:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/50px-Cear%C3%A1_Sporting_Club_logo.svg.png",
  Vasco: "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
  Corinthians: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
  Juventude: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/50px-EC_Juventude.svg.png",
  Mirassol: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
  Fortaleza:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/50px-Fortaleza_EC_2018.png",
  Vitória: "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
  "Atlético-MG":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/50px-Atletico_mineiro_galo.png",
  Grêmio: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/50px-Gremio_logo.svg.png",
  Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
  Sport: "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
  "Vila Nova":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/50px-Vila_Nova_Logo_Oficial.svg.png",
    CRB:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/CRB_logo.svg/1024px-CRB_logo.svg.png",
  };
  const nomeLower = nomeTime.toLowerCase().trim();
  
  // Verifica correspondência exata primeiro
  for (const [key, value] of Object.entries(escudos)) {
    if (key.toLowerCase() === nomeLower) return value;
  }

  // Verifica correspondência parcial
  for (const [key, value] of Object.entries(escudos)) {
    if (nomeLower.includes(key.toLowerCase()) || key.toLowerCase().includes(nomeLower)) {
      return value;
    }
  }

  // Fallback para placeholder
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