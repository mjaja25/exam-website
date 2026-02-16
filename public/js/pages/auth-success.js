import { auth } from '../utils/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
        auth.setToken(token);
        window.location.href = '/dashboard.html';
    } else {
        window.location.href = '/login.html?error=auth_failed';
    }
});
