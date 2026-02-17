import { auth } from '../utils/auth.js';
import { client } from '../api/client.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    if (!auth.isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    const dom = {
        welcomeHeader: document.getElementById('welcome-header'),
        adminBtn: document.getElementById('admin-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        resultsSummary: document.getElementById('results-summary'),
        startTestBtn: document.getElementById('open-exam-modal-btn'),
        patternModal: document.getElementById('pattern-modal'),
        profileModal: document.getElementById('profile-modal'),
        mobileWarning: document.getElementById('mobile-warning'),
        navAvatar: document.getElementById('nav-avatar'),
        navInitials: document.getElementById('nav-initials'),
        practiceCtx: document.getElementById('practice-chart')
    };

    // Bio character count listener
    const bioEl = document.getElementById('profile-bio');
    if (bioEl) {
        bioEl.addEventListener('input', updateBioCount);
    }

    // Mobile Warning
    if (window.innerWidth <= 768 && dom.mobileWarning) {
        dom.mobileWarning.style.display = 'block';
        document.body.classList.add('mobile-warning-active');
    }

    // Bind Global Events
    if (dom.logoutBtn) dom.logoutBtn.onclick = () => auth.logout();
    if (dom.startTestBtn) dom.startTestBtn.onclick = () => openExamModal();
    window.onclick = (event) => {
        if (event.target == dom.patternModal) closeModal();
        if (event.target == dom.profileModal) closeProfileModal();
    };

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeProfileModal();
        }
    });

    // Expose window functions for HTML onclicks (temporary compatibility)
    window.openExamModal = openExamModal;
    window.closeModal = closeModal;
    window.handleExamSelection = handleExamSelection;
    window.startPractice = startPractice;
    window.viewResult = viewResult;
    window.toggleLeaderboard = toggleLeaderboard;

    // Profile Modal
    window.openProfileModal = openProfileModal;
    window.closeProfileModal = closeProfileModal;
    window.handleFileSelect = handleFileSelect;
    window.selectDefault = selectDefault;
    window.saveProfile = saveProfile;

    // Load Data
    fetchDashboardData();
    fetchPracticeStats();
    
    // Auto-open exam modal if coming from results page
    if (localStorage.getItem('autoOpenExamModal') === 'true') {
        localStorage.removeItem('autoOpenExamModal');
        setTimeout(() => openExamModal(), 500);
    }

    // Scroll to practice section if coming from results page
    if (localStorage.getItem('scrollToPractice') === 'true') {
        localStorage.removeItem('scrollToPractice');
        setTimeout(() => {
            const practiceCard = document.querySelector('.practice-zone-card');
            if (practiceCard) {
                practiceCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 500);
    }
});

