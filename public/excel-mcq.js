document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId');

    let questions = [];
    let currentIdx = 0;
    let userAnswers = {}; // Stores { questionId: selectedIndex }
    let timeLeft = 300; // 5 minutes
    let timerInterval;

    const questionArea = document.getElementById('question-area');
    const timerElement = document.getElementById('mcq-timer');
    const timerDisplay = document.getElementById('timer-display');
    const progressBar = document.getElementById('mcq-progress');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const questionMap = document.getElementById('question-map');

    // 1. Fetch the Unseen Curated Set
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
            questionArea.innerHTML = `<div class="error">Error: ${err.message}. Please return to dashboard.</div>`;
        }
    }

    // 2. Render Question Map
    function renderQuestionMap() {
        if (!questionMap) return;
        questionMap.innerHTML = questions.map((q, i) => {
            let cls = 'map-circle';
            if (userAnswers[q._id] !== undefined) cls += ' answered';
            if (i === currentIdx) cls += ' current';
            return `<div class="${cls}" onclick="jumpToQuestion(${i})" title="Question ${i + 1}">${i + 1}</div>`;
        }).join('');
    }

    // 3. Jump to question from map
    window.jumpToQuestion = (idx) => {
        currentIdx = idx;
        renderQuestion();
        renderQuestionMap();
    };

    // 4. Render Question
    function renderQuestion() {
        const q = questions[currentIdx];

        if (!q) {
            questionArea.innerHTML = `<div class="error">Error: Question data is missing.</div>`;
            return;
        }

        const progressEl = document.getElementById('progress-text');
        if (progressEl) {
            progressEl.innerText = `Question ${currentIdx + 1} of ${questions.length}`;
        }

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

        updateButtons();
        renderQuestionMap();
    }

    // 5. Global selection handler
    window.selectOption = (qId, idx) => {
        userAnswers[qId] = idx;
        renderQuestion();
    };

    // 6. Navigation
    nextBtn.addEventListener('click', () => {
        // If on the LAST question, show confirmation dialog
        if (currentIdx === questions.length - 1) {
            showConfirmModal();
            return;
        }

        currentIdx++;
        renderQuestion();
    });

    prevBtn.addEventListener('click', () => {
        if (currentIdx > 0) {
            currentIdx--;
            renderQuestion();
        }
    });

    function updateButtons() {
        prevBtn.disabled = (currentIdx === 0);

        if (currentIdx === questions.length - 1) {
            nextBtn.innerText = "Finish & Submit";
            nextBtn.style.backgroundColor = "#16a34a";
        } else {
            nextBtn.innerText = "Next";
            nextBtn.style.backgroundColor = "";
        }
    }

    // 7. Timer Logic with warnings
    function startTimer() {
        timerInterval = setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            progressBar.style.width = `${(timeLeft / 300) * 100}%`;

            // Timer color warnings
            if (timeLeft <= 60) {
                progressBar.className = 'timer-progress danger';
                timerDisplay.className = 'timer-display danger';
            } else if (timeLeft <= 120) {
                progressBar.className = 'timer-progress warning';
                timerDisplay.className = 'timer-display warning';
            }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                if (typeof showToast === 'function') showToast('Time is up! Submitting your answers.', 'info');
                submitExam();
            }
        }, 1000);
    }

    // 8. Confirmation Modal
    function showConfirmModal() {
        const unansweredCount = questions.filter(q => userAnswers[q._id] === undefined).length;
        const warnEl = document.getElementById('unanswered-warning');

        if (unansweredCount > 0) {
            warnEl.style.display = 'block';
            warnEl.innerHTML = `⚠️ You have <strong>${unansweredCount}</strong> unanswered question${unansweredCount > 1 ? 's' : ''}!`;
        } else {
            warnEl.style.display = 'none';
        }

        document.getElementById('confirm-modal').classList.add('active');
    }

    window.closeConfirmModal = () => {
        document.getElementById('confirm-modal').classList.remove('active');
    };

    window.confirmSubmit = () => {
        document.getElementById('confirm-modal').classList.remove('active');
        submitExam();
    };

    // 9. Submit Results
    async function submitExam() {
        clearInterval(timerInterval);
        nextBtn.disabled = true;
        nextBtn.innerText = "Submitting...";

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
                window.location.href = '/results-new.html';
            } else {
                if (typeof showToast === 'function') showToast('Submission failed. Please contact admin.', 'error');
            }
        } catch (err) {
            console.error(err);
        }
    }

    fetchQuestions();
});