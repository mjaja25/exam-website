document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    
    const resultsTitle = document.getElementById('results-title');
    const totalScoreCircle = document.getElementById('total-score-circle');
    const scoreValueElement = document.getElementById('score-value');
    const percentileRankElement = document.getElementById('percentile-rank');
    const chartCanvas = document.getElementById('skills-chart-canvas');
    const legendContainer = document.getElementById('chart-legend');
    const detailsContainer = document.getElementById('test-details-container');
    
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId');

    // --- Main Fetch Function ---
    async function fetchSessionResults() {
        if (!sessionId) {
            if(detailsContainer) detailsContainer.innerHTML = "<p>Session ID not found. Please start a new test from your dashboard.</p>";
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/results/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await response.json();
            if (!response.ok) throw new Error(results.message);
            
            await displayResults(results);
            fetchPercentile(sessionId);

        } catch (error) {
            if(detailsContainer) detailsContainer.innerHTML = `<p>Error loading results: ${error.message}</p>`;
        }
    }

    function formatExcelFeedback(feedback) {
        const points = feedback.split(/Instruction \d:/).filter(p => p.trim() !== '');
        if (points.length > 1) {
            let formattedHtml = '<ul>';
            points.forEach((point, index) => {
                formattedHtml += `<li><strong>Instruction ${index + 1}:</strong>${point.trim()}</li>`;
            });
            return formattedHtml + '</ul>';
        }
        return `<p>${feedback}</p>`;
    }

    async function displayResults(results) {
        const typingResult = results.find(r => r.testType === 'Typing') || { score: 0, wpm: 0, accuracy: 0 };
        const letterResult = results.find(r => r.testType === 'Letter') || { score: 0, feedback: 'N/A' };
        const excelResult = results.find(r => r.testType === 'Excel') || { score: 0, feedback: 'N/A' };
        const totalScore = typingResult.score + letterResult.score + excelResult.score;

        if (totalScore >= 40) { resultsTitle.textContent = 'Excellent Performance!'; resultsTitle.style.color = '#4ade80'; } 
        else if (totalScore >= 25) { resultsTitle.textContent = 'Great Effort!'; resultsTitle.style.color = '#f59e0b'; } 
        else { resultsTitle.textContent = 'Keep Practicing!'; resultsTitle.style.color = '#f87171'; }
        
        scoreValueElement.textContent = totalScore;
        const scorePercentage = (totalScore / 50) * 100;
        const scoreDegrees = (scorePercentage / 100) * 360;
        totalScoreCircle.style.background = `conic-gradient(var(--primary-yellow) ${scoreDegrees}deg, var(--border-color, #eee) ${scoreDegrees}deg)`;

        // --- NEW: Fetch aggregate stats ---
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

        // --- NEW BAR CHART LOGIC ---
        const chartCanvas = document.getElementById('skills-chart-canvas');
        new Chart(chartCanvas, {
            type: 'bar', // The chart type is now 'bar'
            data: {
                labels: ['Typing', 'Letter', 'Excel'],
                datasets: [
                    {
                        label: 'Your Score',
                        data: [
                            (typingResult.score / 20) * 100,
                            (letterResult.score / 10) * 100,
                            (excelResult.score / 20) * 100
                        ],
                        backgroundColor: 'rgba(245, 158, 11, 0.7)', // Yellow
                        borderColor: 'rgba(245, 158, 11, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Average Score',
                        data: [avgTyping, avgLetter, avgExcel],
                        backgroundColor: 'rgba(239, 68, 68, 0.7)', // Red
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Top Score',
                        data: [topTyping, topLetter, topExcel],
                        backgroundColor: 'rgba(59, 130, 246, 0.7)', // Blue
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                indexAxis: 'y', // This makes the bar chart horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: 'var(--text-color)' }
                    }
                },
                scales: {
                    x: { // The horizontal axis is now the score
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: 'var(--text-muted)',
                            callback: (value) => value + '%' // Add percentage sign
                        }
                    },
                    y: { // The vertical axis is now the skill
                        ticks: { color: 'var(--text-color)' }
                    }
                }
            }
        });
        
        // legendContainer.innerHTML = '';
        // myChart.data.datasets.forEach((dataset) => {
        //     const legendItem = document.createElement('div');
        //     legendItem.className = 'legend-item';
        //     legendItem.innerHTML = `<div class="legend-color-box" style="background-color: ${dataset.borderColor}"></div><span>${dataset.label}</span>`;
        //     legendContainer.appendChild(legendItem);
        // });

        detailsContainer.innerHTML = `
            <div class="test-block">
                <h3>⌨ Typing Test <span class="score">${typingResult.score} / 20</span></h3>
                <div class="feedback">WPM: <strong>${typingResult.wpm}</strong>, Accuracy: <strong>${typingResult.accuracy}%</strong></div>
            </div>
            <div class="test-block">
                <h3>✉ Letter Test <span class="score">${letterResult.score} / 10</span></h3>
                <div class="feedback">${letterResult.feedback}</div>
            </div>
            <div class="test-block">
                <h3>📊 Excel Test <span class="score">${excelResult.score} / 20</span></h3>
                <div class="feedback">${formatExcelFeedback(excelResult.feedback)}</div>
            </div>
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