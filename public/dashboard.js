document.addEventListener('DOMContentLoaded', () => {
    const resultsBody = document.getElementById('results-tbody');
    const logoutBtn = document.getElementById('logout-btn');
    const token = localStorage.getItem('token');

    // --- Dynamic URL Configuration ---
    // This block automatically detects if you are on localhost or a deployed server.
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    // --- End of Configuration ---

    const startTestBtn = document.getElementById('start-test-btn');

    startTestBtn.addEventListener('click', () => {
        if (confirm("You are about to start a 3-stage test. Each stage will have a 5-minute timer. Are you ready?")) {
            
            // Create a unique ID for this specific test session
            const sessionId = 'session_' + Date.now();
            localStorage.setItem('currentSessionId', sessionId);

            // Redirect to the first test
            window.location.href = '/typing.html';
        }
    });
        // --- Logout Functionality ---
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // --- Fetch and Display User's Past Results ---
    async function fetchUserResults() {
        try {
            // Use the dynamic URL to make the API call
            const response = await fetch(`${API_BASE_URL}/api/user/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                displayResults(data.results);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            resultsBody.innerHTML = `<tr><td colspan="4">Error loading results. Please log in again.</td></tr>`;
        }
    }

    // --- Render the Results in the Table ---
    function displayResults(results) {
        if (results.length === 0) {
            resultsBody.innerHTML = `<tr><td colspan="4">You have no submissions yet.</td></tr>`;
            return;
        }

        resultsBody.innerHTML = ''; // Clear existing rows

        results.forEach(result => {
            const row = document.createElement('tr');
            const submittedDate = new Date(result.submittedAt).toLocaleString();
            let details = '';
            let submissionLink = '';

            switch (result.testType) {
                case 'Typing':
                    details = `WPM: ${result.wpm}, Accuracy: ${result.accuracy}%`;
                    submissionLink = 'N/A';
                    break;
                case 'Letter':
                    details = `Score: ${result.score}/10`;
                    submissionLink = `<button onclick="alert('${result.feedback.replace(/'/g, "\\'")}')">View Feedback</button>`;
                    break;
                case 'Excel':
                    details = 'File Submitted';
                    // Use the dynamic URL for the download link
                    submissionLink = `<a href="${API_BASE_URL}/${result.filePath}" target="_blank" download>Download</a>`;
                    break;
            }

            row.innerHTML = `
                <td>${result.testType}</td>
                <td>${details}</td>
                <td>${submittedDate}</td>
                <td>${submissionLink}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    fetchUserResults();
});