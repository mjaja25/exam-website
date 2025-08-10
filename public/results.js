document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    
    const resultsTitle = document.getElementById('results-title');
    const totalScoreCircle = document.getElementById('total-score-circle');
    const percentileRankElement = document.getElementById('percentile-rank');
    const skillsBreakdown = document.getElementById('skills-breakdown');
    
    const typingResultsDiv = document.getElementById('typing-results');
    const letterResultsDiv = document.getElementById('letter-results');
    const excelResultsDiv = document.getElementById('excel-results');

    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId');

    // --- Main Fetch Function ---
    async function fetchSessionResults() {
        if (!sessionId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/results/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await response.json();
            if (!response.ok) throw new Error(results.message);
            
            displayResults(results);
            fetchPercentile(sessionId);

        } catch (error) {
            console.error("Error fetching results:", error);
        }
    }

    function displayResults(results) {
        const typingResult = results.find(r => r.testType === 'Typing') || { score: 0, wpm: 0, accuracy: 0 };
        const letterResult = results.find(r => r.testType === 'Letter') || { score: 0, feedback: 'N/A' };
        const excelResult = results.find(r => r.testType === 'Excel') || { score: 0, feedback: 'N/A' };
        
        const totalScore = typingResult.score + letterResult.score + excelResult.score;

        // Update Header Title based on score
        if (totalScore >= 40) resultsTitle.textContent = 'Excellent Performance!';
        else if (totalScore >= 25) resultsTitle.textContent = 'Great Effort!';
        else resultsTitle.textContent = 'Keep Practicing!';
        
        // Update Total Score Circle
        totalScoreCircle.textContent = `${totalScore} / 50`;

        // Update Skills Breakdown
        skillsBreakdown.innerHTML = `
            <p>⌨ Typing: <strong>${typingResult.score} / 20</strong></p>
            <p>✉ Letter: <strong>${letterResult.score} / 10</strong></p>
            <p>📊 Excel: <strong>${excelResult.score} / 20</strong></p>
        `;

        // Populate Detailed Cards
        typingResultsDiv.innerHTML = `
            <h3>⌨ Typing Test <span class="score">${typingResult.score} / 20</span></h3>
            <div class="feedback">WPM: <strong>${typingResult.wpm}</strong>, Accuracy: <strong>${typingResult.accuracy}%</strong></div>
        `;
        letterResultsDiv.innerHTML = `
            <h3>✉ Letter Test <span class="score">${letterResult.score} / 10</span></h3>
            <div class="feedback">${letterResult.feedback}</div>
        `;
        excelResultsDiv.innerHTML = `
            <h3>📊 Excel Test <span class="score">${excelResult.score} / 20</span></h3>
            <div class="feedback">${excelResult.feedback}</div>
        `;

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