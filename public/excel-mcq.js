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
    const progressBar = document.getElementById('mcq-progress');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');

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
            renderQuestion();
            startTimer();
        } catch (err) {
            questionArea.innerHTML = `<div class="error">Error: ${err.message}. Please return to dashboard.</div>`;
        }
    }

    // 2. Render Question
    function renderQuestion() {
        const q = questions[currentIdx];

        // Safety check: if questions didn't load properly
        if (!q) {
            questionArea.innerHTML = `<div class="error">Error: Question data is missing.</div>`;
            return;
        }

        // Check if progress-text exists before setting text
        const progressEl = document.getElementById('progress-text');
        if (progressEl) {
            progressEl.innerText = `Question ${currentIdx + 1} of 10`;
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

        // Only update buttons if they were found in the HTML
        if (prevBtn) prevBtn.disabled = currentIdx === 0;
        if (nextBtn) {
            nextBtn.innerText = currentIdx === 9 ? 'Finish Exam' : 'Next Question';
        }
        // ADD THIS LINE AT THE END:
        updateButtons();
    }

    // 3. Global selection handler (attached to window for onclick)
    window.selectOption = (qId, idx) => {
        userAnswers[qId] = idx;
        renderQuestion();
    };

    // 4. Navigation
    nextBtn.addEventListener('click', () => {
        // A. If we are on the LAST question, this button acts as "Submit"
        if (currentIdx === questions.length - 1) {
            const hasAnswered = userAnswers[questions[currentIdx]._id] !== undefined;
            if (!hasAnswered) {
                if (typeof showToast === 'function') showToast('Please select an answer before submitting.', 'info');
                return;
            }
            // >>> THIS CALLS THE API <<<
            submitExam();
            return;
        }

        // B. Otherwise, it just goes to the next question
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
        // Disable Previous on first slide
        prevBtn.disabled = (currentIdx === 0);

        // Change Next to "Finish" on last slide
        if (currentIdx === questions.length - 1) {
            nextBtn.innerText = "Finish & Submit";
            nextBtn.style.backgroundColor = "#16a34a"; // Green color
        } else {
            nextBtn.innerText = "Next";
            nextBtn.style.backgroundColor = ""; // Reset color
        }
    }

    // 5. Timer Logic
    function startTimer() {
        timerInterval = setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            progressBar.style.width = `${(timeLeft / 300) * 100}%`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                if (typeof showToast === 'function') showToast('Time is up! Submitting your answers.', 'info');
                submitExam();
            }
        }, 1000);
    }

    // 6. Submit Results
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