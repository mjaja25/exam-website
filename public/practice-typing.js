document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const token = localStorage.getItem('token');

    // --- Configuration State ---
    let selectedTime = 120;
    let selectedDiff = 'easy';
    let isTrueSim = false;

    // --- Active engine elements (set on launch) ---
    let passageDisplay, userInput, timerElement, wpmElement, accuracyElement, activeEngine;

    // --- DOM (config & results) ---
    const configView = document.getElementById('config-view');
    const decoratedEngine = document.getElementById('decorated-engine');
    const simEngine = document.getElementById('sim-engine');
    const trueSimCheck = document.getElementById('true-sim-check');
    const resultsView = document.getElementById('results-view');

    // Results elements
    const scoreRing = document.getElementById('score-ring');
    const scoreWpm = document.getElementById('score-wpm');
    const resultsTitle = document.getElementById('results-title');
    const statAccuracy = document.getElementById('stat-accuracy');
    const statChars = document.getElementById('stat-chars');
    const statCorrect = document.getElementById('stat-correct');
    const statErrors = document.getElementById('stat-errors');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analysisPanel = document.getElementById('analysis-panel');
    const analysisContent = document.getElementById('analysis-content');

    // --- Engine State ---
    let testInProgress = false;
    let sessionStartTime = null;
    let timerInterval = null;
    let currentPassage = '';
    let errorMap = {};
    let errorTrackedPositions = new Set();

    // --- JWT Helper ---
    function parseJwt(t) {
        try {
            const base64Url = t.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) { return null; }
    }

    // --- Config UI Helpers ---
    window.setTime = (seconds, btn) => {
        selectedTime = seconds;
        btn.parentElement.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    window.setDiff = (diff, btn) => {
        selectedDiff = diff;
        btn.parentElement.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    // ========================================================
    // LAUNCH — pick engine mode and bind elements
    // ========================================================
    window.launchPractice = async () => {
        isTrueSim = trueSimCheck.checked;
        configView.classList.add('hidden');

        if (isTrueSim) {
            simEngine.classList.remove('hidden');
            activeEngine = simEngine;
            passageDisplay = document.getElementById('sim-passage');
            userInput = document.getElementById('sim-input');
            timerElement = document.getElementById('sim-timer');
            wpmElement = document.getElementById('sim-wpm');
            accuracyElement = document.getElementById('sim-accuracy');
        } else {
            decoratedEngine.classList.remove('hidden');
            activeEngine = decoratedEngine;
            passageDisplay = document.getElementById('dec-passage');
            userInput = document.getElementById('dec-input');
            timerElement = document.getElementById('dec-timer');
            wpmElement = document.getElementById('dec-wpm');
            accuracyElement = document.getElementById('dec-accuracy');
        }

        // Set initial timer
        const mins = Math.floor(selectedTime / 60);
        const secs = selectedTime % 60;
        timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Bind input handler
        userInput.addEventListener('input', handleInput);

        // Lockdown input — disable paste, Ctrl+Backspace, drag
        lockdownInput(userInput);

        // Admin bypass
        setupAdminBypass();

        await loadPassage(selectedDiff);
    };

    // ========================================================
    // INPUT LOCKDOWN — emulate real exam restrictions
    // ========================================================
    function lockdownInput(textarea) {
        // Block paste
        textarea.addEventListener('paste', e => e.preventDefault());
        // Block cut
        textarea.addEventListener('cut', e => e.preventDefault());
        // Block drop (drag-and-drop text)
        textarea.addEventListener('drop', e => e.preventDefault());
        // Block Ctrl+Backspace (word delete), Ctrl+A (select all), Ctrl+Z (undo)
        textarea.addEventListener('keydown', e => {
            if (e.ctrlKey && (e.key === 'Backspace' || e.key === 'a' || e.key === 'z' || e.key === 'y')) {
                e.preventDefault();
            }
            // Block Delete key  
            if (e.key === 'Delete') {
                e.preventDefault();
            }
        });
        // Disable context menu (right-click paste)
        textarea.addEventListener('contextmenu', e => e.preventDefault());
    }

    // ========================================================
    // ADMIN BYPASS
    // ========================================================
    function setupAdminBypass() {
        if (!token) return;
        const payload = parseJwt(token);
        if (!payload || payload.role !== 'admin') return;

        const bypassId = isTrueSim ? 'sim-admin-bypass' : 'dec-admin-bypass';
        const btnId = isTrueSim ? 'sim-quick-submit' : 'dec-quick-submit';
        const bypassDiv = document.getElementById(bypassId);
        const bypassBtn = document.getElementById(btnId);

        if (bypassDiv) {
            bypassDiv.style.display = 'block';
            bypassBtn.addEventListener('click', () => {
                endPractice();
            });
        }
    }

    // ========================================================
    // LOAD PASSAGE
    // ========================================================
    async function loadPassage(difficulty) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/passages/random?difficulty=${difficulty}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Could not fetch passage.');
            const data = await res.json();
            currentPassage = data.content;

            passageDisplay.innerHTML = '';
            currentPassage.split('').forEach(char => {
                const charSpan = document.createElement('span');
                charSpan.innerText = char;
                passageDisplay.appendChild(charSpan);
            });
            passageDisplay.querySelector('span').classList.add('current');
            userInput.value = '';
            userInput.disabled = false;
            userInput.focus();
        } catch (err) {
            passageDisplay.innerText = 'Error loading passage. Please try again.';
            userInput.disabled = true;
        }
    }

    // ========================================================
    // INPUT HANDLER — character-by-character comparison
    // ========================================================
    function handleInput() {
        if (!testInProgress) startTimer();

        const passageChars = passageDisplay.querySelectorAll('span');
        const userChars = userInput.value.split('');
        const timeElapsedMinutes = (Date.now() - sessionStartTime) / 60000;
        let correctChars = 0;

        passageChars.forEach((charSpan, index) => {
            const userChar = userChars[index];
            charSpan.classList.remove('current');

            if (userChar == null) {
                charSpan.classList.remove('correct', 'incorrect');
            } else if (userChar === charSpan.innerText) {
                charSpan.classList.add('correct');
                charSpan.classList.remove('incorrect');
                correctChars++;
            } else {
                charSpan.classList.add('incorrect');
                charSpan.classList.remove('correct');
                // Track error — only once per position
                if (!errorTrackedPositions.has(index)) {
                    errorTrackedPositions.add(index);
                    const key = `'${charSpan.innerText}' → '${userChar}'`;
                    errorMap[key] = (errorMap[key] || 0) + 1;
                }
            }
        });

        // Live stats
        if (timeElapsedMinutes > 0) {
            const wpm = Math.round((userChars.length / 5) / timeElapsedMinutes);
            const acc = userChars.length > 0 ? Math.round((correctChars / userChars.length) * 100) : 100;
            wpmElement.textContent = wpm;
            accuracyElement.textContent = `${acc}%`;
        }

        // Current character highlight
        if (userChars.length < passageChars.length) {
            const nextCharSpan = passageChars[userChars.length];
            nextCharSpan.classList.add('current');
            nextCharSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // End if passage completed
        if (userChars.length >= passageChars.length) {
            endPractice();
        }
    }

    // ========================================================
    // TIMER
    // ========================================================
    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;
        sessionStartTime = Date.now();
        let timeLeft = selectedTime;

        timerInterval = setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (timeLeft < 30) {
                timerElement.classList.add('timer-danger');
            }

            if (timeLeft <= 0) {
                endPractice();
            }
        }, 1000);
    }

    // ========================================================
    // END PRACTICE
    // ========================================================
    function endPractice() {
        clearInterval(timerInterval);
        userInput.disabled = true;
        testInProgress = false;

        const timeElapsedMinutes = (Date.now() - sessionStartTime) / 60000;
        const totalTyped = userInput.value.length;
        const correctCount = passageDisplay.querySelectorAll('.correct').length;
        const errorCount = totalTyped - correctCount;

        const finalWpm = timeElapsedMinutes > 0 ? Math.round((totalTyped / 5) / timeElapsedMinutes) : 0;
        const finalAccuracy = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 100;

        showResults(finalWpm, finalAccuracy, totalTyped, correctCount, errorCount);
    }

    // ========================================================
    // SHOW RESULTS
    // ========================================================
    function showResults(wpm, accuracy, totalChars, correct, errors) {
        activeEngine.classList.add('hidden');
        resultsView.classList.add('active');

        // Animated WPM count-up
        const startTime = performance.now();
        const duration = 1200;
        const countUp = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            scoreWpm.textContent = Math.round(wpm * progress);
            if (progress < 1) requestAnimationFrame(countUp);
        };
        requestAnimationFrame(countUp);

        // Ring (80 WPM = full circle)
        const degrees = Math.min(360, (wpm / 80) * 360);
        requestAnimationFrame(() => {
            scoreRing.style.setProperty('--score-deg', degrees + 'deg');
        });

        // Title
        if (wpm >= 60) { resultsTitle.textContent = '🚀 Speed Demon!'; resultsTitle.style.color = '#4ade80'; }
        else if (wpm >= 40) { resultsTitle.textContent = '⚡ Great Speed!'; resultsTitle.style.color = '#f59e0b'; }
        else if (wpm >= 20) { resultsTitle.textContent = '👍 Getting There!'; resultsTitle.style.color = '#3b82f6'; }
        else { resultsTitle.textContent = '💪 Keep Practicing!'; resultsTitle.style.color = '#f87171'; }

        // Stats
        statAccuracy.textContent = `${accuracy}%`;
        statChars.textContent = totalChars;
        statCorrect.textContent = correct;
        statErrors.textContent = errors;

        // Store for AI
        analyzeBtn._metrics = { wpm, accuracy, totalChars, correctChars: correct, errorCount: errors };
    }

    // ========================================================
    // AI TYPING COACH (with finger drills)
    // ========================================================
    analyzeBtn.addEventListener('click', async () => {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Generating Coach Feedback...';

        const metrics = analyzeBtn._metrics;

        // Build error details
        let errorDetails = '';
        const sortedErrors = Object.entries(errorMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (sortedErrors.length > 0) {
            errorDetails = sortedErrors.map(([key, count]) => `- ${key} (${count} times)`).join('\n');
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/practice/typing-analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    wpm: metrics.wpm,
                    accuracy: metrics.accuracy,
                    totalChars: metrics.totalChars,
                    correctChars: metrics.correctChars,
                    errorCount: metrics.errorCount,
                    duration: selectedTime,
                    errorDetails: errorDetails
                })
            });

            if (!res.ok) throw new Error('Analysis failed');
            const data = await res.json();

            let formatted = data.analysis
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');

            analysisContent.innerHTML = formatted;
            analysisPanel.classList.add('active');
            analysisPanel.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            if (typeof showToast === 'function') showToast('Failed to generate analysis.', 'error');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🤖 Get AI Typing Coach';
        }
    });
});