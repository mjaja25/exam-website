import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

let globalData = null;
let currentPattern = 'new_pattern';
let currentTimeframe = 'all';
let currentCategory = 'overall';

const currentUser = localStorage.getItem('username');
const token = auth.getToken();

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

    await loadData();
    await loadMyRank();
    await loadAchievements();

    updateTabs();
    renderLeaderboard();
});

async function loadData() {
    try {
        const loading = document.getElementById('loading-state');
        if (loading) loading.style.display = 'block';
        
        const res = await fetch(`/api/leaderboard/all?timeframe=${currentTimeframe}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        globalData = await res.json();
        
        if (loading) loading.style.display = 'none';
        renderLeaderboard();
    } catch (err) {
        console.error("Leaderboard Error:", err);
        ui.showToast("Failed to load leaderboard data", "error");
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

function updateHeroSection(data) {
    const rankData = data[currentPattern];
    const heroRank = document.getElementById('hero-rank');
    const heroPercentile = document.getElementById('hero-percentile');
    const heroTrend = document.getElementById('hero-trend');

    if (!rankData || !rankData.bestResult) {
        if (heroRank) heroRank.textContent = '--';
        if (heroPercentile) heroPercentile.textContent = 'Unranked';
        if (heroTrend) heroTrend.innerHTML = '<span>Complete a test to get ranked!</span>';
        return;
    }

    if (heroRank) heroRank.textContent = `#${rankData.rank}`;
    if (heroPercentile) heroPercentile.textContent = `Top ${rankData.percentile}%`;
    
    if (heroTrend && rankData.trend) {
        const { delta, direction } = rankData.trend;
        const icon = direction === 'up' ? '▲' : '▼';
        const colorClass = direction === 'up' ? 'trend-up' : 'trend-down';
        heroTrend.innerHTML = `<span class="${colorClass}">${icon} ${Math.abs(delta)} pts</span> vs last exam`;
    } else if (heroTrend) {
        heroTrend.innerHTML = '<span style="color:#94a3b8;">First rank recorded!</span>';
    }
}

function renderBadges(badges) {
    const grid = document.getElementById('badges-grid');
    const heroBadges = document.getElementById('hero-badges');
    
    if (grid) grid.innerHTML = '';
    if (heroBadges) heroBadges.innerHTML = '';

    if (!badges) return;

    badges.sort((a, b) => b.earned - a.earned);

    badges.forEach(badge => {
        if (grid) {
            const card = document.createElement('div');
            card.className = `badge-card ${badge.earned ? 'earned' : ''}`;
            card.innerHTML = `
                <div class="badge-check">✔</div>
                <span class="badge-icon">${badge.icon}</span>
                <div class="badge-name">${badge.name}</div>
                <div class="badge-desc">${badge.desc}</div>
            `;
            grid.appendChild(card);
        }

        if (heroBadges && badge.earned && heroBadges.children.length < 5) {
            const mini = document.createElement('div');
            mini.className = 'mini-badge earned';
            mini.innerHTML = badge.icon;
            mini.title = badge.name;
            heroBadges.appendChild(mini);
        }
    });

    if (heroBadges && heroBadges.children.length === 0) {
        heroBadges.innerHTML = '<span style="font-size:0.9rem; color:#64748b;">No badges yet. Keep practicing!</span>';
    }
}

function updateTabs() {
    const container = document.getElementById('category-tabs');
    if (!container) return;
    
    const config = CATEGORY_CONFIG[currentPattern];
    
    container.innerHTML = config.map(cat => `
        <button class="cat-tab ${currentCategory === cat.key || (currentCategory === 'overall' && cat.key.includes('overall')) ? 'active' : ''}" 
                onclick="setCategory('${cat.key}')">
            ${cat.label}
        </button>
    `).join('');

    const validKeys = config.map(c => c.key);
    if (!validKeys.includes(currentCategory)) {
        currentCategory = validKeys[0];
        updateTabs();
    }
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    const list = globalData ? globalData[currentCategory] : [];
    
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: #64748b;">No records found for this period.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((entry, i) => {
        const isMe = entry.user.username === currentUser;
        const rank = i + 1;
        
        let value = 0;
        if (currentCategory.includes('typing')) {
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

        let avatarHtml = `<div class="avatar-placeholder">${entry.user.username.substring(0, 2).toUpperCase()}</div>`;
        if (entry.user.avatar) {
            if (entry.user.avatar.startsWith('default-')) {
                const map = { '1': '🐶', '2': '🐱', '3': '🦊', '4': '🦁' };
                const id = entry.user.avatar.split('-')[1];
                const emoji = map[id] || '👤';
                avatarHtml = `<div class="avatar-placeholder" style="background:#f1f5f9;font-size:1.5rem;border:1px solid #e2e8f0;">${emoji}</div>`;
            } else {
                avatarHtml = `<img src="${entry.user.avatar}" class="avatar-img" alt="${entry.user.username}">`;
            }
        }

        return `
            <tr class="rank-row rank-${rank} ${isMe ? 'is-me' : ''}" onclick="${!isMe ? `openCompare('${entry._id}')` : ''}" style="${!isMe ? 'cursor:pointer' : ''}">
                <td>${rank}</td>
                <td>
                    <div class="user-cell">
                        ${avatarHtml}
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

window.setPattern = function(pattern) {
    currentPattern = pattern;
    
    const btnNew = document.getElementById('btn-new');
    const btnStd = document.getElementById('btn-std');
    if (btnNew) btnNew.classList.toggle('active', pattern === 'new_pattern');
    if (btnStd) btnStd.classList.toggle('active', pattern === 'standard');

    currentCategory = pattern === 'new_pattern' ? 'new_overall' : 'std_overall';
    
    updateTabs();
    renderLeaderboard();
    loadMyRank();
};

window.setTimeframe = function(frame) {
    currentTimeframe = frame;
    loadData();
};

window.setCategory = function(catKey) {
    currentCategory = catKey;
    updateTabs();
    renderLeaderboard();
};

window.openCompare = async function(resultId) {
    const modal = document.getElementById('compare-modal');
    const content = document.getElementById('compare-content');
    
    if (modal) modal.style.display = 'flex';
    if (content) content.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

    try {
        const res = await fetch(`/api/leaderboard/compare/${resultId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.message && !data.them) {
            if (content) content.innerHTML = `<p style="text-align:center; color:#ef4444;">${data.message}</p>`;
            return;
        }

        const themName = document.getElementById('comp-them-name');
        if (themName) {
            themName.textContent = data.them.user.username;
            themName.style.color = '#ef4444';
        }

        if (!data.you) {
            if (content) content.innerHTML = `
                <div style="text-align:center; padding: 2rem;">
                    <p>You haven't completed a test in this pattern yet!</p>
                    <a href="/dashboard.html" class="nav-button primary" style="margin-top:1rem;">Take a Test</a>
                </div>
            `;
            return;
        }

        if (content) {
            content.innerHTML = data.gaps.map(gap => {
                const max = Math.max(gap.you, gap.them, 1);
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
        }

    } catch (err) {
        console.error("Compare Error:", err);
        if (content) content.innerHTML = '<p style="text-align:center; color:red;">Failed to load comparison.</p>';
    }
};

window.closeModal = function(e) {
    const modal = document.getElementById('compare-modal');
    if (modal) modal.style.display = 'none';
};
