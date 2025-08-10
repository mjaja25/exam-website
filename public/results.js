document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const resultsDetails = document.getElementById('results-details');
    const resultsHeader = document.getElementById('results-header');
    const chartCanvas = document.getElementById('skills-chart');
    const shareBtn = document.getElementById('share-btn');
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

        } catch (error) {
            resultsDetails.innerHTML = `<p>Error loading results: ${error.message}</p>`;
        }
    }

    function displayResults(results) {
        resultsDetails.innerHTML = '';
        const typingResult = results.find(r => r.testType === 'Typing') || { score: 0, wpm: 0 };
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

        // 2. Create Skills Chart
        new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: ['Speed (Typing)', 'Comprehension (Letter)', 'Technical (Excel)'],
                datasets: [{
                    label: 'Your Skills',
                    data: [typingResult.score, letterResult.score * 2, excelResult.score], // Scale letter score to match others
                    fill: true,
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    borderColor: 'rgb(245, 158, 11)',
                    pointBackgroundColor: 'rgb(245, 158, 11)',
                }]
            },
            options: {
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        pointLabels: { font: { size: 14 }, color: '#e0e0e0' },
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
                <p>WPM: ${typingResult.wpm}, Accuracy: ${typingResult.accuracy || 'N/A'}%</p>
            </div>
            <div class="result-detail-card">
                <h4>Letter Test: ${letterResult.score} / 10</h4>
                <p>Feedback: ${letterResult.feedback}</p>
            </div>
            <div class="result-detail-card">
                <h4>Excel Test: ${excelResult.score} / 20</h4>
                <p>Feedback: ${excelResult.feedback}</p>
            </div>
        `;

        // 4. Setup Share Button
        shareBtn.addEventListener('click', () => {
            const shareText = `I just scored ${totalScore}/50 on the Proficiency Test! Check it out.`;
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${window.location.origin}`;
            window.open(shareUrl, '_blank');
        });

        localStorage.removeItem('currentSessionId');
    }

    fetchSessionResults();
});