// --- Dynamic URL Configuration ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

// Grab the elements
const timerElement = document.getElementById('timer');
const excelForm = document.getElementById('excel-form');
const fileInput = document.getElementById('excel-file');
const downloadBtn = document.getElementById('download-btn');
const questionNameElement = document.getElementById('question-name');

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
    // This prevents the page from reloading
    event.preventDefault(); 
    clearInterval(timerInterval);

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
        console.error('File upload error:', error);
        alert('File upload failed! You will now be taken to the results page.');
        window.location.href = '/results.html';
    }
});

loadRandomExcelQuestion();