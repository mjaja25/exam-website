document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Configuration ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    // --- Element Grabbing ---
    const timerElement = document.getElementById('timer');
    const userInputElement = document.getElementById('user-input');
    const submitBtn = document.getElementById('submit-btn');
    const questionDisplay = document.getElementById('question-display');
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeSelect = document.getElementById('font-size-select');
    const mobileTimerElement = document.getElementById('mobile-timer');
    const progressBar = document.getElementById('progress-bar');

    // Progress bar animation
    const stageBasePercent = 33.33; // Stage 2 starts at 33.33%
    const stageDurationPercent = (timeElapsed / totalDuration) * 33.33;
    progressBar.style.width = `${stageBasePercent + stageDurationPercent}%`;

    // --- State Management ---
    const token = localStorage.getItem('token');
    let currentQuestionId = null;
    let timeRemaining = 300;
    let timerInterval;
    let testInProgress = false;

    // --- Refresh-blocking logic ---
    const handleBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // --- Functions ---
    async function loadRandomQuestion() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/letter-questions/random`, {
                headers: { 'Authorization': `Bearer ${token}` } // Fixed: Added token to the request
            });

            if (!response.ok) throw new Error('Could not fetch question.');

            const question = await response.json();
            questionDisplay.textContent = question.questionText;
            currentQuestionId = question._id; // Save the question ID


            // The timer now starts automatically after the question has loaded.
            startTimer();

        } catch (error) {
            questionDisplay.textContent = 'Error: Failed to load question. Please add questions in the admin panel.';
            userInputElement.disabled = true;
            submitBtn.disabled = true;
        }
    }

    // This is the new, more robust startTimer function
    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;
        
        // 1. Record the exact start time in milliseconds
        const startTime = new Date().getTime();
        const totalDuration = 300 * 1000; // 5 minutes in milliseconds

        timerInterval = setInterval(() => {
            // 2. Calculate elapsed time on every tick
            const timeElapsed = new Date().getTime() - startTime;
            const remainingMilliseconds = totalDuration - timeElapsed;

            if (remainingMilliseconds <= 0) {
                endTest();
                return;
            }
            
            // --- ANIMATION LOGIC ---
            // Determine current stage for the progress bar animation
            const path = window.location.pathname;
            let stageBasePercent = 0;
            if (path.includes('letter.html')) stageBasePercent = 33.33;
            if (path.includes('excel.html')) stageBasePercent = 66.66;
            
            const stageDurationPercent = (timeElapsed / totalDuration) * 33.33;
            progressBar.style.width = `${stageBasePercent + stageDurationPercent}%`;
            // --- END OF ANIMATION LOGIC ---

            // 3. Update the display
            const minutes = Math.floor((remainingMilliseconds / 1000) / 60);
            const seconds = Math.floor((remainingMilliseconds / 1000) % 60);
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if(timerElement) timerElement.textContent = formattedTime;
            if(mobileTimerElement) mobileTimerElement.textContent = formattedTime;

        }, 1000);
    }

    async function endTest() {
        window.removeEventListener('beforeunload', handleBeforeUnload); // Disable refresh warning
        clearInterval(timerInterval);
        userInputElement.contentEditable = false; // Disable editing
        submitBtn.disabled = true;

        const letterContent = userInputElement.innerText; // Gets ONLY the plain text
        const sessionId = localStorage.getItem('currentSessionId');

        try {
            await fetch(`${API_BASE_URL}/api/submit/letter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    content: letterContent,
                    sessionId: sessionId,
                    questionId: currentQuestionId // Send the question ID for context-aware grading
                })
            });
            window.location.href = '/excel.html';
        } catch (error) {
            window.addEventListener('beforeunload', handleBeforeUnload); // Re-enable warning on error
            alert('An error occurred while submitting your letter. Please try again.');
        }
    }

     // --- Editor Toolbar Logic ---
    boldBtn.addEventListener('click', () => document.execCommand('bold'));
    italicBtn.addEventListener('click', () => document.execCommand('italic'));
    underlineBtn.addEventListener('click', () => document.execCommand('underline'));

    fontFamilySelect.addEventListener('change', (e) => {
        document.execCommand('fontName', false, e.target.value);
    });
    fontSizeSelect.addEventListener('change', (e) => {
        document.execCommand('fontSize', false, e.target.value);
    });

    // --- Initial Load & Event Listeners ---
    loadRandomQuestion();
    submitBtn.addEventListener('click', endTest);
});