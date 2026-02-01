document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const timerElement = document.getElementById('timer');
    const mobileTimerElement = document.getElementById('mobile-timer');
    const progressBar = document.getElementById('progress-bar');
    const userInputElement = document.getElementById('user-input');
    const submitBtn = document.getElementById('submit-btn');
    const questionDisplay = document.getElementById('question-display');
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeSelect = document.getElementById('font-size-select');

    // --- State Management ---
    const token = localStorage.getItem('token');
    let currentQuestionId = null;
    let timerInterval;
    let testInProgress = false;

    // --- Refresh-blocking logic ---
    const handleBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // --- Main Functions ---
    async function loadRandomQuestion() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/letter-questions/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch question.');
            const question = await response.json();
            questionDisplay.textContent = question.questionText;
            currentQuestionId = question._id;
            startTimer(); // Start timer after question loads
            // **FIX 3: Auto-focus on the input area**
            userInputElement.focus();
        } catch (error) {
            questionDisplay.textContent = 'Error: Failed to load question. Please add questions in the admin panel.';
            submitBtn.disabled = true;
        }
    }

    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;
        
        const startTime = new Date().getTime();
        const totalDuration = 300 * 1000; // 5 minutes in milliseconds

        timerInterval = setInterval(() => {
            const timeElapsed = new Date().getTime() - startTime;
            const remainingMilliseconds = totalDuration - timeElapsed;

            if (remainingMilliseconds <= 0) {
                endTest();
                return;
            }
            
            // --- Progress Bar Animation Logic for Stage 2 ---
            const stageBasePercent = 33.33;
            const stageDurationPercent = (timeElapsed / totalDuration) * 33.33;
            progressBar.style.width = `${stageBasePercent + stageDurationPercent}%`;
            // --- End of Logic ---

            const minutes = Math.floor((remainingMilliseconds / 1000) / 60);
            const seconds = Math.floor((remainingMilliseconds / 1000) % 60);
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if(timerElement) timerElement.textContent = formattedTime;
            if(mobileTimerElement) mobileTimerElement.textContent = formattedTime;
        }, 1000);
    }

    // Tab and Backspace handling for contenteditable editor
    const editor = userInputElement;

    editor.addEventListener('keydown', (event) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        /* ---------- TAB KEY ---------- */
        if (event.key === 'Tab') {
            event.preventDefault();

            // Create a semantic, non-editable indent marker
            const indentSpan = document.createElement('span');
            indentSpan.className = 'editor-indent';
            indentSpan.contentEditable = 'false';

            // REAL text indentation (caret-safe)
            indentSpan.textContent = '    '; // 4 spaces

            range.insertNode(indentSpan);

            // Move caret cleanly after indent
            range.setStartAfter(indentSpan);
            range.setEndAfter(indentSpan);

            selection.removeAllRanges();
            selection.addRange(range);
        }

        /* ---------- BACKSPACE KEY ---------- */
        if (event.key === 'Backspace') {
            const node = range.startContainer;
            const offset = range.startOffset;

            // If caret is right after an indent span, delete it in one go
            if (
                node.nodeType === Node.TEXT_NODE &&
                offset === 0 &&
                node.previousSibling?.classList?.contains('editor-indent')
            ) {
                event.preventDefault();
                node.previousSibling.remove();
            }
        }
    });



    async function endTest() {
        // 1. Existing State Cleanup
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
        userInputElement.contentEditable = false;
        submitBtn.disabled = true;

        // 2. Data Preparation
        // innerHTML is crucial here to capture the <span> indent from Step 1
        const letterContent = userInputElement.innerHTML;
        const sessionId = localStorage.getItem('currentSessionId');

        try {
            const response = await fetch(`${API_BASE_URL}/api/submit/letter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Using your existing token variable
                },
                body: JSON.stringify({ 
                    content: letterContent,
                    sessionId: sessionId,
                    // Ensure currentQuestionId is defined in your outer scope
                    questionId: currentQuestionId 
                })
            });

            if (!response.ok) throw new Error('Submission failed');

            // 3. Navigation
            // Move to Excel stage while keeping the session record unified
            window.location.href = '/excel.html';

        } catch (error) {
            // Fallback: Re-enable protection if submission fails
            window.addEventListener('beforeunload', handleBeforeUnload);
            submitBtn.disabled = false;
            userInputElement.contentEditable = true;
            alert('An error occurred while submitting. Please try again.');
            console.error("Submission error:", error);
        }
    }

    // --- Prevent Copy-Paste Functionality ---
    ['paste', 'copy', 'cut'].forEach(eventType => {
        userInputElement.addEventListener(eventType, (e) => {
            e.preventDefault();
        });
    });
    
    // --- Editor Toolbar Logic ---
    boldBtn.addEventListener('click', () => document.execCommand('bold'));
    italicBtn.addEventListener('click', () => document.execCommand('italic'));
    underlineBtn.addEventListener('click', () => document.execCommand('underline'));
    fontFamilySelect.addEventListener('change', (e) => document.execCommand('fontName', false, e.target.value));
    fontSizeSelect.addEventListener('change', (e) => document.execCommand('fontSize', false, e.target.value));

    // --- Initial Load & Event Listeners ---
    loadRandomQuestion();
    submitBtn.addEventListener('click', endTest);
});