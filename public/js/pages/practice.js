import { auth } from '../utils/auth.js';
import { client } from '../api/client.js';
import { ui } from '../utils/ui.js';
import { TypingEngine } from '../core/TypingEngine.js';
import { KeyboardHeatmap } from '../components/KeyboardHeatmap.js';
import { ErrorAnalyzer } from '../components/ErrorAnalyzer.js';
import { PRESET_DRILLS } from '../core/Drills.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Check
    if (!auth.isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    // 2. State
    const state = {
        config: {
            duration: 120, // seconds
            difficulty: 'easy',
            mode: 'standard', // 'standard' | 'simulation'
            wordSet: '1k'
        },
        drill: {
            active: false,
            type: null,
            reps: 10,
            currentRep: 0,
            text: ''
        },
        engine: null,
        heatmap: null,
        analyzer: new ErrorAnalyzer()
    };

    // 3. DOM Elements
    const dom = {
        // Views
        configView: document.getElementById('config-view'),
        decEngine: document.getElementById('decorated-engine'),
        simEngine: document.getElementById('sim-engine'),
        drillEngine: document.getElementById('drill-engine'),
        resultsView: document.getElementById('results-view'),

        // Config Controls
        durationBtns: document.querySelectorAll('[data-time]'),
        diffBtns: document.querySelectorAll('[data-diff]'),
        modeBtns: document.querySelectorAll('.mode-btn'),
        drillBtns: document.querySelectorAll('[data-drill]'),
        wordSetBtns: document.querySelectorAll('.word-set-btn'),
        customDrillInput: document.getElementById('drill-custom-text'),

        // Results Elements
        wpmDisplay: document.getElementById('wpm-display'), // In score circle
        scoreWpm: document.getElementById('score-wpm'), // Alternate ID if used
        accDisplay: document.getElementById('accuracy-display'), // In stats row
        statAcc: document.getElementById('stat-accuracy'), // In results grid
        statChars: document.getElementById('stat-chars'),
        statErrors: document.getElementById('stat-errors'),
        scoreRing: document.getElementById('score-ring'),
        
        // Analysis Containers
        heatmapContainer: document.getElementById('keyboard-heatmap'),
        topErrorsChart: document.getElementById('top-errors-chart'),
        fingerStats: document.getElementById('finger-stats'),
        recommendationsList: document.getElementById('recommendations-list'),
        progressChart: document.getElementById('progress-chart'),
        perfChart: document.getElementById('performance-chart')
    };

    // 4. Initialization
    initUI();

    // 5. Event Listeners
    
    // Duration Selection
    dom.durationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.config.duration = parseInt(btn.dataset.time);
            updateActiveGroup(dom.durationBtns, btn);
        });
    });

    // Difficulty Selection
    dom.diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.config.difficulty = btn.dataset.diff;
            updateActiveGroup(dom.diffBtns, btn);
        });
    });

    // Mode Selection
    dom.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.config.mode = btn.dataset.mode;
            dom.modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Word Set Selection
    dom.wordSetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.config.wordSet = btn.dataset.set;
            updateActiveGroup(dom.wordSetBtns, btn);
        });
    });

    // Drill Selection
    dom.drillBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.drill;
            updateActiveGroup(dom.drillBtns, btn);
            
            // Show/hide custom input
            if (type === 'custom') {
                dom.customDrillInput.classList.remove('hidden');
                dom.customDrillInput.focus();
            } else {
                dom.customDrillInput.classList.add('hidden');
            }
            state.drill.type = type;
        });
    });

    // Global Functions for HTML onClick
    window.launchPractice = launchPractice;
    window.launchDrill = launchDrill;
    window.restartDrill = restartDrill;
    window.exitDrill = backToConfig;
    window.backToConfig = backToConfig;
    window.retryPractice = retryPractice;
    window.backToResults = showDrillResults; // For drill intermediate results
    window.changePassageSize = changePassageSize;

    // Heatmap Toggles
    document.querySelectorAll('.heatmap-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            document.querySelectorAll('.heatmap-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (state.heatmap) state.heatmap.setMode(mode);
        });
    });


    // --- Core Functions ---

    function initUI() {
        // Set default active states based on initial config
        // (Optional: restore from localStorage)
    }

    function updateActiveGroup(nodeList, activeEl) {
        nodeList.forEach(el => el.classList.remove('active'));
        activeEl.classList.add('active');
    }

    async function launchPractice() {
        state.drill.active = false;
        switchView('engine');

        const isSim = state.config.mode === 'simulation';
        const engineContainer = isSim ? dom.simEngine : dom.decEngine;
        
        // Hide other engines
        dom.simEngine.classList.add('hidden');
        dom.decEngine.classList.add('hidden');
        dom.drillEngine.classList.add('hidden');
        
        engineContainer.classList.remove('hidden');

        // Map elements based on mode
        const elements = {
            displayElement: engineContainer.querySelector('.passage-display'),
            inputElement: engineContainer.querySelector('.engine-textarea'),
            timerElement: engineContainer.querySelector('[id*="timer"]'),
            progressBar: null,
            wpmElement: engineContainer.querySelector('[id*="wpm"]'),
            accuracyElement: engineContainer.querySelector('[id*="accuracy"]')
        };

        // Fix specific IDs for better reliability
        if (isSim) {
            elements.displayElement = document.getElementById('sim-passage');
            elements.inputElement = document.getElementById('sim-input');
            elements.timerElement = document.getElementById('sim-timer');
            elements.wpmElement = document.getElementById('sim-wpm');
            elements.accuracyElement = null; // No accuracy display in minimal mode
        } else {
            elements.displayElement = document.getElementById('dec-passage');
            elements.inputElement = document.getElementById('dec-input');
            elements.timerElement = document.getElementById('dec-timer');
            elements.wpmElement = document.getElementById('dec-wpm');
            elements.accuracyElement = document.getElementById('dec-accuracy');
        }

        // Initialize Engine
        state.engine = new TypingEngine({
            ...elements,
            duration: state.config.duration,
            isSimulationMode: isSim,
            onComplete: handleSessionComplete
        });

        // Load Passage
        try {
            const data = await client.get(`/api/passages/random?difficulty=${state.config.difficulty}`);
            state.engine.loadPassage(data.content);
            state.engine.passageId = data._id; // Store for submission
            elements.inputElement.focus();
            
            // Setup Admin Bypass
            setupAdminBypass(isSim ? 'sim' : 'dec');
            
        } catch (err) {
            ui.showToast('Failed to load passage', 'error');
            console.error(err);
            backToConfig();
        }
    }

    function launchDrill() {
        if (!state.drill.type) {
            ui.showToast('Please select a drill type', 'error');
            return;
        }

        state.drill.active = true;
        state.drill.currentRep = 0;
        
        switchView('drill');
        dom.drillEngine.classList.remove('hidden');
        
        // Setup Drill Engine
        const elements = {
            displayElement: document.getElementById('drill-passage-display'),
            inputElement: document.getElementById('drill-input'),
            timerElement: null, // Drills are untimed usually
            wpmElement: document.getElementById('drill-wpm-text'),
            accuracyElement: document.getElementById('drill-acc-text')
        };

        state.engine = new TypingEngine({
            ...elements,
            duration: 0, // Infinite/Untimed
            onComplete: handleDrillRepComplete
        });

        loadDrillRep();
    }

    function loadDrillRep() {
        let text = '';
        
        if (state.drill.type === 'custom') {
            text = dom.customDrillInput.value.trim();
            if (!text) {
                ui.showToast('Please enter custom text', 'error');
                backToConfig();
                return;
            }
        } else {
            const drillData = PRESET_DRILLS[state.drill.type];
            // Simple logic: cycle through available lines or random
            const difficultyKey = state.config.difficulty; 
            // PRESET_DRILLS structure: { home: { easy: "...", medium: "..." } }
            // Or if it's an array of lines. Adapting to common structure.
            // Assuming Drills.js exports object with keys matching drill types
            
            if (drillData) {
                // If structure is { easy: [...], medium: [...] }
                const lines = drillData[difficultyKey] || drillData['medium'] || drillData;
                if (Array.isArray(lines)) {
                    text = lines[state.drill.currentRep % lines.length];
                } else if (typeof lines === 'string') {
                    text = lines;
                }
            } else {
                text = "Error loading drill.";
            }
        }

        document.getElementById('drill-progress').textContent = `Rep ${state.drill.currentRep + 1} / ${state.drill.reps}`;
        state.engine.loadPassage(text);
        state.engine.inputElement.focus();
    }

    function handleDrillRepComplete(stats) {
        state.drill.currentRep++;
        
        if (state.drill.currentRep >= state.drill.reps) {
            // Drill Session Complete
            finishDrillSession(stats);
        } else {
            // Next Rep
            ui.showToast('Rep Complete! Next...', 'success');
            setTimeout(() => {
                loadDrillRep();
            }, 1000);
        }
    }

    function finishDrillSession(lastStats) {
        const modal = document.getElementById('drill-complete');
        const msg = document.getElementById('drill-complete-msg');
        
        msg.textContent = `Completed ${state.drill.reps} repetitions with final accuracy ${lastStats.accuracy}%`;
        modal.classList.remove('hidden');
        
        // In drill mode, we might accumulate stats differently
        // For now, just submit the last rep or aggregate?
        // Let's submit the cumulative stats if the engine supported it, 
        // but current engine resets on loadPassage. 
        // We'll save the last rep as a sample.
        
        // We can add a "Back to Results" button behavior here
        const resultsBtn = document.getElementById('drill-back-to-results-btn');
        resultsBtn.classList.remove('hidden');
        
        // Prepare stats for submission/view
        // Merging logic would be complex without engine support, so saving last rep
        state.lastStats = lastStats; 
    }

    function showDrillResults() {
        document.getElementById('drill-complete').classList.add('hidden');
        handleSessionComplete(state.lastStats);
    }

    function restartDrill() {
        document.getElementById('drill-complete').classList.add('hidden');
        state.drill.currentRep = 0;
        loadDrillRep();
    }

    async function handleSessionComplete(stats) {
        // 1. Switch to Results View
        switchView('results');
        
        // 2. Check for personal record and render basic stats
        const isNewRecord = await checkAndShowPersonalRecord(stats.wpm);
        renderBasicStats(stats, isNewRecord);
        
        // 3. Render Visualizations
        if (state.heatmap) {
            state.heatmap.updateData(state.engine.keystrokes);
        } else {
            state.heatmap = new KeyboardHeatmap(dom.heatmapContainer, state.engine.keystrokes);
            state.heatmap.render();
        }

        // 4. Analyze Errors
        const analysis = state.analyzer.analyze(state.engine.errors, state.engine.keystrokes);
        state.analyzer.renderTopErrors(dom.topErrorsChart, analysis.topErrors);
        state.analyzer.renderFingerStats(dom.fingerStats, analysis.fingerPerformance);
        state.analyzer.renderRecommendations(dom.recommendationsList, analysis.recommendations);

        // 5. Submit Data
        await submitPracticeData(stats);

        // 6. Load History
        loadHistoricalProgress();
    }

    async function checkAndShowPersonalRecord(currentWpm) {
        try {
            const res = await client.get('/api/practice/typing-stats?timeframe=365');
            const previousBest = res.stats?.bestWpm || 0;
            
            if (currentWpm > previousBest && previousBest > 0) {
                // New personal record!
                triggerConfetti();
                const badge = document.getElementById('personal-record-badge');
                if (badge) {
                    badge.classList.remove('hidden');
                    badge.innerHTML = '<span>New Personal Record!</span>';
                }
                return true;
            }
        } catch (err) {
            console.error('Failed to check personal record:', err);
        }
        return false;
    }

    function triggerConfetti() {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                colors: ['#58CC02', '#1CB0F6', '#FF9600', '#4ade80', '#fbbf24']
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                colors: ['#58CC02', '#1CB0F6', '#FF9600', '#4ade80', '#fbbf24']
            });
        }, 250);
    }

    function renderBasicStats(stats, isNewRecord = false) {
        // WPM Ring with animation
        const wpm = stats.wpm;
        const scoreWpmEl = dom.scoreWpm || dom.wpmDisplay;
        const scoreRing = dom.scoreRing;
        
        // Animate WPM counter
        animateValue(scoreWpmEl, 0, wpm, 1000);
        
        // Animate score circle ring
        if (scoreRing) {
            const progress = Math.min((wpm / 100) * 360, 360);
            scoreRing.style.setProperty('--progress', '0deg');
            setTimeout(() => {
                scoreRing.style.transition = 'background 1s ease-out';
                scoreRing.style.background = `conic-gradient(var(--primary) ${progress}deg, var(--bg-input) 0deg)`;
            }, 100);
        }
        
        // Stats Grid
        if (dom.statAcc) dom.statAcc.textContent = stats.accuracy + '%';
        if (dom.statChars) dom.statChars.textContent = stats.totalChars;
        if (dom.statErrors) dom.statErrors.textContent = stats.errorCount;
    }

    function animateValue(element, start, end, duration) {
        if (!element) return;
        const startTimestamp = performance.now();
        const step = (timestamp) => {
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            element.textContent = Math.floor(easeProgress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    async function submitPracticeData(stats) {
        try {
            const payload = {
                category: state.drill.active ? `drill-${state.drill.type}` : 'typing',
                difficulty: state.config.difficulty,
                mode: state.config.mode,
                duration: stats.durationMin * 60,
                wpm: stats.wpm,
                accuracy: stats.accuracy,
                totalKeystrokes: stats.totalChars, // Approximation if raw keystrokes not summed
                correctKeystrokes: stats.correctChars,
                errorCount: stats.errorCount,
                passageLength: stats.totalChars,
                errors: stats.errors,
                keystrokes: stats.keystrokes, // Array format from engine
                fingerStats: stats.fingerStats,
                drillType: state.drill.active ? state.drill.type : null,
                drillRepetitions: state.drill.active ? state.drill.reps : null
            };

            await client.post('/api/practice/typing', payload);
            ui.showToast('Practice session saved!', 'success');
        } catch (err) {
            console.error('Submission error:', err);
            ui.showToast('Failed to save progress', 'error');
        }
    }

    async function loadHistoricalProgress() {
        try {
            const res = await client.get('/api/practice/typing-stats?timeframe=30');
            if (res.trend && res.trend.length > 0) {
                renderProgressChart(res.trend);
            } else {
                dom.progressChart.innerHTML = '<p class="text-center text-muted">Complete more sessions to see your progress!</p>';
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderProgressChart(trendData) {
        // Destroy existing if needed
        if (window.practiceChartInstance) {
            window.practiceChartInstance.destroy();
        }

        const canvas = document.createElement('canvas');
        dom.progressChart.innerHTML = '';
        dom.progressChart.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        window.practiceChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'WPM',
                    data: trendData.map(d => d.wpm),
                    borderColor: '#10b981',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // --- Navigation Helpers ---

    function switchView(viewName) {
        // Hide all
        dom.configView.classList.add('hidden');
        dom.decEngine.classList.add('hidden');
        dom.simEngine.classList.add('hidden');
        dom.drillEngine.classList.add('hidden');
        dom.resultsView.classList.add('hidden');

        // Show target
        if (viewName === 'config') dom.configView.classList.remove('hidden');
        else if (viewName === 'results') dom.resultsView.classList.remove('hidden');
        // 'engine' and 'drill' handled in launch functions specifically
    }

    function backToConfig() {
        switchView('config');
        state.engine = null; // Cleanup
    }

    function retryPractice() {
        if (state.drill.active) {
            launchDrill();
        } else {
            launchPractice();
        }
    }

    function changePassageSize(dir) {
        const el = document.getElementById('sim-passage');
        if (!el) return;
        let size = parseFloat(window.getComputedStyle(el).fontSize);
        // Approximate rem conversion or just use px
        // Let's stick to simple scaling
        el.style.fontSize = `calc(${window.getComputedStyle(el).fontSize} + ${dir * 2}px)`;
    }

    function setupAdminBypass(prefix) {
        if (auth.isAdmin()) {
            const bypassDiv = document.getElementById(`${prefix}-admin-bypass`);
            const btn = document.getElementById(`${prefix}-quick-submit`);
            if (bypassDiv && btn) {
                bypassDiv.style.display = 'block';
                btn.onclick = () => {
                    if (state.engine) {
                        state.engine.end();
                    }
                };
            }
        }
    }
});
