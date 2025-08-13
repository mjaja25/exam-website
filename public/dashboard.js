document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Config ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    
    // --- Element Grabbing ---
    const welcomeHeader = document.getElementById('welcome-header');
    const logoutBtn = document.getElementById('logout-btn');
    const adminBtn = document.getElementById('admin-btn');
    const startTestBtn = document.getElementById('start-test-btn');
    const resultsSummary = document.getElementById('results-summary');
    const token = localStorage.getItem('token');
    const instructionsModal = document.getElementById('instructions-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const proceedBtn = document.getElementById('proceed-btn');

    const mobileWarning = document.getElementById('mobile-warning');

    // --- Mobile Warning Logic ---
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        mobileWarning.style.display = 'block'; // Show the banner
        document.body.classList.add('mobile-warning-active'); // Add the class to the body to apply the top margin
    }




    // --- Modal Logic ---
    startTestBtn.addEventListener('click', () => {
        instructionsModal.style.display = 'flex';
        document.body.classList.add('modal-open');
    });

    closeModalBtn.addEventListener('click', () => {
        instructionsModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });

    // --- Proceed Button Logic ---
    proceedBtn.addEventListener('click', () => {
        const sessionId = 'session_' + Date.now();
        localStorage.setItem('currentSessionId', sessionId);
        window.location.href = '/typing.html';
    });




    // --- Event Listeners ---
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });
    
    // startTestBtn.addEventListener('click', () => {
    //     if (confirm("You are about to start a 3-stage test. Are you ready?")) {
    //         const sessionId = 'session_' + Date.now();
    //         localStorage.setItem('currentSessionId', sessionId);
    //         window.location.href = '/typing.html';
    //     }
    // });

    // --- Main Fetch Function ---
    async function fetchDashboardData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.message);
            
            // 1. Update Welcome Message
            if (data.user) {
                welcomeHeader.textContent = `Welcome, ${data.user.username}!`;
                // 2. Check for Admin Role and show button
                if (data.user.role === 'admin') {
                    adminBtn.style.display = 'inline-block';
                }
            }
            
            // 3. Display Simplified Past Results
            displaySimpleResults(data.results);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }
    
    function displaySimpleResults(results) {
        // Group results by sessionId
        const sessions = results.reduce((acc, result) => {
            acc[result.sessionId] = acc[result.sessionId] || [];
            acc[result.sessionId].push(result);
            return acc;
        }, {});

        if (Object.keys(sessions).length === 0) {
            resultsSummary.innerHTML = '<p>You have no past results.</p>';
            return;
        }

        resultsSummary.innerHTML = ''; // Clear loading message

        for (const sessionId in sessions) {
            if (!sessionId || sessionId === 'null') continue; // Skip any invalid sessions

            const sessionResults = sessions[sessionId];
            const totalScore = sessionResults.reduce((sum, r) => sum + (r.score || 0), 0);
            const sessionDate = new Date(sessionResults[0].submittedAt).toLocaleString();

            const tableRow = document.createElement('tr');
            tableRow.innerHTML = `
                <td>${sessionDate}</td>
                <td><strong>${totalScore} / 50</strong></td>
                <td><button class="view-results-btn" data-session-id="${sessionId}">View Results</button></td>
            `;
            resultsSummary.appendChild(tableRow);
        }
    }

    // Add this new event listener to handle all "View Results" button clicks
    resultsSummary.addEventListener('click', (event) => {
        if (event.target.classList.contains('view-results-btn')) {
            const sessionId = event.target.dataset.sessionId;
            localStorage.setItem('currentSessionId', sessionId);
            window.location.href = '/results.html';
        }
    });

    fetchDashboardData();
});