// --- Dynamic URL Configuration ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

// Grab the elements
const timerElement = document.getElementById('timer');
const excelForm = document.getElementById('excel-form');
const fileInput = document.getElementById('excel-file');
const downloadBtn = document.getElementById('download-btn');
const questionNameElement = document.getElementById('question-name');
const mobileTimerElement = document.getElementById('mobile-timer');
const progressBar = document.getElementById('progress-bar');

// For Progress bar animation
const stageBasePercent = 66.66; // Stage 3 starts at 66.66%
const stageDurationPercent = (timeElapsed / totalDuration) * 33.34; // Use 33.34 to reach 100%
progressBar.style.width = `${stageBasePercent + stageDurationPercent}%`;

// State Management
let timeRemaining = 300;
let timerInterval;
let testInProgress = false;
let currentQuestionId = null;



// --- NEW: Function to load a random Excel question ---
async function loadRandomExcelQuestion() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/excel-questions/random`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Could not fetch question.');
        
        const question = await response.json();
        
        // Update the UI with the fetched question details
        questionNameElement.textContent = question.questionName;
        downloadBtn.href = `${API_BASE_URL}/${question.questionFilePath}`;
        currentQuestionId = question._id; // Save the question ID for submission

        // **THE FIX IS HERE:**
        // Set the button's link directly to the full Cloudinary URL from the database.
        downloadBtn.href = question.questionFilePath; 
        
        currentQuestionId = question._id;

        // **THE FIX IS HERE:**
        // Enable the button only after the link is ready.
        downloadBtn.removeAttribute('disabled');
        downloadBtn.textContent = 'Download Question File'; // Restore original text

    } catch (error) {
        questionNameElement.textContent = 'Error loading question. Please refresh.';
        downloadBtn.textContent = 'Unavailable'; // Show error on button
    }
}

// Starts the timer
// This is the new, more robust startTimer function for the Excel test
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
            // This logic correctly handles auto-submission when time is up
            if (fileInput.files.length > 0) {
                excelForm.requestSubmit();
            } else {
                window.removeEventListener('beforeunload', handleBeforeUnload);
                window.location.href = '/results.html';
            }
            return;
        }
        
        // --- ANIMATION LOGIC for Stage 3 ---
        const stageBasePercent = 66.66; // Stage 3 starts at 66.66%
        const stageDurationPercent = (timeElapsed / totalDuration) * 33.34; // Use 33.34 to ensure it reaches 100%
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

// Attach the timer start to the download button click
downloadBtn.addEventListener('click', startTimer);

// Handle the form submission
excelForm.addEventListener('submit', async (event) => {
    // This prevents the page from reloading
    event.preventDefault(); 
    clearInterval(timerInterval);


    // --- NEW: Show loader and disable button ---
    const submitButton = excelForm.querySelector('button[type="submit"]');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    submitButton.disabled = true;
    loadingOverlay.style.display = 'flex';
    // --- End of new logic ---

    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId');

    const formData = new FormData();
    formData.append('excelFile', fileInput.files[0]);
    formData.append('sessionId', sessionId);
    formData.append('questionId', currentQuestionId);

    try {
        // We wait for the file to be uploaded...
        await fetch(`${API_BASE_URL}/api/submit/excel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData,
        });

        // ...and THEN we redirect to the results page.
        window.location.href = '/results.html';

    } catch (error) {
        // Hide loader on error and re-enable button
        loadingOverlay.style.display = 'none';
        submitButton.disabled = false;
        alert('File upload failed! Please try again.');
    }
});

loadRandomExcelQuestion();