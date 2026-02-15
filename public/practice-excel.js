document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const token = localStorage.getItem('token');

    // --- DOM Elements ---
    const timerElement = document.getElementById('timer');
    const questionNameElement = document.getElementById('question-name');
    const downloadBtn = document.getElementById('download-btn');
    const excelForm = document.getElementById('excel-form');
    const fileInput = document.getElementById('excel-file');
    const testView = document.getElementById('test-view');
    const resultsView = document.getElementById('results-view');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Results elements
    const scoreRing = document.getElementById('score-ring');
    const scoreValue = document.getElementById('score-value');
    const resultsTitle = document.getElementById('results-title');
    const feedbackContent = document.getElementById('feedback-content');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analysisPanel = document.getElementById('analysis-panel');
    const analysisContent = document.getElementById('analysis-content');

    // --- State ---
    let currentQuestionId = null;
    let timerInterval = null;
    let savedFeedback = '';

    // --- Load Random Excel Question ---
    async function loadQuestion() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/excel-questions/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Could not fetch question.');
            const question = await res.json();

            questionNameElement.textContent = question.questionName;
            downloadBtn.href = question.questionFilePath;
            downloadBtn.removeAttribute('disabled');
            currentQuestionId = question._id;
            startTimer();
        } catch (err) {
            questionNameElement.textContent = 'Error: No Excel questions available. Add questions in the admin panel.';
            downloadBtn.textContent = 'Unavailable';
        }
    }

    // --- Timer (7 minutes = 420 seconds) ---
    function startTimer() {
        let timeLeft = 420;
        timerInterval = setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            // Timer pulse effect at < 30 seconds
            if (timeLeft < 30) {
                timerElement.classList.add('timer-danger');
            }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                if (fileInput.files.length > 0) {
                    excelForm.requestSubmit();
                } else {
                    if (typeof showToast === 'function') showToast('Time is up! No file was uploaded.', 'info');
                    showNoSubmissionResult();
                }
            }
        }, 1000);
    }

    // --- If timer expires with no file ---
    function showNoSubmissionResult() {
        testView.style.display = 'none';
        resultsView.classList.add('active');
        resultsTitle.textContent = '⏰ Time Expired';
        resultsTitle.style.color = '#f87171';
        scoreValue.textContent = '0';
        feedbackContent.textContent = 'No file was uploaded before the timer expired. Try again!';
        analyzeBtn.style.display = 'none';
    }

    // --- Form Submission ---
    excelForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearInterval(timerInterval);

        const submitButton = excelForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        loadingOverlay.style.display = 'flex';

        const formData = new FormData();
        formData.append('excelFile', fileInput.files[0]);
        formData.append('questionId', currentQuestionId);

        try {
            const res = await fetch(`${API_BASE_URL}/api/practice/excel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error('Submission failed');
            const data = await res.json();

            savedFeedback = data.feedback;
            showResults(data);
        } catch (err) {
            console.error('Practice Excel Error:', err);
            if (typeof showToast === 'function') showToast('File upload or grading failed. Please try again.', 'error');
            submitButton.disabled = false;
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });

    // --- Show Results ---
    function showResults(data) {
        testView.style.display = 'none';
        resultsView.classList.add('active');

        const score = data.score;
        const maxScore = data.maxScore;

        // Animated count-up
        const startTime = performance.now();
        const duration = 1200;
        const countUp = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            scoreValue.textContent = Math.round(score * progress);
            if (progress < 1) requestAnimationFrame(countUp);
        };
        requestAnimationFrame(countUp);

        // Animated ring
        const degrees = (score / maxScore) * 360;
        scoreRing.style.background = `conic-gradient(var(--primary-yellow, #f59e0b) var(--score-deg, 0deg), var(--border-color, #e2e8f0) var(--score-deg, 0deg))`;
        requestAnimationFrame(() => {
            scoreRing.style.setProperty('--score-deg', degrees + 'deg');
        });

        // Title color
        if (score >= 16) { resultsTitle.textContent = '🌟 Excellent!'; resultsTitle.style.color = '#4ade80'; }
        else if (score >= 10) { resultsTitle.textContent = '👍 Good Effort!'; resultsTitle.style.color = '#f59e0b'; }
        else { resultsTitle.textContent = '💪 Keep Practicing!'; resultsTitle.style.color = '#f87171'; }

        // Feedback — render as styled cards
        const lines = data.feedback
            .replace(/\\n/g, '\n')
            .split(/\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0);

        let feedbackHtml = '';
        lines.forEach(line => {
            const numMatch = line.match(/^(\d+)\.\s*(.*)/);
            if (numMatch) {
                const isCorrect = /correct|right|good|well done|yes/i.test(numMatch[2]) && !/incorrect|wrong|not correct/i.test(numMatch[2]);
                feedbackHtml += `<div class="coach-card ${isCorrect ? 'coach-card-green' : 'coach-card-amber'}" style="margin-bottom:0.5rem;"><strong>${numMatch[1]}.</strong> ${numMatch[2]}</div>`;
            } else {
                feedbackHtml += `<div class="coach-card coach-card-blue" style="margin-bottom:0.5rem;">${line}</div>`;
            }
        });
        feedbackContent.innerHTML = feedbackHtml;
    }

    // --- Detailed AI Analysis ---
    analyzeBtn.addEventListener('click', async () => {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Generating Analysis...';

        try {
            const res = await fetch(`${API_BASE_URL}/api/practice/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: 'excel',
                    questionId: currentQuestionId,
                    previousFeedback: savedFeedback
                })
            });

            if (!res.ok) throw new Error('Analysis failed');
            const data = await res.json();

            if (data.structured && typeof data.analysis === 'object') {
                const a = data.analysis;
                let html = '';

                if (a.strengths?.length) {
                    html += '<div class="coach-section"><h4 class="coach-heading coach-green">✅ What You Did Well</h4>';
                    a.strengths.forEach(s => {
                        html += `<div class="coach-card coach-card-green"><strong>${s.title}</strong><p>${s.detail}</p></div>`;
                    });
                    html += '</div>';
                }

                if (a.improvements?.length) {
                    html += '<div class="coach-section"><h4 class="coach-heading coach-amber">⚠️ Areas for Improvement</h4>';
                    a.improvements.forEach(s => {
                        html += `<div class="coach-card coach-card-amber"><strong>${s.title}</strong><p>${s.detail}</p>`;
                        if (s.suggestion) html += `<div class="coach-suggestion">💡 ${s.suggestion}</div>`;
                        html += '</div>';
                    });
                    html += '</div>';
                }

                if (a.tips?.length) {
                    html += '<div class="coach-section"><h4 class="coach-heading coach-blue">🎯 Pro Tips</h4><div class="coach-tips-grid">';
                    a.tips.forEach(t => {
                        html += `<div class="coach-card coach-card-blue">${t.text}</div>`;
                    });
                    html += '</div></div>';
                }

                const extra = a.sampleStructure || a.keyConcepts;
                if (extra) {
                    html += `<div class="coach-section"><h4 class="coach-heading coach-purple">📋 ${a.sampleStructure ? 'Sample Structure' : 'Key Concepts'}</h4>`;
                    html += `<div class="coach-card coach-card-purple" style="white-space:pre-wrap;font-family:monospace;font-size:0.9rem;">${extra}</div></div>`;
                }

                analysisContent.innerHTML = html;
            } else {
                let formatted = (typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2))
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br>');
                analysisContent.innerHTML = formatted;
            }

            analysisPanel.classList.add('active');
            analysisPanel.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            if (typeof showToast === 'function') showToast('Failed to generate analysis.', 'error');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 Get Detailed AI Analysis';
        }
    });

    // --- Init ---
    loadQuestion();
});
