import { client } from '../api/client.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

let isSubmitting = false;

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    if (!auth.getToken()) {
        window.location.href = '/login.html';
        return;
    }

    // Elements
    const elements = {
        timerElement: document.getElementById('timer'),
        mobileTimerElement: document.getElementById('mobile-timer'),
        progressBar: document.getElementById('progress-bar'),
        editor: document.getElementById('letter-editor'),
        submitBtn: document.getElementById('submit-btn'),
        questionDisplay: document.getElementById('question-display'),
        loadingOverlay: document.getElementById('loading-overlay')
    };

    // State
    const sessionId = localStorage.getItem('currentSessionId');
    const attemptMode = localStorage.getItem('currentAttemptMode');
    let currentQuestionId = null;
    let timerInterval;
    let testInProgress = false;

    // Beforeunload handler - named function for removal
    const handleBeforeUnload = (e) => {
        if (attemptMode === 'exam' && !isSubmitting) {
            e.preventDefault();
            e.returnValue = 'You have an exam in progress. Are you sure you want to leave?';
            return e.returnValue;
        }
    };

    // Set up beforeunload protection (only in exam mode)
    if (attemptMode === 'exam') {
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    // Initial Load
    loadRandomQuestion();

    // Bind Toolbar
    bindToolbar();

    async function loadRandomQuestion() {
        try {
            const question = await client.get('/api/letter-questions/random');
            elements.questionDisplay.textContent = question.questionText;
            currentQuestionId = question._id;
            
            // Fetch timer from settings
            let timerDuration = 180; // Default 3 mins
            try {
                const config = await client.get('/api/settings/public');
                if (config.exam && config.exam.letterDuration) {
                    timerDuration = config.exam.letterDuration;
                }
            } catch (e) {
                console.warn("Using default letter timer");
            }
            
            // Start Timer
            startTimer(timerDuration);
            elements.editor.focus();
        } catch (error) {
            elements.questionDisplay.textContent = 'Error loading question. Please refresh the page.';
            elements.submitBtn.disabled = true;
            ui.showToast('Failed to load question. Please refresh.', 'error');
            console.error('Letter question loading error:', error);
        }
    }

    function startTimer(durationSeconds) {
        if (testInProgress) return;
        testInProgress = true;

        let remaining = durationSeconds;
        const total = durationSeconds;

        timerInterval = setInterval(() => {
            remaining--;
            
            // Update UI
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            if (elements.timerElement) elements.timerElement.textContent = timeStr;
            if (elements.mobileTimerElement) elements.mobileTimerElement.textContent = timeStr;
            if (elements.progressBar) {
                const pct = ((total - remaining) / total) * 100;
                elements.progressBar.style.width = `${pct}%`;
            }

            if (remaining <= 0) {
                endTest();
            }
        }, 1000);
    }

    async function endTest() {
        // Prevent multiple submissions
        if (isSubmitting) return;
        isSubmitting = true;

        clearInterval(timerInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        
        if (elements.editor) {
            elements.editor.contentEditable = false;
        }
        
        if (elements.submitBtn) {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = 'Submitting...';
        }

        // Show loading overlay if available
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'flex';
        }

        const content = elements.editor ? elements.editor.innerHTML : '';

        try {
            await client.post('/api/submit/letter', {
                content,
                sessionId,
                questionId: currentQuestionId
            });

            ui.showToast('Letter submitted successfully!', 'success');

            // Small delay to show success message
            setTimeout(() => {
                window.location.href = '/excel.html';
            }, 500);

        } catch (err) {
            // Re-add beforeunload since we're staying on the page
            if (attemptMode === 'exam') {
                window.addEventListener('beforeunload', handleBeforeUnload);
            }
            
            // Re-enable editor
            if (elements.editor) {
                elements.editor.contentEditable = true;
            }
            
            // Hide loading overlay
            if (elements.loadingOverlay) {
                elements.loadingOverlay.style.display = 'none';
            }
            
            // Restore button
            if (elements.submitBtn) {
                elements.submitBtn.disabled = false;
                elements.submitBtn.textContent = 'Retry Submit';
            }
            
            isSubmitting = false;
            
            const errorMessage = err.message || 'Unknown error occurred';
            ui.showToast('Submission failed: ' + errorMessage, 'error');
            console.error('Letter submission error:', err);
        }
    }

    function bindToolbar() {
        const format = (cmd) => document.execCommand(cmd, false, null);
        
        // Expose global function for HTML onclicks
        window.formatText = (cmd) => format(cmd);
        
        // Add submit listener without confirmation
        if (elements.submitBtn) {
            elements.submitBtn.addEventListener('click', () => {
                endTest();
            });
        }
    }
});
