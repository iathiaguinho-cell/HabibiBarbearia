// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBW6CaxaYTHbOpCRDCptaYbpFi8OHabMik",
    authDomain: "habibi-ba516.firebaseapp.com",
    databaseURL: "https://habibi-ba516-default-rtdb.firebaseio.com",
    projectId: "habibi-ba516",
    storageBucket: "habibi-ba516.appspot.com",
    messagingSenderId: "744908900549",
    appId: "1:744908900549:web:f61575c692913fae3a08ac"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Função para salvar agendamento no Firebase
function saveAppointment(appointment) {
    const appointmentsRef = ref(database, 'appointments');
    set(appointmentsRef, appointment)
        .then(() => console.log('Agendamento salvo com sucesso'))
        .catch((error) => console.error('Erro ao salvar agendamento:', error));
}

// Função para buscar agendamentos do Firebase
function fetchAppointments() {
    const appointmentsRef = ref(database, 'appointments');
    onValue(appointmentsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            renderAppointments(data);
        }
    });
}

// Renderiza os agendamentos na tela
function renderAppointments(appointments) {
    const kanbanBoard = document.getElementById('kanbanBoard');
    kanbanBoard.innerHTML = ''; // Limpa o conteúdo anterior

    const statuses = ['Aguardando', 'Em Atendimento', 'Aguardando Pagamento', 'Finalizado'];
    statuses.forEach(status => {
        const column = document.createElement('div');
        column.className = 'status-column';
        column.innerHTML = `
            <h3 class="text-lg font-bold p-2">${status}</h3>
            <div class="client-list"></div>
        `;
        kanbanBoard.appendChild(column);

        const clientList = column.querySelector('.client-list');
        Object.values(appointments).forEach(appointment => {
            if (appointment.status === status) {
                const card = document.createElement('div');
                card.className = `vehicle-card status-${status.replace(' ', '-')}`;
                card.innerHTML = `
                    <p><strong>Cliente:</strong> ${appointment.clientName}</p>
                    <p><strong>Data/Hora:</strong> ${appointment.date} ${appointment.time}</p>
                `;
                clientList.appendChild(card);
            }
        });
    });
}

// Exemplo de usuários
document.addEventListener('DOMContentLoaded', () => {
    const userList = document.getElementById('userList');

    const users = [
        { name: 'Administrador', role: 'admin' },
        { name: 'Barbeiro João', role: 'barber' },
        { name: 'Recepcionista Maria', role: 'receptionist' }
    ];

    users.forEach(user => {
        const btn = document.createElement('button');
        btn.className = 'user-btn w-full text-center';
        btn.textContent = user.name;
        btn.onclick = () => loadDashboard(user.role);
        userList.appendChild(btn);
    });

    function loadDashboard(role) {
        document.getElementById('userScreen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('currentUserName').textContent = `Usuário: ${role}`;
        fetchAppointments(); // Carrega os agendamentos ao abrir o dashboard
    }

    // Abre o modal de agendamento
    document.getElementById('addAtendimentoBtn').addEventListener('click', () => {
        const modal = document.getElementById('atendimentoModal');
        modal.classList.remove('hidden');
    });

    // Fecha o modal
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            modal.classList.add('hidden');
        });
    });

    // Salva o agendamento
    document.getElementById('atendimentoForm').addEventListener('submit', event => {
        event.preventDefault();
        const form = event.target;
        const appointment = {
            clientName: form.clienteNome.value,
            date: form.agendamentoData.value,
            time: form.agendamentoHora.value,
            barber: form.barbeiroResponsavel.value,
            services: Array.from(form.servicosList.children).map(item => item.textContent),
            status: 'Aguardando'
        };
        saveAppointment(appointment);
        form.reset();
        document.getElementById('atendimentoModal').classList.add('hidden');
    });
});