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
                const data = keystrokes[key.toLowerCase()];
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
        if (!container || topErrors.length === 0) return;
        
        container.innerHTML = `
            <div class="top-errors-list">
                ${topErrors.map((err, i) => `
                    <div class="error-item">
                        <span class="error-rank">#${i + 1}</span>
                        <span class="error-key">"${err.key}"</span>
                        <div class="error-bar">
                            <div class="error-fill" style="width: ${(err.errorRate * 100)}%"></div>
                        </div>
                        <span class="error-rate">${(err.errorRate * 100).toFixed(1)}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderFingerStats(container, fingerStats) {
        if (!container) return;
        
        const stats = Object.values(fingerStats).sort((a, b) => a.accuracy - b.accuracy);
        
        container.innerHTML = `
            <div class="finger-stats-list">
                ${stats.map(stat => `
                    <div class="finger-stat">
                        <span class="finger-name">${stat.finger}</span>
                        <div class="finger-bar">
                            <div class="finger-fill ${stat.accuracy < 85 ? 'low' : stat.accuracy < 95 ? 'med' : 'high'}" 
                                 style="width: ${stat.accuracy}%"></div>
                        </div>
                        <span class="finger-accuracy">${stat.accuracy}%</span>
                    </div>
                `).join('')}
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
