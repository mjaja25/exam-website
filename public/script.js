document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const timerElement = document.getElementById('timer');
    const mobileTimerElement = document.getElementById('mobile-timer');
    const progressBar = document.getElementById('progress-bar');
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
        if (!testInProgress) startTimer();
        
        const passageChars = passageDisplayElement.querySelectorAll('span');
        const userChars = userInputElement.value.split('');

        // Live WPM Calculation
        const timeElapsedMinutes = (new Date().getTime() - sessionStartTime) / 60000;
        const correctChars = Array.from(passageChars).slice(0, userChars.length).filter((span, i) => span.innerText === userChars[i]).length;
        if (timeElapsedMinutes > 0) {
            wpmElement.textContent = Math.round((correctChars / 5) / timeElapsedMinutes);
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
            const nextCharSpan = passageChars[userChars.length];
            nextCharSpan.classList.add('current');
            nextCharSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            const remainingMilliseconds = totalDuration - timeElapsed;

            if (remainingMilliseconds <= 0) {
                endTest();
                return;
            }
            
            const stageDurationPercent = (timeElapsed / totalDuration) * 33.33;
            progressBar.style.width = `${stageDurationPercent}%`;

            const minutes = Math.floor((remainingMilliseconds / 1000) / 60);
            const seconds = Math.floor((remainingMilliseconds / 1000) % 60);
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if(timerElement) timerElement.textContent = formattedTime;
            if(mobileTimerElement) mobileTimerElement.textContent = formattedTime;
        }, 1000);
    }

    async function endTest() {
        clearInterval(timerInterval);
        userInputElement.disabled = true;
        
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
    userInputElement.addEventListener('input', handleInput);

    userInputElement.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            const currentText = userInputElement.value;
            const nextSpaceIndex = currentPassage.indexOf(' ', currentText.length);
            
            if (nextSpaceIndex > -1) {
                const wordToJump = currentPassage.substring(currentText.length, nextSpaceIndex);
                userInputElement.value += wordToJump + ' ';
            } else { // Last word
                userInputElement.value = currentPassage;
            }
            handleInput();
        }
    });

    loadNewPassage();
});