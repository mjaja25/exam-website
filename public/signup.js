const signupForm = document.getElementById('signup-form');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

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
            body: JSON.stringify({ email, password }) // Send email instead of username
        });

        const data = await response.json();

        if (response.status === 201) {
            alert(data.message);
            window.location.href = '/login.html';
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('An error occurred during signup.');
    }
});