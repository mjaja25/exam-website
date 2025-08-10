document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const resultsDetails = document.getElementById('results-details');
    const resultsHeader = document.getElementById('results-header');
    const chartCanvas = document.getElementById('skills-chart');
    const shareBtn = document.getElementById('share-btn');
    const totalScoreElement = document.getElementById('total-score');
    const progressCircle = document.getElementById('progress-circle');
    const percentileRankElement = document.getElementById('percentile-rank');
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
            resultsDetails.innerHTML = `<p>Error loading results: ${error.message}</p>`;
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
        resultsDetails.innerHTML = '';
        const typingResult = results.find(r => r.testType === 'Typing') || { score: 0, wpm: 0, accuracy: 0 };
        const letterResult = results.find(r => r.testType === 'Letter') || { score: 0, feedback: 'N/A' };
        const excelResult = results.find(r => r.testType === 'Excel') || { score: 0, feedback: 'N/A' };
        
        const totalScore = typingResult.score + letterResult.score + excelResult.score;

        // 1. Update Dynamic Header
        const headerTitle = resultsHeader.querySelector('h2');
        if (totalScore >= 40) {
            headerTitle.textContent = 'Excellent Performance!';
            headerTitle.style.color = '#4ade80';
        } else if (totalScore >= 25) {
            headerTitle.textContent = 'Great Effort!';
            headerTitle.style.color = '#f59e0b';
        } else {
            headerTitle.textContent = 'Keep Practicing!';
            headerTitle.style.color = '#f87171';
        }

        // 2. Create Readable Skills Chart
        new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: ['Speed (Typing)', 'Comprehension (Letter)', 'Technical (Excel)'],
                datasets: [{
                    label: 'Your Skills',
                    data: [typingResult.score, letterResult.score * 2, excelResult.score],
                    fill: true,
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    pointBackgroundColor: 'rgba(245, 158, 11, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(245, 158, 11, 1)'
                }]
            },
            options: {
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        pointLabels: { font: { size: 14 }, color: 'var(--text-color)' },
                        ticks: {
                            color: 'var(--text-muted)',
                            backdropColor: 'var(--card-background)',
                            stepSize: 5 // Increase gap between numbers
                        },
                        suggestedMin: 0,
                        suggestedMax: 20
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
        
        // 3. Display Detailed Breakdown
        resultsDetails.innerHTML = `
            <div class="result-detail-card">
                <h4>Typing Test: ${typingResult.score} / 20</h4>
                <p>WPM: ${typingResult.wpm}, Accuracy: ${typingResult.accuracy}%</p>
            </div>
            <div class="result-detail-card">
                <h4>Letter Test: ${letterResult.score} / 10</h4>
                <p><strong>Feedback:</strong> ${letterResult.feedback}</p>
            </div>
            <div class="result-detail-card">
                <h4>Excel Test: ${excelResult.score} / 20</h4>
                <div><strong>Feedback:</strong> ${formatExcelFeedback(excelResult.feedback)}</div>
            </div>
        `;

        // 4. Update Total Score and Progress Circle
        totalScoreElement.textContent = totalScore;
        const degree = (totalScore / 50) * 360;
        setTimeout(() => {
            progressCircle.style.background = `conic-gradient(var(--primary-yellow) ${degree}deg, var(--border-color) 0deg)`;
        }, 100);
        
        // 5. Setup Share Button for LinkedIn
        shareBtn.addEventListener('click', () => {
            const shareText = `I scored ${totalScore}/50 on the NSSB Computer Proficiency Test!`;
            const appUrl = window.location.origin;
            // Facebook's sharer URL
            const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appUrl)}&quote=${encodeURIComponent(shareText)}`;
            window.open(shareUrl, '_blank');
        });

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