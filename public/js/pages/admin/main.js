import { auth } from '../../utils/auth.js';
import { ui } from '../../utils/ui.js';
import { UserManager } from './users.js';
import { ContentManager } from './content.js';
import { MCQManager } from './mcq.js';
import { adminApi } from '../../api/admin.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Check
    if (!auth.isAuthenticated() || !auth.isAdmin()) {
        window.location.href = '/login.html';
        return;
    }

    // 2. Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = () => auth.logout();

    // 3. Initialize Modules
    new UserManager().fetchUsers();
    new ContentManager();
    const mcqManager = new MCQManager();
    mcqManager.fetchMCQs();
    mcqManager.fetchSets();

    // Expose MCQ methods for HTML onclick handlers
    window.closeEditModal = () => mcqManager.closeEditModal();
    window.saveEditMCQ = () => mcqManager.saveEditMCQ();
    window.closePreviewModal = () => mcqManager.closePreviewModal();

    // 4. Settings
    initSettings();

    // 5. Results (Simple Logic kept here or moved to own module if it grows)
    fetchResults();
});

async function initSettings() {
    const form = document.getElementById('settings-form');
    if (!form) return;

    try {
        const settings = await adminApi.getSettings();
        
        // Populate Form
        document.getElementById('set-wpm-threshold').value = settings.typing.wpmThreshold;
        document.getElementById('set-dur-std').value = settings.typing.durationSeconds;
        document.getElementById('set-dur-new').value = settings.typing.durationSecondsNewPattern;
        document.getElementById('set-max-std').value = settings.exam.maxTypingMarksStandard;
        document.getElementById('set-max-new').value = settings.exam.maxTypingMarksNew;
        document.getElementById('set-mcq-timer').value = settings.exam.excelMcqTimerSeconds;

    } catch (err) {
        ui.showToast('Failed to load settings', 'error');
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            typing: {
                wpmThreshold: parseInt(document.getElementById('set-wpm-threshold').value),
                durationSeconds: parseInt(document.getElementById('set-dur-std').value),
                durationSecondsNewPattern: parseInt(document.getElementById('set-dur-new').value)
            },
            exam: {
                maxTypingMarksStandard: parseInt(document.getElementById('set-max-std').value),
                maxTypingMarksNew: parseInt(document.getElementById('set-max-new').value),
                excelMcqTimerSeconds: parseInt(document.getElementById('set-mcq-timer').value)
            }
        };

        try {
            await adminApi.updateSettings(payload);
            ui.showToast('Settings saved successfully!', 'success');
        } catch (err) {
            ui.showToast('Failed to save settings', 'error');
        }
    };
}

async function fetchResults() {
    try {
        const results = await adminApi.getResults();
        renderResults(results);
    } catch (err) {
        console.error("Results load error", err);
    }
}

function renderResults(results) {
    const tbody = document.getElementById('results-tbody');
    if (!tbody) return;

    tbody.innerHTML = results.map(r => {
        const user = r.user ? r.user.username : 'Unknown';
        const date = new Date(r.submittedAt).toLocaleString();

        return `
            <tr>
                <td>${user}</td>
                <td>${r.testPattern === 'new_pattern' ? 'New (10+5)' : 'Standard'}</td>
                <td>${r.totalScore}/50</td>
                <td>${date}</td>
                <td>—</td>
            </tr>
        `;
    }).join('');
}
