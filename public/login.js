const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.textContent = ''; // Clear previous errors

    const email = document.getElementById('email').value; // Changed from username
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = '/dashboard.html';
        } else {
            // Display the error message from the server
            errorMessage.textContent = data.message;
        }
    } catch (error) {
        // Display a generic error for network issues, etc.
        errorMessage.textContent = 'An error occurred. Please try again.';
    }
});