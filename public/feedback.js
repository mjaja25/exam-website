document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Config ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    const feedbackForm = document.getElementById('feedback-form');
    const token = localStorage.getItem('token');

    feedbackForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const feedbackType = document.getElementById('feedback-type').value;
        const message = document.getElementById('feedback-message').value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ feedbackType, message })
            });
            const data = await response.json();
            if (typeof showToast === 'function') showToast(data.message, 'success');
            if (response.ok) {
                window.location.href = '/dashboard.html';
            }
        } catch (error) {
            if (typeof showToast === 'function') showToast('An error occurred. Please try again.', 'error');
        }
    });
});