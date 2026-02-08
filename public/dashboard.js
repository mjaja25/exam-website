document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Config ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    
    // --- Element Grabbing ---
    const welcomeHeader = document.getElementById('welcome-header');
    const logoutBtn = document.getElementById('logout-btn');
    const adminBtn = document.getElementById('admin-btn');
    const startTestBtn = document.getElementById('open-exam-modal-btn'); // Standard button
    const resultsSummary = document.getElementById('results-summary');
    const token = localStorage.getItem('token');
    
    // Modals
    // const instructionsModal = document.getElementById('instructions-modal');
    const patternModal = document.getElementById('pattern-modal'); // New modal for pattern selection

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
        const res = await fetch('/api/leaderboard/all', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        const updateSlide = () => {
            const cat = categories[currentCategoryIndex];
            const winners = data[cat.key] ? data[cat.key].slice(0, 3) : []; // Get Top 3
            const podium = document.getElementById('carousel-winners');
            
            document.getElementById('carousel-title').innerText = cat.label;

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
                    displayVal = w.letterScore || 0; // Ensure this matches your DB field
                    unit = "Pts";
                } else if (cat.key.includes('excel')) {
                    displayVal = w.excelScore || 0; // Ensure this matches your DB field
                    unit = "Pts";
                } else {
                    // For overall slides
                    displayVal = w.totalScore;
                    unit = "Pts";
                }

                return `
                    <div class="winner-entry rank-${i+1}">
                        <span class="medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <span class="username">${w.user?.username || 'Anonymous'}</span>
                        <span class="score-val">${displayVal} <small>${unit}</small></span>
                    </div>
                `;
            }).join('');
            

            currentCategoryIndex = (currentCategoryIndex + 1) % categories.length;
        };

        updateSlide(); // Run first slide immediately
        setInterval(updateSlide, 6000); // Transition every 6 seconds
    }

    // Call this inside your fetchDashboardData or similar
    startLeaderboardCarousel();

    // --- 2. Navigation & Selection (Exposed to Window for HTML onclick) ---
    
    window.openExamModal = () => {
        if (patternModal) patternModal.style.display = 'flex';
    };

    window.closeModal = () => {
        if (patternModal) patternModal.style.display = 'none';
        if (instructionsModal) instructionsModal.style.display = 'none';
    };

    window.handleExamSelection = (pattern) => {
        // Clear old session data
        localStorage.removeItem('currentSessionId');
        
        // Set new session state
        localStorage.setItem('currentExamPattern', pattern);
        localStorage.setItem('currentAttemptMode', 'exam');
        localStorage.setItem('currentSessionId', 'sess_' + Date.now());
        
        // Close modal and send to typing (The start of both paths)
        window.location.href = '/typing.html';
    };

    window.startPractice = (type) => {
        localStorage.setItem('currentAttemptMode', 'practice');
        localStorage.setItem('currentExamPattern', 'none');
        
        if (type === 'typing') {
            window.location.href = '/typing.html'; 
        } else {
            window.location.href = '/practice-mcq.html';
        }
    };

    // --- 3. Event Listeners ---
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }

    // Handle clicking the "Start Test" button on the main dashboard card
    if (startTestBtn) {
        startTestBtn.addEventListener('click', () => {
            window.openExamModal(); // Instead of instructions, show pattern choice first
        });
    }

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
                if (data.user.role === 'admin') {
                    adminBtn.style.display = 'inline-block';
                }
            }
            
            displaySimpleResults(data.results);
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
            // Use the totalScore field directly from your database
            // We use Math.round to keep it an integer as you requested
            const total = Math.round(session.totalScore || 0);
            
            const date = new Date(session.submittedAt).toLocaleDateString();
            const patternLabel = session.testPattern === 'new_pattern' ? '10+5' : 'Std';
            const sessionId = session.sessionId;

            const tableRow = document.createElement('tr');
            tableRow.innerHTML = `
                <td>${date}</td>
                <td>${patternLabel}</td>
                <td><strong>${total} / 50</strong></td>
                <td>
                    <button class="view-results-btn" data-session-id="${sessionId}">
                        View
                    </button>
                </td>
            `;
            resultsSummary.appendChild(tableRow);
        });
    }

    // Handle "View Results" clicks
    window.viewResult = (sessionId, pattern) => {
        // Determine which result page to show
        const page = (pattern === 'new_pattern') ? 'results-new.html' : 'results.html';
        
        // Redirect with the sessionId attached as a query parameter
        window.location.href = `/${page}?sessionId=${sessionId}`;
    };

    // Close modals if clicking outside
    window.onclick = function(event) {
        if (event.target == patternModal || event.target == instructionsModal) {
            window.closeModal();
        }
    };

    console.assert(startTestBtn, 'Start Test button not found');
    console.assert(patternModal, 'Pattern modal not found');
    console.assert(resultsSummary, 'Results table body not found');

    fetchDashboardData();
});