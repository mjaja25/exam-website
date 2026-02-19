import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = auth.getToken();

    const timerElement = document.getElementById('timer');
    const questionDisplay = document.getElementById('question-display');
    const userInputElement = document.getElementById('user-input');
    const submitBtn = document.getElementById('submit-btn');
    const testView = document.getElementById('test-view');
    const resultsView = document.getElementById('results-view');
    const loadingOverlay = document.getElementById('loading-overlay');

    const scoreRing = document.getElementById('score-ring');
    const scoreValue = document.getElementById('score-value');
    const resultsTitle = document.getElementById('results-title');
    const breakdownGrid = document.getElementById('breakdown-grid');
    const analyzeBtn = document.getElementById('analyze-btn');
    const reviewBtn = document.getElementById('review-btn');
    const analysisPanel = document.getElementById('analysis-panel');
    const analysisContent = document.getElementById('analysis-content');
    const reviewPanel = document.getElementById('review-panel');
    const reviewContent = document.getElementById('review-content');

    let currentQuestionId = null;
    let timerInterval = null;
    let savedContent = '';
    let savedFeedback = '';

    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeSelect = document.getElementById('font-size-select');

    if (boldBtn) boldBtn.addEventListener('click', () => document.execCommand('bold'));
    if (italicBtn) italicBtn.addEventListener('click', () => document.execCommand('italic'));
    if (underlineBtn) underlineBtn.addEventListener('click', () => document.execCommand('underline'));
    if (fontFamilySelect) fontFamilySelect.addEventListener('change', (e) => document.execCommand('fontName', false, e.target.value));
    if (fontSizeSelect) fontSizeSelect.addEventListener('change', (e) => document.execCommand('fontSize', false, e.target.value));

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            const allowed = ['b', 'i', 'u'];
            if (!allowed.includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        }
    });

    if (userInputElement) {
        userInputElement.addEventListener('keydown', (event) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const range = selection.getRangeAt(0);

            if (event.key === 'Tab') {
                event.preventDefault();
                const indentSpan = document.createElement('span');
                indentSpan.className = 'editor-indent';
                indentSpan.contentEditable = 'false';
                indentSpan.textContent = '    ';
                range.insertNode(indentSpan);
                range.setStartAfter(indentSpan);
                range.setEndAfter(indentSpan);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            if (event.key === 'Backspace') {
                const node = range.startContainer;
                const offset = range.startOffset;
                if (node.nodeType === Node.TEXT_NODE && offset === 0 && node.previousSibling?.classList?.contains('editor-indent')) {
                    event.preventDefault();
                    node.previousSibling.remove();
                }
            }
        });

        ['paste', 'copy', 'cut'].forEach(eventType => {
            userInputElement.addEventListener(eventType, (e) => e.preventDefault());
        });
    }

    async function loadQuestion() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/letter-questions/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Could not fetch question.');
            const question = await res.json();
            if (questionDisplay) questionDisplay.textContent = question.questionText;
            currentQuestionId = question._id;
            if (userInputElement) userInputElement.focus();
            startTimer();
        } catch (err) {
            if (questionDisplay) questionDisplay.textContent = 'Error: No letter questions available. Please add questions in the admin panel.';
            if (submitBtn) submitBtn.disabled = true;
        }
    }

    function startTimer() {
        const timerSelect = document.getElementById('timer-select');
        let timeLeft = timerSelect ? parseInt(timerSelect.value) : 180;
        
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

                if (timeLeft < 30 && timerElement) {
                    timerElement.classList.add('timer-danger');
                }

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    submitLetter();
                }
            }, 1000);
        }
    }

    async function submitLetter() {
        clearInterval(timerInterval);
        if (submitBtn) submitBtn.disabled = true;
        if (userInputElement) userInputElement.contentEditable = false;
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        savedContent = userInputElement?.innerHTML || '';

        try {
            const res = await fetch(`${API_BASE_URL}/api/practice/letter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    content: savedContent,
                    questionId: currentQuestionId
                })
            });

            if (!res.ok) throw new Error('Submission failed');
            const data = await res.json();

            savedFeedback = data.breakdown.map(b => `${b.label}: ${b.score}/${b.max} - ${b.explanation}`).join('\n');

            showResults(data);
        } catch (err) {
            console.error('Practice Letter Error:', err);
            ui.showToast('An error occurred while grading. Please try again.', 'error');
            if (submitBtn) submitBtn.disabled = false;
            if (userInputElement) userInputElement.contentEditable = true;
        } finally {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
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
            if (score >= 8) { resultsTitle.textContent = '🌟 Excellent!'; resultsTitle.style.color = '#4ade80'; }
            else if (score >= 5) { resultsTitle.textContent = '👍 Good Effort!'; resultsTitle.style.color = '#f59e0b'; }
            else { resultsTitle.textContent = '💪 Keep Practicing!'; resultsTitle.style.color = '#f87171'; }
        }

        if (breakdownGrid) {
            breakdownGrid.innerHTML = data.breakdown.map(item => `
                <div class="breakdown-item" style="animation: fadeInUp 0.5s ease-out both;">
                    <div>
                        <div class="label">${item.label}</div>
                        <div class="explanation">${item.explanation}</div>
                    </div>
                    <div class="score-badge">${item.score}/${item.max}</div>
                </div>
            `).join('');
        }

        // Show sample answer button if available
        const sampleAnswerBtn = document.getElementById('sample-answer-btn');
        const sampleAnswerPanel = document.getElementById('sample-answer-panel');
        const sampleAnswerContent = document.getElementById('sample-answer-content');
        if (data.sampleAnswer && sampleAnswerBtn) {
            sampleAnswerBtn.style.display = '';
            sampleAnswerBtn.onclick = () => {
                if (sampleAnswerPanel) {
                    sampleAnswerPanel.classList.toggle('active');
                    if (sampleAnswerContent) sampleAnswerContent.textContent = data.sampleAnswer;
                    sampleAnswerPanel.scrollIntoView({ behavior: 'smooth' });
                }
            };
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
                        type: 'letter',
                        content: savedContent,
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

    if (reviewBtn && reviewPanel && reviewContent) {
        reviewBtn.addEventListener('click', () => {
            reviewPanel.classList.toggle('active');
            if (reviewPanel.classList.contains('active')) {
                reviewContent.innerHTML = savedContent;
                reviewPanel.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Retry same question — reset editor and timer, keep same questionId
    const retrySameBtn = document.getElementById('retry-same-btn');
    if (retrySameBtn) {
        retrySameBtn.addEventListener('click', () => {
            resetToTestView();
            // currentQuestionId stays the same
            if (userInputElement) userInputElement.focus();
            startTimer();
        });
    }

    // New question — load a fresh random question
    const newQuestionBtn = document.getElementById('new-question-btn');
    if (newQuestionBtn) {
        newQuestionBtn.addEventListener('click', () => {
            resetToTestView();
            loadQuestion();
        });
    }

    function resetToTestView() {
        clearInterval(timerInterval);
        if (resultsView) resultsView.classList.remove('active');
        if (testView) testView.style.display = '';
        if (userInputElement) {
            userInputElement.innerHTML = '';
            userInputElement.contentEditable = 'true';
        }
        if (submitBtn) submitBtn.disabled = false;
        savedContent = '';
        savedFeedback = '';
        // Reset analysis/review panels
        if (analysisPanel) analysisPanel.classList.remove('active');
        if (reviewPanel) reviewPanel.classList.remove('active');
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Get Detailed AI Analysis';
        }
        // Reset timer display
        if (timerElement) {
            timerElement.textContent = '03:00';
            timerElement.classList.remove('timer-danger');
        }
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', submitLetter);
    }

    loadQuestion();
});
