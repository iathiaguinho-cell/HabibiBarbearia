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
  let servicosAdicionadosState = [];
  let configData = { servicos: [], produtos: [] };
  let currentReportTxtContent = ''; // Armazena o conteúdo do último relatório gerado
  
  const USERS = [
    { name: 'Habibi', role: 'Gestor 👑' }, 
    { name: 'Júnior', role: 'Barbeiro 💈' }, 
    { name: 'Willian', role: 'Barbeiro 💈' },
    { name: 'Recepção', role: 'Recepcionista 🛎️' }
  ];
  
  const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'];
  const STATUS_LIST = ['Aguardando', 'Em-Atendimento', 'Aguardando-Pagamento', 'Finalizado'];
  
  const userScreen = document.getElementById('userScreen');
  const app = document.getElementById('app');
  const userList = document.getElementById('userList');
  const barberDashboard = document.getElementById('barberDashboard');
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
  
  const formatCurrency = (value) => `R$ ${parseFloat(value || 0).toFixed(2).replace('.', ',')}`;
  
  const formatStatus = (status) => {
    const statusMap = {
        'Aguardando': '⏳ Aguardando',
        'Em-Atendimento': '✂️ Em Atendimento',
        'Aguardando-Pagamento': '💳 Pagamento',
        'Finalizado': '✅ Finalizado'
    };
    return statusMap[status] || status.replace(/-/g, ' ');
  };

  const initializeDashboard = () => {
    const barbeiros = USERS.filter(u => u.role.includes('Barbeiro') || u.role.includes('Gestor'));
    barberDashboard.innerHTML = barbeiros.map(barber => {
        return `
            <section class="barber-section">
                <h2 class="barber-header">${barber.name}</h2>
                <div class="kanban-container">
                    ${STATUS_LIST.map(status => `
                        <div class="status-column" data-status-header="${status}">
                            <h3>${formatStatus(status)}</h3>
                            ${status === 'Finalizado' ? `
                            <div class="my-2 px-2">
                                <input type="search" id="searchFinalizadoInput-${barber.name}" 
                                       data-barber="${barber.name}"
                                       placeholder="Buscar..." 
                                       class="w-full p-2 text-sm border rounded-md search-finalizado">
                            </div>` : ''}
                            <div class="client-list" data-status="${status}" data-barber="${barber.name}"></div>
                        </div>`).join('')}
                </div>
            </section>
        `;
    }).join('');

    document.querySelectorAll('.search-finalizado').forEach(input => {
        input.addEventListener('input', (e) => renderSingleFinalizadoColumn(e.target.dataset.barber));
    });
  };

  const createCardHTML = (atendimento) => {
    const primeiroNome = atendimento.clienteNome.split(' ')[0];
    const horario = atendimento.agendamento ? atendimento.agendamento.split('T')[1] : 'N/A';
    const servicosArray = Array.isArray(atendimento.servicos) ? atendimento.servicos : [];
    const servicosDisplay = servicosArray.map(s => typeof s === 'string' ? s : s.name).join(', ');

    return `
      <div id="${atendimento.id}" class="vehicle-card status-${atendimento.status}" data-id="${atendimento.id}">
        <div class="flex justify-between items-start">
            <div class="card-clickable-area cursor-pointer flex-grow space-y-1 pr-2 card-info">
              <div class="flex justify-between items-baseline">
                <p class="name">${primeiroNome}</p>
                <p class="time">${horario}</p>
              </div>
              <p class="text-sm truncate service" title="${servicosDisplay || ''}">${servicosDisplay || 'N/A'}</p>
              <div class="flex justify-between items-center mt-2">
                 <p class="barber">${atendimento.barbeiroResponsavel}</p>
                 <p class="price">${formatCurrency(atendimento.valorTotal)}</p>
              </div>
            </div>
            <div class="flex flex-col items-center justify-center -mt-2 -mr-2">
                <button data-id="${atendimento.id}" data-new-status="${STATUS_LIST[STATUS_LIST.indexOf(atendimento.status) + 1]}" class="btn-move-status p-2 rounded-full hover:bg-gray-200 ${!STATUS_LIST[STATUS_LIST.indexOf(atendimento.status) + 1] ? 'invisible' : ''}"><i class='bx bx-chevron-right text-2xl'></i></button>
                <button data-id="${atendimento.id}" data-new-status="${STATUS_LIST[STATUS_LIST.indexOf(atendimento.status) - 1]}" class="btn-move-status p-2 rounded-full hover:bg-gray-200 ${!STATUS_LIST[STATUS_LIST.indexOf(atendimento.status) - 1] ? 'invisible' : ''}"><i class='bx bx-chevron-left text-2xl'></i></button>
            </div>
        </div>
      </div>`;
  };

  const renderSingleFinalizadoColumn = (barberName) => {
      const list = barberDashboard.querySelector(`.client-list[data-barber="${barberName}"][data-status="Finalizado"]`);
      if (!list) return;
      const searchInput = document.getElementById(`searchFinalizadoInput-${barberName}`);
      const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
      
      let finalizados = Object.values(allAtendimentos).filter(a => 
          a.status === 'Finalizado' && a.barbeiroResponsavel === barberName
      );

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
      const list = barberDashboard.querySelector(`.client-list[data-barber="${atendimento.barbeiroResponsavel}"][data-status="${atendimento.status}"]`);
      if (list) list.insertAdjacentHTML('beforeend', createCardHTML(atendimento));
    });
    ref.on('child_changed', s => {
      const atendimento = { ...s.val(), id: s.key };
      allAtendimentos[s.key] = atendimento;
      const card = document.getElementById(s.key);
      if (card) card.remove();
      const list = barberDashboard.querySelector(`.client-list[data-barber="${atendimento.barbeiroResponsavel}"][data-status="${atendimento.status}"]`);
      if (list) list.insertAdjacentHTML('beforeend', createCardHTML(atendimento));
    });
    ref.on('child_removed', s => {
      delete allAtendimentos[s.key];
      const card = document.getElementById(s.key);
      if (card) card.remove();
    });
  };
  
  const loadConfig = async () => {
    const snapshot = await db.ref('config').once('value');
    configData = snapshot.val() || { servicos: [], produtos: [] };
  };

  const loginUser = async (user) => {
    currentUser = user;
    localStorage.setItem('habibiUser', JSON.stringify(user));
    document.getElementById('currentUserName').textContent = user.name;
    
    if (user.role.includes('Gestor')) {
        configBtn.classList.remove('hidden');
        reportsBtn.classList.remove('hidden');
    } else {
        configBtn.classList.add('hidden');
        reportsBtn.classList.add('hidden');
    }

    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    await loadConfig();
    initializeDashboard();
    listenToAtendimentos();
  };
  
  const checkLoggedInUser = () => {
    const storedUser = localStorage.getItem('habibiUser');
    if (storedUser) {
        loginUser(JSON.parse(storedUser));
    } else {
      userList.innerHTML = USERS.map(user =>
        `<div class="p-4 bg-gray-100 rounded-lg hover:bg-amber-100 cursor-pointer user-btn" data-user='${JSON.stringify(user)}'>
          <p class="font-semibold">${user.name.replace(/👑|💈|🛎️/g, '').trim()}</p>
          <p class="text-sm text-gray-500">${user.role}</p>
        </div>`
      ).join('');
    }
  };

  const updateAtendimentoStatus = (id, newStatus) => {
    const atendimento = allAtendimentos[id];
    if (!atendimento || !newStatus) return;
    const logEntry = {
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        description: `Status alterado de "${atendimento.status}" para "${newStatus}".`,
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
    document.getElementById('detailsDesconto').value = atendimento.desconto || 0;
    document.getElementById('detailsObservacoes').value = atendimento.observacoes || '';
    const detailsServicosList = document.getElementById('detailsServicosList');
    detailsServicosList.innerHTML = '<option value="">-- Adicionar Serviço --</option>' + configData.servicos.map(s => `<option value="${s.name}|${s.price}">${s.name} - ${formatCurrency(s.price)}</option>`).join('');
    const detailsProdutosList = document.getElementById('detailsProdutosList');
    detailsProdutosList.innerHTML = '<option value="avulso">-- Item Avulso --</option>' + configData.produtos.map(p => `<option value="${p.name}|${p.price}">${p.name} - ${formatCurrency(p.price)}</option>`).join('');
    servicosAdicionadosState = Array.isArray(atendimento.servicos) ? atendimento.servicos.map(s => typeof s === 'string' ? configData.servicos.find(cs => cs.name === s) || { name: s, price: 0 } : s) : [];
    produtosAdicionadosState = atendimento.produtos || [];
    renderDetailsItems();
    calculateDetailsTotal();
    deleteBtn.classList.toggle('hidden', !(currentUser.role.includes('Gestor') || currentUser.role.includes('Recepcionista')));
    deleteBtn.dataset.id = id;
    renderTimeline(atendimento);
    detailsModal.classList.remove('hidden');
    detailsModal.classList.add('flex');
  };

  const renderDetailsItems = () => {
    const servicosContainer = document.getElementById('detailsServicosContainer');
    servicosContainer.innerHTML = servicosAdicionadosState.map((s, index) => `<div class="flex justify-between items-center bg-gray-50 p-1 rounded text-sm"><span>${s.name} - ${formatCurrency(s.price)}</span><button type="button" class="remove-servico-btn text-red-500 font-bold" data-index="${index}">&times;</button></div>`).join('') || '<span class="text-gray-500">Nenhum serviço.</span>';
    const produtosContainer = document.getElementById('detailsProdutosContainer');
    produtosContainer.innerHTML = produtosAdicionadosState.map((p, index) => `<div class="flex justify-between items-center bg-gray-100 p-1 rounded text-sm"><span>${p.name} - ${formatCurrency(p.price)}</span><button type="button" class="remove-produto-btn text-red-500 font-bold" data-index="${index}">&times;</button></div>`).join('') || '<span class="text-gray-500">Nenhum produto.</span>';
  };

  const calculateDetailsTotal = () => {
    const servicosTotal = servicosAdicionadosState.reduce((sum, s) => sum + (s.price || 0), 0);
    const produtosTotal = produtosAdicionadosState.reduce((sum, p) => sum + (p.price || 0), 0);
    const desconto = parseFloat(document.getElementById('detailsDesconto').value) || 0;
    document.getElementById('detailsValorTotalDisplay').textContent = formatCurrency(servicosTotal + produtosTotal - desconto);
  };

  const renderTimeline = (atendimento) => {
    const timelineContainer = document.getElementById('timelineContainer');
    const logs = atendimento.logs ? Object.values(atendimento.logs).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
    if (logs.length === 0) {
      timelineContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum histórico.</p>';
      return;
    }
    timelineContainer.innerHTML = logs.map(log => {
      const date = new Date(log.timestamp);
      const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `<div class="timeline-item ${log.type === 'status' ? 'timeline-item-status' : 'timeline-item-log'}"><div class="timeline-icon"><i class='bx ${log.type === 'status' ? 'bx-transfer' : 'bx-message-detail'}'></i></div><div class="bg-gray-50 p-3 rounded-lg"><div class="flex justify-between items-start mb-1"><h4 class="font-semibold text-gray-800 text-sm">${log.user}</h4><span class="text-xs text-gray-500">${date.toLocaleDateString('pt-BR')} ${formattedTime}</span></div><p class="text-gray-700 text-sm">${log.description}</p></div></div>`;
    }).join('');
  };
  
  userList.addEventListener('click', (e) => {
    const userBtn = e.target.closest('.user-btn');
    if (userBtn) loginUser(JSON.parse(userBtn.dataset.user));
  });
  
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('habibiUser');
    db.ref('atendimentos').off();
    location.reload();
  });
  
  addAtendimentoBtn.addEventListener('click', () => {
    atendimentoForm.reset();
    document.getElementById('atendimentoId').value = '';
    document.getElementById('atendimentoModalTitle').textContent = '🗓️ Agendar Novo Atendimento';
    const barbeiroSelect = document.getElementById('barbeiroResponsavel');
    const barbeiros = USERS.filter(u => u.role.includes('Barbeiro') || u.role.includes('Gestor'));
    barbeiroSelect.innerHTML = '<option value="">Selecione...</option>' + barbeiros.map(b => `<option value="${b.name}">${b.name.replace(/👑|💈|🛎️/g, '').trim()}</option>`).join('');
    const servicosList = document.getElementById('servicosList');
    servicosList.innerHTML = configData.servicos.map(s => `<label class="flex items-center space-x-2 cursor-pointer"><input type="checkbox" value="${s.price}" data-name="${s.name}" class="form-checkbox h-4 w-4"><span class="text-sm">${s.name} (${formatCurrency(s.price)})</span></label>`).join('');
    atendimentoModal.classList.remove('hidden');
    atendimentoModal.classList.add('flex');
  });

  atendimentoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedServicos = Array.from(document.querySelectorAll('#servicosList input:checked'));
    if (selectedServicos.length === 0) return showNotification("Selecione pelo menos um serviço.", "error");
    const configRef = db.ref('config/proximaFicha');
    const { committed, snapshot } = await configRef.transaction(currentValue => (currentValue || 0) + 1);
    if (!committed) return showNotification('Erro ao gerar número da ficha.', 'error');
    const fichaNumero = snapshot.val();
    const servicos = selectedServicos.map(i => ({ name: i.dataset.name, price: parseFloat(i.value) }));
    const servicosTotal = servicos.reduce((sum, s) => sum + s.price, 0);
    const atendimentoData = { fichaNumero, clienteNome: document.getElementById('clienteNome').value, agendamento: `${document.getElementById('agendamentoData').value}T${document.getElementById('agendamentoHora').value}`, servicos, produtos: [], barbeiroResponsavel: document.getElementById('barbeiroResponsavel').value, formaPagamento: FORMAS_PAGAMENTO[0], valorServicos: servicosTotal, valorProdutos: 0, desconto: 0, valorTotal: servicosTotal, status: 'Aguardando', createdAt: new Date().toISOString(), logs: [{ timestamp: new Date().toISOString(), user: currentUser.name, description: 'Ficha de atendimento criada.', type: 'log' }] };
    await db.ref('atendimentos').push(atendimentoData);
    atendimentoModal.classList.add('hidden');
  });

  barberDashboard.addEventListener('click', (e) => {
    const moveBtn = e.target.closest('.btn-move-status');
    const cardArea = e.target.closest('.card-clickable-area');
    if (moveBtn) {
      e.stopPropagation();
      updateAtendimentoStatus(moveBtn.dataset.id, moveBtn.dataset.newStatus);
    } else if (cardArea) {
      const card = e.target.closest('.vehicle-card');
      if (card) openDetailsModal(card.dataset.id);
    }
  });

  document.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));

  deleteBtn.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    if (confirm(`Tem certeza que deseja excluir a ficha de ${allAtendimentos[id].clienteNome}?`)) {
        db.ref(`atendimentos/${id}`).remove();
        detailsModal.classList.add('hidden');
        showNotification("Ficha excluída.", "success");
    }
  });

  detailsModal.addEventListener('click', (e) => {
    if (e.target.id === 'detailsAddServicoBtn') {
        const select = document.getElementById('detailsServicosList');
        if (!select.value) return;
        const [name, price] = select.value.split('|');
        servicosAdicionadosState.push({ name, price: parseFloat(price) });
        select.value = "";
    } else if (e.target.classList.contains('remove-servico-btn')) {
        servicosAdicionadosState.splice(parseInt(e.target.dataset.index), 1);
    } else if (e.target.id === 'detailsAddProdutoBtn') {
        const select = document.getElementById('detailsProdutosList');
        if (select.value === 'avulso') {
            document.getElementById('detailsProdutoAvulsoContainer').classList.remove('hidden');
            return;
        }
        if (!select.value) return;
        const [name, price] = select.value.split('|');
        produtosAdicionadosState.push({ name, price: parseFloat(price) });
        select.value = "avulso";
        document.getElementById('detailsProdutoAvulsoContainer').classList.add('hidden');
    } else if (e.target.id === 'detailsAddProdutoAvulsoBtn') {
        const name = document.getElementById('detailsProdutoAvulsoNome').value;
        const price = parseFloat(document.getElementById('detailsProdutoAvulsoPreco').value);
        if (name && price > 0) {
            produtosAdicionadosState.push({ name, price });
            document.getElementById('detailsProdutoAvulsoNome').value = '';
            document.getElementById('detailsProdutoAvulsoPreco').value = '';
            document.getElementById('detailsProdutoAvulsoContainer').classList.add('hidden');
            document.getElementById('detailsProdutosList').value = 'avulso';
        }
    } else if (e.target.classList.contains('remove-produto-btn')) {
        produtosAdicionadosState.splice(parseInt(e.target.dataset.index), 1);
    } else { return; }
    renderDetailsItems();
    calculateDetailsTotal();
  });

  detailsModal.addEventListener('input', (e) => { if (e.target.id === 'detailsDesconto') calculateDetailsTotal(); });

  const saveDetails = async () => {
    const id = document.getElementById('detailsAtendimentoId').value;
    const servicosTotal = servicosAdicionadosState.reduce((sum, s) => sum + (s.price || 0), 0);
    const produtosTotal = produtosAdicionadosState.reduce((sum, p) => sum + (p.price || 0), 0);
    const desconto = parseFloat(document.getElementById('detailsDesconto').value) || 0;
    const updates = { servicos: servicosAdicionadosState, produtos: produtosAdicionadosState, formaPagamento: document.getElementById('detailsFormaPagamento').value, desconto, observacoes: document.getElementById('detailsObservacoes').value, valorServicos: servicosTotal, valorProdutos: produtosTotal, valorTotal: servicosTotal + produtosTotal - desconto, lastUpdate: new Date().toISOString() };
    await db.ref(`atendimentos/${id}`).update(updates);
    return true;
  };

  detailsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveDetails();
      showNotification('Ficha atualizada com sucesso!', 'success');
      detailsModal.classList.add('hidden');
  });

  document.getElementById('saveAndNextStatusBtn').addEventListener('click', async () => {
    if (await saveDetails()) {
        const id = document.getElementById('detailsAtendimentoId').value;
        const atendimento = allAtendimentos[id];
        const nextStatus = STATUS_LIST[STATUS_LIST.indexOf(atendimento.status) + 1];
        if (nextStatus) updateAtendimentoStatus(id, nextStatus);
        detailsModal.classList.add('hidden');
    }
  });

  reportsBtn.addEventListener('click', () => {
    document.getElementById('reportsModal').querySelector('h2').textContent = '📊 Relatórios de Desempenho';
    const barberSelect = document.getElementById('reportBarber');
    const barbeiros = USERS.filter(u => u.role.includes('Barbeiro') || u.role.includes('Gestor'));
    barberSelect.innerHTML = '<option value="todos">Todos os Barbeiros</option>' + barbeiros.map(b => `<option value="${b.name}">${b.name.replace(/👑|💈|🛎️/g, '').trim()}</option>`).join('');
    document.getElementById('reportResult').innerHTML = '';
    document.getElementById('reportTableContainer').classList.add('hidden');
    reportsModal.classList.remove('hidden');
    reportsModal.classList.add('flex');
  });

  const downloadReportAsTxt = (content, filename) => {
    try {
      const element = document.createElement('a');
      const file = new Blob([content], {type: 'text/plain;charset=utf-8'});
      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      showNotification('Relatório baixado!', 'success');
    } catch (error) {
      console.error("Erro ao baixar o relatório:", error);
      showNotification('Falha ao baixar o relatório.', 'error');
    }
  }

  document.getElementById('generateReportBtn').addEventListener('click', () => {
    showNotification('Gerando seu relatório...', 'success');
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const barber = document.getElementById('reportBarber').value;
    const reportSummaryCards = document.getElementById('reportSummaryCards');
    const reportTableContainer = document.getElementById('reportTableContainer');
    const reportTableBody = document.getElementById('reportDetailTable').querySelector('tbody');

    if (!startDate || !endDate) return showNotification('Por favor, selecione data de início e fim.', 'error');

    let filtered = Object.values(allAtendimentos).filter(a => a.createdAt.split('T')[0] >= startDate && a.createdAt.split('T')[0] <= endDate);
    if (barber !== 'todos') filtered = filtered.filter(a => a.barbeiroResponsavel === barber);

    reportSummaryCards.innerHTML = '';
    reportTableBody.innerHTML = '';
    reportTableContainer.classList.add('hidden');

    if (filtered.length === 0) {
        reportSummaryCards.innerHTML = '<p class="text-center text-gray-500">🙁 Nenhum atendimento encontrado para o período.</p>';
        return;
    }

    const totalFaturado = filtered.reduce((sum, a) => sum + a.valorTotal, 0);
    reportSummaryCards.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><div class="bg-green-100 p-4 rounded-lg text-center"><p class="text-lg text-green-800">💰 Faturamento Total</p><p class="text-3xl font-bold text-green-900">${formatCurrency(totalFaturado)}</p></div><div class="bg-blue-100 p-4 rounded-lg text-center"><p class="text-lg text-blue-800">👥 Total de Atendimentos</p><p class="text-3xl font-bold text-blue-900">${filtered.length}</p></div></div>`;
    
    filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    reportTableBody.innerHTML = filtered.map(a => {
        const servicos = (Array.isArray(a.servicos) ? a.servicos : []).map(s => s.name).join(', ');
        return `<tr class="bg-white border-b"><td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">#${String(a.fichaNumero).padStart(4, '0')}</td><td class="px-6 py-4">${a.createdAt.split('T')[0].split('-').reverse().join('/')}</td><td class="px-6 py-4">${a.clienteNome}</td><td class="px-6 py-4">${a.barbeiroResponsavel}</td><td class="px-6 py-4">${servicos}</td><td class="px-6 py-4">${formatCurrency(a.valorTotal)}</td></tr>`;
    }).join('');

    reportTableContainer.classList.remove('hidden');

    currentReportTxtContent = `RELATÓRIO DE DESEMPENHO - HABIBI BARBEARIA\n==================================================\nPeríodo: ${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}\nFiltro: ${barber}\n==================================================\n\nDETALHAMENTO:\n\n` + filtered.map(a => `Ficha #${String(a.fichaNumero).padStart(4, '0')} | ${a.createdAt.split('T')[0].split('-').reverse().join('/')} | ${a.clienteNome} | ${a.barbeiroResponsavel} | ${formatCurrency(a.valorTotal)}`).join('\n') + `\n\nRESUMO GERAL:\n  - 💰 Faturamento Total: ${formatCurrency(totalFaturado)}\n  - 👥 Total de Atendimentos: ${filtered.length}\n`;
  });

  document.getElementById('downloadReportBtn').addEventListener('click', () => {
      if (currentReportTxtContent) {
          const startDate = document.getElementById('reportStartDate').value;
          const endDate = document.getElementById('reportEndDate').value;
          const fileName = `Relatorio_Habibi_${startDate}_a_${endDate}.txt`;
          downloadReportAsTxt(currentReportTxtContent, fileName);
      } else {
          showNotification('Gere um relatório primeiro para poder baixar.', 'error');
      }
  });

  configBtn.addEventListener('click', () => {
      document.getElementById('configModal').querySelector('h2').textContent = '⚙️ Configurações Gerais';
      renderConfigLists();
      configModal.classList.remove('hidden');
      configModal.classList.add('flex');
  });

  const renderConfigLists = () => {
    const servicosList = document.getElementById('configServicosList');
    servicosList.innerHTML = configData.servicos.map((s, i) => `<div class="flex justify-between items-center bg-gray-100 p-2 rounded"><span>${s.name} - ${formatCurrency(s.price)}</span><button class="remove-servico-btn text-red-500" data-index="${i}">&times;</button></div>`).join('');
    const produtosList = document.getElementById('configProdutosList');
    produtosList.innerHTML = configData.produtos.map((p, i) => `<div class="flex justify-between items-center bg-gray-100 p-2 rounded"><span>${p.name} - ${formatCurrency(p.price)}</span><button class="remove-produto-btn text-red-500" data-index="${i}">&times;</button></div>`).join('');
  };

  document.getElementById('addServicoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newServicoName').value;
    const price = parseFloat(document.getElementById('newServicoPrice').value);
    if (name && price > 0) {
        configData.servicos.push({ name, price });
        await db.ref('config/servicos').set(configData.servicos);
        renderConfigLists();
        e.target.reset();
    }
  });

  document.getElementById('addProdutoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newProdutoName').value;
    const price = parseFloat(document.getElementById('newProdutoPrice').value);
    if (name && price > 0) {
        configData.produtos.push({ name, price });
        await db.ref('config/produtos').set(configData.produtos);
        renderConfigLists();
        e.target.reset();
    }
  });

  configModal.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove-servico-btn')) {
        configData.servicos.splice(parseInt(e.target.dataset.index), 1);
        await db.ref('config/servicos').set(configData.servicos);
        renderConfigLists();
    }
    if (e.target.classList.contains('remove-produto-btn')) {
        configData.produtos.splice(parseInt(e.target.dataset.index), 1);
        await db.ref('config/produtos').set(configData.produtos);
        renderConfigLists();
    }
  });

  checkLoggedInUser();
});