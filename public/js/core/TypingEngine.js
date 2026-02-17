export class TypingEngine {
    constructor(config) {
        this.displayElement = config.displayElement;
        this.inputElement = config.inputElement;
        this.timerElement = config.timerElement;
        this.progressBar = config.progressBar;
        this.wpmElement = config.wpmElement;
        this.accuracyElement = config.accuracyElement;

        this.duration = config.duration || 300;
        this.onComplete = config.onComplete || (() => { });
        this.onTick = config.onTick || (() => { });

        this.timerInterval = null;
        this.startTime = null;
        this.isRunning = false;
        this.currentPassage = '';

        // Tracking data for heatmap and error analysis
        this.keystrokes = {};
        this.errors = [];
        this.fingerMap = this.getFingerMap();

        this.bindEvents();
    }

    getFingerMap() {
        return {
            leftPinky: '1qaz`~!QA',
            leftRing: '2wsx@WSX',
            leftMiddle: '3edc#EDC',
            leftIndex: '4rfv5tgb$RFV%TGB',
            rightIndex: '6yhn7ujm^YHN&UJM',
            rightMiddle: '8ik,(IK<',
            rightRing: '9ol.)OL>',
            rightPinky: '0p;/-=P:?_+[]{}\\|\'"',
            thumbs: ' '
        };
    }

    loadPassage(text) {
        this.currentPassage = text;
        this.displayElement.innerHTML = '';
        this.inputElement.value = '';
        this.inputElement.disabled = false;
        this.isRunning = false;
        this.startTime = null;
        
        // Reset tracking data
        this.keystrokes = {};
        this.errors = [];
        
        if (this.timerInterval) clearInterval(this.timerInterval);

        if (this.timerElement) this.timerElement.textContent = this.formatTime(this.duration);
        if (this.progressBar) this.progressBar.style.width = '0%';
        if (this.wpmElement) this.wpmElement.textContent = '0';
        if (this.accuracyElement) this.accuracyElement.textContent = '100%';

        text.split('').forEach(char => {
            const span = document.createElement('span');
            span.innerText = char;
            this.displayElement.appendChild(span);
        });

        if (this.displayElement.firstChild) {
            this.displayElement.firstChild.classList.add('current');
        }
    }

    bindEvents() {
        this.inputElement.addEventListener('input', () => this.handleInput());
        this.inputElement.addEventListener('keydown', (e) => this.handleKeydown(e));

        ['paste', 'copy', 'cut'].forEach(evt => {
            this.inputElement.addEventListener(evt, e => e.preventDefault());
        });
    }

    handleKeydown(e) {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
        }
    }

    trackKeystroke(char, isCorrect) {
        if (!this.keystrokes[char]) {
            this.keystrokes[char] = { count: 0, errors: 0 };
        }
        this.keystrokes[char].count++;
        if (!isCorrect) {
            this.keystrokes[char].errors++;
        }
    }

    trackError(typed, expected, position) {
        this.errors.push({
            key: typed,
            expected,
            position,
            timestamp: Date.now()
        });
    }

    getFingerStats() {
        const stats = {};
        for (const [finger, keys] of Object.entries(this.fingerMap)) {
            let correct = 0, errors = 0;
            for (const key of keys) {
                if (this.keystrokes[key]) {
                    correct += this.keystrokes[key].count - this.keystrokes[key].errors;
                    errors += this.keystrokes[key].errors;
                }
            }
            stats[finger] = { correct, errors };
        }
        return stats;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startTime = Date.now();

        this.timerInterval = setInterval(() => {
            const elapsed = (Date.now() - this.startTime) / 1000;
            const remaining = Math.max(0, this.duration - elapsed);

            this.updateTimerDisplay(remaining, elapsed);
            this.onTick(remaining);

            if (remaining <= 0) {
                this.end();
            }
        }, 1000);
    }

    end() {
        this.isRunning = false;
        clearInterval(this.timerInterval);
        this.inputElement.disabled = true;

        const stats = this.calculateStats();
        this.onComplete(stats);
    }

    handleInput() {
        if (!this.isRunning && this.inputElement.value.length > 0) {
            this.start();
        }

        const val = this.inputElement.value;
        const chars = val.split('');
        const spans = this.displayElement.querySelectorAll('span');

        let correct = 0;

        spans.forEach((span, i) => {
            const char = chars[i];
            span.classList.remove('current', 'correct', 'incorrect');

            if (char == null) {
                // Not typed yet
            } else if (char === span.innerText) {
                span.classList.add('correct');
                correct++;
                this.trackKeystroke(char, true);
            } else {
                span.classList.add('incorrect');
                this.trackKeystroke(char, false);
                // Only track error if this is a new character
                if (i === chars.length - 1) {
                    this.trackError(char, span.innerText, i);
                }
            }
        });

        if (chars.length < spans.length) {
            const next = spans[chars.length];
            next.classList.add('current');
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            this.end();
        }

        if (this.startTime) {
            const elapsedMin = (Date.now() - this.startTime) / 60000;
            if (elapsedMin > 0) {
                const wpm = Math.round((correct / 5) / elapsedMin);
                if (this.wpmElement) this.wpmElement.textContent = wpm;

                const accuracy = Math.round((correct / chars.length) * 100);
                if (this.accuracyElement) this.accuracyElement.textContent = `${accuracy}%`;
            }
        }
    }

    updateTimerDisplay(remainingSec, elapsedSec) {
        if (this.timerElement) {
            this.timerElement.textContent = this.formatTime(remainingSec);
            if (remainingSec < 30) this.timerElement.classList.add('timer-danger');
        }

        if (this.progressBar) {
            const percent = (elapsedSec / this.duration) * 100;
            this.progressBar.style.width = `${percent}%`;
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    calculateStats() {
        const correctChars = this.displayElement.querySelectorAll('.correct').length;
        const totalChars = this.inputElement.value.length;
        const elapsedMin = (Date.now() - this.startTime) / 60000;

        const wpm = elapsedMin > 0 ? Math.round((totalChars / 5) / elapsedMin) : 0;
        const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;
        const errorCount = totalChars - correctChars;

        // Convert keystrokes object to array format for database
        const keystrokesArray = Object.entries(this.keystrokes).map(([key, data]) => ({
            key,
            count: data.count,
            errors: data.errors
        }));

        return {
            wpm,
            accuracy,
            correctChars,
            totalChars,
            errorCount,
            durationMin: elapsedMin,
            keystrokes: keystrokesArray,
            errors: this.errors,
            fingerStats: this.getFingerStats()
        };
    }
}
