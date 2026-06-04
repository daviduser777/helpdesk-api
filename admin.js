// public/admin.js - Panel de agentes
const API_URL = 'https://helpdesk-api-kappa.vercel.app';

// Verificar autenticación
if (!sessionStorage.getItem('isAuthenticated')) {
    window.location.href = '/login.html';
}

async function loadTickets() {
    const loadingDiv = document.getElementById('loading');
    const ticketsDiv = document.getElementById('ticketsList');
    
    try {
        const response = await fetch(`${API_URL}/tickets`);
        const result = await response.json();
        
        loadingDiv.style.display = 'none';
        
        if (result.success && result.data.length === 0) {
            ticketsDiv.innerHTML = '<p style="text-align:center">No hay tickets aún.</p>';
            return;
        }
        
        // Mostrar tickets
        ticketsDiv.innerHTML = result.data.map(ticket => `
            <div class="ticket-card">
                <div class="ticket-title">${escapeHtml(ticket.titulo)}</div>
                <div class="ticket-meta">
                    <span class="priority priority-${ticket.prioridad}">${getPriorityText(ticket.prioridad)}</span>
                    <span class="status status-${ticket.estado.replace(' ', '-')}">${getStatusText(ticket.estado)}</span>
                    <span>📧 ${escapeHtml(ticket.email_usuario)}</span>
                    <span>📅 ${new Date(ticket.fecha_creacion).toLocaleString()}</span>
                </div>
                <div class="ticket-desc">${escapeHtml(ticket.descripcion)}</div>
                <div style="margin-top: 15px;">
                    <select onchange="updateStatus('${ticket._id}', this.value)" class="status-select">
                        <option value="abierto" ${ticket.estado === 'abierto' ? 'selected' : ''}>Abierto</option>
                        <option value="en_proceso" ${ticket.estado === 'en_proceso' ? 'selected' : ''}>En Proceso</option>
                        <option value="cerrado" ${ticket.estado === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                    </select>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        loadingDiv.innerHTML = '<p style="color:red">Error cargando tickets</p>';
    }
}

async function updateStatus(id, newStatus) {
    try {
        await fetch(`${API_URL}/tickets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: newStatus })
        });
        loadTickets(); // Recargar
    } catch (error) {
        alert('Error actualizando estado');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPriorityText(priority) {
    const texts = { urgent: '🔴 Urgente', alta: '🟠 Alta', normal: '🟢 Normal' };
    return texts[priority] || priority;
}

function getStatusText(status) {
    const texts = { abierto: '🟢 Abierto', en_proceso: '🟡 En Proceso', cerrado: '⚫ Cerrado' };
    return texts[status] || status;
}

// Cargar tickets al inicio
loadTickets();