document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    let questions = [];
    let currentIdx = 0;
    let score = 0;

    // UI Elements
    const selectionView = document.getElementById('selection-view');
    const questionView = document.getElementById('question-view');
    const summaryView = document.getElementById('summary-view');
    const optionsContainer = document.getElementById('options-container');
    const nextBtn = document.getElementById('next-btn');

    // 1. Fetch & Start
    window.startPractice = async (category) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/mcqs/practice/${category}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Could not load practice set");
            questions = await res.json();

            selectionView.classList.add('hidden');
            questionView.classList.remove('hidden');
            renderQuestion();
        } catch (err) {
            if (typeof showToast === 'function') showToast(err.message, 'error');
        }
    };

    // 2. Render Question
    function renderQuestion() {
        const q = questions[currentIdx];
        document.getElementById('progress-text').innerText = `Question ${currentIdx + 1} of ${questions.length}`;
        document.getElementById('question-text').innerText = q.questionText;
        document.getElementById('feedback-msg').style.display = 'none';
        nextBtn.classList.add('hidden');

        optionsContainer.innerHTML = q.options.map((opt, i) => `
            <button class="option-btn" onclick="handleAnswer(${i})">
                ${String.fromCharCode(65 + i)}. ${opt}
            </button>
        `).join('');
    }

    // 3. Instant Feedback Logic
    window.handleAnswer = (selectedIndex) => {
        const q = questions[currentIdx];
        const buttons = optionsContainer.querySelectorAll('.option-btn');
        const feedbackMsg = document.getElementById('feedback-msg');

        // Disable all buttons to prevent double-clicking
        buttons.forEach(btn => btn.disabled = true);

        if (selectedIndex === q.correctAnswerIndex) {
            buttons[selectedIndex].classList.add('correct');
            feedbackMsg.innerText = "Correct! Well done.";
            feedbackMsg.style.color = "#059669";
            score++;
            document.getElementById('score-text').innerText = `Score: ${score}`;
        } else {
            buttons[selectedIndex].classList.add('incorrect');
            buttons[q.correctAnswerIndex].classList.add('correct');
            feedbackMsg.innerText = `Incorrect. The correct answer was ${String.fromCharCode(65 + q.correctAnswerIndex)}.`;
            feedbackMsg.style.color = "#dc2626";
        }

        feedbackMsg.style.display = 'block';
        nextBtn.classList.remove('hidden');
    };

    // 4. Navigation
    nextBtn.onclick = () => {
        if (currentIdx < questions.length - 1) {
            currentIdx++;
            renderQuestion();
        } else {
            showSummary();
        }
    };

    function showSummary() {
        questionView.classList.add('hidden');
        summaryView.classList.remove('hidden');
        document.getElementById('final-score').innerText = `${score} / ${questions.length}`;
    }
});