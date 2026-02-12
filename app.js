// Huidige tab
let currentTab = 'Chris';

// Tab wisselen
function switchTab(tab) {
    currentTab = tab;
    
    // Maak alle tabs inactief
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Maak de geselecteerde tab actief
    const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Laad tickets opnieuw
    loadTickets();
}

// Tickets laden en tonen
function loadTickets() {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');

    // 1. FILTER OP PERSOON - Alleen tickets van de huidige actieve tab tonen
    tickets = tickets.filter(t => t.assigned_to === currentTab);
    
    // 2. Filteren op status
    const statusFilter = document.getElementById('statusFilter').value;
    tickets = tickets.filter(t => (statusFilter === 'Alle' || t.status === statusFilter));

    // 3. Sorteren
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

    // 4. Tabel vullen
    const list = document.getElementById('ticketList');
    if (!list) return;
    list.innerHTML = '';

    tickets.forEach(ticket => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openTicketModal(ticket.id);
        
        tr.innerHTML = `
            <td>${ticket.title}</td>
            <td class="description-cell">${ticket.description.substring(0, 100)}${ticket.description.length > 100 ? '...' : ''}</td>
            <td>${ticket.status}</td>
            <td>${ticket.assigned_to || 'Chris'}</td>
            <td>${new Date(ticket.created_at).toLocaleString('nl-NL')}</td>
            <td>${ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('nl-NL') : '-'}</td>
        `;
        list.appendChild(tr);
    });

    applyStatusColors();
}

// --- GITHUB SYNC (BACKUP & OPHALEN) ---
const REPO_OWNER = 'Granade1987';
const REPO_NAME = 'to-do';
const FILE_PATH = 'tickets.json';

async function syncToGitHub() {
    const GITHUB_TOKEN = localStorage.getItem('github_token');
    if (!GITHUB_TOKEN) return;

    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    const filteredTickets = tickets.filter(t => t.assigned_to !== 'Extern');

    try {
        let sha = "";
        const getRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });
        
        if (getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
        }

        const putRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Ticket backup: ${new Date().toLocaleString('nl-NL')}`,
                content: btoa(unescape(encodeURIComponent(JSON.stringify(filteredTickets, null, 2)))),
                sha: sha !== "" ? sha : undefined
            })
        });

        if (putRes.ok) console.log("✅ Synchronisatie geslaagd");
    } catch (error) {
        console.error("❌ GitHub Sync Fout:", error);
    }
}

// --- INITIALISATIE ---
async function initializeApp() {
    const GITHUB_TOKEN = localStorage.getItem('github_token');

    if (GITHUB_TOKEN) {
        try {
            const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` },
                cache: "no-store"
            });
            if (res.ok) {
                const data = await res.json();
                const ticketsFromGit = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                localStorage.setItem('tickets', JSON.stringify(ticketsFromGit));
                console.log('✅ Nieuwste data opgehaald van GitHub');
            }
        } catch (error) {
            console.error('❌ Fout bij ophalen data:', error);
        }
    }

    migrateTickets();
    loadTickets();
}

