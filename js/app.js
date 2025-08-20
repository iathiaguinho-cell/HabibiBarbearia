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
  const deleteBtn = document.getElementById('deleteBtn');
  const reportsBtn = document.getElementById('reportsBtn');
  const reportsModal = document.getElementById('reportsModal');
  
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
    
    return `
      <div id="${atendimento.id}" class="vehicle-card status-${atendimento.status}" data-id="${atendimento.id}">
        <div class="flex justify-between items-start">
            <div class="card-clickable-area cursor-pointer flex-grow">
              <p class="font-bold text-sm text-amber-800">#${String(atendimento.fichaNumero).padStart(4, '0')}</p>
              <p class="font-bold text-base text-gray-800">${atendimento.clienteNome}</p>
              <p class="text-sm text-gray-600 truncate">${atendimento.servicos.join(', ')}</p>
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
    document.getElementById('detailsClienteNome').textContent = atendimento.clienteNome;
    document.getElementById('detailsFichaNumero').textContent = `Ficha #${String(atendimento.fichaNumero).padStart(4, '0')}`;
    document.getElementById('detailsServicos').textContent = atendimento.servicos.join(', ');
    document.getElementById('detailsBarbeiro').textContent = atendimento.barbeiroResponsavel;
    document.getElementById('detailsProdutos').textContent = atendimento.produtos?.map(p => p.name).join(', ') || 'Nenhum';
    document.getElementById('detailsPagamento').textContent = atendimento.formaPagamento;
    const subtotal = (atendimento.valorServicos || 0) + (atendimento.valorProdutos || 0);
    document.getElementById('detailsSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('detailsDesconto').textContent = `- ${formatCurrency(atendimento.desconto)}`;
    document.getElementById('detailsValorFinal').textContent = formatCurrency(atendimento.valorTotal);
    
    if (currentUser.role === 'Gestor' || currentUser.role === 'Recepcionista') {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
    deleteBtn.dataset.id = id;
    document.getElementById('exportPdfBtn').dataset.id = id;

    renderTimeline(atendimento);
    
    const actionsColumn = document.getElementById('actions-column');
    const existingSignature = actionsColumn.querySelector('.dev-signature');
    if (existingSignature) existingSignature.remove();
    const signatureDiv = document.createElement('div');
    signatureDiv.className = 'dev-signature text-center text-xs text-gray-500 mt-4';
    signatureDiv.innerHTML = `<p>Desenvolvido com 🤖 por <strong>thIAguinho Soluções</strong></p>`;
    actionsColumn.appendChild(signatureDiv);

    detailsModal.classList.remove('hidden');
    detailsModal.classList.add('flex');
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
      const isStatusLog = log.type === 'status';
      return `
        <div class="timeline-item ${isStatusLog ? 'timeline-item-status' : 'timeline-item-log'}">
          <div class="timeline-icon"><i class='bx ${isStatusLog ? 'bx-transfer' : 'bx-message-detail'}'></i></div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="flex justify-between items-start mb-1">
              <h4 class="font-semibold text-gray-800 text-sm">${log.user}</h4>
              <span class="text-xs text-gray-500">${date.toLocaleDateString('pt-BR')} ${formattedTime}</span>
            </div>
            <p class="text-gray-700 text-sm">${log.description}</p>
          </div>
        </div>`;
    }).join('');
  };
  
  // ==================================================================
  // LISTENERS DE EVENTOS
  // ==================================================================
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
    produtosAdicionadosState = [];
    document.getElementById('produtosAdicionados').innerHTML = '';
    document.getElementById('atendimentoId').value = '';
    document.getElementById('atendimentoModalTitle').textContent = 'Nova Ficha de Atendimento';
    
    const barbeiroSelect = document.getElementById('barbeiroResponsavel');
    const barbeiros = USERS.filter(u => u.role === 'Barbeiro' || u.role === 'Gestor');
    barbeiroSelect.innerHTML = '<option value="">Selecione...</option>' + barbeiros.map(b => `<option value="${b.name}">${b.name}</option>`).join('');

    const servicosList = document.getElementById('servicosList');
    servicosList.innerHTML = configData.servicos.map(s => `
        <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" value="${s.price}" data-name="${s.name}" class="form-checkbox h-4 w-4">
            <span class="text-sm">${s.name} (${formatCurrency(s.price)})</span>
        </label>
    `).join('');

    const produtosList = document.getElementById('produtosList');
    produtosList.innerHTML = '<option value="avulso">-- Item Avulso --</option>' + configData.produtos.map(p => `<option value="${p.name}|${p.price}">${p.name} - ${formatCurrency(p.price)}</option>`).join('');
    
    const formaPagamento = document.getElementById('formaPagamento');
    formaPagamento.innerHTML = FORMAS_PAGAMENTO.map(f => `<option value="${f}">${f}</option>`).join('');

    calculateTotal();
    
    document.getElementById('fichaNumeroDisplay').textContent = `Aguardando...`;
    atendimentoModal.classList.remove('hidden');
    atendimentoModal.classList.add('flex');
  });

  const calculateTotal = () => {
    let servicosTotal = 0;
    document.querySelectorAll('#servicosList input:checked').forEach(input => servicosTotal += parseFloat(input.value));
    const produtosTotal = produtosAdicionadosState.reduce((sum, p) => sum + p.price, 0);
    const desconto = parseFloat(document.getElementById('desconto').value) || 0;
    
    document.getElementById('valorServicosDisplay').textContent = formatCurrency(servicosTotal);
    document.getElementById('valorProdutosDisplay').textContent = formatCurrency(produtosTotal);
    document.getElementById('valorTotalDisplay').textContent = formatCurrency(servicosTotal + produtosTotal - desconto);
  };
  atendimentoModal.addEventListener('change', calculateTotal);
  atendimentoModal.addEventListener('input', calculateTotal);
  
  document.getElementById('addProdutoBtn').addEventListener('click', () => {
      const select = document.getElementById('produtosList');
      if (select.value === 'avulso') {
          document.getElementById('produtoAvulsoContainer').classList.remove('hidden');
          return;
      }
      document.getElementById('produtoAvulsoContainer').classList.add('hidden');
      const [name, price] = select.value.split('|');
      produtosAdicionadosState.push({ name, price: parseFloat(price) });
      renderProdutosAdicionados();
      calculateTotal();
  });

  document.getElementById('addProdutoAvulsoBtn').addEventListener('click', () => {
      const name = document.getElementById('produtoAvulsoNome').value;
      const price = parseFloat(document.getElementById('produtoAvulsoPreco').value);
      if (name && price > 0) {
          produtosAdicionadosState.push({ name, price });
          renderProdutosAdicionados();
          calculateTotal();
          document.getElementById('produtoAvulsoNome').value = '';
          document.getElementById('produtoAvulsoPreco').value = '';
          document.getElementById('produtoAvulsoContainer').classList.add('hidden');
          document.getElementById('produtosList').value = 'avulso';
      } else {
          showNotification('Preencha o nome e o preço do item avulso.', 'error');
      }
  });

  const renderProdutosAdicionados = () => {
      const container = document.getElementById('produtosAdicionados');
      container.innerHTML = produtosAdicionadosState.map((p, index) => `
        <div class="flex justify-between items-center bg-gray-100 p-1 rounded">
            <span class="text-sm">${p.name} - ${formatCurrency(p.price)}</span>
            <button type="button" class="remove-produto-btn text-red-500" data-index="${index}">&times;</button>
        </div>
      `).join('');
  };

  document.getElementById('produtosAdicionados').addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-produto-btn')) {
          const index = parseInt(e.target.dataset.index);
          produtosAdicionadosState.splice(index, 1);
          renderProdutosAdicionados();
          calculateTotal();
      }
  });

  atendimentoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedServicos = Array.from(document.querySelectorAll('#servicosList input:checked')).map(i => i.dataset.name);
    if (selectedServicos.length === 0) return showNotification("Selecione pelo menos um serviço.", "error");

    const configRef = db.ref('config/proximaFicha');
    const { committed, snapshot } = await configRef.transaction(currentValue => (currentValue || 0) + 1);
    if (!committed) return showNotification('Erro ao gerar número da ficha. Tente salvar novamente.', 'error');
    const fichaNumero = snapshot.val();

    const servicosTotal = Array.from(document.querySelectorAll('#servicosList input:checked')).reduce((sum, i) => sum + parseFloat(i.value), 0);
    const produtosTotal = produtosAdicionadosState.reduce((sum, p) => sum + p.price, 0);
    const desconto = parseFloat(document.getElementById('desconto').value) || 0;

    const atendimentoData = {
      fichaNumero,
      clienteNome: document.getElementById('clienteNome').value,
      agendamento: `${document.getElementById('agendamentoData').value}T${document.getElementById('agendamentoHora').value}`,
      servicos: selectedServicos,
      produtos: produtosAdicionadosState,
      barbeiroResponsavel: document.getElementById('barbeiroResponsavel').value,
      formaPagamento: document.getElementById('formaPagamento').value,
      valorServicos: servicosTotal,
      valorProdutos: produtosTotal,
      desconto: desconto,
      valorTotal: servicosTotal + produtosTotal - desconto,
      status: 'Aguardando',
      createdAt: new Date().toISOString(),
    };
    
    await db.ref('atendimentos').push(atendimentoData);
    atendimentoModal.classList.add('hidden');
  });

  kanbanBoard.addEventListener('click', (e) => {
    const moveBtn = e.target.closest('.btn-move-status');
    const cardArea = e.target.closest('.card-clickable-area');
    if (moveBtn) {
      e.stopPropagation();
      updateAtendimentoStatus(moveBtn.dataset.id, moveBtn.dataset.newStatus);
    } else if (cardArea) {
      openDetailsModal(cardArea.parentElement.parentElement.dataset.id);
    }
  });

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        atendimentoModal.classList.add('hidden');
        detailsModal.classList.add('hidden');
        reportsModal.classList.add('hidden');
    });
  });

  deleteBtn.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    if (confirm(`Tem certeza que deseja excluir a ficha de ${allAtendimentos[id].clienteNome}?`)) {
        db.ref(`atendimentos/${id}`).remove();
        detailsModal.classList.add('hidden');
        showNotification("Ficha excluída.", "success");
    }
  });

  document.getElementById('exportPdfBtn').addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const fichaElement = document.getElementById('ficha-para-imprimir');
      const { jsPDF } = window.jspdf;
      html2canvas(fichaElement, { scale: 2 }).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Ficha_${allAtendimentos[id].fichaNumero}_${allAtendimentos[id].clienteNome}.pdf`);
      });
  });

  // --- LÓGICA DE RELATÓRIOS ---
  reportsBtn.addEventListener('click', () => {
      const barberSelect = document.getElementById('reportBarber');
      const barbeiros = USERS.filter(u => u.role === 'Barbeiro' || u.role === 'Gestor');
      barberSelect.innerHTML = '<option value="todos">Todos os Barbeiros</option>' + barbeiros.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
      document.getElementById('reportResult').innerHTML = '';
      reportsModal.classList.remove('hidden');
      reportsModal.classList.add('flex');
  });

  document.getElementById('generateReportBtn').addEventListener('click', () => {
      const startDate = document.getElementById('reportStartDate').value;
      const endDate = document.getElementById('reportEndDate').value;
      const barber = document.getElementById('reportBarber').value;
      const resultDiv = document.getElementById('reportResult');

      if (!startDate || !endDate) return showNotification('Por favor, selecione data de início e fim.', 'error');

      let filtered = Object.values(allAtendimentos).filter(a => {
          const aDate = a.createdAt.split('T')[0];
          return aDate >= startDate && aDate <= endDate;
      });

      if (barber !== 'todos') {
          filtered = filtered.filter(a => a.barbeiroResponsavel === barber);
      }

      if (filtered.length === 0) {
          resultDiv.innerHTML = '<p class="text-center text-gray-500">Nenhum atendimento encontrado para o período e filtro selecionados.</p>';
          return;
      }

      const totalFaturado = filtered.reduce((sum, a) => sum + a.valorTotal, 0);
      const totalClientes = filtered.length;
      const servicosCount = filtered.flatMap(a => a.servicos).reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
      }, {});
      
      const atendimentosPorBarbeiro = filtered.reduce((acc, a) => {
          const barbeiro = a.barbeiroResponsavel;
          if (!acc[barbeiro]) {
              acc[barbeiro] = { faturamento: 0, atendimentos: 0, servicos: {} };
          }
          acc[barbeiro].faturamento += a.valorTotal;
          acc[barbeiro].atendimentos++;
          a.servicos.forEach(s => {
              acc[barbeiro].servicos[s] = (acc[barbeiro].servicos[s] || 0) + 1;
          });
          return acc;
      }, {});

      let reportHTML = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div class="bg-green-100 p-4 rounded-lg text-center">
                  <p class="text-lg text-green-800">Faturamento Total no Período</p>
                  <p class="text-3xl font-bold text-green-900">${formatCurrency(totalFaturado)}</p>
              </div>
              <div class="bg-blue-100 p-4 rounded-lg text-center">
                  <p class="text-lg text-blue-800">Total de Atendimentos</p>
                  <p class="text-3xl font-bold text-blue-900">${totalClientes}</p>
              </div>
          </div>
          <div>
              <h3 class="text-xl font-bold mb-2">Desempenho por Barbeiro</h3>
              ${Object.entries(atendimentosPorBarbeiro).map(([nome, data]) => `
                  <div class="border rounded-lg p-4 mb-4">
                      <h4 class="font-bold text-lg">${nome}</h4>
                      <div class="flex justify-around mt-2">
                          <p><strong>Faturamento:</strong> ${formatCurrency(data.faturamento)}</p>
                          <p><strong>Atendimentos:</strong> ${data.atendimentos}</p>
                      </div>
                      <p class="text-sm font-semibold mt-2">Serviços:</p>
                      <ul class="list-disc list-inside text-sm">
                          ${Object.entries(data.servicos).map(([serv, count]) => `<li>${serv}: ${count}</li>`).join('')}
                      </ul>
                  </div>
              `).join('')}
          </div>
      `;
      resultDiv.innerHTML = reportHTML;
  });

  checkLoggedInUser();
});
