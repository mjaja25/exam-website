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

    // >>> FIX STARTS HERE <<<
    const urlParams = new URLSearchParams(window.location.search);
    // Priority 1: Get ID from URL (History View). Priority 2: Get from Storage (Fresh Finish)
    const sessionId = urlParams.get('sessionId') || localStorage.getItem('currentSessionId');
    // >>> FIX ENDS HERE <<<

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
            
            // Check if response is okay
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to fetch results");
            }

            const data = await response.json();
            
            // Process results as a single object
            await displayResults(data);
            
            // Call the restored percentile route
            fetchPercentile(sessionId);

        } catch (error) {
            console.error("Result Fetch Error:", error);
            if(detailsContainer) detailsContainer.innerHTML = `<p>Error loading results: ${error.message}</p>`;
        }
    }
    
    // ... rest of your file (displayResults, fetchPercentile, etc.) ...

    // Generate PDF
    async function generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text("Test Performance Report", 20, 20);
        doc.setFontSize(12);
        doc.text(`User ID: ${localStorage.getItem('userId')}`, 20, 40);
        doc.text(`Score: ${currentResult.score}/20`, 20, 50);
        doc.text(`Feedback: ${currentResult.feedback}`, 20, 60, { maxWidth: 170 });
        
        doc.save("performance_report.pdf");
    }

    // excel previewer


    async function renderExcelPreview(fileUrl) {
        try {
            // 1. Fetch the file from Cloudinary as a 'blob'
            const response = await fetch(fileUrl);
            const data = await response.arrayBuffer();

            // 2. Read the workbook using SheetJS (XLSX)
            const workbook = XLSX.read(data, { type: 'array' });

            // 3. Get the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // 4. Convert the sheet to HTML
            const htmlTable = XLSX.utils.sheet_to_html(worksheet, { id: 'preview-table', editable: false });

            // 5. Inject into your preview container
            const container = document.getElementById('excel-table-output');
            container.innerHTML = htmlTable;

            // Make the section visible
            document.getElementById('report-section').style.display = 'block';

        } catch (error) {
            console.error("Preview failed:", error);
            document.getElementById('excel-table-output').innerHTML = "<p>Preview unavailable for this file.</p>";
        }
    }

    function formatExcelFeedback(feedback) {
        if (!feedback || feedback === 'N/A') return '<p>No detailed feedback available.</p>';

        // Split and clean the lines
        const lines = feedback.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.toLowerCase().includes("here's a breakdown"));

        let html = '<div class="excel-feedback-list">';
        let displayIndex = 1;

        lines.forEach(line => {
            // 1. Convert **text** to <strong>text</strong> and remove the ** symbols
            let cleanContent = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // 2. Remove AI-generated leading numbers (e.g., "1. ", "1. 1.")
            cleanContent = cleanContent.replace(/^\d+\.\s*/, '').replace(/^\d+\.\s*/, '').trim();

            if (cleanContent) {
                html += `
                    <div class="feedback-item-styled">
                        <div class="feedback-number-bubble">${displayIndex}</div>
                        <div class="feedback-text-content">${cleanContent}</div>
                    </div>`;
                displayIndex++;
            }
        });

        return html + '</div>';
    }

    async function displayResults(data) {
        // Identify the Pattern from the single object
        const pattern = data.testPattern || 'standard';
        
        // Use direct field names from your TestResult model
        const typingScore = Math.round(data.typingScore || 0);
        const letterScore = Math.round(data.letterScore || 0);
        const excelScore  = Math.round(data.excelScore || 0);
        const totalScore  = Math.round(data.totalScore || (typingScore + letterScore + excelScore));

        // Update Overall Score Display
        if (scoreValueElement) scoreValueElement.textContent = totalScore;
        
        if (resultsTitle) {
            if (totalScore >= 40) { resultsTitle.textContent = 'Excellent Performance!'; resultsTitle.style.color = '#4ade80'; } 
            else if (totalScore >= 25) { resultsTitle.textContent = 'Great Effort!'; resultsTitle.style.color = '#f59e0b'; } 
            else { resultsTitle.textContent = 'Keep Practicing!'; resultsTitle.style.color = '#f87171'; }
        }
        
        if (totalScoreCircle) {
            const scoreDegrees = (totalScore / 50) * 360;
            totalScoreCircle.style.background = `conic-gradient(var(--primary-yellow) ${scoreDegrees}deg, var(--border-color, #eee) ${scoreDegrees}deg)`;
        }

        // CHART ------------
        try {
            // 1. Fetch Global Stats
            const statsRes = await fetch(`${API_BASE_URL}/api/stats/global`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const stats = await statsRes.json();

            // 2. Prepare Data (Standard Pattern: Typing, Letter, Excel)
            const labels = ['Typing', 'Letter', 'Excel'];
            
            // User's Scores
            const userScores = [
                data.typingScore || 0, 
                data.letterScore || 0, 
                data.excelScore || 0
            ];

            // Average Scores
            const avgScores = [
                Math.round(stats.avgTyping || 0), 
                Math.round(stats.avgLetter || 0), 
                Math.round(stats.avgExcel || 0)
            ];

            // Top Scores
            const topScores = [
                stats.maxTyping || 0, 
                stats.maxLetter || 0, 
                stats.maxExcel || 0
            ];

            // 3. Render Chart
            const chartCanvas = document.getElementById('skills-chart-canvas');
            if (chartCanvas) {
                new Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'You',
                                data: userScores,
                                backgroundColor: '#fbbf24', // Yellow
                                borderRadius: 4
                            },
                            {
                                label: 'Average',
                                data: avgScores,
                                backgroundColor: '#9ca3af', // Gray
                                borderRadius: 4,
                                hidden: true // Hidden by default to avoid clutter
                            },
                            {
                                label: 'Top Scorer',
                                data: topScores,
                                backgroundColor: '#10b981', // Green
                                borderRadius: 4
                            }
                        ]
                    },
                    options: { 
                        indexAxis: 'y', 
                        responsive: true,
                        scales: { x: { beginAtZero: true } } 
                    }
                });
            }
        } catch (err) {
            console.error("Chart Error:", err);
        }
        // --- DETAILED REPORT (Unified Logic) ---
        let detailsHtml = `
            <div class="test-block">
                <h3>⌨ Typing Test <span class="score">${typingScore} / ${pattern === 'new_pattern' ? 30 : 20}</span></h3>
                <div class="feedback">WPM: <strong>${data.wpm || 0}</strong>, Accuracy: <strong>${data.accuracy || 0}%</strong></div>
            </div>
        `;

        if (pattern === 'standard') {
            detailsHtml += `
                <div class="test-block">
                    <h3>✉ Letter Test <span class="score">${letterScore} / 10</span></h3>
                    <div class="feedback">${formatLetterFeedback(data.letterFeedback)}</div>
                </div>
                <div class="test-block">
                    <h3>📊 Excel Practical <span class="score">${excelScore} / 20</span></h3>
                    <div class="feedback">${formatExcelFeedback(data.excelFeedback)}</div>
                </div>
            `;
        } else {
            detailsHtml += `
                <div class="test-block">
                    <h3>📊 Excel MCQ Review</h3>
                    <p>Detailed MCQ analysis is available on the specialized review page.</p>
                </div>
            `;
        }

        if (detailsContainer) detailsContainer.innerHTML = detailsHtml;

        // Trigger Podium Comparison
        renderComparison(totalScore, pattern);

        triggerCelebration(totalScore);
    }

    

    function formatLetterFeedback(feedback) {
        if (!feedback || feedback === 'N/A') return '<p>No feedback available.</p>';

        // Split the feedback string by newlines
        const lines = feedback.split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        let html = '<div class="letter-feedback-list">';
        let displayIndex = 1;

        lines.forEach(line => {
            // 1. Convert **text** to <strong>text</strong> and strip the ** symbols
            let cleanContent = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // 2. Remove any leading numbers or dashes the AI might have added (e.g., "1. ", "- ")
            // to prevent double numbering with your golden bubbles.
            cleanContent = cleanContent.replace(/^[\d\.\s\-\>]+/, '').trim();

            // 3. Highlight the specific criteria (e.g., "Content: 3/3") by bolding the start
            if (cleanContent.includes(':')) {
                const parts = cleanContent.split(':');
                const criteria = parts[0];
                const rest = parts.slice(1).join(':');
                cleanContent = `<strong>${criteria}:</strong>${rest}`;
            }

            html += `
                <div class="feedback-item-styled">
                    <div class="feedback-number-bubble">${displayIndex}</div>
                    <div class="feedback-text-content">
                        ${cleanContent}
                    </div>
                </div>`;
            displayIndex++;
        });

        return html + '</div>';
    }

    async function triggerCelebration(score) {
        // 1. Pop confetti immediately on load
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }

        // 2. Check Leaderboard for Fireworks
        try {
            const res = await fetch('/api/leaderboard/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const lb = await res.json();
            const leaders = lb['std_overall'] || [];
            
            // Check if user's score matches any of the top scores
            const isTopScorer = leaders.some(l => Math.round(l.totalScore) === Math.round(score));

            if (isTopScorer && typeof confetti === 'function') {
                // Fireworks Effect
                let duration = 3000;
                let end = Date.now() + duration;
                (function frame() {
                    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
                    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
                    if (Date.now() < end) requestAnimationFrame(frame);
                }());
            }
        } catch (e) { console.error("Celebration Error:", e); }
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

    async function renderComparison(userScore, pattern) {
        const card = document.getElementById('comparison-card');
        const content = document.getElementById('comparison-content');
        const token = localStorage.getItem('token');

        try {
            const res = await fetch('/api/leaderboard/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            // Select the right category to compare against
            const categoryKey = pattern === 'new_pattern' ? 'new_overall' : 'std_overall';
            const topPerformers = data[categoryKey];
            
            if (!topPerformers || topPerformers.length === 0) return;

            const topScore = topPerformers[0].totalScore;
            const thirdScore = topPerformers[2]?.totalScore || topScore;
            const diffToFirst = topScore - userScore;
            const diffToPodium = thirdScore - userScore;

            let message = "";
            let subtext = "";

            if (userScore >= topScore) {
                message = "RANK #1 ACHIEVED!";
                subtext = "You've matched or beaten the current global leader. Your name is now being decorated in gold on the dashboard!";
            } else if (userScore >= thirdScore) {
                message = "YOU'RE ON THE PODIUM!";
                subtext = `Incredible work! You are currently in the Top 3. You only need ${diffToFirst.toFixed(1)} more marks to take the #1 spot.`;
            } else if (diffToPodium <= 5) {
                message = "SO CLOSE TO GLORY!";
                subtext = `You are less than 5 marks away from the Bronze medal. A little more practice in the MCQ zone will get you there!`;
            } else {
                message = "SOLID PROGRESS!";
                subtext = `You've completed the exam. Check the leaderboards to see how you rank against the ${topPerformers.length} toppers.`;
            }

            content.innerHTML = `
                <h4 class="comparison-msg">${message}</h4>
                <p class="comparison-subtext">${subtext}</p>
            `;
            card.classList.remove('hidden');

        } catch (err) {
            console.error("Comparison Error:", err);
        }
    }

    fetchSessionResults();
});