// --- EXPORT / IMPORT FUNCTIES ---
function exportTicketsToCSV() {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    if (!tickets.length) return alert('Geen tickets om te exporteren.');

    const header = ['Titel', 'Beschrijving', 'Status', 'Toegewezen aan', 'Aangemaakt', 'Gesloten'];
    const rows = tickets.map(t => [
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${t.status}"`,
        `"${t.assigned_to || ''}"`,
        `"${t.created_at}"`,
        `"${t.closed_at || ''}"`
    ].join(','));
    
    const csvContent = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets_backup_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importTicketsFromCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return alert('Geen geldige CSV.');

        const newTickets = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split op komma maar negeer die tussen quotes
            if (cols.length < 6) continue;

            newTickets.push({
                id: Date.now() + i,
                title: cols[0].replace(/"/g, ''),
                description: cols[1].replace(/"/g, ''),
                status: cols[2].replace(/"/g, ''),
                assigned_to: cols[3].replace(/"/g, ''),
                created_at: cols[4].replace(/"/g, ''),
                closed_at: cols[5].replace(/"/g, '') || null
            });
        }
        
        let existing = JSON.parse(localStorage.getItem('tickets') || '[]');
        localStorage.setItem('tickets', JSON.stringify([...existing, ...newTickets]));
        
        syncToGitHub();
        loadTickets();
        alert('Tickets succesvol geïmporteerd en gesynchroniseerd!');
    };
    reader.readAsText(file);
}

// --- OVERIGE FUNCTIES (MODALS & HELPERS) ---
function openCreateModal() {
    document.getElementById('newTicketTitle').value = '';
    document.getElementById('newTicketDescription').value = '';
    document.getElementById('newTicketStatus').value = 'Open';
    document.getElementById('newTicketAssigned').value = currentTab;
    document.getElementById('createTicketModal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('createTicketModal').style.display = 'none';
}

function saveNewTicket() {
    const title = document.getElementById('newTicketTitle').value.trim();
    const description = document.getElementById('newTicketDescription').value.trim();
    const status = document.getElementById('newTicketStatus').value;
    const assigned_to = document.getElementById('newTicketAssigned').value;

    if (!title) return alert('Titel is verplicht');

    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    tickets.push({
        id: Date.now(),
        title,
        description,
        status,
        assigned_to,
        created_at: new Date().toISOString(),
        closed_at: status === 'Gesloten' ? new Date().toISOString() : null
    });
    
    localStorage.setItem('tickets', JSON.stringify(tickets));
    syncToGitHub();
    closeCreateModal();
    loadTickets();
}

function openTicketModal(id) {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    document.getElementById('modalTicketId').value = ticket.id;
    document.getElementById('modalTitle').value = ticket.title;
    document.getElementById('modalDescription').value = ticket.description;
    document.getElementById('modalStatus').value = ticket.status;
    document.getElementById('modalAssigned').value = ticket.assigned_to || 'Chris';
    document.getElementById('modalCreated').textContent = new Date(ticket.created_at).toLocaleString('nl-NL');
    document.getElementById('modalClosed').textContent = ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('nl-NL') : '-';

    document.getElementById('ticketModal').style.display = 'flex';
}

function closeModal() { document.getElementById('ticketModal').style.display = 'none'; }

function updateStatusFromModal() {
    const id = parseInt(document.getElementById('modalTicketId').value);
    const newStatus = document.getElementById('modalStatus').value;
    const newTitle = document.getElementById('modalTitle').value.trim();
    const newDescription = document.getElementById('modalDescription').value.trim();
    const newAssigned = document.getElementById('modalAssigned').value;

    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    tickets = tickets.map(t => {
        if (t.id === id) {
            t.status = newStatus;
            t.title = newTitle;
            t.description = newDescription;
            t.assigned_to = newAssigned;
            if (newStatus === 'Gesloten' && !t.closed_at) t.closed_at = new Date().toISOString();
            if (newStatus !== 'Gesloten') t.closed_at = null;
        }
        return t;
    });
    localStorage.setItem('tickets', JSON.stringify(tickets));
    syncToGitHub();
    closeModal();
    loadTickets();
}

function deleteTicket(id) {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    tickets = tickets.filter(t => t.id !== id);
    localStorage.setItem('tickets', JSON.stringify(tickets));
    syncToGitHub();
    closeModal();
    loadTickets();
}

function deleteTicketFromModal() {
    const id = parseInt(document.getElementById('modalTicketId').value);
    if (confirm('Weet je zeker dat je dit ticket wilt verwijderen?')) deleteTicket(id);
}

function applyStatusColors() {
    const rows = document.querySelectorAll('#ticketList tr');
    rows.forEach(row => {
        const status = row.querySelector('td:nth-child(3)')?.textContent.trim();
        row.classList.remove('open', 'in-behandeling', 'gesloten');
        if (status === 'Open') row.classList.add('open');
        else if (status === 'In behandeling') row.classList.add('in-behandeling');
        else if (status === 'Gesloten') row.classList.add('gesloten');
    });
}

function migrateTickets() {
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    let needsUpdate = false;
    tickets = tickets.map(t => {
        if (!t.assigned_to) { t.assigned_to = 'Chris'; needsUpdate = true; }
        return t;
    });
    if (needsUpdate) localStorage.setItem('tickets', JSON.stringify(tickets));
}

function openSettingsModal() {
    const token = localStorage.getItem('github_token') || '';
    document.getElementById('githubTokenInput').value = token;
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }

function saveGithubToken() {
    const token = document.getElementById('githubTokenInput').value.trim();
    if (!token) return alert('Voer een token in');
    localStorage.setItem('github_token', token);
    alert('Token opgeslagen! App herstart nu.');
    location.reload();
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Dark mode logic
    const darkModeToggle = document.getElementById('darkModeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    darkModeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Button Listeners
    document.getElementById('createTicketBtn').addEventListener('click', openCreateModal);
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('statusFilter').addEventListener('change', loadTickets);
    document.getElementById('sortFilter').addEventListener('change', loadTickets);
    document.getElementById('exportCsvBtn').addEventListener('click', exportTicketsToCSV);
    document.getElementById('importCsvInput').addEventListener('change', function(e) {
        if (e.target.files.length) {
            importTicketsFromCSV(e.target.files[0]);
            e.target.value = ''; // Reset
        }
    });
});

window.onclick = (event) => {
    if (event.target.className === 'modal') {
        closeModal();
        closeCreateModal();
        closeSettingsModal();
    }
};
