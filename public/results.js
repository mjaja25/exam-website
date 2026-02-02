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

    let mcqReviewData = []; // Global to store MCQ details
    let currentMcqIdx = 0;

    function displayResults(data) {
        // 1. Identify the Pattern
        const isNewPattern = data.testPattern === 'new_pattern';
        
        // 2. Tally Results (Using stored totalScore)
        const finalTotal = Math.round(data.totalScore || 0);
        document.getElementById('total-score-display').innerText = `${finalTotal} / 50`;

        // 3. Conditional Overall Score Card
        const scoreBreakdown = document.getElementById('score-breakdown');
        if (isNewPattern) {
            scoreBreakdown.innerHTML = `
                <div class="score-card delectable-typing"><h3>Typing</h3><p>${Math.round(data.typingScore)}/30</p></div>
                <div class="score-card delectable-mcq"><h3>Excel MCQ</h3><p>${Math.round(data.mcqScore)}/20</p></div>
            `;
        } else {
            scoreBreakdown.innerHTML = `
                <div class="score-card delectable-typing"><h3>Typing</h3><p>${Math.round(data.typingScore)}/30</p></div>
                <div class="score-card delectable-letter"><h3>Letter</h3><p>${Math.round(data.letterScore)}/10</p></div>
                <div class="score-card delectable-excel"><h3>Excel Practical</h3><p>${Math.round(data.excelScore)}/10</p></div>
            `;
        }

        // 4. Chart Optimization
        renderChart(data, isNewPattern);

        // 5. Detailed Report Sections
        const container = document.getElementById('detailed-report-content');
        container.innerHTML = ''; // Clear

        // Always show Typing
        addReportSection(container, 'Typing Analysis', formatTypingFeedback(data.typingFeedback));

        if (isNewPattern) {
            // Show MCQ Navigator
            mcqReviewData = data.mcqReviewData || [];
            renderMcqReviewSection(container);
        } else {
            // Show Letter & Excel Practical
            addReportSection(container, 'Letter Evaluation', formatLetterFeedback(data.letterFeedback));
            addReportSection(container, 'Excel Practical Evaluation', formatExcelFeedback(data.excelFeedback));
        }
    }

    function renderChart(data, isNewPattern) {
        const ctx = document.getElementById('scoreChart').getContext('2d');
        const labels = isNewPattern ? ['Typing', 'Excel MCQ'] : ['Typing', 'Letter', 'Excel'];
        const scores = isNewPattern ? [data.typingScore, data.mcqScore] : [data.typingScore, data.letterScore, data.excelScore];

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: scores,
                    backgroundColor: ['#fbbf24', '#3b82f6', '#10b981'],
                    borderRadius: 6
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 30 } }
            }
        });
    }

    // --- MCQ REVIEW NAVIGATOR ---

    function renderMcqReviewSection(container) {
        const section = document.createElement('div');
        section.className = 'report-card mcq-review-wrapper';
        section.innerHTML = `
            <div class="section-header">
                <h2>Excel MCQ Detailed Review</h2>
            </div>
            <div id="mcq-viewer-area"></div>
            <div class="mcq-nav-controls">
                <button class="nav-btn prev" onclick="moveMcq(-1)">Previous</button>
                <span id="mcq-counter">Question 1 of 10</span>
                <button class="nav-btn next" onclick="moveMcq(1)">Next</button>
            </div>
        `;
        container.appendChild(section);
        updateMcqDisplay();
    }

    function updateMcqDisplay() {
        const viewer = document.getElementById('mcq-viewer-area');
        const counter = document.getElementById('mcq-counter');
        if (!mcqReviewData.length) {
            viewer.innerHTML = "<p>No MCQ review data available.</p>";
            return;
        }

        const q = mcqReviewData[currentMcqIdx];
        const isCorrect = q.userAnswer === q.correctAnswer;

        viewer.innerHTML = `
            <div class="mcq-item-review animate-fade">
                <div class="status-badge ${isCorrect ? 'correct' : 'wrong'}">
                    ${isCorrect ? 'CORRECT' : 'INCORRECT'}
                </div>
                <p class="review-q-text">${q.questionText}</p>
                <div class="review-options-grid">
                    ${q.options.map((opt, i) => {
                        let className = 'review-opt';
                        if (i === q.correctAnswer) className += ' correct-answer';
                        if (i === q.userAnswer && !isCorrect) className += ' wrong-selection';
                        return `<div class="${className}"><span>${String.fromCharCode(65 + i)}</span> ${opt}</div>`;
                    }).join('')}
                </div>
                ${q.explanation ? `<div class="explanation-box"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
            </div>
        `;

        counter.innerText = `Question ${currentMcqIdx + 1} of ${mcqReviewData.length}`;
        
        // Disable buttons at boundaries
        document.querySelector('.nav-btn.prev').disabled = currentIdx === 0;
        document.querySelector('.nav-btn.next').disabled = currentIdx === mcqReviewData.length - 1;
    }

    window.moveMcq = (direction) => {
        currentMcqIdx += direction;
        updateMcqDisplay();
    };

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