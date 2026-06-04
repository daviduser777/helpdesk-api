// public/auth.js - Autenticación simple
const USERS = {
    admin: 'admin123',
    agente: 'agente123'
};

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (USERS[username] && USERS[username] === password) {
        // Guardar sesión
        sessionStorage.setItem('user', username);
        sessionStorage.setItem('isAuthenticated', 'true');
        
        // Redirigir al panel admin
        window.location.href = '/admin.html';
    } else {
        showAlert('❌ Usuario o contraseña incorrectos', 'error');
    }
});

function showAlert(message, type) {
    const alertDiv = document.getElementById('alert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 3000);
}

// Verificar autenticación en páginas protegidas
if (window.location.pathname.includes('admin.html') || window.location.pathname.includes('dashboard.html')) {
    if (!sessionStorage.getItem('isAuthenticated')) {
        window.location.href = '/login.html';
    }
}

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = '/login.html';
});