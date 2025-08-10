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

    // Grab the new score value element
    const scoreValueElement = document.getElementById('score-value');

    // ... (your existing logic to calculate totalScore) ...
    const totalScore = typingResult.score + letterResult.score + excelResult.score;

    // --- NEW: Update the Score Circle ---
    scoreValueElement.textContent = totalScore;
    const scorePercentage = (totalScore / 50) * 100;
    const scoreDegrees = (scorePercentage / 100) * 360;

    // Apply the calculated degrees to the conic-gradient
    totalScoreCircle.style.background = `conic-gradient(
        var(--primary-yellow) ${scoreDegrees}deg,
        var(--border-color, #eee) ${scoreDegrees}deg
    )`;
    // --- End of new logic ---

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

    function formatExcelFeedback(feedback) {
        // Splits the feedback string by "Instruction X:" and filters out empty parts
        const points = feedback.split(/Instruction \d:/).filter(p => p.trim() !== '');

        if (points.length > 1) {
            let formattedHtml = '<ul>';
            points.forEach((point, index) => {
                // Re-add the instruction number and format as a list item
                formattedHtml += `<li><strong>Instruction ${index + 1}:</strong>${point.trim()}</li>`;
            });
            formattedHtml += '</ul>';
            return formattedHtml;
        }
        
        // If the feedback isn't in the expected format, return it as a simple paragraph
        return `<p>${feedback}</p>`;
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

        // --- NEW RADAR CHART LOGIC ---
        const chartCanvas = document.getElementById('skills-chart-canvas');
        new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: ['Typing Speed', 'Letter Writing', 'Excel Skills'],
                datasets: [{
                    label: 'Your Score',
                    // We normalize the scores to be out of 100 for the chart
                    data: [
                        (typingResult.score / 20) * 100, 
                        (letterResult.score / 10) * 100, 
                        (excelResult.score / 20) * 100
                    ],
                    fill: true,
                    backgroundColor: 'rgba(214, 168, 150, 0.2)',
                    borderColor: 'rgba(207, 140, 76, 1)',
                    pointBackgroundColor: 'rgba(255, 178, 63, 1)',
                    pointBorderColor: '#ceb172ff',
                    pointHoverBackgroundColor: '#ebb7b7ff',
                    pointHoverBorderColor: 'rgba(250, 229, 44, 1)'
                }]
            },
            options: {
                scales: {
                    r: {
                        angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
                        grid: { color: 'rgba(0, 0, 0, 0.1)' },
                        pointLabels: { font: { size: 14 } },
                        ticks: {
                            backdropColor: 'rgba(255, 255, 255, 0.75)',
                            stepSize: 20
                        },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hide the dataset label "Your Score"
                    }
                }
            }
        });
        // --- END OF RADAR CHART LOGIC ---

        // Update Skills Breakdown
        const skillsTextBreakdown = document.getElementById('skills-text-breakdown');
        skillsTextBreakdown.innerHTML = `
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