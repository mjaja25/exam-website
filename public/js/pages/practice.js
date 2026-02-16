import { auth } from '../utils/auth.js';
import { client } from '../api/client.js';
import { ui } from '../utils/ui.js';
import { TypingEngine } from '../core/TypingEngine.js';
import { PRESET_DRILLS } from '../core/Drills.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Check (Soft check for practice, but essential for stats)
    if (!auth.getToken()) {
        const loginLink = document.getElementById('login-link'); // If exists
        // window.location.href = '/login.html'; // Or redirect
    }

    // 2. DOM Elements
    const elements = {
        configView: document.getElementById('config-view'),
        decoratedEngine: document.getElementById('decorated-engine'),
        simEngine: document.getElementById('sim-engine'),
        trueSimCheck: document.getElementById('true-sim-check'),

        // Sim Engine Display
        simDisplay: document.getElementById('sim-passage'),
        simInput: document.getElementById('sim-input'),
        simTimer: document.getElementById('sim-timer'),
        simWpm: document.getElementById('sim-wpm'),
        simAcc: document.getElementById('sim-accuracy'),

        // Dec Engine Display
        decDisplay: document.getElementById('dec-passage'),
        decInput: document.getElementById('dec-input'),
        decTimer: document.getElementById('dec-timer'),
        decWpm: document.getElementById('dec-wpm'),
        decAcc: document.getElementById('dec-accuracy'),

        // Results
        resultsView: document.getElementById('results-view'),
        scoreWpm: document.getElementById('score-wpm'),
        statAcc: document.getElementById('stat-accuracy'),
        statChars: document.getElementById('stat-chars'),
        statCorrect: document.getElementById('stat-correct'),
        statErrors: document.getElementById('stat-errors')
    };

    // 3. State
    let selectedTime = 120; // seconds
    let selectedDiff = 'easy';
    let currentDrill = null; // { type, difficulty, reps, currentRep }
    let engine = null;

    // 4. UI Bindings - Config
    window.setTime = (s, btn) => {
        selectedTime = s;
        updateActiveBtn(btn);
        clearDrillSelection();
    };

    window.setDiff = (d, btn) => {
        selectedDiff = d;
        updateActiveBtn(btn);
    };

    window.startPractice = startTimerPractice;

    // Drill Buttons
    document.querySelectorAll('.drill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const drillType = btn.dataset.drill; // e.g., 'home'
            selectDrill(drillType, btn);
        });
    });

    function updateActiveBtn(btn) {
        btn.parentElement.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    function clearDrillSelection() {
        currentDrill = null;
        document.querySelectorAll('.drill-btn').forEach(b => b.classList.remove('active'));
        // Re-enable time buttons if disabled?
    }

    function selectDrill(type, btn) {
        currentDrill = { type, difficulty: selectedDiff, reps: 10, currentRep: 0 };
        document.querySelectorAll('.drill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Drills ignore time, so maybe visual feedback?
        ui.showToast(`Selected ${PRESET_DRILLS[type].name} - ${selectedDiff.toUpperCase()}`, 'info');
    }

    // 5. Launch Logic
    async function startTimerPractice() {
        elements.configView.classList.add('hidden');

        const isSim = elements.trueSimCheck.checked;
        const activeContainer = isSim ? elements.simEngine : elements.decoratedEngine;
        activeContainer.classList.remove('hidden');

        // Setup Engine Config
        const config = {
            displayElement: isSim ? elements.simDisplay : elements.decDisplay,
            inputElement: isSim ? elements.simInput : elements.decInput,
            timerElement: isSim ? elements.simTimer : elements.decTimer,
            wpmElement: isSim ? elements.simWpm : elements.decWpm,
            accuracyElement: isSim ? elements.simAcc : elements.decAcc,
            onComplete: handleComplete
        };

        if (currentDrill) {
            config.mode = 'infinite';
            config.duration = 0;
            engine = new TypingEngine(config);
            loadDrillRep();
        } else {
            config.mode = 'timer';
            config.duration = selectedTime;
            engine = new TypingEngine(config);
            loadRandomPassage();
        }
    }

    // 6. Content Loading
    async function loadRandomPassage() {
        try {
            const data = await client.get(`/api/passages/random?difficulty=${selectedDiff}`);
            engine.loadPassage(data.content);
            engine.inputElement.focus();
        } catch (err) {
            ui.showToast('Failed to load passage', 'error');
            console.error(err);
        }
    }

    function loadDrillRep() {
        if (currentDrill.currentRep >= currentDrill.reps) {
            finishDrillSession();
            return;
        }

        const drillData = PRESET_DRILLS[currentDrill.type];
        const text = drillData[currentDrill.difficulty] || drillData['medium'];

        // Show Drill Progress somewhere?
        ui.showToast(`Rep ${currentDrill.currentRep + 1} / ${currentDrill.reps}`, 'info');

        engine.loadPassage(text);
        engine.inputElement.focus();
    }

    // 7. Completion Handlers
    async function handleComplete(stats) {
        if (currentDrill) {
            // Drill Mode: One rep done
            currentDrill.currentRep++;
            // Aggregate stats if needed?
            // Small pause then next rep
            setTimeout(() => loadDrillRep(), 500);
        } else {
            // Timer Mode: Finished
            showResults(stats);
            savePracticeResult(stats);
        }
    }

    function finishDrillSession() {
        // Calculate average? For now just show "Done"
        ui.showToast('Drill Session Complete!', 'success');
        setTimeout(() => window.location.reload(), 2000);
    }

    function showResults(stats) {
        // Hide engines
        elements.simEngine.classList.add('hidden');
        elements.decoratedEngine.classList.add('hidden');
        elements.resultsView.classList.remove('hidden');

        elements.scoreWpm.textContent = stats.wpm;
        elements.statAcc.textContent = stats.accuracy + '%';
        elements.statChars.textContent = stats.totalChars;
        elements.statCorrect.textContent = stats.correctChars;
        elements.statErrors.textContent = stats.totalChars - stats.correctChars;
    }

    async function savePracticeResult(stats) {
        if (!auth.getToken()) return;
        try {
            // We need a specific endpoint for practice results or use the existing one with a flag
            // The existing backend `practice.js` route should handle this.
            await client.post('/api/practice/submit', {
                wpm: stats.wpm,
                accuracy: stats.accuracy,
                totalChars: stats.totalChars,
                duration: stats.durationMin * 60,
                difficulty: selectedDiff
            });
            ui.showToast('Result saved!', 'success');
        } catch (err) {
            console.error("Save error", err);
        }
    }

    // --- Compatibility / Expose ---
    window.changePassageSize = (dir) => {
        const el = document.getElementById('sim-passage');
        if (!el) return;
        let size = parseFloat(el.style.fontSize) || 1.1;
        size = Math.max(0.8, Math.min(2, size + dir * 0.1));
        el.style.fontSize = size + 'rem';
    };
});
