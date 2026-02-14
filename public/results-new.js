let mcqData = [];
let currentIdx = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId') || localStorage.getItem('currentSessionId');
    const token = localStorage.getItem('token');

    if (!sessionId) {
        window.location.href = "/dashboard.html";
        return;
    }

    try {
        const res = await fetch(`/api/results/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        console.log("Full Result Data Received:", data); // Troubleshooting log

        // 1. Render Score and Progress Circle with animation
        const total = Math.round(data.totalScore || 0);
        const scoreDisplay = document.getElementById('total-score-display');
        if (scoreDisplay) {
            const startTime = performance.now();
            const duration = 1200;
            const countUp = (now) => {
                const progress = Math.min((now - startTime) / duration, 1);
                scoreDisplay.innerText = Math.round(total * progress);
                if (progress < 1) requestAnimationFrame(countUp);
            };
            requestAnimationFrame(countUp);
        }

        const circle = document.getElementById('total-score-circle');
        if (circle) {
            const degrees = (total / 50) * 360;
            circle.style.background = `conic-gradient(#fbbf24 var(--score-deg), #eee var(--score-deg))`;
            requestAnimationFrame(() => {
                circle.style.setProperty('--score-deg', degrees + 'deg');
            });
        }

        // 2. Render Breakdown Cards
        const breakdown = document.getElementById('score-breakdown');
        if (breakdown) {
            breakdown.innerHTML = `
                <div class="mini-card"><strong>Typing</strong><p>${Math.round(data.typingScore || 0)}/30</p></div>
                <div class="mini-card"><strong>Excel MCQ</strong><p>${Math.round(data.mcqScore || 0)}/20</p></div>
            `;
        }

        // >>> ADD THIS CELEBRATION LOGIC HERE <<<
        // if (typeof confetti === 'function') {
        //     confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } }); // Instant Pop

        //     // Check Leaderboard for Fireworks
        //     fetch('/api/leaderboard/all', { headers: { 'Authorization': `Bearer ${token}` } })
        //     .then(res => res.json())
        //     .then(lb => {
        //         const leaders = lb['new_overall'] || [];
        //         const total = Math.round(data.totalScore || 0);

        //         if (leaders.some(l => Math.round(l.totalScore) === total)) {
        //             // Fireworks Loop
        //             let duration = 3000;
        //             let end = Date.now() + duration;
        //             (function frame() {
        //                 confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        //                 confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        //                 if (Date.now() < end) requestAnimationFrame(frame);
        //             }());
        //         }
        //     })
        //     .catch(err => console.error("Leaderboard check failed", err));
        // }

        // 3. Score Visualization (Chart.js)

        // --- UPDATED CHART LOGIC ---
        const statsRes = await fetch(`/api/stats/global`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allStats = await statsRes.json();

        // >>> USE ONLY NEW PATTERN STATS <<<
        const stats = allStats.new_pattern;

        const ctx = document.getElementById('scoreChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Typing', 'Excel MCQ'],
                    datasets: [
                        {
                            label: 'You',
                            data: [data.typingScore || 0, data.mcqScore || 0],
                            backgroundColor: '#fbbf24', borderRadius: 5
                        },
                        {
                            label: 'Avg',
                            data: [Math.round(stats.avgTyping || 0), Math.round(stats.avgMCQ || 0)],
                            backgroundColor: '#9ca3af', borderRadius: 5
                        },
                        {
                            label: 'Top',
                            data: [stats.maxTyping || 0, stats.maxMCQ || 0],
                            backgroundColor: '#10b981', borderRadius: 5
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    // Max 30 for Typing in New Pattern
                    scales: { x: { max: 30, beginAtZero: true } },
                    plugins: { legend: { display: true, position: 'bottom' } }
                }
            });
        }

        // --- CONDITIONAL CONFETTI ---
        const isHistoryView = urlParams.has('sessionId'); // Check URL params defined at top of file

        if (!isHistoryView && typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });

            // Fireworks Logic (Only if fresh result)
            fetch('/api/leaderboard/all', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json())
                .then(lb => {
                    const leaders = lb['new_overall'] || [];
                    const total = Math.round(data.totalScore || 0);
                    if (leaders.some(l => Math.round(l.totalScore) === total)) {
                        // ... Launch Fireworks ...
                        let duration = 3000;
                        let end = Date.now() + duration;
                        (function frame() {
                            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
                            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
                            if (Date.now() < end) requestAnimationFrame(frame);
                        }());
                    }
                });
        }

        // wpm and accuracy
        document.getElementById('score-breakdown').innerHTML = `
            <div class="mini-card">
                <strong>Typing</strong>
                <p>${Math.round(data.typingScore || 0)}/30</p>
                <small style="display:block; font-size:0.8em; color:#666;">
                    ${data.wpm || 0} WPM | ${data.accuracy || 0}% Acc
                </small>
            </div>
            <div class="mini-card">
                <strong>Excel MCQ</strong>
                <p>${Math.round(data.mcqScore || 0)}/20</p>
            </div>
        `;

        // 4. Fetch Pattern-Specific Percentile
        const percRes = await fetch(`/api/results/percentile/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const percData = await percRes.json();
        const rankEl = document.getElementById('percentile-rank');
        if (rankEl) rankEl.innerText = `${percData.percentile || 0}%`;

        // 5. Initialize MCQ Review
        mcqData = data.mcqReviewData || [];
        console.log("MCQ Data count:", mcqData.length);
        renderMcq();

        // 6. Navigation Buttons
        const nextBtn = document.getElementById('next-mcq');
        const prevBtn = document.getElementById('prev-mcq');

        if (nextBtn) {
            nextBtn.onclick = () => {
                if (currentIdx < mcqData.length - 1) {
                    currentIdx++;
                    renderMcq();
                }
            };
        }
        if (prevBtn) {
            prevBtn.onclick = () => {
                if (currentIdx > 0) {
                    currentIdx--;
                    renderMcq();
                }
            };
        }

    } catch (err) {
        console.error("RENDER ERROR:", err);
        const viewer = document.getElementById('mcq-viewer-content');
        if (viewer) viewer.innerHTML = `<p class="error">Failed to load: ${err.message}</p>`;
    }
});

function renderMcq() {
    const q = mcqData[currentIdx];
    const viewer = document.getElementById('mcq-viewer-content');
    const counter = document.getElementById('mcq-counter');
    if (!q || !viewer) return;

    const isCorrect = q.userAnswer === q.correctAnswer;

    viewer.innerHTML = `
        <div class="review-status ${isCorrect ? 'correct-text' : 'wrong-text'}">
            ${isCorrect ? '✔ Correct Answer' : '✘ Incorrect Answer'}
        </div>
        <p class="q-text">${q.questionText}</p>
        <div class="opt-list">
            ${q.options.map((opt, i) => {
        let cls = 'opt-box';
        if (i === q.correctAnswer) cls += ' correct-box';
        if (i === q.userAnswer && !isCorrect) cls += ' wrong-box';
        return `<div class="${cls}">${String.fromCharCode(65 + i)}. ${opt}</div>`;
    }).join('')}
        </div>
    `;
    if (counter) counter.innerText = `Question ${currentIdx + 1} of ${mcqData.length}`;
}