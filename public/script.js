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
    const currentPattern = localStorage.getItem('currentExamPattern'); // 'standard' or 'new_pattern'
    const attemptMode = localStorage.getItem('currentAttemptMode'); // 'exam' or 'practice'
    
    let timerInterval;
    let testInProgress = false;
    let currentPassage = '';
    let sessionStartTime;

    // --- Refresh-blocking logic ---
    const handleBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };
    // Only block refresh if it's an actual exam
    if (attemptMode === 'exam') {
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    // --- Main Test Functions ---
    async function loadNewPassage() {
        try {
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
            passageDisplayElement.querySelector('span').classList.add('current');
            userInputElement.value = '';
            userInputElement.disabled = false;
            userInputElement.focus();
        } catch (error) {
            passageDisplayElement.textContent = `Error: ${error.message}`;
            userInputElement.disabled = true;
        }
    }

    function handleInput() {
        if (!testInProgress) startTimer();
        
        const passageChars = passageDisplayElement.querySelectorAll('span');
        const userChars = userInputElement.value.split('');
        
        const timeElapsedMinutes = (new Date().getTime() - sessionStartTime) / 60000;
        let correctChars = 0;
        
        passageChars.forEach((charSpan, index) => {
            const userChar = userChars[index];
            charSpan.classList.remove('current');
            if (userChar == null) {
                charSpan.classList.remove('correct', 'incorrect');
            } else if (userChar === charSpan.innerText) {
                charSpan.classList.add('correct');
                charSpan.classList.remove('incorrect');
                correctChars++;
            } else {
                charSpan.classList.add('incorrect');
                charSpan.classList.remove('correct');
            }
        });
        
        if (timeElapsedMinutes > 0) {
            wpmElement.textContent = Math.round((correctChars / 5) / timeElapsedMinutes);
            accuracyElement.textContent = `${Math.round((correctChars / userChars.length) * 100)}%`;
        }
        
        if (userChars.length < passageChars.length) {
            const nextCharSpan = passageChars[userChars.length];
            nextCharSpan.classList.add('current');
            nextCharSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (userChars.length === passageChars.length) {
            endTest();
        }
    }

    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;
        sessionStartTime = new Date().getTime();

        // DYNAMIC TIMER LOGIC
        // Standard is 5 mins and New Pattern is 10 mins (600s). Practice can be 5 mins (300s).
        let durationSeconds; 
        if (attemptMode === 'practice') {
            durationSeconds = 300; // Practice is always 5 mins
        } else if (currentPattern === 'standard') {
            durationSeconds = 300; // Standard Exam is 10 mins
        } else {
            durationSeconds = 600; // New Pattern (10+5) Exam is 5 mins
        }

        const totalDuration = durationSeconds * 1000;

        timerInterval = setInterval(() => {
            const timeElapsed = new Date().getTime() - sessionStartTime;
            const remainingMilliseconds = totalDuration - timeElapsed;

            if (remainingMilliseconds <= 0) {
                endTest();
                return;
            }
            
            // Progress bar logic (Adjusted for 3 stages in standard, 2 in new)
            const progressMultiplier = currentPattern === 'new_pattern' ? 50 : 33.33;
            const stageDurationPercent = (timeElapsed / totalDuration) * progressMultiplier;
            if(progressBar) progressBar.style.width = `${stageDurationPercent}%`;

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
        
        const timeElapsedMinutes = (new Date().getTime() - sessionStartTime) / 60000;
        const correctChars = passageDisplayElement.querySelectorAll('.correct').length;
        const totalTypedChars = userInputElement.value.length;
        const finalWpm = timeElapsedMinutes > 0 ? Math.round((totalTypedChars / 5) / timeElapsedMinutes) : 0;
        const finalAccuracy = totalTypedChars > 0 ? Math.round((correctChars / totalTypedChars) * 100) : 100;

        if (attemptMode === 'practice') {
            alert(`Practice Complete! WPM: ${finalWpm}, Accuracy: ${finalAccuracy}%`);
            window.location.href = '/dashboard.html';
            return;
        }

        // --- NEW SCORING LOGIC ---
        // New Pattern: 30 Marks | Standard Pattern: 20 Marks
        // Logic: (Current WPM / Target 35 WPM) * Max Marks
        let typingMarks = 0;
        if (currentPattern === 'new_pattern') {
            typingMarks = Math.min(30, (finalWpm / 35) * 30);
        } else {
            typingMarks = Math.min(20, (finalWpm / 35) * 20);
        }

        const sessionId = localStorage.getItem('currentSessionId');
        try {
            await fetch(`${API_BASE_URL}/api/submit/typing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    wpm: finalWpm, 
                    accuracy: finalAccuracy, 
                    typingMarks: typingMarks.toFixed(2), // Send scaled marks
                    sessionId: sessionId,
                    testPattern: currentPattern 
                })
            });

            if (currentPattern === 'new_pattern') {
                window.location.href = '/excel-mcq.html'; 
            } else {
                window.location.href = '/letter.html';
            }
        } catch (error) {
            alert("There was an error submitting your result.");
        }
    }

    // --- Event Listeners ---
    userInputElement.addEventListener('input', handleInput);

    userInputElement.addEventListener('keydown', (e) => {
        // NPSC/NSSB Style: Disable Enter and Escape during Exam
        if (attemptMode === 'exam' && (e.key === 'Enter' || e.key === 'Escape')) {
            e.preventDefault();
            return;
        }

        if (e.key === ' ') {
            e.preventDefault();
            const currentText = userInputElement.value;
            if (currentText === '' || currentText.endsWith(' ')) return; 

            const currentLength = currentText.length;
            let nextSpaceIndex = currentPassage.indexOf(' ', currentLength);
            if (nextSpaceIndex === -1) nextSpaceIndex = currentPassage.length;

            const jumpLength = nextSpaceIndex - currentLength;
            userInputElement.value += " ".repeat(jumpLength + 1);
            handleInput();
        }
    });

    ['paste', 'copy', 'cut'].forEach(eventType => {
        userInputElement.addEventListener(eventType, (e) => e.preventDefault());
    });

    // Helper to decode JWT and check role
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("JWT Parsing Error:", e);
            return null;
        }
    }

    const userToken = localStorage.getItem('token');

    if (userToken) {
        const payload = parseJwt(userToken);
        
        // Check if the role is admin
        if (payload && payload.role === 'admin') {
            const adminDiv = document.getElementById('admin-bypass');
            const quickSubmitBtn = document.getElementById('quick-submit-btn');

            if (adminDiv) {
                adminDiv.style.display = 'block'; // Make the button visible for admin
                
                quickSubmitBtn.addEventListener('click', () => {
                    if (confirm("Admin: End this test immediately and process current results?")) {
                        console.log("Admin bypass triggered.");
                        endTest(); // This calls your existing test completion logic
                    }
                });
            }
        }
    }
    
    loadNewPassage();
});