import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const feedbackForm = document.getElementById('feedback-form');
    const token = auth.getToken();

    if (feedbackForm && token) {
        feedbackForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const feedbackType = document.getElementById('feedback-type')?.value;
            const message = document.getElementById('feedback-message')?.value;

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
                
                if (response.ok) {
                    ui.showToast(data.message, 'success');
                    window.location.href = '/dashboard.html';
                } else {
                    ui.showToast(data.message || 'Failed to submit feedback', 'error');
                }
            } catch (error) {
                ui.showToast('An error occurred. Please try again.', 'error');
            }
        });
    }
});
