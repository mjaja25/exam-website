import { API_BASE_URL } from '../config.js';
import { auth } from '../utils/auth.js';
import { ui } from '../utils/ui.js';

let globalData = null;
let currentPattern = 'new_pattern';
let currentTimeframe = 'all';
let currentCategory = 'overall';
let currentUserRank = null;

const currentUser = localStorage.getItem('username');
const token = auth.getToken();

const CATEGORY_CONFIG = {
    new_pattern: [
        { key: 'new_overall', label: 'Overall Score', icon: '🏆', unit: 'Pts' },
        { key: 'new_typing', label: 'Typing Speed', icon: '⌨️', unit: 'Pts' },
        { key: 'new_mcq', label: 'Excel MCQ', icon: '📊', unit: 'Pts' }
    ],
    standard: [
        { key: 'std_overall', label: 'Overall Score', icon: '🏆', unit: 'Pts' },
        { key: 'std_typing', label: 'Typing (WPM)', icon: '⌨️', unit: 'WPM' },
        { key: 'std_letter', label: 'Letter Writing', icon: '✉️', unit: 'Pts' },
        { key: 'std_excel', label: 'Excel', icon: '📈', unit: 'Pts' }
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
        const podiumSection = document.getElementById('podium-section');
        
        if (loading) loading.style.display = 'block';
        if (podiumSection) podiumSection.style.display = 'none';
        
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
        currentUserRank = data[currentPattern];
        updateHeroSection(data);
        
        if (currentUserRank && currentUserRank.rank <= 10) {
            triggerConfetti('page');
        }
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
        heroTrend.innerHTML = '<span style="color:rgba(255,255,255,0.7);">First rank recorded!</span>';
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
        heroBadges.innerHTML = '<span style="font-size:0.9rem; color:rgba(255,255,255,0.7);">No badges yet. Keep practicing!</span>';
    }
}

function updateTabs() {
    const container = document.getElementById('category-tabs');
    if (!container) return;
    
    const config = CATEGORY_CONFIG[currentPattern];
    
    container.innerHTML = config.map(cat => `
        <button class="cat-tab ${currentCategory === cat.key || (currentCategory === 'overall' && cat.key.includes('overall')) ? 'active' : ''}" 
                onclick="setCategory('${cat.key}')">
            <span class="tab-icon">${cat.icon}</span>
            <span>${cat.label}</span>
        </button>
    `).join('');

    const validKeys = config.map(c => c.key);
    if (!validKeys.includes(currentCategory)) {
        currentCategory = validKeys[0];
        updateTabs();
    }
}

function getAvatarHtml(user, size = 'normal') {
    const sizeClass = size === 'large' ? 'podium-avatar' : (size === 'xlarge' ? 'compare-avatar-large' : 'rank-avatar');
    const initial = user.username.substring(0, 2).toUpperCase();
    
    if (user.avatar) {
        if (user.avatar.startsWith('default-')) {
            const map = { '1': '🐶', '2': '🐱', '3': '🦊', '4': '🦁' };
            const id = user.avatar.split('-')[1];
            const emoji = map[id] || '👤';
            return `<div class="${sizeClass}" style="background:#f1f5f9;font-size:1.5rem;border:1px solid #e2e8f0;">${emoji}</div>`;
        } else {
            return `<div class="${sizeClass}"><img src="${user.avatar}" alt="${user.username}"></div>`;
        }
    }
    
    return `<div class="${sizeClass}">${initial}</div>`;
}

