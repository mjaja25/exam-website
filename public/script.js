document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL Configuration ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    // --- Element Grabbing ---
    const timerElement = document.getElementById('timer');
    const wpmElement = document.getElementById('wpm');
    const accuracyElement = document.getElementById('accuracy');
    const passageDisplayElement = document.getElementById('passage-display');
    const userInputElement = document.getElementById('user-input');

    // --- State Management ---
    let timeRemaining = 300; // 5 minutes in seconds
    let timerInterval;
    let testInProgress = false;
    let currentPassage = '';

    // --- Refresh-blocking logic ---
    const handleBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // --- Functions ---
    async function loadNewPassage() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/passages/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch passage.');
            
            const passageData = await response.json();
            currentPassage = passageData.content;

            passageDisplayElement.innerHTML = '';
            currentPassage.split('').forEach(char => {
                const charSpan = document.createElement('span');
                charSpan.innerText = char;
                passageDisplayElement.appendChild(charSpan);
            });
            userInputElement.value = null;
            userInputElement.disabled = false;
        } catch (error) {
            passageDisplayElement.textContent = `Error: ${error.message}. Please add passages in the admin panel.`;
            userInputElement.disabled = true;
        }
    }

    function handleInput() {
        const passageChars = passageDisplayElement.querySelectorAll('span');
        const userChars = userInputElement.value.split('');
        passageChars.forEach((charSpan, index) => {
            const userChar = userChars[index];
            if (userChar == null) {
                charSpan.classList.remove('correct', 'incorrect');
            } else if (userChar === charSpan.innerText) {
                charSpan.classList.add('correct');
                charSpan.classList.remove('incorrect');
            } else {
                charSpan.classList.add('incorrect');
                charSpan.classList.remove('correct');
            }
        });

        if (userChars.length === passageChars.length) {
            endTest();
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
        window.removeEventListener('beforeunload', handleBeforeUnload);
        clearInterval(timerInterval);
        userInputElement.disabled = true;

        const correctChars = passageDisplayElement.querySelectorAll('.correct').length;
        const totalTypedChars = userInputElement.value.length;
        
        // **BUG FIX:** Correct WPM calculation for early completion.
        const timeElapsedSeconds = 300 - timeRemaining;
        const timeElapsedMinutes = timeElapsedSeconds / 60;
        const grossWPM = timeElapsedMinutes > 0 ? (totalTypedChars / 5) / timeElapsedMinutes : 0;
        
        const accuracy = totalTypedChars > 0 ? (correctChars / totalTypedChars) * 100 : 100;
        const finalWPM = Math.round(grossWPM);
        const finalAccuracy = Math.round(accuracy);

        wpmElement.textContent = finalWPM;
        accuracyElement.textContent = `${finalAccuracy}%`;

        const token = localStorage.getItem('token');
        const sessionId = localStorage.getItem('currentSessionId');

        try {
            await fetch(`${API_BASE_URL}/api/submit/typing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ wpm: finalWPM, accuracy: finalAccuracy, sessionId: sessionId })
            });
            window.location.href = '/letter.html';
        } catch (error) {
            window.addEventListener('beforeunload', handleBeforeUnload); // Re-enable warning on error
            alert("There was an error submitting your result. Please try again.");
        }
    }

    // --- Prevent Copy-Paste Functionality ---
    ['paste', 'copy', 'cut'].forEach(eventType => {
        userInputElement.addEventListener(eventType, (e) => {
            e.preventDefault();
        });
    });

    // --- Event Listeners ---
    userInputElement.addEventListener('input', () => {
        startTimer();
        handleInput();
    });

    // --- Initial Load ---
    loadNewPassage();
});