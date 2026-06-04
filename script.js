// public/script.js - Lógica para crear tickets
const API_URL = 'https://helpdesk-api-kappa.vercel.app';

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const ticket = {
        titulo: document.getElementById('titulo').value,
        descripcion: document.getElementById('descripcion').value,
        prioridad: document.getElementById('prioridad').value,
        email_usuario: document.getElementById('email').value
    };
    
    // Mostrar loading
    const submitBtn = e.target.querySelector('button');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Enviando...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ticket)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Mostrar éxito
            showAlert('✅ Ticket creado exitosamente!', 'success');
            document.getElementById('ticketForm').reset();
            
            // Si hay link de Trello, mostrarlo
            if (result.trello_card_url) {
                document.getElementById('trelloInfo').innerHTML = `
                    🔴 Ticket URGENTE - Se ha creado una tarjeta en Trello:
                    <a href="${result.trello_card_url}" target="_blank">Ver en Trello</a>
                `;
                document.getElementById('trelloInfo').style.display = 'block';
            }
        } else {
            showAlert('❌ Error: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('❌ Error de conexión', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

function showAlert(message, type) {
    const alertDiv = document.getElementById('alert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}