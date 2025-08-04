// -------------------
//  Element Grabbing
// -------------------
const timerElement = document.getElementById('timer');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
const passageDisplayElement = document.getElementById('passage-display');
const userInputElement = document.getElementById('user-input');
const resultsScreenElement = document.getElementById('results-screen');
const restartBtn = document.getElementById('restart-btn');

// -------------------
//  Sample Passages
// -------------------
const passages = [
    "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet. Typing it helps in practicing all keys.",
    "Technology has revolutionized the way we live and work. From communication to transportation, advancements continue to shape our future.",
    "The sun always shines brightest after the rain. It's a reminder that even after difficult times, there is hope and a new beginning.",
    "To be successful, you must be willing to work hard and persevere through challenges. Consistency and dedication are the keys to achieving your goals."
];

// -------------------
//  State Management
// -------------------
let timeRemaining = 300; // 5 minutes in seconds
let timerInterval;
let testInProgress = false;
let currentPassage = '';

// -------------------
//  Functions
// -------------------

function loadNewPassage() {
    currentPassage = passages[Math.floor(Math.random() * passages.length)];
    passageDisplayElement.innerHTML = '';
    currentPassage.split('').forEach(char => {
        const charSpan = document.createElement('span');
        charSpan.innerText = char;
        passageDisplayElement.appendChild(charSpan);
    });
    // Reset input and results for a new test
    userInputElement.value = null;
    userInputElement.disabled = false;
    resultsScreenElement.classList.add('hidden');
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
    const token = localStorage.getItem('token'); // Get the token
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

    // --- Send data to backend ---
    try {
        const response = await fetch('/api/submit/typing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                wpm: finalWPM,
                accuracy: finalAccuracy
            })
        });

        const data = await response.json();
        console.log('Server response:', data.message);

    } catch (error) {
        console.error('Error submitting test results:', error);
    }
    // ----------------------------

    resultsScreenElement.classList.remove('hidden');
}

// -------------------
//  Event Listeners
// -------------------
userInputElement.addEventListener('input', () => {
    startTimer();
    handleInput();
});

// Restart button functionality
restartBtn.addEventListener('click', () => {
    // We will build this out later to properly reset everything for the next stage.
    // For now, it can just reload the page for a new typing test.
    location.reload(); 
});

// Load a passage as soon as the script runs
loadNewPassage();