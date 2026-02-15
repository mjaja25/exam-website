const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('token');
const welcomeHeader = document.getElementById('welcome-header');
const adminBtn = document.getElementById('admin-btn');
const logoutBtn = document.getElementById('logout-btn');
const resultsSummary = document.getElementById('results-summary');
const startTestBtn = document.getElementById('open-exam-modal-btn');
const patternModal = document.getElementById('pattern-modal');
const isPhone = window.innerWidth <= 768;
const mobileWarning = document.getElementById('mobile-warning');

if (isPhone && mobileWarning) {
    mobileWarning.style.display = 'block';
    document.body.classList.add('mobile-warning-active');
}

// --- Carousel Logic ---
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

// Default to Standard
activeCategories = stdCategories;

window.toggleLeaderboard = (type) => {
    // Update Buttons
    document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('active'));
    const btnSelector = type === 'standard' ? 'S' : 'N';
    const activeBtn = Array.from(document.querySelectorAll('.icon-btn')).find(b => b.innerText.includes(btnSelector));
    if (activeBtn) activeBtn.classList.add('active');

    // Update Data Source
    if (type === 'standard') {
        activeCategories = stdCategories;
    } else {
        activeCategories = newCategories;
    }

    // Reset and Update
    currentCategoryIndex = 0;
    updateCarouselSlide();

    // Reset Interval to avoid immediate jump
    clearInterval(carouselInterval);
    carouselInterval = setInterval(updateCarouselSlide, 6000);
};

function updateCarouselSlide() {
    if (!leaderboardData) return;

    const cat = activeCategories[currentCategoryIndex];
    const winners = leaderboardData[cat.key] ? leaderboardData[cat.key].slice(0, 3) : [];
    const podium = document.getElementById('carousel-winners');
    const title = document.getElementById('carousel-title');

    if (title) title.innerText = cat.label;

    if (podium) {
        podium.innerHTML = winners.map((w, i) => {
            let displayVal = 0;
            let unit = "Pts";

            if (cat.key.includes('typing')) {
                displayVal = w.wpm;
                unit = "WPM";
            } else if (cat.key.includes('mcq')) {
                displayVal = w.mcqScore;
                unit = "Pts";
            } else if (cat.key.includes('letter')) {
                displayVal = w.letterScore || 0;
            } else if (cat.key.includes('excel')) {
                displayVal = w.excelScore || 0;
            } else {
                displayVal = w.totalScore;
            }

            return `
                <div class="winner-entry rank-${i + 1}">
                    <span class="medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <span class="username">${w.user?.username || 'Anonymous'}</span>
                    <span class="score-val">${Math.round(displayVal)} <small>${unit}</small></span>
                </div>
            `;
        }).join('');
    }
    currentCategoryIndex = (currentCategoryIndex + 1) % activeCategories.length;
}

async function startLeaderboardCarousel() {
    try {
        const res = await fetch('/api/leaderboard/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        leaderboardData = await res.json();

        // Initialize with Standard active
        const startBtn = Array.from(document.querySelectorAll('.icon-btn')).find(b => b.innerText.includes('S'));
        if (startBtn) startBtn.classList.add('active');

        updateCarouselSlide();
        carouselInterval = setInterval(updateCarouselSlide, 6000);
    } catch (err) {
        console.error("Leaderboard error:", err);
        const podium = document.getElementById('carousel-winners');
        if (podium) podium.innerHTML = '<p style="text-align:center; color:#666;">Failed to load rankings.</p>';
    }
}

// --- 2. Navigation & Selection ---

window.openExamModal = () => {
    if (patternModal) patternModal.style.display = 'flex';
};

window.closeModal = () => {
    if (patternModal) patternModal.style.display = 'none';
};

window.handleExamSelection = (pattern) => {
    localStorage.removeItem('currentSessionId');
    localStorage.setItem('currentExamPattern', pattern);
    localStorage.setItem('currentAttemptMode', 'exam');
    localStorage.setItem('currentSessionId', 'sess_' + Date.now());
    window.location.href = '/typing.html';
};

window.startPractice = (type) => {
    localStorage.setItem('currentAttemptMode', 'practice');
    localStorage.setItem('currentExamPattern', 'none');
    const routes = {
        typing: '/practice-typing.html',
        mcq: '/practice-mcq.html',
        letter: '/practice-letter.html',
        excel: '/practice-excel.html'
    };
    window.location.href = routes[type] || '/dashboard.html';
};

// --- 3. View Logic (Fixed for both patterns) ---

window.viewResult = (sessionId, pattern) => {
    // Redirect based on the saved pattern in the DB record
    const page = (pattern === 'new_pattern') ? 'results-new.html' : 'results.html';
    window.location.href = `/${page}?sessionId=${sessionId}`;
};

// --- 4. Data Fetching & Display ---

let currentUserData = null;

async function fetchDashboardData() {
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/user/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        if (data.user) {
            currentUserData = data.user;
            welcomeHeader.textContent = `Welcome, ${data.user.username}!`;
            if (data.user.role === 'admin') adminBtn.style.display = 'inline-block';
            
            // Update Nav Profile
            updateNavProfile(data.user);
        }

        displaySimpleResults(data.results);
        startLeaderboardCarousel();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateNavProfile(user) {
    const navAvatar = document.getElementById('nav-avatar');
    const navInitials = document.getElementById('nav-initials');
    const initials = user.username.substring(0, 2).toUpperCase();

    if (user.avatar) {
        if (user.avatar.startsWith('default-')) {
            // Map default IDs to emojis
            const map = { '1': '🐶', '2': '🐱', '3': '🦊', '4': '🦁' };
            const id = user.avatar.split('-')[1];
            navInitials.textContent = map[id] || initials;
            navInitials.style.display = 'flex';
            navAvatar.style.display = 'none';
        } else {
            // Cloudinary URL
            navAvatar.src = user.avatar;
            navAvatar.style.display = 'block';
            navInitials.style.display = 'none';
        }
    } else {
        navInitials.textContent = initials;
        navInitials.style.display = 'flex';
        navAvatar.style.display = 'none';
    }
}

function displaySimpleResults(results) {
    if (!results || results.length === 0) {
        resultsSummary.innerHTML = '<tr><td colspan="4">You have no past results.</td></tr>';
        return;
    }

    resultsSummary.innerHTML = '';

    results.forEach(session => {
        const total = Math.round(session.totalScore || 0);
        const date = new Date(session.submittedAt).toLocaleDateString();
        const patternLabel = session.testPattern === 'new_pattern' ? '10+5' : 'Std';
        const maxScore = session.testPattern === 'new_pattern' ? 50 : 50;
        const sessionId = session.sessionId;
        const pattern = session.testPattern || 'standard';

        const tableRow = document.createElement('tr');
        tableRow.innerHTML = `
            <td>${date}</td>
            <td>${patternLabel}</td>
            <td><strong>${total} / ${maxScore}</strong></td>
            <td>
                <button class="view-results-btn" onclick="viewResult('${sessionId}', '${pattern}')">
                    View
                </button>
            </td>
        `;
        resultsSummary.appendChild(tableRow);
    });
}

// --- 5. Global Listeners ---

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });
}

