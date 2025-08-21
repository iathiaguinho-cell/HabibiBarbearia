/* ==================================================================
CONFIGURAÇÃO DO FIREBASE
==================================================================
*/
const firebaseConfig = {
    apiKey: "AIzaSyBW6CaxaYTHbOpCRDCptaYbpFi8OHabMik",
    authDomain: "habibi-ba516.firebaseapp.com",
    databaseURL: "https://habibi-ba516-default-rtdb.firebaseio.com",
    projectId: "habibi-ba516",
    storageBucket: "habibi-ba516.appspot.com",
    messagingSenderId: "744908900549",
    appId: "1:744908900549:web:f61575c692913fae3a08ac"
};

/* ==================================================================
SISTEMA DE NOTIFICAÇÕES
==================================================================
*/
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => { if (document.body.contains(notification)) document.body.removeChild(notification); }, 500);
  }, 4000);
}

/* ==================================================================
INICIALIZAÇÃO DO SISTEMA
==================================================================
*/
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  
  let currentUser = null;
  let allAtendimentos = {};
  let produtosAdicionadosState = [];
  let servicosAdicionadosState = []; // NOVO: Estado para serviços
  let configData = { servicos: [], produtos: [] };
  
  // --- DADOS DA BARBEARIA ---
  const USERS = [
    { name: 'Habibi', role: 'Gestor' }, 
    { name: 'Júnior', role: 'Barbeiro' }, 
    { name: 'Willian', role: 'Barbeiro' },
    { name: 'Recepção', role: 'Recepcionista' }
  ];
  
  const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'];
  const STATUS_LIST = ['Aguardando', 'Em-Atendimento', 'Aguardando-Pagamento', 'Finalizado'];
  
  // --- ELEMENTOS DA UI ---
  const userScreen = document.getElementById('userScreen');
  const app = document.getElementById('app');
  const userList = document.getElementById('userList');
  const kanbanBoard = document.getElementById('kanbanBoard');
  const addAtendimentoBtn = document.getElementById('addAtendimentoBtn');
  const logoutButton = document.getElementById('logoutButton');
  const atendimentoModal = document.getElementById('atendimentoModal');
  const atendimentoForm = document.getElementById('atendimentoForm');
  const detailsModal = document.getElementById('detailsModal');
  const detailsForm = document.getElementById('detailsForm');
  const deleteBtn = document.getElementById('deleteBtn');
  const reportsBtn = document.getElementById('reportsBtn');
  const reportsModal = document.getElementById('reportsModal');
  const configBtn = document.getElementById('configBtn');
  const configModal = document.getElementById('configModal');
  
  const formatStatus = (status) => status.replace(/-/g, ' ');
  const formatCurrency = (value) => `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;

  // ==================================================================
  // LÓGICA DO KANBAN
  // ==================================================================
  const initializeKanban = () => {
    kanbanBoard.innerHTML = STATUS_LIST.map(status => {
      const isFinalizado = status === 'Finalizado';
      const searchInputHTML = isFinalizado ? `
        <div class="my-2">
          <input type="search" id="searchFinalizadoInput" placeholder="Buscar por nome..." 
                 class="w-full p-2 text-sm border rounded-md">
        </div>
      ` : '';
      return `
        <div class="status-column p-4">
          <h3 class="font-bold text-gray-800 mb-4 text-center">${formatStatus(status)}</h3>
          ${searchInputHTML}
          <div class="space-y-3 client-list" data-status="${status}"></div>
        </div>`;
    }).join('');
    if (document.getElementById('searchFinalizadoInput')) {
      document.getElementById('searchFinalizadoInput').addEventListener('input', renderFinalizadoColumn);
    }
  };

  const createCardHTML = (atendimento) => {
    const currentIndex = STATUS_LIST.indexOf(atendimento.status);
    const prevStatus = currentIndex > 0 ? STATUS_LIST[currentIndex - 1] : null;
    const nextStatus = currentIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentIndex + 1] : null;
    
    const prevButton = prevStatus ? `<button data-id="${atendimento.id}" data-new-status="${prevStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100"><i class='bx bx-chevron-left text-xl'></i></button>` : `<div class="w-10 h-10"></div>`;
    const nextButton = nextStatus ? `<button data-id="${atendimento.id}" data-new-status="${nextStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100"><i class='bx bx-chevron-right text-xl'></i></button>` : `<div class="w-10 h-10"></div>`;
    
    const servicosDisplay = atendimento.servicos.map(s => typeof s === 'string' ? s : s.name).join(', ');

    return `
      <div id="${atendimento.id}" class="vehicle-card status-${atendimento.status}" data-id="${atendimento.id}">
        <div class="flex justify-between items-start">
            <div class="card-clickable-area cursor-pointer flex-grow">
              <p class="font-bold text-sm text-amber-800">#${String(atendimento.fichaNumero).padStart(4, '0')}</p>
              <p class="font-bold text-base text-gray-800">${atendimento.clienteNome}</p>
              <p class="text-sm text-gray-600 truncate">${servicosDisplay}</p>
              <p class="text-xs text-gray-500 mt-1">Barbeiro: ${atendimento.barbeiroResponsavel}</p>
              <p class="text-sm font-bold text-green-700 mt-1">${formatCurrency(atendimento.valorTotal)}</p>
            </div>
            <div class="flex flex-col -mt-1 -mr-1">${nextButton}${prevButton}</div>
        </div>
      </div>`;
  };

  const renderFinalizadoColumn = () => {
      const list = kanbanBoard.querySelector('.client-list[data-status="Finalizado"]');
      if (!list) return;
      const searchInput = document.getElementById('searchFinalizadoInput');
      const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
      let finalizados = Object.values(allAtendimentos).filter(a => a.status === 'Finalizado');
      if (searchTerm) {
          finalizados = finalizados.filter(a => a.clienteNome.toLowerCase().includes(searchTerm));
      }
      finalizados.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      list.innerHTML = finalizados.map(a => createCardHTML(a)).join('');
  };

  const listenToAtendimentos = () => {
    const ref = db.ref('atendimentos');
    ref.on('child_added', s => {
      allAtendimentos[s.key] = { ...s.val(), id: s.key };
      const atendimento = allAtendimentos[s.key];
      if (atendimento.status === 'Finalizado') {
        renderFinalizadoColumn();
      } else {
        const list = kanbanBoard.querySelector(`.client-list[data-status="${atendimento.status}"]`);
        if (list) list.insertAdjacentHTML('beforeend', createCardHTML(atendimento));
      }
    });
    ref.on('child_changed', s => {
      const oldAtendimento = allAtendimentos[s.key];
      allAtendimentos[s.key] = { ...s.val(), id: s.key };
      const atendimento = allAtendimentos[s.key];
      const card = document.getElementById(atendimento.id);
      if (card) card.remove();
      if (oldAtendimento && oldAtendimento.status === 'Finalizado') renderFinalizadoColumn();
      if (atendimento.status === 'Finalizado') {
        renderFinalizadoColumn();
      } else {
        const list = kanbanBoard.querySelector(`.client-list[data-status="${atendimento.status}"]`);
        if (list) list.insertAdjacentHTML('beforeend', createCardHTML(atendimento));
      }
    });
    ref.on('child_removed', s => {
      const oldAtendimento = allAtendimentos[s.key];
      delete allAtendimentos[s.key];
      const card = document.getElementById(s.key);
      if (card) card.remove();
      if (oldAtendimento && oldAtendimento.status === 'Finalizado') renderFinalizadoColumn();
    });
  };
  
  // ==================================================================
  // LÓGICA PRINCIPAL
  // ==================================================================
  const loadConfig = async () => {
    const snapshot = await db.ref('config').once('value');
    configData = snapshot.val() || { servicos: [], produtos: [] };
  };

  const loginUser = async (user) => {
    currentUser = user;
    localStorage.setItem('habibiUser', JSON.stringify(user));
    document.getElementById('currentUserName').textContent = user.name;
    if (user.role === 'Gestor') {
        configBtn.classList.remove('hidden');
    }
    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    await loadConfig();
    initializeKanban();
    listenToAtendimentos();
  };
  
  const checkLoggedInUser = () => {
    const storedUser = localStorage.getItem('habibiUser');
    if (storedUser) loginUser(JSON.parse(storedUser));
    else {
      userList.innerHTML = USERS.map(user =>
        `<div class="p-4 bg-gray-100 rounded-lg hover:bg-amber-100 cursor-pointer user-btn" data-user='${JSON.stringify(user)}'>
          <p class="font-semibold">${user.name}</p><p class="text-sm text-gray-500">${user.role}</p>
        </div>`
      ).join('');
    }
  };

  const updateAtendimentoStatus = (id, newStatus) => {
    const atendimento = allAtendimentos[id];
    if (!atendimento) return;
    const logEntry = {
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        description: `Status alterado de "${formatStatus(atendimento.status)}" para "${formatStatus(newStatus)}".`,
        type: 'status'
    };
    db.ref(`atendimentos/${id}/logs`).push(logEntry);
    db.ref(`atendimentos/${id}`).update({ status: newStatus, lastUpdate: new Date().toISOString() });
  };

  const openDetailsModal = (id) => {
    const atendimento = allAtendimentos[id];
    if (!atendimento) return;

    detailsForm.reset();
    document.getElementById('detailsAtendimentoId').value = id;
    document.getElementById('detailsClienteNome').textContent = atendimento.clienteNome;
    document.getElementById('detailsFichaNumero').textContent = `Ficha #${String(atendimento.fichaNumero).padStart(4, '0')}`;
    
    const [data, hora] = (atendimento.agendamento || 'T').split('T');
    document.getElementById('detailsAgendamento').textContent = `${data.split('-').reverse().join('/')} às ${hora}`;
    
    document.getElementById('detailsBarbeiro').textContent = atendimento.barbeiroResponsavel;
    
    const formaPagamentoSelect = document.getElementById('detailsFormaPagamento');
    formaPagamentoSelect.innerHTML = FORMAS_PAGAMENTO.map(f => `<option value="${f}" ${f === atendimento.formaPagamento ? 'selected' : ''}>${f}</option>`).join('');
    
    document.getElementById('detailsDescontoInput').value = atendimento.desconto || 0;
    document.getElementById('detailsObservacoes').value = atendimento.observacoes || '';

    // --- NOVO: Lógica para popular selects de serviços e produtos ---
    const detailsServicosList = document.getElementById('detailsServicosList');
    detailsServicosList.innerHTML = '<option value="">-- Adicionar Serviço --</option>' + configData.servicos.map(s => `<option value="${s.name}|${s.price}">${s.name} - ${formatCurrency(s.price)}</option
