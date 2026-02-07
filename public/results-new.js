let mcqData = [];
let currentIdx = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const token = localStorage.getItem('token');

    const res = await fetch(`/api/results/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    // 1. Set Overall Score
    document.getElementById('total-score-display').innerText = Math.round(data.totalScore);

    // 2. Tally Cards
    document.getElementById('score-breakdown').innerHTML = `
        <div class="card"><strong>Typing</strong><p>${Math.round(data.typingScore)}/30</p></div>
        <div class="card"><strong>Excel MCQ</strong><p>${Math.round(data.mcqScore)}/20</p></div>
    `;

    // 3. Simple Chart
    new Chart(document.getElementById('scoreChart'), {
        type: 'bar',
        data: {
            labels: ['Typing', 'MCQ'],
            datasets: [{
                data: [data.typingScore, data.mcqScore],
                backgroundColor: ['#fbbf24', '#3b82f6'],
                borderRadius: 5
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });

    // 4. Initialize MCQ Review
    mcqData = data.mcqReviewData || [];
    renderMcq();

    document.getElementById('next-mcq').onclick = () => { if(currentIdx < mcqData.length-1) { currentIdx++; renderMcq(); }};
    document.getElementById('prev-mcq').onclick = () => { if(currentIdx > 0) { currentIdx--; renderMcq(); }};
});

function renderMcq() {
    const q = mcqData[currentIdx];
    const viewer = document.getElementById('mcq-viewer-content');
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
                return `<div class="${cls}">${String.fromCharCode(65+i)}. ${opt}</div>`;
            }).join('')}
        </div>
    `;
    document.getElementById('mcq-counter').innerText = `Question ${currentIdx + 1} of ${mcqData.length}`;
}