document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    const token = localStorage.getItem('token');

    // --- Config State ---
    let selectedTime = 120;
    let selectedDiff = 'easy';
    let isTrueSim = false;

    // --- Active engine elements ---
    let passageDisplay, userInput, timerElement, wpmElement, accuracyElement, activeEngine;

    // --- DOM (config & results) ---
    const configView = document.getElementById('config-view');
    const decoratedEngine = document.getElementById('decorated-engine');
    const simEngine = document.getElementById('sim-engine');
    const trueSimCheck = document.getElementById('true-sim-check');
    const resultsView = document.getElementById('results-view');

    const scoreRing = document.getElementById('score-ring');
    const scoreWpm = document.getElementById('score-wpm');
    const resultsTitle = document.getElementById('results-title');
    const statAccuracy = document.getElementById('stat-accuracy');
    const statChars = document.getElementById('stat-chars');
    const statCorrect = document.getElementById('stat-correct');
    const statErrors = document.getElementById('stat-errors');
    const analyzeBtn = document.getElementById('analyze-btn');
    const coachPanel = document.getElementById('coach-panel');
    const coachContent = document.getElementById('coach-content');
    const wpmChartCanvas = document.getElementById('wpm-chart');

    // --- Engine State ---
    let testInProgress = false;
    let sessionStartTime = null;
    let timerInterval = null;
    let wpmSampleInterval = null;
    let currentPassage = '';
    let errorMap = {};
    let errorTrackedPositions = new Set();
    let wpmTimeline = [];

    // --- Drill State ---
    const PRESET_DRILLS = {
        home: { name: 'Home Row', text: 'asdf jkl; fdsa ;lkj asdf jkl; fdsa ;lkj', reps: 10 },
        top: { name: 'Top Row', text: 'qwert yuiop poiuy trewq qwert yuiop', reps: 10 },
        bottom: { name: 'Bottom Row', text: 'zxcvb nm,./ /.,mn bvcxz zxcvb nm,./', reps: 10 },
        numbers: { name: 'Number Row', text: '12345 67890 09876 54321 12345 67890', reps: 10 },
        words: { name: 'Common Words', text: 'the and for with that have from this will your', reps: 15 }
    };
    let selectedDrillType = null;
    let drillText = '';
    let drillReps = 10;
    let drillCurrentRep = 0;
    let drillTotalCorrect = 0;
    let drillTotalTyped = 0;
    let drillTotalErrors = 0;

    // --- JWT Helper ---
    function parseJwt(t) {
        try {
            const b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(decodeURIComponent(atob(b).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
        } catch (e) { return null; }
    }

    // --- Config UI ---
    window.setTime = (s, btn) => {
        selectedTime = s;
        btn.parentElement.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    window.setDiff = (d, btn) => {
        selectedDiff = d;
        btn.parentElement.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    // --- Text Size Control (sim passage only) ---
    let passageFontSize = 1.1; // rem
    window.changePassageSize = (dir) => {
        passageFontSize = Math.max(0.8, Math.min(2, passageFontSize + dir * 0.1));
        const el = document.getElementById('sim-passage');
        if (el) el.style.fontSize = passageFontSize.toFixed(1) + 'rem';
    };

    // ========================================================
    // LAUNCH
    // ========================================================
    window.launchPractice = async () => {
        isTrueSim = trueSimCheck.checked;
        configView.classList.add('hidden');

        if (isTrueSim) {
            simEngine.classList.remove('hidden');
            activeEngine = simEngine;
            passageDisplay = document.getElementById('sim-passage');
            userInput = document.getElementById('sim-input');
            timerElement = document.getElementById('sim-timer');
            wpmElement = document.getElementById('sim-wpm');
            accuracyElement = document.getElementById('sim-accuracy');
        } else {
            decoratedEngine.classList.remove('hidden');
            activeEngine = decoratedEngine;
            passageDisplay = document.getElementById('dec-passage');
            userInput = document.getElementById('dec-input');
            timerElement = document.getElementById('dec-timer');
            wpmElement = document.getElementById('dec-wpm');
            accuracyElement = document.getElementById('dec-accuracy');
        }

        const mins = Math.floor(selectedTime / 60);
        const secs = selectedTime % 60;
        timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        userInput.addEventListener('input', handleInput);
        lockdownInput(userInput);
        setupAdminBypass();
        await loadPassage(selectedDiff);
    };

    // ========================================================
    // INPUT LOCKDOWN
    // ========================================================
    function lockdownInput(ta) {
        ta.addEventListener('paste', e => e.preventDefault());
        ta.addEventListener('cut', e => e.preventDefault());
        ta.addEventListener('drop', e => e.preventDefault());
        ta.addEventListener('keydown', e => {
            if (e.ctrlKey && ['Backspace', 'a', 'z', 'y'].includes(e.key)) e.preventDefault();
            if (e.key === 'Delete') e.preventDefault();
        });
        ta.addEventListener('contextmenu', e => e.preventDefault());
    }

    // ========================================================
    // ADMIN BYPASS
    // ========================================================
    function setupAdminBypass() {
        if (!token) return;
        const payload = parseJwt(token);
        if (!payload || payload.role !== 'admin') return;
        const bypassId = isTrueSim ? 'sim-admin-bypass' : 'dec-admin-bypass';
        const btnId = isTrueSim ? 'sim-quick-submit' : 'dec-quick-submit';
        const div = document.getElementById(bypassId);
        const btn = document.getElementById(btnId);
        if (div) {
            div.style.display = 'block';
            btn.addEventListener('click', () => endPractice());
        }
    }

    // ========================================================
    // LOAD PASSAGE
    // ========================================================
    async function loadPassage(difficulty) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/passages/random?difficulty=${difficulty}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Fetch failed');
            const data = await res.json();
            currentPassage = data.content;

            passageDisplay.innerHTML = '';
            currentPassage.split('').forEach(char => {
                const span = document.createElement('span');
                span.innerText = char;
                passageDisplay.appendChild(span);
            });
            passageDisplay.querySelector('span').classList.add('current');
            userInput.value = '';
            userInput.disabled = false;
            userInput.focus();
        } catch (err) {
            passageDisplay.innerText = 'Error loading passage.';
            userInput.disabled = true;
        }
    }

    // ========================================================
    // INPUT HANDLER
    // ========================================================
    function handleInput() {
        if (!testInProgress) startTimer();

        const spans = passageDisplay.querySelectorAll('span');
        const chars = userInput.value.split('');
        const elapsed = (Date.now() - sessionStartTime) / 60000;
        let correct = 0;

        spans.forEach((span, i) => {
            const uc = chars[i];
            span.classList.remove('current');
            if (uc == null) {
                span.classList.remove('correct', 'incorrect');
            } else if (uc === span.innerText) {
                span.classList.add('correct');
                span.classList.remove('incorrect');
                correct++;
            } else {
                span.classList.add('incorrect');
                span.classList.remove('correct');
                if (!errorTrackedPositions.has(i)) {
                    errorTrackedPositions.add(i);
                    const key = `'${span.innerText}' → '${uc}'`;
                    errorMap[key] = (errorMap[key] || 0) + 1;
                }
            }
        });

        if (elapsed > 0) {
            const wpm = Math.round((chars.length / 5) / elapsed);
            const acc = chars.length > 0 ? Math.round((correct / chars.length) * 100) : 100;
            wpmElement.textContent = wpm;
            accuracyElement.textContent = `${acc}%`;
        }

        if (chars.length < spans.length) {
            spans[chars.length].classList.add('current');
            spans[chars.length].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (chars.length >= spans.length) endPractice();
    }

    // ========================================================
    // TIMER + WPM SAMPLING
    // ========================================================
    function startTimer() {
        if (testInProgress) return;
        testInProgress = true;
        sessionStartTime = Date.now();
        let timeLeft = selectedTime;

        // Sample WPM every 3 seconds
        wpmTimeline = [{ time: 0, wpm: 0 }];
        wpmSampleInterval = setInterval(() => {
            const elapsed = (Date.now() - sessionStartTime) / 60000;
            const typed = userInput.value.length;
            const wpm = elapsed > 0 ? Math.round((typed / 5) / elapsed) : 0;
            const secs = Math.round((Date.now() - sessionStartTime) / 1000);
            wpmTimeline.push({ time: secs, wpm });
        }, 3000);

        timerInterval = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            timerElement.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            if (timeLeft < 30) timerElement.classList.add('timer-danger');
            if (timeLeft <= 0) endPractice();
        }, 1000);
    }

    // ========================================================
    // END PRACTICE
    // ========================================================
    function endPractice() {
        clearInterval(timerInterval);
        clearInterval(wpmSampleInterval);
        userInput.disabled = true;
        testInProgress = false;

        const elapsed = (Date.now() - sessionStartTime) / 60000;
        const totalTyped = userInput.value.length;
        const correctCount = passageDisplay.querySelectorAll('.correct').length;
        const errorCount = totalTyped - correctCount;
        const finalWpm = elapsed > 0 ? Math.round((totalTyped / 5) / elapsed) : 0;
        const finalAccuracy = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 100;

        // Final WPM sample
        const secs = Math.round((Date.now() - sessionStartTime) / 1000);
        wpmTimeline.push({ time: secs, wpm: finalWpm });

        showResults(finalWpm, finalAccuracy, totalTyped, correctCount, errorCount);
    }

    // ========================================================
    // SHOW RESULTS + DRAW WPM CHART
    // ========================================================
    function showResults(wpm, accuracy, totalChars, correct, errors) {
        activeEngine.classList.add('hidden');
        resultsView.classList.add('active');

        // Count-up animation
        const t0 = performance.now();
        const dur = 1200;
        const tick = (now) => {
            const p = Math.min((now - t0) / dur, 1);
            scoreWpm.textContent = Math.round(wpm * p);
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        // Ring
        const deg = Math.min(360, (wpm / 80) * 360);
        requestAnimationFrame(() => scoreRing.style.setProperty('--score-deg', deg + 'deg'));

        // Title
        if (wpm >= 60) { resultsTitle.textContent = '🚀 Speed Demon!'; resultsTitle.style.color = '#4ade80'; }
        else if (wpm >= 40) { resultsTitle.textContent = '⚡ Great Speed!'; resultsTitle.style.color = '#f59e0b'; }
        else if (wpm >= 20) { resultsTitle.textContent = '👍 Getting There!'; resultsTitle.style.color = '#3b82f6'; }
        else { resultsTitle.textContent = '💪 Keep Practicing!'; resultsTitle.style.color = '#f87171'; }

        statAccuracy.textContent = `${accuracy}%`;
        statChars.textContent = totalChars;
        statCorrect.textContent = correct;
        statErrors.textContent = errors;

        analyzeBtn._metrics = { wpm, accuracy, totalChars, correctChars: correct, errorCount: errors };

        drawWpmChart();
    }

    // ========================================================
    // WPM TIMELINE CHART (Canvas)
    // ========================================================
    function drawWpmChart() {
        const canvas = wpmChartCanvas;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        ctx.scale(dpr, dpr);

        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        const pad = { top: 20, right: 20, bottom: 35, left: 45 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        const data = wpmTimeline;
        if (data.length < 2) return;

        const maxTime = data[data.length - 1].time || 1;
        const maxWpm = Math.max(20, ...data.map(d => d.wpm)) * 1.15;

        const x = (t) => pad.left + (t / maxTime) * chartW;
        const y = (w) => pad.top + chartH - (w / maxWpm) * chartH;

        // Background
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--card-background') || '#fff';
        ctx.fillRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const gy = pad.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, gy);
            ctx.lineTo(pad.left + chartW, gy);
            ctx.stroke();
        }

        // Y axis labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(maxWpm * (1 - i / 4));
            const gy = pad.top + (chartH / 4) * i;
            ctx.fillText(val, pad.left - 8, gy + 4);
        }

        // X axis labels
        ctx.textAlign = 'center';
        const xSteps = Math.min(6, data.length);
        for (let i = 0; i < xSteps; i++) {
            const idx = Math.floor((i / (xSteps - 1)) * (data.length - 1));
            const d = data[idx];
            ctx.fillText(`${d.time}s`, x(d.time), H - 8);
        }

        // Gradient fill
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
        grad.addColorStop(0, 'rgba(245, 158, 11, 0.3)');
        grad.addColorStop(1, 'rgba(245, 158, 11, 0.02)');

        ctx.beginPath();
        ctx.moveTo(x(data[0].time), y(0));
        data.forEach(d => ctx.lineTo(x(d.time), y(d.wpm)));
        ctx.lineTo(x(data[data.length - 1].time), y(0));
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        data.forEach((d, i) => {
            if (i === 0) ctx.moveTo(x(d.time), y(d.wpm));
            else ctx.lineTo(x(d.time), y(d.wpm));
        });
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Dots
        data.forEach(d => {
            ctx.beginPath();
            ctx.arc(x(d.time), y(d.wpm), 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // Axis labels
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Time', W / 2, H - 0);
        ctx.save();
        ctx.translate(12, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('WPM', 0, 0);
        ctx.restore();
    }

    // ========================================================
    // AI COACH — Visual Cards
    // ========================================================
    analyzeBtn.addEventListener('click', async () => {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Generating...';

        const metrics = analyzeBtn._metrics;
        let errorDetails = '';
        const sorted = Object.entries(errorMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (sorted.length > 0) errorDetails = sorted.map(([k, c]) => `- ${k} (${c}×)`).join('\n');

        try {
            const res = await fetch(`${API_BASE_URL}/api/practice/typing-analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    wpm: metrics.wpm, accuracy: metrics.accuracy,
                    totalChars: metrics.totalChars, correctChars: metrics.correctChars,
                    errorCount: metrics.errorCount, duration: selectedTime, errorDetails
                })
            });

            if (!res.ok) throw new Error('fail');
            const data = await res.json();
            const a = data.analysis;

            renderCoachCards(a);
            coachPanel.classList.add('active');
            coachPanel.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            if (typeof showToast === 'function') showToast('Failed to generate analysis.', 'error');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🤖 Get AI Typing Coach';
        }
    });

    // ========================================================
    // RENDER COACH CARDS
    // ========================================================
    function renderCoachCards(a) {
        const levelClass = `level-${(a.level || 'average').toLowerCase()}`;

        let html = '';

        // Summary card
        html += `
        <div class="coach-card">
            <div class="coach-card-header">
                <div class="icon" style="background:#fefce8;">📊</div>
                <h4>Performance Summary</h4>
            </div>
            <p><span class="level-badge ${levelClass}">${a.level || 'Average'}</span> ${a.summary || ''}</p>
        </div>`;

        // Speed & Accuracy tips (side by side on larger screens)
        html += `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin-bottom:1rem;">
            <div class="coach-card" style="margin-bottom:0;">
                <div class="coach-card-header">
                    <div class="icon" style="background:#dbeafe;">⚡</div>
                    <h4>Speed Tip</h4>
                </div>
                <p>${a.speedTip || ''}</p>
            </div>
            <div class="coach-card" style="margin-bottom:0;">
                <div class="coach-card-header">
                    <div class="icon" style="background:#fce7f3;">🎯</div>
                    <h4>Accuracy Tip</h4>
                </div>
                <p>${a.accuracyTip || ''}</p>
            </div>
        </div>`;

        // Drill cards
        if (a.drills && a.drills.length > 0) {
            html += `
            <div class="coach-card">
                <div class="coach-card-header">
                    <div class="icon" style="background:#d1fae5;">🏋️</div>
                    <h4>Finger Drill Exercises</h4>
                </div>`;
            a.drills.forEach((d, i) => {
                const safeText = d.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                html += `
                <div class="drill-card">
                    <div class="drill-name">${i + 1}. ${d.name}</div>
                    <div class="drill-text">${d.text}</div>
                    <div class="drill-meta">× ${d.reps} reps · ${d.target}</div>
                    <button class="drill-practice-btn" onclick="launchDrillFromAI('${safeText}', ${d.reps || 10}, '${d.name.replace(/'/g, "\\'")}')">🏋️ Practice This</button>
                </div>`;
            });
            html += `</div>`;
        }

        // Warmup routine
        if (a.warmup && a.warmup.length > 0) {
            html += `
            <div class="coach-card">
                <div class="coach-card-header">
                    <div class="icon" style="background:#ede9fe;">🔥</div>
                    <h4>5-Minute Warm-Up Routine</h4>
                </div>
                <ul class="warmup-list">
                    ${a.warmup.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>`;
        }

        // Goal
        if (a.goalWpm || a.goalAccuracy) {
            html += `
            <div class="goal-bar">
                <div class="goal-icon">🎯</div>
                <div class="goal-text">
                    Next Target: <strong>${a.goalWpm || '–'} WPM</strong> at <strong>${a.goalAccuracy || '–'}%</strong> accuracy
                    <small>A realistic step up from your current performance</small>
                </div>
            </div>`;
        }

        coachContent.innerHTML = html;
    }

    // ========================================================
    // DRILL MODE — Preset selection
    // ========================================================
    window.selectDrill = (type, btn) => {
        selectedDrillType = type;
        document.querySelectorAll('.drill-pick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const customInput = document.getElementById('drill-custom-text');
        if (type === 'custom') {
            customInput.classList.add('visible');
            customInput.focus();
        } else {
            customInput.classList.remove('visible');
        }
    };

    window.launchDrill = () => {
        if (selectedDrillType === 'custom') {
            const customText = document.getElementById('drill-custom-text').value.trim();
            if (!customText) { if (typeof showToast === 'function') showToast('Enter custom drill text.', 'error'); return; }
            drillText = customText;
            drillReps = 10;
            startDrillEngine('Custom Drill');
        } else if (selectedDrillType && PRESET_DRILLS[selectedDrillType]) {
            const p = PRESET_DRILLS[selectedDrillType];
            drillText = p.text;
            drillReps = p.reps;
            startDrillEngine(p.name);
        } else {
            if (typeof showToast === 'function') showToast('Select a drill first.', 'error');
        }
    };

    // Called from AI drill cards "Practice This" button
    window.launchDrillFromAI = (text, reps, name) => {
        drillText = text;
        drillReps = reps || 10;
        // Hide results view, show drill engine
        resultsView.classList.remove('active');
        startDrillEngine(name || 'AI Drill');
    };

    // ========================================================
    // DRILL ENGINE
    // ========================================================
    const drillEngineEl = document.getElementById('drill-engine');
    const drillTitleEl = document.getElementById('drill-title');
    const drillProgressEl = document.getElementById('drill-progress');
    const drillPassageEl = document.getElementById('drill-passage-display');
    const drillInputEl = document.getElementById('drill-input');
    const drillAccFill = document.getElementById('drill-accuracy-fill');
    const drillAccText = document.getElementById('drill-acc-text');
    const drillErrText = document.getElementById('drill-err-text');
    const drillCompleteEl = document.getElementById('drill-complete');
    const drillCompleteMsg = document.getElementById('drill-complete-msg');

    function startDrillEngine(name) {
        configView.classList.add('hidden');
        drillEngineEl.classList.remove('hidden');
        drillCompleteEl.classList.add('hidden');
        drillTitleEl.textContent = `🏋️ ${name}`;
        drillCurrentRep = 0;
        drillTotalCorrect = 0;
        drillTotalTyped = 0;
        drillTotalErrors = 0;
        loadDrillRep();
    }

    function loadDrillRep() {
        drillCurrentRep++;
        drillProgressEl.textContent = `Rep ${drillCurrentRep} of ${drillReps}`;

        drillPassageEl.innerHTML = '';
        drillText.split('').forEach(ch => {
            const span = document.createElement('span');
            span.innerText = ch;
            drillPassageEl.appendChild(span);
        });
        drillPassageEl.querySelector('span').classList.add('current');

        drillInputEl.value = '';
        drillInputEl.disabled = false;
        drillInputEl.focus();

        // Remove old listener, add fresh
        drillInputEl.removeEventListener('input', handleDrillInput);
        drillInputEl.addEventListener('input', handleDrillInput);
        lockdownInput(drillInputEl);
    }

    function handleDrillInput() {
        const spans = drillPassageEl.querySelectorAll('span');
        const chars = drillInputEl.value.split('');
        let correct = 0;

        spans.forEach((span, i) => {
            const uc = chars[i];
            span.classList.remove('current');
            if (uc == null) {
                span.classList.remove('correct', 'incorrect');
            } else if (uc === span.innerText) {
                span.classList.add('correct');
                span.classList.remove('incorrect');
                correct++;
            } else {
                span.classList.add('incorrect');
                span.classList.remove('correct');
            }
        });

        // Update accuracy bar
        const acc = chars.length > 0 ? Math.round((correct / chars.length) * 100) : 100;
        drillAccFill.style.width = acc + '%';
        drillAccText.textContent = acc + '%';
        drillErrText.textContent = chars.length - correct;

        // Scroll current character
        if (chars.length < spans.length) {
            spans[chars.length].classList.add('current');
        }

        // Rep complete
        if (chars.length >= spans.length) {
            drillTotalCorrect += correct;
            drillTotalTyped += chars.length;
            drillTotalErrors += (chars.length - correct);

            if (drillCurrentRep >= drillReps) {
                completeDrill();
            } else {
                // Small delay then next rep
                drillInputEl.disabled = true;
                setTimeout(() => loadDrillRep(), 400);
            }
        }
    }

    function completeDrill() {
        drillInputEl.disabled = true;
        drillCompleteEl.classList.remove('hidden');
        const finalAcc = drillTotalTyped > 0 ? Math.round((drillTotalCorrect / drillTotalTyped) * 100) : 100;
        drillCompleteMsg.textContent = `${drillReps} reps completed! Accuracy: ${finalAcc}% · Errors: ${drillTotalErrors}`;
    }

    window.restartDrill = () => {
        drillCompleteEl.classList.add('hidden');
        drillCurrentRep = 0;
        drillTotalCorrect = 0;
        drillTotalTyped = 0;
        drillTotalErrors = 0;
        loadDrillRep();
    };

    window.exitDrill = () => {
        drillEngineEl.classList.add('hidden');
        drillInputEl.removeEventListener('input', handleDrillInput);
        configView.classList.remove('hidden');
    };
});