if (startTestBtn) {
    startTestBtn.addEventListener('click', () => {
        window.openExamModal();
    });
}

window.onclick = function (event) {
    if (event.target == patternModal) window.closeModal();
};

// --- 6. Practice Stats Chart ---
async function fetchPracticeStats() {
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/practice/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        renderPracticeChart(data);
    } catch (err) {
        console.error("Error fetching practice stats:", err);
    }
}

function renderPracticeChart(data) {
    const ctx = document.getElementById('practice-chart');
    if (!ctx || !data || data.length === 0) {
        if (ctx) ctx.parentElement.innerHTML = '<p style="text-align:center;color:#666;margin-top:2rem;">No practice sessions recorded yet.</p>';
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
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Score Points' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Sessions Count' }
                }
            }
        }
    });
}

// --- 7. Profile Modal Logic ---
let selectedFile = null;
let selectedDefaultId = null;

window.openProfileModal = () => {
    const modal = document.getElementById('profile-modal');
    modal.style.display = 'flex';
    
    // Populate current values
    if (currentUserData) {
        document.getElementById('profile-bio').value = currentUserData.bio || '';
        
        // Show current avatar preview
        const prevImg = document.getElementById('preview-avatar-img');
        const prevInit = document.getElementById('preview-avatar-initials');
        
        if (currentUserData.avatar) {
            if (currentUserData.avatar.startsWith('default-')) {
                const map = { '1': '🐶', '2': '🐱', '3': '🦊', '4': '🦁' };
                const id = currentUserData.avatar.split('-')[1];
                prevInit.textContent = map[id];
                prevInit.style.display = 'flex';
                prevImg.style.display = 'none';
            } else {
                prevImg.src = currentUserData.avatar;
                prevImg.style.display = 'block';
                prevInit.style.display = 'none';
            }
        } else {
            prevInit.textContent = currentUserData.username.substring(0, 2).toUpperCase();
            prevInit.style.display = 'flex';
            prevImg.style.display = 'none';
        }
    }
};

window.closeProfileModal = () => {
    document.getElementById('profile-modal').style.display = 'none';
    selectedFile = null;
    selectedDefaultId = null;
};

window.handleFileSelect = (input) => {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        selectedDefaultId = null; // Clear default if file selected
        
        // Update preview
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('preview-avatar-img');
            img.src = e.target.result;
            img.style.display = 'block';
            document.getElementById('preview-avatar-initials').style.display = 'none';
        }
        reader.readAsDataURL(selectedFile);
    }
};

window.selectDefault = (id) => {
    selectedDefaultId = id;
    selectedFile = null; // Clear file if default selected
    
    const map = { 1: '🐶', 2: '🐱', 3: '🦊', 4: '🦁' };
    const div = document.getElementById('preview-avatar-initials');
    div.textContent = map[id];
    div.style.display = 'flex';
    document.getElementById('preview-avatar-img').style.display = 'none';
};

window.saveProfile = async () => {
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
        const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast("Profile updated successfully!", "success");
            currentUserData = data.user;
            updateNavProfile(data.user);
            closeProfileModal();
        } else {
            showToast(data.message || "Update failed", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Network error", "error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

fetchDashboardData();
fetchPracticeStats();