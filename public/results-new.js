let mcqData = [];
let currentIdx = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    // 1. Priority: URL Parameter, Fallback: LocalStorage
    const sessionId = urlParams.get('sessionId') || localStorage.getItem('currentSessionId');
    const token = localStorage.getItem('token');

    if (!sessionId) {
        alert("Session not found. Redirecting to dashboard.");
        window.location.href = "/dashboard.html";
        return;
    }

    try {
        const res = await fetch(`/api/results/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Fetch failed");

        // 1. Render Total Score and Progress Circle
        const totalScore = Math.round(data.totalScore || 0);
        document.getElementById('total-score-display').innerText = totalScore;
        
        const circle = document.getElementById('total-score-circle');
        const degrees = (totalScore / 50) * 360;
        circle.style.background = `conic-gradient(#fbbf24 ${degrees}deg, #eee ${degrees}deg)`;

        // 2. Render Breakdown Cards
        document.getElementById('score-breakdown').innerHTML = `
            <div class="mini-card"><strong>Typing</strong><p>${Math.round(data.typingScore || 0)}/30</p></div>
            <div class="mini-card"><strong>Excel MCQ</strong><p>${Math.round(data.mcqScore || 0)}/20</p></div>
        `;

        // 3. Fetch Percentile (The ranking logic)
        // FETCH SEPARATE PERCENTILE
        const percRes = await fetch(`/api/results/percentile/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const percData = await percRes.json();

        const rankEl = document.getElementById('percentile-rank');
        if (rankEl) {
            rankEl.innerText = `${percData.percentile}%`;
        }

        // 4. Setup MCQ Data
        mcqData = data.mcqReviewData || [];
        renderMcq();

        // 5. FIX: Attach Button Listeners (This was likely missing)
        document.getElementById('next-mcq').onclick = () => {
            if (currentIdx < mcqData.length - 1) {
                currentIdx++;
                renderMcq();
            }
        };
        document.getElementById('prev-mcq').onclick = () => {
            if (currentIdx > 0) {
                currentIdx--;
                renderMcq();
            }
        };

    } catch (err) {
        console.error("RENDER ERROR:", err);
        document.getElementById('mcq-viewer-content').innerHTML = `<p class="error">Failed to load: ${err.message}</p>`;
    }
});

function renderMcq() {
    const q = mcqData[currentIdx];
    const viewer = document.getElementById('mcq-viewer-content');
    const counter = document.getElementById('mcq-counter');
    
    if (!q) return;

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