// --- Data Fetching ---
async function fetchDashboardData() {
    try {
        const data = await client.get('/api/user/dashboard');

        if (data.user) {
            updateProfileUI(data.user);
            if (data.user.role === 'admin') {
                const btn = document.getElementById('admin-btn');
                if (btn) btn.style.display = 'inline-block';
            }
        }
        displayResults(data.results);
        startLeaderboardCarousel();
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

function updateProfileUI(user) {
    const welcome = document.getElementById('welcome-header');
    if (welcome) welcome.textContent = `Welcome, ${user.username}!`;

    const navAvatar = document.getElementById('nav-avatar');
    const navInitials = document.getElementById('nav-initials');
    const initials = user.username.substring(0, 2).toUpperCase();

    if (user.avatar) {
        if (user.avatar.startsWith('default-')) {
            const map = { '1': '🐶', '2': '🐱', '3': '🦊', '4': '🦁' };
            const id = user.avatar.split('-')[1];
            navInitials.textContent = map[id] || initials;
            navInitials.style.display = 'flex';
            navAvatar.style.display = 'none';
        } else {
            navAvatar.src = user.avatar;
            navAvatar.style.display = 'block';
            navInitials.style.display = 'none';
        }
    } else {
        navInitials.textContent = initials;
        navInitials.style.display = 'flex';
        navAvatar.style.display = 'none';
    }

    // Store for profile modal usage
    window.currentUserData = user;
}

function displayResults(results) {
    const container = document.getElementById('results-summary');
    if (!container) return;

    if (!results || results.length === 0) {
        container.innerHTML = '<tr><td colspan="4">You have no past results.</td></tr>';
        return;
    }

    container.innerHTML = results.map(session => {
        const total = Math.round(session.totalScore || 0);
        const date = new Date(session.submittedAt).toLocaleDateString();
        const patternLabel = session.testPattern === 'new_pattern' ? '10+5' : 'Std';
        const maxScore = 50;

        return `
            <tr>
                <td>${date}</td>
                <td>${patternLabel}</td>
                <td><strong>${total} / ${maxScore}</strong></td>
                <td>
                    <button class="view-btn" onclick="viewResult('${session.sessionId}', '${session.testPattern || 'standard'}')">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function fetchPracticeStats() {
    try {
        const data = await client.get('/api/practice/stats');
        renderPracticeChart(data);
    } catch (err) { console.error(err); }
}

function renderPracticeChart(data) {
    const ctx = document.getElementById('practice-chart');
    if (!ctx || !data || data.length === 0) {
        if (ctx) ctx.parentElement.innerHTML = '<p class="text-center text-gray-500 mt-8">No practice sessions recorded yet.</p>';
        return;
    }

    const labels = data.map(d => new Date(d._id).toLocaleDateString());
    const scores = data.map(d => d.totalScore);
    const sessions = data.map(d => d.sessions);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Score',
                    data: scores,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Sessions',
                    data: sessions,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Score Points' } },
                y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Sessions Count' } }
            }
        }
    });
}

// --- Leaderboard Carousel ---
let leaderboardData = null;
let currentCategoryIndex = 0;
let activeCategories = [];
let carouselInterval;

const stdCategories = [
    { key: 'std_overall', label: 'Standard Pattern: Overall Top 3' },
    { key: 'std_typing', label: 'Standard: Typing Speed Kings' },
    { key: 'std_letter', label: 'Standard: Best Letters' },
    { key: 'std_excel', label: 'Standard: Excel Masters' }
];

const newCategories = [
    { key: 'new_overall', label: 'New Pattern (10+5): Overall Leaders' },
    { key: 'new_typing', label: 'New Pattern: Typing Speed Kings' },
    { key: 'new_mcq', label: 'New Pattern: Excel MCQ Experts' }
];

// Default
activeCategories = stdCategories;

async function startLeaderboardCarousel() {
    try {
        leaderboardData = await client.get('/api/leaderboard/all');
        const startBtn = Array.from(document.querySelectorAll('.icon-btn')).find(b => b.innerText.includes('S'));
        if (startBtn) startBtn.classList.add('active');

        updateCarouselSlide();
        carouselInterval = setInterval(updateCarouselSlide, 6000);
    } catch (err) {
        const podium = document.getElementById('carousel-winners');
        if (podium) podium.innerHTML = '<p class="text-center text-gray-500">Failed to load rankings.</p>';
    }
}

function toggleLeaderboard(type) {
    document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('active'));
    const selector = type === 'standard' ? 'S' : 'N';
    const btn = Array.from(document.querySelectorAll('.icon-btn')).find(b => b.innerText.includes(selector));
    if (btn) btn.classList.add('active');

    activeCategories = type === 'standard' ? stdCategories : newCategories;
    currentCategoryIndex = 0;
    updateCarouselSlide();

    clearInterval(carouselInterval);
    carouselInterval = setInterval(updateCarouselSlide, 6000);
}

function updateCarouselSlide() {
    if (!leaderboardData) return;
    const cat = activeCategories[currentCategoryIndex];
    const winners = leaderboardData[cat.key] ? leaderboardData[cat.key].slice(0, 3) : [];

    const podium = document.getElementById('carousel-winners');
    const title = document.getElementById('carousel-title');
    if (title) title.innerText = cat.label;

    if (podium) {
        podium.innerHTML = winners.map((w, i) => {
            let val = 0;
            let unit = 'Pts';
            if (cat.key.includes('typing')) { val = w.wpm; unit = 'WPM'; }
            else if (cat.key.includes('mcq')) { val = w.mcqScore; unit = 'Pts'; }
            else if (cat.key.includes('letter')) { val = w.letterScore || 0; }
            else if (cat.key.includes('excel')) { val = w.excelScore || 0; }
            else { val = w.totalScore; }

            return `
                <div class="winner-entry rank-${i + 1}">
                    <span class="medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <span class="username">${w.user?.username || 'Anonymous'}</span>
                    <span class="score-val">${Math.round(val)} <small>${unit}</small></span>
                </div>
            `;
        }).join('');
    }
    currentCategoryIndex = (currentCategoryIndex + 1) % activeCategories.length;
}


// --- Actions ---

function openExamModal() {
    const m = document.getElementById('pattern-modal');
    if (m) {
        m.classList.remove('hidden');
        // Force reflow to ensure transition works
        m.offsetHeight;
        m.classList.add('active');
    }
}

function closeModal() {
    const m = document.getElementById('pattern-modal');
    if (m) {
        m.classList.remove('active');
        // Reset option cards
        document.querySelectorAll('.option-card').forEach(card => {
            card.classList.remove('selected');
        });
        setTimeout(() => {
            m.classList.add('hidden');
        }, 300);
    }
}

function handleExamSelection(pattern) {
    // Add visual feedback
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');

    // Small delay to show selection before navigating
    setTimeout(() => {
        localStorage.removeItem('currentSessionId');
        localStorage.setItem('currentExamPattern', pattern);
        localStorage.setItem('currentAttemptMode', 'exam');
        localStorage.setItem('currentSessionId', 'sess_' + Date.now());
        window.location.href = '/typing.html';
    }, 200);
}

function startPractice(type) {
    localStorage.setItem('currentAttemptMode', 'practice');
    localStorage.setItem('currentExamPattern', 'none');
    const routes = {
        typing: '/practice-typing.html',
        mcq: '/practice-mcq.html',
        letter: '/practice-letter.html',
        excel: '/practice-excel.html'
    };
    window.location.href = routes[type] || '/dashboard.html';
}

function viewResult(sessionId, pattern) {
    const page = (pattern === 'new_pattern') ? 'results-new.html' : 'results.html';
    window.location.href = `/${page}?sessionId=${sessionId}`;
}

// --- Profile Modal ---
// (Kept similar to original but using client)
let selectedFile = null;
let selectedDefaultId = null;

function openProfileModal() {
    const m = document.getElementById('profile-modal');
    if (m) {
        m.classList.remove('hidden');
        // Force reflow to ensure transition works
        m.offsetHeight;
        m.classList.add('active');
    }

    if (window.currentUserData) {
        const bioEl = document.getElementById('profile-bio');
        bioEl.value = window.currentUserData.bio || '';
        updateBioCount();
    }
}

function updateBioCount() {
    const bioEl = document.getElementById('profile-bio');
    const countEl = document.getElementById('bio-count');
    if (bioEl && countEl) {
        countEl.textContent = bioEl.value.length;
    }
}

function closeProfileModal() {
    const m = document.getElementById('profile-modal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => {
            m.classList.add('hidden');
            // Reset form state
            selectedFile = null;
            selectedDefaultId = null;
            // Reset avatar preview
            document.getElementById('preview-avatar-img').classList.add('hidden');
            document.getElementById('preview-avatar-initials').style.display = 'flex';
            // Reset bio
            if (window.currentUserData) {
                document.getElementById('profile-bio').value = window.currentUserData.bio || '';
                updateBioCount();
            }
        }, 300);
    }
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        selectedDefaultId = null;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('preview-avatar-img');
            img.src = e.target.result;
            img.classList.remove('hidden');
            document.getElementById('preview-avatar-initials').style.display = 'none';
        };
        reader.readAsDataURL(selectedFile);
    }
}

function selectDefault(id) {
    selectedDefaultId = id;
    selectedFile = null;
    const map = { 1: '🐶', 2: '🐱', 3: '🦊', 4: '🦁' };
    const div = document.getElementById('preview-avatar-initials');
    div.textContent = map[id];
    div.style.display = 'flex';
    document.getElementById('preview-avatar-img').classList.add('hidden');
}

async function saveProfile() {
    const btn = document.getElementById('save-profile-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('bio', document.getElementById('profile-bio').value);

    if (selectedFile) {
        formData.append('avatar', selectedFile);
        formData.append('avatarType', 'upload');
    } else if (selectedDefaultId) {
        formData.append('defaultAvatarId', selectedDefaultId);
        formData.append('avatarType', 'default');
    }

    try {
        const data = await client.upload('/api/user/profile', formData, 'PATCH');
        ui.showToast("Profile updated successfully!", "success");
        window.currentUserData = data.user;
        updateProfileUI(data.user);
        closeProfileModal();
    } catch (err) {
        ui.showToast(err.message || "Update failed", "error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
