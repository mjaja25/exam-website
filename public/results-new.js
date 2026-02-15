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
            let cardsHtml = '';

            // TYPING (Always present)
            cardsHtml += `
                <div class="mini-card">
                    <strong>Typing</strong>
                    <p>${Math.round(data.typingScore || 0)}/${data.testPattern === 'new_pattern' ? 30 : 20}</p>
                    <button onclick="analyzeExam('typing', '${sessionId}')" class="analyze-btn">🤖 Analyze</button>
                    <small style="display:block; font-size:0.7em; margin-top:5px;">${data.wpm || 0} WPM | ${data.accuracy || 0}%</small>
                </div>
            `;

            // LETTER (Standard Only)
            if (data.testPattern === 'standard' || data.letterScore !== undefined) {
                cardsHtml += `
                    <div class="mini-card">
                        <strong>Letter</strong>
                        <p>${Math.round(data.letterScore || 0)}/10</p>
                        <button onclick="analyzeExam('letter', '${sessionId}')" class="analyze-btn">🤖 Analyze</button>
                    </div>
                `;
            }

            // EXCEL PRACTICAL (Standard Only)
            if (data.testPattern === 'standard' || data.excelScore !== undefined) {
                cardsHtml += `
                    <div class="mini-card">
                        <strong>Excel Practical</strong>
                        <p>${Math.round(data.excelScore || 0)}/20</p>
                        <button onclick="analyzeExam('excel', '${sessionId}')" class="analyze-btn">🤖 Analyze</button>
                    </div>
                `;
            }

            // EXCEL MCQ (New Pattern Only)
            if (data.testPattern === 'new_pattern' || data.mcqScore !== undefined) {
                cardsHtml += `
                    <div class="mini-card">
                        <strong>Excel MCQ</strong>
                        <p>${Math.round(data.mcqScore || 0)}/20</p>
                        <!-- No Analysis for MCQ -->
                    </div>
                `;
            }

            breakdown.innerHTML = cardsHtml;
        }

        // 2b. Add Global Leaderboard Button
        const headerAction = document.createElement('div');
        headerAction.style.textAlign = 'center';
        headerAction.style.marginTop = '20px';
        headerAction.innerHTML = `<a href="/leaderboards.html" class="nav-button primary">🏆 View Global Leaderboard</a>`;
        if (breakdown) breakdown.parentNode.insertBefore(headerAction, breakdown.nextSibling);


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

        // Determines which stats to use based on pattern
        const stats = data.testPattern === 'new_pattern' ? allStats.new_pattern : allStats.std_overall;

        const ctx = document.getElementById('scoreChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.testPattern === 'new_pattern' ? ['Typing', 'Excel MCQ'] : ['Typing', 'Letter', 'Excel'],
                    datasets: [
                        {
                            label: 'You',
                            data: data.testPattern === 'new_pattern'
                                ? [data.typingScore, data.mcqScore]
                                : [data.typingScore, data.letterScore, data.excelScore],
                            backgroundColor: '#fbbf24', borderRadius: 5
                        },
                        {
                            label: 'Avg',
                            data: data.testPattern === 'new_pattern'
                                ? [stats.avgTyping || 0, stats.avgMCQ || 0]
                                : [stats.avgTyping || 0, stats.avgLetter || 0, stats.avgExcel || 0],
                            backgroundColor: '#9ca3af', borderRadius: 5
                        },
                        // 'Top' might need adjustment if structure differs
                    ]
                },
                options: {
                    indexAxis: 'y',
                    scales: { x: { beginAtZero: true } },
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

        // 4. Fetch Pattern-Specific Percentile
        const percRes = await fetch(`/api/results/percentile/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const percData = await percRes.json();
        const rankEl = document.getElementById('percentile-rank');
        if (rankEl) rankEl.innerText = `${percData.percentile || 0}%`;

        // 5. Initialize MCQ Review
        if (data.mcqReviewData) {
            mcqData = data.mcqReviewData || [];
            if (mcqData.length > 0) {
                renderMcq();
                document.getElementById('mcq-review-section').style.display = 'block';
            } else {
                document.getElementById('mcq-review-section').style.display = 'none';
            }
        }

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

// --- ANALYSIS MODAL LOGIC ---
window.analyzeExam = async function (type, sessionId) {
    // Inject Modal if not exists
    if (!document.getElementById('analysis-modal')) {
        const modalHtml = `
            <div id="analysis-modal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; justify-content:center; align-items:center;">
                <div class="modal-content" style="background:white; padding:2rem; border-radius:10px; max-width:600px; width:90%; max-height:80vh; overflow-y:auto; position:relative;">
                    <span onclick="document.getElementById('analysis-modal').style.display='none'" style="position:absolute; top:10px; right:15px; cursor:pointer; font-size:1.5rem;">&times;</span>
                    <h2 id="anal-title" style="margin-top:0;">AI Analysis</h2>
                    <div id="anal-body">Loading analysis...</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const modal = document.getElementById('analysis-modal');
    const body = document.getElementById('anal-body');
    const title = document.getElementById('anal-title');

    modal.style.display = 'flex';
    title.innerText = `AI Analysis: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    body.innerHTML = '<div class="spinner"></div><p style="text-align:center">Consulting AI Tutor...</p>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/exam/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId, type })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        const analysis = data.analysis;

        // Render Analysis
        let html = '';

        if (analysis.strengths) {
            html += `<h3>💪 Strengths</h3><ul>${analysis.strengths.map(s => `<li><strong>${s.title}</strong>: ${s.detail}</li>`).join('')}</ul>`;
        }
        if (analysis.improvements) {
            html += `<h3>📈 Areas for Improvement</h3><ul>${analysis.improvements.map(s => `<li><strong>${s.title}</strong>: ${s.detail}<br><em>Tip: ${s.suggestion}</em></li>`).join('')}</ul>`;
        }
        if (analysis.tips) {
            html += `<h3>💡 Pro Tips</h3><ul>${analysis.tips.map(t => `<li>${t.text}</li>`).join('')}</ul>`;
        }
        if (analysis.sampleStructure) {
            html += `<h3>📝 Suggested Structure</h3><pre style="background:#f4f4f5; padding:10px; border-radius:5px; white-space:pre-wrap;">${analysis.sampleStructure}</pre>`;
        }

        body.innerHTML = html;

    } catch (err) {
        body.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
};