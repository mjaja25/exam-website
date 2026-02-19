import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = auth.getToken();

    const timerElement = document.getElementById('timer');
    const questionNameElement = document.getElementById('question-name');
    const downloadBtn = document.getElementById('download-btn');
    const excelForm = document.getElementById('excel-form');
    const fileInput = document.getElementById('excel-file');
    const testView = document.getElementById('test-view');
    const resultsView = document.getElementById('results-view');
    const loadingOverlay = document.getElementById('loading-overlay');

    const scoreRing = document.getElementById('score-ring');
    const scoreValue = document.getElementById('score-value');
    const resultsTitle = document.getElementById('results-title');
    const feedbackContent = document.getElementById('feedback-content');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analysisPanel = document.getElementById('analysis-panel');
    const analysisContent = document.getElementById('analysis-content');

    let currentQuestionId = null;
    let timerInterval = null;
    let savedFeedback = '';
    let allHints = [];
    let hintsRevealed = 0;

    const hintArea = document.getElementById('hint-area');
    const hintsRevealedEl = document.getElementById('hints-revealed');
    const getHintBtn = document.getElementById('get-hint-btn');

    async function loadQuestion() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/excel-questions/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Could not fetch question.');
            const question = await res.json();

            if (questionNameElement) questionNameElement.textContent = question.questionName;
            if (downloadBtn) {
                downloadBtn.href = question.questionFilePath;
                downloadBtn.removeAttribute('disabled');
            }
            currentQuestionId = question._id;

            // Fetch hints for this question
            try {
                const hintRes = await fetch(`${API_BASE_URL}/api/practice/excel-hints/${question._id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (hintRes.ok) {
                    const hintData = await hintRes.json();
                    allHints = hintData.hints || [];
                    if (allHints.length > 0 && hintArea) {
                        hintArea.style.display = '';
                    }
                }
            } catch (_) { /* hints optional */ }

            startTimer();
        } catch (err) {
            if (questionNameElement) questionNameElement.textContent = 'Error: No Excel questions available. Add questions in the admin panel.';
            if (downloadBtn) downloadBtn.textContent = 'Unavailable';
        }
    }

    if (getHintBtn) {
        getHintBtn.addEventListener('click', () => {
            if (hintsRevealed >= allHints.length) {
                ui.showToast('No more hints available.', 'info');
                return;
            }
            const hint = allHints[hintsRevealed];
            hintsRevealed++;
            if (hintsRevealedEl) {
                const hintEl = document.createElement('div');
                hintEl.className = 'coach-card coach-card-blue';
                hintEl.style.marginBottom = '0.5rem';
                hintEl.innerHTML = `<strong>Hint ${hintsRevealed}:</strong> ${hint}`;
                hintsRevealedEl.appendChild(hintEl);
            }
            if (hintsRevealed >= allHints.length && getHintBtn) {
                getHintBtn.disabled = true;
                getHintBtn.textContent = 'No more hints';
            }
            ui.showToast(`Hint revealed (-1 point penalty)`, 'info');
        });
    }

    function startTimer() {
        const timerSelect = document.getElementById('timer-select');
        let timeLeft = timerSelect ? parseInt(timerSelect.value) : 420;
        
        // If no limit selected (0), don't start timer
        if (timeLeft === 0) {
            if (timerElement) timerElement.textContent = '∞';
            return;
        }
        
        if (timerElement) {
            // Update initial display
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            timerInterval = setInterval(() => {
                timeLeft--;
                const mins = Math.floor(timeLeft / 60);
                const secs = timeLeft % 60;
                timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                if (timeLeft < 30) {
                    timerElement.classList.add('timer-danger');
                }

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    if (fileInput && fileInput.files.length > 0) {
                        excelForm?.requestSubmit();
                    } else {
                        ui.showToast('Time is up! No file was uploaded.', 'info');
                        showNoSubmissionResult();
                    }
                }
            }, 1000);
        }
    }

    function showNoSubmissionResult() {
        if (testView) testView.style.display = 'none';
        if (resultsView) resultsView.classList.add('active');
        if (resultsTitle) {
            resultsTitle.textContent = '⏰ Time Expired';
            resultsTitle.style.color = '#f87171';
        }
        if (scoreValue) scoreValue.textContent = '0';
        if (feedbackContent) feedbackContent.textContent = 'No file was uploaded before the timer expired. Try again!';
        if (analyzeBtn) analyzeBtn.style.display = 'none';
    }

    if (excelForm) {
        excelForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearInterval(timerInterval);

            const submitButton = excelForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;
            if (loadingOverlay) loadingOverlay.style.display = 'flex';

            const formData = new FormData();
            formData.append('excelFile', fileInput?.files[0]);
            formData.append('questionId', currentQuestionId);
            formData.append('hintsUsed', hintsRevealed);

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
                ui.showToast('File upload or grading failed. Please try again.', 'error');
                if (submitButton) submitButton.disabled = false;
            } finally {
                if (loadingOverlay) loadingOverlay.style.display = 'none';
            }
        });
    }

    function showResults(data) {
        if (testView) testView.style.display = 'none';
        if (resultsView) resultsView.classList.add('active');

        const score = data.score;
        const maxScore = data.maxScore;

        const startTime = performance.now();
        const duration = 1200;
        const countUp = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            if (scoreValue) scoreValue.textContent = Math.round(score * progress);
            if (progress < 1) requestAnimationFrame(countUp);
        };
        requestAnimationFrame(countUp);

        const degrees = (score / maxScore) * 360;
        if (scoreRing) {
            scoreRing.style.background = `conic-gradient(var(--primary-yellow, #f59e0b) var(--score-deg, 0deg), var(--border-color, #e2e8f0) var(--score-deg, 0deg))`;
            requestAnimationFrame(() => {
                scoreRing.style.setProperty('--score-deg', degrees + 'deg');
            });
        }

        if (resultsTitle) {
            if (score >= 16) { resultsTitle.textContent = '🌟 Excellent!'; resultsTitle.style.color = '#4ade80'; }
            else if (score >= 10) { resultsTitle.textContent = '👍 Good Effort!'; resultsTitle.style.color = '#f59e0b'; }
            else { resultsTitle.textContent = '💪 Keep Practicing!'; resultsTitle.style.color = '#f87171'; }
        }

        // Show hint penalty if any
        const hintPenaltyResult = document.getElementById('hint-penalty-result');
        if (hintPenaltyResult && data.hintPenalty > 0) {
            hintPenaltyResult.textContent = `(-${data.hintPenalty} point${data.hintPenalty > 1 ? 's' : ''} hint penalty applied)`;
            hintPenaltyResult.style.display = '';
        }

        // Show solution steps button if available
        const solutionStepsBtn = document.getElementById('solution-steps-btn');
        const solutionStepsPanel = document.getElementById('solution-steps-panel');
        const solutionStepsList = document.getElementById('solution-steps-list');
        if (data.solutionSteps && data.solutionSteps.length > 0 && solutionStepsBtn) {
            solutionStepsBtn.style.display = '';
            solutionStepsBtn.onclick = () => {
                if (solutionStepsPanel) {
                    solutionStepsPanel.classList.toggle('active');
                    if (solutionStepsList) {
                        solutionStepsList.innerHTML = data.solutionSteps.map(step => `<li>${step}</li>`).join('');
                    }
                    solutionStepsPanel.scrollIntoView({ behavior: 'smooth' });
                }
            };
        }

        if (feedbackContent) {
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
    }

    if (analyzeBtn) {
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

                    if (analysisContent) analysisContent.innerHTML = html;
                } else {
                    let formatted = (typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2))
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br>');
                    if (analysisContent) analysisContent.innerHTML = formatted;
                }

                if (analysisPanel) {
                    analysisPanel.classList.add('active');
                    analysisPanel.scrollIntoView({ behavior: 'smooth' });
                }
                analyzeBtn.textContent = '✅ Analysis Generated';

            } catch (err) {
                ui.showToast('Failed to generate analysis.', 'error');
                if (analyzeBtn) {
                    analyzeBtn.disabled = false;
                    analyzeBtn.textContent = '🔍 Get Detailed AI Analysis';
                }
            }
        });
    }

    loadQuestion();
});
