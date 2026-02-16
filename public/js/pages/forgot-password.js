import { API_BASE_URL } from '../config.js';

document.addEventListener('DOMContentLoaded', () => {
    const forgotForm = document.getElementById('forgot-form');
    const messageEl = document.getElementById('message');

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (messageEl) {
                messageEl.textContent = '';
                messageEl.style.color = '';
            }

            const email = document.getElementById('email')?.value.trim();
            if (!email) return;

            const submitBtn = forgotForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();

                if (data.googleOnly) {
                    if (messageEl) {
                        messageEl.style.color = '#d97706';
                        messageEl.textContent = data.message;
                    }
                } else {
                    if (messageEl) {
                        messageEl.style.color = '#10b981';
                        messageEl.textContent = data.message;
                    }
                    const emailInput = forgotForm.querySelector('input[type="email"]');
                    if (emailInput) emailInput.disabled = true;
                    if (submitBtn) submitBtn.textContent = 'Link Sent';
                }
            } catch (error) {
                if (messageEl) {
                    messageEl.style.color = '#ef4444';
                    messageEl.textContent = 'An error occurred. Please try again.';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Reset Link';
                }
            }
        });
    }
});
