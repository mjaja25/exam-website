const signupForm = document.getElementById('signup-form');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

function setupPeekButton(inputId, buttonId) {
    const passwordInput = document.getElementById(inputId);
    const peekButton = document.getElementById(buttonId);
    
    const eyeIconPath = "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
    const eyeSlashIconPath = "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L6.228 6.228";


    peekButton.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            peekButton.querySelector('svg').innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="${eyeSlashIconPath}" />`;
        } else {
            passwordInput.type = 'password';
            peekButton.querySelector('svg').innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="${eyeIconPath}" />`;
        }
    });
}

// Call the function for both password fields
setupPeekButton('password', 'peek-button-pass');
setupPeekButton('confirm-password', 'peek-button-confirm');

signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // --- New: Check if passwords match ---
    if (password !== confirmPassword) {
        alert("Passwords do not match. Please try again.");
        return; // Stop the function
    }
    // --- End of check ---

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }) // Send email instead of username
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            // We no longer redirect to login, just show the success message.
            // The user will go to their email to verify.
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('An error occurred during signup.');
    }
});