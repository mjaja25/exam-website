import { API_BASE_URL } from '../config.js';

document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('reset-form');
    const messageEl = document.getElementById('message');

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token && resetForm) {
        if (messageEl) {
            messageEl.style.color = '#ef4444';
            messageEl.textContent = 'Invalid reset link. No token provided.';
        }
        const submitBtn = resetForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (messageEl) {
                messageEl.textContent = '';
                messageEl.style.color = '';
            }

            const newPassword = document.getElementById('new-password')?.value;
            const confirmPassword = document.getElementById('confirm-password')?.value;

            if (!newPassword || newPassword.length < 6) {
                if (messageEl) {
                    messageEl.style.color = '#ef4444';
                    messageEl.textContent = 'Password must be at least 6 characters.';
                }
                return;
            }

            if (newPassword !== confirmPassword) {
                if (messageEl) {
                    messageEl.style.color = '#ef4444';
                    messageEl.textContent = 'Passwords do not match.';
                }
                return;
            }

            const submitBtn = resetForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Resetting...';
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword })
                });
                const data = await response.json();

                if (response.ok) {
                    if (messageEl) {
                        messageEl.style.color = '#10b981';
                        messageEl.textContent = data.message;
                    }
                    const newPassEl = document.getElementById('new-password');
                    const confirmPassEl = document.getElementById('confirm-password');
                    if (newPassEl) newPassEl.disabled = true;
                    if (confirmPassEl) confirmPassEl.disabled = true;
                    if (submitBtn) submitBtn.textContent = 'Password Reset';

                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 2500);
                } else {
                    if (messageEl) {
                        messageEl.style.color = '#ef4444';
                        messageEl.textContent = data.message;
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Reset Password';
                    }
                }
            } catch (error) {
                if (messageEl) {
                    messageEl.style.color = '#ef4444';
                    messageEl.textContent = 'An error occurred. Please try again.';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Reset Password';
                }
            }
        });
    }
});
