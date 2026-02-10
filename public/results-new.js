let mcqData = [];
let currentIdx = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const token = localStorage.getItem('token');

    if (!sessionId) {
        alert("No session found. Returning to dashboard.");
        window.location.href = "/dashboard.html";
        return;
    }

    try {
        const res = await fetch(`/api/results/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || "Failed to load results");
        }

        const data = await res.json();

        // Update UI
        document.getElementById('total-score-display').innerText = Math.round(data.totalScore || 0);
        document.getElementById('score-breakdown').innerHTML = `
            <div class="mini-card"><strong>Typing</strong><p>${Math.round(data.typingScore || 0)}/30</p></div>
            <div class="mini-card"><strong>Excel MCQ</strong><p>${Math.round(data.mcqScore || 0)}/20</p></div>
        `;

        mcqData = data.mcqReviewData || [];
        renderMcq();

        // ATTACH THESE LISTENERS:
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
        console.error("FRONTEND RENDER ERROR:", err);
        document.body.innerHTML = `<div style="text-align:center; padding:50px;">
            <h2>Oops! Result Loading Failed</h2>
            <p>${err.message}</p>
            <button onclick="window.location.href='/dashboard.html'">Back to Dashboard</button>
        </div>`;
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