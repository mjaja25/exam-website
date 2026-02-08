let mcqData = [];
let currentIdx = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`/api/results/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // 1. Render Overall Score Circle
        const totalDisp = document.getElementById('total-score-display');
        if (totalDisp) totalDisp.innerText = Math.round(data.totalScore || 0);

        // 2. Render Component Cards
        const breakdown = document.getElementById('score-breakdown');
        if (breakdown) {
            breakdown.innerHTML = `
                <div class="mini-card"><strong>Typing</strong><p>${Math.round(data.typingScore || 0)}/30</p></div>
                <div class="mini-card"><strong>Excel MCQ</strong><p>${Math.round(data.mcqScore || 0)}/20</p></div>
            `;
        }

        // 3. Setup Review Data
        mcqData = data.mcqReviewData || [];
        renderMcq();

        // 4. Attach Navigation Listeners
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
        console.error("Render Error:", err);
        alert("Failed to load results. Please try again from the dashboard.");
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