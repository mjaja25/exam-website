document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Configuration ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    const resultsDetails = document.getElementById('results-details');
    const totalScoreElement = document.getElementById('total-score');
    const progressCircle = document.getElementById('progress-circle');
    const percentileRankElement = document.getElementById('percentile-rank');

    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId');

    async function fetchSessionResults() {
        if (!sessionId) {
            resultsDetails.innerHTML = '<p>Could not find a valid session.</p>';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/results/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await response.json();
            if (!response.ok) throw new Error(results.message);

            displayResults(results);
            fetchPercentile(sessionId);

        } catch (error) {
            resultsDetails.innerHTML = `<p>Error loading results: ${error.message}</p>`;
        }
    }

    function displayResults(results) {
        resultsDetails.innerHTML = '';
        let totalScore = 0;

        const typingResult = results.find(r => r.testType === 'Typing') || { score: 0 };
        const letterResult = results.find(r => r.testType === 'Letter') || { score: 0 };
        const excelResult = results.find(r => r.testType === 'Excel') || { score: 0 };
        
        totalScore = typingResult.score + letterResult.score + excelResult.score;

        // Typing Card
        resultsDetails.innerHTML += `
            <div class="result-card">
                <h4>Typing Test: ${typingResult.score} / 20</h4>
                <p><strong>WPM:</strong> ${typingResult.wpm || 'N/A'}, <strong>Accuracy:</strong> ${typingResult.accuracy || 'N/A'}%</p>
            </div>`;
        
        // Letter Card
        resultsDetails.innerHTML += `
            <div class="result-card">
                <h4>Letter Test: ${letterResult.score} / 10</h4>
                <p><strong>Feedback:</strong> ${letterResult.feedback || 'N/A'}</p>
            </div>`;

        // Excel Card
        resultsDetails.innerHTML += `
            <div class="result-card">
                <h4>Excel Test: ${excelResult.score} / 20</h4>
                <p><strong>Feedback:</strong> ${excelResult.feedback || 'Submitted for review.'}</p>
            </div>`;
        
        // Update Total Score and Progress Circle
        totalScoreElement.textContent = totalScore;
        const percentage = (totalScore / 50) * 100;
        const degree = (percentage / 100) * 360;
        setTimeout(() => {
            progressCircle.style.background = `conic-gradient(var(--pico-primary) ${degree}deg, var(--pico-form-element-background-color) 0deg)`;
        }, 100);
        
        localStorage.removeItem('currentSessionId');
    }

    async function fetchPercentile(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/results/percentile/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                percentileRankElement.innerHTML = `You performed better than <strong>${data.percentile}%</strong> of other test-takers.`;
            } else {
                percentileRankElement.textContent = 'Could not calculate percentile.';
            }
        } catch (error) {
            percentileRankElement.textContent = 'Could not calculate percentile.';
        }
    }

    fetchSessionResults();
});