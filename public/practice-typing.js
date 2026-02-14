document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const token = localStorage.getItem('token');

    // --- Configuration State ---
    let selectedTime = 120; // Default 2 mins
    let selectedDiff = 'easy';

    // --- DOM Elements ---
    const configView = document.getElementById('config-view');
    const engineView = document.getElementById('practice-engine');
    const passageDisplay = document.getElementById('passage-display');
    const userInput = document.getElementById('user-input');
    const timerElement = document.getElementById('timer');
    const wpmElement = document.getElementById('wpm');
    const accuracyElement = document.getElementById('accuracy');
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
    let errorMap = {}; // Track which chars are mistyped { 'expected->typed': count }

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

    // --- Launch Function ---
    window.launchPractice = async () => {
        configView.classList.add('hidden');
        engineView.classList.remove('hidden');

        // Set initial timer display
        const mins = Math.floor(selectedTime / 60);
        const secs = selectedTime % 60;
        timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        await loadPassage(selectedDiff);
    };

    // --- Load Passage ---
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

    // --- Input Handler (character-by-character comparison) ---
    userInput.addEventListener('input', handleInput);

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
                // Track error pattern
                const key = `'${charSpan.innerText}' → '${userChar}'`;
                errorMap[key] = (errorMap[key] || 0) + 1;
            }
        });

        // Update live stats
        if (timeElapsedMinutes > 0) {
            const wpm = Math.round((userChars.length / 5) / timeElapsedMinutes);
            const acc = userChars.length > 0 ? Math.round((correctChars / userChars.length) * 100) : 100;
            wpmElement.textContent = wpm;
            accuracyElement.textContent = `${acc}%`;
        }

        // Scroll current character into view
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

    // --- Timer ---
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

            // Timer pulse at < 30 seconds
            if (timeLeft < 30) {
                timerElement.classList.add('timer-danger');
            }

            if (timeLeft <= 0) {
                endPractice();
            }
        }, 1000);
    }

    // --- End Practice ---
    function endPractice() {
        clearInterval(timerInterval);
        userInput.disabled = true;
        testInProgress = false;

        const timeElapsedMinutes = (Date.now() - sessionStartTime) / 60000;
        const passageChars = passageDisplay.querySelectorAll('span');
        const totalTyped = userInput.value.length;
        const correctCount = passageDisplay.querySelectorAll('.correct').length;
        const errorCount = totalTyped - correctCount;

        const finalWpm = timeElapsedMinutes > 0 ? Math.round((totalTyped / 5) / timeElapsedMinutes) : 0;
        const finalAccuracy = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 100;

        showResults(finalWpm, finalAccuracy, totalTyped, correctCount, errorCount);
    }

    // --- Show Results ---
    function showResults(wpm, accuracy, totalChars, correct, errors) {
        engineView.classList.add('hidden');
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

        // Animated ring — scale WPM to 360deg (80 WPM = full circle)
        const degrees = Math.min(360, (wpm / 80) * 360);
        scoreRing.style.background = `conic-gradient(var(--primary-yellow, #f59e0b) var(--score-deg, 0deg), var(--border-color, #e2e8f0) var(--score-deg, 0deg))`;
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

        // Store metrics for AI analysis
        analyzeBtn._metrics = { wpm, accuracy, totalChars, correctChars: correct, errorCount: errors };
    }

    // --- AI Typing Coach ---
    analyzeBtn.addEventListener('click', async () => {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Generating Coach Feedback...';

        const metrics = analyzeBtn._metrics;

        // Build error details string
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