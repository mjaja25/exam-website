let globalData = null;
let currentPattern = 'new_pattern';
let currentTimeframe = 'all';
let currentCategory = 'overall';

const currentUser = localStorage.getItem('username');
const token = localStorage.getItem('token');

// Config for Categories
const CATEGORY_CONFIG = {
    new_pattern: [
        { key: 'new_overall', label: 'Overall Score', unit: 'Pts' },
        { key: 'new_typing', label: 'Typing Speed', unit: 'Pts' },
        { key: 'new_mcq', label: 'Excel MCQ', unit: 'Pts' }
    ],
    standard: [
        { key: 'std_overall', label: 'Overall Score', unit: 'Pts' },
        { key: 'std_typing', label: 'Typing (WPM)', unit: 'WPM' },
        { key: 'std_letter', label: 'Letter Writing', unit: 'Pts' },
        { key: 'std_excel', label: 'Excel', unit: 'Pts' }
    ]
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!token) window.location.href = '/login.html';

    // Initial Load
    await loadData();
    await loadMyRank();
    await loadAchievements();

    // Set Default Tab
    updateTabs();
    renderLeaderboard();
});

// --- 1. Data Fetching ---

async function loadData() {
    try {
        document.getElementById('loading-state').style.display = 'block';
        const res = await fetch(`/api/leaderboard/all?timeframe=${currentTimeframe}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        globalData = await res.json();
        document.getElementById('loading-state').style.display = 'none';
        renderLeaderboard(); // Re-render when data refreshes
    } catch (err) {
        console.error("Leaderboard Error:", err);
        showToast("Failed to load leaderboard data", "error");
    }
}

async function loadMyRank() {
    try {
        const res = await fetch('/api/leaderboard/my-rank', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        updateHeroSection(data);
    } catch (err) {
        console.error("My Rank Error:", err);
    }
}

async function loadAchievements() {
    try {
        const res = await fetch('/api/user/achievements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const badges = await res.json();
        renderBadges(badges);
    } catch (err) {
        console.error("Badges Error:", err);
    }
}

// --- 2. Rendering ---

function updateHeroSection(data) {
    const rankData = data[currentPattern];
    const heroRank = document.getElementById('hero-rank');
    const heroPercentile = document.getElementById('hero-percentile');
    const heroTrend = document.getElementById('hero-trend');

    if (!rankData || !rankData.bestResult) {
        heroRank.textContent = '--';
        heroPercentile.textContent = 'Unranked';
        heroTrend.innerHTML = '<span>Complete a test to get ranked!</span>';
        return;
    }

    heroRank.textContent = `#${rankData.rank}`;
    heroPercentile.textContent = `Top ${rankData.percentile}%`;
    
    if (rankData.trend) {
        const { delta, direction } = rankData.trend;
        const icon = direction === 'up' ? '▲' : '▼';
        const colorClass = direction === 'up' ? 'trend-up' : 'trend-down';
        heroTrend.innerHTML = `<span class="${colorClass}">${icon} ${Math.abs(delta)} pts</span> vs last exam`;
    } else {
        heroTrend.innerHTML = '<span style="color:#94a3b8;">First rank recorded!</span>';
    }
}

function renderBadges(badges) {
    const grid = document.getElementById('badges-grid');
    const heroBadges = document.getElementById('hero-badges');
    
    grid.innerHTML = '';
    heroBadges.innerHTML = '';

    // Sort: Earned first
    badges.sort((a, b) => b.earned - a.earned);

    badges.forEach(badge => {
        // Main Grid Card
        const card = document.createElement('div');
        card.className = `badge-card ${badge.earned ? 'earned' : ''}`;
        card.innerHTML = `
            <div class="badge-check">✔</div>
            <span class="badge-icon">${badge.icon}</span>
            <div class="badge-name">${badge.name}</div>
            <div class="badge-desc">${badge.desc}</div>
        `;
        grid.appendChild(card);

        // Hero Mini Badge (Only earned ones, max 5)
        if (badge.earned && heroBadges.children.length < 5) {
            const mini = document.createElement('div');
            mini.className = 'mini-badge earned';
            mini.innerHTML = badge.icon;
            mini.title = badge.name;
            heroBadges.appendChild(mini);
        }
    });

    if (heroBadges.children.length === 0) {
        heroBadges.innerHTML = '<span style="font-size:0.9rem; color:#64748b;">No badges yet. Keep practicing!</span>';
    }
}

function updateTabs() {
    const container = document.getElementById('category-tabs');
    const config = CATEGORY_CONFIG[currentPattern];
    
    container.innerHTML = config.map(cat => `
        <button class="cat-tab ${currentCategory === cat.key || (currentCategory === 'overall' && cat.key.includes('overall')) ? 'active' : ''}" 
                onclick="setCategory('${cat.key}')">
            ${cat.label}
        </button>
    `).join('');

    // If current category doesn't match pattern, switch to default (overall)
    const validKeys = config.map(c => c.key);
    if (!validKeys.includes(currentCategory)) {
        currentCategory = validKeys[0];
        // Re-render tabs to highlight new default
        updateTabs(); 
    }
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    const list = globalData ? globalData[currentCategory] : [];
    
    // Safety check
    if (!list) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: #64748b;">No records found for this period.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((entry, i) => {
        const isMe = entry.user.username === currentUser;
        const rank = i + 1;
        
        // Value to display
        let value = 0;
        if (currentCategory.includes('typing')) {
            // Typing could be wpm or typingScore depending on pattern
            value = entry.wpm || entry.typingScore; 
        } else if (currentCategory.includes('letter')) {
            value = entry.letterScore;
        } else if (currentCategory.includes('excel')) {
            value = entry.excelScore;
        } else if (currentCategory.includes('mcq')) {
            value = entry.mcqScore;
        } else {
            value = entry.totalScore;
        }

        const unit = getUnitForCategory(currentCategory);

        return `
            <tr class="rank-row rank-${rank} ${isMe ? 'is-me' : ''}" onclick="${!isMe ? `openCompare('${entry._id}')` : ''}" style="${!isMe ? 'cursor:pointer' : ''}">
                <td>${rank}</td>
                <td>
                    <div class="user-cell">
                        <div class="avatar-placeholder">
                            ${entry.user.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <span class="winner-name" style="font-weight: 600; color: #0f172a;">
                                ${entry.user.username} ${isMe ? '(You)' : ''}
                            </span>
                            ${!isMe ? '<div style="font-size: 0.75rem; color: #94a3b8;">Click to compare</div>' : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: flex-end;">
                        <span class="score-pill">
                            ${value} ${unit}
                        </span>
                        ${!isMe ? `<button class="compare-btn">VS</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getUnitForCategory(cat) {
    if (cat.includes('typing') && currentPattern === 'standard') return 'WPM';
    return 'Pts';
}

// --- 3. Interactions ---

window.setPattern = function(pattern) {
    currentPattern = pattern;
    
    // Update Toggle Buttons
    document.getElementById('btn-new').classList.toggle('active', pattern === 'new_pattern');
    document.getElementById('btn-std').classList.toggle('active', pattern === 'standard');

    // Reset category to overall for the new pattern
    currentCategory = pattern === 'new_pattern' ? 'new_overall' : 'std_overall';
    
    updateTabs();
    renderLeaderboard();
    loadMyRank(); // Refresh Hero for new pattern
};

window.setTimeframe = function(frame) {
    currentTimeframe = frame;
    loadData(); // Re-fetch data
};

window.setCategory = function(catKey) {
    currentCategory = catKey;
    updateTabs();
    renderLeaderboard();
};

// --- 4. Comparison Modal ---

window.openCompare = async function(resultId) {
    const modal = document.getElementById('compare-modal');
    const content = document.getElementById('compare-content');
    
    modal.style.display = 'flex';
    content.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

    try {
        const res = await fetch(`/api/leaderboard/compare/${resultId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.message && !data.them) {
             content.innerHTML = `<p style="text-align:center; color:#ef4444;">${data.message}</p>`;
             return;
        }

        // Update Names
        document.getElementById('comp-them-name').textContent = data.them.user.username;
        document.getElementById('comp-them-name').style.color = '#ef4444'; // Red for them

        // Render Bars
        if (!data.you) {
            content.innerHTML = `
                <div style="text-align:center; padding: 2rem;">
                    <p>You haven't completed a test in this pattern yet!</p>
                    <a href="/dashboard.html" class="nav-button primary" style="margin-top:1rem;">Take a Test</a>
                </div>
            `;
            return;
        }

        content.innerHTML = data.gaps.map(gap => {
            // Calculate width percentages relative to the max of the two
            const max = Math.max(gap.you, gap.them, 1); // Avoid div by zero
            const youPct = (gap.you / max) * 100;
            const themPct = (gap.them / max) * 100;

            return `
                <div class="gap-row">
                    <div class="gap-val" style="color: #3b82f6;">${gap.you}</div>
                    
                    <div>
                        <div class="gap-label">${gap.category}</div>
                        <div class="gap-bar-container">
                            <div class="gap-bar bar-left" style="width: 50%; display: flex; justify-content: flex-end;">
                                <div style="width: ${youPct}%; background: #3b82f6; height: 100%; border-radius: 4px 0 0 4px;"></div>
                            </div>
                            <div class="gap-bar bar-right" style="width: 50%; display: flex; justify-content: flex-start;">
                                <div style="width: ${themPct}%; background: #ef4444; height: 100%; border-radius: 0 4px 4px 0;"></div>
                            </div>
                        </div>
                    </div>

                    <div class="gap-val" style="color: #ef4444;">${gap.them}</div>

                    <div class="tip-box ${gap.isBetter ? 'good' : 'bad'}">
                        ${gap.tip}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Compare Error:", err);
        content.innerHTML = '<p style="text-align:center; color:red;">Failed to load comparison.</p>';
    }
};

window.closeModal = function(e) {
    document.getElementById('compare-modal').style.display = 'none';
};