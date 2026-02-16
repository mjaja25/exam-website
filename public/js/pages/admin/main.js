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

    // 4. Results (Simple Logic kept here or moved to own module if it grows)
    fetchResults();
});

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
