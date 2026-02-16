import { client } from '../api/client.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

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
        editor: document.getElementById('letter-editor'), // Changed ID
        submitBtn: document.getElementById('submit-btn'),
        questionDisplay: document.getElementById('question-display'),
        loadingOverlay: document.getElementById('loading-overlay')
    };

    // State
    const sessionId = localStorage.getItem('currentSessionId');
    let currentQuestionId = null;
    let timerInterval;
    let testInProgress = false;

    // Protection
    const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initial Load
    loadRandomQuestion();

    // Bind Toolbar
    bindToolbar();

    async function loadRandomQuestion() {
        try {
            const question = await client.get('/api/letter-questions/random');
            elements.questionDisplay.textContent = question.questionText;
            currentQuestionId = question._id;
            
            // Start Timer
            startTimer(300); // 5 mins
            elements.editor.focus();
        } catch (error) {
            elements.questionDisplay.textContent = 'Error loading question.';
            elements.submitBtn.disabled = true;
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
        clearInterval(timerInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        elements.editor.contentEditable = false;
        
        if (elements.submitBtn) {
            elements.submitBtn.disabled = true;
            elements.submitBtn.textContent = 'Submitting...';
        }

        const content = elements.editor.innerHTML;

        try {
            await client.post('/api/submit/letter', {
                content,
                sessionId,
                questionId: currentQuestionId
            });

            window.location.href = '/excel.html';
        } catch (err) {
            console.error(err);
            ui.showToast('Submission failed. Trying again...', 'error');
            // Retry logic or enable button
            elements.submitBtn.disabled = false;
            elements.submitBtn.textContent = 'Retry Submit';
        }
    }

    function bindToolbar() {
        const format = (cmd) => document.execCommand(cmd, false, null);
        
        // We need to bind these to the buttons in HTML or add listeners if IDs exist
        // letter.html has onclick="formatText...". We should ideally expose this or attach listeners.
        // Let's attach listeners to data-attributes or IDs if we update HTML.
        // For now, let's expose a global function for the existing HTML onclicks.
        window.formatText = (cmd) => format(cmd);
        
        // Add submit listener
        if (elements.submitBtn) {
            elements.submitBtn.addEventListener('click', () => {
                if (confirm('Submit letter?')) endTest();
            });
        }
    }
});
