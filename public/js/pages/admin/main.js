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

    // 2. Initialize Navigation
    initSidebar();
    
    // 3. Initialize Tabs
    initTabs();
    
    // 4. Initialize Quick Actions
    initQuickActions();

    // 5. Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = () => auth.logout();

    // 6. Initialize Modules
    new UserManager();
    new ContentManager();
    const mcqManager = new MCQManager();
    mcqManager.initMCQBank();
    mcqManager.initSetCreation();
    mcqManager.fetchSets();

    // Expose MCQ methods for HTML onclick handlers
    window.closeEditModal = () => mcqManager.closeEditModal();
    window.saveEditMCQ = () => mcqManager.saveEditMCQ();
    window.closePreviewModal = () => mcqManager.closePreviewModal();
    window.closeBulkModal = () => mcqManager.closeBulkModal();

    // 7. Settings
    initSettings();

    // 8. Results
    fetchResults();
    
    // 9. Load Stats
    loadStats();
});

// Sidebar Navigation
function initSidebar() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-section]');
    const sections = document.querySelectorAll('.admin-section');
    const sidebar = document.getElementById('admin-sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const close = document.getElementById('sidebar-close');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.dataset.section;
            
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `section-${sectionId}`) {
                    section.classList.add('active');
                }
            });
            
            // Close sidebar on mobile
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
            }
        });
    });

    // Toggle sidebar on mobile
    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.add('open');
        });
    }

    if (close) {
        close.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }
}

// Content Tabs
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${tabId}`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Quick Actions
function initQuickActions() {
    const actionBtns = document.querySelectorAll('.action-btn[data-action]');
    
    actionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-section]');
            const sections = document.querySelectorAll('.admin-section');
            
            let targetSection = '';
            let targetTab = '';
            
            switch(action) {
                case 'add-user':
                    targetSection = 'users';
                    document.getElementById('add-user-btn').click();
                    break;
                case 'add-passage':
                    targetSection = 'content';
                    targetTab = 'passages';
                    break;
                case 'add-mcq':
                    targetSection = 'mcq';
                    break;
                case 'view-results':
                    targetSection = 'results';
                    break;
            }
            
            // Navigate to section
            if (targetSection) {
                navItems.forEach(nav => nav.classList.remove('active'));
                sections.forEach(section => section.classList.remove('active'));
                
                const targetNav = document.querySelector(`.sidebar-nav .nav-item[data-section="${targetSection}"]`);
                const targetSectionEl = document.getElementById(`section-${targetSection}`);
                
                if (targetNav) targetNav.classList.add('active');
                if (targetSectionEl) targetSectionEl.classList.add('active');
                
                // Switch tab if needed
                if (targetTab) {
                    const tabBtns = document.querySelectorAll('.tab-btn');
                    const tabContents = document.querySelectorAll('.tab-content');
                    
                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    
                    const activeTabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
                    const activeTabContent = document.getElementById(`tab-${targetTab}`);
                    
                    if (activeTabBtn) activeTabBtn.classList.add('active');
                    if (activeTabContent) activeTabContent.classList.add('active');
                }
            }
        });
    });
}

// Load Stats
async function loadStats() {
    try {
        const [users, passages, results] = await Promise.all([
            adminApi.getUsers({ page: 1, limit: 1 }),
            adminApi.getMcKQuestions({ page: 1, limit: 1 }),
            adminApi.getResults()
        ]);
        
        document.getElementById('stat-users').textContent = users.total || '0';
        document.getElementById('stat-mcqs').textContent = passages.total || '0';
        document.getElementById('stat-results').textContent = results.length || '0';
        
        // Load passages count
        const passagesEl = document.getElementById('stat-passages');
        if (passagesEl) {
            passagesEl.textContent = '--';
        }
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function initSettings() {
    const form = document.getElementById('settings-form');
    if (!form) return;

    try {
        const settings = await adminApi.getSettings();
        
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
            </tr>
        `;
    }).join('');
}

// Modal helpers
window.closeAddUserModal = () => {
    const modal = document.getElementById('add-user-modal');
    if (modal) modal.classList.remove('active');
};

window.closeResetPwModal = () => {
    const modal = document.getElementById('reset-pw-modal');
    if (modal) modal.classList.remove('active');
};
