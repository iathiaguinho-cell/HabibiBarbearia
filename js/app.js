// CONFIGURAÇÃO REAL DO FIREBASE - NENHUMA EDIÇÃO NECESSÁRIA.
const firebaseConfig = {
    apiKey: "AIzaSyBW6CaxaYTHbOpCRDCptaYbpFi8OHabMik",
    authDomain: "habibi-ba516.firebaseapp.com",
    databaseURL: "https://habibi-ba516-default-rtdb.firebaseio.com",
    projectId: "habibi-ba516",
    storageBucket: "habibi-ba516.appspot.com",
    messagingSenderId: "744908900549",
    appId: "1:744908900549:web:f61575c692913fae3a08ac"
};

document.addEventListener('DOMContentLoaded', () => {
    // INICIALIZAÇÃO DO FIREBASE (COMO NO SEU CÓDIGO ORIGINAL)
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // DADOS E CONFIGURAÇÕES GLOBAIS (PRESERVADOS DO SEU CÓDIGO ORIGINAL)
    const USERS = [
        { name: 'Habibi', role: 'Gestor' }, 
        { name: 'Júnior', role: 'Barbeiro' }, 
        { name: 'Willian', role: 'Barbeiro' },
        { name: 'Recepção', role: 'Recepcionista' }
    ];
    const SERVICOS = [
        { id: 'corte', nome: 'Corte de Cabelo', valor: 40.00 },
        { id: 'barba', nome: 'Barba Tradicional', valor: 30.00 },
        { id: 'pezinho', nome: 'Pezinho', valor: 15.00 },
        { id: 'combo', nome: 'Cabelo + Barba', valor: 65.00 }
    ];
    const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'];
    const STATUS_LIST = ['Aguardando', 'Em-Atendimento', 'Aguardando-Pagamento', 'Finalizado'];

    // MAPEAMENTO DE ELEMENTOS DA UI (PRESERVADO E EXPANDIDO)
    const userScreen = document.getElementById('userScreen');
    const app = document.getElementById('app');
    const userList = document.getElementById('userList');
    const kanbanBoard = document.getElementById('kanbanBoard');
    const addAtendimentoBtn = document.getElementById('addAtendimentoBtn');
    const logoutButton = document.getElementById('logoutButton');
    const atendimentoModal = document.getElementById('atendimentoModal');
    const atendimentoForm = document.getElementById('atendimentoForm');
    const modalTitle = document.getElementById('modalTitle');
    const totalValueSpan = document.getElementById('total-value');
    const descontoInput = document.getElementById('desconto');

    // FUNÇÃO CENTRAL DE CÁLCULO DE TOTAL (NOVA, MAS INTEGRADA)
    function calcularTotal() {
        let subtotal = 0;
        document.querySelectorAll('#servicosContainer input[type="checkbox"]:checked').forEach(cb => {
            subtotal += parseFloat(cb.value);
        });
        const desconto = parseFloat(descontoInput.value) || 0;
        const totalFinal = Math.max(0, subtotal - desconto);
        totalValueSpan.textContent = totalFinal.toFixed(2).replace('.', ',');
    }

    // LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO (PRESERVADA)
    function showLogin() {
        userScreen.style.display = 'flex';
        app.classList.add('hidden');
        userList.innerHTML = USERS.map(user => `
            <button data-user="${user.name}" class="user-select-btn p-4 bg-gray-800 rounded-lg text-center hover:bg-amber-600 transition-colors">
                <i class='bx bx-user-circle text-4xl mb-2'></i>
                <span class="block font-bold">${user.name}</span>
            </button>
        `).join('');
    }

    function showApp(userName) {
        userScreen.style.display = 'none';
        app.classList.remove('hidden');
        document.getElementById('currentUserDisplay').textContent = `Usuário: ${userName}`;
        initializeKanban();
        loadAtendimentos();
    }

    userList.addEventListener('click', e => {
        const button = e.target.closest('.user-select-btn');
        if (button) {
            const userName = button.dataset.user;
            localStorage.setItem('currentUser', userName);
            showApp(userName);
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        showLogin();
    });

    // INICIALIZAÇÃO DO KANBAN (PRESERVADA)
    const initializeKanban = () => {
        kanbanBoard.innerHTML = STATUS_LIST.map(status => `
            <div class="status-column">
                <h3 class="font-bold text-lg mb-4 text-center">${status.replace(/-/g, ' ')}</h3>
                <div class="space-y-4 client-list" data-status="${status}"></div>
            </div>`).join('');
    };

    // CARREGAR ATENDIMENTOS DO FIREBASE (PRESERVADA)
    function loadAtendimentos() {
        db.ref('atendimentos').on('value', snapshot => {
            document.querySelectorAll('.client-list').forEach(list => list.innerHTML = '');
            const atendimentos = snapshot.val() || {};
            Object.entries(atendimentos).forEach(([id, data]) => {
                const card = createCardHTML({ id, ...data });
                const column = kanbanBoard.querySelector(`.client-list[data-status="${data.status}"]`);
                if (column) column.innerHTML += card;
            });
        });
    }

    function createCardHTML(atendimento) {
        const servicosStr = Array.isArray(atendimento.servicos) ? atendimento.servicos.map(s => s.nome).join(', ') : 'N/A';
        return `
            <div id="${atendimento.id}" class="vehicle-card" draggable="true" data-id="${atendimento.id}">
                <p class="font-bold text-lg">${atendimento.clienteNome}</p>
                <p class="text-sm text-gray-400">Barbeiro: ${atendimento.barbeiro}</p>
                <p class="text-sm text-gray-400">Serviços: ${servicosStr}</p>
                <p class="font-bold text-amber-400 mt-2 text-lg">R$ ${parseFloat(atendimento.valorTotal || 0).toFixed(2).replace('.', ',')}</p>
            </div>`;
    }

    // LÓGICA DO MODAL DE ATENDIMENTO (PRESERVADA E MELHORADA)
    function openModal(atendimento = null) {
        atendimentoForm.reset();
        document.getElementById('atendimentoId').value = atendimento ? atendimento.id : '';
        modalTitle.textContent = atendimento ? 'Editar Atendimento' : 'Novo Atendimento';

        document.getElementById('barbeiro').innerHTML = USERS.filter(u => u.role === 'Barbeiro').map(u => `<option value="${u.name}">${u.name}</option>`).join('');
        document.getElementById('formaPagamento').innerHTML = FORMAS_PAGAMENTO.map(f => `<option value="${f}">${f}</option>`).join('');
        
        const servicosContainer = document.getElementById('servicosContainer');
        servicosContainer.innerHTML = SERVICOS.map(s => `
            <div class="checkbox-group">
                <input type="checkbox" id="servico-${s.id}" value="${s.valor}" data-name="${s.nome}">
                <label for="servico-${s.id}">${s.nome} (R$ ${s.valor.toFixed(2).replace('.', ',')})</label>
            </div>`).join('');
        
        servicosContainer.querySelectorAll('input').forEach(input => input.addEventListener('change', calcularTotal));
        descontoInput.addEventListener('input', calcularTotal);

        if (atendimento) {
            document.getElementById('clienteNome').value = atendimento.clienteNome;
            document.getElementById('barbeiro').value = atendimento.barbeiro;
            document.getElementById('formaPagamento').value = atendimento.formaPagamento;
            descontoInput.value = atendimento.desconto || '';
            if (Array.isArray(atendimento.servicos)) {
                atendimento.servicos.forEach(s => {
                    const checkbox = document.getElementById(`servico-${s.id}`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }
        
        calcularTotal();
        atendimentoModal.classList.add('active');
    }

    addAtendimentoBtn.addEventListener('click', () => openModal());
    atendimentoModal.addEventListener('click', e => {
        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
            atendimentoModal.classList.remove('active');
        }
    });

    // SUBMISSÃO DO FORMULÁRIO (PRESERVADA E MELHORADA)
    atendimentoForm.addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('atendimentoId').value;
        const servicosSelecionados = [];
        document.querySelectorAll('#servicosContainer input:checked').forEach(cb => {
            servicosSelecionados.push({ id: cb.id.replace('servico-', ''), nome: cb.dataset.name, valor: parseFloat(cb.value) });
        });

        const data = {
            clienteNome: document.getElementById('clienteNome').value,
            barbeiro: document.getElementById('barbeiro').value,
            formaPagamento: document.getElementById('formaPagamento').value,
            servicos: servicosSelecionados,
            desconto: parseFloat(descontoInput.value) || 0,
            valorTotal: parseFloat(totalValueSpan.textContent.replace(',', '.')),
            status: id ? null : 'Aguardando',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        if (id) {
            const ref = db.ref(`atendimentos/${id}`);
            ref.once('value', snapshot => {
                data.status = snapshot.val().status; // Garante que o status não seja sobrescrito
                ref.update(data);
            });
        } else {
            db.ref('atendimentos').push(data);
        }
        atendimentoModal.classList.remove('active');
    });

    // DRAG AND DROP (PRESERVADO)
    kanbanBoard.addEventListener('dragstart', e => {
        if (e.target.classList.contains('vehicle-card')) e.dataTransfer.setData('text/plain', e.target.id);
    });
    kanbanBoard.addEventListener('dragover', e => e.preventDefault());
    kanbanBoard.addEventListener('drop', e => {
        e.preventDefault();
        const column = e.target.closest('.status-column');
        if (column) {
            const newStatus = column.querySelector('.client-list').dataset.status;
            const atendimentoId = e.dataTransfer.getData('text/plain');
            db.ref(`atendimentos/${atendimentoId}/status`).set(newStatus);
        }
    });

    // VERIFICAÇÃO INICIAL DE LOGIN (PRESERVADA)
    const loggedUser = localStorage.getItem('currentUser');
    if (loggedUser) {
        showApp(loggedUser);
    } else {
        showLogin();
    }
});
