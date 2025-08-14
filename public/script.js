document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const timerElement = document.getElementById('timer');
    const wpmElement = document.getElementById('wpm');
    const accuracyElement = document.getElementById('accuracy');
    const passageDisplayElement = document.getElementById('passage-display');
    const userInputElement = document.getElementById('user-input');
    const mobileTimerElement = document.getElementById('mobile-timer');
    const progressBar = document.getElementById('progress-bar');

    // --- State Management ---
    const token = localStorage.getItem('token');
    let timeRemaining = 300;
    let timerInterval;
    let testInProgress = false;
    let currentPassage = '';
    let sessionStartTime;

    // --- Refresh-blocking logic ---
    const handleBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // --- Main Test Functions ---
    async function loadNewPassage() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/passages/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch passage.');
            const passageData = await response.json();
            currentPassage = passageData.content;

            passageDisplayElement.innerHTML = ''; // Clear previous content
            currentPassage.split('').forEach(char => {
                const charSpan = document.createElement('span');
                charSpan.innerText = char;
                passageDisplayElement.appendChild(charSpan);
            });
            // Set the first character as 'current'
            passageDisplayElement.querySelector('span').classList.add('current');
            userInputElement.value = null;
            userInputElement.disabled = false;
        } catch (error) {
            passageDisplayElement.textContent = `Error: ${error.message}`;
            userInputElement.disabled = true;
        }
    }

    function handleInput() {
        const passageChars = passageDisplayElement.querySelectorAll('span');
        const userChars = userInputElement.value.split('');

        // --- Live WPM Calculation ---
        const timeElapsedMinutes = (new Date().getTime() - sessionStartTime) / 60000;
        const correctChars = passageDisplayElement.querySelectorAll('.correct').length;
        if (timeElapsedMinutes > 0) {
            const liveWpm = Math.round((correctChars / 5) / timeElapsedMinutes);
            wpmElement.textContent = liveWpm;
        }

        passageChars.forEach((charSpan, index) => {
            const userChar = userChars[index];
            
            // Remove 'current' class from all
            charSpan.classList.remove('current');

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

        // Add 'current' class to the next character to be typed
        if (userChars.length < passageChars.length) {
            const nextCharSpan = passageChars[userChars.length];
            nextCharSpan.classList.add('current');
            // --- FINAL, CORRECTED AUTO-SCROLL LOGIC ---
            // This tells the browser to smoothly scroll the element into the visible area if it's not already.
            nextCharSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // --- END OF FIX ---
        }

        // Auto-submit if completed
        if (userChars.length === passageChars.length) {
            endTest();
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
        if (!testInProgress) startTimer();
        handleInput();
    });

    // --- NEW: Spacebar Word Jump Logic ---
    userInputElement.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault(); // Prevent default space behavior
            
            const currentText = userInputElement.value;
            let nextSpaceIndex = currentPassage.indexOf(' ', currentText.length);
            
            if (nextSpaceIndex === -1) { // If it's the last word
                nextSpaceIndex = currentPassage.length;
            }

            const wordToJumpOver = currentPassage.substring(currentText.length, nextSpaceIndex);
            const spacesToAdd = " ".repeat(wordToJumpOver.length + 1); // Add spaces to fill the gap

            userInputElement.value += spacesToAdd;
            handleInput(); // Update the UI
        }
    });

    // --- Initial Load ---
    loadNewPassage();
});