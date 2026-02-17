import { auth } from '../utils/auth.js';
import { client } from '../api/client.js';
import { TypingEngine } from '../core/TypingEngine.js';
import { ui } from '../utils/ui.js';

let engine = null;
let isSubmitting = false;

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
        userInputElement: document.getElementById('user-input'),
        adminBypass: document.getElementById('admin-bypass'),
        quickSubmitBtn: document.getElementById('quick-submit-btn')
    };

    // 3. State
    const currentPattern = localStorage.getItem('currentExamPattern');
    const attemptMode = localStorage.getItem('currentAttemptMode');

    // 4. Beforeunload handler - named function for removal
    const handleBeforeUnload = (e) => {
        if (attemptMode === 'exam' && !isSubmitting) {
            e.preventDefault();
            e.returnValue = 'You have an exam in progress. Are you sure you want to leave?';
            return e.returnValue;
        }
    };

    // 5. Load Config & Initialize
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
            console.warn("Using default duration due to config error:", err);
        }

        engine = new TypingEngine({
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
        setupAdminBypass();
    }

    async function loadPassage(engine) {
        try {
            const data = await client.get('/api/passages/random');
            engine.loadPassage(data.content);
            elements.userInputElement.focus();
        } catch (err) {
            elements.passageDisplayElement.textContent = 'Error loading passage. Please refresh the page.';
            ui.showToast('Failed to load passage. Please refresh.', 'error');
            console.error('Passage loading error:', err);
        }
    }

    function setupAdminBypass() {
        // Check if user is admin and show bypass button
        if (auth.isAdmin() && elements.adminBypass && elements.quickSubmitBtn) {
            elements.adminBypass.style.display = 'block';
            
            elements.quickSubmitBtn.addEventListener('click', async () => {
                if (confirm("Admin: End this test immediately and submit current progress?")) {
                    window.removeEventListener('beforeunload', handleBeforeUnload);
                    
                    // Get current stats from engine
                    if (engine) {
                        const stats = engine.calculateStats();
                        await submitExam(stats);
                    }
                }
            });
        }
    }

    async function submitExam(stats) {
        // Prevent multiple submissions
        if (isSubmitting) return;
        isSubmitting = true;

        // Remove beforeunload to allow navigation
        window.removeEventListener('beforeunload', handleBeforeUnload);

        // Disable input to prevent changes during submission
        if (elements.userInputElement) {
            elements.userInputElement.disabled = true;
        }

        // Show loading feedback
        ui.showToast('Submitting your typing test...', 'info');

        const sessionId = localStorage.getItem('currentSessionId');

        let typingMarks = 0;
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
            
            ui.showToast('Typing test submitted successfully!', 'success');

            // Small delay to show success message before navigation
            setTimeout(() => {
                if (currentPattern === 'new_pattern') {
                    window.location.href = '/excel-mcq.html';
                } else {
                    window.location.href = '/letter.html';
                }
            }, 500);

        } catch (err) {
            // Re-add beforeunload since we're staying on the page
            if (attemptMode === 'exam') {
                window.addEventListener('beforeunload', handleBeforeUnload);
            }
            
            // Re-enable input for retry
            if (elements.userInputElement) {
                elements.userInputElement.disabled = false;
            }
            
            isSubmitting = false;
            
            const errorMessage = err.message || 'Unknown error occurred';
            ui.showToast('Submission failed: ' + errorMessage + '. Click to retry.', 'error');
            
            console.error('Typing submission error:', err);
            
            // Add retry button functionality
            elements.userInputElement?.focus();
        }
    }

    // Set up beforeunload protection (only in exam mode)
    if (attemptMode === 'exam') {
        window.addEventListener('beforeunload', handleBeforeUnload);
    }
});
