const forgotForm = document.getElementById('forgot-form');
const messageEl = document.getElementById('message');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageEl.textContent = '';
    messageEl.style.color = '';

    const email = document.getElementById('email').value.trim();
    if (!email) return;

    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (data.googleOnly) {
            // Google-only account
            messageEl.style.color = '#d97706';
            messageEl.textContent = data.message;
        } else {
            // Generic success message (whether account exists or not)
            messageEl.style.color = '#10b981';
            messageEl.textContent = data.message;
            forgotForm.querySelector('input[type="email"]').disabled = true;
            submitBtn.textContent = 'Link Sent';
        }
    } catch (error) {
        messageEl.style.color = '#ef4444';
        messageEl.textContent = 'An error occurred. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Link';
    }
});
