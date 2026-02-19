import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = auth.getToken();

    // Fetch MCQ stats for weak-area targeting
    async function loadMcqStats() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/practice/mcq-stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;
            const stats = await res.json();

            // Map category card IDs to category names
            const cardMap = {
                'card-Formulas': 'Formulas',
                'card-Shortcuts': 'Shortcuts',
                'card-CellRef': 'Cell Referencing',
                'card-BasicOps': 'Basic Operations',
                'card-Formatting': 'Formatting',
                'card-Charts': 'Charts',
                'card-PivotTables': 'Pivot Tables',
                'card-DataVal': 'Data Validation',
                'card-CondFormat': 'Conditional Formatting'
            };

            Object.entries(cardMap).forEach(([cardId, catName]) => {
                const card = document.getElementById(cardId);
                if (!card) return;
                const catStats = stats[catName];
                if (!catStats) return;

                // Remove existing badge
                card.querySelector('.weak-area-badge')?.remove();

                if (catStats.accuracy !== null && catStats.accuracy < 60) {
                    const badge = document.createElement('div');
                    badge.className = 'weak-area-badge';
                    badge.textContent = `⚠️ Needs Work (${catStats.accuracy}%)`;
                    card.insertBefore(badge, card.querySelector('.difficulty-selector'));
                } else if (catStats.accuracy !== null && catStats.accuracy >= 80) {
                    const badge = document.createElement('div');
                    badge.className = 'strong-area-badge';
                    badge.textContent = `✅ Strong (${catStats.accuracy}%)`;
                    card.insertBefore(badge, card.querySelector('.difficulty-selector'));
                }
            });
        } catch (_) { /* stats optional */ }
    }

    loadMcqStats();

    let questions = [];
    let currentIdx = 0;
    let score = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let userAnswers = []; // Track each answer for review mode
    let currentCategory = '';
    let currentDifficulty = '';

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
            currentCategory = category;
            currentDifficulty = difficulty;

            const spacedRep = document.getElementById('spaced-repetition-toggle')?.checked;
            let url = `${API_BASE_URL}/api/mcqs/practice/${encodeURIComponent(category)}`;
            const params = new URLSearchParams();
            if (difficulty && difficulty !== 'All') {
                params.append('difficulty', difficulty);
            }
            if (spacedRep) {
                params.append('spacedRepetition', 'true');
            }
            if (params.toString()) {
                url += '?' + params.toString();
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
            userAnswers = [];

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
            explanationBox.style.display = 'none';
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

        const isCorrect = selectedIndex === q.correctAnswerIndex;

        // Record answer for review
        userAnswers.push({
            questionText: q.questionText,
            imageUrl: q.imageUrl || null,
            options: q.options,
            selectedIndex,
            correctIndex: q.correctAnswerIndex,
            isCorrect,
            explanation: q.correctExplanation || ''
        });

        if (isCorrect) {
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
            explanationBox.style.display = 'block';
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

    async function saveMcqResult() {
        try {
            await fetch(`${API_BASE_URL}/api/practice/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    category: `mcq-${currentCategory}`,
                    difficulty: currentDifficulty === 'All' ? 'mixed' : (currentDifficulty || 'mixed').toLowerCase(),
                    score,
                    totalQuestions: questions.length
                })
            });
        } catch (err) {
            console.warn('Could not save MCQ result:', err);
        }
    }

    function renderReviewList() {
        const reviewList = document.getElementById('review-list');
        if (!reviewList) return;

        reviewList.innerHTML = userAnswers.map((a, i) => `
            <div class="review-item ${a.isCorrect ? 'review-correct' : 'review-incorrect'}">
                <div class="review-q-header">
                    <span class="review-q-num">Q${i + 1}</span>
                    <span class="review-q-status">${a.isCorrect ? '✅ Correct' : '❌ Incorrect'}</span>
                </div>
                <div class="review-q-text">${a.questionText}</div>
                ${a.imageUrl ? `<img src="${a.imageUrl}" style="max-height:120px; margin:0.5rem 0; border-radius:6px;">` : ''}
                <div class="review-options">
                    ${a.options.map((opt, oi) => `
                        <div class="review-option ${oi === a.correctIndex ? 'review-option-correct' : ''} ${oi === a.selectedIndex && !a.isCorrect ? 'review-option-wrong' : ''}">
                            ${String.fromCharCode(65 + oi)}. ${opt}
                            ${oi === a.correctIndex ? ' ✓' : ''}
                            ${oi === a.selectedIndex && !a.isCorrect ? ' ✗' : ''}
                        </div>
                    `).join('')}
                </div>
                ${a.explanation ? `<div class="review-explanation">💡 ${a.explanation}</div>` : ''}
            </div>
        `).join('');
    }

    function showSummary() {
        if (questionView) questionView.classList.add('hidden');
        if (summaryView) summaryView.classList.remove('hidden');

        const finalScore = document.getElementById('final-score');
        if (finalScore) finalScore.innerText = `${score} / ${questions.length}`;

        const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
        const scorePercent = document.getElementById('score-percent');
        if (scorePercent) scorePercent.innerText = `${pct}%`;

        const bestStreakMsg = document.getElementById('best-streak-msg');
        if (bestStreakMsg) {
            if (bestStreak >= 3) {
                bestStreakMsg.innerText = `🔥 Best Streak: ${bestStreak} in a row!`;
            } else {
                bestStreakMsg.innerText = '';
            }
        }

        // Render review list
        renderReviewList();

        // Save result to DB
        saveMcqResult();
    }

    // Toggle review section
    window.toggleReview = () => {
        const reviewSection = document.getElementById('review-section');
        const toggleBtn = document.getElementById('toggle-review-btn');
        if (!reviewSection) return;
        const isHidden = reviewSection.classList.contains('hidden');
        reviewSection.classList.toggle('hidden');
        if (toggleBtn) toggleBtn.textContent = isHidden ? '▲ Hide Review' : '▼ Review All Answers';
    };
});
