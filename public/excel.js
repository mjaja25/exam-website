// --- Dynamic URL Configuration ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

// Grab the elements
const timerElement = document.getElementById('timer');
const excelForm = document.getElementById('excel-form');
const fileInput = document.getElementById('excel-file');
const downloadBtn = document.getElementById('download-btn');

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
                clearInterval(timerInterval);
                if (fileInput.files.length > 0) {
                    excelForm.requestSubmit();
                } else {
                    alert("Time's up! No file was selected, proceeding to results.");
                    window.location.href = '/results.html';
                }
            }
        }, 1000);
    }
}

// Attach the timer start to the download button click
downloadBtn.addEventListener('click', startTimer);

// Handle the form submission
excelForm.addEventListener('submit', async (event) => {

    window.removeEventListener('beforeunload', handleBeforeUnload);
    
    event.preventDefault();
    clearInterval(timerInterval);

    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('currentSessionId');

    const formData = new FormData();
    formData.append('excelFile', fileInput.files[0]);
    formData.append('sessionId', sessionId); // Add the session ID to the form data

    try {
        await fetch(`${API_BASE_URL}/api/submit/excel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData,
        });

        // **NEW:** Redirect to the final results page
        window.location.href = '/results.html';

    } catch (error) {
        console.error('File upload error:', error);
        alert('File upload failed! You will now be taken to the results page.');
        window.location.href = '/results.html';
    }
});