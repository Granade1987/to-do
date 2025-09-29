// Tickets laden en tonen
function loadTickets() {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');

    // Filteren op status
    const statusFilter = document.getElementById('statusFilter').value;
    tickets = tickets.filter(t => (statusFilter === 'Alle' || t.status === statusFilter));

    // Sorteren
   const sortFilter = document.getElementById('sortFilter') ? document.getElementById('sortFilter').value : 'status';
    if (sortFilter === 'created_at') {
        tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortFilter === 'status') {
        const statusOrder = { 'In behandeling': 0, 'Open': 1, 'Gesloten': 99 };
        tickets.sort((a, b) => {
            const sa = statusOrder[a.status] ?? 99;
            const sb = statusOrder[b.status] ?? 99;
            if (sa !== sb) return sa - sb;
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    // Tabel vullen
    const list = document.getElementById('ticketList');
    list.innerHTML = '';
    tickets.forEach(ticket => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = function() {
            openTicketModal(ticket.id);
        };
        tr.innerHTML = `
<td>${ticket.title}</td>
<td>${ticket.description.substring(0, 50)}${ticket.description.length > 50 ? '...' : ''}</td>
<td>${ticket.status}</td>
<td>${new Date(ticket.created_at).toLocaleString('nl-NL', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
<td>${ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('nl-NL', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</td>
`;
        list.appendChild(tr);
    });

    applyStatusColors();
}

// Modal openen voor nieuw ticket
function openCreateModal() {
    document.getElementById('newTicketTitle').value = '';
    document.getElementById('newTicketDescription').value = '';
    document.getElementById('newTicketStatus').value = 'Open';
    document.getElementById('createTicketModal').style.display = 'flex';
}

// Modal sluiten
function closeCreateModal() {
    document.getElementById('createTicketModal').style.display = 'none';
}

// Nieuw ticket opslaan
function saveNewTicket() {
    const title = document.getElementById('newTicketTitle').value.trim();
    const description = document.getElementById('newTicketDescription').value.trim();
    const status = document.getElementById('newTicketStatus').value;

    if (!title || !description) {
        alert('Titel en beschrijving verplicht');
        return;
    }

    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    tickets.push({
        id: tickets.length ? Math.max(...tickets.map(t => t.id)) + 1 : 1,
        title,
        description,
        status,
        created_at: new Date().toISOString(),
        closed_at: status === 'Gesloten' ? new Date().toISOString() : null
    });
    localStorage.setItem('tickets', JSON.stringify(tickets));
    closeCreateModal();
    loadTickets();
}

// Ticket modal openen
function openTicketModal(id) {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    document.getElementById('modalTicketId').value = ticket.id;
    document.getElementById('modalTitle').value = ticket.title;
    document.getElementById('modalDescription').value = ticket.description;
    document.getElementById('modalStatus').value = ticket.status;
    document.getElementById('modalCreated').textContent = new Date(ticket.created_at).toLocaleString('nl-NL', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    document.getElementById('modalClosed').textContent = ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('nl-NL', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';

    document.getElementById('ticketModal').style.display = 'flex';
}

// Ticket modal sluiten
function closeModal() {
    document.getElementById('ticketModal').style.display = 'none';
}

// Ticket bijwerken vanuit modal
function updateStatusFromModal() {
    const id = parseInt(document.getElementById('modalTicketId').value);
    const newStatus = document.getElementById('modalStatus').value;
    const newTitle = document.getElementById('modalTitle').value.trim();
    const newDescription = document.getElementById('modalDescription').value.trim();

    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    tickets = tickets.map(t => {
        if (t.id === id) {
            t.status = newStatus;
            t.title = newTitle;
            t.description = newDescription;
            if (newStatus === 'Gesloten' && !t.closed_at) t.closed_at = new Date().toISOString();
            if (newStatus !== 'Gesloten') t.closed_at = null;
        }
        return t;
    });
    localStorage.setItem('tickets', JSON.stringify(tickets));
    closeModal();
    loadTickets();
}

// Ticket verwijderen vanuit modal
function deleteTicketFromModal() {
    const id = parseInt(document.getElementById('modalTicketId').value);
    if (confirm('Weet je zeker dat je dit ticket wilt verwijderen?')) {
        deleteTicket(id);
    }
}

// Ticket verwijderen
function deleteTicket(id) {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    tickets = tickets.filter(t => t.id !== id);
    localStorage.setItem('tickets', JSON.stringify(tickets));
    closeModal();
    loadTickets();
}

// Status kleuren toepassen
function applyStatusColors() {
    const rows = document.querySelectorAll('#ticketList tr');
    rows.forEach(row => {
        const status = row.querySelector('td:nth-child(3)')?.textContent.trim();
        row.classList.remove('open', 'in-behandeling', 'gesloten');
        if (status === 'Open') {
            row.classList.add('open');
        } else if (status === 'In behandeling') {
            row.classList.add('in-behandeling');
        } else if (status === 'Gesloten') {
            row.classList.add('gesloten');
        }
    });
}

// Sluit modals bij klik buiten de content
window.onclick = function(event) {
    const ticketModal = document.getElementById('ticketModal');
    const createModal = document.getElementById('createTicketModal');
    if (event.target === ticketModal) closeModal();
    if (event.target === createModal) closeCreateModal();
};

// Event listeners
document.getElementById('createTicketBtn').addEventListener('click', openCreateModal);
document.getElementById('statusFilter').addEventListener('change', loadTickets);
document.getElementById('sortFilter').addEventListener('change', loadTickets);

// Init
loadTickets();