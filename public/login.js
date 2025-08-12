const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

const passwordInput = document.getElementById('password');
const peekButton = document.getElementById('peek-button');
const peekIcon = document.getElementById('peek-icon');

const eyeIconPath = "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
const eyeSlashIconPath = "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L6.228 6.228";

peekButton.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        peekIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="${eyeSlashIconPath}" />`;
    } else {
        passwordInput.type = 'password';
        peekIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="${eyeIconPath}" />`;
    }
});

// --- Mobile Warning (Correct Placement) ---
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    mobileWarning.style.display = 'block'; // Show the banner
    document.body.classList.add('mobile-warning-active'); // Add padding to the body
}

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