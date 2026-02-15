document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const token = localStorage.getItem('token');

    // --- DOM Elements ---
    const timerElement = document.getElementById('timer');
    const questionDisplay = document.getElementById('question-display');
    const userInputElement = document.getElementById('user-input');
    const submitBtn = document.getElementById('submit-btn');
    const testView = document.getElementById('test-view');
    const resultsView = document.getElementById('results-view');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Results elements
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

    // --- State ---
    let currentQuestionId = null;
    let timerInterval = null;
    let savedContent = '';
    let savedFeedback = '';

    // --- Editor Toolbar ---
    document.getElementById('bold-btn').addEventListener('click', () => document.execCommand('bold'));
    document.getElementById('italic-btn').addEventListener('click', () => document.execCommand('italic'));
    document.getElementById('underline-btn').addEventListener('click', () => document.execCommand('underline'));
    document.getElementById('font-family-select').addEventListener('change', (e) => document.execCommand('fontName', false, e.target.value));
    document.getElementById('font-size-select').addEventListener('change', (e) => document.execCommand('fontSize', false, e.target.value));

    // --- Block Ctrl shortcuts (except B, I, U for formatting) ---
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            const allowed = ['b', 'i', 'u'];
            if (!allowed.includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        }
    });

    // --- Tab / Indent handling (copied from letter.js) ---
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

    // Prevent copy-paste
    ['paste', 'copy', 'cut'].forEach(eventType => {
        userInputElement.addEventListener(eventType, (e) => e.preventDefault());
    });

    // --- Load Random Question ---
    async function loadQuestion() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/letter-questions/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Could not fetch question.');
            const question = await res.json();
            questionDisplay.textContent = question.questionText;
            currentQuestionId = question._id;
            userInputElement.focus();
            startTimer();
        } catch (err) {
            questionDisplay.textContent = 'Error: No letter questions available. Please add questions in the admin panel.';
            submitBtn.disabled = true;
        }
    }

    // --- Timer (3 minutes = 180 seconds) ---
    function startTimer() {
        let timeLeft = 180;
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
                submitLetter();
            }
        }, 1000);
    }

    // --- Submit for AI Grading ---
    async function submitLetter() {
        clearInterval(timerInterval);
        submitBtn.disabled = true;
        userInputElement.contentEditable = false;
        loadingOverlay.style.display = 'flex';

        savedContent = userInputElement.innerHTML;

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

            // Build feedback string for later analysis
            savedFeedback = data.breakdown.map(b => `${b.label}: ${b.score}/${b.max} - ${b.explanation}`).join('\n');

            showResults(data);
        } catch (err) {
            console.error('Practice Letter Error:', err);
            if (typeof showToast === 'function') showToast('An error occurred while grading. Please try again.', 'error');
            submitBtn.disabled = false;
            userInputElement.contentEditable = true;
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

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
        if (score >= 8) { resultsTitle.textContent = '🌟 Excellent!'; resultsTitle.style.color = '#4ade80'; }
        else if (score >= 5) { resultsTitle.textContent = '👍 Good Effort!'; resultsTitle.style.color = '#f59e0b'; }
        else { resultsTitle.textContent = '💪 Keep Practicing!'; resultsTitle.style.color = '#f87171'; }

        // Breakdown
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

                // Strengths
                if (a.strengths?.length) {
                    html += '<div class="coach-section"><h4 class="coach-heading coach-green">✅ What You Did Well</h4>';
                    a.strengths.forEach(s => {
                        html += `<div class="coach-card coach-card-green"><strong>${s.title}</strong><p>${s.detail}</p></div>`;
                    });
                    html += '</div>';
                }

                // Improvements
                if (a.improvements?.length) {
                    html += '<div class="coach-section"><h4 class="coach-heading coach-amber">⚠️ Areas for Improvement</h4>';
                    a.improvements.forEach(s => {
                        html += `<div class="coach-card coach-card-amber"><strong>${s.title}</strong><p>${s.detail}</p>`;
                        if (s.suggestion) html += `<div class="coach-suggestion">💡 ${s.suggestion}</div>`;
                        html += '</div>';
                    });
                    html += '</div>';
                }

                // Tips
                if (a.tips?.length) {
                    html += '<div class="coach-section"><h4 class="coach-heading coach-blue">🎯 Pro Tips</h4><div class="coach-tips-grid">';
                    a.tips.forEach(t => {
                        html += `<div class="coach-card coach-card-blue">${t.text}</div>`;
                    });
                    html += '</div></div>';
                }

                // Sample Structure or Key Concepts
                const extra = a.sampleStructure || a.keyConcepts;
                if (extra) {
                    html += `<div class="coach-section"><h4 class="coach-heading coach-purple">📋 ${a.sampleStructure ? 'Sample Structure' : 'Key Concepts'}</h4>`;
                    html += `<div class="coach-card coach-card-purple" style="white-space:pre-wrap;font-family:monospace;font-size:0.9rem;">${extra}</div></div>`;
                }

                analysisContent.innerHTML = html;
            } else {
                // Fallback: render as formatted text
                let formatted = (typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2))
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br>');
                analysisContent.innerHTML = formatted;
            }

            analysisPanel.classList.add('active');
            analysisPanel.scrollIntoView({ behavior: 'smooth' });
            analyzeBtn.textContent = '✅ Analysis Generated';

        } catch (err) {
            if (typeof showToast === 'function') showToast('Failed to generate analysis.', 'error');
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 Get Detailed AI Analysis';
        }
    });

    // --- Review Letter ---
    reviewBtn.addEventListener('click', () => {
        reviewPanel.classList.toggle('active');
        if (reviewPanel.classList.contains('active')) {
            reviewContent.innerHTML = savedContent;
            reviewPanel.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // --- Event Listeners & Init ---
    submitBtn.addEventListener('click', submitLetter);
    loadQuestion();
});
