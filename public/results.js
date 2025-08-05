document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Configuration ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    const resultsContainer = document.getElementById('results-summary');
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId');

    async function fetchSessionResults() {
        if (!sessionId) {
            resultsContainer.innerHTML = '<p>Could not find a valid session. Please start a new test from your dashboard.</p>';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/results/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await response.json();

            if (response.ok) {
                displayResults(results);
            } else {
                throw new Error(results.message);
            }
        } catch (error) {
            resultsContainer.innerHTML = `<p>Error loading results: ${error.message}</p>`;
        }
    }

    function displayResults(results) {
        resultsContainer.innerHTML = ''; // Clear the loading message

        // Find each test result from the array
        const typingResult = results.find(r => r.testType === 'Typing');
        const letterResult = results.find(r => r.testType === 'Letter');
        const excelResult = results.find(r => r.testType === 'Excel');

        // Display Typing Test Results
        if (typingResult) {
            const typingDiv = document.createElement('div');
            typingDiv.innerHTML = `
                <h4>Typing Test</h4>
                <p><strong>WPM:</strong> ${typingResult.wpm}</p>
                <p><strong>Accuracy:</strong> ${typingResult.accuracy}%</p>
                <hr>
            `;
            resultsContainer.appendChild(typingDiv);
        }

        // Display Letter Test Results
        if (letterResult) {
            const letterDiv = document.createElement('div');
            letterDiv.innerHTML = `
                <h4>Letter Test</h4>
                <p><strong>Score:</strong> ${letterResult.score}/10</p>
                <p><strong>Feedback:</strong> ${letterResult.feedback}</p>
                <hr>
            `;
            resultsContainer.appendChild(letterDiv);
        }

        // Display Excel Test Results
        if (excelResult) {
            const excelDiv = document.createElement('div');
            excelDiv.innerHTML = `
                <h4>Excel Test</h4>
                <p>Your file has been submitted for review.</p>
            `;
            resultsContainer.appendChild(excelDiv);
        }
        
        // Clear the session ID so the user can start a fresh test
        localStorage.removeItem('currentSessionId');
    }

    fetchSessionResults();
});