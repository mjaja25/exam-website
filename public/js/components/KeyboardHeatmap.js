export class KeyboardHeatmap {
    constructor(container, data, mode = 'errors') {
        this.container = container;
        this.data = data || {};
        this.mode = mode;
        this.layout = this.getQWERTYLayout();
    }

    getQWERTYLayout() {
        return [
            ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
            ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
            ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
            ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
            ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Win', 'Menu', 'Ctrl']
        ];
    }

    getKeyIndicatorClass(key) {
        const keyLower = key.toLowerCase();
        const keyData = this.data[keyLower] || { count: 0, errors: 0 };
        
        if (this.mode === 'errors') {
            if (keyData.count === 0) return null;
            const errorRate = keyData.errors / keyData.count;
            if (errorRate > 0.2) return 'error-high';
            if (errorRate > 0.1) return 'error-med';
            if (keyData.errors > 0) return 'error-low';
            return null;
        } else {
            const maxCount = Math.max(
                1,
                ...Object.values(this.data).map(k => k.count)
            );
            const intensity = keyData.count / maxCount;
            if (intensity > 0.7) return 'usage-high';
            if (intensity > 0.4) return 'usage-med';
            if (keyData.count > 0) return 'usage-low';
            return null;
        }
    }

    getKeyWidth(key) {
        const widths = {
            'Backspace': 2,
            'Tab': 1.5,
            'Caps': 1.8,
            'Enter': 2.2,
            'Shift': 2.3,
            'Ctrl': 1.3,
            'Win': 1.3,
            'Alt': 1.3,
            'Space': 6,
            'Menu': 1.3
        };
        return widths[key] || 1;
    }

    render() {
        this.container.innerHTML = '';
        
        const keyboard = document.createElement('div');
        keyboard.className = 'keyboard-heatmap';
        
        this.layout.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';
            
            row.forEach(key => {
                const keyDiv = document.createElement('div');
                keyDiv.className = 'key';
                keyDiv.style.flex = this.getKeyWidth(key);
                
                const keyText = document.createElement('span');
                keyText.textContent = key;
                keyDiv.appendChild(keyText);
                
                const indicatorClass = this.getKeyIndicatorClass(key);
                if (indicatorClass) {
                    const indicator = document.createElement('div');
                    indicator.className = `key-indicator ${indicatorClass}`;
                    keyDiv.appendChild(indicator);
                }
                
                const keyLower = key.toLowerCase();
                const keyData = this.data[keyLower];
                if (keyData) {
                    const errorRate = keyData.count > 0 
                        ? ((keyData.errors / keyData.count) * 100).toFixed(1)
                        : 0;
                    keyDiv.title = `${key}: ${keyData.count} presses, ${keyData.errors} errors (${errorRate}%)`;
                }
                
                rowDiv.appendChild(keyDiv);
            });
            
            keyboard.appendChild(rowDiv);
        });
        
        this.container.appendChild(keyboard);
        this.renderLegend();
    }

    renderLegend() {
        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        
        if (this.mode === 'errors') {
            legend.innerHTML = `
                <span class="legend-item"><span class="color-box" style="background: #dc2626;"></span>High Error Rate (&gt;20%)</span>
                <span class="legend-item"><span class="color-box" style="background: #fbbf24;"></span>Medium (10-20%)</span>
                <span class="legend-item"><span class="color-box" style="background: #4ade80;"></span>Low (&lt;10%)</span>
                <span class="legend-item"><span class="color-box" style="background: var(--bg-card); border: 1px solid var(--border-color);"></span>No Errors</span>
            `;
        } else {
            legend.innerHTML = `
                <span class="legend-item"><span class="color-box" style="background: var(--primary);"></span>High Usage</span>
                <span class="legend-item"><span class="color-box" style="background: #86efac;"></span>Medium</span>
                <span class="legend-item"><span class="color-box" style="background: #bbf7d0;"></span>Low</span>
                <span class="legend-item"><span class="color-box" style="background: var(--bg-card); border: 1px solid var(--border-color);"></span>Not Used</span>
            `;
        }
        
        this.container.appendChild(legend);
    }

    setMode(mode) {
        this.mode = mode;
        this.render();
    }

    updateData(data) {
        this.data = data;
        this.render();
    }
}
