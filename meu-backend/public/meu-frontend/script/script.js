// Menu Toggle para dispositivos móveis
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const menu = document.getElementById('menu');
    
    if (menuToggle && menu) {
        menuToggle.addEventListener('click', function() {
            menu.classList.toggle('active');
        });
    }
    
    // Fechar menu ao clicar em um link
    const menuLinks = document.querySelectorAll('#menu a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function() {
            menu.classList.remove('active');
        });
    });
        
    // Formulário de Newsletter
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            
            // Simulação de envio (em um site real, isso seria enviado para um servidor)
            alert(`Obrigado por se inscrever! Você receberá as notícias no email: ${email}`);
            this.reset();
        });
    }
    
    // Botão "Carregar mais notícias"
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            loadMoreNews();
        });
    }
});

// Função para carregar mais notícias (simulação)
function loadMoreNews() {
    const newsGrid = document.querySelector('.news-grid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    // Notícias adicionais para carregar
    const additionalNews = [
        {
            image: 'https://via.placeholder.com/400x250/003399/ffffff?text=Noticia+5',
            category: 'Treino',
            title: 'Equipe realiza treino tático visando próximo desafio',
            content: 'Jogadores participaram de atividades específicas para aprimorar o sistema defensivo.',
            time: 'Há 2 dias'
        },
        {
            image: 'https://via.placeholder.com/400x250/003399/ffffff?text=Noticia+6',
            category: 'Lesão',
            title: 'Atacante se recupera de lesão e deve retornar em breve',
            content: 'Departamento médico atualiza situação do jogador que está em fase final de recuperação.',
            time: 'Há 2 dias'
        },
        {
            image: 'https://via.placeholder.com/400x250/003399/ffffff?text=Noticia+7',
            category: 'Mercado',
            title: 'Cruzeiro monitora lateral-direito do futebol europeu',
            content: 'Diretoria busca reforçar o elenco com jogador experiente para a sequência da temporada.',
            time: 'Há 3 dias'
        },
        {
            image: 'https://via.placeholder.com/400x250/003399/ffffff?text=Noticia+8',
            category: 'História',
            title: 'Há 20 anos: relembre a conquista histórica da Tríplice Coroa',
            content: 'Nesta data, o Cruzeiro completava uma das campanhas mais vitoriosas de sua história.',
            time: 'Há 3 dias'
        }
    ];
    
    // Adiciona as novas notícias ao grid
    additionalNews.forEach(news => {
        const newsCard = document.createElement('article');
        newsCard.className = 'news-card';
        newsCard.innerHTML = `
            <div class="news-image">
                <img src="${news.image}" alt="Notícia do Cruzeiro">
            </div>
            <div class="news-content">
                <span class="category">${news.category}</span>
                <h3>${news.title}</h3>
                <p>${news.content}</p>
                <span class="date">${news.time}</span>
                <a href="#" class="read-more">Ler mais</a>
            </div>
        `;
        
        // Adiciona efeito de fade-in
        newsCard.style.opacity = '0';
        newsGrid.appendChild(newsCard);
        
        // Força um reflow para que a transição funcione
        void newsCard.offsetWidth;
        
        // Aplica a transição
        newsCard.style.transition = 'opacity 0.5s ease';
        newsCard.style.opacity = '1';
    });
    
    // Esconde o botão após carregar mais notícias
    loadMoreBtn.textContent = 'Todas as notícias carregadas';
    loadMoreBtn.disabled = true;
    loadMoreBtn.style.opacity = '0.5';
}

// Função para simular o carregamento de conteúdo dinâmico
function simulateLoading() {
    // Aqui você poderia implementar chamadas AJAX para buscar conteúdo de um servidor
    console.log('Carregando conteúdo dinâmico...');
}

// Adiciona efeito de scroll suave para links internos
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80, // Ajuste para o header fixo
                behavior: 'smooth'
            });
        }
    });
});

