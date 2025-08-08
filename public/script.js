// --- Dynamic URL Configuration ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
// --- End of Configuration ---

// --- Element Grabbing ---
const timerElement = document.getElementById('timer');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
const passageDisplayElement = document.getElementById('passage-display');
const userInputElement = document.getElementById('user-input');
const resultsScreenElement = document.getElementById('results-screen');
const restartBtn = document.getElementById('restart-btn');

// --- Sample Passages ---
// const passages = [
//     "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet. Typing it helps in practicing all keys.",
//     "Technology has revolutionized the way we live and work. From communication to transportation, advancements continue to shape our future.",
//     "To be successful, you must be willing to work hard and persevere through challenges. Consistency and dedication are the keys to achieving your goals."
// ];

// --- State Management ---
let timeRemaining = 300;
let timerInterval;
let testInProgress = false;
let currentPassage = '';

// --- Functions ---
// REPLACE your old loadNewPassage function with this new async version.
async function loadNewPassage() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/passages/random`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Could not fetch a new passage.');
        }

        const passageData = await response.json();
        currentPassage = passageData.content; // Store the content

        passageDisplayElement.innerHTML = '';
        currentPassage.split('').forEach(char => {
            const charSpan = document.createElement('span');
            charSpan.innerText = char;
            passageDisplayElement.appendChild(charSpan);
        });
        
        // Reset input for the new test
        userInputElement.value = null;
        userInputElement.disabled = false;
        
    } catch (error) {
        passageDisplayElement.textContent = `Error: ${error.message} Please refresh the page.`;
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
    
    // --- NEW: Auto-submit logic ---
    // If the number of typed characters equals the passage length, end the test.
    if (userChars.length === passageChars.length) {
        endTest();
    }
    // --- End of new logic ---
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
    clearInterval(timerInterval);
    userInputElement.disabled = true;

    const correctChars = passageDisplayElement.querySelectorAll('.correct').length;
    const totalTypedChars = userInputElement.value.length;
    const grossWPM = (totalTypedChars / 5) / 5;
    const accuracy = totalTypedChars > 0 ? (correctChars / totalTypedChars) * 100 : 100;
    const finalWPM = Math.round(grossWPM);
    const finalAccuracy = Math.round(accuracy);

    wpmElement.textContent = finalWPM;
    accuracyElement.textContent = `${finalAccuracy}%`;

    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId'); // Get the session ID

    try {
        await fetch(`${API_BASE_URL}/api/submit/typing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                wpm: finalWPM, 
                accuracy: finalAccuracy, 
                sessionId: sessionId // Send the session ID with the result
            })
        });
        
        // **NEW:** Redirect to the next test
        window.location.href = '/letter.html';

    } catch (error) {
        console.error('Error submitting typing results:', error);
        alert("There was an error submitting your result. Please try again.");
    }
}

// --- Prevent Copy-Paste Functionality ---
// This stops users from pasting text into the input area or copying the passage.
const eventsToBlock = ['paste', 'copy', 'cut'];
eventsToBlock.forEach(eventType => {
    userInputElement.addEventListener(eventType, (e) => {
        e.preventDefault();
        // Optional: You could show a small, temporary message here if you want.
    });
});
// --- End of Prevent Copy-Paste ---

// --- Event Listeners ---
userInputElement.addEventListener('input', () => {
    startTimer();
    handleInput();
});

restartBtn.addEventListener('click', () => {
    location.reload(); 
});

loadNewPassage();