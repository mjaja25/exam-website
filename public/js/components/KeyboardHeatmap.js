export class KeyboardHeatmap {
    constructor(container, data) {
        this.container = container;
        this.data = data || {};
        this.layout = [
            ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
            ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
            ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
            ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
            ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Win', 'Menu', 'Ctrl']
        ];
        this.render();
    }

    getKeyClass(keyLabel) {
        // Check both original case and lowercase — TypingEngine stores keys case-sensitively
        const key = keyLabel.toLowerCase();
        const stats = this.data[key] || this.data[keyLabel];

        if (!stats || stats.errors === 0) return '';

        const total = stats.count || stats.errors; 
        const rate = stats.errors / total;

        // Gradient logic
        if (rate >= 0.5) return 'error-critical'; // > 50% error rate
        if (rate >= 0.2) return 'error-high';     // > 20%
        if (rate >= 0.05) return 'error-med';      // > 5%
        return 'error-low';                       // > 0%
    }

    getKeyWidth(key) {
        const widths = {
            'Backspace': 2, 'Tab': 1.5, 'Caps': 1.8, 'Enter': 2.2,
            'Shift': 2.4, 'Ctrl': 1.5, 'Win': 1.2, 'Alt': 1.2,
            'Space': 6.2, 'Menu': 1.2
        };
        return widths[key] || 1;
    }

    render() {
        this.container.innerHTML = '';
        const board = document.createElement('div');
        board.className = 'keyboard-heatmap-board';

        this.layout.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'kb-row';
            
            row.forEach(keyLabel => {
                const keyEl = document.createElement('div');
                keyEl.className = `kb-key ${this.getKeyClass(keyLabel)}`;
                keyEl.style.flex = this.getKeyWidth(keyLabel);
                keyEl.textContent = keyLabel;

                // Tooltip
                const stats = this.data[keyLabel.toLowerCase()];
                if (stats) {
                    const rate = stats.count > 0 ? Math.round((stats.errors / stats.count) * 100) : 0;
                    keyEl.title = `Errors: ${stats.errors} | Presses: ${stats.count} | Rate: ${rate}%`;
                }

                rowEl.appendChild(keyEl);
            });
            board.appendChild(rowEl);
        });

        this.container.appendChild(board);
        this.renderLegend();
    }

    renderLegend() {
        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        legend.innerHTML = `
            <div class="legend-item"><span class="dot critical"></span>Critical (>50%)</div>
            <div class="legend-item"><span class="dot high"></span>High (>20%)</div>
            <div class="legend-item"><span class="dot med"></span>Medium (>5%)</div>
            <div class="legend-item"><span class="dot low"></span>Low (<5%)</div>
        `;
        this.container.appendChild(legend);
    }

    updateData(newData) {
        this.data = newData || {};
        this.render();
    }

    highlightWeakFingers(weakFingers, frequentErrors) {
        if (!weakFingers && !frequentErrors) return;

        const fingerMap = {
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

        // Collect weak keys from finger names
        const weakKeys = new Set();
        if (weakFingers && Array.isArray(weakFingers)) {
            weakFingers.forEach(finger => {
                const normalized = finger.replace(/\s+/g, '').replace(/^(.)/, c => c.toLowerCase());
                const keys = fingerMap[normalized];
                if (keys) {
                    for (const k of keys) weakKeys.add(k.toLowerCase());
                }
            });
        }

        // Add frequent error keys
        if (frequentErrors && Array.isArray(frequentErrors)) {
            frequentErrors.forEach(k => weakKeys.add(k.toLowerCase()));
        }

        // Apply highlight class to matching key elements
        const keyEls = this.container.querySelectorAll('.kb-key');
        keyEls.forEach(el => {
            const label = el.textContent.toLowerCase();
            if (weakKeys.has(label)) {
                el.classList.add('ai-weak-highlight');
            }
        });
    }
}