// Função para carregar a mini tabela
async function loadMiniTable() {
    try {
        const response = await fetch(
            'https://sheets.googleapis.com/v4/spreadsheets/1ubZ_5cXZYLLcFQnHGAqsWMDn59arVI8JynTpf4-kOa0/values/A1:M6?key=AIzaSyACnLooxGcu7L_QRNoqZpYvmKirsbuIVi8'
        );
        const data = await response.json();
        
        let html = '';
        data.values.slice(1, 6).forEach((row, index) => {
            const isCruzeiro = row[1].includes('Cruzeiro');
            html += `
                <tr class="${isCruzeiro ? 'cruzeiro-row' : ''}">
                    <td>${index + 1}º</td>
                    <td class="team-cell">
                        <img src="${getTeamLogo(row[1])}" class="team-logo" alt="${row[1]}">
                        ${row[1].replace(/^\d+°\s*/, '').replace(/\s[A-Z]{2,4}$/, '')}
                    </td>
                    <td>${row[2] || 0}</td>
                </tr>
            `;
        });
        
        // Adiciona link para o Cruzeiro se não estiver no top 5
        if (!html.includes('cruzeiro-row')) {
            const cruzeiroRow = data.values.find(row => row[1].includes('Cruzeiro'));
            if (cruzeiroRow) {
                const pos = parseInt(cruzeiroRow[0]);
                html += `
                    <tr class="cruzeiro-row">
                        <td>${pos}º</td>
                        <td class="team-cell">
                            <img src="${getTeamLogo(cruzeiroRow[1])}" class="team-logo" alt="${cruzeiroRow[1]}">
                            ${cruzeiroRow[1].replace(/^\d+°\s*/, '').replace(/\s[A-Z]{2,4}$/, '')}
                        </td>
                        <td>${cruzeiroRow[2] || 0}</td>
                    </tr>
                `;
            }
        }
        
        document.getElementById('mini-tabela').innerHTML = html;
    } catch (error) {
        document.getElementById('mini-tabela').innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 20px 0; color: #666;">
                    <i class="fas fa-exclamation-triangle"></i> Dados não disponíveis
                </td>
            </tr>
        `;
    }
}

// Função para carregar mini resultados
async function loadMiniResults() {
  try {
    const response = await fetch(
      "https://sheets.googleapis.com/v4/spreadsheets/12LrzrOnzSwScp-9PzKrtq13ElgTUpWxo3BDp4Y82Dm0/values/A1:F6?key=AIzaSyACnLooxGcu7L_QRNoqZpYvmKirsbuIVi8",
    )
    const data = await response.json()
        
        let html = '';
        data.values.slice(1, 4).forEach(row => {
            const isCruzeiro = row[1].includes('Cruzeiro') || row[3].includes('Cruzeiro');
            const scoreParts = row[2]?.split(/(?=[A-Za-z])/) || ['-'];
            
            html += `
                <div class="mini-result">
                    <div class="mini-teams">
                        <div class="mini-team ${row[1].includes('Cruzeiro') ? 'cruzeiro' : ''}">
                            <img src="${getTeamLogo(row[1])}" class="mini-team-logo">
                            <span>${row[1].includes('Cruzeiro') ? 'Cruzeiro' : row[1].split(' ').slice(-1)[0]}</span>
                        </div>
                        <div class="mini-score">${scoreParts[0].trim()}</div>
                        <div class="mini-team ${row[3].includes('Cruzeiro') ? 'cruzeiro' : ''}">
                            <span>${row[3].includes('Cruzeiro') ? 'Cruzeiro' : row[3].split(' ').slice(-1)[0]}</span>
                            <img src="${getTeamLogo(row[3])}" class="mini-team-logo">
                        </div>
                    </div>
                    <div class="mini-competition">
                        ${row[0]} • ${row[5] || 'Amistoso'}
                    </div>
                </div>
            `;
        });
        
        document.getElementById('mini-resultados').innerHTML = html;
    } catch (error) {
        document.getElementById('mini-resultados').innerHTML = `
            <div class="mini-result" style="color: #666; text-align: center;">
                <i class="fas fa-exclamation-triangle"></i> Dados não disponíveis
            </div>
        `;
    }
}

// Função para carregar próximos jogos
async function loadNextMatches() {
    try {
        const response = await fetch(
            'https://sheets.googleapis.com/v4/spreadsheets/1i3KjyXbLnyC-zt6ByPuuZFRe96PfhiXJRFGCPYG7l1c/values/PARTIDAS?key=AIzaSyACnLooxGcu7L_QRNoqZpYvmKirsbuIVi8'
        );
        const data = await response.json();
        
        let html = '';
        let count = 0;
        
        for (let i = 1; i < data.values.length && count < 3; i++) {
            const row = data.values[i];
            if (!row[0] || !row[1] || !row[3]) continue;
            
            const isCruzeiro = row[1].includes('Cruzeiro') || row[3].includes('Cruzeiro');
            if (!isCruzeiro && count > 0) continue;
            
            const hoje = new Date();
            const [dia, mes] = row[0].split('/');
            const dataJogo = new Date(hoje.getFullYear(), parseInt(mes) - 1, parseInt(dia));
            
            if (dataJogo < hoje) continue;
            
            const isLive = row[7] === 'LIVE' || row[7] === 'AO VIVO';
            
            html += `
                <div class="next-match">
                    <div class="match-date">
                        ${row[0]} • ${row[7] === 'LIVE' ? '<span class="live-badge">AO VIVO</span>' : row[7]}
                    </div>
                    <div class="match-teams">
                        <div class="match-team ${row[1].includes('Cruzeiro') ? 'cruzeiro' : ''}">
                            <img src="${getTeamLogo(row[1])}" class="match-team-logo">
                            <span>${row[1].includes('Cruzeiro') ? 'Cruzeiro' : row[1].split(' ').slice(-1)[0]}</span>
                        </div>
                        <span class="match-vs">vs</span>
                        <div class="match-team ${row[3].includes('Cruzeiro') ? 'cruzeiro' : ''}">
                            <span>${row[3].includes('Cruzeiro') ? 'Cruzeiro' : row[3].split(' ').slice(-1)[0]}</span>
                            <img src="${getTeamLogo(row[3])}" class="match-team-logo">
                        </div>
                    </div>
                    <div class="match-info">
                        <span>${row[5] || 'Amistoso'}</span>
                        <span>${row[6] || 'Local a definir'}</span>
                    </div>
                </div>
            `;
            
            count++;
        }
        
        document.getElementById('proximos-jogos').innerHTML = html || `
            <div class="next-match" style="color: #666; text-align: center;">
                <i class="fas fa-calendar-times"></i> Nenhum jogo agendado
            </div>
        `;
    } catch (error) {
        document.getElementById('proximos-jogos').innerHTML = `
            <div class="next-match" style="color: #666; text-align: center;">
                <i class="fas fa-exclamation-triangle"></i> Dados não disponíveis
            </div>
        `;
    }
}

// Função auxiliar para obter logos
function getTeamLogo(teamName) {
    const logos = {
    "Flamengo": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/500px-Flamengo-RJ_%28BRA%29.png",
    "Palmeiras": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/1280px-Palmeiras_logo.svg.png",
    "Red Bull Bragantino": "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
    "Cruzeiro": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/1280px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
    "Fluminense": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/1106px-FFC_crest.svg.png",
    "Internacional": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/1280px-SC_Internacional_Brazil_Logo.svg.png",
    "Bahia": "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
    "São Paulo": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/1284px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
    "Botafogo": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/1135px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
    "Ceará": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/1153px-Cear%C3%A1_Sporting_Club_logo.svg.png",
    "Vasco": "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
    "Corinthians": "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
    "Juventude": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/1280px-EC_Juventude.svg.png",
    "Mirassol": "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
    "Fortaleza": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/978px-Fortaleza_EC_2018.png",
    "Vitória": "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
    "Atlético-MG": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/960px-Atletico_mineiro_galo.png",
    "Grêmio": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/1074px-Gremio_logo.svg.png",
    "Santos": "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
    "Sport": "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
    "Vila Nova": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/1024px-Vila_Nova_Logo_Oficial.svg.png",
    "Mushuc Runa": "https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
    "Palestino": "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
    "Unión (Santa Fe)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/1024px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png"
    };
    
    for (const [key, value] of Object.entries(logos)) {
        if (teamName.includes(key)) return value;
    }
    
    return 'https://via.placeholder.com/40/0033a0/ffffff?text=CRU';
}

// Carrega todos os widgets quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    loadMiniTable();
    loadMiniResults();
    loadNextMatches();
});

// Script para controlar o menu hambúrguer
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.querySelector(".menu-toggle")
  const navMenu = document.querySelector(".nav-menu")

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active")
      navMenu.classList.toggle("active")

      // Prevenir scroll quando o menu está aberto
      document.body.classList.toggle("menu-open")
    })

    // Fechar o menu ao clicar em um link
    const navLinks = document.querySelectorAll(".nav-link")
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("active")
        navMenu.classList.remove("active")
        document.body.classList.remove("menu-open")
      })
    })
  }
})
