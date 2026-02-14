document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration State ---
    let selectedTime = 120; // Default 2 mins
    let selectedDiff = 'easy';

    // --- Engine Elements ---
    const configView = document.getElementById('config-view');
    const engineView = document.getElementById('practice-engine');
    const passageDisplay = document.getElementById('passage-display');
    const userInput = document.getElementById('user-input');
    const timerElement = document.getElementById('timer');

    // --- Helpers for Config UI ---
    window.setTime = (seconds, btn) => {
        selectedTime = seconds;
        updateActiveBtn(btn, 'time');
    };

    window.setDiff = (diff, btn) => {
        selectedDiff = diff;
        updateActiveBtn(btn, 'diff');
    };

    function updateActiveBtn(clickedBtn, group) {
        clickedBtn.parentElement.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
        clickedBtn.classList.add('active');
    }

    // --- Launch Function ---
    window.launchPractice = async () => {
        configView.classList.add('hidden');
        engineView.classList.remove('hidden');

        // Fetch passage based on difficulty (New API endpoint suggested)
        await loadPassage(selectedDiff);
        startPracticeTimer(selectedTime);
    };

    // --- Core Logic (Simplified version of your script.js) ---
    async function loadPassage(difficulty) {
        const token = localStorage.getItem('token');
        try {
            // Reusing your random passage route
            const res = await fetch(`/api/passages/random?difficulty=${difficulty}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            passageDisplay.innerHTML = data.content.split('').map(char => `<span>${char}</span>`).join('');
            passageDisplay.querySelector('span').classList.add('current');
            userInput.focus();
        } catch (err) {
            passageDisplay.innerText = "Error loading passage.";
        }
    }

    function startPracticeTimer(duration) {
        let timeLeft = duration;
        const interval = setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(interval);
                if (typeof showToast === 'function') showToast('Practice Session Finished!', 'success');
                location.reload(); // Returns to config screen
            }
        }, 1000);
    }

    // Note: You would import/reuse your handleInput() logic from script.js here
});