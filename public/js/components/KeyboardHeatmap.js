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
        // Normalize key label to match data keys (usually lowercase or specific codes)
        // Data likely keys: 'a', 'b', '1', 'space', 'shift' etc.
        const key = keyLabel.toLowerCase();
        const stats = this.data[key];

        if (!stats || stats.errors === 0) return '';

        // Calculate error rate: errors / total presses
        // If total presses is 0 (shouldn't happen if errors > 0), assume high error
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
}
