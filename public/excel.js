document.addEventListener('DOMContentLoaded', () => {
    // --- Dynamic URL & Element Grabbing ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const timerElement = document.getElementById('timer');
    const mobileTimerElement = document.getElementById('mobile-timer');
    const progressBar = document.getElementById('progress-bar');
    const excelForm = document.getElementById('excel-form');
    const fileInput = document.getElementById('excel-file');
    const downloadBtn = document.getElementById('download-btn');
    const questionNameElement = document.getElementById('question-name');

    // --- State Management ---
    const token = localStorage.getItem('token');
    let currentQuestionId = null;
    let timerInterval;
    let testInProgress = false;

    // --- Refresh-blocking logic ---
    const handleBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // --- Main Functions ---
    async function loadRandomExcelQuestion() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/excel-questions/random`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Could not fetch question.');

            const question = await response.json();
            questionNameElement.textContent = question.questionName;
            downloadBtn.href = question.questionFilePath; // Set the correct Cloudinary download link
            currentQuestionId = question._id;

            downloadBtn.removeAttribute('disabled');
            // Start the timer as usual
            startTimer();
        } catch (error) {
            questionNameElement.textContent = 'Error loading question. Please add questions in the admin panel.';
            downloadBtn.textContent = 'Unavailable';
        }
    }

    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;

        const startTime = new Date().getTime();
        const totalDuration = 420 * 1000; // 5 minutes in milliseconds

        timerInterval = setInterval(() => {
            const timeElapsed = new Date().getTime() - startTime;
            const remainingMilliseconds = totalDuration - timeElapsed;

            if (remainingMilliseconds <= 0) {
                if (fileInput.files.length > 0) {
                    excelForm.requestSubmit();
                } else {
                    window.removeEventListener('beforeunload', handleBeforeUnload);
                    window.location.href = '/results.html';
                }
                return;
            }

            // --- Progress Bar Animation Logic (Correct Placement) ---
            const stageBasePercent = 66.66;
            const stageDurationPercent = (timeElapsed / totalDuration) * 33.34;
            progressBar.style.width = `${stageBasePercent + stageDurationPercent}%`;
            // --- End of Logic ---

            const minutes = Math.floor((remainingMilliseconds / 1000) / 60);
            const seconds = Math.floor((remainingMilliseconds / 1000) % 60);
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timerElement) timerElement.textContent = formattedTime;
            if (mobileTimerElement) mobileTimerElement.textContent = formattedTime;
        }, 1000);
    }

    // --- Event Listeners ---
    downloadBtn.addEventListener('click', () => {
        // **THE FIX IS HERE:**
        // Temporarily remove the warning so the download can start without a pop-up.
        window.removeEventListener('beforeunload', handleBeforeUnload);



        // Re-add the warning immediately after. This happens so fast the user won't notice,
        // but it re-enables protection for any future accidental refreshes.
        setTimeout(() => {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }, 100);
    });

    excelForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        window.removeEventListener('beforeunload', handleBeforeUnload);
        clearInterval(timerInterval);

        const submitButton = excelForm.querySelector('button[type="submit"]');
        const loadingOverlay = document.getElementById('loading-overlay');
        submitButton.disabled = true;
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        const sessionId = localStorage.getItem('currentSessionId');
        const formData = new FormData();
        formData.append('excelFile', fileInput.files[0]);
        formData.append('sessionId', sessionId);
        formData.append('questionId', currentQuestionId);

        try {
            await fetch(`${API_BASE_URL}/api/submit/excel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            window.location.href = '/results.html';
        } catch (error) {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            submitButton.disabled = false;
            window.addEventListener('beforeunload', handleBeforeUnload);
            if (typeof showToast === 'function') showToast('File upload failed! Please try again.', 'error');
        }
    });

    // --- Initial Load ---
    loadRandomExcelQuestion();
});