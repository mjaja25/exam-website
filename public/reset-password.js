const resetForm = document.getElementById('reset-form');
const messageEl = document.getElementById('message');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

// Extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// If no token, show error immediately
if (!token) {
    messageEl.style.color = '#ef4444';
    messageEl.textContent = 'Invalid reset link. No token provided.';
    resetForm.querySelector('button[type="submit"]').disabled = true;
}

resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageEl.textContent = '';
    messageEl.style.color = '';

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword.length < 6) {
        messageEl.style.color = '#ef4444';
        messageEl.textContent = 'Password must be at least 6 characters.';
        return;
    }

    if (newPassword !== confirmPassword) {
        messageEl.style.color = '#ef4444';
        messageEl.textContent = 'Passwords do not match.';
        return;
    }

    const submitBtn = resetForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await response.json();

        if (response.ok) {
            messageEl.style.color = '#10b981';
            messageEl.textContent = data.message;
            // Disable form fields after success
            document.getElementById('new-password').disabled = true;
            document.getElementById('confirm-password').disabled = true;
            submitBtn.textContent = 'Password Reset';

            // Redirect to login after a short delay
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2500);
        } else {
            messageEl.style.color = '#ef4444';
            messageEl.textContent = data.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Reset Password';
        }
    } catch (error) {
        messageEl.style.color = '#ef4444';
        messageEl.textContent = 'An error occurred. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';
    }
});
