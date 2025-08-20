/* ==================================================================
CONFIGURAÇÃO DO FIREBASE
==================================================================
*/
const firebaseConfig = {
    apiKey: "AIzaSyBW6CaxaYTHbOpCRDCptaYbpFi8OHabMik",
    authDomain: "habibi-ba516.firebaseapp.com",
    databaseURL: "https://habibi-ba516-default-rtdb.firebaseio.com",
    projectId: "habibi-ba516",
    storageBucket: "habibi-ba516.firebasestorage.app",
    messagingSenderId: "744908900549",
    appId: "1:744908900549:web:f61575c692913fae3a08ac"
  };

/* ==================================================================
CONFIGURAÇÃO DO IMGBB
==================================================================
*/
const imgbbApiKey = "57cb1c5a02fb6e5ef2700543d6245b70";

/* ==================================================================
SISTEMA DE NOTIFICAÇÕES
==================================================================
*/
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) {
    existing.remove();
  }
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 500);
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
  let filesToUpload = [];
  
  // --- DADOS DA BARBEARIA ---
  const USERS = [
    { name: 'Ahmed', role: 'Gestor' }, 
    { name: 'Fatima', role: 'Recepcionista' },
    { name: 'Mustafa', role: 'Barbeiro' }, 
    { name: 'Karim', role: 'Barbeiro' },
    { name: 'Layla', role: 'Barbeira' }
  ];

  const SERVICOS = [
      { name: 'Corte de Cabelo', price: 50.00 },
      { name: 'Barba', price: 35.00 },
      { name: 'Sobrancelha', price: 20.00 },
      { name: 'Pezinho', price: 15.00 },
      { name: 'Hidratação', price: 40.00 },
      { name: 'Corte + Barba', price: 80.00 }
  ];
  
  const STATUS_LIST = [
    'Aguardando', 'Em-Atendimento', 'Aguardando-Pagamento', 'Finalizado'
  ];
  
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
  const logForm = document.getElementById('logForm');
  const deleteBtn = document.getElementById('deleteBtn');
  
  const formatStatus = (status) => status.replace(/-/g, ' ');

  // ==================================================================
  // LÓGICA DO KANBAN
  // ==================================================================

  const initializeKanban = () => {
    kanbanBoard.innerHTML = STATUS_LIST.map(status => `
        <div class="status-column p-4">
          <h3 class="font-bold text-gray-800 mb-4 text-center">${formatStatus(status)}</h3>
          <div class="space-y-3 vehicle-list" data-status="${status}"></div>
        </div>
    `).join('');
  };

  const createCardHTML = (atendimento) => {
    const currentIndex = STATUS_LIST.indexOf(atendimento.status);
    const prevStatus = currentIndex > 0 ? STATUS_LIST[currentIndex - 1] : null;
    const nextStatus = currentIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentIndex + 1] : null;
    
    const prevButton = prevStatus ? 
      `<button data-id="${atendimento.id}" data-new-status="${prevStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-left text-xl text-gray-600'></i></button>` 
      : `<div class="w-10 h-10"></div>`;
      
    const nextButton = nextStatus ? 
      `<button data-id="${atendimento.id}" data-new-status="${nextStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-right text-xl text-gray-600'></i></button>` 
      : `<div class="w-10 h-10"></div>`;
    
    const servicos = Array.isArray(atendimento.servicos) ? atendimento.servicos.join(', ') : atendimento.servicos;

    return `
      <div id="${atendimento.id}" class="vehicle-card status-${atendimento.status}" data-id="${atendimento.id}">
        <div class="flex justify-between items-start">
            <div class="card-clickable-area cursor-pointer flex-grow">
              <p class="font-bold text-base text-gray-800">${atendimento.clienteNome}</p>
              <p class="text-sm text-gray-600 truncate">${servicos}</p>
              <p class="text-xs text-gray-500 mt-1">Barbeiro: ${atendimento.barbeiroResponsavel}</p>
              <p class="text-sm font-bold text-amber-800 mt-1">R$ ${parseFloat(atendimento.valorTotal).toFixed(2)}</p>
            </div>
            <div class="flex flex-col -mt-1 -mr-1">
                ${nextButton}
                ${prevButton}
            </div>
        </div>
      </div>`;
  };

  const listenToAtendimentos = () => {
    const atendimentosRef = db.ref('atendimentos');

    atendimentosRef.on('child_added', snapshot => {
      const atendimento = { ...snapshot.val(), id: snapshot.key };
      allAtendimentos[atendimento.id] = atendimento;
      const list = kanbanBoard.querySelector(`.vehicle-list[data-status="${atendimento.status}"]`);
      if (list) {
        list.insertAdjacentHTML('beforeend', createCardHTML(atendimento));
      }
    });

    atendimentosRef.on('child_changed', snapshot => {
      const atendimento = { ...snapshot.val(), id: snapshot.key };
      const oldAtendimento = allAtendimentos[atendimento.id];
      allAtendimentos[atendimento.id] = atendimento;
      const existingCard = document.getElementById(atendimento.id);
      
      if (existingCard) {
        if (oldAtendimento && oldAtendimento.status !== atendimento.status) {
          existingCard.remove();
          const newList = kanbanBoard.querySelector(`.vehicle-list[data-status="${atendimento.status}"]`);
          if (newList) newList.insertAdjacentHTML('beforeend', createCardHTML(atendimento));
        } else {
          existingCard.outerHTML = createCardHTML(atendimento);
        }
      }
    });

    atendimentosRef.on('child_removed', snapshot => {
      const atendimentoId = snapshot.key;
      delete allAtendimentos[atendimentoId];
      const cardToRemove = document.getElementById(atendimentoId);
      if (cardToRemove) {
        cardToRemove.remove();
      }
    });
  };
  
  // ==================================================================
  // LÓGICA PRINCIPAL
  // ==================================================================
  
  const loginUser = (user) => {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    document.getElementById('currentUserName').textContent = user.name;
    userScreen.classList.add('hidden');
    app.classList.remove('hidden');
    
    initializeKanban();
    listenToAtendimentos();
  };
  
  const checkLoggedInUser = () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) loginUser(JSON.parse(storedUser));
    else {
      userList.innerHTML = USERS.map(user =>
        `<div class="p-4 bg-gray-100 rounded-lg hover:bg-amber-100 cursor-pointer user-btn transition-all duration-200" data-user='${JSON.stringify(user)}'>
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

    const logsRef = db.ref(`atendimentos/${id}/logs`);
    logsRef.push(logEntry);
    
    db.ref(`atendimentos/${id}`).update({ status: newStatus, lastUpdate: new Date().toISOString() });
  };

  const openDetailsModal = (id) => {
    const atendimento = allAtendimentos[id];
    if (!atendimento) return;

    document.getElementById('detailsClienteNome').textContent = atendimento.clienteNome;
    document.getElementById('detailsServicos').textContent = Array.isArray(atendimento.servicos) ? atendimento.servicos.join(', ') : atendimento.servicos;
    document.getElementById('detailsBarbeiro').textContent = atendimento.barbeiroResponsavel;
    document.getElementById('detailsValor').textContent = `R$ ${parseFloat(atendimento.valorTotal).toFixed(2)}`;
    document.getElementById('detailsTelefone').textContent = atendimento.clienteTelefone || 'Não informado';
    document.getElementById('logAtendimentoId').value = id;
    logForm.reset();
    filesToUpload = [];
    document.getElementById('fileName').textContent = '';


    if (currentUser.role === 'Gestor' || currentUser.role === 'Recepcionista') {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }

    renderTimeline(atendimento);
    renderMediaGallery(atendimento);
    detailsModal.classList.remove('hidden');
    detailsModal.classList.add('flex');
  };

  const renderTimeline = (atendimento) => {
    const timelineContainer = document.getElementById('timelineContainer');
    const logs = atendimento.logs ? Object.values(atendimento.logs).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
    
    if (logs.length === 0) {
      timelineContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum registro no histórico.</p>';
      return;
    }

    timelineContainer.innerHTML = logs.map(log => {
      const date = new Date(log.timestamp);
      const formattedDate = date.toLocaleDateString('pt-BR');
      const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const isStatusLog = log.type === 'status';
      const iconClass = isStatusLog ? 'bx-transfer' : 'bx-message-detail';
      const itemClass = isStatusLog ? 'timeline-item-status' : 'timeline-item-log';

      return `
        <div class="timeline-item ${itemClass}">
          <div class="timeline-icon"><i class='bx ${iconClass}'></i></div>
          <div class="bg-gray-50 p-3 rounded-lg">
            <div class="flex justify-between items-start mb-1">
              <h4 class="font-semibold text-gray-800 text-sm">${log.user}</h4>
              <span class="text-xs text-gray-500">${formattedDate} ${formattedTime}</span>
            </div>
            <p class="text-gray-700 text-sm">${log.description}</p>
          </div>
        </div>
      `;
    }).join('');
  };

  const renderMediaGallery = (atendimento) => {
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    const media = atendimento.media ? Object.values(atendimento.media) : [];
    
    if (media.length === 0) {
      thumbnailGrid.innerHTML = `<div class="col-span-full text-center py-4 text-gray-400"><i class='bx bx-image text-3xl'></i><p class="text-sm">Nenhuma foto</p></div>`;
      return;
    }

    thumbnailGrid.innerHTML = media.map((item, index) => `
      <div class="aspect-square bg-gray-200 rounded-md overflow-hidden cursor-pointer flex items-center justify-center">
        <img src="${item.url}" alt="Foto ${index + 1}" class="w-full h-full object-cover">
      </div>
    `).join('');
  };
  
  // ==================================================================
  // LISTENERS DE EVENTOS
  // ==================================================================
  
  userList.addEventListener('click', (e) => {
    const userBtn = e.target.closest('.user-btn');
    if (userBtn) loginUser(JSON.parse(userBtn.dataset.user));
  });
  
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    db.ref('atendimentos').off();
    location.reload();
  });
  
  addAtendimentoBtn.addEventListener('click', () => {
    atendimentoForm.reset();
    document.getElementById('atendimentoId').value = '';
    document.getElementById('atendimentoModalTitle').textContent = 'Novo Atendimento';
    
    const barbeiroSelect = document.getElementById('barbeiroResponsavel');
    const barbeiros = USERS.filter(u => u.role === 'Barbeiro' || u.role === 'Barbeira');
    barbeiroSelect.innerHTML = '<option value="">Selecione...</option>' + barbeiros.map(b => `<option value="${b.name}">${b.name}</option>`).join('');

    const servicosList = document.getElementById('servicosList');
    servicosList.innerHTML = SERVICOS.map(s => `
        <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" value="${s.price}" data-name="${s.name}" class="form-checkbox h-4 w-4 text-amber-800 rounded">
            <span class="text-sm">${s.name} (R$ ${s.price.toFixed(2)})</span>
        </label>
    `).join('');

    atendimentoModal.classList.remove('hidden');
    atendimentoModal.classList.add('flex');
  });

  document.getElementById('servicosList').addEventListener('change', () => {
      let total = 0;
      document.querySelectorAll('#servicosList input:checked').forEach(input => {
          total += parseFloat(input.value);
      });
      document.getElementById('valorTotal').value = total.toFixed(2);
  });
  
  atendimentoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const selectedServicos = [];
    document.querySelectorAll('#servicosList input:checked').forEach(input => {
        selectedServicos.push(input.dataset.name);
    });

    if (selectedServicos.length === 0) {
        showNotification("Selecione pelo menos um serviço.", "error");
        return;
    }

    const atendimentoData = {
      clienteNome: document.getElementById('clienteNome').value,
      clienteTelefone: document.getElementById('clienteTelefone').value,
      servicos: selectedServicos,
      barbeiroResponsavel: document.getElementById('barbeiroResponsavel').value,
      valorTotal: document.getElementById('valorTotal').value,
      status: 'Aguardando',
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };
    
    const atendimentoId = document.getElementById('atendimentoId').value;
    
    if (atendimentoId) {
      db.ref(`atendimentos/${atendimentoId}`).update(atendimentoData);
    } else {
      db.ref('atendimentos').push(atendimentoData);
    }
    
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
    });
  });

  logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('logAtendimentoId').value;
    const description = document.getElementById('logDescricao').value;

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      description: description,
      type: 'log'
    };

    if (filesToUpload.length > 0) {
        const uploadPromises = filesToUpload.map(file => {
            const formData = new FormData();
            formData.append('image', file);
            return fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, { method: 'POST', body: formData })
                .then(res => res.json())
                .then(result => ({ type: 'image', url: result.data.url, timestamp: new Date().toISOString() }));
        });
        const mediaResults = await Promise.all(uploadPromises);
        const mediaRef = db.ref(`atendimentos/${id}/media`);
        const snapshot = await mediaRef.once('value');
        const currentMedia = snapshot.val() || [];
        await mediaRef.set([...currentMedia, ...mediaResults]);
    }

    const logsRef = db.ref(`atendimentos/${id}/logs`);
    await logsRef.push(logEntry);

    logForm.reset();
    filesToUpload = [];
    document.getElementById('fileName').textContent = '';
    showNotification("Histórico atualizado!", "success");
  });

  deleteBtn.addEventListener('click', () => {
    const id = document.getElementById('logAtendimentoId').value;
    if (confirm(`Tem certeza que deseja excluir o atendimento de ${allAtendimentos[id].clienteNome}?`)) {
        db.ref(`atendimentos/${id}`).remove();
        detailsModal.classList.add('hidden');
        showNotification("Atendimento excluído.", "success");
    }
  });

  openCameraBtn.addEventListener('click', () => {
    document.getElementById('media-input').setAttribute('accept', 'image/*');
    document.getElementById('media-input').setAttribute('capture', 'camera');
    document.getElementById('media-input').multiple = true;
    document.getElementById('media-input').value = null;
    document.getElementById('media-input').click();
  });
  
  openGalleryBtn.addEventListener('click', () => {
    document.getElementById('media-input').setAttribute('accept', 'image/*');
    document.getElementById('media-input').removeAttribute('capture');
    document.getElementById('media-input').multiple = true;
    document.getElementById('media-input').value = null;
    document.getElementById('media-input').click();
  });

  document.getElementById('media-input').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        filesToUpload.push(...e.target.files);
        document.getElementById('fileName').textContent = `${filesToUpload.length} foto(s) na fila.`;
    }
  });

  checkLoggedInUser();
});
