document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    
    const resultsTitle = document.getElementById('results-title');
    const totalScoreCircle = document.getElementById('total-score-circle');
    const scoreValueElement = document.getElementById('score-value');
    const percentileRankElement = document.getElementById('percentile-rank');
    const chartCanvas = document.getElementById('skills-chart-canvas');
    const skillsTextBreakdown = document.getElementById('skills-text-breakdown');
    const detailsContainer = document.getElementById('test-details-container');
    
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
            detailsContainer.innerHTML = `<p>Error loading results: ${error.message}</p>`;
        }
    }

    function formatExcelFeedback(feedback) {
        const points = feedback.split(/Instruction \d:/).filter(p => p.trim() !== '');
        if (points.length > 1) {
            let formattedHtml = '<ul>';
            points.forEach((point, index) => {
                formattedHtml += `<li><strong>Instruction ${index + 1}:</strong>${point.trim()}</li>`;
            });
            formattedHtml += '</ul>';
            return formattedHtml;
        }
        return `<p>${feedback}</p>`;
    }

    async function displayResults(results) {
        const typingResult = results.find(r => r.testType === 'Typing') || { score: 0, wpm: 0, accuracy: 0 };
        const letterResult = results.find(r => r.testType === 'Letter') || { score: 0, feedback: 'N/A' };
        const excelResult = results.find(r => r.testType === 'Excel') || { score: 0, feedback: 'N/A' };
        
        const totalScore = typingResult.score + letterResult.score + excelResult.score;

        // Update Header Title
        if (totalScore >= 40) resultsTitle.textContent = 'Excellent Performance!';
        else if (totalScore >= 25) resultsTitle.textContent = 'Great Effort!';
        else resultsTitle.textContent = 'Keep Practicing!';
        
        // Update Score Circle
        scoreValueElement.textContent = totalScore;
        const scorePercentage = (totalScore / 50) * 100;
        const scoreDegrees = (scorePercentage / 100) * 360;
        totalScoreCircle.style.background = `conic-gradient(var(--primary-yellow) ${scoreDegrees}deg, var(--border-color, #eee) ${scoreDegrees}deg)`;

        // --- NEW: Fetch the aggregate stats ---
        const statsResponse = await fetch(`${API_BASE_URL}/api/stats/all-tests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await statsResponse.json();

        const avgTyping = stats.Typing ? (stats.Typing.average / 20) * 100 : 0;
        const avgLetter = stats.Letter ? (stats.Letter.average / 10) * 100 : 0;
        const avgExcel = stats.Excel ? (stats.Excel.average / 20) * 100 : 0;

        const topTyping = stats.Typing ? (stats.Typing.top / 20) * 100 : 0;
        const topLetter = stats.Letter ? (stats.Letter.top / 10) * 100 : 0;
        const topExcel = stats.Excel ? (stats.Excel.top / 20) * 100 : 0;
        // --- End of new logic ---
        
        // Render Radar Chart
        const chartCanvas = document.getElementById('skills-chart-canvas');
        new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: ['Typing Speed', 'Letter Writing', 'Excel Skills'],
                datasets: [
                    {
                        label: 'Your Score',
                        data: [ (typingResult.score / 20) * 100, (letterResult.score / 10) * 100, (excelResult.score / 20) * 100 ],
                        fill: true,
                        backgroundColor: 'rgba(245, 158, 11, 0.2)', // Yellow fill
                        borderColor: 'rgba(245, 158, 11, 1)',      // Solid Yellow line
                        pointBackgroundColor: 'rgba(245, 158, 11, 1)'
                    },
                    {
                        label: 'Average Score',
                        data: [avgTyping, avgLetter, avgExcel],
                        borderColor: 'rgba(239, 68, 68, 1)',       // Red line
                        pointBackgroundColor: 'rgba(239, 68, 68, 1)'
                    },
                    {
                        label: 'Top Score',
                        data: [topTyping, topLetter, topExcel],
                        borderColor: 'rgba(59, 130, 246, 1)',      // Blue line
                        pointBackgroundColor: 'rgba(59, 130, 246, 1)'
                    }
                ]
            },
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--text-color)' // Make legend text readable in dark/light mode
                        }
                    }
                },
                scales: {
                    r: {
                         suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 25 } 
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Populate Skills Breakdown Text
        skillsTextBreakdown.innerHTML = `
            <p>⌨ <strong>${typingResult.score} / 20</strong></p>
            <p>✉ <strong>${letterResult.score} / 10</strong></p>
            <p>📊<strong>${excelResult.score} / 20</strong></p>
        `;

        // Populate Detailed Cards
        detailsContainer.innerHTML = `
            <div class="detail-row">
                <span class="label">⌨ Typing Test</span>
                <span class="score">${typingResult.score} / 20</span>
            </div>
            <div class="feedback">WPM: <strong>${typingResult.wpm}</strong>, Accuracy: <strong>${typingResult.accuracy}%</strong></div>
            <div class="detail-row">
                <span class="label">✉ Letter Test</span>
                <span class="score">${letterResult.score} / 10</span>
            </div>
            <div class="feedback">${letterResult.feedback}</div>
            <div class="detail-row">
                <span class="label">📊 Excel Test</span>
                <span class="score">${excelResult.score} / 20</span>
            </div>
            <div class="feedback">${formatExcelFeedback(excelResult.feedback)}</div>
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
                percentileRankElement.textContent = data.percentile + '%';
            } else {
                percentileRankElement.textContent = 'N/A';
            }
        } catch (error) {
            percentileRankElement.textContent = 'N/A';
        }
    }

    fetchSessionResults();
});