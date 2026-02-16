import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = auth.getToken();

    let questions = [];
    let currentIdx = 0;
    let score = 0;
    let currentStreak = 0;
    let bestStreak = 0;

    const selectionView = document.getElementById('selection-view');
    const questionView = document.getElementById('question-view');
    const summaryView = document.getElementById('summary-view');
    const optionsContainer = document.getElementById('options-container');
    const nextBtn = document.getElementById('next-btn');
    const streakBar = document.getElementById('streak-bar');
    const streakCount = document.getElementById('streak-count');
    const streakMsg = document.getElementById('streak-msg');
    const explanationBox = document.getElementById('explanation-box');

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
                ui.showToast('No questions available for this selection. Try a different difficulty or category.', 'info');
                return;
            }

            currentIdx = 0;
            score = 0;
            currentStreak = 0;
            bestStreak = 0;

            if (selectionView) selectionView.classList.add('hidden');
            if (questionView) questionView.classList.remove('hidden');
            renderQuestion();
        } catch (err) {
            ui.showToast(err.message, 'error');
        }
    };

    function renderQuestion() {
        const q = questions[currentIdx];
        const progressText = document.getElementById('progress-text');
        const qText = document.getElementById('question-text');
        const feedbackMsg = document.getElementById('feedback-msg');
        const scoreText = document.getElementById('score-text');

        if (progressText) progressText.innerText = `Question ${currentIdx + 1} of ${questions.length}`;
        if (qText) {
            qText.innerHTML = `
            ${q.questionText}
            ${q.imageUrl ? `<img src="${q.imageUrl}" style="display:block; max-height:200px; margin:1rem auto; border-radius:8px;">` : ''}
        `;
        }
        if (feedbackMsg) feedbackMsg.style.display = 'none';
        if (scoreText) scoreText.innerText = `Score: ${score}`;
        if (nextBtn) nextBtn.classList.add('hidden');

        if (explanationBox) {
            explanationBox.classList.remove('active');
            explanationBox.textContent = '';
        }

        if (optionsContainer) {
            optionsContainer.innerHTML = q.options.map((opt, i) => `
                <button class="option-btn" onclick="handleAnswer(${i})">
                    ${String.fromCharCode(65 + i)}. ${opt}
                </button>
            `).join('');
        }

        updateStreakBar();
    }

    window.handleAnswer = (selectedIndex) => {
        const q = questions[currentIdx];
        const buttons = optionsContainer?.querySelectorAll('.option-btn');
        const feedbackMsg = document.getElementById('feedback-msg');

        if (buttons) buttons.forEach(btn => btn.disabled = true);

        if (selectedIndex === q.correctAnswerIndex) {
            if (buttons) buttons[selectedIndex].classList.add('correct');
            if (feedbackMsg) {
                feedbackMsg.innerText = "Correct! Well done.";
                feedbackMsg.style.color = "#059669";
            }
            score++;
            currentStreak++;
            if (currentStreak > bestStreak) bestStreak = currentStreak;
            const scoreText = document.getElementById('score-text');
            if (scoreText) scoreText.innerText = `Score: ${score}`;
        } else {
            if (buttons) {
                buttons[selectedIndex].classList.add('incorrect');
                buttons[q.correctAnswerIndex].classList.add('correct');
            }
            if (feedbackMsg) {
                feedbackMsg.innerText = `Incorrect. The correct answer was ${String.fromCharCode(65 + q.correctAnswerIndex)}.`;
                feedbackMsg.style.color = "#dc2626";
            }
            currentStreak = 0;
        }

        if (q.correctExplanation && explanationBox) {
            explanationBox.textContent = q.correctExplanation;
            explanationBox.classList.add('active');
        }

        if (feedbackMsg) feedbackMsg.style.display = 'block';
        if (nextBtn) nextBtn.classList.remove('hidden');
        updateStreakBar();
    };

    function updateStreakBar() {
        if (streakBar) {
            if (currentStreak >= 2) {
                streakBar.style.display = 'flex';
                if (streakCount) streakCount.textContent = currentStreak;

                if (currentStreak >= 5) {
                    streakBar.classList.add('hot');
                    if (streakMsg) streakMsg.textContent = '🔥 On fire!';
                } else if (currentStreak >= 3) {
                    streakBar.classList.remove('hot');
                    if (streakMsg) streakMsg.textContent = '✨ Nice streak!';
                } else {
                    streakBar.classList.remove('hot');
                    if (streakMsg) streakMsg.textContent = '';
                }
            } else {
                streakBar.style.display = 'none';
            }
        }
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentIdx < questions.length - 1) {
                currentIdx++;
                renderQuestion();
            } else {
                showSummary();
            }
        };
    }

    function showSummary() {
        if (questionView) questionView.classList.add('hidden');
        if (summaryView) summaryView.classList.remove('hidden');
        
        const finalScore = document.getElementById('final-score');
        if (finalScore) finalScore.innerText = `${score} / ${questions.length}`;

        const bestStreakMsg = document.getElementById('best-streak-msg');
        if (bestStreakMsg) {
            if (bestStreak >= 3) {
                bestStreakMsg.innerText = `🔥 Best Streak: ${bestStreak} in a row!`;
            } else {
                bestStreakMsg.innerText = '';
            }
        }
    }
});
