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

    // --- NEW: Handle Tab Key Press ---
    userInputElement.addEventListener('keydown', (event) => {
        // Check if the pressed key is the "Tab" key
        if (event.key === 'Tab') {
            // Prevent the default action (which is to change focus)
            event.preventDefault();

            // Insert a tab character (or a few spaces) at the cursor's position
            document.execCommand('insertText', false, '\t'); // You can replace '\t' with '    ' for four spaces
        }
    });
    
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

    async function endTest() {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        clearInterval(timerInterval);
        userInputElement.contentEditable = false;
        submitBtn.disabled = true;

        const letterContent = userInputElement.innerHTML;
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
                    questionId: currentQuestionId
                })
            });
            window.location.href = '/excel.html';
        } catch (error) {
            window.addEventListener('beforeunload', handleBeforeUnload);
            alert('An error occurred while submitting. Please try again.');
        }
    }
    
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