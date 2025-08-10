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
        } catch (error) {
            questionDisplay.textContent = 'Error: Failed to load question. Please add questions in the admin panel.';
            userInputElement.disabled = true;
            submitBtn.disabled = true;
        }
    }

    function startTimer() {
        if (!testInProgress) {
            testInProgress = true;
            timerInterval = setInterval(() => {
                timeRemaining--;
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                if (timeRemaining <= 0) {
                    endTest();
                }
            }, 1000);
        }
    }

    async function endTest() {
        window.removeEventListener('beforeunload', handleBeforeUnload); // Disable refresh warning
        clearInterval(timerInterval);
        userInputElement.contentEditable = false; // Disable editing
        submitBtn.disabled = true;

        const letterContent = userInputElement.innerHTML; // Get HTML content
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
    boldBtn.addEventListener('click', () => {
        document.execCommand('bold', false, null);
    });
    italicBtn.addEventListener('click', () => {
        document.execCommand('italic', false, null);
    });
    underlineBtn.addEventListener('click', () => {
        document.execCommand('underline', false, null);
    });

    // --- Initial Load & Event Listeners ---
    loadRandomQuestion();
    userInputElement.addEventListener('input', startTimer);
    submitBtn.addEventListener('click', endTest);
});