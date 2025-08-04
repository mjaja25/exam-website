document.addEventListener('DOMContentLoaded', () => {
    const resultsBody = document.getElementById('results-tbody');
    const logoutBtn = document.getElementById('logout-btn');
    const token = localStorage.getItem('token');

    // --- Logout Functionality ---
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // --- Fetch and Display User's Past Results ---
    async function fetchUserResults() {
        try {
            const response = await fetch('http://localhost:3000/api/user/dashboard', {
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

            // Customize display based on test type
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
                    // The file path needs the server's base URL
                    submissionLink = `<a href="http://localhost:3000/${result.filePath}" target="_blank" download>Download</a>`;
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