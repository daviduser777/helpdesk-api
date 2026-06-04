// public/dashboard.js - Métricas y gráficos
const API_URL = 'https://helpdesk-api-kappa.vercel.app';

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/tickets`);
        const result = await response.json();
        
        if (!result.success) return;
        
        const tickets = result.data;
        
        // Calcular estadísticas
        const totalTickets = tickets.length;
        const urgentTickets = tickets.filter(t => t.prioridad === 'urgente').length;
        const openTickets = tickets.filter(t => t.estado === 'abierto').length;
        const closedTickets = tickets.filter(t => t.estado === 'cerrado').length;
        
        // Actualizar números
        document.getElementById('totalTickets').textContent = totalTickets;
        document.getElementById('urgentTickets').textContent = urgentTickets;
        document.getElementById('openTickets').textContent = openTickets;
        document.getElementById('closedTickets').textContent = closedTickets;
        
        // Datos para el gráfico
        const priorityCounts = {
            urgente: tickets.filter(t => t.prioridad === 'urgente').length,
            alta: tickets.filter(t => t.prioridad === 'alta').length,
            normal: tickets.filter(t => t.prioridad === 'normal').length
        };
        
        // Crear gráfico
        const ctx = document.getElementById('ticketsChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Urgentes', 'Altas', 'Normales'],
                datasets: [{
                    label: 'Cantidad de Tickets',
                    data: [priorityCounts.urgente, priorityCounts.alta, priorityCounts.normal],
                    backgroundColor: ['#c00', '#e67e22', '#2196f3'],
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Tickets por Prioridad' }
                }
            }
        });
        
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// Verificar autenticación
if (!sessionStorage.getItem('isAuthenticated')) {
    window.location.href = '/login.html';
}

loadDashboard();