document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    let questions = [];
    let currentIdx = 0;
    let score = 0;
    let currentStreak = 0;
    let bestStreak = 0;

    // UI Elements
    const selectionView = document.getElementById('selection-view');
    const questionView = document.getElementById('question-view');
    const summaryView = document.getElementById('summary-view');
    const optionsContainer = document.getElementById('options-container');
    const nextBtn = document.getElementById('next-btn');
    const streakBar = document.getElementById('streak-bar');
    const streakCount = document.getElementById('streak-count');
    const streakMsg = document.getElementById('streak-msg');
    const explanationBox = document.getElementById('explanation-box');

    // 1. Fetch & Start (with difficulty)
    window.startPractice = async (category, difficulty) => {
        try {
            let url = `${API_BASE_URL}/api/mcqs/practice/${encodeURIComponent(category)}`;
            if (difficulty && difficulty !== 'All') {
                url += `?difficulty=${encodeURIComponent(difficulty)}`;
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Could not load practice set");
            questions = await res.json();

            if (questions.length === 0) {
                if (typeof showToast === 'function') showToast('No questions available for this selection. Try a different difficulty or category.', 'info');
                return;
            }

            // Reset state
            currentIdx = 0;
            score = 0;
            currentStreak = 0;
            bestStreak = 0;

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
        const qText = document.getElementById('question-text');
        qText.innerHTML = `
        ${q.questionText}
        ${q.imageUrl ? `<img src="${q.imageUrl}" style="display:block; max-height:200px; margin:1rem auto; border-radius:8px;">` : ''}
    `;
        document.getElementById('feedback-msg').style.display = 'none';
        document.getElementById('score-text').innerText = `Score: ${score}`;
        nextBtn.classList.add('hidden');

        // Hide explanation for new question
        explanationBox.classList.remove('active');
        explanationBox.textContent = '';

        optionsContainer.innerHTML = q.options.map((opt, i) => `
            <button class="option-btn" onclick="handleAnswer(${i})">
                ${String.fromCharCode(65 + i)}. ${opt}
            </button>
        `).join('');

        updateStreakBar();
    }

    // 3. Instant Feedback Logic (with explanation & streak)
    window.handleAnswer = (selectedIndex) => {
        const q = questions[currentIdx];
        const buttons = optionsContainer.querySelectorAll('.option-btn');
        const feedbackMsg = document.getElementById('feedback-msg');

        // Disable all buttons
        buttons.forEach(btn => btn.disabled = true);

        if (selectedIndex === q.correctAnswerIndex) {
            buttons[selectedIndex].classList.add('correct');
            feedbackMsg.innerText = "Correct! Well done.";
            feedbackMsg.style.color = "#059669";
            score++;
            currentStreak++;
            if (currentStreak > bestStreak) bestStreak = currentStreak;
            document.getElementById('score-text').innerText = `Score: ${score}`;
        } else {
            buttons[selectedIndex].classList.add('incorrect');
            buttons[q.correctAnswerIndex].classList.add('correct');
            feedbackMsg.innerText = `Incorrect. The correct answer was ${String.fromCharCode(65 + q.correctAnswerIndex)}.`;
            feedbackMsg.style.color = "#dc2626";
            currentStreak = 0;
        }

        // Show explanation if available
        if (q.correctExplanation) {
            explanationBox.textContent = q.correctExplanation;
            explanationBox.classList.add('active');
        }

        feedbackMsg.style.display = 'block';
        nextBtn.classList.remove('hidden');
        updateStreakBar();
    };

    // 4. Streak Bar
    function updateStreakBar() {
        if (currentStreak >= 2) {
            streakBar.style.display = 'flex';
            streakCount.textContent = currentStreak;

            if (currentStreak >= 5) {
                streakBar.classList.add('hot');
                streakMsg.textContent = '🔥 On fire!';
            } else if (currentStreak >= 3) {
                streakBar.classList.remove('hot');
                streakMsg.textContent = '✨ Nice streak!';
            } else {
                streakBar.classList.remove('hot');
                streakMsg.textContent = '';
            }
        } else {
            streakBar.style.display = 'none';
        }
    }

    // 5. Navigation
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

        const bestStreakMsg = document.getElementById('best-streak-msg');
        if (bestStreak >= 3) {
            bestStreakMsg.innerText = `🔥 Best Streak: ${bestStreak} in a row!`;
        } else {
            bestStreakMsg.innerText = '';
        }
    }
});