function getScoreValue(entry) {
    if (currentCategory.includes('typing')) {
        return entry.wpm || entry.typingScore; 
    } else if (currentCategory.includes('letter')) {
        return entry.letterScore;
    } else if (currentCategory.includes('excel') || currentCategory.includes('mcq')) {
        return entry.excelScore || entry.mcqScore;
    }
    return entry.totalScore;
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    const list = globalData ? globalData[currentCategory] : [];
    const podiumSection = document.getElementById('podium-section');
    
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">📊</div>
                <div class="leaderboard-empty-text">No records found for this period.</div>
            </div>
        `;
        if (podiumSection) podiumSection.style.display = 'none';
        return;
    }

    if (podiumSection) podiumSection.style.display = 'block';
    
    const unit = getUnitForCategory(currentCategory);
    
    renderPodium(list, unit);

    const top3 = list.slice(0, 3);
    const rest = list.slice(3);

    tbody.innerHTML = top3.map((entry, i) => createRankCard(entry, i + 1, true, unit)).join('') +
        rest.map((entry, i) => createRankCard(entry, i + 4, false, unit)).join('');
}

function createRankCard(entry, rank, isTop3, unit) {
    const isMe = entry.user.username === currentUser;
    const scoreValue = getScoreValue(entry);
    
    return `
        <div class="rank-card rank-${rank} ${isMe ? 'is-me' : ''}" 
             style="animation-delay: ${isTop3 ? (rank - 1) * 0.1 : (rank - 3) * 0.05}s">
            <div class="rank-number">${rank}</div>
            <div class="rank-user" ${!isMe ? `onclick="openCompare('${entry._id}')" style="cursor:pointer"` : ''}>
                ${getAvatarHtml(entry.user)}
                <div class="rank-info">
                    <div class="rank-username">
                        ${entry.user.username}
                        ${isMe ? '<span class="rank-you-badge">YOU</span>' : ''}
                    </div>
                    ${!isMe ? '<div class="rank-click-hint">Click to compare</div>' : ''}
                </div>
            </div>
            <div class="rank-score">
                <span class="rank-score-value">${scoreValue} ${unit}</span>
                ${!isMe ? `<button class="rank-vs-btn" onclick="openCompare('${entry._id}')">VS</button>` : ''}
            </div>
        </div>
    `;
}

function renderPodium(list, unit) {
    // API returns sorted list: [1st, 2nd, 3rd, ...]
    const order = [list[0], list[1], list[2]];
    
    for (let i = 0; i < 3; i++) {
        const entry = order[i];
        const rank = i + 1;
        
        if (entry) {
            const nameEl = document.getElementById(`podium-name-${rank}`);
            const scoreEl = document.getElementById(`podium-score-${rank}`);
            const avatarEl = document.getElementById(`podium-avatar-${rank}`);
            
            if (nameEl) nameEl.textContent = entry.user.username;
            if (scoreEl) scoreEl.textContent = `${getScoreValue(entry)} ${unit}`;
            if (avatarEl) {
                const avatarHtml = getAvatarHtml(entry.user, 'large');
                avatarEl.innerHTML = avatarHtml;
            }
        }
    }
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
        }

        const youAvatar = document.getElementById('comp-you-avatar');
        const themAvatar = document.getElementById('comp-them-avatar');
        
        if (youAvatar) youAvatar.innerHTML = getAvatarHtml({ username: currentUser }, 'xlarge');
        if (themAvatar) themAvatar.innerHTML = getAvatarHtml(data.them.user, 'xlarge');

        if (!data.you) {
            if (content) content.innerHTML = `
                <div style="text-align:center; padding: 2rem;">
                    <p>You haven't completed a test in this pattern yet!</p>
                    <a href="/dashboard.html" class="btn btn-primary" style="margin-top:1rem;">Take a Test</a>
                </div>
            `;
            return;
        }

        let userWins = false;
        if (data.gaps) {
            const totalGap = data.gaps.find(g => g.category === 'Total Score');
            if (totalGap && totalGap.isBetter) {
                userWins = true;
            }
        }

        if (content) {
            content.innerHTML = data.gaps.map(gap => {
                const max = Math.max(gap.you, gap.them, 1);
                const youPct = (gap.you / max) * 50;
                const themPct = (gap.them / max) * 50;

                return `
                    <div class="gap-row">
                        <div class="gap-val">${gap.you}</div>
                        <div>
                            <div class="gap-label">${gap.category}</div>
                            <div class="gap-bar-container">
                                <div class="gap-bar gap-bar-left" style="width: ${youPct}%;"></div>
                                <div class="gap-bar gap-bar-right" style="width: ${themPct}%;"></div>
                            </div>
                        </div>
                        <div class="gap-val">${gap.them}</div>
                        <div class="tip-box ${gap.isBetter ? 'good' : 'bad'}">
                            ${gap.tip}
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (userWins) {
            setTimeout(() => triggerConfetti('compare'), 500);
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

function triggerConfetti(type) {
    // Check if confetti library is loaded
    if (typeof confetti !== 'function') {
        console.warn('Confetti library not loaded');
        return;
    }
    
    if (type === 'page') {
        const count = 200;
        const defaults = {
            origin: { y: 0.7 },
            spread: 70,
            ticks: 50,
            gravity: 0.8,
            scalar: 0.8,
            shapes: ['circle', 'square'],
            colors: ['#58CC02', '#FF9600', '#1CB0F6', '#FFD700', '#FF4B4B']
        };

        confetti({
            ...defaults,
            particleCount: count,
            ticks: 200,
            shapes: ['circle']
        });

        setTimeout(() => {
            confetti({
                ...defaults,
                particleCount: count / 2,
                spread: 100,
                startVelocity: 30,
                decay: 0.9,
                scalar: 1.2
            });
        }, 250);

    } else if (type === 'compare') {
        const defaults = {
            origin: { y: 0.6 },
            spread: 50,
            ticks: 30,
            gravity: 1,
            scalar: 0.6
        };

        confetti({
            ...defaults,
            particleCount: 100,
            colors: ['#58CC02', '#46A302', '#D7FFB8']
        });

        const end = Date.now() + 500;
        const colors = ['#FFD700', '#FF9600'];

        (function frame() {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }
}
