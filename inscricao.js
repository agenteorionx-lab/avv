// Estado global da Inscrição em memória para testes locais
const state = {
  currentStep: 1,
  data: {
    campeonato: '',
    modalidade: '',
    categorias: [],
    nomeTime: '',
    siglaTime: '',
    cidade: 'Vilhena',
    estado: 'RO',
    responsavelNome: '',
    responsavelCargo: 'Técnico',
    email: '',
    whatsapp: '',
    instagram: '',
    observacoes: ''
  }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupChampSelection();
  setupCategorySelection();
  setupPhoneMask();
  setupStepButtons();
});

// 1. Seleção visual do Campeonato
function setupChampSelection() {
  const cards = document.querySelectorAll('.champ-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.data.campeonato = card.dataset.champ;
      state.data.modalidade = card.dataset.type;
    });
  });

  // Pré-selecionar o primeiro
  if (cards.length > 0) {
    cards[0].click();
  }
}

// 2. Seleção de Categorias (Multi-check)
function setupCategorySelection() {
  const checkboxes = document.querySelectorAll('input[name="categoria"]');
  checkboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      state.data.categorias = Array.from(checkboxes)
        .filter(c => c.checked)
        .map(c => c.value);
    });
  });
}

// 3. Máscara de Telefone / WhatsApp
function setupPhoneMask() {
  const input = document.getElementById('whatsapp');
  if (!input) return;

  input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    
    if (val.length > 6) {
      val = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
    } else if (val.length > 2) {
      val = `(${val.substring(0, 2)}) ${val.substring(2)}`;
    } else if (val.length > 0) {
      val = `(${val}`;
    }
    e.target.value = val;
  });
}

// 4. Navegação dos Passos (Steps)
function setupStepButtons() {
  // Próximo do Passo 1
  document.getElementById('btn-step-1')?.addEventListener('click', () => {
    if (!state.data.campeonato) {
      alert('Por favor, selecione um campeonato.');
      return;
    }
    if (state.data.categorias.length === 0) {
      alert('Selecione pelo menos uma categoria de disputa.');
      return;
    }
    goToStep(2);
  });

  // Voltar do Passo 2
  document.getElementById('btn-back-2')?.addEventListener('click', () => goToStep(1));

  // Próximo do Passo 2
  document.getElementById('btn-step-2')?.addEventListener('click', () => {
    const nomeTime = document.getElementById('nomeTime').value.trim();
    const siglaTime = document.getElementById('siglaTime').value.trim();
    const cidade = document.getElementById('cidade').value.trim();
    const estado = document.getElementById('estado').value.trim();

    if (!nomeTime || !cidade) {
      alert('Por favor, preencha o Nome do Time e a Cidade.');
      return;
    }

    state.data.nomeTime = nomeTime;
    state.data.siglaTime = siglaTime;
    state.data.cidade = cidade;
    state.data.estado = estado;
    goToStep(3);
  });

  // Voltar do Passo 3
  document.getElementById('btn-back-3')?.addEventListener('click', () => goToStep(2));

  // Próximo do Passo 3
  document.getElementById('btn-step-3')?.addEventListener('click', () => {
    const responsavelNome = document.getElementById('responsavelNome').value.trim();
    const responsavelCargo = document.getElementById('responsavelCargo').value;
    const email = document.getElementById('email').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const instagram = document.getElementById('instagram').value.trim();

    if (!responsavelNome || !email || !whatsapp) {
      alert('Por favor, preencha o Nome do Responsável, E-mail e WhatsApp.');
      return;
    }

    state.data.responsavelNome = responsavelNome;
    state.data.responsavelCargo = responsavelCargo;
    state.data.email = email;
    state.data.whatsapp = whatsapp;
    state.data.instagram = instagram;

    renderReview();
    goToStep(4);
  });

  // Voltar do Passo 4
  document.getElementById('btn-back-4')?.addEventListener('click', () => goToStep(3));

  // Concluir Inscrição
  document.getElementById('btn-submit-final')?.addEventListener('click', () => {
    salvarInscricaoMock();
  });
}

function goToStep(stepNumber) {
  state.currentStep = stepNumber;

  // Atualizar Telas
  document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
  const currentStepEl = document.getElementById(`step-${stepNumber}`);
  if (currentStepEl) currentStepEl.classList.add('active');

  // Atualizar Indicadores
  for (let i = 1; i <= 4; i++) {
    const item = document.getElementById(`step-nav-${i}`);
    if (!item) continue;
    item.classList.remove('active', 'completed');
    if (i === stepNumber) {
      item.classList.add('active');
    } else if (i < stepNumber) {
      item.classList.add('completed');
    }
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Renderiza o resumo no Passo 4
function renderReview() {
  document.getElementById('rev-campeonato').textContent = `${state.data.campeonato} (${state.data.modalidade})`;
  document.getElementById('rev-categorias').textContent = state.data.categorias.join(', ');
  document.getElementById('rev-time').textContent = state.data.siglaTime ? `${state.data.nomeTime} (${state.data.siglaTime})` : state.data.nomeTime;
  document.getElementById('rev-local').textContent = `${state.data.cidade} - ${state.data.estado}`;
  document.getElementById('rev-responsavel').textContent = `${state.data.responsavelNome} (${state.data.responsavelCargo})`;
  document.getElementById('rev-contato').textContent = `${state.data.email} | ${state.data.whatsapp}`;
}

// Salva em LocalStorage para testes e exibe tela de sucesso
function salvarInscricaoMock() {
  // Salva lista local para testes
  const inscricoesSalvas = JSON.parse(localStorage.getItem('avv_inscricoes_teste') || '[]');
  const novaInscricao = {
    id: Date.now(),
    protocolo: 'AVV-' + Math.floor(100000 + Math.random() * 900000),
    dataHora: new Date().toISOString(),
    status: 'Pré-Inscrição Recebida',
    ...state.data
  };
  inscricoesSalvas.push(novaInscricao);
  localStorage.setItem('avv_inscricoes_teste', JSON.stringify(inscricoesSalvas));

  // Esconde passos e exibe tela de sucesso
  document.querySelectorAll('.form-step').forEach(s => s.style.display = 'none');
  document.querySelector('.steps-nav').style.display = 'none';
  
  const successScreen = document.getElementById('step-success');
  successScreen.style.display = 'block';
  document.getElementById('protocolo-gerado').textContent = novaInscricao.protocolo;
  document.getElementById('sucesso-time-nome').textContent = novaInscricao.nomeTime;
}
