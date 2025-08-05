document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Configuration ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    // Grab the elements
    const timerElement = document.getElementById('timer');
    const userInputElement = document.getElementById('user-input');
    const submitBtn = document.getElementById('submit-btn');

    // State Management
    let timeRemaining = 300; // 5 minutes
    let timerInterval;
    let testInProgress = false;

    // Starts the timer
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

    // This function runs when the timer finishes or submit is clicked
    async function endTest() {
        clearInterval(timerInterval);
        userInputElement.disabled = true;
        submitBtn.disabled = true;

        const letterContent = userInputElement.value;
        const token = localStorage.getItem('token');
        const sessionId = localStorage.getItem('currentSessionId'); // Get the session ID

        try {
            await fetch(`${API_BASE_URL}/api/submit/letter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    content: letterContent,
                    sessionId: sessionId // Send the session ID
                })
            });

            // **NEW:** Redirect to the next test
            window.location.href = '/excel.html';

        } catch (error) {
            alert('An error occurred while submitting your letter. Please try again.');
        }
    }

    // Event Listeners
    userInputElement.addEventListener('input', startTimer);
    submitBtn.addEventListener('click', endTest);
});