let globalData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = '/login.html';

    // 1. Fetch the all-in-one cached leaderboard data
    try {
        document.getElementById('loading-state').style.display = 'block';
        const res = await fetch('/api/leaderboard/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        globalData = await res.json();
        document.getElementById('loading-state').style.display = 'none';

        // Initial load: New Pattern
        renderCategory('new_overall');
    } catch (err) {
        console.error("Leaderboard Error:", err);
    }
});

function loadTab(category, btn) {
    // UI Update
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Data Update
    renderCategory(category);
}

function renderCategory(key) {
    const list = globalData[key];
    const tbody = document.getElementById('leaderboard-body');
    const currentUser = localStorage.getItem('username'); // Assuming you store this at login

    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No records found yet.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((entry, i) => {
        const isTop3 = i < 3;
        const isMe = entry.user.username === currentUser;
        const rank = i + 1;
        
        // Dynamic medal selection
        let medal = "";
        if (rank === 1) medal = "🥇";
        else if (rank === 2) medal = "🥈";
        else if (rank === 3) medal = "🥉";

        return `
            <tr class="rank-row row-${rank} ${isMe ? 'my-rank' : ''}">
                <td>${medal || rank}</td>
                <td>
                    <span class="winner-name ${isMe ? 'highlight-user' : ''}">
                        ${entry.user.username} ${isMe ? '(You)' : ''}
                    </span>
                </td>
                <td>
                    <span class="score-pill">
                        ${entry.totalScore || entry.wpm} ${key.includes('typing') ? 'WPM' : 'Pts'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}