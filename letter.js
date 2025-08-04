// -------------------
//  Element Grabbing
// -------------------
const timerElement = document.getElementById('timer');
const passageDisplayElement = document.getElementById('passage-display');
const userInputElement = document.getElementById('user-input');
const resultsScreenElement = document.getElementById('results-screen');
const restartBtn = document.getElementById('restart-btn');
const submitBtn = document.getElementById('submit-btn');

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
    const token = localStorage.getItem('token');
    // 1. Stop the timer and disable the input area
    clearInterval(timerInterval);
    userInputElement.disabled = true;

    // 2. Get the letter content written by the user
    const letterContent = userInputElement.value;

    // 3. Send the letter content to your backend for grading
    try {
        const response = await fetch('/api/submit/letter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Add this line
            },
            body: JSON.stringify({
                content: letterContent // Send the letter in the request body
            })
        });

        const data = await response.json(); // Get the response (including the grade)

        // 4. Display the results to the user
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
        console.error('Error submitting letter:', error);
        resultsScreenElement.innerHTML = `<h2>Error</h2><p>Could not submit your letter for grading.</p>`;
        resultsScreenElement.classList.remove('hidden');
    }
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

submitBtn.addEventListener('click', () => {
    // We can just call endTest() because it already has all the logic
    // to stop the timer, disable the input, and send the data.
    endTest(); 
});

// Load a passage as soon as the script runs
loadNewPassage();