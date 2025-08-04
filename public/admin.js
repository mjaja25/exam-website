document.addEventListener('DOMContentLoaded', () => {
    const resultsBody = document.getElementById('results-tbody');
    const token = localStorage.getItem('token');

    async function fetchResults() {
        try {
            const response = await fetch('/api/admin/results', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch results.');
            }

            const results = await response.json();
            displayResults(results);

        } catch (error) {
            console.error('Error:', error);
            resultsBody.innerHTML = `<tr><td colspan="5">Error loading results.</td></tr>`;
        }
    }

    function displayResults(results) {
        if (results.length === 0) {
            resultsBody.innerHTML = `<tr><td colspan="5">No submissions yet.</td></tr>`;
            return;
        }

        resultsBody.innerHTML = ''; // Clear existing rows

        results.forEach(result => {
            const row = document.createElement('tr');
            
            const user = result.user ? result.user.username : 'Unknown';
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
                    submissionLink = `<a href="http://localhost:3000/${result.filePath}" target="_blank" download>Download</a>`;
                    break;
            }

            row.innerHTML = `
                <td>${user}</td>
                <td>${result.testType}</td>
                <td>${details}</td>
                <td>${submittedDate}</td>
                <td>${submissionLink}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    fetchResults();
});