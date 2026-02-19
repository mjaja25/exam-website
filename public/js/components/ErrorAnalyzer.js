export class ErrorAnalyzer {
    analyze(errors, keystrokes) {
        return {
            topErrors: this.getTopErrors(errors, keystrokes, 5),
            errorPatterns: this.findPatterns(errors),
            fingerPerformance: this.analyzeFingerPerformance(keystrokes),
            recommendations: this.generateRecommendations(errors, keystrokes)
        };
    }

    getTopErrors(errors, keystrokes, limit) {
        // Get error rates per key
        const keyStats = {};
        
        Object.entries(keystrokes).forEach(([key, data]) => {
            if (data.errors > 0) {
                const rate = data.count > 0 ? (data.errors / data.count) : 0;
                keyStats[key] = {
                    key,
                    count: data.count,
                    errors: data.errors,
                    errorRate: rate
                };
            }
        });

        return Object.values(keyStats)
            .sort((a, b) => b.errorRate - a.errorRate)
            .slice(0, limit);
    }

    findPatterns(errors) {
        if (errors.length < 2) return [];

        const patterns = {};
        
        // Look for consecutive error patterns
        for (let i = 1; i < errors.length; i++) {
            const prev = errors[i - 1];
            const curr = errors[i];
            
            // Check if errors are consecutive
            if (curr.position === prev.position + 1) {
                const pattern = `${prev.expected}${curr.expected}→${prev.key}${curr.key}`;
                patterns[pattern] = (patterns[pattern] || 0) + 1;
            }
            
            // Check for transposition (swapped letters)
            if (curr.position === prev.position + 1 && 
                curr.key === prev.expected && 
                prev.key === curr.expected) {
                const transposition = `${prev.expected}${curr.expected}↔${curr.expected}${prev.expected}`;
                patterns[transposition] = (patterns[transposition] || 0) + 1;
            }
        }

        return Object.entries(patterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pattern, count]) => ({ pattern, count }));
    }

    analyzeFingerPerformance(keystrokes) {
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

        const stats = {};
        for (const [finger, keys] of Object.entries(fingerMap)) {
            let total = 0, errors = 0;
            for (const key of keys) {
                // Check both original case and lowercase to handle case-sensitive keystroke data
                const data = keystrokes[key] || keystrokes[key.toLowerCase()];
                if (data) {
                    total += data.count;
                    errors += data.errors;
                }
            }
            const accuracy = total > 0 ? ((total - errors) / total * 100).toFixed(1) : 100;
            stats[finger] = { 
                finger: finger.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                total, 
                errors, 
                accuracy: parseFloat(accuracy)
            };
        }
        return stats;
    }

    generateRecommendations(errors, keystrokes) {
        const recs = [];
        
        // Check for high error rate keys
        const topErrors = this.getTopErrors(errors, keystrokes, 3);
        if (topErrors.length > 0) {
            const problematicKeys = topErrors.map(e => `"${e.key}"`).join(', ');
            recs.push({
                icon: '⚠️',
                text: `Focus on keys: ${problematicKeys}. These have the highest error rates.`,
                priority: 'high'
            });
        }

        // Check finger performance
        const fingerStats = this.analyzeFingerPerformance(keystrokes);
        const weakFingers = Object.values(fingerStats)
            .filter(stat => stat.accuracy < 85 && stat.total > 10)
            .sort((a, b) => a.accuracy - b.accuracy);
        
        if (weakFingers.length > 0) {
            const fingerNames = weakFingers.slice(0, 2).map(f => f.finger).join(', ');
            recs.push({
                icon: '💪',
                text: `Strengthen ${fingerNames} with targeted drills.`,
                priority: 'medium'
            });
        }

        // Check for transposition errors
        const patterns = this.findPatterns(errors);
        const transpositions = patterns.filter(p => p.pattern.includes('↔'));
        if (transpositions.length > 0) {
            recs.push({
                icon: '🔀',
                text: 'Practice typing common letter combinations slowly to avoid transpositions.',
                priority: 'medium'
            });
        }

        // Check overall accuracy
        const totalKeystrokes = Object.values(keystrokes).reduce((sum, k) => sum + k.count, 0);
        const totalErrors = Object.values(keystrokes).reduce((sum, k) => sum + k.errors, 0);
        const overallAccuracy = totalKeystrokes > 0 
            ? ((totalKeystrokes - totalErrors) / totalKeystrokes * 100).toFixed(1)
            : 100;
        
        if (parseFloat(overallAccuracy) < 90) {
            recs.push({
                icon: '🎯',
                text: 'Focus on accuracy over speed. Slow down and type each key correctly.',
                priority: 'high'
            });
        }

        // Check for spacebar issues (common problem)
        const spaceData = keystrokes[' '];
        if (spaceData && spaceData.errors > 0) {
            recs.push({
                icon: '👍',
                text: 'Use your thumbs for the spacebar, not other fingers.',
                priority: 'low'
            });
        }

        return recs;
    }

    renderTopErrors(container, topErrors) {
        if (!container) return;
        if (topErrors.length === 0) {
            container.innerHTML = '<div class="no-errors">✨ Clean run! No significant errors detected.</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="top-errors-grid">
                ${topErrors.map((err, i) => {
                    const health = Math.max(0, 100 - (err.errorRate * 100 * 2)); // Amplify error impact visually
                    const healthColor = health > 80 ? '#4ade80' : health > 50 ? '#facc15' : '#f87171';
                    
                    return `
                    <div class="key-card">
                        <div class="key-display">
                            <span class="key-char">${err.key === ' ' ? 'Space' : err.key}</span>
                            <span class="error-badge">${err.errors}</span>
                        </div>
                        <div class="key-health">
                            <div class="health-bar" style="width: ${health}%; background: ${healthColor}"></div>
                        </div>
                        <div class="key-stats">
                            <span class="stat-label">Accuracy</span>
                            <span class="stat-val">${(100 - err.errorRate * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    renderFingerStats(container, fingerStats) {
        if (!container) return;
        
        const fingerOrder = [
            'leftPinky', 'leftRing', 'leftMiddle', 'leftIndex', 'thumbs', 
            'rightIndex', 'rightMiddle', 'rightRing', 'rightPinky'
        ];

        const maxVal = Math.max(...Object.values(fingerStats).map(s => s.total));
        
        container.innerHTML = `
            <div class="finger-equalizer">
                ${fingerOrder.map(fKey => {
                    const stat = fingerStats[fKey];
                    if (!stat) return '';
                    
                    // Normalize height based on usage volume, color by accuracy
                    const heightPercent = maxVal > 0 ? (stat.total / maxVal) * 100 : 0;
                    const accuracyColor = stat.accuracy >= 95 ? '#4ade80' : stat.accuracy >= 85 ? '#facc15' : '#f87171';
                    const label = stat.finger.split(' ').map(w => w[0]).join(''); // LP, LR, LM...
                    
                    return `
                    <div class="eq-band" title="${stat.finger}: ${stat.accuracy}% (${stat.errors} err)">
                        <div class="eq-bar-container">
                            <div class="eq-bar" style="height: ${Math.max(10, heightPercent)}%; background: ${accuracyColor}"></div>
                        </div>
                        <span class="eq-label">${label}</span>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    renderRecommendations(container, recommendations) {
        if (!container || recommendations.length === 0) return;
        
        container.innerHTML = `
            <ul class="recommendations-list">
                ${recommendations.map(rec => `
                    <li class="recommendation-item priority-${rec.priority}">
                        <span class="rec-icon">${rec.icon}</span>
                        <span class="rec-text">${rec.text}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    }
}
