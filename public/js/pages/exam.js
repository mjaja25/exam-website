import { auth } from '../utils/auth.js';
import { client } from '../api/client.js';
import { TypingEngine } from '../core/TypingEngine.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Check
    if (!auth.getToken()) {
        window.location.href = '/login.html';
        return;
    }

    // 2. Setup Elements
    const elements = {
        timerElement: document.getElementById('timer'),
        mobileTimerElement: document.getElementById('mobile-timer'),
        progressBar: document.getElementById('progress-bar'),
        wpmElement: document.getElementById('wpm'),
        accuracyElement: document.getElementById('accuracy'),
        passageDisplayElement: document.getElementById('passage-display'),
        userInputElement: document.getElementById('user-input')
    };

    // 3. State
    const currentPattern = localStorage.getItem('currentExamPattern');
    const attemptMode = localStorage.getItem('currentAttemptMode'); // 'exam' or 'practice'

    // 4. Load Config & Initialize
    initExam();

    async function initExam() {
        let duration = 300; // Fallback

        try {
            const config = await client.get('/api/settings/public');
            if (currentPattern === 'new_pattern') {
                duration = config.typingDurationNew;
            } else {
                duration = config.typingDuration;
            }
        } catch (err) {
            console.warn("Using default duration due to config error");
        }

        const engine = new TypingEngine({
            displayElement: elements.passageDisplayElement,
            inputElement: elements.userInputElement,
            timerElement: elements.timerElement,
            progressBar: elements.progressBar,
            wpmElement: elements.wpmElement,
            accuracyElement: elements.accuracyElement,
            duration: duration,
            onComplete: (stats) => submitExam(stats)
        });

        loadPassage(engine);
    }

    async function loadPassage(engine) {
        try {
            const data = await client.get('/api/passages/random');
            engine.loadPassage(data.content);
            elements.userInputElement.focus();
        } catch (err) {
            elements.passageDisplayElement.textContent = 'Error loading passage.';
        }
    }

    async function submitExam(stats) {
        // Exam Submission Logic
        const sessionId = localStorage.getItem('currentSessionId');

        let typingMarks = 0;
        // Formula: (WPM / 35) * MAX_MARKS
        const maxMarks = currentPattern === 'new_pattern' ? 30 : 20;
        typingMarks = Math.min(maxMarks, (stats.wpm / 35) * maxMarks);

        const payload = {
            wpm: stats.wpm,
            accuracy: stats.accuracy,
            typingMarks: typingMarks.toFixed(2),
            sessionId: sessionId,
            testPattern: currentPattern,
            typingDuration: stats.durationMin * 60,
            totalChars: stats.totalChars,
            correctChars: stats.correctChars,
            errorCount: stats.totalChars - stats.correctChars
        };

        try {
            await client.post('/api/submit/typing', payload);

            // Redirect based on pattern
            if (currentPattern === 'new_pattern') {
                window.location.href = '/excel-mcq.html';
            } else {
                window.location.href = '/letter.html';
            }
        } catch (err) {
            ui.showToast('Submission failed', 'error');
        }
    }

    // Prevent navigation during exam
    if (attemptMode === 'exam') {
        window.addEventListener('beforeunload', (e) => {
            e.preventDefault();
            e.returnValue = '';
        });
    }
});
