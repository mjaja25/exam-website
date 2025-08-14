document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const timerElement = document.getElementById('timer');
    const mobileTimerElement = document.getElementById('mobile-timer');
    const wpmElement = document.getElementById('wpm');
    const accuracyElement = document.getElementById('accuracy');
    const passageDisplayElement = document.getElementById('passage-display');
    const userInputElement = document.getElementById('user-input');

    // --- State Management ---
    const token = localStorage.getItem('token');
    let timerInterval;
    let testInProgress = false;
    let currentPassage = '';
    let sessionStartTime;

    // --- Main Test Functions ---
    async function loadNewPassage() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/passages/random`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not fetch passage.');
            const passageData = await response.json();
            currentPassage = passageData.content;

            passageDisplayElement.innerHTML = '';
            currentPassage.split('').forEach(char => {
                const charSpan = document.createElement('span');
                charSpan.innerText = char;
                passageDisplayElement.appendChild(charSpan);
            });
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

        // Live WPM Calculation
        if (testInProgress) {
            const timeElapsedMinutes = (new Date().getTime() - sessionStartTime) / 60000;
            const correctWords = userInputElement.value.trim().split(' ').filter((word, index) => {
                const passageWords = currentPassage.trim().split(' ');
                return word === passageWords[index];
            }).length;
            if (timeElapsedMinutes > 0) {
                wpmElement.textContent = Math.round(correctWords / timeElapsedMinutes);
            }
        }

        passageChars.forEach((charSpan, index) => {
            const userChar = userChars[index];
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

        if (userChars.length < passageChars.length) {
            passageChars[userChars.length].classList.add('current');
        } else {
            endTest();
        }
    }

    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;
        sessionStartTime = new Date().getTime();
        const totalDuration = 300 * 1000;

        timerInterval = setInterval(() => {
            const timeElapsed = new Date().getTime() - sessionStartTime;
            const remainingMilliseconds = (300 * 1000) - timeElapsed;

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
            // --- END OF ANIMATION LOGIC --

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
        
        // Final WPM and Accuracy Calculation
        const timeElapsedMinutes = (new Date().getTime() - sessionStartTime) / 60000;
        const correctChars = passageDisplayElement.querySelectorAll('.correct').length;
        const totalTypedChars = userInputElement.value.length;
        const finalWpm = timeElapsedMinutes > 0 ? Math.round((totalTypedChars / 5) / timeElapsedMinutes) : 0;
        const finalAccuracy = totalTypedChars > 0 ? Math.round((correctChars / totalTypedChars) * 100) : 100;

        wpmElement.textContent = finalWpm;
        accuracyElement.textContent = `${finalAccuracy}%`;
        
        const sessionId = localStorage.getItem('currentSessionId');
        try {
            await fetch(`${API_BASE_URL}/api/submit/typing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ wpm: finalWpm, accuracy: finalAccuracy, sessionId: sessionId })
            });
            window.location.href = '/letter.html';
        } catch (error) {
            alert("There was an error submitting your result.");
        }
    }

    // --- Event Listeners ---
    userInputElement.addEventListener('input', () => {
        if (!testInProgress) startTimer();
        handleInput();
    });

    userInputElement.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            const currentText = userInputElement.value;
            const passageWords = currentPassage.split(' ');
            const userWords = currentText.split(' ');
            const nextWord = passageWords[userWords.length - 1];
            
            if (nextWord) {
                userInputElement.value += nextWord.substring(userWords[userWords.length-1].length) + ' ';
            }
            handleInput();
        }
    });

    loadNewPassage();
});