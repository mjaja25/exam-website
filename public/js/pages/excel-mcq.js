import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = auth.getToken();
    const sessionId = localStorage.getItem('currentSessionId');

    let questions = [];
    let currentIdx = 0;
    let userAnswers = {};
    let timeLeft = 300;
    let timerInterval;

    const questionArea = document.getElementById('question-area');
    const timerElement = document.getElementById('mcq-timer');
    const timerDisplay = document.getElementById('timer-display');
    const progressBar = document.getElementById('mcq-progress');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const questionMap = document.getElementById('question-map');

    async function fetchQuestions() {
        try {
            const res = await fetch('/api/exam/get-next-set', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to load questions");
            const data = await res.json();
            questions = data.questions;
            localStorage.setItem('currentMCQSetId', data.setId);
            renderQuestionMap();
            renderQuestion();
            startTimer();
        } catch (err) {
            if (questionArea) questionArea.innerHTML = `<div class="error">Error: ${err.message}. Please return to dashboard.</div>`;
        }
    }

    function renderQuestionMap() {
        if (!questionMap) return;
        questionMap.innerHTML = questions.map((q, i) => {
            let cls = 'map-circle';
            if (userAnswers[q._id] !== undefined) cls += ' answered';
            if (i === currentIdx) cls += ' current';
            return `<div class="${cls}" onclick="jumpToQuestion(${i})" title="Question ${i + 1}">${i + 1}</div>`;
        }).join('');
    }

    window.jumpToQuestion = (idx) => {
        currentIdx = idx;
        renderQuestion();
        renderQuestionMap();
    };

    function renderQuestion() {
        const q = questions[currentIdx];

        if (!q) {
            if (questionArea) questionArea.innerHTML = `<div class="error">Error: Question data is missing.</div>`;
            return;
        }

        const progressEl = document.getElementById('progress-text');
        if (progressEl) progressEl.innerText = `Question ${currentIdx + 1} of ${questions.length}`;

        if (questionArea) {
            questionArea.innerHTML = `
                <div class="question-box active">
                    <p class="step-label">Question ${currentIdx + 1} of ${questions.length}</p>
                    <h3>${q.questionText}</h3>
                    <div class="options-grid">
                        ${q.options.map((opt, i) => `
                            <button class="option-btn ${userAnswers[q._id] === i ? 'selected' : ''}" onclick="selectOption('${q._id}', ${i})">
                                ${String.fromCharCode(65 + i)}. ${opt}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        updateButtons();
        renderQuestionMap();
    }

    window.selectOption = (qId, idx) => {
        userAnswers[qId] = idx;
        renderQuestion();
    };

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentIdx === questions.length - 1) {
                showConfirmModal();
                return;
            }
            currentIdx++;
            renderQuestion();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentIdx > 0) {
                currentIdx--;
                renderQuestion();
            }
        });
    }

    function updateButtons() {
        if (prevBtn) prevBtn.disabled = (currentIdx === 0);

        if (nextBtn) {
            if (currentIdx === questions.length - 1) {
                nextBtn.innerText = "Finish & Submit";
                nextBtn.style.backgroundColor = "#16a34a";
            } else {
                nextBtn.innerText = "Next";
                nextBtn.style.backgroundColor = "";
            }
        }
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            if (timerElement) timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            if (progressBar) progressBar.style.width = `${(timeLeft / 300) * 100}%`;

            if (timeLeft <= 60) {
                if (progressBar) progressBar.className = 'timer-progress danger';
                if (timerDisplay) timerDisplay.className = 'timer-display danger';
            } else if (timeLeft <= 120) {
                if (progressBar) progressBar.className = 'timer-progress warning';
                if (timerDisplay) timerDisplay.className = 'timer-display warning';
            }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                ui.showToast('Time is up! Submitting your answers.', 'info');
                submitExam();
            }
        }, 1000);
    }

    function showConfirmModal() {
        const unansweredCount = questions.filter(q => userAnswers[q._id] === undefined).length;
        const warnEl = document.getElementById('unanswered-warning');

        if (warnEl) {
            if (unansweredCount > 0) {
                warnEl.style.display = 'block';
                warnEl.innerHTML = `⚠️ You have <strong>${unansweredCount}</strong> unanswered question${unansweredCount > 1 ? 's' : ''}!`;
            } else {
                warnEl.style.display = 'none';
            }
        }

        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.add('active');
    }

    window.closeConfirmModal = () => {
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.remove('active');
    };

    window.confirmSubmit = () => {
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.remove('active');
        submitExam();
    };

    async function submitExam() {
        clearInterval(timerInterval);
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.innerText = "Submitting...";
        }

        const payload = {
            sessionId: sessionId,
            setId: localStorage.getItem('currentMCQSetId'),
            answers: userAnswers
        };

        try {
            const res = await fetch('/api/submit/excel-mcq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                window.location.href = `/results-new.html?sessionId=${sessionId}`;
            } else {
                ui.showToast('Submission failed. Please contact admin.', 'error');
            }
        } catch (err) {
            console.error(err);
        }
    }

    fetchQuestions();
});
