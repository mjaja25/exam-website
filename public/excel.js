// --- Dynamic URL Configuration ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
// --- End of Configuration ---

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
                alert("Time's up! Your submission will now be attempted.");
                if (fileInput.files.length > 0) {
                    excelForm.requestSubmit();
                } else {
                    alert("No file was selected to submit.");
                }
            }
        }, 1000);
    }
}

// Attach the timer start to the download button click
downloadBtn.addEventListener('click', startTimer);

// Handle the form submission
excelForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent default submission

    // Stop the timer if the user submits early
    clearInterval(timerInterval);

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Authentication error. Please log in again.');
        return;
    }

    const formData = new FormData();
    formData.append('excelFile', fileInput.files[0]);

    try {
        // Use the dynamic URL for the API call
        const response = await fetch(`${API_BASE_URL}/api/submit/excel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData,
        });

        const data = await response.json();
        alert(data.message);

    } catch (error) {
        console.error('File upload error:', error);
        alert('File upload failed!');
    }
});