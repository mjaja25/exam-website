import { client } from '../api/client.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const timerElement = document.getElementById('timer');
    const mobileTimerElement = document.getElementById('mobile-timer');
    const progressBar = document.getElementById('progress-bar');
    const excelForm = document.getElementById('excel-form');
    const fileInput = document.getElementById('excel-file');
    const downloadBtn = document.getElementById('download-btn');
    const questionNameElement = document.getElementById('question-name');

    const token = auth.getToken();
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    let currentQuestionId = null;
    let timerInterval;
    let testInProgress = false;

    const handleBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    async function loadRandomExcelQuestion() {
        try {
            const question = await client.get('/api/excel-questions/random');

            if (questionNameElement) questionNameElement.textContent = question.questionName;
            if (downloadBtn) downloadBtn.href = question.questionFilePath;
            currentQuestionId = question._id;

            if (downloadBtn) downloadBtn.removeAttribute('disabled');
            startTimer();
        } catch (error) {
            if (questionNameElement) questionNameElement.textContent = 'Error loading question. Please add questions in the admin panel.';
            if (downloadBtn) downloadBtn.textContent = 'Unavailable';
        }
    }

    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;

        const startTime = new Date().getTime();
        const totalDuration = 420 * 1000;

        timerInterval = setInterval(() => {
            const timeElapsed = new Date().getTime() - startTime;
            const remainingMilliseconds = totalDuration - timeElapsed;

            if (remainingMilliseconds <= 0) {
                if (fileInput && fileInput.files.length > 0) {
                    excelForm?.requestSubmit();
                } else {
                    window.removeEventListener('beforeunload', handleBeforeUnload);
                    window.location.href = '/results.html';
                }
                return;
            }

            const stageBasePercent = 66.66;
            const stageDurationPercent = (timeElapsed / totalDuration) * 33.34;
            if (progressBar) progressBar.style.width = `${stageBasePercent + stageDurationPercent}%`;

            const minutes = Math.floor((remainingMilliseconds / 1000) / 60);
            const seconds = Math.floor((remainingMilliseconds / 1000) % 60);
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timerElement) timerElement.textContent = formattedTime;
            if (mobileTimerElement) mobileTimerElement.textContent = formattedTime;
        }, 1000);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            setTimeout(() => {
                window.addEventListener('beforeunload', handleBeforeUnload);
            }, 100);
        });
    }

    if (excelForm) {
        excelForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearInterval(timerInterval);

            const submitButton = excelForm.querySelector('button[type="submit"]');
            const loadingOverlay = document.getElementById('loading-overlay');
            if (submitButton) submitButton.disabled = true;
            if (loadingOverlay) loadingOverlay.style.display = 'flex';

            const sessionId = localStorage.getItem('currentSessionId');
            const formData = new FormData();
            formData.append('excelFile', fileInput?.files[0]);
            formData.append('sessionId', sessionId);
            formData.append('questionId', currentQuestionId);

            try {
                await client.upload('/api/submit/excel', formData);
                window.location.href = '/results.html';
            } catch (error) {
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
                window.addEventListener('beforeunload', handleBeforeUnload);
                ui.showToast('File upload failed! Please try again.', 'error');
            }
        });
    }

    loadRandomExcelQuestion();
});
