import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const resultsTitle = document.getElementById('results-title');
    const totalScoreCircle = document.getElementById('total-score-circle');
    const scoreValueElement = document.getElementById('score-value');
    const percentileRankElement = document.getElementById('percentile-rank');
    const chartCanvas = document.getElementById('skills-chart-canvas');
    const legendContainer = document.getElementById('chart-legend');
    const detailsContainer = document.getElementById('test-details-container');
    const performanceBanner = document.getElementById('performance-banner');

    const token = auth.getToken();

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId') || localStorage.getItem('currentSessionId');

    // Button handlers
    const retryBtn = document.getElementById('retry-exam-btn');
    if (retryBtn) {
        retryBtn.onclick = () => {
            localStorage.setItem('autoOpenExamModal', 'true');
            window.location.href = '/dashboard.html';
        };
    }

    const practiceBtn = document.getElementById('practice-zone-btn');
    if (practiceBtn) {
        practiceBtn.onclick = () => {
            localStorage.setItem('scrollToPractice', 'true');
            window.location.href = '/dashboard.html#practice';
        };
    }

    async function fetchSessionResults() {
        if (!sessionId) {
            if (detailsContainer) detailsContainer.innerHTML = "<p>Session ID not found. Please start a new test from your dashboard.</p>";
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/results/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to fetch results");
            }

            const data = await response.json();
            await displayResults(data);
            fetchPercentile(sessionId);

        } catch (error) {
            console.error("Result Fetch Error:", error);
            if (detailsContainer) detailsContainer.innerHTML = `<p>Error loading results: ${error.message}</p>`;
        }
    }

    async function displayResults(data) {
        const pattern = data.testPattern || 'standard';

        const typingScore = Math.round(data.typingScore || 0);
        const letterScore = Math.round(data.letterScore || 0);
        const excelScore = Math.round(data.excelScore || 0);
        const totalScore = Math.round(data.totalScore || (typingScore + letterScore + excelScore));

        // Show performance banner
        showPerformanceBanner(totalScore, data);

        if (scoreValueElement) {
            const startTime = performance.now();
            const duration = 1200;
            const countUp = (now) => {
                const progress = Math.min((now - startTime) / duration, 1);
                scoreValueElement.textContent = Math.round(totalScore * progress);
                if (progress < 1) requestAnimationFrame(countUp);
            };
            requestAnimationFrame(countUp);
        }

        if (resultsTitle) {
            if (totalScore >= 40) { resultsTitle.textContent = 'Excellent Performance!'; resultsTitle.style.color = '#4ade80'; }
            else if (totalScore >= 25) { resultsTitle.textContent = 'Great Effort!'; resultsTitle.style.color = '#f59e0b'; }
            else { resultsTitle.textContent = 'Keep Practicing!'; resultsTitle.style.color = '#f87171'; }
        }

        if (totalScoreCircle) {
            const scoreDegrees = (totalScore / 50) * 360;
            totalScoreCircle.style.background = `conic-gradient(var(--primary) var(--progress, 0deg), var(--bg-input) var(--progress, 0deg))`;
            requestAnimationFrame(() => {
                totalScoreCircle.style.setProperty('--progress', scoreDegrees + 'deg');
            });
        }

        try {
            const statsRes = await fetch(`${API_BASE_URL}/api/stats/global`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const allStats = await statsRes.json();
            const stats = allStats.standard;

            const labels = ['Typing', 'Letter', 'Excel'];
            const userScores = [data.typingScore, data.letterScore, data.excelScore];
            const avgScores = [Math.round(stats.avgTyping), Math.round(stats.avgLetter), Math.round(stats.avgExcel)];
            const topScores = [stats.maxTyping, stats.maxLetter, stats.maxExcel];

            if (chartCanvas && window.Chart) {
                new window.Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            { label: 'You', data: userScores, backgroundColor: '#fbbf24', borderRadius: 4 },
                            { label: 'Avg', data: avgScores, backgroundColor: '#9ca3af', borderRadius: 4 },
                            { label: 'Top', data: topScores, backgroundColor: '#10b981', borderRadius: 4 }
                        ]
                    },
                    options: { indexAxis: 'y', scales: { x: { beginAtZero: true, max: 20 } } }
                });
            }
        } catch (err) { console.error("Chart Error:", err); }

        let detailsHtml = `
            <div class="test-block">
                <h3>⌨ Typing Test <span class="score">${typingScore} / 20</span></h3>
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

        renderComparison(totalScore, pattern);

        const isHistoryView = urlParams.has('sessionId');
        if (!isHistoryView) {
            triggerCelebration(totalScore, false);
        }
    }

    function showPerformanceBanner(totalScore, data) {
        if (!performanceBanner) return;
        
        // Determine tier
        let tier, title, message;
        if (totalScore >= 40) {
            tier = 'green';
            title = '🎉 Congratulations!';
            message = 'Outstanding performance! You\'ve mastered this exam.';
        } else if (totalScore >= 25) {
            tier = 'yellow';
            title = '💪 Good Progress!';
            message = 'You\'re on the right track. Keep practicing!';
        } else {
            tier = 'red';
            title = '🔥 Keep Pushing!';
            message = 'Don\'t give up! Practice will make you stronger.';
        }
        
        // Detect weakest area
        const weakArea = detectWeakArea(data);
        if (weakArea) {
            message += ` Focus on ${weakArea} practice to improve your score.`;
        }
        
        performanceBanner.className = `performance-banner ${tier}`;
        performanceBanner.innerHTML = `<h2>${title}</h2><p>${message}</p>`;
    }

    function detectWeakArea(data) {
        const scores = [
            { name: 'typing', score: data.typingScore || 0, max: 20 },
            { name: 'letter', score: data.letterScore || 0, max: 10 },
            { name: 'Excel', score: data.excelScore || 0, max: 20 }
        ];
        
        // Find lowest percentage
        const weakest = scores.reduce((min, s) => {
            const pct = s.score / s.max;
            return pct < min.pct ? { name: s.name, pct } : min;
        }, { name: null, pct: 1 });
        
        return weakest.pct < 0.6 ? weakest.name : null;
    }

    function formatLetterFeedback(feedback) {
        if (!feedback || feedback === 'N/A') return '<p>No feedback available.</p>';

        const lines = feedback.split('\n').map(line => line.trim()).filter(Boolean);
        let html = '<div class="letter-feedback-list">';
        let displayIndex = 1;

        lines.forEach(line => {
            let cleanContent = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            cleanContent = cleanContent.replace(/^[\d\.\s\-\>]+/, '').trim();

            if (cleanContent.includes(':')) {
                const parts = cleanContent.split(':');
                const criteria = parts[0];
                const rest = parts.slice(1).join(':');
                cleanContent = `<strong>${criteria}:</strong>${rest}`;
            }

            html += `
                <div class="feedback-item-styled">
                    <div class="feedback-number-bubble">${displayIndex}</div>
                    <div class="feedback-text-content">${cleanContent}</div>
                </div>`;
            displayIndex++;
        });

        return html + '</div>';
    }

    function formatExcelFeedback(feedback) {
        if (!feedback || feedback === 'N/A') return '<p>No detailed feedback available.</p>';

        const lines = feedback.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.toLowerCase().includes("here's a breakdown"));

        let html = '<div class="excel-feedback-list">';
        let displayIndex = 1;

        lines.forEach(line => {
            let cleanContent = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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

    async function triggerCelebration(score, isTopThree) {
        // Don't celebrate on history view
        const isHistoryView = urlParams.has('sessionId');
        if (isHistoryView) return;
        
        // Standard confetti for all completions
        if (typeof window.confetti === 'function') {
            window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
        
        // Fireworks ONLY for top 3
        if (isTopThree && typeof window.confetti === 'function') {
            const duration = 4000;
            const end = Date.now() + duration;
            
            (function frame() {
                window.confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.8 },
                    colors: ['#fbbf24', '#f59e0b', '#ef4444', '#10b981']
                });
                window.confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.8 },
                    colors: ['#fbbf24', '#f59e0b', '#ef4444', '#10b981']
                });
                if (Date.now() < end) requestAnimationFrame(frame);
            })();
        }
    }

    async function fetchPercentile(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/results/percentile/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && percentileRankElement) {
                percentileRankElement.textContent = data.percentile + '%';
            } else if (percentileRankElement) {
                percentileRankElement.textContent = 'N/A';
            }
        } catch (error) {
            if (percentileRankElement) percentileRankElement.textContent = 'N/A';
        }
    }

    async function renderComparison(userScore, pattern) {
        const card = document.getElementById('comparison-card');
        const content = document.getElementById('comparison-content');
        if (!card || !content) return;

        try {
            const res = await fetch('/api/leaderboard/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            const categoryKey = pattern === 'new_pattern' ? 'new_overall' : 'std_overall';
            const topPerformers = data[categoryKey];

            if (!topPerformers || topPerformers.length === 0) return;

            const topScore = topPerformers[0].totalScore;
            const thirdScore = topPerformers[2]?.totalScore || topScore;
            const diffToFirst = topScore - userScore;
            const diffToPodium = thirdScore - userScore;

            let message = "";
            let subtext = "";
            let isTopThree = false;

            if (userScore >= topScore) {
                message = "RANK #1 ACHIEVED!";
                subtext = "You've matched or beaten the current global leader. Your name is now being decorated in gold on the dashboard!";
                isTopThree = true;
            } else if (userScore >= thirdScore) {
                message = "YOU'RE ON THE PODIUM!";
                subtext = `Incredible work! You are currently in the Top 3. You only need ${diffToFirst.toFixed(1)} more marks to take the #1 spot.`;
                isTopThree = true;
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
            
            // Trigger fireworks if top 3 (and not history view)
            const isHistoryView = urlParams.has('sessionId');
            if (isTopThree && !isHistoryView) {
                triggerCelebration(userScore, true);
            }

        } catch (err) {
            console.error("Comparison Error:", err);
        }
    }

    fetchSessionResults();
});
