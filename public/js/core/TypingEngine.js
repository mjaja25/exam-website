export class TypingEngine {
    constructor(config) {
        this.displayElement = config.displayElement;
        this.inputElement = config.inputElement;
        this.timerElement = config.timerElement;
        this.progressBar = config.progressBar;
        this.wpmElement = config.wpmElement;
        this.accuracyElement = config.accuracyElement;

        this.duration = config.duration || 300; // seconds
        this.onComplete = config.onComplete || (() => { });
        this.onTick = config.onTick || (() => { });

        this.timerInterval = null;
        this.startTime = null;
        this.isRunning = false;
        this.currentPassage = '';

        this.bindEvents();
    }

    loadPassage(text) {
        this.currentPassage = text;
        this.displayElement.innerHTML = '';
        this.inputElement.value = '';
        this.inputElement.disabled = false;
        this.isRunning = false; // Reset running state
        this.startTime = null; // Reset start time
        if (this.timerInterval) clearInterval(this.timerInterval);

        // Reset Display
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

        // Prevent copy/paste
        ['paste', 'copy', 'cut'].forEach(evt => {
            this.inputElement.addEventListener(evt, e => e.preventDefault());
        });

        // Handle Tab/Enter blocking if needed (passed via config or handled here)
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                // Prevent submission/exit via keyboard if strictly exam mode
                // but might want to allow it for practice. Leaving flexible for now.
            }
        });
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
            } else {
                span.classList.add('incorrect');
            }
        });

        // Highlight next char
        if (chars.length < spans.length) {
            const next = spans[chars.length];
            next.classList.add('current');
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Finished passage
            this.end();
        }

        // Live Stats
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

        return { wpm, accuracy, correctChars, totalChars, durationMin: elapsedMin };
    }
}
