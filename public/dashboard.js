document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Config ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    // --- Element Grabbing ---
    const welcomeHeader = document.getElementById('welcome-header');
    const logoutBtn = document.getElementById('logout-btn');
    const adminBtn = document.getElementById('admin-btn');
    const startTestBtn = document.getElementById('open-exam-modal-btn');
    const resultsSummary = document.getElementById('results-summary');
    const token = localStorage.getItem('token');

    // Modals
    const patternModal = document.getElementById('pattern-modal');

    // --- 1. Mobile Warning Logic ---
    const mobileWarning = document.getElementById('mobile-warning');
    const isPhone = window.matchMedia('(max-width: 600px)').matches;

    if (isPhone && mobileWarning) {
        mobileWarning.style.display = 'block';
        document.body.classList.add('mobile-warning-active');
    }

    let currentCategoryIndex = 0;
    const categories = [
        { key: 'std_overall', label: 'Standard Test Champions' },
        { key: 'std_typing', label: 'Typing Speed Kings - 5 Mins' },
        { key: 'std_letter', label: 'Top 3 Letters' },
        { key: 'std_excel', label: 'MS Excel Masters' },
        { key: 'new_overall', label: 'New Pattern (10+5) Leaders' },
        { key: 'new_typing', label: 'Typing Speed Kings - 10 Mins' },
        { key: 'new_mcq', label: 'Excel MCQ Experts' }
    ];

    async function startLeaderboardCarousel() {
        try {
            const res = await fetch('/api/leaderboard/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            const updateSlide = () => {
                const cat = categories[currentCategoryIndex];
                const winners = data[cat.key] ? data[cat.key].slice(0, 3) : [];
                const podium = document.getElementById('carousel-winners');

                if (document.getElementById('carousel-title')) {
                    document.getElementById('carousel-title').innerText = cat.label;
                }

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
                currentCategoryIndex = (currentCategoryIndex + 1) % categories.length;
            };

            updateSlide();
            setInterval(updateSlide, 6000);
        } catch (err) {
            console.error("Leaderboard error:", err);
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
                welcomeHeader.textContent = `Welcome, ${data.user.username}!`;
                if (data.user.role === 'admin') adminBtn.style.display = 'inline-block';
            }

            displaySimpleResults(data.results);
            startLeaderboardCarousel();
        } catch (error) {
            console.error('Error loading dashboard:', error);
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

    fetchDashboardData();
});