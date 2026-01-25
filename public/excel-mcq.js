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
        // Update display to show 10
        document.getElementById('progress-text').innerText = `Question ${currentIdx + 1} of 10`;
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

        prevBtn.disabled = currentIdx === 0;
        // Finish button appears at the 10th question
        nextBtn.innerText = currentIdx === 9 ? 'Finish Exam' : 'Next Question';
    }

    // 3. Global selection handler (attached to window for onclick)
    window.selectOption = (qId, idx) => {
        userAnswers[qId] = idx;
        renderQuestion();
    };

    // 4. Navigation
    nextBtn.onclick = () => {
        if (currentIdx < questions.length - 1) {
            currentIdx++;
            renderQuestion();
        } else {
            submitExam();
        }
    };

    prevBtn.onclick = () => {
        if (currentIdx > 0) {
            currentIdx--;
            renderQuestion();
        }
    };

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
                alert("Time is up! Submitting your answers.");
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
                window.location.href = '/results.html';
            } else {
                alert("Submission failed. Please contact admin.");
            }
        } catch (err) {
            console.error(err);
        }
    }

    fetchQuestions();
});