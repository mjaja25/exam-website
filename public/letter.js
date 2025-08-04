document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Configuration ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    // --- End of Configuration ---

    // Grab the elements
    const timerElement = document.getElementById('timer');
    const userInputElement = document.getElementById('user-input');
    const resultsScreenElement = document.getElementById('results-screen');
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

        try {
            const response = await fetch(`${API_BASE_URL}/api/submit/letter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: letterContent })
            });
            const data = await response.json();

            if (data.grade) {
                resultsScreenElement.innerHTML = `
                    <h2>Test Complete!</h2>
                    <p>Your Score: ${data.grade.score} / 10</p>
                    <p><strong>Feedback:</strong> ${data.grade.feedback}</p>
                    <button onclick="location.reload()">Try Again</button>
                `;
            }
            resultsScreenElement.classList.remove('hidden');
        } catch (error) {
            resultsScreenElement.innerHTML = `<h2>Error</h2><p>Could not submit your letter for grading.</p>`;
            resultsScreenElement.classList.remove('hidden');
        }
    }

    // Event Listeners
    userInputElement.addEventListener('input', startTimer);
    submitBtn.addEventListener('click', endTest);
});