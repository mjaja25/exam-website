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

        // Split by newlines and remove the initial "Here's a breakdown" intro line if it exists
        const lines = feedback.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.toLowerCase().includes("here's a breakdown"));

        let html = '<div class="excel-feedback-list">';
        let displayIndex = 1;

        lines.forEach(line => {
            // Clean up the AI's internal numbering (e.g., "1. ", "1. **Title**") 
            // to prevent double numbering like "1. 1. Total Revenue"
            const cleanContent = line.replace(/^\d+\.\s*/, '') // Removes "1. "
                                    .replace(/^\d+\.\s*/, '') // Removes a second layer if "1. 1. " exists
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .trim();

            if (cleanContent) {
                html += `
                    <div class="excel-feedback-item" style="display: flex; gap: 12px; margin-bottom: 12px;">
                        <div style="background: var(--primary-yellow); color: #fff; min-width: 24px; height: 24px; 
                            border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                            font-size: 12px; font-weight: bold; margin-top: 2px;">
                            ${displayIndex}
                        </div>
                        <div style="flex: 1; line-height: 1.6;">
                            ${cleanContent}
                        </div>
                    </div>`;
                displayIndex++;
            }
        });

        html += '</div>';
        return html;
    }

    async function displayResults(results) {
        // 1. Identify the Pattern (Unified doc will have this field)
        const pattern = results[0]?.testPattern || 'standard';
        
        // 2. Map Results (Assuming backend sends the legacy array format)
        const typingResult = results.find(r => r.testType === 'Typing') || { score: 0, wpm: 0, accuracy: 0 };
        const letterResult = results.find(r => r.testType === 'Letter') || { score: 0, feedback: 'N/A' };
        const excelResult = results.find(r => r.testType === 'Excel') || { score: 0, feedback: 'N/A' };
        
        // Calculate total
        const totalScore = Number(typingResult.score + letterResult.score + excelResult.score);

        // Update Title & Circle (Same as your logic)
        scoreValueElement.textContent = totalScore;
        if (totalScore >= 40) { resultsTitle.textContent = 'Excellent Performance!'; resultsTitle.style.color = '#4ade80'; } 
        else if (totalScore >= 25) { resultsTitle.textContent = 'Great Effort!'; resultsTitle.style.color = '#f59e0b'; } 
        else { resultsTitle.textContent = 'Keep Practicing!'; resultsTitle.style.color = '#f87171'; }
        
        const scoreDegrees = (totalScore / 50) * 360;
        totalScoreCircle.style.background = `conic-gradient(var(--primary-yellow) ${scoreDegrees}deg, var(--border-color, #eee) ${scoreDegrees}deg)`;

        // --- UPDATED CHART SCALING ---
        let typingMax = pattern === 'new_pattern' ? 30 : 20;
        let letterMax = pattern === 'new_pattern' ? 0 : 10;
        let excelMax = 20;

        const chartCanvas = document.getElementById('skills-chart-canvas');
        new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: pattern === 'new_pattern' ? ['Typing', 'Excel MCQ'] : ['Typing', 'Letter', 'Excel'],
                datasets: [
                    {
                        label: 'Your Score',
                        data: pattern === 'new_pattern' 
                            ? [(typingResult.score / 30) * 100, (excelResult.score / 20) * 100]
                            : [(typingResult.score / 20) * 100, (letterResult.score / 10) * 100, (excelResult.score / 20) * 100],
                        backgroundColor: 'rgba(245, 158, 11, 0.7)',
                        borderColor: 'rgba(245, 158, 11, 1)',
                        borderWidth: 1
                    }
                    // Add your average/top score datasets here using the same pattern logic
                ]
            },
            options: { 
                indexAxis: 'y', 
                responsive: true, 
                scales: { x: { max: 100, ticks: { callback: v => v + '%' } } } 
            }
        });

        // --- UPDATED DETAILED REPORT ---
        let detailsHtml = `
            <div class="test-block">
                <h3>⌨ Typing Test <span class="score">${typingResult.score} / ${typingMax}</span></h3>
                <div class="feedback">WPM: <strong>${typingResult.wpm}</strong>, Accuracy: <strong>${typingResult.accuracy}%</strong></div>
            </div>
        `;

        if (pattern === 'standard') {
            detailsHtml += `
                <div class="test-block">
                    <h3>✉ Letter Test <span class="score">${letterResult.score} / 10</span></h3>
                    <div class="feedback">${formatLetterFeedback(letterResult.feedback)}</div>
                </div>
            `;
        }

        detailsHtml += `
            <div class="test-block">
                <h3>${pattern === 'new_pattern' ? '📊 Excel MCQ' : '📊 Excel Practical'} <span class="score">${excelResult.score} / 20</span></h3>
                <div class="feedback">${formatExcelFeedback(excelResult.feedback)}</div>
            </div>
        `;

        detailsContainer.innerHTML = detailsHtml;

        // Trigger Ranking comparison
        renderComparison(totalScore, pattern);
    }

    function formatLetterFeedback(feedback) {
        if (!feedback) return '<p>No feedback available.</p>';

        const lines = feedback.split('\n').filter(Boolean);
        let html = '<div class="letter-feedback">';

        lines.forEach(line => {
            // Match: "Presentation: 0/2 – explanation..."
            const scoreMatch = line.match(/^(.+?:\s*\d+\/\d+)(.*)$/);

            if (scoreMatch) {
                const scorePart = scoreMatch[1].trim();
                const explanationPart = scoreMatch[2]?.trim();

                html += `<div class="feedback-score">
                            <strong>${scorePart}</strong>
                            ${explanationPart ? ` ${explanationPart}` : ''}
                        </div>`;
            }
            else if (line.toLowerCase().startsWith('remarks')) {
                html += `<hr><div class="feedback-remarks-title"><strong>Remarks</strong></div>`;
            }
            else {
                html += `<p class="feedback-remarks">${line}</p>`;
            }
        });

        html += '</div>';
        return html;
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